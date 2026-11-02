import Link from 'next/link';

export const metadata = {
  title: 'Stranica nije pronađena',
  description: 'Tražena stranica ne postoji. Pogledajte katalog čaja i pribora.',
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <section className="x-done x-404">
      <div className="x-wrap x-narrow">
        <p className="big" aria-hidden="true">
          404
        </p>
        <h1 className="x-h2">Ova stranica ne postoji</h1>
        <p>Možda je adresa pogrešno upisana ili je stranica premještena.</p>
        <div className="x-donebtns">
          <Link href="/katalog/" className="x-btn">
            Pogledaj katalog
          </Link>
          <Link href="/" className="x-btn x-ghost">
            Na početnu
          </Link>
        </div>
      </div>
    </section>
  );
}
