import type { Express, Request, Response, NextFunction } from "express";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { AppConfig } from "../config.js";
import { requireTmdbKey } from "../config.js";
import { DownloadService, pickSource } from "../download/jobs.js";
import { buildProxyUrl } from "../proxy/proxy-url.js";
import { fetchProxiedStream } from "../proxy/upstream.js";
import { resolvePlayableSources, listProviders } from "../normalize/to-play-response.js";
import { ProgressService } from "../store/progress.js";
import { ProviderHealthService } from "../store/provider-health.js";
import * as tmdb from "../tmdb/client.js";

export interface RouteContext {
  config: AppConfig;
  progress: ProgressService;
  downloads: DownloadService;
  providerHealth: ProviderHealthService;
}

function proxyWrap(publicBase: string, url: string): string {
  return buildProxyUrl(publicBase, url);
}

function withProxiedUrls(
  publicBase: string,
  play: Awaited<ReturnType<typeof resolvePlayableSources>>
) {
  return {
    ...play,
    sources: play.sources.map((s) => ({
      ...s,
      url: proxyWrap(publicBase, s.url),
    })),
    subtitles: play.subtitles.map((sub) => ({
      ...sub,
      url: sub.url ? proxyWrap(publicBase, sub.url) : sub.url,
    })),
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
        playMovie: "/play/movie/:tmdbId",
        playTv: "/play/tv/:tmdbId/:season/:episode",
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
          { id: "trending-movies", title: "Trending Movies" },
          { id: "trending-tv", title: "Trending TV" },
          { id: "popular-movies", title: "Popular Movies" },
          { id: "popular-tv", title: "Popular TV" },
        ],
      });
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
      const providers = providerHealth.list(base);
      res.json({ providers });
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
  app.get("/play/movie/:tmdbId", async (req, res) => {
    try {
      const allServers = req.query.all === "true";
      const play = await resolvePlayableSources({
        type: "movie",
        tmdbId: req.params.tmdbId,
        server: typeof req.query.server === "string" ? req.query.server : undefined,
        allServers,
        firstSuccessOnly: !allServers && !req.query.server,
      });
      res.json(withProxiedUrls(publicBase, play));
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get("/play/tv/:tmdbId/:season/:episode", async (req, res) => {
    try {
      const allServers = req.query.all === "true";
      const play = await resolvePlayableSources({
        type: "tv",
        tmdbId: req.params.tmdbId,
        season: req.params.season,
        episode: req.params.episode,
        server: typeof req.query.server === "string" ? req.query.server : undefined,
        allServers,
        firstSuccessOnly: !allServers && !req.query.server,
      });
      res.json(withProxiedUrls(publicBase, play));
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
    void startDownload(req, res, "movie", req.params.tmdbId);
  });

  app.post("/download/tv/:tmdbId/:season/:episode", expressJson, (req, res) => {
    void startDownload(
      req,
      res,
      "tv",
      req.params.tmdbId,
      req.params.season,
      req.params.episode
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
  app.get("/proxy/stream", async (req, res) => {
    const target = req.query.url;
    if (typeof target !== "string" || !target.startsWith("http")) {
      return res.status(400).json({ error: "url query param required" });
    }
    try {
      const result = await fetchProxiedStream(target, publicBase);
      res.status(result.status);
      if (result.contentType) res.setHeader("content-type", result.contentType);
      res.setHeader("access-control-allow-origin", "*");
      if (result.rewritten) res.setHeader("x-m3u8-rewritten", "true");
      if (typeof result.body === "string") res.send(result.body);
      else res.send(Buffer.from(result.body));
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });
}
