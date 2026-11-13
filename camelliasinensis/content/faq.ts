// Česta pitanja na naslovnici (vidljivo i kao FAQPage JSON-LD). Odgovori o trgovini se slažu iz istih podataka koje
// koristi naplata i katalog (lib/shop/shipping.ts, content/site.ts, fixtures/products.json), pa se ne mogu razići sa
// stvarnošću. Odgovori o čaju (Daniel, 13. 11. 2026.) temelje se na provjerenim izvorima:
// - priprema: vrijednosti iz kataloga trgovine (priprema uz čajeve) i uobičajene smjernice (zeleni ne kipućom vodom,
//   za jači čaj više lista umjesto duljeg namakanja);
// - kofein: Oudry je 1827. iz čaja izdvojio "tein", a Mulder i Jobst su 1838. pokazali da je to kofein (en.wikipedia.org/wiki/Caffeine);
//   količine po šalici od ~240 ml: crni ~40–70 mg, zeleni ~20–45 mg, filter kava ~90–100 mg (Mayo Clinic, preneseno u više izvora);
// - organski: Uredba (EU) 2018/848 (bez sintetičkih pesticida i mineralnih gnojiva, nadzor certifikacijskog tijela, EU logo).
import products from '@/fixtures/products.json';
import { contact, FREE_SHIPPING_FROM, PAYMENT_METHODS } from './site';

const eur = (cents: number) => `${(cents / 100).toFixed(2).replace('.', ',').replace(',00', '')} €`;
const organskih = (products.products as { type: string; published: boolean; attributes: { badges?: string[] } }[]).filter(
  (p) => p.published && p.type !== 'pribor' && p.attributes.badges?.includes('bio'),
).length;
const a = contact.address;

export type FaqItem = { q: string; a: string };

export const FAQ: FaqItem[] = [
  {
    q: 'Kako se priprema čaj?',
    a:
      'Za šalicu od 250 ml uzmite 3 do 5 g lista, otprilike jednu punu žličicu, i prelijte ga vodom prave temperature. ' +
      'Bijeli čaj voli vodu od oko 85 °C i 3 do 4 minute, zeleni 70 do 80 °C i 2 do 3 minute (japanski zeleni hladniju vodu i kraće), ' +
      'oolong i crni čaj 95 °C i 3 do 4 minute, pu’er 95 °C i oko 4 minute, a biljni čajevi i rooibos kipuću vodu i 5 do 7 minuta. ' +
      'Zeleni čaj nikad ne prelijevajte kipućom vodom jer postaje gorak. Ako vam je čaj preslab, sljedeći put stavite više lista umjesto da ga duže namačete. ' +
      'Dobar list možete preliti i dva ili tri puta, a preporučenu pripremu za pojedini čaj naći ćete uz njega u katalogu.',
  },
  {
    q: 'Gdje se nalazimo?',
    a:
      (a ? `Naš dućan nalazi se na adresi ${a.street}, ${a.postalCode} ${a.city}, u samom centru grada. ` : '') +
      'Svratite po čaj ili po savjet. Ako niste u Zagrebu, čaj možete naručiti ovdje na stranici: šaljemo ga GLS-om na adresu ili u paketomat ' +
      `po cijeloj Hrvatskoj, a za narudžbe od ${eur(FREE_SHIPPING_FROM)} dostava je besplatna.`,
  },
  {
    q: 'Kako mogu platiti?',
    a: `Karticom (${PAYMENT_METHODS.filter((m) => !/Pay$/.test(m)).join(', ')}), Apple Payem ili Google Payem. Plaćanje obrađuje Stripe na zaštićenoj stranici; podatke o kartici ne vidimo i ne spremamo.`,
  },
  {
    q: 'Koja je razlika između bijelog, zelenog, oolong, crnog i pu’er čaja?',
    a:
      'Svi nastaju od iste biljke, Camellia sinensis, a razlikuju se po obradi lista. Bijeli čaj je najmanje obrađen (list se samo vene i suši), zeleni se ne oksidira, oolong je djelomično oksidiran, crni potpuno, a pu’er se nakon obrade fermentira i često odležava, ponekad godinama.',
  },
  {
    q: 'Imate li organske čajeve?',
    a:
      (organskih ? `Imamo, trenutno ${organskih} čajeva s ekološkim (organskim) certifikatom. ` : 'Imamo čajeve s ekološkim (organskim) certifikatom. ') +
      'To znači da su uzgojeni bez sintetičkih pesticida i umjetnih gnojiva, a uzgoj i preradu provjerava ovlašteno certifikacijsko tijelo, ' +
      'po pravilima Europske unije (Uredba (EU) 2018/848). Certificirane proizvode u EU-u prepoznajete po zelenom znaku lista od zvjezdica, ' +
      'a u našem katalogu po oznaci „Organski“ uz naziv čaja.',
  },
  {
    q: 'Imaju li čajevi kofein?',
    a:
      'Imaju, a tein je zapravo samo drugo ime za kofein. Francuski kemičar Oudry je 1827. iz čaja izdvojio tvar koju je nazvao teinom, ' +
      'a 1838. se pokazalo da je to ista molekula kao kofein iz kave. Šalica čaja ipak ga obično ima manje od šalice kave: crni čaj oko 40 do 70 mg, ' +
      'zeleni oko 20 do 45 mg, a filter kava oko 90 do 100 mg. Koliko ga je u vašoj šalici ovisi i o količini lista, temperaturi vode i duljini namakanja; ' +
      'matcha ga ima više jer pijete cijeli samljeveni list. Biljni čajevi i rooibos nisu od čajne biljke pa su prirodno bez kofeina. ' +
      'Razinu teina vidite uz svaki čaj, a na naslovnici možete birati čajeve po tome koliko vas trebaju razbuditi.',
  },
];
