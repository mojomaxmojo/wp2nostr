/**
 * WordPress REST API Client
 * Lädt Kategorien, Tags und Beiträge direkt von der WordPress-REST-API
 * (z.B. https://mojobus.org/wp-json/wp/v2/) — kein Export-XML nötig.
 *
 * Die Ergebnisse werden in die bestehende WordPressPost-Struktur konvertiert,
 * damit Konverter und Publisher unverändert funktionieren.
 */

import type { WordPressPost } from './WordPressParser';

// ============================================================================
// Typen (WP REST API)
// ============================================================================

export interface WPCategory {
  id: number;
  name: string;
  slug: string;
  count: number;
  parent: number;
  description?: string;
}

export interface WPTag {
  id: number;
  name: string;
  slug: string;
  count: number;
}

interface WPRestTerm {
  id: number;
  name: string;
  slug: string;
  taxonomy: string;
}

interface WPRestMedia {
  id: number;
  source_url: string;
  media_type?: string;
  mime_type?: string;
  alt_text?: string;
  title?: { rendered?: string };
  caption?: { rendered?: string };
}

interface WPRestAuthor {
  id: number;
  name: string;
}

interface WPRestPost {
  id: number;
  date_gmt: string;
  modified_gmt: string;
  slug: string;
  status: string;
  link: string;
  guid?: { rendered?: string };
  title: { rendered: string };
  content: { rendered: string };
  excerpt: { rendered: string };
  categories?: number[];
  tags?: number[];
  _embedded?: {
    author?: WPRestAuthor[];
    'wp:featuredmedia'?: WPRestMedia[];
    'wp:term'?: WPRestTerm[][];
  };
}

export interface FetchPostsOptions {
  site: string;
  /** WP-Kategorie-IDs, auf die gefiltert wird */
  categoryIds?: string[];
  perPage?: number;
  maxPosts?: number;
  corsProxy?: string;
  onProgress?: (loaded: number, total: number) => void;
  signal?: AbortSignal;
}

export interface FetchPostsResult {
  posts: WordPressPost[];
  total: number;
}

// ============================================================================
// Hilfsfunktionen
// ============================================================================

/**
 * HTML-Entities dekodieren (WP REST liefert z.B. "&#8230;" im Titel)
 */
export function decodeHtmlEntities(text: string): string {
  if (!text) return '';
  const doc = new DOMParser().parseFromString(text, 'text/html');
  return doc.documentElement.textContent?.trim() || '';
}

/**
 * HTML-Tags entfernen
 */
export function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function joinUrl(site: string, path: string): string {
  const base = site.replace(/\/+$/, '');
  return `${base}/wp-json/wp/v2/${path}`;
}

/**
 * Fetch mit CORS-Proxy-Fallback:
 * 1. Direkter Request (WP REST API erlaubt CORS für GET)
 * 2. Bei Netzwerk-/CORS-Fehlern: Request über den CORS-Proxy
 */
async function fetchWithFallback(url: string, corsProxy?: string, signal?: AbortSignal): Promise<Response> {
  try {
    const response = await fetch(url, { signal });
    return response;
  } catch (error) {
    if (signal?.aborted) throw error;
    if (!corsProxy) throw error;
    console.warn(`Direkter Fetch fehlgeschlagen (${url}), versuche CORS-Proxy:`, error);
    const proxied = corsProxy.replace('{href}', encodeURIComponent(url));
    return fetch(proxied, { signal });
  }
}

async function fetchJson<T>(url: string, corsProxy?: string, signal?: AbortSignal): Promise<{ data: T; headers: Headers }> {
  const response = await fetchWithFallback(url, corsProxy, signal);
  if (!response.ok) {
    throw new Error(`REST-Fehler ${response.status} ${response.statusText}: ${url}`);
  }
  const data = await response.json() as T;
  return { data, headers: response.headers };
}

// ============================================================================
// Kategorien & Tags
// ============================================================================

/**
 * Lädt alle Kategorien einer WordPress-Seite (automatisch paginiert)
 */
