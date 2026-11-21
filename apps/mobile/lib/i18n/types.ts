// apps/mobile/lib/i18n/types.ts
// `Shape<typeof fr>` forces every English dictionary to mirror the French one
// key for key (French is the source language, like apps/web/messages).

export type Lang = "fr" | "en";

export type Shape<T> = {
  [K in keyof T]: T[K] extends string ? string : Shape<T[K]>;
};
