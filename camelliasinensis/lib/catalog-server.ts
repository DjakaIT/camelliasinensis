// Pomoćnici za Server Components: katalog iz builda u obliku za kartice.
import { toCard, type CardProduct } from './catalog-view';
import { htmlToText } from './sanitize';
import { getCatalog } from './shop/catalog';

export async function getCards(): Promise<CardProduct[]> {
  const { products, types } = await getCatalog();
  const names = Object.fromEntries(types.map((t) => [t.key, t.name]));
  return products.map((p) => toCard(p, names[p.type] ?? p.type, htmlToText(p.descriptionHtml)));
}
