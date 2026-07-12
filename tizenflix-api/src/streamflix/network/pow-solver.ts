import { createHash } from "node:crypto";

/** Proof-of-work solver for FlixLatam / SoloLatino style challenges */
export function solvePowChallenge(
  challenge: string,
  difficulty: number,
  salt: string,
  maxIterations = 5_000_000
): string | null {
  for (let nonce = 0; nonce < maxIterations; nonce++) {
    const hash = createHash("sha256")
      .update(`${salt}${challenge}${nonce}`)
      .digest("hex");
    if (countLeadingZeros(hash) >= difficulty) {
      return String(nonce);
    }
  }
  return null;
}

function countLeadingZeros(hex: string): number {
  let zeros = 0;
  for (const ch of hex) {
    if (ch === "0") zeros += 4;
    else {
      const n = parseInt(ch, 16);
      if (n < 8) zeros += 3;
      else if (n < 12) zeros += 2;
      else if (n < 14) zeros += 1;
      break;
    }
  }
  return zeros;
}
