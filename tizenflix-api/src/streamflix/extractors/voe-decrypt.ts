/** VOE decrypt helper — ported from Streamflix DecryptHelper.kt */
export function decryptVoe(encodedString: string): Record<string, unknown> {
  const vF = rot13(encodedString);
  const vF2 = replacePatterns(vF);
  const vF3 = vF2.replace(/_/g, "");
  const vF4 = Buffer.from(vF3, "base64").toString("utf8");
  const vF5 = charShift(vF4, 3);
  const vF6 = vF5.split("").reverse().join("");
  const vAtob = Buffer.from(vF6, "base64").toString("utf8");
  return JSON.parse(vAtob) as Record<string, unknown>;
}

export function findVoeEncodedJson(html: string): string | null {
  const match = html.match(/<script\s+type="application\/json">(.*?)<\/script>/s);
  return match?.[1]?.trim() ?? null;
}

function rot13(input: string): string {
  return input
    .split("")
    .map((c) => {
      const code = c.charCodeAt(0);
      if (code >= 65 && code <= 90) return String.fromCharCode(((code - 65 + 13) % 26) + 65);
      if (code >= 97 && code <= 122) return String.fromCharCode(((code - 97 + 13) % 26) + 97);
      return c;
    })
    .join("");
}

function replacePatterns(input: string): string {
  const patterns = ["@$", "^^", "~@", "%?", "*~", "!!", "#&"];
  let out = input;
  for (const p of patterns) {
    out = out.split(p).join("_");
  }
  return out;
}

function charShift(input: string, shift: number): string {
  return input
    .split("")
    .map((c) => String.fromCharCode(c.charCodeAt(0) - shift))
    .join("");
}
