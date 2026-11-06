# Jídelníčky WEB – audit historie a stav předání

6. 11. 2026. Podklad: jidelnicky-main(7).zip; SHA256 111c0e9983735af419fd6eec2a0d144e0d56dccfb6be786299a99d5e0d7be5de. Veřejný GitHub nebyl změněn.

## Co dokládá kontrola

Prověřeno všech 50 uložených týdnů od 29. 9. 2025 do 9. 11. 2026. Staženo 15 měsíčních odpovědí Strava.cz 5948 (září 2025 až listopad 2026). Měsíční historie dokládá 36 úplných týdnů; dva poslední doplňuje dříve ověřený aktuální archiv. U dalších sedmi týdnů je samostatně doloženo všech 27 dnů s jídlem. Pět týdnů nemá ve zdroji žádné menu.

**33 dnů bez menu není 33 nezávisle potvrzených uzavření jídelny.** Jejich původní příznak zavřeno zůstává beze změny; v UI je výslovně uvedeno Bez menu ve zdroji. Tyto dny nezískávají falešný definitivní doklad. Pokud je potřeba ověřit samotné uzavření, zbývá doložit provozní kalendář jídelny.

| Výsledek | Počet týdnů | Chování |
|---|---:|---|
| Úplný zdrojový týden Strava.cz | 38 | Definitivní, chráněný |
| Všechna zveřejněná jídla ověřena, další dny bez menu | 7 | Jídla chráněná, zavření bez falešného potvrzení |
| Celý týden bez menu ve zdroji | 5 | Původní zavření zachováno, lze opravit |
| Dosud neprověřeno | 0 | Žádný týden nebyl vynechán |

Ověřeno 216 dnů se skutečnými pokrmy. Definitivní katalog obsahuje 87 přesných názvů polévek a 168 hlavních jídel. Starý smíšený katalog byl rekonstruován, nikoli jen přeznačen. Původní úplná data jsou přibalená v podkladech; automatická migrace navíc ukládá předchozí stav. Zdrojové názvy včetně předpony Polévka, různých příloh a pravopisu se zachovávají. Organizační zápisy zůstávají v historii a nepatří do katalogu.

## Stav díla

| Oblast | Stav a hranice ověření |
|---|---|
| Audit uložené historie WEB | Provedeno všech 50 týdnů, přesné výjimky výše |
| Katalog a učení | Odvozeny z doložených skutečných jídel, bez nepoužitých návrhů a organizačních textů |
| Nový / opravený úplný zdrojový týden | Automaticky nahradí odpovídající návrh a upraví katalog se zálohou |
| Neúplný zdroj | Nepřepíše celý uložený týden; historický audit mění jen doložené dny, prázdné ponechá |
| Historie a ochrana jídla | Celé definitivní týdny i jídla v týdnech s chybějícím menu chráněny |
| Pracovní návrhy, restart, vlastní recepty | Oddělené od definitivní historie a uchovávané v úplném stavu |
| Kontrola pravidel / databáze | Vlastní trvalá okna, přesná kontrola a počty |
| GitHub a dvě zařízení | Testováno na simulovaném Contents API včetně SHA, 409 a souběhu; ostré ověření čeká na uživatelovo nahrání |
| Veřejný načítací workflow | Měsíční historie + aktuální menu, neúplnost nevymaže archiv; ostrý běh po nahrání nebyl proveden zde |
| Soukromý testovací odkaz | Má vlastní místní data a nikdy nečte GitHub klíč ani nezapisuje na produkční GitHub |
| Python aplikace | Tímto WEB balíčkem není změněna; jde o další samostatnou část projektu |

## Přesná mapa všech týdnů

