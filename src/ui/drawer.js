export function setDrawerOpen(drawer, open, returnFocus) {
  if (!drawer) return
  drawer.classList.toggle('open', !!open)
  drawer.inert = !open
  drawer.setAttribute('aria-hidden', String(!open))
  if (open) {
    drawer.querySelector('button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex="0"]')?.focus()
  } else if (returnFocus?.isConnected) {
    returnFocus.focus()
  }
}
