import { AsyncLocalStorage } from "node:async_hooks";

export interface ExtractContext {
  lang: string;
  maxHeight?: number;
}

const extractContext = new AsyncLocalStorage<ExtractContext>();

export function runWithExtractOptions<T>(
  opts: { lang?: string; maxHeight?: number },
  fn: () => Promise<T>
): Promise<T> {
  const parent = extractContext.getStore();
  return extractContext.run(
    {
      lang: opts.lang ?? parent?.lang ?? "en",
      maxHeight: opts.maxHeight ?? parent?.maxHeight,
    },
    fn
  );
}

export function runWithExtractLang<T>(lang: string | undefined, fn: () => Promise<T>): Promise<T> {
  return runWithExtractOptions({ lang }, fn);
}

export function getExtractLang(): string {
  return extractContext.getStore()?.lang ?? "en";
}

export function getExtractMaxHeight(): number | undefined {
  return extractContext.getStore()?.maxHeight;
}
