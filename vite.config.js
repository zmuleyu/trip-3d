import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

const maplibreVendorPaths = [
  '/node_modules/@mapbox/',
  '/node_modules/@maplibre/',
  '/node_modules/earcut/',
  '/node_modules/gl-matrix/',
  '/node_modules/kdbush/',
  '/node_modules/murmurhash-js/',
  '/node_modules/pbf/',
  '/node_modules/potpack/',
  '/node_modules/quickselect/',
  '/node_modules/tinyqueue/',
]

const maplibreDepths = new Map()
const normalizeModuleId = (id) => id.replaceAll('\\', '/')
const isMaplibreSource = (id) => normalizeModuleId(id).includes('/node_modules/maplibre-gl/src/')

function maplibreDependencyDepth(id, getModuleInfo) {
  if (maplibreDepths.has(id)) return maplibreDepths.get(id)

  // Mark the module before descending so an unexpected package cycle remains bounded.
  maplibreDepths.set(id, 0)
  const dependencies = (getModuleInfo(id)?.importedIds ?? []).filter(isMaplibreSource)
  const depth = dependencies.length
    ? 1 + Math.max(...dependencies.map((dependency) => maplibreDependencyDepth(dependency, getModuleInfo)))
    : 0
  maplibreDepths.set(id, depth)
  return depth
}

function manualChunks(id, { getModuleInfo }) {
  const moduleId = normalizeModuleId(id)

  if (moduleId.includes('/node_modules/three/build/')) return 'three'
  if (moduleId.includes('/node_modules/postprocessing/')) return 'postprocessing'

  if (isMaplibreSource(id)) {
    // Contiguous dependency-depth bands keep the static chunk graph acyclic.
    const depth = maplibreDependencyDepth(id, getModuleInfo)
    if (depth <= 4) return 'maplibre-foundation'
    if (depth <= 7) return 'maplibre-runtime'
    return 'maplibre-map'
  }

  if (maplibreVendorPaths.some((path) => moduleId.includes(path))) return 'maplibre-vendor'
}

export default defineConfig(({ command }) => ({
  // relative asset paths so the build works at any URL
  // (GitHub Pages subpath, workers.dev, local file preview)
  base: './',
  resolve: command === 'build' ? {
    alias: [
      {
        find: /^maplibre-gl$/,
        replacement: fileURLToPath(new URL('./src/maplibre-build.js', import.meta.url)),
      },
    ],
  } : undefined,
  build: {
    rollupOptions: {
      output: {
        manualChunks,
      },
    },
  },
}))
