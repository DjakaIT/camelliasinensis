// HTML lažne stranice za plaćanje (FAKE pružatelj). Jasno označeno kao test; ne prikuplja nikakve podatke.
const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const eur = (cents) => `${(cents / 100).toFixed(2).replace('.', ',')}&nbsp;€`;

export function fakeCheckoutPage(order) {
  const body = !order
    ? '<h1>Narudžba nije pronađena</h1><p>Ova testna poveznica ne vrijedi ili je istekla.</p>'
    : `<span class="tag">TEST · mock-server</span>
<h1>Plaćanje (test)</h1>
<p class="small">Lažna stranica za plaćanje mock-servera. Ništa se ne naplaćuje, ne upisuju se kartica ni adresa.</p>
<table>${order.lines.map((l) => `<tr><td>${l.qty} × ${esc(l.name)}</td><td>${eur(l.lineTotal.amount)}</td></tr>`).join('')}
<tr class="tot"><td>Ukupno (bez dostave)</td><td>${eur(order.total.amount)}</td></tr></table>
<p>Status: <b data-testid="fake-status">${esc(order.status)}</b></p>
<div class="btns">
<form method="post" action="/fake-checkout/${esc(order.token)}/pay"><button ${order.status !== 'pending' ? 'disabled' : ''}>Plati (test)</button></form>
<form method="post" action="/fake-checkout/${esc(order.token)}/cancel"><button class="ghost">Odustani</button></form>
</div>`;
  return `<!doctype html><html lang="hr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Plaćanje (test)</title>
<style>body{margin:0;background:#F6F0E4;color:#272A20;font:16px/1.55 system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;padding:16px}
main{background:#fff;border:2px dashed #8A6D14;border-radius:28px;padding:40px;max-width:560px;width:100%}
h1{font-size:40px;letter-spacing:-.03em;margin:.3em 0}.tag{background:#272A20;color:#D4AF37;border-radius:14px;padding:5px 12px;font-size:12px;letter-spacing:.08em}
.small{color:#6B5E50;font-size:14px}table{width:100%;border-collapse:collapse;margin:16px 0}td{padding:8px 0;border-bottom:1px solid #eee}td+td{text-align:right}
.tot td{font-weight:700}.btns{display:flex;gap:10px;flex-wrap:wrap}button{height:52px;padding:0 24px;border-radius:26px;border:0;background:#272A20;color:#fff;font:inherit;cursor:pointer}
button.ghost{background:#F6F0E4;color:#272A20}button:disabled{opacity:.4}</style></head><body><main>${body}</main></body></html>`;
}
