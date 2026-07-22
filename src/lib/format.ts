export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
/** First two slug chars, padded, for detail sharding. Non-letters -> '_'. */
export function shardKey(slug: string): string {
  const a = slug[0] ?? '_';
  const b = slug[1] ?? '_';
  return (/[a-z0-9]/.test(a) ? a : '_') + (/[a-z0-9]/.test(b) ? b : '_');
}
