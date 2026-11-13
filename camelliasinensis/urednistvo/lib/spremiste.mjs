// Katalog uredništva: podaci/katalog.json + povijest verzija (podaci/povijest/) + dnevnik promjena (podaci/dnevnik.log).
// Svako spremanje: provjera (urednistvo/katalog.mjs) -> nova verzija -> atomarno pisanje. Sukob verzija = 409.
import fs from 'node:fs';
import path from 'node:path';
import { citajJson, pisiJson, brava } from './datoteke.mjs';
import { provjeri, pocetniKatalog, uskladi } from '../katalog.mjs';
import { ROOT } from './postavke.mjs';

const ZADRZI_VERZIJA = 60;

export class Greska extends Error {
  constructor(status, poruka, podaci = {}) { super(poruka); this.status = status; this.podaci = podaci; }
}

export function spremiste(podaciDir, { slikaPostoji }) {
  const datoteka = path.join(podaciDir, 'katalog.json');
  const povijestDir = path.join(podaciDir, 'povijest');
  const dnevnikDatoteka = path.join(podaciDir, 'dnevnik.log');
  const zakljucaj = brava();

  function dnevnik(zapis) {
    fs.mkdirSync(podaciDir, { recursive: true, mode: 0o700 });
    fs.appendFileSync(dnevnikDatoteka, JSON.stringify({ vrijeme: new Date().toISOString(), ...zapis }) + '\n', { mode: 0o600 });
  }

  function snimiVerziju(s, opis) {
    pisiJson(path.join(povijestDir, `${String(s.verzija).padStart(6, '0')}.json`), { opis, sadrzaj: s });
    const sve = fs.readdirSync(povijestDir).filter((f) => /^\d{6}\.json$/.test(f)).sort();
    for (const f of sve.slice(0, Math.max(0, sve.length - ZADRZI_VERZIJA))) fs.rmSync(path.join(povijestDir, f));
  }

  /** trenutni katalog; prvi put se stvara iz prototipa (design-reference/src/data.js) */
  function ucitaj() {
    const s = citajJson(datoteka);
    if (s) return uskladi(s);
    const pocetni = pocetniKatalog(ROOT);
    pisiJson(datoteka, pocetni);
    snimiVerziju(pocetni, 'Početni sadržaj');
    return pocetni;
  }

  function spremi(novi, ime, opis) {
    const r = provjeri(novi, slikaPostoji);
    if (!r.ok) throw new Greska(422, 'Sadržaj nije ispravan', { greske: r.greske });
    pisiJson(datoteka, r.sadrzaj);
    snimiVerziju(r.sadrzaj, opis);
    dnevnik({ ime, radnja: 'spremanje', verzija: r.sadrzaj.verzija, opis });
    return r.sadrzaj;
  }

  return {
    ucitaj,
    dnevnik,
    /** spremi cijeli katalog; bazna verzija mora biti trenutna (inače je netko drugi u međuvremenu spremio) */
    spremiKatalog: (katalog, baznaVerzija, ime, opis) => zakljucaj(() => {
      const trenutni = ucitaj();
      if (trenutni.verzija !== baznaVerzija) throw new Greska(409, 'Katalog je u međuvremenu promijenjen', { verzija: trenutni.verzija });
      if (!katalog || typeof katalog !== 'object') throw new Greska(422, 'Sadržaj nije ispravan', { greske: [] });
      const novi = { ...katalog, format: trenutni.format, verzija: trenutni.verzija + 1, azurirano: new Date().toISOString(), azurirao: ime };
      return spremi(uskladi(novi), ime, String(opis || 'Promjena kataloga').slice(0, 120));
    }),
    povijest() {
      if (!fs.existsSync(povijestDir)) return [];
      return fs.readdirSync(povijestDir).filter((f) => /^\d{6}\.json$/.test(f)).sort().reverse().map((f) => {
        const v = citajJson(path.join(povijestDir, f));
        return { verzija: v.sadrzaj.verzija, azurirano: v.sadrzaj.azurirano, azurirao: v.sadrzaj.azurirao, opis: v.opis };
      });
    },
    /** vrati staru verziju (kao novu verziju — povijest se ne briše) */
    vrati: (verzija, baznaVerzija, ime) => zakljucaj(() => {
      const trenutni = ucitaj();
      if (trenutni.verzija !== baznaVerzija) throw new Greska(409, 'Katalog je u međuvremenu promijenjen', { verzija: trenutni.verzija });
      const stara = citajJson(path.join(povijestDir, `${String(Number(verzija)).padStart(6, '0')}.json`));
      if (!stara || !Number.isInteger(Number(verzija))) throw new Greska(404, 'Verzija ne postoji');
      const novi = { ...stara.sadrzaj, verzija: trenutni.verzija + 1, azurirano: new Date().toISOString(), azurirao: ime };
      return spremi(novi, ime, `Vraćena verzija ${verzija}`);
    }),
  };
}
