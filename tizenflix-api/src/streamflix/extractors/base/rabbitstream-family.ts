import { createDecipheriv, createHash } from "node:crypto";

export { rabbitstreamExtractor, megacloudExtractor } from "../rabbitstream.js";

export function md5(input: Buffer): Buffer {
  return createHash("md5").update(input).digest();
}

export function generateKey(salt: Buffer, secret: Buffer): Buffer {
  let output = md5(Buffer.concat([secret, salt]));
  let currentKey = output;
  while (currentKey.length < 48) {
    output = md5(Buffer.concat([output, secret, salt]));
    currentKey = Buffer.concat([currentKey, output]);
  }
  return currentKey;
}

export function decryptSourceUrl(decryptionKey: Buffer, sourceUrl: string): string {
  const cipherData = Buffer.from(sourceUrl, "base64");
  const encrypted = cipherData.subarray(16);
  const iv = decryptionKey.subarray(32);
  const key = decryptionKey.subarray(0, 32);
  const decipher = createDecipheriv("aes-256-cbc", key, iv);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