export async function fetchWPCategories(site: string, corsProxy?: string): Promise<WPCategory[]> {
  const categories: WPCategory[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const url = joinUrl(site, `categories?per_page=${perPage}&page=${page}&orderby=count&order=desc&hide_empty=true`);
    const { data } = await fetchJson<WPCategory[]>(url, corsProxy);
    categories.push(...data);
    if (data.length < perPage) break;
    page++;
  }

  return categories;
}

/**
 * Lädt alle Tags einer WordPress-Seite (automatisch paginiert)
 */
export async function fetchWPTags(site: string, corsProxy?: string): Promise<WPTag[]> {
  const tags: WPTag[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const url = joinUrl(site, `tags?per_page=${perPage}&page=${page}&orderby=count&order=desc&hide_empty=true`);
    const { data } = await fetchJson<WPTag[]>(url, corsProxy);
    tags.push(...data);
    if (data.length < perPage) break;
    page++;
  }

  return tags;
}

// ============================================================================
// Beiträge
// ============================================================================

/**
 * Konvertiert einen WP-REST-Post in die interne WordPressPost-Struktur
 */
function convertRestPost(post: WPRestPost): WordPressPost {
  const embeddedTerms = post._embedded?.['wp:term'] || [];
  const categories: string[] = [];
  const tags: string[] = [];

  // wp:term = [categories[], tags[]]
  for (const termGroup of embeddedTerms) {
    for (const term of termGroup || []) {
      if (term.taxonomy === 'category') categories.push(decodeHtmlEntities(term.name));
      else if (term.taxonomy === 'post_tag') tags.push(decodeHtmlEntities(term.name));
    }
  }

  const featured = post._embedded?.['wp:featuredmedia']?.[0];

  return {
    postId: String(post.id),
    postType: 'post',
    title: decodeHtmlEntities(post.title?.rendered) || 'Ohne Titel',
    content: post.content?.rendered || '',
    excerpt: decodeHtmlEntities(stripHtml(post.excerpt?.rendered || '')),
    status: (post.status as WordPressPost['status']) || 'publish',
    publishDate: post.date_gmt ? new Date(`${post.date_gmt}Z`) : new Date(),
    modifiedDate: post.modified_gmt ? new Date(`${post.modified_gmt}Z`) : new Date(),
    author: post._embedded?.author?.[0]?.name,
    categories,
    tags,
    featuredMedia: featured ? String(featured.id) : undefined,
    featuredImageUrl: featured?.source_url,
    media: [],
    slug: post.slug,
    guid: post.guid?.rendered,
    link: post.link,
  };
}

/**
 * Lädt alle veröffentlichten Beiträge (optional gefiltert nach Kategorien).
 * Läuft automatisch über alle Seiten (100 pro Seite).
 */
export async function fetchWPPosts(options: FetchPostsOptions): Promise<FetchPostsResult> {
  const {
    site,
    categoryIds,
    perPage = 100,
    maxPosts,
    corsProxy,
    onProgress,
    signal,
  } = options;

  const posts: WordPressPost[] = [];
  let page = 1;
  let total = 0;

  while (true) {
    const params = new URLSearchParams({
      per_page: String(perPage),
      page: String(page),
      status: 'publish',
      _embed: 'wp:featuredmedia,wp:term,author',
    });
    if (categoryIds && categoryIds.length > 0) {
      params.set('categories', categoryIds.join(','));
    }

    const url = joinUrl(site, `posts?${params.toString()}`);
    const { data, headers } = await fetchJson<WPRestPost[]>(url, corsProxy, signal);

    if (page === 1) {
      const totalHeader = parseInt(headers.get('x-wp-total') || '0', 10);
      total = Number.isFinite(totalHeader) && totalHeader > 0 ? totalHeader : data.length;
    }

    for (const restPost of data) {
      if (restPost.status !== 'publish') continue;
      posts.push(convertRestPost(restPost));
      if (maxPosts && posts.length >= maxPosts) {
        onProgress?.(posts.length, total);
        return { posts, total };
      }
    }

    onProgress?.(posts.length, total);

    if (data.length < perPage) break;
    page++;
  }

  return { posts, total };
}
