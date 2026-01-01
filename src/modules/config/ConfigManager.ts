/**
 * Konfigurationsmanagement
 * Speichert und lädt Konfigurationen aus .conf-Dateien
 */

import { DEFAULT_CONFIG, type ImportConfig } from './types';

const STORAGE_KEY = 'wp-nostr-import-config';

/**
 * Lädt die Konfiguration aus localStorage
 */
export function loadConfig(): ImportConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.error('Fehler beim Laden der Konfiguration:', error);
  }
  return { ...DEFAULT_CONFIG };
}

/**
 * Speichert die Konfiguration in localStorage
 */
export function saveConfig(config: ImportConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (error) {
    console.error('Fehler beim Speichern der Konfiguration:', error);
    throw error;
  }
}

/**
 * Setzt die Konfiguration auf Standardwerte zurück
 */
export function resetConfig(): void {
  localStorage.removeItem(STORAGE_KEY);
}

// Export DEFAULT_CONFIG für direkten Import
export { DEFAULT_CONFIG };

/**
 * Exportiert die Konfiguration als .conf Datei
 */
export function exportConfig(config: ImportConfig): string {
  const lines: string[] = [];

  lines.push('# WordPress zu Nostr Import Konfiguration');
  lines.push(`# Erstellt: ${new Date().toISOString()}`);
  lines.push('');

  // Blossom Server
  lines.push('[blossom_servers]');
  config.blossomServers.forEach(server => {
    lines.push(`${server.enabled ? 'enabled' : 'disabled'}=${server.url}`);
  });
  lines.push('');

  // Relays
  lines.push('[relays]');
  config.relays.forEach(relay => {
    const flags = [];
    if (relay.read) flags.push('read');
    if (relay.write) flags.push('write');
    lines.push(`${relay.enabled ? 'enabled' : 'disabled'}=${relay.url} [${flags.join(',')}]`);
  });
  lines.push('');

  // Posting Einstellungen
  lines.push('[posting]');
  lines.push(`poster_name=${config.posterName}`);
  lines.push(`poster_website=${config.posterWebsite}`);
  lines.push(`post_interval=${config.postInterval}`);
  lines.push('');

  // Tags
  lines.push('[tags]');
  lines.push(`global_tags=${config.globalTags.join(',')}`);
  lines.push(`preserve_categories=${config.preserveCategories}`);
  lines.push(`preserve_tags=${config.preserveTags}`);
  lines.push('');

  // Veröffentlichungsdatum
  lines.push('[publishing]');
  lines.push(`preserve_publish_date=${config.preservePublishDate}`);
  lines.push(`publish_delay=${config.publishDelay}`);
  lines.push('');

  // Media
  lines.push('[media]');
  lines.push(`upload_media=${config.uploadMedia}`);
  lines.push(`max_image_size=${config.maxImageSize}`);
  lines.push(`max_video_size=${config.maxVideoSize}`);
  lines.push('');

  // Inhalt
  lines.push('[content]');
  lines.push(`remove_wordpress_shortcodes=${config.removeWordPressShortcodes}`);
  lines.push(`convert_html_to_markdown=${config.convertHtmlToMarkdown}`);
  lines.push('');

  // Preview
  lines.push('[preview]');
  lines.push(`show_preview=${config.showPreview}`);
  lines.push(`require_confirmation=${config.requireConfirmation}`);

  return lines.join('\n');
}

/**
 * Importiert eine .conf Datei
 */
export function importConfig(confContent: string): Partial<ImportConfig> {
  const config: Partial<ImportConfig> = {};
  let currentSection = '';

  const lines = confContent.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Kommentare und leere Zeilen überspringen
    if (trimmed.startsWith('#') || trimmed === '') continue;

    // Sektion
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      currentSection = trimmed.slice(1, -1);
      continue;
    }

    // Key-Value Paare
    const [key, ...valueParts] = trimmed.split('=');
    if (!key || valueParts.length === 0) continue;

    const value = valueParts.join('=').trim();

    switch (currentSection) {
      case 'blossom_servers':
        if (!config.blossomServers) config.blossomServers = [];
        const enabled = key.startsWith('enabled');
        config.blossomServers.push({ url: value, enabled });
        break;

      case 'relays':
        if (!config.relays) config.relays = [];
        const relayEnabled = key.startsWith('enabled');
        const relayFlags = value.match(/\[(.*?)\]/)?.[1]?.split(',') || [];
        const relayUrl = value.replace(/\[.*?\]/, '').trim();
        config.relays.push({
          url: relayUrl,
          enabled: relayEnabled,
          read: relayFlags.includes('read'),
          write: relayFlags.includes('write'),
        });
        break;

      case 'posting':
        if (key === 'poster_name') config.posterName = value;
        if (key === 'poster_website') config.posterWebsite = value;
        if (key === 'post_interval') config.postInterval = parseInt(value);
        break;

      case 'tags':
        if (key === 'global_tags') config.globalTags = value.split(',').map(t => t.trim());
        if (key === 'preserve_categories') config.preserveCategories = value === 'true';
        if (key === 'preserve_tags') config.preserveTags = value === 'true';
        break;

      case 'publishing':
        if (key === 'preserve_publish_date') config.preservePublishDate = value === 'true';
        if (key === 'publish_delay') config.publishDelay = parseInt(value);
        break;

      case 'media':
        if (key === 'upload_media') config.uploadMedia = value === 'true';
        if (key === 'max_image_size') config.maxImageSize = parseInt(value);
        if (key === 'max_video_size') config.maxVideoSize = parseInt(value);
        break;

      case 'content':
        if (key === 'remove_wordpress_shortcodes') config.removeWordPressShortcodes = value === 'true';
        if (key === 'convert_html_to_markdown') config.convertHtmlToMarkdown = value === 'true';
        break;

      case 'preview':
        if (key === 'show_preview') config.showPreview = value === 'true';
        if (key === 'require_confirmation') config.requireConfirmation = value === 'true';
        break;
    }
  }

  return config;
}
