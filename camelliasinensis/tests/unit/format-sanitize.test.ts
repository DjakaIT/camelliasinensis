import { describe, expect, it } from 'vitest';
import { formatDate, formatMoney, lastPieces } from '@/lib/format';
import { htmlToText, sanitizeDescription } from '@/lib/sanitize';

const NBSP = String.fromCharCode(160);

describe('formatMoney', () => {
  it.each([
    [1190, '11,90 €'],
    [0, '0,00 €'],
    [5, '0,05 €'],
    [123456, '1.234,56 €'],
  ])('%i centi → %s', (cents, out) => {
    expect(formatMoney(cents).replaceAll(NBSP, ' ')).toBe(out);
  });
  it('prima Money', () => expect(formatMoney({ amount: 3400, currency: 'EUR' })).toBe(`34,00${NBSP}€`));
  it('odbija decimalne iznose (novac je u centima)', () => expect(() => formatMoney(11.9)).toThrow());
});

describe('količine i datumi', () => {
  it('zadnji komadi', () => {
    expect(lastPieces(1)).toBe('Zadnji komad');
    expect(lastPieces(2)).toBe('Zadnja 2 komada');
  });
  it('datum 30. 10. 2026.', () => expect(formatDate(new Date(2026, 9, 30))).toBe('30. 10. 2026.'));
});

describe('sanitizeDescription', () => {
  it('uklanja <script>, on* atribute, javascript: URL-ove i <iframe>', () => {
    const dirty =
      '<p onclick="x()">Čaj<script>alert(1)</script></p><img src=x onerror="alert(1)"><a href="javascript:alert(1)">klik</a>' +
      '<iframe src="https://evil.example"></iframe><a href="https://ok.example">ok</a>';
    const clean = sanitizeDescription(dirty);
    expect(clean).not.toMatch(/script|onerror|onclick|javascript:|iframe|<img/i);
    expect(clean).toContain('<p>Čaj</p>');
    expect(clean).toContain('href="https://ok.example"');
    expect(clean).toContain('rel="noopener noreferrer nofollow"');
  });
  it('zadržava osnovno oblikovanje', () => {
    expect(sanitizeDescription('<p><strong>Jak</strong> i <em>svjež</em></p><ul><li>a</li></ul>')).toBe(
      '<p><strong>Jak</strong> i <em>svjež</em></p><ul><li>a</li></ul>',
    );
  });
  it('htmlToText', () => expect(htmlToText('<p>Bijeli &amp; zeleni</p>')).toBe('Bijeli & zeleni'));
});
