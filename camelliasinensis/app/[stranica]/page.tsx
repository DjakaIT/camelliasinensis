// Kontakt i pravne stranice: generiraju se SAMO kad je sadržaj potvrđen (content/site.ts).
// Bez potvrđenog sadržaja stranica ne postoji (404), a navigacija i podnožje je ne linkaju (START-PROMPT M7).
import { notFound } from 'next/navigation';
import { ContactView } from '@/components/info/ContactView';
import { LegalView } from '@/components/info/LegalView';
import { contact, hasContact, legalPage, publishedLegal } from '@/content/site';
import { isDemoBuild, isIndexable } from '@/lib/shop';
import { pageMeta } from '@/lib/seo';

export const dynamicParams = false;

type Props = { params: Promise<{ stranica: string }> };

export function generateStaticParams() {
  const slugs = [...(hasContact() ? ['kontakt'] : []), ...publishedLegal().map((p) => p.slug)];
  // Next u exportu ruši build za prazan popis; rezervna __nema se briše iz out/ u scripts/postbuild.mjs.
  return (slugs.length ? slugs : ['__nema']).map((stranica) => ({ stranica }));
}

export async function generateMetadata({ params }: Props) {
  const { stranica } = await params;
  if (stranica === 'kontakt' && hasContact()) {
    return pageMeta({ title: 'Kontakt', description: 'Kontakt trgovine čaja Camellia sinensis u Zagrebu.', path: '/kontakt/' });
  }
  const p = legalPage(stranica);
  if (p) return pageMeta({ title: p.title, description: p.description, path: `/${p.slug}/` });
  return { title: 'Stranica nije pronađena', robots: { index: false, follow: false } };
}

export default async function InfoPage({ params }: Props) {
  const { stranica } = await params;
  if (stranica === 'kontakt' && hasContact()) return <ContactView contact={contact} demo={isDemoBuild()} />;
  const p = legalPage(stranica);
  if (p) return <LegalView page={p} draft={!isIndexable()} />;
  notFound();
}
