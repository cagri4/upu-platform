const NL_MARKDOWN = `# Dealerbeheer — Gebruikershandleiding

## Waarvoor dient het paneel?

Het dealerpaneel is het **commandocentrum van je distributeursbedrijf**. Beheer dealers, producten, bestellingen en facturen vanuit één scherm; laat de WhatsApp-assistent het routinewerk doen.

Doel: stoppen met telefonische bestellingen overtypen in Excel. Dealers bestellen vanuit hun eigen vitrine en het paneel houdt alles bij.

## Dealers beheren

Genereer een **dealer-uitnodiging** met de knop boven "Bayilerim" in de zijbalk. De link wordt via WhatsApp naar de dealer gestuurd; hij sluit zich aan met één tik.

- **Kredietlimiet** stel je in op de dealerkaart. Nieuwe orders worden automatisch geblokkeerd boven de limiet.
- **Betalingstermijn** in dagen (bv. 30/45/60) stel je in op het dealerprofiel.
- Een dealer deactiveer je met de "Actief"-toggle op zijn kaart.

## Producten toevoegen en bijwerken

Onder "Ürünlerim" voeg je **één voor één** toe of **importeer je via Excel**. Per product:

- Voorraadaantal, eenheid, btw
- Prijs per dealergroep (optioneel)
- Afbeelding + omschrijving

Bij voorraad 0 geeft het paneel een rode waarschuwing; in de vitrine verschijnt automatisch "Niet op voorraad".

## Voorraad en zichtbaarheid

Je kunt producten alleen voor bepaalde dealers tonen: productkaart > "Dealerzichtbaarheid" > selecteer dealers. Andere dealers zien het product niet in de vitrine.

**Voorraadreservering**: zodra een dealer iets in z'n winkelmandje legt daalt de voorraad tijdelijk (15 min). Wordt de order niet bevestigd, dan komt de voorraad terug. Twee dealers kunnen dezelfde eenheid niet tegelijk reserveren.

## Bestellingen verwerken

Stroom in "Siparişlerim": **Nieuw → Bevestigd → Onderweg → Geleverd**.

- Tik op een nieuwe order: dealer, regels, totaal, resterend krediet zijn zichtbaar.
- "Bevestigen" → voorraad daalt definitief + WA-melding naar de dealer.
- "Versturen" → track & trace invoeren, delen via WA.
- "Geleverd" → factuur wordt automatisch aangemaakt.

## Facturatie en betalingen

Wanneer een order "Geleverd" wordt is de **factuur automatisch**. Handmatig: knop "Fatura Aç".

Bij betaling van de dealer leg je deze vast via "Ödeme Kaydet"; de termijntabel wordt bijgewerkt. Met Mollie kan de dealer online betalen (kaart/iDEAL) — de betaling wordt automatisch geboekt en de factuur sluit.

## WhatsApp-meldingen

De dealer ontvangt voor elke gebeurtenis een automatische WA-bericht:

- Order bevestigd / verzonden / geleverd
- Factuur opgemaakt
- Termijnherinnering (D-3, D-1, D-0)
- Voorraadbericht

Schakel templates aan/uit via "Bildirimler". Alle Meta UTILITY-templates staan klaar in Nederlands/Turks/Engels.

## Kredietlimiet en betalingstermijn

Elke dealer heeft een **kredietlimiet** + **betalingstermijn in dagen**. Bij elke order:

- Som van openstaande facturen + nieuwe order moet onder de limiet blijven
- Bij overschrijding wordt de order **automatisch geblokkeerd** + de dealer krijgt een WA-waarschuwing

De herinneringscron draait **dagelijks om 09:00 (TR-tijd)**; D-3/D-1/D-0 gaan automatisch via WA.

## Rapporten

Onder "Raporlar":

- Omzet (dagelijks / wekelijks / maandelijks)
- Best verkopende producten
- Meest actieve dealers
- Openstaande betalingen
- Voorraadrotatie

Allemaal te downloaden als PDF of per e-mail.

## FAQ

**Dealer is z'n wachtwoord vergeten?** Hij stuurt "giriş" naar WA vanaf z'n telefoon; een eenmalige link komt binnen.

**Wanneer kan een nieuwe dealer geen order plaatsen?** Als de kredietlimiet overschreden is, het profiel niet goedgekeurd of het account inactief.

**Verkeerde factuur uitgereikt?** Tik "Annuleren" op de factuurkaart → er wordt een nieuwe aangemaakt. Is de Mollie-betaling al binnen, dan wordt de terugbetaling apart verwerkt.

**Werkt het op mobiel?** Ja, het paneel is responsive. Basishandelingen (order bevestigen, betaling vastleggen) gaan ook rechtstreeks via WhatsApp.

**Mist er iets of klopt iets niet?** Stuur "destek" via WA, we komen erop terug.
`;

export default NL_MARKDOWN;
