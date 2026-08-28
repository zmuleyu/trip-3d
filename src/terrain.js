import * as THREE from 'three'
import { Simplex2, mulberry32, fbm, lerp } from './noise.js'
import { sampleDem } from './dem.js'

export const TERRAIN_SIZE = 56
// Real DEM terrain with vertex normals so PBR lighting and output capture read
// the same relief as the map-centered workspace.
export class Terrain {
  constructor(params) {
    this.material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(params.color),
      roughness: 1, // actual roughness baked into the roughness map
      metalness: 0,
      vertexColors: true,
      envMapIntensity: params.envMapIntensity,
    })

    // topographic map overlay: hypsometric tint, contour lines and survey grid,
    // computed per-fragment in world space so they drape over the relief
    this.mapUniforms = {
      uTint: { value: params.mapTint },
      uContourInterval: { value: params.contourInterval },
      uContourOpacity: { value: params.contourOpacity },
      uGridStep: { value: params.gridStep },
      uGridOpacity: { value: params.gridOpacity },
      uHeightRange: { value: new THREE.Vector2(-0.5, 2) },
      uRampTex: { value: null },
      uHeightContrast: { value: params.heightContrast },
      uHeightPivot: { value: params.heightPivot },
      uSlopeTint: { value: params.slopeTint },
      uContourColor: { value: new THREE.Color(params.contourColor) },
      uOverlayTex: { value: null }, // OSM street tiles draped over the relief
      uOverlayMix: { value: 0 },
    }
    this.rebuildRamp(params)
    this.material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.mapUniforms)
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
varying vec3 vWorldPos;
`
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
        )
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
varying vec3 vWorldPos;
uniform float uTint;
uniform float uContourInterval;
uniform float uContourOpacity;
uniform float uGridStep;
uniform float uGridOpacity;
uniform vec2 uHeightRange;
uniform sampler2D uRampTex;
uniform float uHeightContrast;
uniform float uHeightPivot;
uniform float uSlopeTint;
uniform vec3 uContourColor;
uniform sampler2D uOverlayTex;
uniform float uOverlayMix;`
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
{
  // --- hypsometric tint: user gradient sampled by height, contrast expanded around a pivot
  float hNorm = clamp((vWorldPos.y - uHeightRange.x) / max(uHeightRange.y - uHeightRange.x, 1e-4), 0.0, 1.0);
  float rampT = clamp(0.5 + (hNorm - uHeightPivot) * uHeightContrast, 0.0, 1.0);
  vec3 ramp = texture2D(uRampTex, vec2(rampT, 0.5)).rgb;
  // smooth interpolated normal (world space) — screen-space derivatives look blotchy
  vec3 wN = inverseTransformDirection(normalize(vNormal), viewMatrix);
  float slope = 1.0 - clamp(wN.y, 0.0, 1.0);
  ramp = mix(ramp, vec3(0.42, 0.31, 0.21), smoothstep(0.3, 0.8, slope) * uSlopeTint);
  // keep the lighting/AO shading from the base surface but let the gradient own the color
  float luma = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
  diffuseColor.rgb = mix(diffuseColor.rgb, ramp * clamp(luma * 2.4, 0.2, 1.4), uTint);

  // --- road/street map overlay (OSM tiles) draped under contours/grid
  if (uOverlayMix > 0.001) {
    vec2 ovUv = vec2(vWorldPos.x / 56.0 + 0.5, 0.5 - vWorldPos.z / 56.0); // TERRAIN_SIZE; north = v 1 (canvas row 0, flipY)
    vec4 ov = texture2D(uOverlayTex, ovUv);
    diffuseColor.rgb = mix(diffuseColor.rgb, ov.rgb, uOverlayMix * ov.a);
  }

  // --- contour lines: minor every interval, heavy line every 5th
  float ch = vWorldPos.y / uContourInterval;
  float dch = fwidth(ch);
  float distMinor = abs(fract(ch + 0.5) - 0.5);
  float minorLine = 1.0 - smoothstep(0.0, dch * 1.4, distMinor);
  float ch5 = ch / 5.0;
  float dch5 = fwidth(ch5);
  float distMajor = abs(fract(ch5 + 0.5) - 0.5);
  float majorLine = 1.0 - smoothstep(0.0, dch5 * 1.4, distMajor);
  // fade contours out only when they crowd below pixel size (far away / near-vertical)
  float crowd = clamp(1.0 - dch * 0.22, 0.0, 1.0);
  float contour = max(minorLine * 0.55, majorLine) * uContourOpacity * crowd;
  diffuseColor.rgb = mix(diffuseColor.rgb, uContourColor, contour);

  // --- survey grid in world x/z
  vec2 g = vWorldPos.xz / uGridStep;
  vec2 dg = fwidth(g);
  vec2 distGrid = abs(fract(g + 0.5) - 0.5);
  float gx = 1.0 - smoothstep(0.0, dg.x * 1.4, distGrid.x);
  float gz = 1.0 - smoothstep(0.0, dg.y * 1.4, distGrid.y);
  float grid = max(gx, gz) * uGridOpacity;
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.14, 0.13, 0.12), grid);

}`
        )
    }
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.material)
    this.mesh.receiveShadow = true
    this.mesh.castShadow = true
    this.dem = null // real-world heightfield, set via setDem()
    this._h2ft = null
    this.sample = () => 0
  }

  setDem(dem) {
    this.dem = dem
  }

  // scene height → display elevation in feet (real when a DEM drives the terrain)
  heightToFeet(h) {
    return this._h2ft ? this._h2ft(h) : Math.round(4800 + h * 420)
  }

  // Sampler over a fetched real-world DEM: world xz → bilinear meters → scene units.
  _makeDemSampler(params) {
    const dem = this.dem
    const scale = (TERRAIN_SIZE / dem.extentMeters) * params.demExaggeration
    const meanM = dem.meanM
    this._h2ft = (h) => Math.round((h / scale + meanM) * 3.28084)

    const { size } = dem

    return (x, z) => {
      const px = (x / TERRAIN_SIZE + 0.5) * (size - 1)
      const py = (z / TERRAIN_SIZE + 0.5) * (size - 1)
      return (sampleDem(dem, px, py) - meanM) * scale
    }
  }

  // Before the real DEM arrives, keep the retained output surface neutral.
  // Provider failure remains explicit in the workspace instead of inventing terrain.
  _makeSampler(params) {
    if (this.dem) return this._makeDemSampler(params)
    this._h2ft = null
    return () => 0
  }

  rebuild(params) {
    const res = params.resolution
    const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, res, res)
    geo.rotateX(-Math.PI / 2)

    const sample = this._makeSampler(params)
    this.sample = sample

    const pos = geo.attributes.position
    const count = pos.count
    const arr = pos.array
    let minH = Infinity
    let maxH = -Infinity
    for (let i = 0; i < count; i++) {
      const x = arr[i * 3]
      const z = arr[i * 3 + 2]
      const h = sample(x, z)
      arr[i * 3 + 1] = h
      if (h < minH) minH = h
      if (h > maxH) maxH = h
    }
    geo.computeVertexNormals()

    // vertex tint: height-graded value + slope darkening + grain jitter
    const colorRng = mulberry32(params.seed + 101)
    const sTint = new Simplex2(colorRng)
    const normals = geo.attributes.normal.array
    const colors = new Float32Array(count * 3)
    const span = Math.max(1e-5, maxH - minH)
    for (let i = 0; i < count; i++) {
      const x = arr[i * 3]
      const h = arr[i * 3 + 1]
      const z = arr[i * 3 + 2]
      const ny = normals[i * 3 + 1]
      const hn = (h - minH) / span
      let v = lerp(0.62, 0.95, Math.pow(hn, 0.85))
      v *= lerp(0.78, 1.0, Math.pow(Math.max(0, ny), 0.6))
      v += fbm(sTint, x * 1.7, z * 1.7, 2, 2.2, 0.5) * 0.05
      colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = v
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    this.mapUniforms.uHeightRange.value.set(minH, maxH)
    this.mesh.geometry.dispose()
    this.mesh.geometry = geo
  }

  // Bake the 4-stop elevation gradient into a 1D ramp texture the shader samples.
  rebuildRamp(params) {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 1
    const ctx = c.getContext('2d')
    const grad = ctx.createLinearGradient(0, 0, 256, 0)
    grad.addColorStop(0, params.gradLow)
    grad.addColorStop(THREE.MathUtils.clamp(params.gradMid1Pos, 0.01, 0.98), params.gradMid1)
    grad.addColorStop(THREE.MathUtils.clamp(params.gradMid2Pos, 0.02, 0.99), params.gradMid2)
    grad.addColorStop(1, params.gradHigh)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 256, 1)
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
    tex.needsUpdate = true
    this.mapUniforms.uRampTex.value?.dispose()
    this.mapUniforms.uRampTex.value = tex
  }

  // OSM street-tile overlay texture (canvas → sampler); mix via uOverlayMix
  setOverlayTexture(tex) {
    this.mapUniforms.uOverlayTex.value?.dispose()
    this.mapUniforms.uOverlayTex.value = tex
  }

  setOverlayMix(v) {
    this.mapUniforms.uOverlayMix.value = v
  }

  // Noise-driven roughness map (green channel is what three.js reads) + bump map
  // reused for micro relief that's finer than the vertex grid.
  ensureRoughness(params) {
    if (this.material.roughnessMap) return false
    this.rebuildRoughness(params)
    return true
  }

  rebuildRoughness(params) {
    const size = 512
    const rng = mulberry32(params.seed + 777)
    const s = new Simplex2(rng)
    const data = new Uint8Array(size * size * 4)
    const sc = params.roughnessScale
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size
        const v = y / size
        const n = fbm(s, u * sc, v * sc, 4, 2.2, 0.55)
        const n2 = fbm(s, u * sc * 7 + 13, v * sc * 7 - 5, 2, 2.2, 0.5)
        const rough = THREE.MathUtils.clamp(params.roughness + params.roughnessVariation * n, 0.04, 1)
        const bump = 0.5 + 0.5 * (n * 0.6 + n2 * 0.4)
        const i = (y * size + x) * 4
        data[i] = Math.round(bump * 255) // bump reads red-ish luminance
        data[i + 1] = Math.round(rough * 255) // roughness reads green
        data[i + 2] = Math.round(bump * 255)
        data[i + 3] = 255
      }
    }
    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.needsUpdate = true

    const bumpTex = tex.clone()
    bumpTex.repeat.set(4, 4)
    bumpTex.needsUpdate = true

    if (this.material.roughnessMap) this.material.roughnessMap.dispose()
    if (this.material.bumpMap && this.material.bumpMap !== this.material.roughnessMap) {
      this.material.bumpMap.dispose()
    }
    this.material.roughnessMap = tex
    this.material.bumpMap = bumpTex
    this.material.bumpScale = params.bumpScale
    this.material.needsUpdate = true
  }

}
