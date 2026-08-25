export function runRouteMutationInPlan({ enterPlanForEditing, isPlanEditing, mutate }) {
  enterPlanForEditing()
  if (!isPlanEditing()) return false
  mutate()
  return true
}
