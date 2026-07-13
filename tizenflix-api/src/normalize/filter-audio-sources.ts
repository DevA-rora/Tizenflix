import { audioLanguageDisplay } from "./audio-metadata.js";
import type { PlayableSource } from "../types.js";

export interface AudioFilterResult {
  sources: PlayableSource[];
  matched: boolean;
  warning?: string;
}

function scoreSource(
  source: PlayableSource,
  targetLang: string,
  preferOriginal: boolean
): number {
  const lang = source.audioLanguage?.toLowerCase();
  const variant = source.audioVariant ?? "unknown";

  if (variant === "unknown") return 10;

  if (preferOriginal) {
    if (variant === "original" && lang === targetLang) return 100;
    if (variant === "original") return 80;
    if (lang === targetLang && variant !== "dubbed") return 70;
    if (lang === targetLang) return 50;
    if (variant === "dubbed") return 5;
    return 20;
  }

  if (lang === targetLang) return 100;
  if (variant === "dubbed" && lang === targetLang) return 95;
  if (variant === "original" && lang === targetLang) return 90;
  if (lang && lang !== targetLang) return 5;
  return 10;
}

export function filterSourcesByAudioLang(
  sources: PlayableSource[],
  targetLang: string,
  options: { preferOriginal?: boolean; audioLangParam?: string } = {}
): AudioFilterResult {
  if (!sources.length) return { sources, matched: false };

  const preferOriginal = options.preferOriginal ?? options.audioLangParam === "original";
  const target = targetLang.toLowerCase().split("-")[0]!;

  const ranked = sources
    .map((source, index) => ({
      source,
      index,
      score: scoreSource(source, target, preferOriginal),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const bestScore = ranked[0]?.score ?? 0;
  const matched = bestScore >= 50;
  const reordered = ranked.map((r) => r.source);

  if (matched) {
    return { sources: reordered, matched: true };
  }

  const label = audioLanguageDisplay(target);
  return {
    sources: reordered,
    matched: false,
    warning: `No stream matched your audio preference (${label}). Playing best available source.`,
  };
}
