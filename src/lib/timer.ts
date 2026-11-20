export function remainingSeconds(endTime: number, now = Date.now()): number {
  return Math.max(0, Math.floor((endTime - now) / 1000));
}
