/**
 * Nostr Publisher
 * Veröffentlicht Long Form Articles (NIP-23) auf Nostr
 */

import type { NostrEvent } from '@nostrify/nostrify';

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
  url?: string; // URL des Artikels
  publishedAt?: number; // Unix timestamp
  tags?: string[][];
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
}

/**
 * Generiert einen eindeutigen d-tag für Artikel
 */
function generateArticleId(): string {
  return `article-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Erstellt ein Long Form Article Event (NIP-23)
 */
export function createArticleEvent(
  data: ArticleData,
  options: PublishOptions,
  pubkey: string
): NostrEvent {
  const articleId = data.url?.split('/').pop() || generateArticleId();
  const now = Math.floor(Date.now() / 1000);
  const publishedAt = options.preservePublishDate && data.publishedAt 
    ? data.publishedAt 
    : now;

  const tags: string[][] = [
    ['d', articleId],
    ['title', data.title],
    ['published_at', publishedAt.toString()],
    ['client', 'mojobus.cc'],
  ];

  // Optionaler Summary
  if (data.summary) {
    tags.push(['summary', data.summary]);
  }

  // Optional Bild
  if (data.image) {
    tags.push(['image', data.image]);
  }

  // URL (wenn angegeben)
  if (data.url) {
    tags.push(['url', data.url]);
  }

  // Poster Info
  tags.push(['r', options.posterWebsite]);

  // Custom Tags
  if (data.tags) {
    tags.push(...data.tags);
  }

  const event: NostrEvent = {
    kind: 30023, // Long Form Article (NIP-23)
    content: data.content,
    created_at: publishedAt,
    tags,
    pubkey,
  };

  return event;
}

/**
 * Erstellt einen Parameterized Replaceable Event Handler für Long Form Articles
 */
export async function publishArticle(
  data: ArticleData,
  options: PublishOptions,
  pubkey: string,
  sign: (event: NostrEvent) => Promise<NostrEvent>,
  publishToRelay: (relayUrl: string, event: NostrEvent) => Promise<boolean>,
  onProgress?: (progress: PublishProgress) => void
): Promise<PublishResult> {
  // Event erstellen
  const event = createArticleEvent(data, options, pubkey);
  
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
  if (successCount === 0) {
    throw new Error('Publish zu allen Relays fehlgeschlagen');
  }

  // Article ID aus d-tag extrahieren
  const articleId = signedEvent.tags.find(([name]) => name === 'd')?.[1] || '';

  return {
    articleId,
    eventId: signedEvent.id,
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
      completed++;
      
      // Intervall zwischen Posts einhalten (außer beim letzten Artikel)
      if (i < articles.length - 1 && options.postInterval > 0) {
        await new Promise(resolve => setTimeout(resolve, options.postInterval));
      }
    } catch (error) {
      console.error(`Publish von Artikel "${articles[i].title}" fehlgeschlagen:`, error);
      // Andere Artikel trotzdem versuchen
    }
  }

  return results;
}

/**
 * Erstellt NIP-31 Alt Tag für Events
 */
export function createAltTag(description: string): string[] {
  return ['alt', description];
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

/**
 * Erstellt naddr für einen Artikel
 */
export function createNaddr(
  articleId: string,
  pubkey: string,
  kind: number = 30023,
  relays: string[] = []
): string {
  const data = {
    kind,
    pubkey,
    identifier: articleId,
    relays,
  };
  
  // In echtem Code müsste nip19.encode() verwendet werden
  return `naddr:${articleId}`;
}

/**
 * Generiert einen lesefreundlichen Permalink
 */
export function generatePermalink(
  articleId: string,
  title: string
): string {
  // Slug aus Titel erstellen
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
  
  return `${slug}-${articleId}`;
}
