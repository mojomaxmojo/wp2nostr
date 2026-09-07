/**
 * Import-Index
 * Lokaler Index (localStorage) bereits importierter Artikel → Duplikat-Schutz.
 * Schlüssel: WordPress-Post-ID → d-Tag/Event/Naddr.
 */

const STORAGE_KEY = 'wp2nostr:import-index';

export interface ImportedArticle {
  wpPostId: string;
  wpTitle: string;
  dTag: string;
  eventId?: string;
  naddr?: string;
  slug?: string;
  targetCategoryId: string;
  subcategoryId?: string;
  publishedAt: number; // Unix-Sekunden (Original-Datum)
  importedAt: number; // Unix-Millisekunden
  dryRun: boolean;
}

export type ImportIndex = Record<string, ImportedArticle>;

/**
 * Lädt den Import-Index
 */
export function loadImportIndex(): ImportIndex {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as ImportIndex;
    }
  } catch (error) {
    console.error('Fehler beim Laden des Import-Index:', error);
  }
  return {};
}

/**
 * Speichert den Import-Index
 */
function saveIndex(index: ImportIndex): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(index));
  } catch (error) {
    console.error('Fehler beim Speichern des Import-Index:', error);
  }
}

/**
 * Prüft ob ein WordPress-Post bereits importiert wurde
 */
export function isImported(wpPostId: string): boolean {
  return Boolean(loadImportIndex()[wpPostId]);
}

/**
 * Markiert einen Artikel als importiert
 */
export function markImported(article: ImportedArticle): void {
  const index = loadImportIndex();
  index[article.wpPostId] = article;
  saveIndex(index);
}

/**
 * Entfernt einen Eintrag (z.B. zum erneuten Importieren)
 */
export function unmarkImported(wpPostId: string): void {
  const index = loadImportIndex();
  delete index[wpPostId];
  saveIndex(index);
}

/**
 * Setzt den Import-Index zurück (alle Artikel gelten als nicht importiert)
 */
export function clearImportIndex(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Statistiken über den Index
 */
export function importIndexStats(): { total: number; dryRuns: number } {
  const index = loadImportIndex();
  const entries = Object.values(index);
  return {
    total: entries.length,
    dryRuns: entries.filter(e => e.dryRun).length,
  };
}
