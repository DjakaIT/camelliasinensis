// Hrvatski nazivi ključeva atributa (preuzeto iz design-reference/src/data.js).
import type { ProductType } from './shop/types';

export const FLAVORS: Record<string, string> = {
  cvjetni: 'Cvjetni',
  vocni: 'Voćni',
  travnati: 'Travnati',
  orasasti: 'Orašasti',
  slatkasti: 'Slatkasti',
  zemljani: 'Zemljani',
  dimljeni: 'Dimljeni',
  zacinski: 'Začinski',
  citrusni: 'Citrusni',
  sladni: 'Sladni',
  mentolni: 'Mentolni',
  drvenasti: 'Drvenasti',
  medeni: 'Medeni',
};

export const MOODS: Record<string, string> = {
  jutro: 'Za jutro',
  fokus: 'Za fokus',
  opust: 'Za opuštanje',
  vecer: 'Za večer',
  poklon: 'Za poklon',
};

/** Kratki nazivi za gumbe na polici naslovnice (iz prototipa). */
export const MOODS_SHORT: [string, string][] = [
  ['sve', 'Sve'],
  ['jutro', 'Budno'],
  ['fokus', 'Fokus'],
  ['opust', 'Opušteno'],
  ['vecer', 'Večer'],
  ['poklon', 'Za poklon'],
];

export const FORMS: Record<string, string> = {
  rastresiti: 'Rastresiti listovi',
  kolac: 'Prešani kolač',
  prah: 'Prah (matcha)',
  pribor: 'Pribor',
};

/** Razine teina (u čaju se govori o teinu; u podacima je to atribut `caffeine`, API-CONTRACT §2). */
export const CAFFEINE = ['Bez teina', 'Malo teina', 'Srednje teina', 'Puno teina'] as const;
export const CAFFEINE_SHORT = ['Bez teina', 'Malo', 'Srednje', 'Puno'] as const;

export const BADGES: Record<string, string> = { bio: 'Organski', rijetko: 'Rijetko', novo: 'Novo' };

export const typeColor = (t: ProductType) => `var(--t-${t})`;
export const isDarkType = (t: ProductType) => t === 'puer';
