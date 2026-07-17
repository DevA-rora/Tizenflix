import type { Express, Request, Response, NextFunction } from "express";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AppConfig } from "../config.js";
import { requireTmdbKey } from "../config.js";
import {
  getCachedPlay,
  invalidatePlayCacheForTmdb,
  invalidatePlayCacheKey,
  isCachedPlayValidated,
  markCachedPlayValidated,
  playResolveCacheKey,
  setCachedPlay,
} from "../cache/play-resolve-cache.js";
import { getInlineManifest, isInlineManifestSource } from "../cache/inline-manifest-cache.js";
import { DownloadService, pickSource } from "../download/jobs.js";
import { buildProxyUrl, parseProxyHeaderQuery } from "../proxy/proxy-url.js";
import { proxyHeadersFromSource } from "../proxy/proxy-header-options.js";
import type { ProxyHeaderParams } from "../proxy/proxy-header-options.js";
import { fetchProxiedStream, looksLikeBinarySegment, pipeProxiedStream } from "../proxy/upstream.js";
import { rewriteM3u8 } from "../proxy/rewrite-m3u8.js";
import { validatePlaySources } from "../proxy/validate-sources.js";
import { resolvePlayableSources, listProviders } from "../normalize/to-play-response.js";
import { parseBackendParam, parseLangParam, parseAudioLangParam, parseSourcesParam, parseProviderIdParam, parsePreferredProviderIdParam, parseRaceParam, resolveWithBackend } from "../normalize/resolve-backend.js";
import { filterSourcesByAudioLang } from "../normalize/filter-audio-sources.js";
import { resolveTargetAudioLang } from "../normalize/resolve-audio-lang.js";
import { runWithExtractOptions } from "../streamflix/extract-context.js";
import { fetchMetadata } from "../api/metadata.js";
import { enrichWithOpenSubtitles } from "../subtitles/opensubtitles.js";
import type { Metadata, PlayResponse } from "../types.js";
import { ProgressService } from "../store/progress.js";
import { ProviderHealthService } from "../store/provider-health.js";
import {
  getAllProviders,
  getProviderConfig,
  setProviderConfig,
  setProviderEnabled,
} from "../streamflix/providers/registry.js";
import {
  getAllIptvProviders,
  getIptvProviderConfig,
  setIptvProviderEnabled,
  setIptvProviderConfig,
} from "../streamflix/iptv/registry.js";
import { listIptvChannels, listIptvProviders, resolveIptvPlayResponse } from "../streamflix/iptv/resolve.js";
import { TMDB_NATIVE_SOURCES } from "../streamflix/tmdb-native/registry.js";
import * as tmdb from "../tmdb/client.js";

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../fixtures");

export interface RouteContext {
  config: AppConfig;
  progress: ProgressService;
  downloads: DownloadService;
  providerHealth: ProviderHealthService;
}

function proxyWrap(
  publicBase: string,
  url: string,
  headers?: ProxyHeaderParams,
  audioLang?: string,
  maxHeight?: number,
  tizenProfile = false
): string {
  if (isInlineManifestSource(url)) {
    const token = url.slice("tizenflix-inline-manifest:".length);
    let inlineUrl = `${publicBase.replace(/\/$/, "")}/proxy/inline-manifest/${token}`;
    const params = new URLSearchParams();
    if (audioLang) params.set("audioLang", audioLang);
    if (maxHeight && maxHeight > 0) params.set("maxHeight", String(maxHeight));
    if (tizenProfile) params.set("profile", "tizen");
    const qs = params.toString();
    if (qs) inlineUrl += `?${qs}`;
    return inlineUrl;
  }
  return buildProxyUrl(publicBase, url, headers, audioLang, maxHeight);
}

function withProxiedUrls(
  publicBase: string,
  play: Awaited<ReturnType<typeof resolvePlayableSources>>,
  preferredAudioLang?: string,
  maxHeight?: number,
  tizenProfile = false
) {
  const audioLang =
    preferredAudioLang ?? play.audioPreference?.targetLanguage ?? undefined;
  return {
    ...play,
    sources: play.sources.map((s) => ({
      ...s,
      url: proxyWrap(publicBase, s.url, proxyHeadersFromSource(s), audioLang, maxHeight, tizenProfile),
    })),
    subtitles: play.subtitles.map((sub) => ({
      ...sub,
      url: sub.url ? proxyWrap(publicBase, sub.url, undefined, audioLang, maxHeight, tizenProfile) : sub.url,
    })),
  };
}

function applyAudioPreference(
  play: Awaited<ReturnType<typeof resolvePlayableSources>>,
  audioPref: Awaited<ReturnType<typeof resolveTargetAudioLang>>
): Awaited<ReturnType<typeof resolvePlayableSources>> {
  const filtered = filterSourcesByAudioLang(play.sources, audioPref.targetLanguage, {
    preferOriginal: audioPref.mode === "original",
    audioLangParam: audioPref.audioLangParam,
  });
  const warnings = [...(play.warnings ?? [])];
  if (filtered.warning) warnings.push(filtered.warning);
  return {
    ...play,
    sources: filtered.sources,
    recommended: filtered.sources[0]?.id ?? play.recommended,
    warnings: warnings.length ? warnings : undefined,
    audioPreference: {
      mode: audioPref.mode,
      targetLanguage: audioPref.targetLanguage,
    },
  };
}

