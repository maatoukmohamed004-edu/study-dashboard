/** Tiny markdown used in plan.ts: [label](url), **bold**, *italic*. */
export const TOKEN = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*/g

/** Plain text without markup. */
export function plain(text: string): string {
  return text.replace(TOKEN, (_m, a?: string, _h?: string, b?: string, c?: string) => a ?? b ?? c ?? '')
}
