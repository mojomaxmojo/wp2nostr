/**
 * HTML zu Markdown Konverter
 * Konvertiert sauberes HTML zu Markdown und bereinigt WordPress-spezifischen Code
 */

import TurndownService from 'turndown';

export interface ConversionOptions {
  removeWordPressShortcodes: boolean;
  preserveImages: boolean;
  preserveLinks: boolean;
  convertYouTubeEmbeds: boolean;
  imageWidth?: number;
}

export const DEFAULT_CONVERSION_OPTIONS: ConversionOptions = {
  removeWordPressShortcodes: true,
  preserveImages: true,
  preserveLinks: true,
  convertYouTubeEmbeds: true,
};

/**
 * WordPress Shortcode Pattern
 * [shortcode param="value"]content[/shortcode]
 */
const WORDPRESS_SHORTCODE_PATTERN = /\[[a-zA-Z0-9_-]+(?:\s+[^\]]+)?\](?:.*?\[\/[a-zA-Z0-9_-]+\])?/g;

/**
 * YouTube URL Patterns
 */
const YOUTUBE_PATTERNS = [
  /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/i,
  /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]+)/i,
  /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]+)/i,
];

/**
 * YouTube Iframe Template
 */
const YOUTUBE_IFRAME_TEMPLATE = (videoId: string) => `\n\n<iframe width="560" height="315" src="https://www.youtube.com/embed/${videoId}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>\n\n`;

/**
 * Initialisiert Turndown Service
 */
function createTurndownService(options: ConversionOptions): TurndownService {
  const turndownService = new TurndownService({
    headingStyle: 'atx', // # Heading
    hr: '---',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    fence: '```',
    emDelimiter: '*',
    strongDelimiter: '**',
    linkStyle: 'inlined',
  });

  // Bilder
  turndownService.addRule('images', {
    filter: 'img',
    replacement: (content: string, node: any) => {
      if (!options.preserveImages) return '';

      const alt = node.getAttribute('alt') || '';
      const src = node.getAttribute('src') || '';
      const title = node.getAttribute('title') || '';

      if (!src) return '';

      const altText = alt || 'image';
      const titleText = title ? ` "${title}"` : '';

      return `![${altText}](${src}${titleText})\n`;
    },
  });

  // YouTube Embeds - Iframes behalten
  if (options.convertYouTubeEmbeds) {
    turndownService.addRule('youtube-iframe', {
      filter: (node: any) => {
        if (node.tagName !== 'IFRAME') return false;
        const src = node.getAttribute('src') || '';
        return src.includes('youtube.com/embed/') || src.includes('youtu.be/embed/');
      },
      replacement: (content: string, node: any) => {
        const src = node.getAttribute('src') || '';
        const match = src.match(/(?:embed|v)\/([a-zA-Z0-9_-]+)/);
        if (match) {
          // Iframe als HTML-Block behalten
          return `<iframe width="560" height="315" src="https://www.youtube.com/embed/${match[1]}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`;
        }
        return '';
      },
    });
  }

  // Links
  turndownService.addRule('links', {
    filter: (node: any) => {
      return node.nodeName === 'A';
    },
    replacement: (content: string, node: any) => {
      if (!options.preserveLinks) return content;

      const href = node.getAttribute('href') || '';
      if (!href) return content;

      // YouTube Links umwandeln
      if (options.convertYouTubeEmbeds) {
        for (const pattern of YOUTUBE_PATTERNS) {
          const match = href.match(pattern);
          if (match) {
            // YouTube Link als Iframe
            return YOUTUBE_IFRAME_TEMPLATE(match[1]);
          }
        }
      }

      const title = node.getAttribute('title');
      const titlePart = title ? ` "${title}"` : '';

      return `[${content}](${href}${titlePart})`;
    },
  });

  // Divs und Spanns
  turndownService.addRule('divs', {
    filter: ['div', 'span'],
    replacement: (content: string, node: any) => {
      return content + '\n';
    },
  });

  // Br zu Newline
  turndownService.addRule('br', {
    filter: 'br',
    replacement: () => '\n',
  });

  // Table Support
  turndownService.addRule('tables', {
    filter: ['table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td'],
    replacement: (content: string, node: any) => {
      const tagName = node.tagName.toLowerCase();

      if (tagName === 'table') {
        return '\n\n' + content + '\n\n';
      }
      if (tagName === 'thead' || tagName === 'tbody' || tagName === 'tfoot') {
        return content;
      }
      if (tagName === 'tr') {
        return '| ' + content + ' |\n';
      }
      if (tagName === 'th') {
        return content + ' |';
      }
      if (tagName === 'td') {
        return content + ' |';
      }

      return content;
    },
  });

  return turndownService;
}

/**
 * Entfernt WordPress Shortcodes aus HTML
 */
export function removeWordPressShortcodes(html: string): string {
  // Typische WordPress Shortcodes
  const shortcodes = [
    'caption',
    'gallery',
    'audio',
    'video',
    'playlist',
    'embed',
    'contact-form',
    'related-posts',
    'social-sharing',
    'code',
    'quote',
    'pullquote',
    'button',
    'alert',
    'icon',
    'map',
    'divider',
    'spacer',
  ];

  // [shortcode] und [shortcode]...[/shortcode] entfernen
  let cleaned = html;

  // Einfache Shortcodes
  shortcodes.forEach(code => {
    cleaned = cleaned.replace(new RegExp(`\\[${code}[^\\]]*\\]`, 'gi'), '');
    cleaned = cleaned.replace(new RegExp(`\\[${code}[^\\]]*\\].*?\\[\\/${code}\\]`, 'gis'), '');
  });

  // Alle remaining Shortcodes mit Regex
  cleaned = cleaned.replace(WORDPRESS_SHORTCODE_PATTERN, '');

  return cleaned;
}