function tmdbRequired(res: Response, config: AppConfig): string | null {
  try {
    return requireTmdbKey(config);
  } catch (err) {
    res.status(503).json({
      error: err instanceof Error ? err.message : "TMDB not configured",
    });
    return null;
  }
}

/** Minimal JSON body parser for POST routes */
function expressJson(req: Request, res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === "object") {
    next();
    return;
  }
  let data = "";
  req.on("data", (chunk) => {
    data += chunk;
  });
  req.on("end", () => {
    try {
      req.body = data ? JSON.parse(data) : {};
    } catch {
      res.status(400).json({ error: "Invalid JSON body" });
      return;
    }
    next();
  });
}

export function registerRoutes(app: Express, ctx: RouteContext): void {
  const { config, progress, downloads, providerHealth } = ctx;
  const { publicBase } = config;

  // TV app (e.g. :3010) calls API (:8790) from the browser — CORS required on all routes.
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Range");
    res.setHeader(
      "Access-Control-Expose-Headers",
      "Content-Length, Content-Range, Accept-Ranges"
    );
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  });

  app.get("/", (_req, res) => {
    res.json({
      service: "tizenflix-api",
      publicBase,
      endpoints: {
        health: "/health",
        search: "/search?q=",
        titleMovie: "/title/movie/:tmdbId",
        titleTv: "/title/tv/:tmdbId",
        seasons: "/title/tv/:tmdbId/seasons",
        episodes: "/title/tv/:tmdbId/:season/episodes",
        browseRows: "/browse/rows",
        browseRow: "/browse/row/:id",
        providers: "/providers",
        playMovie: "/play/movie/:tmdbId?backend=videasy|vidking|tmdb-native|streamflix|auto",
        playTv: "/play/tv/:tmdbId/:season/:episode?backend=videasy|vidking|tmdb-native|streamflix|auto",
        playTmdbNativeMovie: "/play/tmdb-native/movie/:tmdbId",
        playTmdbNativeTv: "/play/tmdb-native/tv/:tmdbId/:season/:episode",
        playStreamflixMovie: "/play/streamflix/movie/:tmdbId",
        playStreamflixTv: "/play/streamflix/tv/:tmdbId/:season/:episode",
        playReport: "POST /play/report",
        subtitlesMovie: "/subtitles/movie/:tmdbId",
        subtitlesTv: "/subtitles/tv/:tmdbId/:season/:episode",
        subtitleTrack: "/subtitle/:trackId?type=&tmdbId=&season=&episode=",
        progress: "POST /progress",
        progressGet: "/progress/:tmdbId",
        continueWatching: "/continue-watching",
        downloadMovie: "POST /download/movie/:tmdbId",
        downloadTv: "POST /download/tv/:tmdbId/:season/:episode",
        downloadJob: "/download/jobs/:jobId",
        downloads: "/downloads/:filename",
        proxyStream: "/proxy/stream?url=",
      },
    });
  });

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "tizenflix-api", publicBase });
  });

  app.get("/proxy/health", async (_req, res) => {
    const { getRequestStats } = await import("../proxy/request-logger.js");
    const { getDedupStats } = await import("../proxy/request-deduplication.js");
    const stats = getRequestStats();
    const dedupStats = getDedupStats();
    
    res.json({
      ok: true,
      service: "tizenflix-proxy",
      stats: {
        totalRequests: stats.totalRequests,
        rateLimitedRequests: stats.rateLimitedRequests,
        cacheHits: stats.cacheHits,
        cacheHitRate: stats.totalRequests > 0 
          ? ((stats.cacheHits / stats.totalRequests) * 100).toFixed(1) + "%"
          : "0%",
        rateLimitRate: stats.totalRequests > 0
          ? ((stats.rateLimitedRequests / stats.totalRequests) * 100).toFixed(1) + "%"
          : "0%",
        last10Seconds: stats.last10Seconds,
        requestsPerSecond: (stats.last10Seconds / 10).toFixed(1),
        pendingDeduplications: dedupStats.pendingCount,
        byHost: stats.byHost,
      },
    });
  });

  app.get("/test/sample.mp4", (_req, res) => {
    const file = join(FIXTURES_DIR, "sample.mp4");
    if (!existsSync(file)) {
      return res.status(404).json({
        error: "sample.mp4 not found — run: npm run sample-mp4",
      });
    }
    res.setHeader("content-type", "video/mp4");
    res.sendFile(file);
  });

  app.get("/test/sample.m3u8", (_req, res) => {
    const file = join(FIXTURES_DIR, "sample.m3u8");
    if (!existsSync(file)) {
      return res.status(404).json({
        error: "sample.m3u8 not found — run: npm run sample-mp4",
      });
    }
    res.setHeader("content-type", "application/vnd.apple.mpegurl");
    res.setHeader("access-control-allow-origin", "*");
    res.sendFile(file);
  });

  app.get("/test/:asset", (req, res) => {
    const name = req.params.asset;
    if (!/^sample\d{3}\.ts$/.test(name)) {
      return res.status(404).json({ error: "not found" });
    }
    const file = join(FIXTURES_DIR, name);
    if (!existsSync(file)) {
      return res.status(404).json({ error: `${name} not found — run: npm run sample-mp4` });
    }
    res.setHeader("content-type", "video/mp2t");
    res.setHeader("access-control-allow-origin", "*");
    res.sendFile(file);
  });

  // --- Catalog (TMDB) ---
  app.get("/search", async (req, res) => {
    const apiKey = tmdbRequired(res, config);
    if (!apiKey) return;
    const q = String(req.query.q ?? "").trim();
    if (!q) return res.status(400).json({ error: "q query param required" });
    try {
      const page = Number(req.query.page ?? 1);
      const data = await tmdb.searchMulti(apiKey, q, page);
      res.json(data);
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get("/search/suggest", async (req, res) => {
    const apiKey = tmdbRequired(res, config);
    if (!apiKey) return;
    const q = String(req.query.q ?? "").trim();
    if (!q) return res.status(400).json({ error: "q query param required" });
    try {
      const data = await tmdb.searchPerson(apiKey, q, 1);
      res.json(data);
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get("/title/movie/:tmdbId", async (req, res) => {
    const apiKey = tmdbRequired(res, config);
    if (!apiKey) return;
    try {
      const title = await tmdb.getTitle(apiKey, "movie", req.params.tmdbId);
      res.json(title);
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get("/title/tv/:tmdbId", async (req, res) => {
    const apiKey = tmdbRequired(res, config);
    if (!apiKey) return;
    try {
      const title = await tmdb.getTitle(apiKey, "tv", req.params.tmdbId);
      res.json(title);
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get("/title/tv/:tmdbId/seasons", async (req, res) => {
    const apiKey = tmdbRequired(res, config);
    if (!apiKey) return;
    try {
      const seasons = await tmdb.getSeasons(apiKey, req.params.tmdbId);
      res.json({ seasons });
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get("/title/tv/:tmdbId/:season/episodes", async (req, res) => {
    const apiKey = tmdbRequired(res, config);
    if (!apiKey) return;
    try {
      const episodes = await tmdb.getSeasonEpisodes(
        apiKey,
        req.params.tmdbId,
        Number(req.params.season)
      );
      res.json({ episodes });
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get("/browse/rows", async (_req, res) => {
    const apiKey = tmdbRequired(res, config);
    if (!apiKey) return;
    try {
      res.json({
        rows: [
          { id: "trending-tv", title: "Trending TV", layout: "standard" },
          { id: "trending-movies", title: "Trending Movies", layout: "spotlight" },
          { id: "popular-movies", title: "Popular Movies", layout: "standard" },
          { id: "popular-tv", title: "Popular TV", layout: "standard" },
          { id: "popular-anime", title: "Popular Anime", layout: "standard" },
          { id: "netflix", title: "Netflix", layout: "standard" },
          { id: "amazon", title: "Amazon Prime", layout: "standard" },
          { id: "disney", title: "Disney+", layout: "standard" },
          { id: "hulu", title: "Hulu", layout: "standard" },
          { id: "apple-tv", title: "Apple TV+", layout: "standard" },
          { id: "hbo", title: "HBO", layout: "standard" },
        ],
      });
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get("/browse/genres", async (req, res) => {
    const apiKey = tmdbRequired(res, config);
    if (!apiKey) return;
    const type = req.query.type === "tv" ? "tv" : "movie";
    try {
      const genres = await tmdb.listGenres(apiKey, type);
      res.json({ type, genres });
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get("/browse/genre/:genreId", async (req, res) => {
    const apiKey = tmdbRequired(res, config);
    if (!apiKey) return;
    const page = Number(req.query.page ?? 1);
    const type = req.query.type === "tv" ? "tv" : "movie";
    const genreId = Number(req.params.genreId);
    try {
      const items = await tmdb.discoverByGenre(apiKey, type, genreId, page);
      res.json({ genreId, type, page, items });
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get("/browse/row/:id", async (req, res) => {
    const apiKey = tmdbRequired(res, config);
    if (!apiKey) return;
    const page = Number(req.query.page ?? 1);
    try {
      let items: tmdb.CatalogItem[] = [];
      switch (req.params.id) {
        case "trending-movies":
          items = await tmdb.trendingMovies(apiKey, page);
          break;
        case "trending-tv":
          items = await tmdb.trendingTv(apiKey, page);
          break;
        case "popular-movies":
          items = await tmdb.popularMovies(apiKey, page);
          break;
        case "popular-tv":
          items = await tmdb.popularTv(apiKey, page);
          break;
        case "popular-anime": {
          const [movies, tv] = await Promise.all([
            tmdb.discoverAnime(apiKey, "movie", page),
            tmdb.discoverAnime(apiKey, "tv", page),
          ]);
          items = [...movies, ...tv].slice(0, 20);
          break;
        }
        case "netflix": {
          const [movies, tv] = await Promise.all([
            tmdb.discoverByWatchProvider(apiKey, "movie", 8, page),
            tmdb.discoverByWatchProvider(apiKey, "tv", 213, page),
          ]);
          items = [...movies, ...tv].slice(0, 20);
          break;
        }
        case "amazon": {
          const [movies, tv] = await Promise.all([
            tmdb.discoverByWatchProvider(apiKey, "movie", 9, page),
            tmdb.discoverByWatchProvider(apiKey, "tv", 1024, page),
          ]);
          items = [...movies, ...tv].slice(0, 20);
          break;
        }
        case "disney": {
          const [movies, tv] = await Promise.all([
            tmdb.discoverByWatchProvider(apiKey, "movie", 337, page),
            tmdb.discoverByWatchProvider(apiKey, "tv", 2739, page),
          ]);
          items = [...movies, ...tv].slice(0, 20);
          break;
        }
        case "hulu": {
          const [movies, tv] = await Promise.all([
            tmdb.discoverByWatchProvider(apiKey, "movie", 15, page),
            tmdb.discoverByWatchProvider(apiKey, "tv", 453, page),
          ]);
          items = [...movies, ...tv].slice(0, 20);
          break;
        }
        case "apple-tv": {
          const [movies, tv] = await Promise.all([
            tmdb.discoverByWatchProvider(apiKey, "movie", 350, page),
            tmdb.discoverByWatchProvider(apiKey, "tv", 2552, page),
          ]);
          items = [...movies, ...tv].slice(0, 20);
          break;
        }
        case "hbo": {
          const [movies, tv] = await Promise.all([
            tmdb.discoverByWatchProvider(apiKey, "movie", 384, page),
            tmdb.discoverByWatchProvider(apiKey, "tv", 49, page),
          ]);
          items = [...movies, ...tv].slice(0, 20);
          break;
        }
        default:
          return res.status(404).json({ error: "Unknown browse row" });
      }
      res.json({ id: req.params.id, page, items });
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // --- Providers ---
  app.get("/providers", async (_req, res) => {
    try {
      const base = await listProviders();
      const streamflixProviders = getAllProviders().map((p) => ({
        id: p.id,
        name: p.name,
        endpoint: "streamflix",
        status: p.enabled ? "unknown" : "disabled",
        language: p.language,
      }));
      const providers = providerHealth.list([...base, ...streamflixProviders]);
      res.json({ providers });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get("/providers/streamflix", (_req, res) => {
    try {
      const healthList = providerHealth.list(
        getAllProviders().map((p) => ({
          id: p.name,
          name: p.name,
          endpoint: "streamflix",
        }))
      );
      const healthByName = new Map(healthList.map((h) => [h.name, h]));
      const providers = getAllProviders().map((p) => {
        const health = healthByName.get(p.name);
        return {
          id: p.id,
          name: p.name,
          language: p.language,
          supportsMovies: p.supportsMovies,
          supportsTv: p.supportsTv,
          enabled: p.enabled !== false && p.implementationStatus !== "stub",
          implementationStatus: p.implementationStatus ?? "stub",
          requiresPlaywright: p.requiresPlaywright ?? false,
          health: health
            ? {
                successes: health.successes,
                failures: health.failures,
                status: health.status,
              }
            : null,
        };
      });
      res.json({ count: providers.length, providers, config: getProviderConfig() });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post("/providers/streamflix/toggle", (req, res) => {
    try {
      const id = typeof req.body?.id === "string" ? req.body.id : "";
      const enabled = req.body?.enabled !== false;
      if (!id) return res.status(400).json({ error: "id required" });
      setProviderEnabled(id, enabled);
      res.json({ ok: true, id, enabled });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post("/providers/streamflix/config", (req, res) => {
    try {
      const disabled = Array.isArray(req.body?.disabled)
        ? req.body.disabled.filter((d: unknown) => typeof d === "string")
        : [];
      setProviderConfig(disabled);
      res.json({ ok: true, disabled });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get("/live/providers", (_req, res) => {
    try {
      const providers = listIptvProviders();
      res.json({ count: providers.length, providers, config: getIptvProviderConfig() });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get("/live/:providerId/channels", async (req, res) => {
    try {
      const channels = await listIptvChannels(req.params.providerId);
      res.json({ providerId: req.params.providerId, count: channels.length, channels });
    } catch (err) {
      res.status(404).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get("/live/:providerId/play/:channelId", async (req, res) => {
    try {
      const play = await resolveIptvPlayResponse(req.params.providerId, req.params.channelId);
      res.json(play);
    } catch (err) {
      res.status(404).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post("/live/providers/toggle", (req, res) => {
    try {
      const id = typeof req.body?.id === "string" ? req.body.id : "";
      const enabled = req.body?.enabled !== false;
      if (!id) return res.status(400).json({ error: "id required" });
      setIptvProviderEnabled(id, enabled);
      res.json({ ok: true, id, enabled });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post("/live/providers/config", (req, res) => {
    try {
      const disabled = Array.isArray(req.body?.disabled)
        ? req.body.disabled.filter((d: unknown) => typeof d === "string")
        : [];
      setIptvProviderConfig(disabled);
      res.json({ ok: true, disabled });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get("/providers/tmdb-native", (_req, res) => {
    try {
      const sources = TMDB_NATIVE_SOURCES.map((s) => ({
        id: s.id,
        name: s.name,
        mainUrl: s.mainUrl,
        supportsMovies: s.supportsMovies,
        supportsTv: s.supportsTv,
        priority: s.priority,
        duplicateOf: s.duplicateOf ?? null,
      }));
      res.json({ count: sources.length, sources });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post("/play/report", expressJson, (req, res) => {
    const { provider, success } = req.body ?? {};
    if (typeof provider !== "string" || typeof success !== "boolean") {
      return res.status(400).json({ error: "provider (string) and success (boolean) required" });
    }
    providerHealth.report(provider, success);
    res.json({ ok: true });
  });

  // --- Play ---
  function providerScoreFromList(
    providerList: Awaited<ReturnType<typeof providerHealth.list>>
  ) {
    return (provider: string) => {
      const stats = providerList.find((p) => p.name === provider);
      if (!stats) return 0.5;
      const total = stats.successes + stats.failures;
      if (!total) return 0.5;
      return stats.successes / total;
    };
  }

  async function validateAndRespond(
    play: PlayResponse,
    res: Response,
    tizenProfile: boolean,
    options: {
      meta?: Metadata;
      includeSubtitles?: boolean;
      probeLimit?: number;
      skipValidation?: boolean;
      preferredQuality?: string;
      maxHeight?: number;
    } = {}
  ) {
    const meta =
      options.meta ??
      (play.imdbId
        ? { imdbId: play.imdbId, title: play.title ?? "", year: "" }
        : await fetchMetadata(play.type, play.tmdbId));

    let enriched = play;
    if (options.includeSubtitles) {
      enriched = await enrichWithOpenSubtitles(
        play,
        { imdbId: meta.imdbId, title: meta.title },
        publicBase
      );
    }

    if (options.skipValidation) {
      const fast = {
        ...enriched,
        recommended: enriched.recommended ?? enriched.sources[0]?.id ?? null,
      };
      res.json(
        withProxiedUrls(
          publicBase,
          fast,
          play.audioPreference?.targetLanguage,
          options.maxHeight,
          tizenProfile
        )
      );
      return;
    }

    const baseProviders = await listProviders();
    const providerList = providerHealth.list(baseProviders);
    const validated = await validatePlaySources(enriched, publicBase, fetch, {
      tizenProfile,
      probeLimit: options.probeLimit ?? 1,
      preferredQuality: options.preferredQuality,
      reportProvider: (provider, success) => providerHealth.report(provider, success),
      providerScore: providerScoreFromList(providerList),
    });
    res.json(
      withProxiedUrls(
        publicBase,
        validated,
        play.audioPreference?.targetLanguage,
        options.maxHeight,
        tizenProfile
      )
    );
  }

  async function respondWithPlaySubtitles(
    play: Pick<PlayResponse, "type" | "tmdbId" | "season" | "episode" | "title" | "imdbId" | "subtitles">,
    res: Response
  ) {
    const meta = play.imdbId
      ? { imdbId: play.imdbId, title: play.title ?? "" }
      : await fetchMetadata(play.type, play.tmdbId);
    const enriched = await enrichWithOpenSubtitles(
      {
        ...play,
        sources: [],
        recommended: null,
        nextEpisode: null,
        subtitles: play.subtitles ?? [],
      },
      { imdbId: meta.imdbId, title: meta.title },
      publicBase
    );
    res.json({
      subtitles: withProxiedUrls(publicBase, enriched).subtitles,
    });
  }

  async function resolvePlayRequest(
    options: Parameters<typeof resolveWithBackend>[0],
    req: { query: Record<string, unknown> },
    res: Response,
    tizenProfile: boolean
  ) {
    const includeSubtitles = req.query.subtitles === "1";
    const onlySourceId =
      typeof req.query.onlySourceId === "string" ? req.query.onlySourceId : undefined;
    const providerId = parseProviderIdParam(req.query.providerId);
    const preferredProviderId = parsePreferredProviderIdParam(req.query.preferredProviderId);
    const raceProviders = parseRaceParam(req.query.race);
    const sources = parseSourcesParam(req.query.sources);
    const sourcesKey = sources?.length ? sources.join(",") : undefined;
    const lang = parseLangParam(req.query.lang);
    const audioLangParam = parseAudioLangParam(req.query.audioLang) ?? "original";
    const preferredQuality =
      typeof req.query.preferredQuality === "string" ? req.query.preferredQuality : undefined;
    const maxHeightRaw =
      typeof req.query.maxHeight === "string" ? parseInt(req.query.maxHeight, 10) : undefined;
    const maxHeight =
      maxHeightRaw && Number.isFinite(maxHeightRaw) && maxHeightRaw > 0 ? maxHeightRaw : undefined;
    const tmdbKey = requireTmdbKey(config);
    const audioPref = await resolveTargetAudioLang(
      {
        type: options.type,
        tmdbId: options.tmdbId,
        audioLang: audioLangParam,
      },
      tmdbKey
    );
    const cacheKey = playResolveCacheKey({
      type: options.type,
      tmdbId: options.tmdbId,
      season: options.season,
      episode: options.episode,
      backend: options.backend,
      onlySourceId,
      providerId,
      preferredProviderId,
      server: options.server,
      sources: sourcesKey,
      lang,
      audioLang: audioLangParam,
    });
    const noCache = req.query.nocache === "1";
    if (noCache) {
      invalidatePlayCacheKey(cacheKey);
      invalidatePlayCacheForTmdb(options.tmdbId);
    }
    const cached = noCache ? null : getCachedPlay(cacheKey);
    const fastResolve = req.query.fast === "1";
    const backendName = options.backend ?? "auto";
    // Probe enough Vidking/auto CDN rungs that Hydrogen 403s don't slip through as "OK".
    const probeLimit =
      backendName === "videasy" || backendName === "vidking" || backendName === "auto"
        ? 5
        : backendName === "streamflix"
          ? 3
          : 1;
    if (cached) {
      await validateAndRespond(cached, res, tizenProfile, {
        includeSubtitles,
        skipValidation: fastResolve || isCachedPlayValidated(cacheKey),
        preferredQuality,
        maxHeight,
        probeLimit,
      });
      if (!fastResolve && !isCachedPlayValidated(cacheKey)) {
        markCachedPlayValidated(cacheKey);
      }
      return;
    }

    const baseProviders = await listProviders();
    const providerList = providerHealth.list(baseProviders);
    const resolved = await runWithExtractOptions(
      { lang: audioPref.targetLanguage, maxHeight },
      () =>
        resolveWithBackend({
          ...options,
          sources,
          onlySourceId,
          providerId,
          preferredProviderId,
          raceProviders,
          lang,
          audioLang: audioLangParam,
          targetAudioLang: audioPref.targetLanguage,
          maxHeight,
          providerScore: providerScoreFromList(providerList),
        })
    );
    const play = applyAudioPreference(resolved, audioPref);
    setCachedPlay(cacheKey, play);
    await validateAndRespond(play, res, tizenProfile, {
      includeSubtitles,
      skipValidation:
        fastResolve || (onlySourceId === "vixsrc" && !preferredQuality && !maxHeight),
      probeLimit,
      preferredQuality,
      maxHeight,
    });
    if (!fastResolve && onlySourceId !== "vixsrc") {
      markCachedPlayValidated(cacheKey);
    }
  }

  app.get("/play/movie/:tmdbId", async (req, res) => {
    try {
      const tizenProfile = req.query.profile === "tizen";
      await resolvePlayRequest(
        {
          type: "movie",
          tmdbId: req.params.tmdbId,
          server: typeof req.query.server === "string" ? req.query.server : undefined,
          allServers: req.query.all !== "false",
          firstSuccessOnly: false,
          profile: tizenProfile ? "tizen" : undefined,
          backend: parseBackendParam(req.query.backend),
        },
        req,
        res,
        tizenProfile
      );
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get("/play/tv/:tmdbId/:season/:episode", async (req, res) => {
    try {
      const tizenProfile = req.query.profile === "tizen";
      await resolvePlayRequest(
        {
          type: "tv",
          tmdbId: req.params.tmdbId,
          season: req.params.season,
          episode: req.params.episode,
          server: typeof req.query.server === "string" ? req.query.server : undefined,
          allServers: req.query.all !== "false",
          firstSuccessOnly: false,
          profile: tizenProfile ? "tizen" : undefined,
          backend: parseBackendParam(req.query.backend),
        },
        req,
        res,
        tizenProfile
      );
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get("/play/subtitles/movie/:tmdbId", async (req, res) => {
    try {
      const meta = await fetchMetadata("movie", req.params.tmdbId);
      await respondWithPlaySubtitles(
        { type: "movie", tmdbId: req.params.tmdbId, title: meta.title, imdbId: meta.imdbId, subtitles: [] },
        res
      );
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get("/play/subtitles/tv/:tmdbId/:season/:episode", async (req, res) => {
    try {
      const meta = await fetchMetadata("tv", req.params.tmdbId);
      await respondWithPlaySubtitles(
        {
          type: "tv",
          tmdbId: req.params.tmdbId,
          season: req.params.season,
          episode: req.params.episode,
          title: meta.title,
          imdbId: meta.imdbId,
          subtitles: [],
        },
        res
      );
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get("/play/streamflix/movie/:tmdbId", async (req, res) => {
    try {
      const tizenProfile = req.query.profile === "tizen";
      await resolvePlayRequest(
        {
          type: "movie",
          tmdbId: req.params.tmdbId,
          backend: "streamflix",
          profile: tizenProfile ? "tizen" : undefined,
        },
        req,
        res,
        tizenProfile
      );
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get("/play/streamflix/tv/:tmdbId/:season/:episode", async (req, res) => {
    try {
      const tizenProfile = req.query.profile === "tizen";
      await resolvePlayRequest(
        {
          type: "tv",
          tmdbId: req.params.tmdbId,
          season: req.params.season,
          episode: req.params.episode,
          backend: "streamflix",
          profile: tizenProfile ? "tizen" : undefined,
        },
        req,
        res,
        tizenProfile
      );
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get("/play/tmdb-native/movie/:tmdbId", async (req, res) => {
    try {
      const tizenProfile = req.query.profile === "tizen";
      await resolvePlayRequest(
        {
          type: "movie",
          tmdbId: req.params.tmdbId,
          backend: "tmdb-native",
          profile: tizenProfile ? "tizen" : undefined,
        },
        req,
        res,
        tizenProfile
      );
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get("/play/tmdb-native/tv/:tmdbId/:season/:episode", async (req, res) => {
    try {
      const tizenProfile = req.query.profile === "tizen";
      await resolvePlayRequest(
        {
          type: "tv",
          tmdbId: req.params.tmdbId,
          season: req.params.season,
          episode: req.params.episode,
          backend: "tmdb-native",
          profile: tizenProfile ? "tizen" : undefined,
        },
        req,
        res,
        tizenProfile
      );
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // --- Subtitles ---
  async function resolveSubtitles(
    type: "movie" | "tv",
    tmdbId: string,
    season?: string,
    episode?: string,
    server?: string
  ) {
    const play = await resolvePlayableSources({
      type,
      tmdbId,
      season,
      episode,
      server,
      firstSuccessOnly: !server,
    });
    return withProxiedUrls(publicBase, play).subtitles;
  }

  app.get("/subtitles/movie/:tmdbId", async (req, res) => {
    try {
      const subtitles = await resolveSubtitles(
        "movie",
        req.params.tmdbId,
        undefined,
        undefined,
        typeof req.query.server === "string" ? req.query.server : undefined
      );
      res.json({ subtitles });
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get("/subtitles/tv/:tmdbId/:season/:episode", async (req, res) => {
    try {
      const subtitles = await resolveSubtitles(
        "tv",
        req.params.tmdbId,
        req.params.season,
        req.params.episode,
        typeof req.query.server === "string" ? req.query.server : undefined
      );
      res.json({ subtitles });
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get("/subtitle/opensubtitles", async (req, res) => {
    const download =
      typeof req.query.download === "string" ? req.query.download : "";
    if (!download.startsWith("http")) {
      return res.status(400).json({ error: "download query param required" });
    }
    try {
      const { fetchOpenSubtitleVtt } = await import("../subtitles/opensubtitles.js");
      const vtt = await fetchOpenSubtitleVtt(download);
      if (!vtt) return res.status(502).json({ error: "Could not fetch subtitle" });
      res.setHeader("content-type", "text/vtt; charset=utf-8");
      res.setHeader("access-control-allow-origin", "*");
      res.send(vtt);
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get("/subtitle/:trackId", async (req, res) => {
    const type = req.query.type === "tv" ? "tv" : "movie";
    const tmdbId = String(req.query.tmdbId ?? "");
    if (!tmdbId) {
      return res.status(400).json({ error: "tmdbId query param required" });
    }
    try {
      const subtitles = await resolveSubtitles(
        type,
        tmdbId,
        typeof req.query.season === "string" ? req.query.season : "1",
        typeof req.query.episode === "string" ? req.query.episode : "1",
        typeof req.query.server === "string" ? req.query.server : undefined
      );
      const track = subtitles.find((s) => s.id === req.params.trackId);
      if (!track?.url) {
        return res.status(404).json({ error: "Subtitle track not found" });
      }
      const result = await fetchProxiedStream(track.url, publicBase);
      res.status(result.status);
      if (result.contentType) res.setHeader("content-type", result.contentType);
      res.setHeader("access-control-allow-origin", "*");
      if (typeof result.body === "string") res.send(result.body);
      else res.send(Buffer.from(result.body));
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // --- Progress ---
  app.post("/progress", expressJson, (req, res) => {
    const body = req.body ?? {};
    const { tmdbId, type, positionSeconds, durationSeconds } = body;
    if (!tmdbId || (type !== "movie" && type !== "tv")) {
      return res.status(400).json({
        error: "tmdbId and type (movie|tv) required",
      });
    }
    const pos = Number(positionSeconds ?? 0);
    const dur = Number(durationSeconds ?? 0);
    const percent = dur > 0 ? Math.min(100, (pos / dur) * 100) : 0;
    const saved = progress.save({
      tmdbId: String(tmdbId),
      type,
      season: type === "tv" ? Number(body.season ?? 1) : null,
      episode: type === "tv" ? Number(body.episode ?? 1) : null,
      title: body.title,
      poster: body.poster ?? null,
      positionSeconds: pos,
      durationSeconds: dur,
      percent,
      updatedAt: new Date().toISOString(),
    });
    res.json(saved);
  });

  app.get("/progress/:tmdbId", (req, res) => {
    const type = req.query.type === "tv" ? "tv" : "movie";
    const entry = progress.get(
      req.params.tmdbId,
      type,
      req.query.season ? Number(req.query.season) : undefined,
      req.query.episode ? Number(req.query.episode) : undefined
    );
    if (!entry) return res.status(404).json({ error: "No progress found" });
    res.json(entry);
  });

  app.get("/continue-watching", (req, res) => {
    const limit = Number(req.query.limit ?? 20);
    res.json({ items: progress.continueWatching(limit) });
  });

  // --- Download jobs ---
  async function startDownload(
    req: Request,
    res: Response,
    type: "movie" | "tv",
    tmdbId: string,
    season?: string,
    episode?: string
  ) {
    try {
      const body = req.body ?? {};
      const play = await resolvePlayableSources({
        type,
        tmdbId,
        season,
        episode,
        server: body.server ?? req.query.server,
        allServers: !!(body.server ?? req.query.server),
        firstSuccessOnly: !(body.server ?? req.query.server),
      });
      const source = pickSource(play.sources, {
        quality: body.quality ?? (typeof req.query.quality === "string" ? req.query.quality : undefined),
        sourceId: body.sourceId,
        server: body.server ?? (typeof req.query.server === "string" ? req.query.server : undefined),
      });
      const job = downloads.createJob(
        {
          type,
          tmdbId,
          season,
          episode,
          title: play.title,
          source,
          streamUrl: source.url,
        },
        {
          concurrency: body.concurrency ?? 16,
          maxDurationSeconds: body.maxDurationSeconds ?? body.proofSeconds,
        }
      );
      res.status(202).json({
        job,
        statusUrl: `${publicBase}/download/jobs/${job.id}`,
      });
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
    }
  }

  app.post("/download/movie/:tmdbId", expressJson, (req, res) => {
    void startDownload(req, res, "movie", String(req.params.tmdbId));
  });

  app.post("/download/tv/:tmdbId/:season/:episode", expressJson, (req, res) => {
    void startDownload(
      req,
      res,
      "tv",
      String(req.params.tmdbId),
      String(req.params.season),
      String(req.params.episode)
    );
  });

  app.get("/download/jobs/:jobId", (req, res) => {
    const job = downloads.getJob(req.params.jobId);
    if (!job) return res.status(404).json({ error: "Job not found" });
    res.json({ job });
  });

  app.get("/download/jobs", (req, res) => {
    const limit = Number(req.query.limit ?? 50);
    res.json({ jobs: downloads.listJobs(limit) });
  });

  app.get("/downloads/:filename", (req, res) => {
    const file = join(config.downloadsDir, req.params.filename);
    if (!existsSync(file)) {
      return res.status(404).json({ error: "File not found" });
    }
    res.download(file);
  });

  // --- Proxy ---
  app.get("/proxy/inline-manifest/:token", (req, res) => {
    const entry = getInlineManifest(req.params.token);
    if (!entry) {
      return res.status(404).json({ error: "Inline manifest expired or not found" });
    }
    const preferredAudioLang =
      typeof req.query.audioLang === "string"
        ? req.query.audioLang === "original"
          ? undefined
          : req.query.audioLang.split("-")[0]
        : undefined;
    const maxHeightRaw =
      typeof req.query.maxHeight === "string" ? parseInt(req.query.maxHeight, 10) : undefined;
    const maxHeight =
      maxHeightRaw && Number.isFinite(maxHeightRaw) && maxHeightRaw > 0 ? maxHeightRaw : undefined;
    const tizenProfile = req.query.profile === "tizen";
    const rewritten = rewriteM3u8(
      entry.body,
      entry.upstreamUrl,
      publicBase,
      entry.referer ? { referer: entry.referer } : undefined,
      { preferredAudioLang, maxHeight, tizenProfile }
    );
    res.status(200);
    res.setHeader("content-type", "application/vnd.apple.mpegurl");
    res.setHeader("access-control-allow-origin", "*");
    res.setHeader("cache-control", "public, max-age=60");
    res.send(rewritten);
  });

  app.get("/proxy/stream", async (req, res) => {
    const target = req.query.url;
    if (typeof target !== "string" || !target.startsWith("http")) {
      return res.status(400).json({ error: "url query param required" });
    }
    const proxyHeaders = parseProxyHeaderQuery(req.query);
    const preferredAudioLang =
      typeof req.query.audioLang === "string" && req.query.audioLang !== "original"
        ? req.query.audioLang.split("-")[0]
        : undefined;
    const maxHeightRaw =
      typeof req.query.maxHeight === "string" ? parseInt(req.query.maxHeight, 10) : undefined;
    const maxHeight =
      maxHeightRaw && Number.isFinite(maxHeightRaw) && maxHeightRaw > 0 ? maxHeightRaw : undefined;
    const tizenProfile = req.query.profile === "tizen";
    const headerOptions = {
      ...proxyHeaders,
      preferredAudioLang,
      maxHeight,
      tizenProfile,
    };
    
    // Support Range requests for all content types (Task 10)
    const rangeHeader = typeof req.headers.range === "string" ? req.headers.range : undefined;
    
    try {
      if (looksLikeBinarySegment(target)) {
        await pipeProxiedStream(target, res, fetch, headerOptions, rangeHeader);
        return;
      }

      const result = await fetchProxiedStream(target, publicBase, fetch, headerOptions);
      res.status(result.status);
      if (result.contentType) res.setHeader("content-type", result.contentType);
      res.setHeader("access-control-allow-origin", "*");
      res.setHeader("accept-ranges", "bytes");  // Advertise range support
      
      // Add cache control based on content type
      if (result.rewritten) {
        res.setHeader("x-m3u8-rewritten", "true");
        res.setHeader("cache-control", "public, max-age=60");  // Manifests: 1 min
      } else {
        res.setHeader("cache-control", "public, max-age=3600");  // Other content: 1 hour
      }
      
      if (typeof result.body === "string") res.send(result.body);
      else res.send(Buffer.from(result.body));
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      
      // Provide better error messages for rate limiting
      if (errMsg.includes("429") || errMsg.includes("Rate limited")) {
        res.status(429).json({
          error: "CDN rate limit exceeded",
          message: "Too many requests. Wait 30 seconds and try again.",
          retryAfter: 30,
        });
      } else {
        res.status(502).json({ error: errMsg });
      }
    }
  });
}
