import { describe, expect, it } from 'vitest';
import popis from '../../public/gls/paketomati.json';
import { type LockerRow, lockerFromRow, nearestLockers, searchLockers, validDelivery } from '@/lib/shop/shipping';

const svi = (popis.paketomati as LockerRow[]).map(lockerFromRow);

describe('GLS paketomati', () => {
  it('popis ima paketomate s ID-om, adresom i koordinatama u Hrvatskoj', () => {
    expect(svi.length).toBeGreaterThan(500);
    for (const l of svi) {
      expect(l.id).toMatch(/^[A-Za-z0-9-]{3,40}$/);
      expect(l.name && l.city).toBeTruthy();
      expect(l.lat).toBeGreaterThan(42);
      expect(l.lat).toBeLessThan(47);
    }
  });

  it('pretraga ne ovisi o kvačicama ni velikim slovima, sve riječi moraju se naći', () => {
    expect(searchLockers(svi, 'čakovec').length).toBeGreaterThan(0);
    expect(searchLockers(svi, 'CAKOVEC').map((l) => l.id)).toEqual(searchLockers(svi, 'čakovec').map((l) => l.id));
    expect(searchLockers(svi, 'zagreb ilica').every((l) => l.city === 'Zagreb' && /ilica/i.test(l.street))).toBe(true);
    expect(searchLockers(svi, '21000').every((l) => l.postalCode === '21000')).toBe(true);
    expect(searchLockers(svi, ' ')).toEqual([]);
  });

  it('najbliži paketomati su poredani po udaljenosti', () => {
    const r = nearestLockers(svi, { lat: 45.8131, lng: 15.9775 }, 5); // Trg bana Jelačića
    expect(r).toHaveLength(5);
    expect(r[0]!.city).toBe('Zagreb');
    expect(r[0]!.km).toBeLessThan(2);
    expect(r.map((l) => l.km)).toEqual([...r.map((l) => l.km)].sort((a, b) => a - b));
  });

  it('odabir dostave: samo poznat način, paketomat samo s ispravnim ID-om', () => {
    expect(validDelivery({ method: 'gls-adresa' })).toEqual({ method: 'gls-adresa' });
    expect(validDelivery({ method: 'gls-adresa', lockerId: 'X', price: 0 })).toEqual({ method: 'gls-adresa' });
    expect(validDelivery({ method: 'gls-paketomat', lockerId: 'HR10000-PLOCKER004' })).toEqual({ method: 'gls-paketomat', lockerId: 'HR10000-PLOCKER004' });
    expect(validDelivery({ method: 'gls-paketomat' })).toBeNull();
    expect(validDelivery({ method: 'gls-paketomat', lockerId: '<script>' })).toBeNull();
    expect(validDelivery({ method: 'dron' })).toBeNull();
    expect(validDelivery(null)).toBeNull();
  });
});
