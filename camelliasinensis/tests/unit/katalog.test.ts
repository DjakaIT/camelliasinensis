// Pravila kataloga iz uredništva (urednistvo/katalog.mjs): ista provjera vrijedi za uredništvo i za build.
import { describe, expect, it } from 'vitest';
import { pocetniKatalog, provjeri, uOblikStranice, uskladi } from '../../urednistvo/katalog.mjs';

type Kat = ReturnType<typeof pocetniKatalog>;
const pocetni: Kat = pocetniKatalog(process.cwd());

describe('katalog uredništva', () => {
  it('početni katalog iz prototipa je ispravan i daje 71 proizvod', () => {
    const r = provjeri(pocetni);
    expect(r.ok).toBe(true);
    const o = uOblikStranice(r.sadrzaj, () => ({ width: 460, height: 460 }));
    expect(o.products).toHaveLength(71);
    expect(o.products[0]).toMatchObject({ sku: 'CSTB-2', price: { amount: 1190, currency: 'EUR' }, taxIncluded: true });
  });
  it.each([
    ['duplikat SKU-a', (k: Kat) => (k.proizvodi[1].sku = k.proizvodi[0].sku), /već postoji/],
    ['cijena 0', (k: Kat) => (k.proizvodi[0].cijena = 0), /Cijena/],
    ['tri decimale', (k: Kat) => (k.proizvodi[0].cijena = 1.234), /Cijena/],
    ['nepoznat okus', (k: Kat) => k.proizvodi[0].okusi.push('ljuti'), /Nepoznat okus/],
    ['negativna zaliha', (k: Kat) => (k.proizvodi[0].zaliha = -1), /Zaliha/],
    ['polica s neobjavljenim', (k: Kat) => (k.proizvodi.find((p: Kat) => p.sku === k.izdvojeno.polica[0]).objavljeno = false), /nije objavljen/],
    ['nepostojeća vrsta', (k: Kat) => (k.vrste = k.vrste.slice(1)), /Vrste čaja/],
  ])('odbija: %s', (_, pokvari, poruka) => {
    const k = structuredClone(pocetni);
    pokvari(k);
    const r = provjeri(k);
    expect(r.ok).toBe(false);
    expect(r.greske.map((g) => g.poruka).join(' ')).toMatch(poruka);
  });
  it('zaliha: 0 = rasprodano, ≤ 3 = malo, prazno = ne broji se', () => {
    const k = structuredClone(pocetni);
    k.proizvodi[0].zaliha = 0;
    k.proizvodi[1].zaliha = 2;
    k.proizvodi[2].zaliha = null;
    const o = uOblikStranice(provjeri(k).sadrzaj, () => null);
    expect(o.products.slice(0, 3).map((p) => p.stock.status)).toEqual(['outofstock', 'low', 'instock']);
    expect(o.products[2].stock.quantity).toBeNull();
  });
  it('stari katalog ("Pribor i knjige", objavljena knjiga) usklađuje se i prolazi provjeru; novi ostaje isti', () => {
    const stari = structuredClone(pocetni);
    const pribor = stari.vrste.find((v: Kat) => v.kljuc === 'pribor');
    Object.assign(pribor, { naziv: 'Pribor i knjige', opis: 'Gaiwani, setovi za matchu, daske, knjiga.' });
    const knjiga = stari.proizvodi.find((p: Kat) => p.slug.startsWith('knjiga-'));
    knjiga.objavljeno = true;
    stari.izdvojeno.polica.push(knjiga.sku);
    const u = uskladi(stari);
    expect(provjeri(u).ok).toBe(true);
    expect(u.vrste.find((v: Kat) => v.kljuc === 'pribor')).toMatchObject({ naziv: 'Pribor', opis: 'Gaiwani, setovi za matchu i čajne daske.' });
    expect(u.proizvodi.find((p: Kat) => p.sku === knjiga.sku).objavljeno).toBe(false);
    expect(u.proizvodi.filter((p: Kat) => p.vrsta === 'pribor' && p.objavljeno)).toHaveLength(4);
    expect(u.izdvojeno.polica).not.toContain(knjiga.sku);
    expect(uskladi(u)).toBe(u);
    // urednik smije knjigu ponovno objaviti: novi naziv vrste, pa se više ne dira
    const ponovno = structuredClone(u);
    ponovno.proizvodi.find((p: Kat) => p.sku === knjiga.sku).objavljeno = true;
    expect(uskladi(ponovno)).toBe(ponovno);
  });
});
