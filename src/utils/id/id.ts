let counter = 0;

/** Returns a document-unique id, e.g. `tg-3-k2j9xq`. Used for ARIA relationships. */
export function uid(prefix = 'tg'): string {
  counter += 1;
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${counter.toString(36)}-${random}`;
}
