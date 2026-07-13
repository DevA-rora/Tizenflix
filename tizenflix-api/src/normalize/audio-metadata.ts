import type { PlayableSource } from "../types.js";
import type { ExtractedVideo } from "../streamflix/types.js";

export type AudioVariant = "original" | "dubbed" | "unknown";

const LANG_NAMES: Record<string, string> = {
  en: "English",
  de: "German",
  fr: "French",
  it: "Italian",
  es: "Spanish",
  ja: "Japanese",
  ko: "Korean",
  zh: "Chinese",
  hi: "Hindi",
  ta: "Tamil",
  te: "Telugu",
  bn: "Bengali",
};

export function audioLanguageDisplay(code: string): string {
  const key = code.toLowerCase().split("-")[0]!;
  return LANG_NAMES[key] ?? key.toUpperCase();
}

function simplifyLang(lang?: string): string {
  if (!lang) return "";
  return lang.toLowerCase().split("-")[0]!;
}

export function inferAudioFromLabel(
  label: string,
  sourceId?: string
): { audioLanguage?: string; audioVariant?: AudioVariant } {
  const text = `${label} ${sourceId ?? ""}`.toLowerCase();

  if (/\bvo\b|voice.?original|original audio|eng\.original/i.test(text)) {
    const lang = /\bja\b|japanese/i.test(text)
      ? "ja"
      : /\ben\b|english/i.test(text)
        ? "en"
        : /\bfr\b|french/i.test(text)
          ? "fr"
          : undefined;
    return { audioLanguage: lang, audioVariant: "original" };
  }

  if (/vostfr/i.test(text)) {
    return { audioLanguage: "fr", audioVariant: "original" };
  }

  if (/\bfrench\b|\bvf\b|version française/i.test(text)) {
    return { audioLanguage: "fr", audioVariant: "dubbed" };
  }

  if (/\bgerman\b|\bde\b.*dub|\bvf\b.*de/i.test(text)) {
    return { audioLanguage: "de", audioVariant: "dubbed" };
  }

  if (/\benglish\b|\beng\b/i.test(text) && !/sub/i.test(text)) {
    return { audioLanguage: "en", audioVariant: "dubbed" };
  }

  if (/\bjapanese\b|\bja\b/i.test(text)) {
    return { audioLanguage: "ja", audioVariant: "original" };
  }

  if (/\bhindi\b/i.test(text)) return { audioLanguage: "hi", audioVariant: "dubbed" };
  if (/\btamil\b/i.test(text)) return { audioLanguage: "ta", audioVariant: "dubbed" };
  if (/\bbengali\b/i.test(text)) return { audioLanguage: "bn", audioVariant: "dubbed" };

  if (sourceId === "frembed") {
    if (/\(vo\)/i.test(label)) return { audioLanguage: undefined, audioVariant: "original" };
    if (/\(vostfr\)/i.test(label)) return { audioLanguage: "fr", audioVariant: "original" };
    if (/\(french\)/i.test(label)) return { audioLanguage: "fr", audioVariant: "dubbed" };
  }

  return { audioVariant: "unknown" };
}

export function tagPlayableSource(
  source: PlayableSource,
  video?: Pick<ExtractedVideo, "audioLanguage" | "audioVariant">
): PlayableSource {
  const fromVideo =
    video?.audioLanguage || video?.audioVariant
      ? {
          audioLanguage: video.audioLanguage ? simplifyLang(video.audioLanguage) : undefined,
          audioVariant: video.audioVariant,
        }
      : null;
  const fromLabel = inferAudioFromLabel(source.label, source.sourceId);
  return {
    ...source,
    audioLanguage: fromVideo?.audioLanguage ?? fromLabel.audioLanguage,
    audioVariant: fromVideo?.audioVariant ?? fromLabel.audioVariant ?? "unknown",
  };
}

export function formatAudioHint(source: PlayableSource): string | null {
  if (!source.audioLanguage && source.audioVariant === "unknown") return null;
  const lang = source.audioLanguage ? source.audioLanguage.toUpperCase() : "";
  if (source.audioVariant === "original") return lang ? lang + " original" : "Original";
  if (source.audioVariant === "dubbed") return lang ? lang + " dub" : "Dubbed";
  if (lang) return lang;
  return null;
}
