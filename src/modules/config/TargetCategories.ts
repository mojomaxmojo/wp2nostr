/**
 * mojobus.co Ziel-Kategorien
 *
 * Statische Kopie der Kategorie-Struktur von mojobus.co
 * (Quelle: mojobusco/src/config/contentCategories.ts — NUR GELESEN, nicht verändert).
 *
 * Damit importierte Artikel exakt wie mojobus.co-eigene Artikel kategorisiert
 * werden und auf mojobus.co unter /artikel, /artikel/rvlife, /artikel/leon
 * bzw. /plaetze erscheinen.
 */

export type TargetCategoryId = 'articles' | 'rvlife' | 'leon' | 'places';

export interface TargetCategory {
  id: TargetCategoryId;
  name: string;
  description: string;
  route: string;
  icon: string;
  color: string;
  kind: number; // 30023 = NIP-23 Long-form
  /** Wert für den type-Tag ('article' | 'place') */
  typeTag: string;
  /** Diese t-Tags werden IMMER gesetzt (Pflicht) */
  requiredTags: string[];
  /** Verfügbare optionale t-Tags */
  optionalTags: string[];
}

export const TARGET_CATEGORIES: TargetCategory[] = [
  {
    id: 'articles',
    name: 'Artikel',
    description: 'Ausführliche Geschichten und Guides (/artikel)',
    route: '/artikel',
    icon: '📖',
    color: '#7C3AED',
    kind: 30023,
    typeTag: 'article',
    requiredTags: ['artikel', 'article', 'mojobus'],
    optionalTags: [
      // Kategorien
      'vanlife', 'technik', 'reisen', 'leben', 'anleitung', 'erfahrung',
      // Themen
      'solar', '4x4', 'navigation', 'reparatur', 'outdoor',
      'kochen', 'gesundheit', 'sicherheit', 'budget',
      // Reiseziele
      'europa', 'portugal', 'spanien', 'italien', 'griechenland',
      // Vanlife
      'ausbau', 'camping', 'wildcamping', 'digital', 'nomade',
    ],
  },
  {
    id: 'rvlife',
    name: 'RV Life',
    description: 'Leben im Wohnmobil – Küche & Essen, Ausstattung, Freeliving (/artikel/rvlife)',
    route: '/artikel/rvlife',
    icon: '🚐',
    color: '#EA580C',
    kind: 30023,
    typeTag: 'article',
    requiredTags: ['rvlife', 'artikel', 'article', 'mojobus'],
    optionalTags: [
      // RV Life Basis-Tags
      'rv-life', 'wohnmobil', 'camper',
      // Küche & Essen
      'kueche-essen', 'kueche', 'essen', 'cooking', 'food', 'kochen', 'backen', 'rezepte', 'kochgeraete', 'kuechenausstattung',
      // Ausstattung
      'ausstattung', 'equipment', 'ausruestung', 'wohnen', 'storage', 'stauraum', 'moebel', 'interieur', 'innenausbau',
      // Freeliving
      'freeliving', 'nomad', 'freedom', 'nomadenleben', 'digital-nomad', 'ortsunabhaengig', 'minimalismus',
    ],
  },
  {
    id: 'leon',
    name: 'Leon Story',
    description: 'Die Abenteuer und täglichen Momente von Leon (/artikel/leon)',
    route: '/artikel/leon',
    icon: '🦁',
    color: '#F59E0B',
    kind: 30023,
    typeTag: 'article',
    requiredTags: ['leon', 'artikel', 'article', 'hund', 'dog', 'lion', 'dogo', 'mojobus'],
    optionalTags: ['vanlife', 'technik', 'reisen', 'leben', 'anleitung', 'erfahrung'],
  },
  {
    id: 'places',
    name: 'Plätze',
    description: 'Campingplätze und Reiseziele (/plaetze) — type=place',
    route: '/plaetze',
    icon: '📍',
    color: '#DC2626',
    kind: 30023,
    typeTag: 'place',
    requiredTags: ['location', 'places', 'mojobus'],
    optionalTags: [
      // Ortstypen
      'campingplatz', 'wildcamping', 'stellplatz', 'aussichtspunkt',
      'strand', 'berg', 'see', 'stadt', 'natur',
      // Länder/Regionen
      'portugal', 'spanien', 'italien', 'frankreich', 'deutschland',
      'algarve', 'andalusien', 'katalonien', 'toskana',
      // Ausstattung
      'strom', 'wasser', 'wc', 'dusche', 'wlan', 'shop',
      // Geeignet für
      'familien', 'paare', 'single', 'wohnmobil', 'zelt',
    ],
  },
];

export function getTargetCategory(id: string): TargetCategory | undefined {
  return TARGET_CATEGORIES.find(c => c.id === id);
}

export function getTargetCategoryName(id: string): string {
  return getTargetCategory(id)?.name || id;
}
