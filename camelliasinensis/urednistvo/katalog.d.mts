// Tipovi za JS modul katalog.mjs (testovi). Oblik kataloga provjerava provjeri() u runtimeu, pa je ovdje namjerno labav.
/* eslint-disable @typescript-eslint/no-explicit-any */
export const VRSTE: string[];
export const NAJVISE_NA_POLICI: number;
export function pocetniKatalog(root: string): any;
export function provjeri(k: unknown, slikaPostoji?: (k: string) => boolean): { ok: boolean; sadrzaj?: any; greske: { putanja: (string | number)[]; poruka: string }[] };
export function uOblikStranice(k: any, dimenzije: (p: any) => { width: number; height: number } | null): { types: any[]; products: any[]; izdvojeno: { polica: string[] } };
