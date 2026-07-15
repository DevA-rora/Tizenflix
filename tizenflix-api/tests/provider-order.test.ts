import { describe, expect, it } from "vitest";
import {
  EN_PROVIDER_ORDER,
  orderProviders,
  providerOrderForLang,
  firstAutoProviderId,
  MAX_AUTO_PROVIDER_ATTEMPTS,
} from "../src/streamflix/provider-order.js";
import type { ContentProvider } from "../src/streamflix/providers/types.js";

function stubProvider(id: string, language: string): ContentProvider {
  return {
    id,
    name: id,
    language,
    supportsMovies: true,
    supportsTv: true,
    enabled: true,
    implementationStatus: "full",
    findByTmdb: async () => null,
    getServers: async () => [],
    getVideo: async () => ({ source: "", subtitles: [] }),
  };
}

describe("provider-order", () => {
  it("defaults anime auto provider to hianime", () => {
    expect(firstAutoProviderId(true)).toBe("hianime");
  });

  it("returns EN priority order for English catalog", () => {
    expect(providerOrderForLang("en", false)).toEqual(EN_PROVIDER_ORDER);
  });

  it("returns anime order when content is anime", () => {
    expect(providerOrderForLang("en", true)[0]).toBe("hianime");
  });

  it("orders enabled providers with preferred id first", () => {
    const providers = [
      stubProvider("anymovie", "en"),
      stubProvider("sflix", "en"),
      stubProvider("ridomovies", "en"),
    ];
    const ordered = orderProviders(providers, "en", false, "ridomovies");
    expect(ordered.map((p) => p.id)).toEqual(["ridomovies", "sflix", "anymovie"]);
  });

  it("caps auto attempts at MAX_AUTO_PROVIDER_ATTEMPTS", () => {
    expect(MAX_AUTO_PROVIDER_ATTEMPTS).toBe(5);
  });
});
