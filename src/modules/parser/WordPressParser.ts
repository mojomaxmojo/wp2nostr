/**
 * WordPress XML Parser
 * Parst WordPress Export XML Dateien mit DOMParser
 */

export interface WordPressMedia {
  postId: string;
  url: string;
  type: 'image' | 'video' | 'audio' | 'other';
  mimeType?: string;
  title?: string;
  caption?: string;
  altText?: string;
}

export interface WordPressPost {
  postId: string;
  postType: 'post' | 'page' | 'attachment';
  title: string;
  content: string;
  excerpt?: string;
  status: 'publish' | 'draft' | 'private' | 'future';
  publishDate: Date;
  modifiedDate: Date;
  author?: string;
  categories: string[];
  tags: string[];
  featuredMedia?: string; // Post ID des Featured Image
  media: WordPressMedia[];
  slug?: string;
  guid?: string;
}

export interface WordPressExport {
  title?: string;
  link?: string;
  description?: string;
  pubDate?: Date;
  language?: string;
  categories: Map<string, string[]>; // parent -> children
  tags: Set<string>;
  posts: WordPressPost[];
  media: Map<string, WordPressMedia>; // postId -> media
}

/**
 * Parst eine WordPress XML Export Datei mit DOMParser
 */
export async function parseWordPressXML(xmlContent: string): Promise<WordPressExport> {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');

    // Parsing Error Check
    const parseError = xmlDoc.querySelector('parsererror');
    if (parseError) {
      throw new Error('Ungültiges WordPress XML Format: ' + parseError.textContent);
    }

    const rss = xmlDoc.querySelector('rss');
    if (!rss) {
      throw new Error('Ungültiges WordPress XML Format: Kein RSS Element gefunden');
    }

    const channel = rss.querySelector('channel');
    if (!channel) {
      throw new Error('Ungültiges WordPress XML Format: Kein Channel gefunden');
    }

    const exportData: WordPressExport = {
      title: getTextContent(channel, 'title'),
      link: getTextContent(channel, 'link'),
      description: getTextContent(channel, 'description'),
      pubDate: parseDate(getTextContent(channel, 'pubDate')),
      language: getTextContent(channel, 'language'),
      categories: new Map(),
      tags: new Set(),
      posts: [],
      media: new Map(),
    };

    // Kategorien parsen
    const categories = channel.querySelectorAll('category');
    categories.forEach(cat => {
      const domain = cat.getAttribute('domain');
      const nicename = cat.getAttribute('nicename');
      const parent = cat.getAttribute('parent') || '';
      const content = cat.textContent || nicename || '';

      if (domain === 'category') {
        if (!exportData.categories.has(parent)) {
          exportData.categories.set(parent, []);
        }
        exportData.categories.get(parent)!.push(content);
      } else if (domain === 'post_tag') {
        exportData.tags.add(content);
      }
    });

    // Items (Media und Posts) parsen
    const items = channel.querySelectorAll('item');
    items.forEach(item => {
      const postType = getTagContent(item, 'wp\\:post_type');
      const postId = getTagContent(item, 'wp\\:post_id');

      if (!postId) return;

      // Media zuerst parsen
      if (postType === 'attachment') {
        const media = parseMediaFromDOM(item, postId);
        if (media) {
          exportData.media.set(media.postId, media);
        }
      }
    });

    // Posts parsen
    items.forEach(item => {
      const postType = getTagContent(item, 'wp\\:post_type');

      if (postType === 'post' || postType === 'page') {
        const postId = getTagContent(item, 'wp\\:post_id');
        if (!postId) return;

        const post = parsePostFromDOM(item, postId, exportData);
        if (post) {
          exportData.posts.push(post);
        }
      }
    });

    console.log(`WordPress Export geparsed: ${exportData.posts.length} Posts, ${exportData.media.size} Media`);

    return exportData;
  } catch (error) {
    console.error('Fehler beim Parsen der WordPress XML:', error);
    throw new Error(`WordPress XML Parsing fehlgeschlagen: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`);
  }
}

/**
 * Hilfsfunktion: Text Content eines Elements
 */
function getTextContent(parent: Element, selector: string): string {
  const el = parent.querySelector(selector);
  return el?.textContent?.trim() || '';
}

/**
 * Hilfsfunktion: Content eines Tags (mit namespace)
 */
function getTagContent(item: Element, tagName: string): string {
  const el = item.querySelector(tagName);
  return el?.textContent?.trim() || '';
}

/**
 * Hilfsfunktion: Alle Tag-Contents
 */
function getTagContents(item: Element, tagName: string): string[] {
  const els = item.querySelectorAll(tagName);
  return Array.from(els).map(el => el.textContent?.trim() || '');
}

