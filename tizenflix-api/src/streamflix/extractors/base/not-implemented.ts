import type { ExtractedVideo } from "../../types.js";

export function notImplementedExtract(name: string) {
  return async (_link: string, _serverName?: string): Promise<ExtractedVideo> => {
    throw new Error(`Extractor ${name} not yet implemented`);
  };
}
