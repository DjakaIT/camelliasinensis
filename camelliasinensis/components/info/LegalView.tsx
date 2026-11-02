import Link from 'next/link';
import type { LegalPage } from '@/content/site';
import { sanitizeDescription } from '@/lib/sanitize';

export function LegalView({ page, draft }: { page: LegalPage; draft: boolean }) {
  return (
    <section className="x-page">
      <div className="x-wrap">
        <nav aria-label="Putanja">
          <ol className="x-crumbs">
            <li>
              <Link href="/">Početna</Link>
            </li>
            <li>
              <span aria-current="page">{page.title}</span>
            </li>
          </ol>
        </nav>
        <h1 className="x-h1">{page.title}</h1>
        {draft && (
          <p className="x-note warn" style={{ margin: '20px 26px 0', maxWidth: 860 }}>
            Nacrt teksta za demo verziju. Konačni tekst priprema se s pravnikom prije otvaranja trgovine.
          </p>
        )}
        {/* Tekst dolazi iz content/site.ts (Sara/pravnik) i prolazi istu sanitizaciju kao opisi proizvoda. */}
        <div className="x-legal" style={{ marginLeft: 26 }} dangerouslySetInnerHTML={{ __html: sanitizeDescription(page.html ?? '') }} />
      </div>
    </section>
  );
}
