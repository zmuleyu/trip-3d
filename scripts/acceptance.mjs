import { spawn } from 'node:child_process'
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const npmCli = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')
const defaultOutput = path.join(root, '.codex', 'evidence', 'acceptance')
const outputArg = process.argv.indexOf('--output')
const outputDir = path.resolve(outputArg >= 0 ? process.argv[outputArg + 1] : defaultOutput)
const started = performance.now()
const children = new Set()

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function exists(file) {
  try {
    await access(file)
    return true
  }
  catch {
    return false
  }
}

async function freePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer()
    server.unref()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      server.close(error => error ? reject(error) : resolve(address.port))
    })
  })
}

function spawnTracked(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: root,
    env: process.env,
    windowsHide: true,
    ...options,
  })
  children.add(child)
  child.once('exit', () => children.delete(child))
  return child
}

async function run(command, args, timeoutMs = 30_000) {
  const child = spawnTracked(command, args, { stdio: ['ignore', 'pipe', 'pipe'] })
  let output = ''
  child.stdout.on('data', chunk => { output += chunk })
  child.stderr.on('data', chunk => { output += chunk })
  const timeout = setTimeout(() => child.kill(), timeoutMs)
  try {
    const code = await new Promise((resolve, reject) => {
      child.once('error', reject)
      child.once('exit', resolve)
    })
    if (code !== 0) throw new Error(`${command} failed (${code})\n${output.slice(-2000)}`)
  }
  finally {
    clearTimeout(timeout)
  }
}

async function waitForHttp(url, timeoutMs = 10_000) {
  const deadline = performance.now() + timeoutMs
  let lastError
  while (performance.now() < deadline) {
    try {
      const response = await fetch(url, { cache: 'no-store' })
      if (response.ok) return
      lastError = new Error(`HTTP ${response.status}`)
    }
    catch (error) {
      lastError = error
    }
    await delay(100)
  }
  throw new Error(`Preview did not become ready: ${lastError?.message ?? 'timeout'}`)
}

async function findBrowser() {
  const candidates = process.platform === 'win32'
    ? [
        process.env.CHROME_PATH,
        path.join(process.env.PROGRAMFILES ?? '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
        path.join(process.env['PROGRAMFILES(X86)'] ?? '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
        path.join(process.env.LOCALAPPDATA ?? '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      ]
    : process.platform === 'darwin'
      ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
      : [process.env.CHROME_PATH, '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']
  for (const candidate of candidates.filter(Boolean)) if (await exists(candidate)) return candidate
  throw new Error('Chrome or Edge was not found. Set CHROME_PATH to a Chromium browser.')
}

class CdpSession {
  constructor(url) {
    this.socket = new WebSocket(url)
    this.nextId = 1
    this.pending = new Map()
    this.listeners = new Map()
  }

  async open() {
    await new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true })
      this.socket.addEventListener('error', reject, { once: true })
    })
    this.socket.addEventListener('message', event => {
      const message = JSON.parse(event.data)
      if (message.id) {
        const pending = this.pending.get(message.id)
        this.pending.delete(message.id)
        if (message.error) pending?.reject(new Error(message.error.message))
        else pending?.resolve(message.result)
        return
      }
      for (const listener of this.listeners.get(message.method) ?? []) listener(message.params)
    })
  }

  send(method, params = {}) {
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.socket.send(JSON.stringify({ id, method, params }))
    })
  }

  on(method, listener) {
    const listeners = this.listeners.get(method) ?? []
    listeners.push(listener)
    this.listeners.set(method, listeners)
  }

  waitFor(method, timeoutMs = 10_000) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`Timed out waiting for ${method}`)), timeoutMs)
      const listener = params => {
        clearTimeout(timeout)
        this.listeners.set(method, (this.listeners.get(method) ?? []).filter(item => item !== listener))
        resolve(params)
      }
      this.on(method, listener)
    })
  }

  close() {
    this.socket.close()
  }
}

async function waitForJson(url, timeoutMs = 10_000) {
  const deadline = performance.now() + timeoutMs
  while (performance.now() < deadline) {
    try {
      const response = await fetch(url)
      if (response.ok) return await response.json()
    }
    catch {
      // Browser is still starting.
    }
    await delay(100)
  }
  throw new Error(`Timed out waiting for ${url}`)
}

async function waitForNetworkIdle(inflight, quietMs = 500, timeoutMs = 8_000) {
  const deadline = performance.now() + timeoutMs
  let quietSince = null
  while (performance.now() < deadline) {
    if (inflight.size === 0) {
      quietSince ??= performance.now()
      if (performance.now() - quietSince >= quietMs) return
    }
    else {
      quietSince = null
    }
    await delay(50)
  }
  throw new Error(`Network did not become idle: ${[...inflight.values()].join(', ')}`)
}

function pngSize(buffer) {
  if (buffer.length < 24 || buffer.toString('ascii', 1, 4) !== 'PNG') throw new Error('Invalid PNG evidence')
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
}

