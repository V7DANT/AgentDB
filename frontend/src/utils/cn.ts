/** Tiny class-name joiner. Keeps JSX readable without an extra dependency. */
export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}
