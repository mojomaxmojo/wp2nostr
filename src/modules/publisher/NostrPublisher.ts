/**
 * Nostr Publisher
 * Veröffentlicht Long Form Articles (NIP-23, Kind 30023) auf Nostr —
 * kompatibel mit dem mojobus.co-Schema (type-Tag, Pflicht-t-Tags, published_at).
 */

import type { NostrEvent } from '@nostrify/nostrify';
import { nip19 } from 'nostr-tools';
import { getTargetCategory, getSubcategoryById, type TargetCategory } from '@/modules/config/TargetCategories';

export interface NostrRelay {
  url: string;
  enabled: boolean;
  read: boolean;
  write: boolean;
}

export interface ArticleData {
  title: string;
  content: string;
  summary?: string;
  image?: string;
  /** mojobus.co-Zielkategorie (bestimmt type-Tag + Pflicht-t-Tags) */
  targetCategoryId?: string;
  /** mojobus.co-Unterkategorie (ARTICLE_CATEGORIES-ID, z.B. 'rvlife-kueche-essen') */
  subcategoryId?: string;
  /** Stabiler d-Tag, z.B. article-{wpId}-{slug} — ersetzt Duplikate statt neue zu erstellen */
  dTag?: string;
  /** WordPress-Slug für den slug-Tag */
  slug?: string;
  url?: string; // URL des Original-Artikels
  publishedAt?: number; // Unix timestamp (Original-Veröffentlichungsdatum)
  /** Override für created_at (z.B. publishedAt+1s bei Re-Import, damit Relays das Update akzeptieren) */
  createdAt?: number;
  tags?: string[][]; // zusammengesetzte t-Tags etc.
}

export interface PublishProgress {
  total: number;
  completed: number;
  currentRelay: string;
  percentage: number;
  status: 'publishing' | 'completed' | 'failed';
}

export interface PublishResult {
  articleId: string; // d tag
  eventId: string;   // Event ID
  naddr?: string;    // NIP-19 Address-Referenz
  relays: {
    url: string;
    success: boolean;
    error?: string;
  }[];
  event: NostrEvent;
}

export interface PublishOptions {
  posterName: string;
  posterWebsite: string;
  relays: NostrRelay[];
  postInterval: number; // Millisekunden zwischen Posts
  preservePublishDate: boolean;
  /** Dry-Run: Event erzeugen, aber nicht signieren/senden */
  dryRun?: boolean;
}

/**
 * Generiert einen stabilen d-Tag aus WordPress-Daten.
 * Replaceable Events mit gleichem d-Tag ersetzen sich gegenseitig →
 * erneute Imports erzeugen keine Duplikate.
 */
export function buildDTag(wpPostId: string, slug?: string): string {
  const cleanSlug = (slug || '')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return cleanSlug ? `article-${wpPostId}-${cleanSlug}` : `article-${wpPostId}`;
}

/**
 * Slug für den slug-Tag (SEO-Slug wie bei mojobus.co)
 */
