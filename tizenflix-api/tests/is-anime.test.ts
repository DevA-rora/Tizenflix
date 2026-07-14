import { describe, expect, it } from "vitest";
import { isAnime, TMDB_ANIMATION_GENRE_ID } from "../src/tmdb/is-anime.js";

describe("isAnime", () => {
  it("detects Japanese animation TV", () => {
    expect(
      isAnime({
        genreIds: [TMDB_ANIMATION_GENRE_ID, 10759],
        originalLanguage: "ja",
        title: "Re:ZERO -Starting Life in Another World-",
      })
    ).toBe(true);
  });

  it("detects animation with anime title hint when language unknown", () => {
    expect(
      isAnime({
        genres: ["Animation", "Sci-Fi & Fantasy"],
        title: "Attack on Titan",
      })
    ).toBe(true);
  });

  it("rejects western animation without ja or title hint", () => {
    expect(
      isAnime({
        genreIds: [TMDB_ANIMATION_GENRE_ID],
        originalLanguage: "en",
        title: "The Simpsons",
      })
    ).toBe(false);
  });

  it("detects Japanese animation with English-localized title", () => {
    expect(
      isAnime({
        genreIds: [TMDB_ANIMATION_GENRE_ID],
        originalLanguage: "ja",
        title: "You and I Are Polar Opposites",
      })
    ).toBe(true);
  });

  it("rejects non-animation", () => {
    expect(
      isAnime({
        genreIds: [18],
        originalLanguage: "ja",
        title: "Some Drama",
      })
    ).toBe(false);
  });
});
