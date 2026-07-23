// Name-level archetype: a single label for a name's whole life-shape.
// The classification RULE (needs full per-year shares, build-only) lives in
// pipeline/src/archetype.ts; the payload ships only the resolved key. This map is
// the shared display source for the page, the client render, and the OG card.

export type ArchetypeKey = 'meteor' | 'ghost' | 'comeback' | 'riser' | 'faller' | 'evergreen';

export const ARCHETYPES: Record<ArchetypeKey, { label: string; blurb: string }> = {
  meteor:    { label: 'The Meteor',    blurb: 'Flared and vanished — half its whole life in seven years.' },
  ghost:     { label: 'The Ghost',     blurb: 'A giant of its day, all but gone now.' },
  comeback:  { label: 'The Comeback',  blurb: 'Crested, fell away, and is climbing again.' },
  riser:     { label: 'The Riser',     blurb: 'Near its all-time high right now.' },
  faller:    { label: 'The Faller',    blurb: 'Past its peak and fading.' },
  evergreen: { label: 'The Evergreen', blurb: 'A steady American classic.' },
};

export function archetypeOf(key: string) {
  return ARCHETYPES[key as ArchetypeKey] ?? ARCHETYPES.evergreen;
}
