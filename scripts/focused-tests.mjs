import { spawn } from 'node:child_process'
import { execFileSync } from 'node:child_process'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const selectorPath = 'scripts/focused-tests.mjs'
const selectorTestPath = 'scripts/focused-tests.node-test.mjs'
const fullSuiteFiles = new Set([
  'index.html',
  'package.json',
  'package-lock.json',
  'vite.config.js',
])

const normalize = value => value.replaceAll('\\', '/').replace(/^\.\//, '')

async function walk(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const relative = normalize(path.posix.join(prefix, entry.name))
    if (entry.isDirectory()) files.push(...await walk(path.join(directory, entry.name), relative))
    else files.push(relative)
  }
  return files
}

function importSpecifiers(source) {
  const specifiers = []
  const staticImport = /(?:import|export)\s+(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g
  const dynamicImport = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  for (const expression of [staticImport, dynamicImport]) {
    for (const match of source.matchAll(expression)) specifiers.push(match[1])
  }
  return specifiers
}

function resolveRelativeImport(importer, specifier, knownFiles) {
  if (!specifier.startsWith('.')) return null
  const base = normalize(path.posix.normalize(path.posix.join(path.posix.dirname(importer), specifier)))
  const candidates = [base, `${base}.js`, `${base}.mjs`, `${base}/index.js`, `${base}/index.mjs`]
  return candidates.find(candidate => knownFiles.has(candidate)) ?? null
}

export async function buildImportGraph(projectRoot = root) {
  const srcFiles = (await walk(path.join(projectRoot, 'src'), 'src')).sort()
  const scriptFiles = (await walk(path.join(projectRoot, 'scripts'), 'scripts')).sort()
  const knownFiles = new Set([...srcFiles, ...scriptFiles])
  const reverseImports = new Map()
  for (const importer of knownFiles) {
    if (!/\.(?:js|mjs)$/.test(importer)) continue
    const source = await readFile(path.join(projectRoot, importer), 'utf8')
    for (const specifier of importSpecifiers(source)) {
      const imported = resolveRelativeImport(importer, specifier, knownFiles)
      if (!imported) continue
      const importers = reverseImports.get(imported) ?? new Set()
      importers.add(importer)
      reverseImports.set(imported, importers)
    }
  }
  return { knownFiles, reverseImports }
}

function reachableTests(file, reverseImports) {
  const tests = new Set()
  const visited = new Set([file])
  const queue = [file]
  while (queue.length) {
    const current = queue.shift()
    for (const importer of reverseImports.get(current) ?? []) {
      if (visited.has(importer)) continue
      visited.add(importer)
      if (/\.test\.(?:js|mjs)$/.test(importer)) tests.add(importer)
      else queue.push(importer)
    }
  }
  return tests
}

export function selectTests(changedFiles, graph) {
  const changed = [...new Set(changedFiles.map(normalize).filter(Boolean))].sort()
  const tests = new Set()
  const reasons = []
  let full = false

  for (const file of changed) {
    if (fullSuiteFiles.has(file)) {
      full = true
      reasons.push(`${file}: shared runtime or package configuration`)
      continue
    }
    if (file === selectorPath) {
      tests.add(selectorTestPath)
      reasons.push(`${file}: selector regression test`)
      continue
    }
    if (file === selectorTestPath || /\.test\.(?:js|mjs)$/.test(file)) {
      if (graph.knownFiles.has(file)) {
        tests.add(file)
        reasons.push(`${file}: changed test`)
      }
      else {
        full = true
        reasons.push(`${file}: deleted or unavailable test; fail closed`)
      }
      continue
    }
    if (file.startsWith('src/')) {
      const reached = reachableTests(file, graph.reverseImports)
      if (reached.size === 0) {
        full = true
        reasons.push(`${file}: source has no reachable test; fail closed`)
      }
      else {
        for (const test of reached) tests.add(test)
        reasons.push(`${file}: ${reached.size} reachable test(s)`)
      }
      continue
    }
    if (/\.(?:js|mjs|ts|tsx|css|html)$/.test(file) && !file.startsWith('scripts/')) {
      full = true
      reasons.push(`${file}: unclassified runtime file; fail closed`)
    }
    else if (/\.(?:md|txt)$/.test(file) || file === '.gitignore' || file.startsWith('.codex/')) {
      reasons.push(`${file}: documentation or local workflow metadata`)
    }
  }

  return {
    mode: full ? 'full' : tests.size ? 'focused' : 'none',
    changed,
    tests: [...tests].sort(),
    reasons,
  }
}

function git(args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    .split(/\r?\n/)
    .map(line => normalize(line.trim()))
    .filter(Boolean)
}

function collectChangedFiles(base) {
  let baseAvailable = true
  try {
    git(['rev-parse', '--verify', base])
  }
  catch {
    baseAvailable = false
  }
  const files = new Set()
  if (baseAvailable) for (const file of git(['diff', '--name-only', '--diff-filter=ACMRD', `${base}...HEAD`])) files.add(file)
  for (const args of [
    ['diff', '--name-only', '--diff-filter=ACMRD'],
    ['diff', '--cached', '--name-only', '--diff-filter=ACMRD'],
    ['ls-files', '--others', '--exclude-standard'],
  ]) {
    for (const file of git(args)) files.add(file)
  }
  return { files: [...files], baseAvailable }
}

function parseArguments(argv) {
  const options = { base: 'origin/main', files: [], list: false }
  for (let index = 0; index < argv.length; index++) {
    const value = argv[index]
    if (value === '--list') options.list = true
    else if (value === '--base') options.base = argv[++index]
    else if (value === '--files') options.files.push(...argv.slice(index + 1).filter(item => !item.startsWith('--')))
  }
  return options
}

function runVitest(tests) {
  return new Promise((resolve, reject) => {
    const vitest = path.join(root, 'node_modules', 'vitest', 'vitest.mjs')
    const child = spawn(process.execPath, [vitest, 'run', ...tests], {
      cwd: root,
      env: process.env,
      stdio: 'inherit',
      windowsHide: true,
    })
    child.once('error', reject)
    child.once('exit', (code, signal) => code === 0 ? resolve() : reject(new Error(`Vitest exited with ${code ?? signal}`)))
  })
}

function runNodeTests(tests) {
  return new Promise((resolve, reject) => {
    if (tests.length === 0) return resolve()
    const child = spawn(process.execPath, ['--test', ...tests], {
      cwd: root,
      env: process.env,
      stdio: 'inherit',
      windowsHide: true,
    })
    child.once('error', reject)
    child.once('exit', (code, signal) => code === 0 ? resolve() : reject(new Error(`Node tests exited with ${code ?? signal}`)))
  })
}

async function main() {
  const options = parseArguments(process.argv.slice(2))
  const graph = await buildImportGraph()
  const detected = options.files.length ? { files: options.files, baseAvailable: true } : collectChangedFiles(options.base)
  const selection = selectTests(detected.files, graph)
  if (!detected.baseAvailable) {
    selection.mode = 'full'
    selection.reasons.unshift(`${options.base}: base ref unavailable; fail closed`)
  }
  console.log(JSON.stringify(selection, null, 2))
  if (options.list || selection.mode === 'none') return
  const nodeTests = selection.tests.filter(test => test.endsWith('.node-test.mjs'))
  const vitestTests = selection.tests.filter(test => !test.endsWith('.node-test.mjs'))
  await runNodeTests(nodeTests)
  if (selection.mode === 'full') await runVitest([])
  else if (vitestTests.length) await runVitest(vitestTests)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(error.message)
    process.exitCode = 1
  })
}
