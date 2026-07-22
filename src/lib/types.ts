export type Sex = 'M' | 'F';
export const START_YEAR = 1880;
export const END_YEAR = 2024;

export interface RawRecord { name: string; sex: Sex; year: number; count: number; }

/** Per-name accumulation across all years, both sexes. */
export interface NameAgg {
  name: string;
  bySexYear: { M: Map<number, number>; F: Map<number, number> };
  totalBySex: { M: number; F: number };
}

export interface TwinData { name: string; slug: string; spark: number[]; } // spark: ~40 ints 0..1000

export interface NamePayload {
  name: string;
  slug: string;
  dominantSex: Sex;
  startYear: number;      // START_YEAR
  curve: number[];        // per-year share normalized to own max, ints 0..1000, length END-START+1
  peakYear: number;
  peakRank: number;       // best (min) yearly rank within dominant sex
  skewPct: number;        // % of all-time births given to dominantSex, one decimal
  totalBirths: number;    // all-time M+F count
  medianBirthYear: number;
  medianAgeToday: number;
  caption: string;        // one-line era caption
  twins: TwinData[];      // up to 5
}

export interface ExploreItem { name: string; slug: string; spark: number[]; blurb: string; }
export interface ExploreData {
  ghosts: ExploreItem[];
  comebacks: ExploreItem[];
  unisex: ExploreItem[];
  nameOfYear: Record<number, { M: string[]; F: string[] }>; // year -> top 3 names per sex
}