export function buildSlugTag(slug?: string, title?: string): string {
  const source = slug || title || '';
  return source
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

/**
 * Erstellt ein Long Form Article Event (NIP-23) im mojobus.co-Schema:
 *   d, type, title, summary, published_at, image, slug, client, r, t-...
 */
export function createArticleEvent(
  data: ArticleData,
  options: PublishOptions,
  pubkey: string
): NostrEvent {
  const articleId = data.dTag || buildDTag(data.url?.split('/').pop() || '', data.slug);
  const now = Math.floor(Date.now() / 1000);
  const publishedAt = data.publishedAt ?? now;

  // Zielkategorie bestimmen (default: articles)
  const target: TargetCategory = getTargetCategory(data.targetCategoryId || 'articles')
    || getTargetCategory('articles')!;

  const tags: string[][] = [
    ['d', articleId],
    ['type', target.typeTag],
    ['title', data.title],
    ['published_at', publishedAt.toString()],
    ['client', 'wp2nostr'],
  ];

  // Unterkategorie (mojobus.co-Untermenü): category-Tag + autoTags als t-Tags
  if (data.subcategoryId) {
    const sub = getSubcategoryById(data.subcategoryId);
    if (sub) {
      tags.push(['category', sub.id]);
      sub.autoTags.forEach(t => tags.push(['t', t]));
    }
  }

  if (data.summary) {
    tags.push(['summary', data.summary]);
  }

  if (data.image) {
    tags.push(['image', data.image]);
  }

  const slugTag = buildSlugTag(data.slug, data.title);
  if (slugTag) {
    tags.push(['slug', slugTag]);
  }

  if (data.url) {
    tags.push(['url', data.url]);
    tags.push(['r', data.url]);
  }

  // Pflicht-t-Tags der Zielkategorie + zusätzliche t-Tags
  if (data.tags && data.tags.length > 0) {
    tags.push(...data.tags);
  }

  // Deduplizierung der Tags (nach erstem Element + Wert)
  const seen = new Set<string>();
  const uniqueTags = tags.filter(tag => {
    const key = tag.join('\u0000');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // created_at = Original-Datum (chronologische Sortierung auf mojobus.co);
  // createdAt-Override (Re-Import: +1s) erzwingt zuverlässiges Relay-Update
  const createdAt = options.preservePublishDate
    ? (data.createdAt ?? publishedAt)
    : now;

  const event: NostrEvent = {
    kind: target.kind, // 30023
    content: data.content,
    created_at: createdAt,
    tags: uniqueTags,
    pubkey,
  };

  return event;
}

/**
 * Baut die t-Tags für einen Artikel:
 * Pflicht-Tags der Zielkategorie + Extra-Tags (Mapping) + globale Tags
 * (+ optional WP-Kategorien/Tags)
 */
export function buildArticleTags(params: {
  targetCategoryId: string;
  extraTags?: string[];
  globalTags?: string[];
  wpCategories?: string[];
  wpTags?: string[];
  preserveCategories?: boolean;
  preserveTags?: boolean;
}): string[][] {
  const target = getTargetCategory(params.targetCategoryId) || getTargetCategory('articles')!;

  const tagSet = new Set<string>();
  target.requiredTags.forEach(t => tagSet.add(t));
  (params.extraTags || []).forEach(t => t && tagSet.add(t));
  (params.globalTags || []).forEach(t => t && tagSet.add(t));

  if (params.preserveCategories) {
    (params.wpCategories || []).forEach(c => c && tagSet.add(normalizeTag(c)));
  }
  if (params.preserveTags) {
    (params.wpTags || []).forEach(t => t && tagSet.add(normalizeTag(t)));
  }

  return Array.from(tagSet).map(t => ['t', t]);
}

/**
 * Normalisiert einen Tag (kleingeschrieben, Umlaute → ASCII, Leerzeichen → Bindestrich)
 */
export function normalizeTag(tag: string): string {
  return tag
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Erzeugt eine NIP-19 naddr-Referenz für einen Artikel
 */
export function createNaddr(
  articleId: string,
  pubkey: string,
  kind: number = 30023,
  relays: string[] = []
): string {
  try {
    return nip19.naddrEncode({
      kind,
      pubkey,
      identifier: articleId,
      relays,
    });
  } catch (error) {
    console.error('naddr-Encoding fehlgeschlagen:', error);
    return '';
  }
}

/**
 * Signiert und veröffentlicht einen Artikel auf allen aktiven Write-Relays
 */
export async function publishArticle(
  data: ArticleData,
  options: PublishOptions,
  pubkey: string,
  sign: (event: NostrEvent) => Promise<NostrEvent>,
  publishToRelay: (relayUrl: string, event: NostrEvent) => Promise<boolean>,
  onProgress?: (progress: PublishProgress) => void
): Promise<PublishResult> {
  // Event erstellen (mojobus.co-Schema)
  const event = createArticleEvent(data, options, pubkey);

  // d-Tag extrahieren
  const articleId = event.tags.find(([name]) => name === 'd')?.[1] || '';

  // Dry-Run: Event nur erzeugen, nicht senden
  if (options.dryRun) {
    onProgress?.({
      total: 1,
      completed: 1,
      currentRelay: 'dry-run',
      percentage: 100,
      status: 'completed',
    });

    return {
      articleId,
      eventId: `dry-run-${articleId}`,
      relays: [{ url: 'dry-run', success: true }],
      event,
    };
  }

  // Event signieren
  const signedEvent = await sign(event);

  // Aktiviert write Relays filtern
  const activeRelays = options.relays.filter(r => r.enabled && r.write);

  if (activeRelays.length === 0) {
    throw new Error('Keine aktiven Write-Relays gefunden');
  }

  // Publish Progress initialisieren
  onProgress?.({
    total: activeRelays.length,
    completed: 0,
    currentRelay: '',
    percentage: 0,
    status: 'publishing',
  });

  const relayResults: PublishResult['relays'] = [];
  let completed = 0;

  // Parallel zu allen Relays publishen
  const publishPromises = activeRelays.map(async (relay) => {
    try {
      onProgress?.({
        total: activeRelays.length,
        completed,
        currentRelay: relay.url,
        percentage: Math.round((completed / activeRelays.length) * 100),
        status: 'publishing',
      });

      const success = await publishToRelay(relay.url, signedEvent);

      completed++;
      onProgress?.({
        total: activeRelays.length,
        completed,
        currentRelay: relay.url,
        percentage: Math.round((completed / activeRelays.length) * 100),
        status: success ? 'completed' : 'failed',
      });

      return {
        url: relay.url,
        success,
      };
    } catch (error) {
      completed++;
      const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
      console.error(`Publish zu ${relay.url} fehlgeschlagen:`, error);

      onProgress?.({
        total: activeRelays.length,
        completed,
        currentRelay: relay.url,
        percentage: Math.round((completed / activeRelays.length) * 100),
        status: 'failed',
      });

      return {
        url: relay.url,
        success: false,
        error: errorMessage,
      };
    }
  });

  relayResults.push(...await Promise.all(publishPromises));

  // Prüfen ob mindestens ein Relay erfolgreich war
  const successCount = relayResults.filter(r => r.success).length;

  // naddr nur bei Erfolg erzeugen
  const naddr = successCount > 0
    ? createNaddr(
        articleId,
        pubkey,
        signedEvent.kind,
        relayResults.filter(r => r.success).map(r => r.url)
      )
    : undefined;

  // Bei Totalversagen NICHT werfen — Ergebnis mit Fehlerdetails zurückgeben,
  // damit UI und Publish-Log die Ursache anzeigen können.
  return {
    articleId,
    eventId: signedEvent.id,
    naddr,
    relays: relayResults,
    event: signedEvent,
  };
}

/**
 * Veröffentlicht mehrere Artikel in Serie
 */
export async function publishArticles(
  articles: ArticleData[],
  options: PublishOptions,
  pubkey: string,
  sign: (event: NostrEvent) => Promise<NostrEvent>,
  publishToRelay: (relayUrl: string, event: NostrEvent) => Promise<boolean>,
  onProgress?: (progress: PublishProgress) => void
): Promise<PublishResult[]> {
  const results: PublishResult[] = [];
  const total = articles.length;
  let completed = 0;

  for (let i = 0; i < articles.length; i++) {
    onProgress?.({
      total,
      completed,
      currentRelay: '',
      percentage: Math.round((completed / total) * 100),
      status: 'publishing',
    });

    try {
      const result = await publishArticle(
        articles[i],
        options,
        pubkey,
        sign,
        publishToRelay,
        (articleProgress) => {
          onProgress?.({
            ...articleProgress,
            total,
            completed: completed + (articleProgress.percentage / 100),
            percentage: Math.round(((completed + articleProgress.percentage / 100) / total) * 100),
          });
        }
      );

      results.push(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Publish von Artikel "${articles[i].title}" fehlgeschlagen:`, error);
      // Fehler sichtbar machen (synthetisches Ergebnis), andere Artikel trotzdem versuchen
      results.push({
        articleId: articles[i].dTag || `failed-${i}`,
        eventId: '',
        relays: [{
          url: 'publish',
          success: false,
          error: errorMessage,
        }],
        event: {
          kind: 30023,
          content: '',
          created_at: 0,
          tags: [['d', articles[i].dTag || `failed-${i}`]],
          pubkey,
          id: '',
          sig: '',
        } as unknown as NostrEvent,
      });
    } finally {
      completed++;

      // Intervall zwischen Posts einhalten (auch nach Fehlern, außer beim
      // letzten Artikel / Dry-Run) — schont Relay-Rate-Limits
      if (i < articles.length - 1 && options.postInterval > 0 && !options.dryRun) {
        await new Promise(resolve => setTimeout(resolve, options.postInterval));
      }
    }
  }

  return results;
}

/**
 * Validiert Artikel Daten
 */
export function validateArticleData(data: ArticleData): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.title || data.title.trim().length === 0) {
    errors.push('Artikel-Titel fehlt');
  }

  if (!data.content || data.content.trim().length === 0) {
    errors.push('Artikel-Inhalt fehlt');
  }

  if (data.content.length > 100000) {
    errors.push('Artikel-Inhalt zu lang (Maximum: 100.000 Zeichen)');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
