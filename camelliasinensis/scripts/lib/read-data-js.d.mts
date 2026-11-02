export const DATA_JS: string;
export function readDataJs(path?: string): {
  TYPES: Record<string, { n: string; d: string }>;
  FLAV: Record<string, string>;
  MOODS: Record<string, string>;
  FORMS: Record<string, string>;
  BREW: Record<string, [string, string, string]>;
  RAW: unknown[][];
};
export function slugify(name: string): string;
