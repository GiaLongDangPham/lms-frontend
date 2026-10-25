export function noticeFrom(state: unknown): string | null {
  if (typeof state === 'object' && state !== null && 'notice' in state && typeof state.notice === 'string') {
    return state.notice;
  }
  return null;
}
