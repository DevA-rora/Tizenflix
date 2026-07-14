import { describe, expect, it } from "vitest";

/** Mirrors tizenflix-app/app/js/core/config.js qualityHeightScore + pickBestResolveResult. */
function qualityHeightScore(height: number, target: string): number {
  if (target === "auto") return height || 0;
  const targetPx = parseInt(target, 10);
  if (!height) return -1;
  if (height === targetPx) return 10000 + height;
  if (height < targetPx) return 5000 + height;
  return height;
}

interface ResolveCandidate {
  via: string;
  height: number;
  count: number;
  tierIndex: number;
}

function pickBestResolveResult(results: ResolveCandidate[], target: string): ResolveCandidate | null {
  let best: ResolveCandidate | null = null;
  for (const r of results) {
    if (!best) {
      best = r;
      continue;
    }
    if (target !== "auto") {
      const scoreA = qualityHeightScore(r.height, target);
      const scoreB = qualityHeightScore(best.height, target);
      if (scoreA !== scoreB) {
        if (scoreA > scoreB) best = r;
        continue;
      }
      if (r.height > best.height) {
        best = r;
        continue;
      }
    }
    if (r.count > best.count || (r.count === best.count && r.tierIndex < best.tierIndex)) {
      best = r;
    }
  }
  return best;
}

describe("playback quality-aware resolve picker", () => {
  it("prefers 1080p result over faster 720p when target is 1080", () => {
    const best = pickBestResolveResult(
      [
        { via: "Auto (fast)", height: 720, count: 1, tierIndex: 0 },
        { via: "TMDB-native backups", height: 1080, count: 2, tierIndex: 1 },
      ],
      "1080"
    );
    expect(best?.via).toBe("TMDB-native backups");
  });

  it("prefers lower tier index when counts are equal and target is auto", () => {
    const best = pickBestResolveResult(
      [
        { via: "Auto (fast)", height: 720, count: 2, tierIndex: 0 },
        { via: "TMDB-native backups", height: 1080, count: 2, tierIndex: 1 },
      ],
      "auto"
    );
    expect(best?.via).toBe("Auto (fast)");
  });
});
