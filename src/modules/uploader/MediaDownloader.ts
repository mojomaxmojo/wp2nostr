/**
 * Media Downloader
 * Lädt Medien von WordPress URLs herunter
 */

export interface DownloadedMedia {
  originalUrl: string;
  file: File;
  type: 'image' | 'video' | 'audio' | 'other';
  mimeType: string;
  size: number;
}

export interface DownloadProgress {
  total: number;
  completed: number;
  currentUrl: string;
  percentage: number;
}

/**
 * Lädt eine Media-Datei von einer URL herunter
 */
async function downloadMediaFromUrl(url: string, corsProxy?: string): Promise<DownloadedMedia> {
  // CORS Proxy URL erstellen falls angegeben
  const downloadUrl = corsProxy ? corsProxy.replace('{href}', encodeURIComponent(url)) : url;

  const response = await fetch(downloadUrl);
  if (!response.ok) {
    throw new Error(`Download fehlgeschlagen: ${response.status} ${response.statusText}`);
  }

  const blob = await response.blob();
  const mimeType = blob.type || 'application/octet-stream';

  // Typ bestimmen
  let type: DownloadedMedia['type'] = 'other';
  if (mimeType.startsWith('image/')) type = 'image';
  else if (mimeType.startsWith('video/')) type = 'video';
  else if (mimeType.startsWith('audio/')) type = 'audio';

  // Dateiname aus URL extrahieren
  const urlObj = new URL(url);
  const pathname = urlObj.pathname;
  const filename = pathname.split('/').pop() || `media-${Date.now()}`;

  // Extension hinzufügen falls nicht vorhanden
  let finalFilename = filename;
  const extension = mimeType.split('/')[1];
  if (!filename.includes('.')) {
    finalFilename = `${filename}.${extension}`;
  }

  const file = new File([blob], finalFilename, { type: mimeType });

  return {
    originalUrl: url,
    file,
    type,
    mimeType,
    size: blob.size,
  };
}

/**
 * Lädt mehrere Medien herunter
 */
export async function downloadMedias(
  urls: string[],
  onProgress?: (progress: DownloadProgress) => void,
  corsProxy?: string
): Promise<DownloadedMedia[]> {
  const results: DownloadedMedia[] = [];
  const total = urls.length;
  let completed = 0;

  for (const url of urls) {
    try {
      onProgress?.({
        total,
        completed,
        currentUrl: url,
        percentage: Math.round((completed / total) * 100),
      });

      const media = await downloadMediaFromUrl(url, corsProxy);
      results.push(media);
      completed++;

      onProgress?.({
        total,
        completed,
        currentUrl: url,
        percentage: Math.round((completed / total) * 100),
      });
    } catch (error) {
      console.error(`Download von ${url} fehlgeschlagen:`, error);
      // Andere Dateien trotzdem versuchen
    }
  }

  return results;
}

/**
 * Extrahiert alle Bild-URLs aus einem Artikel
 */
export function extractImageUrlsFromArticle(html: string): string[] {
  const urls = new Set<string>();

  // Regex für img src
  const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    urls.add(match[1]);
  }

  // Regex für background-image
  const bgRegex = /background(?:-image)?\s*:\s*url\(["']?([^"')\s]+)["']?\)/gi;
  while ((match = bgRegex.exec(html)) !== null) {
    urls.add(match[1]);
  }

  return Array.from(urls);
}

/**
 * Extrahiert alle Video-URLs aus einem Artikel (YouTube etc.)
 */
export function extractVideoUrlsFromArticle(html: string): string[] {
  const urls = new Set<string>();

  // YouTube URLs
  const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]+)/gi;
  let match;
  while ((match = youtubeRegex.exec(html)) !== null) {
    urls.add(match[0]);
  }

  // Video Tags
  const videoRegex = /<video[^>]+src=["']([^"']+)["']/gi;
  while ((match = videoRegex.exec(html)) !== null) {
    urls.add(match[1]);
  }

  return Array.from(urls);
}

/**
 * Ersetzt WordPress URLs mit Blossom URLs im Markdown
 */
export function replaceUrlsInMarkdown(
  markdown: string,
  urlMap: Map<string, string>
): string {
  let replaced = markdown;

  urlMap.forEach((blossomUrl, originalUrl) => {
    // Markdown Bilder: ![alt](url)
    replaced = replaced.replace(
      new RegExp(`!\\[([^\\]]*)\\]\\(${escapeRegex(originalUrl)}\\)`, 'g'),
      `![$1](${blossomUrl})`
    );

    // Markdown Links: [text](url)
    replaced = replaced.replace(
      new RegExp(`\\[([^\\]]+)\\]\\(${escapeRegex(originalUrl)}\\)`, 'g'),
      `[$1](${blossomUrl})`
    );

    // Reine URLs im Text
    replaced = replaced.replace(
      new RegExp(escapeRegex(originalUrl), 'g'),
      blossomUrl
    );
  });

  return replaced;
}

/**
 * Escaped Regex-Sonderzeichen
 */
function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Validiert eine Media-URL
 */
export function isValidMediaUrl(url: string): boolean {
  if (!url || url.trim().length === 0) return false;

  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Filtert Medien nach Typ
 */
export function filterMediasByType(
  medias: DownloadedMedia[],
  types: DownloadedMedia['type'][]
): DownloadedMedia[] {
  return medias.filter(media => types.includes(media.type));
}

/**
 * Filtert Medien nach Größe
 */
export function filterMediasBySize(
  medias: DownloadedMedia[],
  maxSize: number
): DownloadedMedia[] {
  return medias.filter(media => media.size <= maxSize);
}

/**
 * Berechnet die Gesamtgröße aller Medien
 */
export function calculateTotalSize(medias: DownloadedMedia[]): number {
  return medias.reduce((total, media) => total + media.size, 0);
}

/**
 * Formatiert Dateigröße für Anzeige
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Erstellt einen Download-Link
 */
export function createDownloadUrl(url: string, corsProxy?: string): string {
  if (!corsProxy) return url;

  // CORS Proxy URL Template
  return corsProxy.replace('{href}', encodeURIComponent(url));
}

/**
 * Prüft ob eine URL ein YouTube-Link ist
 */
export function isYouTubeUrl(url: string): boolean {
  const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//;
  return youtubeRegex.test(url);
}

/**
 * Extrahiert YouTube Video ID aus URL
 */
export function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]+)/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]+)/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

/**
 * Erstellt YouTube Iframe Embed Code
 */
export function createYouTubeEmbed(videoId: string, width = 560, height = 315): string {
  return `<iframe width="${width}" height="${height}" src="https://www.youtube.com/embed/${videoId}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`;
}

/**
 * Konvertiert YouTube URLs im Markdown zu Iframes
 */
export function convertYouTubeUrlsToIframes(markdown: string): string {
  return markdown.replace(
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/g,
    (_, videoId) => `\n\n${createYouTubeEmbed(videoId)}\n\n`
  );
}
