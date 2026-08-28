import assert from 'node:assert/strict'
import test from 'node:test'

// Keep this filename outside Vitest's *.test.* collection; it runs with node:test.

import { selectTests } from './focused-tests.mjs'

function graph(entries = {}) {
  const files = new Set(Object.keys(entries))
  for (const importers of Object.values(entries)) for (const importer of importers) files.add(importer)
  return {
    knownFiles: files,
    reverseImports: new Map(Object.entries(entries).map(([file, importers]) => [file, new Set(importers)])),
  }
}

test('selects the test that imports a changed UI leaf', () => {
  const selection = selectTests(['src/ui/fluidLayout.js'], graph({
    'src/ui/fluidLayout.js': ['src/ui/fluidLayout.test.js', 'src/main.js'],
  }))
  assert.equal(selection.mode, 'focused')
  assert.deepEqual(selection.tests, ['src/ui/fluidLayout.test.js'])
})

test('walks transitive importers to every affected test', () => {
  const selection = selectTests(['src/lib/route.js'], graph({
    'src/lib/route.js': ['src/lib/routeAnalysis.js', 'src/lib/route.test.js'],
    'src/lib/routeAnalysis.js': ['src/lib/routeAnalysis.test.js'],
  }))
  assert.equal(selection.mode, 'focused')
  assert.deepEqual(selection.tests, ['src/lib/route.test.js', 'src/lib/routeAnalysis.test.js'])
})

test('fails closed for source without a reachable test', () => {
  const selection = selectTests(['src/main.js'], graph())
  assert.equal(selection.mode, 'full')
})

test('fails closed for package and runtime configuration', () => {
  const selection = selectTests(['package.json'], graph())
  assert.equal(selection.mode, 'full')
})

test('runs a changed test directly', () => {
  const selection = selectTests(['src/ui/chrome.test.js'], graph({ 'src/ui/chrome.js': ['src/ui/chrome.test.js'] }))
  assert.equal(selection.mode, 'focused')
  assert.deepEqual(selection.tests, ['src/ui/chrome.test.js'])
})

test('fails closed when a test was deleted', () => {
  const selection = selectTests(['src/ui/chrome.test.js'], graph())
  assert.equal(selection.mode, 'full')
})

test('keeps documentation-only changes test-free', () => {
  const selection = selectTests(['README.md', '.codex/environments/environment.toml'], graph())
  assert.equal(selection.mode, 'none')
  assert.deepEqual(selection.tests, [])
})

test('selects its own regression test when the selector changes', () => {
  const selection = selectTests(['scripts/focused-tests.mjs'], graph())
  assert.equal(selection.mode, 'focused')
  assert.deepEqual(selection.tests, ['scripts/focused-tests.node-test.mjs'])
})

test('retains its Node regression test when another change forces the full suite', () => {
  const selection = selectTests(['scripts/focused-tests.mjs', 'package.json'], graph())
  assert.equal(selection.mode, 'full')
  assert.deepEqual(selection.tests, ['scripts/focused-tests.node-test.mjs'])
})
