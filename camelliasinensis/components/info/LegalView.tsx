import Link from 'next/link';
import type { LegalPage } from '@/content/site';
import { sanitizeDescription } from '@/lib/sanitize';

export function LegalView({ page }: { page: LegalPage }) {
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
        {/* Tekst dolazi iz content/site.ts (Sara/pravnik) i prolazi istu sanitizaciju kao opisi proizvoda. */}
        <div className="x-legal" dangerouslySetInnerHTML={{ __html: sanitizeDescription(page.html ?? '') }} />
      </div>
    </section>
  );
}
