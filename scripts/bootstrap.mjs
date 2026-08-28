import { spawn } from 'node:child_process'
import { access, stat } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const npmCli = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')
const lockfile = path.join(root, 'package-lock.json')
const installMarker = path.join(root, 'node_modules', '.package-lock.json')
const requiredFiles = [
  path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'),
  path.join(root, 'node_modules', 'vitest', 'vitest.mjs'),
]

async function exists(file) {
  try {
    await access(file)
    return true
  }
  catch {
    return false
  }
}

async function dependenciesAreReady() {
  if (!(await exists(installMarker))) return false
  if (!(await Promise.all(requiredFiles.map(exists))).every(Boolean)) return false
  const [lock, marker] = await Promise.all([stat(lockfile), stat(installMarker)])
  return marker.mtimeMs >= lock.mtimeMs
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      env: process.env,
      stdio: 'inherit',
      windowsHide: true,
    })
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} exited with ${code ?? signal}`))
    })
  })
}

const started = performance.now()
if (await dependenciesAreReady()) {
  console.log('Trip 3D dependencies are already ready; skipping npm ci.')
}
else {
  if (process.platform === 'win32' && await exists(npmCli)) {
    await run(process.execPath, [npmCli, 'ci', '--prefer-offline', '--no-audit', '--no-fund'])
  }
  else {
    await run('npm', ['ci', '--prefer-offline', '--no-audit', '--no-fund'])
  }
}
console.log(`Trip 3D worktree setup completed in ${((performance.now() - started) / 1000).toFixed(2)}s.`)
