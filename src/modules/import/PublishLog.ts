/**
 * Publish-Log
 * Persistenter Log (localStorage) aller veröffentlichten Events —
 * inkl. mojobus.co-URL (naddr), Relay-Status und Tags.
 */

const STORAGE_KEY = 'wp2nostr:publish-log';
const MAX_ENTRIES = 2000;

export interface PublishLogEntry {
  /** Zeitstempel des Log-Eintrags (ms) */
  ts: number;
  wpPostId?: string;
  title: string;
  dTag: string;
  eventId?: string;
  naddr?: string;
  targetCategoryId?: string;
  subcategoryId?: string;
  /** Original-Veröffentlichungsdatum (Unix s) */
  publishedAt?: number;
  /** created_at des Events (Unix s) */
  createdAt?: number;
  dryRun: boolean;
  relays: { url: string; success: boolean; error?: string }[];
  /** t-Tags des Events (zum Debuggen der mojobus.co-Filter) */
  tTags: string[];
  /** category-Tag (Unterkategorie) */
  category?: string;
}

/**
 * Lädt den Publish-Log (neueste zuerst)
 */
export function loadPublishLog(): PublishLogEntry[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const entries = JSON.parse(stored) as PublishLogEntry[];
      return entries.sort((a, b) => b.ts - a.ts);
    }
  } catch (error) {
    console.error('Fehler beim Laden des Publish-Logs:', error);
  }
  return [];
}

/**
 * Hängt Einträge an den Log an (älteste bleiben hinten, Maximalgrenze)
 */
export function addLogEntries(entries: PublishLogEntry[]): void {
  if (entries.length === 0) return;
  try {
    const existing = loadPublishLog(); // newest first
    const merged = [...entries, ...existing].slice(0, MAX_ENTRIES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch (error) {
    console.error('Fehler beim Schreiben des Publish-Logs:', error);
  }
}

/**
 * Löscht den gesamten Log
 */
export function clearPublishLog(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * mojobus.co-URL für einen Log-Eintrag
 */
export function mojobusUrlFor(entry: PublishLogEntry): string | undefined {
  return entry.naddr ? `https://mojobus.co/${entry.naddr}` : undefined;
}

/**
 * Log als lesbarer Text (zum Download/Archivieren)
 */
export function exportLogAsText(entries?: PublishLogEntry[]): string {
  const list = entries ?? loadPublishLog();
  const lines: string[] = [
    `# wp2nostr Publish-Log`,
    `# Exportiert: ${new Date().toISOString()}`,
    `# Einträge: ${list.length}`,
    '',
  ];

  for (const e of list) {
    const date = new Date(e.ts).toISOString();
    const pub = e.publishedAt ? new Date(e.publishedAt * 1000).toISOString().slice(0, 10) : '?';
    const relays = e.relays.map(r => `${r.url}${r.success ? ' ✓' : ' ✗'}`).join(', ');
    lines.push(`[${date}] ${e.dryRun ? '[DRY-RUN] ' : ''}${e.title}`);
    lines.push(`  WP-ID: ${e.wpPostId || '?'} · Original: ${pub} · Ziel: ${e.targetCategoryId || '?'}${e.subcategoryId ? ` / ${e.subcategoryId}` : ''}`);
    lines.push(`  d-Tag: ${e.dTag}`);
    if (e.naddr) lines.push(`  mojobus.co: https://mojobus.co/${e.naddr}`);
    if (e.eventId && !e.dryRun) lines.push(`  Event-ID: ${e.eventId}`);
    lines.push(`  Relays: ${relays || '-'}`);
    if (e.tTags.length > 0) lines.push(`  Tags: ${e.tTags.map(t => '#' + t).join(' ')}`);
    lines.push('');
  }

  return lines.join('\n');
}
