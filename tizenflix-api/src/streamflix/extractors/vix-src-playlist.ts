const URI_ATTR_RE = /URI="([^"]+)"/g;

/** Patch VixSrc master playlist for English defaults (Streamflix parity). */
export function patchVixSrcPlaylist(
  playlistContent: string,
  baseUrl: string,
  lang = "en"
): string {
  const base = new URL(baseUrl);
  const lines = playlistContent.split(/\r?\n/);
  const out: string[] = [];

  for (const line of lines) {
    let patched = line;

    if (patched.startsWith("#") && URI_ATTR_RE.test(patched)) {
      URI_ATTR_RE.lastIndex = 0;
      patched = patched.replace(URI_ATTR_RE, (_match, uri: string) => {
        if (uri.startsWith("http") || uri.startsWith("data:")) {
          return `URI="${uri}"`;
        }
        try {
          return `URI="${new URL(uri, base).href}"`;
        } catch {
          return `URI="${uri}"`;
        }
      });
    } else if (patched && !patched.startsWith("#")) {
      try {
        patched = new URL(patched, base).href;
      } catch {
        /* keep */
      }
    }

    if (patched.startsWith("#EXT-X-MEDIA:TYPE=AUDIO")) {
      patched = patched
        .replace(/DEFAULT=YES/gi, "DEFAULT=NO")
        .replace(/AUTOSELECT=YES/gi, "AUTOSELECT=NO");
      const isTarget =
        patched.includes(`LANGUAGE="${lang}"`) ||
        patched.includes(`NAME="${lang}"`) ||
        (lang === "en" && /English|eng/i.test(patched));
      if (isTarget) {
        patched = patched
          .replace(/DEFAULT=NO/gi, "DEFAULT=YES")
          .replace(/AUTOSELECT=NO/gi, "AUTOSELECT=YES");
      }
    } else if (patched.startsWith("#EXT-X-MEDIA:TYPE=SUBTITLES")) {
      patched = patched
        .replace(/DEFAULT=YES/gi, "DEFAULT=NO")
        .replace(/AUTOSELECT=YES/gi, "AUTOSELECT=NO");
      const trackLang = patched.match(/LANGUAGE="([^"]+)"/i)?.[1] ?? "";
      const trackName = patched.match(/NAME="([^"]+)"/i)?.[1] ?? "";
      const isForced = /forced/i.test(trackName) || /forced/i.test(trackLang) || /FORCED=YES/i.test(patched);
      const isRightLang =
        trackLang.toLowerCase().includes(lang) ||
        trackName.toLowerCase().includes(lang) ||
        (lang === "en" && /english|eng/i.test(`${trackName} ${trackLang}`));
      if (isForced && isRightLang) {
        patched = patched
          .replace(/DEFAULT=NO/gi, "DEFAULT=YES")
          .replace(/AUTOSELECT=NO/gi, "AUTOSELECT=YES");
      }
    }

    out.push(patched);
  }

  return out.join("\n");
}
