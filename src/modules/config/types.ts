/**
 * Konfigurationstypen für WordPress zu Nostr Konverter
 * Ziel: mojobus.co-kompatible NIP-23 Artikel (Kind 30023)
 *
 * Die Ziel-Kategorien und Pflicht-Tags entsprechen 1:1 der Kategorie-Struktur
 * von mojobus.co (siehe modules/config/TargetCategories.ts) — der Code von
 * mojobus.co selbst wird NICHT verändert.
 */

export interface BlossomServerConfig {
  url: string;
  enabled: boolean;
  /** Backup-Server: wird immer zusätzlich hochgeladen (nicht blockierend) */
  backup?: boolean;
}

export interface RelayConfig {
  url: string;
  enabled: boolean;
  read: boolean;
  write: boolean;
}

/**
 * Mapping einer WordPress-Kategorie auf eine mojobus.co-Zielkategorie
 */
export interface CategoryMapping {
  /** ID der WP-Kategorie */
  wpCategoryId: string;
  /** Slug der WP-Kategorie (für Default-Mapping) */
  wpCategorySlug: string;
  /** ID der mojobus.co-Zielkategorie */
  targetId: string;
  /** mojobus.co-Unterkategorie (ARTICLE_CATEGORIES-ID, optional) */
  subcategoryId?: string;
  /** Zusätzliche optionale t-Tags */
  extraTags: string[];
  /** Kategorie beim Import berücksichtigen? */
  enabled: boolean;
}

export interface ImportConfig {
  // Quelle (WordPress)
  sourceSite: string; // z.B. https://mojobus.org

  // Ziel (mojobus.co Schema)
  /** Standard-Zielkategorie, falls keine Zuordnung existiert */
  defaultTargetCategory: string;
  /** WP-Kategorie → mojobus.co-Zielkategorie */
  categoryMapping: CategoryMapping[];

  // Blossom Server (mojobus.co-Standard: relay.mojobus.co + primal Backup)
  blossomServers: BlossomServerConfig[];

  // Relays (mojobus.co-Publish-Preset)
  relays: RelayConfig[];

  // Posting Einstellungen
  posterName: string;
  posterWebsite: string;
  postInterval: number; // Sekunden zwischen Posts

  // Tag Einstellungen
  globalTags: string[];
  /** WordPress-Kategorienamen als t-Tags übernehmen (zusätzlich) */
  preserveCategories: boolean;
  /** WordPress-Tags als t-Tags übernehmen (zusätzlich) */
  preserveTags: boolean;

  // Veröffentlichungsdatum
  /** created_at = Original-Datum (chronologische Sortierung auf mojobus.co) */
  preservePublishDate: boolean;
  publishDelay: number; // Millisekunden

  // Media Einstellungen
  uploadMedia: boolean;
  maxImageSize: number; // in Bytes
  maxVideoSize: number; // in Bytes

  // Inhaltseinstellungen
  removeWordPressShortcodes: boolean;
  convertHtmlToMarkdown: boolean;

  // Import-Verhalten
  /** Dry-Run: Events erzeugen aber nicht senden (keine Signatur nötig) */
  dryRun: boolean;
  /** Bereits importierte Artikel überspringen */
  skipImported: boolean;
  /** Teaser-Note (Kind 1) nach jedem Artikel veröffentlichen */
  teaserNote: boolean;
  /** CORS-Proxy Template mit {href} für Media-Downloads */
  corsProxy: string;

  // Preview Einstellungen
  showPreview: boolean;
  requireConfirmation: boolean;
}

export const DEFAULT_CONFIG: ImportConfig = {
  sourceSite: 'https://mojobus.org',

  defaultTargetCategory: 'articles',
  categoryMapping: [], // wird beim Laden der Kategorien aus DEFAULT_CATEGORY_MAPPING befüllt

  // mojobus.co-Standard: eigenes Relay als Blossom (nur mojo/susanne), primal als Backup
  blossomServers: [
    { url: 'https://relay.mojobus.co', enabled: true, backup: false },
    { url: 'https://blossom.primal.net', enabled: true, backup: true },
  ],

  // mojobus.co Publish-Relays
  relays: [
    { url: 'wss://relay.mojobus.co', enabled: true, read: true, write: true },
    { url: 'wss://relay.primal.net', enabled: true, read: true, write: true },
    { url: 'wss://nos.lol', enabled: true, read: true, write: true },
  ],

  posterName: 'mojobus.co',
  posterWebsite: 'https://mojobus.co',
  postInterval: 2,
  globalTags: [],
  preserveCategories: false,
  preserveTags: true,
  preservePublishDate: true,
  publishDelay: 0,
  uploadMedia: true,
  maxImageSize: 10 * 1024 * 1024, // 10MB
  maxVideoSize: 100 * 1024 * 1024, // 100MB
  removeWordPressShortcodes: true,
  convertHtmlToMarkdown: true,

  dryRun: false,
  skipImported: true,
  teaserNote: false,
  corsProxy: 'https://proxy.shakespeare.diy/?url={href}',

  showPreview: true,
  requireConfirmation: true,
};
