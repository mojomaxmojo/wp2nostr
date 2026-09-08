/**
 * Summary Builder
 * Baut die Kurzbeschreibung (summary-Tag) für importierte Artikel.
 *
 * mojobus.co zeigt den summary-Tag als hervorgehobenen Einleitungstext —
 * dort gehören maximal 2 Sätze hin (kein "Read More", kein vollständiges
 * WP-Excerpt).
 */

export interface SummaryOptions {
  /** Maximale Anzahl Sätze (default: 2) */
  maxSentences?: number;
  /** Hartes Zeichenlimit als Sicherheitsnetz (default: 320) */
  maxChars?: number;
}

/** HTML zu reinem Text */
function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#8230;|&hellip;/gi, '…')
    .replace(/&#8220;|&#8221;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#8216;|&#8217;|&lsquo;|&rsquo;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** "Read More" / "Weiterlesen" / "Den Rest des Beitrags lesen" am Ende entfernen */
function removeReadMore(text: string): string {
  return text
    .replace(/\[…\]/g, '')
    .replace(/[…\.]*\s*(read more|weiterlesen|den rest des beitrags lesen|continue reading)\s*[.!]?\s*$/gi, '')
    .replace(/\s+…\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Zerlegt Text in Sätze (deutsch/englisch: . ! ? … gefolgt von Leerzeichen)
 * Kurze Abkürzungen wie "z.B." werden bestmöglich geschont.
 */
export function splitSentences(text: string): string[] {
  const parts: string[] = [];
  let current = '';

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    current += ch;

    if (/[.!?…]/.test(ch)) {
      const next = text[i + 1];
      // Nur trennen, wenn Satzzeichen am Satzende steht (Leerzeichen/Ende folgt)
      if (next === undefined || /\s/.test(next)) {
        const rest = text.slice(i + 1);
        const m = rest.match(/^\s+(\S)/);
        // Nächster Satz beginnt mit Großbuchstaben/Anführungszeichen/Zahl
        if (!m || /^[A-ZÄÖÜ„"‚'0-9]/.test(m[1])) {
          parts.push(current.trim());
          current = '';
        }
      }
    }
  }

  if (current.trim()) parts.push(current.trim());
  return parts;
}

/**
 * Baut eine kurze Zusammenfassung:
 * 1. WP-Excerpt als Basis (HTML-stripped, "Read More" entfernt)
 * 2. Fallback: erste Sätze aus dem Artikelinhalt
 * 3. Auf max. N Sätze kürzen (default 2) + hartes Zeichenlimit
 */
export function buildSummary(
  excerptHtml: string,
  contentHtml: string,
  options?: SummaryOptions
): string {
  const maxSentences = Math.max(1, options?.maxSentences ?? 2);
  const maxChars = Math.max(60, options?.maxChars ?? 320);

  let text = removeReadMore(stripHtml(excerptHtml || ''));
  if (!text) {
    text = removeReadMore(stripHtml(contentHtml || ''));
  }
  if (!text) return '';

  // Erste N Sätze
  const sentences = splitSentences(text);
  let summary = sentences.slice(0, maxSentences).join(' ').trim();

  // Hartes Zeichenlimit (an Wortgrenze kürzen)
  if (summary.length > maxChars) {
    let cut = summary.slice(0, maxChars - 1);
    const lastSpace = cut.lastIndexOf(' ');
    if (lastSpace > maxChars * 0.6) cut = cut.slice(0, lastSpace);
    summary = cut.trimEnd() + '…';
  }

  return summary;
}
