const ICONS = {
  planning: '<path d="M4 6.5 9 4l6 2.5L20 4v13.5L15 20l-6-2.5L4 20Z"/><path d="M9 4v13.5M15 6.5V20"/>',
  library: '<path d="M3.5 6.5h6l2 2H20.5v10H3.5Z"/><path d="M3.5 9h17"/>',
  weather: '<path d="M7 17.5h10.5a3 3 0 0 0 .4-6A5 5 0 0 0 8.5 10a3.8 3.8 0 0 0-1.5 7.5Z"/><path d="m8 20-1 2m5-2-1 2m5-2-1 2"/>',
  share: '<path d="M8 16 17.5 6.5M11 6.5h6.5V13"/><path d="M18.5 16.5v3h-14v-14h3"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.4 2.4 0 1 1 3.1 2.3c-.8.3-.9.8-.9 1.7"/><path d="M12 17h.01"/>',
  contour: '<path d="M3 8c3-3 5 3 9 0s6 3 9 0M3 12c3-3 5 3 9 0s6 3 9 0M3 16c3-3 5 3 9 0s6 3 9 0"/>',
  grid: '<path d="M12 3v18M3 12h18"/><circle cx="12" cy="12" r="4"/>',
  labels: '<path d="m4 18 6-11 3.2 5L16 8l4 10Z"/><path d="m8.4 10 1.6 1.5L11.3 9"/>',
  roads: '<path d="M5 21c5-5 2-9 7-13 2-1.7 4-2.6 7-5"/><path d="M10 21c5-5 2-8 7-12 1.2-1 2.2-1.7 3-2"/><path d="m8.5 17 3 1m.2-5 3 1m.5-5 2.7 1"/>',
  admin: '<path d="m4 9 8-5 8 5M5 10h14M6 10v8m4-8v8m4-8v8m4-8v8M4 20h16"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4m0-14.2-1.4 1.4M6.3 17.7l-1.4 1.4"/>',
  hud: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5Z"/><path d="m4 12 8 4.5 8-4.5M4 16l8 4.5 8-4.5"/>',
  zoomIn: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4M11 8v6M8 11h6"/>',
  zoomOut: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4M8 11h6"/>',
  fit: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/><path d="m8 12 4-3 4 3-4 3Z"/>',
  pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.2"/>',
}

export function iconSvg(name, className = '') {
  const paths = ICONS[name] ?? ICONS.help
  return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`
}