/**
 * Bereinigt HTML von WordPress-spezifischem Code
 * (native DOMParser-Implementierung, ersetzt cheerio)
 */
export function cleanWordPressHTML(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const body = doc.body;

  // WordPress Editor Kommentare entfernen
  const walker = doc.createTreeWalker(body, NodeFilter.SHOW_COMMENT);
  const commentsToRemove: Comment[] = [];
  while (walker.nextNode()) {
    const comment = walker.currentNode as Comment;
    const data = comment.data || '';
    if (data.includes('wp:') || data.includes('WordPress')) {
      commentsToRemove.push(comment);
    }
  }
  commentsToRemove.forEach(comment => comment.remove());

  // WordPress Klassen entfernen
  body.querySelectorAll('[class*="wp-"]').forEach(el => el.removeAttribute('class'));
  body.querySelectorAll('[id*="wp-"]').forEach(el => el.removeAttribute('id'));

  // Auto-embed Links
  body.querySelectorAll('p').forEach(p => {
    const text = (p.textContent || '').trim();
    if (text.startsWith('http') && !p.querySelector('a')) {
      if (YOUTUBE_PATTERNS.some(pattern => pattern.test(text))) {
        const a = doc.createElement('a');
        a.setAttribute('href', text);
        a.textContent = text;
        p.textContent = '';
        p.appendChild(a);
      }
    }
  });

  // Figure und Figcaption für Bilder
  body.querySelectorAll('figure').forEach(figure => {
    const img = figure.querySelector('img');
    const figcaption = figure.querySelector('figcaption');

    if (img) {
      const p = doc.createElement('p');
      p.appendChild(img.cloneNode(true));
      if (figcaption) {
        const caption = figcaption.textContent || '';
        p.appendChild(doc.createTextNode(`\n*${caption}*`));
      }
      figure.replaceWith(p);
    }
  });

  return body.innerHTML;
}

/**
 * Extrahiert YouTube Video IDs aus HTML
 */
export function extractYouTubeIds(html: string): string[] {
  const ids = new Set<string>();
  const doc = new DOMParser().parseFromString(html, 'text/html');

  // iframes prüfen
  doc.querySelectorAll('iframe').forEach(iframe => {
    const src = iframe.getAttribute('src') || '';
    for (const pattern of YOUTUBE_PATTERNS) {
      const match = src.match(pattern);
      if (match) ids.add(match[1]);
    }
  });

  // Links prüfen
  doc.querySelectorAll('a').forEach(a => {
    const href = a.getAttribute('href') || '';
    for (const pattern of YOUTUBE_PATTERNS) {
      const match = href.match(pattern);
      if (match) ids.add(match[1]);
    }
  });

  // Text prüfen (Hinweis: Patterns ohne /g-Flag, daher kein exec-Loop)
  const text = doc.body.textContent || html;
  for (const pattern of YOUTUBE_PATTERNS) {
    const match = text.match(pattern);
    if (match) ids.add(match[1]);
  }

  return Array.from(ids);
}

/**
 * Extrahiert Bild-URLs aus HTML
 */
export function extractImageUrls(html: string): string[] {
  const urls = new Set<string>();
  const doc = new DOMParser().parseFromString(html, 'text/html');

  doc.querySelectorAll('img').forEach(img => {
    const src = img.getAttribute('src');
    if (src) urls.add(src);
  });

  return Array.from(urls);
}

/**
 * Konvertiert HTML zu Markdown
 */
export function convertHTMLToMarkdown(
  html: string,
  options: Partial<ConversionOptions> = {}
): string {
  const opts = { ...DEFAULT_CONVERSION_OPTIONS, ...options };

  let cleaned = html;

  // WordPress-spezifischen Code entfernen
  if (opts.removeWordPressShortcodes) {
    cleaned = removeWordPressShortcodes(cleaned);
  }

  // HTML bereinigen
  cleaned = cleanWordPressHTML(cleaned);

  // Zu Markdown konvertieren
  const turndownService = createTurndownService(opts);
  let markdown = turndownService.turndown(cleaned);

  // YouTube Links zu Iframes konvertieren
  if (opts.convertYouTubeEmbeds) {
    markdown = convertYouTubeLinksToIframes(markdown);
  }

  // Cleanup: Leere Zeilen reduzieren
  return markdown
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n\n');
}

/**
 * Validiert konvertiertes Markdown
 */
export function validateMarkdown(markdown: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Auf fehlende Bild-Alt-Tags prüfen
  const altMatches = markdown.matchAll(/!\[([^\]]*)\]\(/g);
  for (const match of altMatches) {
    if (!match[1] || match[1].trim() === '') {
      errors.push('Bild ohne Alt-Text gefunden');
    }
  }

  // Auf ungültige Links prüfen
  const linkMatches = markdown.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g);
  for (const match of linkMatches) {
    const [_, text, url] = match;
    if (!text.trim()) {
      errors.push(`Link ohne Text: ${url}`);
    }
    if (!url.trim() || !url.startsWith('http')) {
      errors.push(`Ungültiger Link-URL: ${url || 'leer'}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Konvertiert YouTube-Links im Markdown zu Iframes
 */
export function convertYouTubeLinksToIframes(markdown: string): string {
  // Markdown Links zu YouTube: [text](https://youtube.com/watch?v=xxx)
  let converted = markdown.replace(
    /\[([^\]]+)\]\((https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+))\)/g,
    YOUTUBE_IFRAME_TEMPLATE('$3')
  );

  // Plain YouTube URLs im Text
  converted = converted.replace(
    /(?:^|\s)(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+))(?:\s|$)/g,
    YOUTUBE_IFRAME_TEMPLATE('$2')
  );

  return converted;
}