async function capture(session, url, evidence, inflight) {
  await session.send('Emulation.setDeviceMetricsOverride', {
    width: evidence.width,
    height: evidence.height,
    deviceScaleFactor: 1,
    mobile: evidence.mobile,
    screenWidth: evidence.width,
    screenHeight: evidence.height,
  })
  const loaded = session.waitFor('Page.loadEventFired')
  await session.send('Page.navigate', { url })
  await loaded
  await session.send('Runtime.evaluate', {
    expression: `Promise.all([document.fonts?.ready, new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))])`,
    awaitPromise: true,
    returnByValue: true,
  })
  await waitForNetworkIdle(inflight)
  const state = await session.send('Runtime.evaluate', {
    expression: `({ title: document.title, readyState: document.readyState, appReady: !!document.querySelector('.ui-overview') })`,
    returnByValue: true,
  })
  if (!state.result.value?.appReady) throw new Error(`${evidence.name} app surface did not initialize`)
  const screenshot = await session.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false,
  })
  const buffer = Buffer.from(screenshot.data, 'base64')
  const size = pngSize(buffer)
  if (size.width !== evidence.width || size.height !== evidence.height) {
    throw new Error(`${evidence.name} screenshot was ${size.width}x${size.height}, expected ${evidence.width}x${evidence.height}`)
  }
  const file = path.join(outputDir, `${evidence.name}.png`)
  await writeFile(file, buffer)
  return { ...evidence, file, title: state.result.value.title, size }
}

async function stop(child) {
  if (!child || child.exitCode != null) return
  child.kill()
  await Promise.race([
    new Promise(resolve => child.once('exit', resolve)),
    delay(2_000),
  ])
}

let preview
let browser
let browserProfile
try {
  if (outputArg >= 0 && !process.argv[outputArg + 1]) throw new Error('--output requires a directory')
  await mkdir(outputDir, { recursive: true })
  await run(process.execPath, [path.join(root, 'scripts', 'bootstrap.mjs')])
  if (process.platform === 'win32' && await exists(npmCli)) await run(process.execPath, [npmCli, 'run', 'build'])
  else await run('npm', ['run', 'build'])

  const [previewPort, debugPort] = await Promise.all([freePort(), freePort()])
  const previewUrl = `http://127.0.0.1:${previewPort}/`
  preview = spawnTracked(process.execPath, [
    path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'),
    'preview', '--host', '127.0.0.1', '--port', String(previewPort), '--strictPort',
  ], { stdio: ['ignore', 'pipe', 'pipe'] })
  await waitForHttp(previewUrl)

  const chrome = await findBrowser()
  browserProfile = await mkdtemp(path.join(os.tmpdir(), 'trip3d-acceptance-'))
  browser = spawnTracked(chrome, [
    '--headless=new',
    '--disable-extensions',
    '--disable-background-networking',
    '--no-first-run',
    '--no-default-browser-check',
    '--hide-scrollbars',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${browserProfile}`,
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] })
  await waitForJson(`http://127.0.0.1:${debugPort}/json/version`)
  const targetResponse = await fetch(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(previewUrl)}`, { method: 'PUT' })
  if (!targetResponse.ok) throw new Error(`Could not create browser target: HTTP ${targetResponse.status}`)
  const target = await targetResponse.json()
  const session = new CdpSession(target.webSocketDebuggerUrl)
  await session.open()
  await Promise.all([
    session.send('Page.enable'),
    session.send('Runtime.enable'),
    session.send('Log.enable'),
    session.send('Network.enable'),
  ])

  const inflight = new Map()
  session.on('Network.requestWillBeSent', event => {
    if (!event.request.url.includes('/assets/maplibre-gl-csp-worker-')) {
      inflight.set(event.requestId, event.request.url)
    }
  })
  session.on('Network.loadingFinished', event => inflight.delete(event.requestId))
  session.on('Network.loadingFailed', event => inflight.delete(event.requestId))

  const errors = []
  session.on('Runtime.exceptionThrown', event => errors.push(event.exceptionDetails?.text ?? 'runtime exception'))
  session.on('Runtime.consoleAPICalled', event => {
    if (event.type === 'error') errors.push(event.args?.map(arg => arg.value ?? arg.description).join(' ') || 'console error')
  })
  session.on('Log.entryAdded', event => {
    const entry = event.entry
    const ignoredLocalFavicon = entry?.url?.endsWith('/favicon.ico') && entry.text?.includes('404')
    if (entry?.level === 'error' && !ignoredLocalFavicon) {
      errors.push(`${entry.text}${entry.url ? ` (${entry.url})` : ''}`)
    }
  })

  const evidence = []
  evidence.push(await capture(session, previewUrl, { name: 'desktop', width: 1440, height: 900, mobile: false }, inflight))
  evidence.push(await capture(session, previewUrl, { name: 'mobile-390', width: 390, height: 844, mobile: true }, inflight))
  session.close()
  if (errors.length) throw new Error(`Browser console errors:\n${errors.join('\n')}`)

  const report = {
    elapsedSeconds: Number(((performance.now() - started) / 1000).toFixed(2)),
    previewUrl,
    browser: path.basename(chrome),
    evidence,
    consoleErrors: errors,
  }
  await writeFile(path.join(outputDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`)
  console.log(`Trip 3D acceptance completed in ${report.elapsedSeconds.toFixed(2)}s.`)
  for (const item of evidence) console.log(`${item.name}: ${item.file}`)
}
finally {
  await Promise.all([...children].map(stop))
  if (browserProfile) await rm(browserProfile, { recursive: true, force: true })
}