| Týden od | Stav | Doložené dny s jídlem | Dny bez menu |
|---|---|---:|---|
| 2025-09-29 | Úplný Strava.cz | 5 | — |
| 2025-10-06 | Úplný Strava.cz | 5 | — |
| 2025-10-13 | Úplný Strava.cz | 5 | — |
| 2025-10-20 | Úplný Strava.cz | 5 | — |
| 2025-10-27 | Bez menu ve zdroji | 0 | 2025-10-27, 2025-10-28, 2025-10-29, 2025-10-30, 2025-10-31 |
| 2025-11-03 | Úplný Strava.cz | 5 | — |
| 2025-11-10 | Úplný Strava.cz | 5 | — |
| 2025-11-17 | Jídla Strava.cz, uzavření nedoloženo | 4 | 2025-11-17 |
| 2025-11-24 | Úplný Strava.cz | 5 | — |
| 2025-12-01 | Úplný Strava.cz | 5 | — |
| 2025-12-08 | Úplný Strava.cz | 5 | — |
| 2025-12-15 | Úplný Strava.cz | 5 | — |
| 2025-12-29 | Bez menu ve zdroji | 0 | 2025-12-29, 2025-12-30, 2025-12-31, 2026-01-01, 2026-01-02 |
| 2026-01-05 | Úplný Strava.cz | 5 | — |
| 2026-01-12 | Úplný Strava.cz | 5 | — |
| 2026-01-19 | Úplný Strava.cz | 5 | — |
| 2026-01-26 | Úplný Strava.cz | 4 | — |
| 2026-02-02 | Úplný Strava.cz | 5 | — |
| 2026-02-09 | Úplný Strava.cz | 5 | — |
| 2026-02-16 | Úplný Strava.cz | 5 | — |
| 2026-03-02 | Úplný Strava.cz | 5 | — |
| 2026-03-09 | Úplný Strava.cz | 5 | — |
| 2026-03-16 | Úplný Strava.cz | 5 | — |
| 2026-03-23 | Úplný Strava.cz | 5 | — |
| 2026-03-30 | Jídla Strava.cz, uzavření nedoloženo | 3 | 2026-04-02, 2026-04-03 |
| 2026-04-06 | Jídla Strava.cz, uzavření nedoloženo | 4 | 2026-04-06 |
| 2026-04-13 | Úplný Strava.cz | 5 | — |
| 2026-04-20 | Úplný Strava.cz | 5 | — |
| 2026-04-27 | Jídla Strava.cz, uzavření nedoloženo | 4 | 2026-05-01 |
| 2026-05-04 | Jídla Strava.cz, uzavření nedoloženo | 4 | 2026-05-08 |
| 2026-05-11 | Úplný Strava.cz | 5 | — |
| 2026-05-18 | Úplný Strava.cz | 5 | — |
| 2026-05-25 | Úplný Strava.cz | 5 | — |
| 2026-06-01 | Úplný Strava.cz | 5 | — |
| 2026-06-08 | Úplný Strava.cz | 5 | — |
| 2026-06-15 | Úplný Strava.cz | 5 | — |
| 2026-06-22 | Úplný Strava.cz | 5 | — |
| 2026-07-06 | Bez menu ve zdroji | 0 | 2026-07-06, 2026-07-07, 2026-07-08, 2026-07-09, 2026-07-10 |
| 2026-07-20 | Bez menu ve zdroji | 0 | 2026-07-20, 2026-07-21, 2026-07-22, 2026-07-23, 2026-07-24 |
| 2026-08-31 | Jídla Strava.cz, uzavření nedoloženo | 4 | 2026-08-31 |
| 2026-09-07 | Úplný Strava.cz | 5 | — |
| 2026-09-14 | Úplný Strava.cz | 5 | — |
| 2026-09-21 | Úplný Strava.cz | 5 | — |
| 2026-09-28 | Jídla Strava.cz, uzavření nedoloženo | 4 | 2026-09-28 |
| 2026-10-05 | Úplný Strava.cz | 5 | — |
| 2026-10-12 | Úplný Strava.cz | 5 | — |
| 2026-10-19 | Úplný Strava.cz | 5 | — |
| 2026-10-26 | Bez menu ve zdroji | 0 | 2026-10-26, 2026-10-27, 2026-10-28, 2026-10-29, 2026-10-30 |
| 2026-11-02 | Úplný Strava.cz | 5 | — |
| 2026-11-09 | Úplný Strava.cz | 5 | — |

