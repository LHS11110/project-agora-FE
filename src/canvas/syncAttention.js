/** Hide routine success noise while retaining unsaved or failed synchronization. */
export function canvasNeedsAttention(status, receipt) {
  return !status.ready || Boolean(status.blocked) || status.queued > 0 || receipt?.status === 'rejected';
}
