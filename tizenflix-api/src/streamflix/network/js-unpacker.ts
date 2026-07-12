/** P.A.C.K.E.R. JS deobfuscation — port of Streamflix JsUnpacker.kt */

const ALPHABET_62 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const ALPHABET_95 =
  " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~";

class Unbase {
  private alphabet: string | null = null;
  private dictionary: Map<string, number> | null = null;

  constructor(private radix: number) {
    if (radix > 36) {
      if (radix < 62) this.alphabet = ALPHABET_62.slice(0, radix);
      else if (radix >= 63 && radix <= 94) this.alphabet = ALPHABET_95.slice(0, radix);
      else if (radix === 62) this.alphabet = ALPHABET_62;
      else if (radix === 95) this.alphabet = ALPHABET_95;

      if (this.alphabet) {
        this.dictionary = new Map();
        for (let i = 0; i < this.alphabet.length; i++) {
          this.dictionary.set(this.alphabet[i]!, i);
        }
      }
    }
  }

  unbase(str: string): number {
    if (!this.alphabet || !this.dictionary) {
      return parseInt(str, this.radix);
    }
    const tmp = str.split("").reverse().join("");
    let ret = 0;
    for (let i = 0; i < tmp.length; i++) {
      const ch = tmp[i]!;
      const idx = this.dictionary.get(ch);
      if (idx === undefined) throw new Error(`unbase: invalid char ${ch}`);
      ret += Math.pow(this.radix, i) * idx;
    }
    return ret;
  }
}

export function detectPackedJs(script: string): boolean {
  const js = script.replace(/ /g, "");
  return /eval\(function\(p,a,c,k,e,[rd]/.test(js);
}

export function unpackJs(script: string): string | null {
  try {
    const re = /\}\s*\('(.*)',\s*(.*?),\s*(\d+),\s*'(.*?)'\.split\('\|'\)/s;
    const m = script.match(re);
    if (!m || m.length < 5) return null;

    const payload = m[1]!.replace(/\\'/g, "'");
    let radix = 36;
    let count = 0;
    try {
      radix = parseInt(m[2]!, 10);
    } catch {
      /* keep default */
    }
    try {
      count = parseInt(m[3]!, 10);
    } catch {
      /* keep default */
    }

    const symtab = m[4]!.split("|");
    if (symtab.length !== count) return null;

    const unbase = new Unbase(radix);
    const wordRe = /\b\w+\b/g;
    let decoded = payload;
    let replaceOffset = 0;
    let match: RegExpExecArray | null;

    while ((match = wordRe.exec(payload)) !== null) {
      const word = match[0];
      let x: number;
      try {
        x = unbase.unbase(word);
      } catch {
        break;
      }
      const value = x >= 0 && x < symtab.length ? symtab[x] : null;
      if (value) {
        const start = match.index + replaceOffset;
        const end = start + word.length;
        decoded = decoded.slice(0, start) + value + decoded.slice(end);
        replaceOffset += value.length - word.length;
      }
    }
    return decoded;
  } catch {
    return null;
  }
}
