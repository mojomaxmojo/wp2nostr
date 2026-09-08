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

/**
 * Unterkategorie (mojobus.co ARTICLE_CATEGORIES-Untermenü, 1:1)
 * id = die category-ID die mojobus.co als ['category', id]-Tag setzt
 */
export interface TargetSubcategory {
  id: string;
  name: string;
  emoji: string;
  /** Diese t-Tags werden bei Auswahl immer gesetzt (autoTags) */
  autoTags: string[];
  /** Verfügbare optionale t-Tags */
  optionalTags: string[];
}

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
  /** mojobus.co-Untermenü (ARTICLE_CATEGORIES / RV Life / Strand-Ort) */
  subcategories: TargetSubcategory[];
}

// Unterkategorien 1:1 aus mojobusco/src/config/articles.ts, rvlife.ts, strandort.ts
const ARTICLE_SUBCATEGORIES: TargetSubcategory[] = [
  {
    id: 'vanlife',
    name: 'Vanlife',
    emoji: '🚐',
    autoTags: ['vanlife'],
    optionalTags: ['camping', 'wildcamping', 'stellplatz', 'reise'],
  },
  {
    id: 'reisen',
    name: 'Reisen',
    emoji: '🗺️',
    autoTags: ['reisen'],
    optionalTags: ['route', 'grenze', 'europa', 'abenteuer'],
  },
  {
    id: 'leben',
    name: 'Lifestyle',
    emoji: '🌊',
    autoTags: ['leben'],
    optionalTags: ['lifestyle', 'minimalismus', 'freedom', 'community'],
  },
  {
    id: 'erfahrung',
    name: 'Erfahrungsberichte',
    emoji: '💭',
    autoTags: ['erfahrung'],
    optionalTags: ['story', 'erlebnis', 'lernen', 'tipp'],
  },
  {
    id: 'diy',
    name: 'DIY & Anleitungen',
    emoji: '🛠️',
    autoTags: ['diy', 'anleitung'],
    optionalTags: ['tutorial', 'guide', 'selbermachen'],
  },
  // DIY-Untermenüs (mojobusco/src/config/diy.ts — 1:1)
  {
    id: 'diy-lifepo4',
    name: 'DIY: LiFePo4 Systeme',
    emoji: '🔋',
    autoTags: ['diy', 'anleitung', 'lifepo4', 'battery', 'batterie'],
    optionalTags: ['strom', 'stromversorgung', '12v', '24v', 'bms'],
  },
  {
    id: 'diy-solar',
    name: 'DIY: Solaranlagen',
    emoji: '☀️',
    autoTags: ['diy', 'anleitung', 'solar', 'photovoltaik'],
    optionalTags: ['sonnenenergie', 'panel', 'watt', 'victron', 'mppt'],
  },
  {
    id: 'diy-reparatur',
    name: 'DIY: Reparaturanleitungen',
    emoji: '🔧',
    autoTags: ['diy', 'anleitung', 'reparatur', 'wartung'],
    optionalTags: ['reparieren', 'werkstatt', 'ölwechsel', 'bremsen', 'motor'],
  },
  {
    id: 'diy-ausbau',
    name: 'DIY: Ausbau & Umbau',
    emoji: '🔨',
    autoTags: ['diy', 'anleitung', 'ausbau', 'umbau'],
    optionalTags: ['innenausbau', 'moebel', 'holz', 'design', 'planung'],
  },
  {
    id: 'diy-technik',
    name: 'DIY: Technik & Elektronik',
    emoji: '⚙️',
    autoTags: ['diy', 'anleitung', 'technik', 'elektronik'],
    optionalTags: ['elektrik', 'verdrahtung', '12v-system', 'led', 'arduino'],
  },
  {
    id: 'technik',
    name: 'Technik & Solar',
    emoji: '⚡',
    autoTags: ['technik', 'solar'],
    optionalTags: ['elektronik', 'strom', 'photovoltaik'],
  },
  // Strand/Ort-Gruppe (mojobusco/src/config/strandort.ts)
  {
    id: 'strandort-strand',
    name: 'Strand/Ort: Strand',
    emoji: '🏖️',
    autoTags: ['strand'],
    optionalTags: [],
  },
  {
    id: 'strandort-berg',
    name: 'Strand/Ort: Berg',
    emoji: '⛰️',
    autoTags: ['berg'],
    optionalTags: [],
  },
  {
    id: 'strandort-wald',
    name: 'Strand/Ort: Wald',
    emoji: '🌲',
    autoTags: ['wald'],
    optionalTags: [],
  },
  {
    id: 'strandort-meer',
    name: 'Strand/Ort: Meer',
    emoji: '🌊',
    autoTags: ['meer'],
    optionalTags: [],
  },
  {
    id: 'strandort-ort',
    name: 'Strand/Ort: Ort',
    emoji: '📍',
    autoTags: ['ort'],
    optionalTags: [],
  },
];

const RVLIFE_SUBCATEGORIES: TargetSubcategory[] = [
  {
    id: 'rvlife-kueche-essen',
    name: 'Küche & Essen',
    emoji: '🍳',
    autoTags: ['rv-life', 'wohnmobil', 'rvlife', 'camper', 'kueche-essen', 'kochen'],
    optionalTags: ['backen', 'rezepte', 'kochgeraete', 'kuechenausstattung'],
  },
  {
    id: 'rvlife-ausstattung',
    name: 'Ausstattung',
    emoji: '🏠',
    autoTags: ['rv-life', 'wohnmobil', 'rvlife', 'camper', 'ausstattung'],
    optionalTags: ['kuechenausstattung', 'badausstattung', 'storage', 'stauraum'],
  },
  {
    id: 'rvlife-freeliving',
    name: 'Freeliving',
    emoji: '🕊️',
    autoTags: ['rv-life', 'wohnmobil', 'rvlife', 'camper', 'freeliving', 'nomad'],
    optionalTags: ['digital-nomad', 'freedom', 'minimalismus', 'community'],
  },
  {
    id: 'rvlife-lifestyle',
    name: 'Lifestyle',
    emoji: '✨',
    autoTags: ['rv-life', 'wohnmobil', 'rvlife', 'camper', 'lifestyle', 'wellness'],
    optionalTags: ['mode', 'fashion', 'gesundheit', 'fitness', 'yoga', 'meditation'],
  },
];

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
    subcategories: ARTICLE_SUBCATEGORIES,
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
    subcategories: RVLIFE_SUBCATEGORIES,
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
    subcategories: [],
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
    subcategories: [],
  },
];

export function getTargetCategory(id: string): TargetCategory | undefined {
  return TARGET_CATEGORIES.find(c => c.id === id);
}

export function getTargetCategoryName(id: string): string {
  return getTargetCategory(id)?.name || id;
}

/**
 * Findet eine Unterkategorie über alle Hauptkategorien hinweg
 * (IDs sind global eindeutig, z.B. 'rvlife-kueche-essen', 'strandort-strand')
 */
export function getSubcategoryById(id: string): TargetSubcategory | undefined {
  for (const category of TARGET_CATEGORIES) {
    const sub = category.subcategories.find(s => s.id === id);
    if (sub) return sub;
  }
  return undefined;
}

export function getSubcategoryName(id?: string): string {
  if (!id) return '';
  return getSubcategoryById(id)?.name || id;
}
