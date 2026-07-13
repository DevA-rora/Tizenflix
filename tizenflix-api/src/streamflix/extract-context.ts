import { AsyncLocalStorage } from "node:async_hooks";

const extractLangContext = new AsyncLocalStorage<{ lang: string }>();

export function runWithExtractLang<T>(lang: string | undefined, fn: () => Promise<T>): Promise<T> {
  return extractLangContext.run({ lang: lang ?? "en" }, fn);
}

export function getExtractLang(): string {
  return extractLangContext.getStore()?.lang ?? "en";
}
