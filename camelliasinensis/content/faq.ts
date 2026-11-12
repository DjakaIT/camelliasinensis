// Česta pitanja na naslovnici (vidljivo i kao FAQPage JSON-LD). Odgovori o trgovini se slažu iz istih podataka koje
// koristi naplata (lib/shop/shipping.ts, content/site.ts), pa se ne mogu razići sa stvarnošću; odgovori o čaju su
// općepoznate činjenice (oksidacija, temperatura vode), bez obećanja koja trgovina nije potvrdila.
import { SHIPPING_METHODS } from '@/lib/shop/shipping';
import { contact, FREE_SHIPPING_FROM, FREE_SHIPPING_GIFT, hasContact, PAYMENT_METHODS, SHOP_NAME } from './site';

const eur = (cents: number) => `${(cents / 100).toFixed(2).replace('.', ',').replace(',00', '')} €`;
const nacini = SHIPPING_METHODS.map((m) => `${m.name.replace('GLS ', '')} (${eur(m.price)}, ${m.description.split(', ').pop()})`).join(' ili ');

export type FaqItem = { q: string; a: string };

export const FAQ: FaqItem[] = [
  {
    q: 'Gdje kupiti kvalitetan čaj u Zagrebu?',
    a:
      `${SHOP_NAME} je specijalizirana trgovina čaja u Zagrebu` +
      (hasContact() && contact.address ? ` (${contact.address.street}, ${contact.address.city})` : '') +
      ". Čajeve možete kupiti u trgovini ili online, s dostavom po cijeloj Hrvatskoj. U ponudi su rastresiti bijeli, zeleni, oolong, crni, pu'er, aromatizirani i biljni čajevi te pribor za pripremu.",
  },
  {
    q: 'Dostavljate li čaj po cijeloj Hrvatskoj i koliko košta dostava?',
    a: `Da. Šaljemo GLS-om na adresu ili u paketomat: ${nacini}. Za narudžbe od ${eur(FREE_SHIPPING_FROM)} dostava je besplatna, a uz narudžbu na poklon dobivate: ${FREE_SHIPPING_GIFT}.`,
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
    q: 'Kako pripremiti rastresiti čaj?',
    a:
      'Za šalicu od 250 ml uzmite 2–4 g lista. Bijeli i zeleni čaj prelijte vodom od 70 do 85 °C, oolong vodom od 85 do 95 °C, a crni čaj i pu’er gotovo kipućom vodom. Kvalitetan list možete preliti više puta. Točna temperatura, vrijeme i količina za svaki čaj navedeni su na stranici proizvoda.',
  },
  {
    q: 'Imaju li čajevi tein?',
    a: 'Imaju svi čajevi od biljke Camellia sinensis, u različitoj količini. Kod svakog čaja označena je razina teina (bez, malo, srednje, puno), pa lako nađete čaj za jutro ili večer. Biljni čajevi i rooibos su bez teina.',
  },
];
