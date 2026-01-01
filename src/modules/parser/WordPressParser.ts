/**
 * WordPress XML Parser
 * Parst WordPress Export XML Dateien mit DOMParser
 * Verwendet Namespace-unabhängige Methoden für maximale Browser-Kompatibilität
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
 * Hilfsfunktion: Text Content eines Elements (ohne Namespace)
 */
function getTextContent(parent: Element, tagName: string): string {
  const el = parent.querySelector(tagName);
  return el?.textContent?.trim() || '';
}

/**
 * Hilfsfunktion: Content eines Tags mit Namespace
 * Verwendet manuelle Iteration statt querySelector
 */
function getTagContentNS(item: Element, namespace: string, localName: string): string {
  // Versuche getElementsByTagNameNS (wenn Namespace bekannt)
  try {
    const els = item.getElementsByTagNameNS('*', localName);
    if (els.length > 0 && els[0].textContent) {
      return els[0].textContent.trim();
    }
  } catch (e) {
    // Fallback zu manueller Suche
  }

  // Fallback: Manuelle Suche nach Elementen
  const allChildren = item.getElementsByTagName('*');
  for (let i = 0; i < allChildren.length; i++) {
    const child = allChildren[i];
    const tagName = child.tagName;
    
    // Prüfe auf Namespace-Tag (z.B. "wp:post_type")
    if (tagName === `${namespace}:${localName}`) {
      return child.textContent?.trim() || '';
    }
    
    // Prüfe auf lokalen Namen (fallback)
    if (tagName.endsWith(`:${localName}`) || tagName === localName) {
      return child.textContent?.trim() || '';
    }
  }

  return '';
}

/**
 * Konvenienz-Funktion für WordPress Namespaces
 */
function getWPContent(item: Element, tagName: string): string {
  return getTagContentNS(item, 'wp', tagName);
}

function getContentEncoded(item: Element): string {
  return getTagContentNS(item, 'content', 'encoded');
}

function getExcerptEncoded(item: Element): string {
  return getTagContentNS(item, 'excerpt', 'encoded');
}

function getDCCreator(item: Element): string {
  return getTagContentNS(item, 'dc', 'creator');
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

    // Zuerst alle Items sammeln
    const itemsArray = Array.from(items);

    // Media zuerst parsen
    itemsArray.forEach(item => {
      try {
        const postId = getWPContent(item, 'post_id');

        if (!postId) return;

        const postType = getWPContent(item, 'post_type');

        // Media parsen
        if (postType === 'attachment') {
          const media = parseMediaFromDOM(item, postId);
          if (media) {
            exportData.media.set(media.postId, media);
          }
        }
      } catch (error) {
        console.error('Fehler beim Parsen von Item:', error);
      }
    });

    // Dann Posts parsen
    itemsArray.forEach(item => {
      try {
        const postId = getWPContent(item, 'post_id');

        if (!postId) return;

        const postType = getWPContent(item, 'post_type');

        if (postType === 'post' || postType === 'page') {
          const post = parsePostFromDOM(item, postId, exportData);
          if (post) {
            exportData.posts.push(post);
          }
        }
      } catch (error) {
        console.error('Fehler beim Parsen von Post:', error);
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
 * Parst ein einzelnes Media-Item aus DOM
 */
function parseMediaFromDOM(item: Element, postId: string): WordPressMedia | null {
  try {
    const url = getWPContent(item, 'attachment_url');
    const mimeType = getWPContent(item, 'post_mime_type');

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
      caption: getWPContent(item, 'post_excerpt') || getTextContent(item, 'excerpt'),
      altText: getWPContent(item, 'attachment_alt'),
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
    const postType = getWPContent(item, 'post_type');

    // Nur Posts importieren (keine Seiten)
    if (postType !== 'post') return null;

    const status = getWPContent(item, 'status') || 'draft';

    // Nur veröffentlichte Posts importieren
    if (status !== 'publish') return null;

    const publishDate = parseDate(
      getWPContent(item, 'post_date_gmt') || getTextContent(item, 'pubDate')
    );
    const modifiedDate = parseDate(getWPContent(item, 'post_modified_gmt'));

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
    
    // Post Thumbnail suchen
    let postThumbnailId: string | undefined;
    
    // Suche nach wp:post_thumbnail Element
    const allChildren = item.getElementsByTagName('*');
    for (let i = 0; i < allChildren.length; i++) {
      const child = allChildren[i];
      const tagName = child.tagName;
      
      if (tagName === 'wp:post_thumbnail' || tagName === 'wp\\:post_thumbnail') {
        // Suche nach wp:post_id innerhalb des thumbnail elements
        const thumbnailChildren = child.getElementsByTagName('*');
        for (let j = 0; j < thumbnailChildren.length; j++) {
          const thumbChild = thumbnailChildren[j];
          if (thumbChild.tagName === 'wp:post_id' || thumbChild.tagName === 'wp\\:post_id') {
            postThumbnailId = thumbChild.textContent?.trim();
            break;
          }
        }
        if (postThumbnailId) break;
      }
    }

    if (postThumbnailId) {
      const thumbMedia = exportData.media.get(postThumbnailId);
      if (thumbMedia) {
        media.push(thumbMedia);
      }
    }

    return {
      postId,
      postType: postType || 'post',
      title: getTextContent(item, 'title') || 'Ohne Titel',
      content: getContentEncoded(item) || getTextContent(item, 'description') || '',
      excerpt: getExcerptEncoded(item) || getWPContent(item, 'post_excerpt'),
      status,
      publishDate,
      modifiedDate,
      author: getDCCreator(item),
      categories,
      tags,
      featuredMedia: postThumbnailId,
      media,
      slug: getWPContent(item, 'post_name'),
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
