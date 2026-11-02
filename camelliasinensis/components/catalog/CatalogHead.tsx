import Link from 'next/link';

export function CatalogHead({ title, sub, crumbs }: { title: string; sub: string; crumbs: { href?: string; label: string }[] }) {
  return (
    <section className="x-cathead">
      <div className="x-wrap">
        <nav aria-label="Putanja">
          <ol className="x-crumbs">
            {crumbs.map((c) => (
              <li key={c.label}>{c.href ? <Link href={c.href}>{c.label}</Link> : <span aria-current="page">{c.label}</span>}</li>
            ))}
          </ol>
        </nav>
        <div className="x-cathead-row">
          <h1 className="x-h1">{title}</h1>
          <p className="x-sub">{sub}</p>
        </div>
      </div>
    </section>
  );
}
