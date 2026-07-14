import type { ExtractorDef } from "../types.js";
import { extractGenericPacked } from "./base/generic-packed.js";

/** Ported from RpmvidExtractor (GenericPackedSourceExtractor) */
export const rpmvidExtractor: ExtractorDef = {
  name: "Rpmvid",
  mainUrl: "https://rpmvid.com",
  aliasUrls: ["https://cubeembed.rpmvid.com", "https://bummi.upns.xyz", "https://loadm.cam", "https://anibum.playerp2p.online", "https://pelisplus.upns.pro", "https://pelisplus.rpmstream.live", "https://pelisplus.strp2p.com", "https://flemmix.upns.pro", "https://moflix.rpmplay.xyz", "https://moflix.upns.xyz", "https://flix2day.xyz", "https://primevid.click", "https://totocoutouno.rpmlive.online", "https://dismoiceline.uns.bio", "https://doremifasol.ezplayer.me", "https://marcus.p2pstream.vip", "https://animeav1.uns.bio"],
  extract: (link) => extractGenericPacked(link),
};
