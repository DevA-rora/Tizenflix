import { getOriginalLanguage } from "../tmdb/client.js";
import { simplifyLang } from "../streamflix/tmdb-native/lang-sources.js";

export interface ResolvedAudioPreference {
  mode: "original" | "specific";
  targetLanguage: string;
  audioLangParam: string;
}

export async function resolveTargetAudioLang(
  opts: {
    type: "movie" | "tv";
    tmdbId: string;
    audioLang?: string;
  },
  apiKey: string
): Promise<ResolvedAudioPreference> {
  const param = opts.audioLang?.trim().toLowerCase() || "original";
  if (param !== "original") {
    return {
      mode: "specific",
      targetLanguage: simplifyLang(param),
      audioLangParam: simplifyLang(param),
    };
  }

  const original = await getOriginalLanguage(apiKey, opts.type, opts.tmdbId);
  return {
    mode: "original",
    targetLanguage: simplifyLang(original ?? "en"),
    audioLangParam: "original",
  };
}
