'use client';

import { useState } from 'react';

/** Google Maps se učitava tek nakon klika (GDPR, GUIDE §2). */
export function MapOnClick({ query }: { query: string }) {
  const [on, setOn] = useState(false);
  return (
    <div className={`x-map${on ? ' on' : ''}`}>
      {on ? (
        <iframe
          title={`Karta: ${query}`}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          src={`https://www.google.com/maps?q=${encodeURIComponent(query)}&z=16&output=embed`}
        />
      ) : (
        <div>
          <p className="x-small" style={{ marginBottom: 12 }}>
            Karta se učitava s Google Mapsa. Klikom pristajete na prijenos podataka Googleu.
          </p>
          <button type="button" className="x-btn" onClick={() => setOn(true)}>
            Prikaži kartu
          </button>
        </div>
      )}
    </div>
  );
}
