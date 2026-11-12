// Česta pitanja na naslovnici: kratki, samostalni odgovori (lako ih je citirati u tražilici i AI asistentima),
// isti tekst kao FAQPage JSON-LD (content/faq.ts).
import type { FaqItem } from '@/content/faq';

export function Faq({ items }: { items: FaqItem[] }) {
  return (
    <section className="x-faq" aria-labelledby="faq-h">
      <div className="sh rv">
        <h2 className="d" id="faq-h">
          Česta
          <br />
          <span className="g">pitanja.</span>
        </h2>
      </div>
      <div className="x-faq-list">
        {items.map((f) => (
          <details key={f.q}>
            <summary>
              <h3>{f.q}</h3>
            </summary>
            <p>{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
