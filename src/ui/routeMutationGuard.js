export function runRouteMutationInPlan({ enterPlan, isPlan, mutate }) {
  enterPlan()
  if (!isPlan()) return false
  mutate()
  return true
}