/**
 * Hilfsfunktion: Attribute eines Tags
 */
function getTagAttributes(item: Element, tagName: string, attr: string): string {
  const el = item.querySelector(tagName);
  return el?.getAttribute(attr) || '';
}

/**
 * Parst ein einzelnes Media-Item aus DOM
 */
function parseMediaFromDOM(item: Element, postId: string): WordPressMedia | null {
  try {
    const url = getTagContent(item, 'wp\\:attachment_url');
    const mimeType = getTagContent(item, 'wp\\:post_mime_type');

    let type: WordPressMedia['type'] = 'other';
    if (mimeType?.startsWith('image/')) type = 'image';
    else if (mimeType?.startsWith('video/')) type = 'video';
    else if (mimeType?.startsWith('audio/')) type = 'audio';

    return {
      postId,
      url: url || '',
      type,
      mimeType,
      title: getTextContent(item, 'title'),
      caption: getTagContent(item, 'wp\\:post_excerpt') || getTextContent(item, 'excerpt'),
      altText: getTagContent(item, 'wp\\:attachment_alt'),
    };
  } catch (error) {
    console.error('Fehler beim Parsen von Media:', error);
    return null;
  }
}

/**
 * Parst einen einzelnen Post aus DOM
 */
function parsePostFromDOM(item: Element, postId: string, exportData: WordPressExport): WordPressPost | null {
  try {
    const status = getTagContent(item, 'wp\\:status') || 'draft';

    // Nur veröffentlichte Posts importieren
    if (status !== 'publish') return null;

    const publishDate = parseDate(getTagContent(item, 'wp\\:post_date_gmt') || getTagContent(item, 'pubDate'));
    const modifiedDate = parseDate(getTagContent(item, 'wp\\:post_modified_gmt'));

    // Kategorien und Tags
    const categories: string[] = [];
    const tags: string[] = [];

    const categoryItems = item.querySelectorAll('category');
    categoryItems.forEach(cat => {
      const domain = cat.getAttribute('domain');
      const content = cat.textContent?.trim();

      if (domain === 'category' && content) {
        categories.push(content);
      } else if (domain === 'post_tag' && content) {
        tags.push(content);
      }
    });

    // Media Referenzen
    const media: WordPressMedia[] = [];
    const postThumbnail = item.querySelector('wp\\:post_thumbnail');
    if (postThumbnail) {
      const thumbnailId = getTagContent(postThumbnail, 'wp\\:post_id');
      if (thumbnailId) {
        const thumbMedia = exportData.media.get(thumbnailId);
        if (thumbMedia) {
          media.push(thumbMedia);
        }
      }
    }

    return {
      postId,
      postType: getTagContent(item, 'wp\\:post_type') || 'post',
      title: getTextContent(item, 'title') || 'Ohne Titel',
      content: getTagContent(item, 'content\\:encoded') || getTextContent(item, 'description') || '',
      excerpt: getTagContent(item, 'excerpt\\:encoded') || getTagContent(item, 'wp\\:post_excerpt'),
      status,
      publishDate,
      modifiedDate,
      author: getTagContent(item, 'dc\\:creator'),
      categories,
      tags,
      featuredMedia: postThumbnail ? getTagContent(postThumbnail, 'wp\\:post_id') : undefined,
      media,
      slug: getTagContent(item, 'wp\\:post_name'),
      guid: item.querySelector('guid')?.textContent,
    };
  } catch (error) {
    console.error('Fehler beim Parsen von Post:', error);
    return null;
  }
}

/**
 * Parst ein Datum
 */
function parseDate(dateStr?: string): Date {
  if (!dateStr) return new Date();

  try {
    return new Date(dateStr);
  } catch {
    return new Date();
  }
}

/**
 * Filtert Posts nach Status
 */
export function filterByStatus(posts: WordPressPost[], statuses: string[]): WordPressPost[] {
  return posts.filter(post => statuses.includes(post.status));
}

/**
 * Filtert Posts nach Datum
 */
export function filterByDateRange(
  posts: WordPressPost[],
  startDate?: Date,
  endDate?: Date
): WordPressPost[] {
  return posts.filter(post => {
    if (startDate && post.publishDate < startDate) return false;
    if (endDate && post.publishDate > endDate) return false;
    return true;
  });
}

/**
 * Sortiert Posts nach Datum
 */
export function sortByDate(posts: WordPressPost[], descending = true): WordPressPost[] {
  return [...posts].sort((a, b) => {
    const diff = a.publishDate.getTime() - b.publishDate.getTime();
    return descending ? -diff : diff;
  });
}
