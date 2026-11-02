# POS-PITANJA.md — što treba saznati o blagajni

Cilj: odlučiti kako web shop (WooCommerce) i fizička blagajna (POS) razmjenjuju artikle, zalihe i narudžbe. Dok nema odgovora, vrijedi razina 0 iz STACK.md §8.4 (bez integracije, sa zaštitnom rezervom zalihe).

Stanje 2.11.2026.: Sara koristi ili razmatra **Thor** (Monri Payments) i spomenula je još jedan, noviji POS. Javno dostupni materijali o Thoru **ne opisuju** web shop integraciju ni API (STACK §8.1).

## A. Pitanja za Saru

1. Koji se POS trenutno koristi u trgovini, a koji je "noviji"? Točni nazivi, verzije, tko ih je instalirao i tko ih održava (distributer, kontakt).
2. Koji POS planira koristiti dugoročno? Hoće li se oba koristiti istodobno?
3. Je li POS instaliran lokalno (Windows računalo) ili je u oblaku? Je li računalo stalno spojeno na internet?
4. Što POS danas radi za nju: samo naplata i fiskalizacija, ili i stanje zaliha, narudžbe dobavljačima, inventura?
5. Koje šifre artikala koristi u POS-u? Isti kod kao dobavljačeva šifra (npr. `CSTB-2`), vlastiti kod ili barkod/EAN? Imaju li svi artikli barkod?
6. Je li zaliha u POS-u točna i ažurna? Tko je održava?
7. Želi li da se zaliha **sama** dijeli između dućana i weba, ili joj je dovoljno da je ručno usklađuje (npr. jednom dnevno ili tjedno)?
8. Koliko komada po artiklu obično ima? Koliko je prodaje u dućanu u odnosu na očekivanu web prodaju? (Odlučuje koliko je opasna dvostruka prodaja zadnjeg komada.)
9. Tko izdaje račune za web narudžbe: POS, ili zasebna aplikacija za račune? Što kaže knjigovođa?
10. Je li u sustavu PDV-a / OSS?
11. Ima li POS ugovor o održavanju ili licencu koja se plaća po funkciji (npr. za API)?

## B. Pitanja za dobavljača POS-a (Monri / distributer Thora, i dobavljač drugog POS-a)

Pošalji **iste** upitnike za svaki sustav, i zapiši datum i ime osobe koja je odgovorila.

1. Postoji li **modul ili usluga za povezivanje s web shopom** (e-commerce) i radi li s WooCommerceom? Cijena i uvjeti?
2. Postoji li **javni ili partnerski API** (REST, SOAP, drugo)? Dokumentacija, primjeri, autentikacija, ograničenja broja zahtjeva, testno okruženje?
3. Postoji li **izvoz i uvoz artikala i zaliha u datoteke** (CSV, XML, Excel)? Točan format, kodiranje (UTF-8?), raspored stupaca, može li se izvoz zakazati i spremati u mapu ili na SFTP?
4. Može li se **narudžba s weba unijeti u POS** (kao dokument izlaza robe/otpremnica) bez izdavanja drugog fiskalnog računa? Kojim putem (API, datoteka, ručno)?
5. Može li POS izdavati **fiskalizirane račune za web narudžbe** (i ZKI/JIR/QR) i slati ih kupcu e-poštom? Kako se to automatizira?
6. Postoje li **webhooks ili obavijesti** o promjeni zalihe ili prodaji?
7. Radi li sve to i kad POS nema interneta (naknadna fiskalizacija)? Što se događa s kašnjenjem podataka?
8. Postoji li već nekakva povezanost s drugim webshopima kod njihovih klijenata (referenca) i s kojim platformama?
9. Tko će nam dati tehničku podršku pri povezivanju i koliko to košta?

## C. Što radimo s odgovorima

| Odgovor | Razina (STACK §8.4) | Što Daniel radi |
| --- | --- | --- |
| Nema ni API-ja ni izvoza | 0 | Ručni proces, zaštitna rezerva zalihe, dogovor s Sarom o učestalosti usklađivanja |
| Postoji izvoz/uvoz datoteka | 1 | Napisati CSV/SFTP adapter u `cs-pos-bridge`; dogovoriti format s dobavljačem |
| Postoji dokumentiran API | 2 | Napisati API adapter; testirati na kopiji podataka, ne na živoj blagajni |
| POS se povezuje s aplikacijom za račune | 3 | Odabrati tu aplikaciju za račune i njezin Woo dodatak |

Odluke zapiši u STACK.md §11 (otvorene odluke) i ažuriraj §8.
