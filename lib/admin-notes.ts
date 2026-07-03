export function appendAdminNote(existing: string | null | undefined, note: string): string {
  const prefix = existing?.trim() ? `${existing.trim()}\n` : ''
  return `${prefix}${note}`.slice(-4000)
}
