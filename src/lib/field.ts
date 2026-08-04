/**
 * The field, offered to the rest of the page.
 *
 * The mark is this site's atom, and it was only ever drawable inside the hero's closure —
 * which is why every other block on the page was a text list. This is the seam: the hero
 * publishes the painter and the pack it solved, and anything else that wants to show a name
 * shows the same object, drawn by the same hand, at a size true to the same scale.
 */
export interface FieldMark { n: string; slug: string; py: number; r: number; ps: number; }
export interface FieldApi {
  mark(slug: string): FieldMark | undefined;
  paint(ctx: CanvasRenderingContext2D, m: FieldMark, x: number, y: number, r: number): void;
}

let api: FieldApi | null = null;
const waiting: ((a: FieldApi) => void)[] = [];

export function publishField(a: FieldApi) {
  api = a;
  for (const f of waiting.splice(0)) f(a);
}

/** resolves as soon as the hero has mounted; never resolves if the hero is not on the page */
export function onField(f: (a: FieldApi) => void) {
  if (api) f(api);
  else waiting.push(f);
}
