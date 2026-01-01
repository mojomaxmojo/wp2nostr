/**
 * Konfigurationstypen für WordPress zu Nostr Konverter
 */

export interface BlossomServerConfig {
  url: string;
  enabled: boolean;
}

export interface RelayConfig {
  url: string;
  enabled: boolean;
  read: boolean;
  write: boolean;
}

export interface ImportConfig {
  // Blossom Server
  blossomServers: BlossomServerConfig[];
  
  // Relays
  relays: RelayConfig[];
  
  // Posting Einstellungen
  posterName: string;
  posterWebsite: string;
  postInterval: number; // Sekunden zwischen Posts
  
  // Tag Einstellungen
  globalTags: string[];
  preserveCategories: boolean;
  preserveTags: boolean;
  
  // Veröffentlichungsdatum
  preservePublishDate: boolean;
  publishDelay: number; // Millisekunden
  
  // Media Einstellungen
  uploadMedia: boolean;
  maxImageSize: number; // in Bytes
  maxVideoSize: number; // in Bytes
  
  // Inhaltseinstellungen
  removeWordPressShortcodes: boolean;
  convertHtmlToMarkdown: boolean;
  
  // Preview Einstellungen
  showPreview: boolean;
  requireConfirmation: boolean;
}

export const DEFAULT_CONFIG: ImportConfig = {
  blossomServers: [
    { url: 'https://blossom.primal.net', enabled: true },
    { url: 'https://cdn.nostrcheck.me', enabled: true },
  ],
  relays: [
    { url: 'wss://nostr-01.yakihonne.com', enabled: true, read: true, write: true },
    { url: 'wss://relay.primal.net', enabled: true, read: true, write: true },
    { url: 'wss://relay.ditto.pub', enabled: true, read: true, write: true },
    { url: 'wss://relay.nostr.band', enabled: true, read: true, write: true },
    { url: 'wss://relay.damus.io', enabled: true, read: true, write: true },
    { url: 'wss://nos.lol', enabled: true, read: true, write: true },
  ],
  posterName: 'mojobus.cc',
  posterWebsite: 'http://mojobus.cc',
  postInterval: 2,
  globalTags: [],
  preserveCategories: true,
  preserveTags: true,
  preservePublishDate: true,
  publishDelay: 0,
  uploadMedia: true,
  maxImageSize: 10 * 1024 * 1024, // 10MB
  maxVideoSize: 100 * 1024 * 1024, // 100MB
  removeWordPressShortcodes: true,
  convertHtmlToMarkdown: true,
  showPreview: true,
  requireConfirmation: true,
};