## Kontrola konzistence

- all50WeeksPreserved: PROŠLO
- allPublishedMealDaysVerified: PROŠLO
- everyWeekInspected: PROŠLO
- noMenuDatesNotCalledVerifiedClosures: PROŠLO
- noMenuDatesUnchanged: PROŠLO
- catalogEqualsVerifiedServedMeals: PROŠLO
- noOrganizationalCatalogEntries: PROŠLO
- noExactDuplicates: PROŠLO
- stableSecondImport: PROŠLO

Zdrojové odpovědi, SHA256 a časy stažení jsou v source_months. Každý ověřený týden a každý auditovaný den má dohledatelný podklad. Podrobné rozdíly před/po a úplné názvy jsou v data-protocol.json.

## Původní názvy bez výskytu v dodané historii – soup

- hovězí rychlá s vejcem
- hrachová s opečenou houskou
- zeleninová s ovesnými vločkami
- zeleninová s těstovinovou
- zeleninový vývar s ovesnými vločkami
- Špenátová s vajíčkem

## Původní názvy bez výskytu v dodané historii – main

- Hrachová kaše s cibulkou, Párky
- Kapustové karbanátky, Bramborová kaše
- Karbanátek z rybího file - pečený, Brambory
- Karbanátky pečené, Bramborová kaše
- Králík pečený, Bramborové knedlíky (směs)
- Králík pečený, Brambory
- Kuřecí prsa na kari koření, Rýže dušená
- Kuřecí řízek smažený, Bramborová kaše
- Livance
- Losos přírodní, Brambory
- Masová směs "lamendr", Rýže dušená
- Mexická pánev (vepř.maso, fazole) se sýrem, Chléb
- Nudle s mákom
- Obalované filé s brokolicí a sýrem, Brambory
- Rizoto z vepřového masa
- Rybí file pečené na másle, Bramborová kaše
- Rybí filé obalované, Bramborová kaše
- Rybí filé obalované, Brambory
- Rybí filé smažené, Bramborová kaše
- Rybí stripsy, Brambory
- Sekaná pečeně, Bramborová kaše
- Sekaná pečeně, Brambory
- Sekaná zahradnická, Brambory
- Tilápie s rajčaty a sýrem, Brambory
- Vepřová pečeně selská, Bramborové knedlíky (směs)
- Vepřová pečeně selská, Karlovarský knedlík
- Vepřová pečeně selská, Nastavovaná kaše s cibulkou
- Vepřová roláda (karlovarský kotouč), Bramborová kaše
- Vepřový řízek přírodní, Brambory
- Zapečené těstoviny s uzeninou
- Zapečené těstoviny s uzeným masem
- Zapečené těstoviny s uzeným masem, Zelný salát - příloha
- Zeleninové placičky se sýrem, Brambory
- bulgur se zeleninou a kuřecím masem
- domažlické vepřové ragů, těstoviny
- dukátové buchtičky se šódo
- hovězí maso stroganoff, dušená rýže
- krůtí maso na pórku, rýže
- krůtí sekaná se sýrem, brambory, zeleninový salát míchaný, čistá voda
- kuřecí maso po provensálsku, farfalle
- kuřecí maso po čínsku, dušená rýže, ovoce
- kuřecí paličky na medu, bramborová kaše, čistá voda
- rybí filé s rajčaty, bazalkou, brambory
- těstoviny s lososem ve smetanové omáčce
- vepřová pečeně selská, bramborové knedlíky
- vepřové v mrkvi, brambor
- vepřový guláš, vřetena, čistá voda
- zeleninové rizoto sypané sýrem a parmazánem, ovocný sirup, čistá voda
- Čočka na kyselo, Vejce vařené
- řecký salát, vícezrnný rohlík
- Šoulet, Vepřová pečeně
- španělský ptáček, rýže
- štěpánská hovězí pečeně, houskové knedlíky, čistá voda

## Organizační zápisy

- 2026-01-26, den 5: P R Á Z D N I N Y — zachováno v historii, mimo katalog.
