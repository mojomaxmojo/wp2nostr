# WordPress → Nostr Import (mojobus.org → mojobus.co)

Technische Dokumentation des Import-Flows.

## Architektur

```
src/modules/
├── parser/WordPressRestClient.ts   # REST-API Client für mojobus.org (Kategorien, Posts)
├── parser/WordPressParser.ts       # XML-Fallback-Parser (WordPressPost-Interface)
├── config/TargetCategories.ts      # mojobus.co-Zielkategorien (statisch, 1:1)
├── config/CategoryMapping.ts       # WP-Kategorie → Zielkategorie Defaults + Resolver
├── config/types.ts                 # ImportConfig + Defaults (relay.mojobus.co etc.)
├── config/ConfigManager.ts         # localStorage-Persistenz (.conf Export/Import)
├── converter/HTMLToMarkdown.ts     # Turndown + DOMParser-Bereinigung
├── uploader/BlossomUploader.ts     # nostrify BlossomUploader (Haupt + Backup)
├── uploader/MediaDownloader.ts     # Media-Download mit CORS-Proxy-Fallback
├── publisher/NostrPublisher.ts     # Kind-30023 Events im mojobus.co-Schema
└── import/ImportIndex.ts           # Dedup-Index (localStorage)
```

## mojobus.co-Kompatibilität (wichtig!)

mojobus.co liest **Kind 30023 (NIP-23)**, filtert nach **Autoren-Pubkeys** (mojo, susanne)
und kategorisiert über **t-Tags**. Der Code von mojobus.co wird NICHT verändert —
diese App repliziert nur sein Schema:

### Autoren (aus mojobus.co `src/config/relays.ts`)
| Autor | Pubkey |
|---|---|
| mojo (Max) | `4d584dab7c880a9809e7df0476d745bfe9a3fe91a1c062bc1fec024e0b5e1f1f` |
| susanne | `94ebd1c0940881de438b7f3c532b73e0d4d6c6b0160d3fe0b8a55fe49d477bd4` |

Artikel fremder Autoren erscheinen in den Artikellisten von mojobus.co **nicht**,
und `relay.mojobus.co` (Blossom) lehnt deren Uploads ab.

### Event-Tag-Schema (aus mojobus.co `useArticlePublish.ts`)
```
d:            article-{wpPostId}-{slug}   # stabil → Replaceable, kein Duplikat
type:         article  (bzw. 'place' bei Zielkategorie Plätze)
title:        <Titel>
summary:      <Auszug>
published_at: <Unix-Sekunden, Original-Datum>
image:        <Blossom-URL des Titelbildes>
slug:         <SEO-Slug>
url/r:        <Original-Link>
client:       wp2nostr
t:            Pflicht-Tags der Zielkategorie + Extra-Tags + WP-Tags
created_at:   Original-Veröffentlichungsdatum (chronologische Sortierung)
content:      Markdown (ReactMarkdown + GFM auf mojobus.co)
```

### Zielkategorien (aus mojobus.co `contentCategories.ts`)
| ID | Route | Pflicht-t-Tags |
|---|---|---|
| articles | /artikel | artikel, article, mojobus |
| rvlife | /artikel/rvlife | rvlife, artikel, article, mojobus |
| leon | /artikel/leon | leon, artikel, article, hund, dog, lion, dogo, mojobus |
| places | /plaetze | location, places, mojobus (+ type=place) |

## Infrastruktur
- **Publish-Relays:** wss://relay.mojobus.co, wss://relay.primal.net, wss://nos.lol
- **Blossom:** https://relay.mojobus.co (Haupt, nur mojo/susanne) + https://blossom.primal.net (Backup, immer zusätzlich)
- **Quelle:** https://mojobus.org/wp-json/wp/v2/ (offen, CORS-fähig; Fallback: CORS-Proxy)

## Flow der WPImportPage
1. **Kategorien laden** — `fetchWPCategories()` (paginiert, orderby=count)
2. **Zuordnen** — CategoryMapper UI, Defaults aus `CategoryMapping.ts`
   (Status + Bilder des Tages standardmäßig deaktiviert)
3. **Artikel laden** — `fetchWPPosts()` mit `_embed=wp:featuredmedia,wp:term,author`,
   Konvertierung zu Markdown, Dedup-Markierung über ImportIndex
4. **Medien hochladen** — Bilder + Titelbilder → Blossom, URLs im Markdown ersetzen
5. **Veröffentlichen** — Kind-30023 Events; Dry-Run-Modus erzeugt Events ohne zu senden;
   erfolgreich importierte Posts landen im ImportIndex (localStorage `wp2nostr:import-index`)

## Konfigurations-Migration
`loadConfig()` verwirft gespeicherte Configs ohne `sourceSite`/`corsProxy`
(altes Schema) und nutzt die neuen mojobus.co-Defaults.
