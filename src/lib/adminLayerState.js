export function adminLoadTerminal({ hasTerrain = true, requestCurrent = true, keyCurrent = true } = {}) {
  if (!requestCurrent) return { state: 'ignored', message: '' }
  if (!hasTerrain) return { state: 'error', message: '地形尚未就绪，请稍后重试' }
  if (!keyCurrent) return { state: 'error', message: '地形已切换，请重试' }
  return { state: 'ready', message: '' }
}
