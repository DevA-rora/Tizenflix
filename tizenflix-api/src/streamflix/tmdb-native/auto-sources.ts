/** TMDB-native sources included in `backend=auto` (priority order). */
export const AUTO_TMDB_SOURCE_IDS = [
  "vixsrc",
  "twoembed",
  "vidsrcnet",
  "vidzee",
  "vidsrcto",
  "vidrock",
] as const;

export type AutoTmdbSourceId = (typeof AUTO_TMDB_SOURCE_IDS)[number];

/** Minimum HLS hit rate (0–1) on benchmark canary set to stay in auto list. */
export const AUTO_SOURCE_MIN_HIT_RATE = 0.8;
