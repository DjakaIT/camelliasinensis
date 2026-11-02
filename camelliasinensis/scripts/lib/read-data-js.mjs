// Čita design-reference/src/data.js (prototip, samo za čitanje) bez izvršavanja ičega osim same datoteke.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

export const DATA_JS = resolve('design-reference/src/data.js');

export function readDataJs(path = DATA_JS) {
  const code = readFileSync(path, 'utf8');
  // data.js deklarira konstante na vrhu; vraćamo samo ono što nam treba.
  return vm.runInNewContext(`${code}\n;({ TYPES, FLAV, MOODS, FORMS, BREW, RAW })`, Object.create(null), {
    filename: path,
    timeout: 1000,
  });
}

/** Isti algoritam koristi i test fixture: mala slova, bez dijakritika, samo [a-z0-9-]. */
export function slugify(name) {
  return name
    .replace(/[đĐ]/g, 'd')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
