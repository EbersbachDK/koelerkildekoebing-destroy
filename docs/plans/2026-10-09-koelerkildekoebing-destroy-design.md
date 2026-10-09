# Kølerkildekøbing Destroy – design

Dato: 2026-10-09. Inspiration: City Smash (by-ødelæggelses-sandbox). Søsterspil til Sænk Skibet.

## Beslutninger

| Emne | Valg |
|---|---|
| Forhold til Sænk Skibet | Selvstændigt spil, samme teknik (én HTML-fil, canvas, PWA, syntetisk lyd). Kan senere skiftes til rigtig 3D (Three.js) – derfor er data/regler holdt adskilt fra tegning |
| Visning | Både sidevisning og 3D-skrå, skift som i Sænk Skibet. Byen er 3D-celler (x, y, z), visningerne er to projektioner |
| Spilform | Fri leg med score + Top 10 pr. by/frø, **og** Missioner (24 stk, 1–3 stjerner) |
| Våben | Alt i første udgave: eksplosiver, natur, sci-fi, monstre |
| Liv | Biler/busser + tegneseriefigurer der flygter til evakueringspunkter. Ingen blod |
| Byer | Frø-genererede i 3 temaer (Storby, Havneby, Landsby) + Byg selv-designer |
| Navn | Kølerkildekøbing Destroy (mappe `koelerkildekoebing-destroy/`, app-id fx `dk.ebersbach.kkdestroy`) |
| Git | Venter – oprettes først når brugeren beder om det |

## Opbygning (lag)

1. **Data** – celle-grid (materiale, løs-flag, bygnings-id, farvetone), bygnings-skabeloner, temaer, våben, missioner. *Følger med ved 3D-skift.*
2. **Regler** – skade, score, evakuering, mission-mål. *Følger med.*
3. **Simulering** – struktur (sammenhæng + bæreevne pr. lag), faldende stykker (stive legemer med rotation om z), løst murbrokker (celle-automat), partikler.
4. **Visning** – side (forreste celle pr. x,y, dybde-skygge), 3D-skrå (fase 2), kamera.
5. **Skal** – menuer, knapper, app-visning, lyd, gemning, PWA.

### Celler

1 celle = 1 m. Materialer: grundfjeld (uforgængelig), jord, græs, asfalt, beton, glas, mursten, stål, træ. Hver har hårdhed (eksplosion), bæreevne (struktur), vægt og kr.-værdi (score).

### Sammenstyrtning

- Efter skade analyseres berørte bygninger: komponenter af faste celler (6-nabo). Hviler ingen celle på jord/løst materiale → komponenten bliver et faldende stykke.
- Bæreevne: for hvert lag y i en stående komponent: `styrke(y) · K < vægt over y` → laget knuses (støv + løse brokker), toppen falder.
- Faldende stykke: stivt legeme, tyngdekraft, rotation om z. Rammer det med høj fart, knuser det det underliggende (pandekage-kollaps). Støtte kun på den ene side af tyngdepunktet → vælter. Lander → celler sættes tilbage i grid (fast ved lav fart, løse brokker ved høj fart).
- Løse brokker falder som sand (ned, ellers skråt ned) og danner bunker.

## Byggeplan

1. Grundmotor: 3D-celler, Storby-generator med frø, sidevisning, kamera, sammenstyrtning, bombe + raket
2. 3D-skrå visning + skift
3. Eksplosiver (C4, boremaskine), score, Top 10, lyd
4. Figurer + biler, evakuering
5. Natur (jordskælv, lyn, ild, tornado, tsunami) + Havneby, Landsby
6. Sci-fi (laser, sort hul, meteor, UFO + joystick)
7. Monstre (gorilla, kaiju, tentakler)
8. Missioner (24) + stjerner
9. Byg selv-designer
10. PWA → GitHub Pages → Capacitor/Play Store

## Test

Headless Node-test `test/harness.js` (DOM-stubs som i Sænk Skibet): alle temaer × visninger × våben, tæller runtime-fejl; samme frø → samme by; missioner kan løses; gem/indlæs.

## Status (2026-10-09)

Alle 10 faser er bygget og testet (`node test/harness.js index.html` → 78 tjek, "ALT OK"):

1. Grundmotor ✔  2. 3D-skrå visning ✔  3. C4, boremaskine, Top 10, lyd ✔  4. Figurer, biler, busser, evakuering ✔
5. Natur + Havneby/Landsby ✔  6. Sci-fi (laser, sort hul, meteor, UFO) ✔  7. Monstre (gorilla, kaiju, tentakler) ✔
8. 24 missioner med stjerner – en automatisk løser i testen klarer alle ✔  9. Byg selv-designer ✔
10. PWA (manifest, service worker, ikoner, offline, kun på langs når installeret) ✔ – **GitHub Pages og Capacitor/Play Store mangler**: kræver brugerens ja til at oprette repo og offentliggøre.

Versionen sættes kun i `const APP_VERSION` i index.html (vises nederst i missionsmenuen og styrer service workerens cache). Ikoner: `py tools/make_icons.py`.
