/**
 * Standard-Zuordnung: WordPress-Kategorie (mojobus.org) → mojobus.co-Zielkategorie
 *
 * Basierend auf den Live-Kategorien von mojobus.org (wp-json/wp/v2/categories).
 * Kann im UI pro Kategorie überschrieben werden.
 */

import type { CategoryMapping } from './types';
import { TARGET_CATEGORIES } from './TargetCategories';

interface DefaultMappingEntry {
  slug: string;
  targetId: string;
  extraTags: string[];
  enabled: boolean;
}

/**
 * Standard-Mapping nach WP-Slug.
 * 'status' und 'bilder-des-tages' sind standardmäßig deaktiviert (Kurz-Updates/Fotos).
 */
const DEFAULT_MAPPING: DefaultMappingEntry[] = [
  { slug: 'leben-im-wohnmobil', targetId: 'articles', extraTags: ['rvlife', 'ausstattung'], enabled: true },
  { slug: 'wohnmobil-reiseberichte', targetId: 'articles', extraTags: ['reisen', 'europa'], enabled: true },
  { slug: 'selbstausbau', targetId: 'articles', extraTags: ['ausbau', 'technik'], enabled: true },
  { slug: 'womo-leben', targetId: 'articles', extraTags: ['leben', 'vanlife'], enabled: true },
  { slug: 'wohlfuehlen', targetId: 'articles', extraTags: ['leben'], enabled: true },
  { slug: 'weblog', targetId: 'articles', extraTags: ['leben'], enabled: true },
  { slug: 'persoenliches', targetId: 'articles', extraTags: ['leben'], enabled: true },
  { slug: 'tagebuch', targetId: 'articles', extraTags: ['leben'], enabled: true },
  { slug: 'rumtreiberin', targetId: 'articles', extraTags: ['leben', 'vanlife'], enabled: true },
  { slug: 'wohnmobil-tipps-tricks', targetId: 'rvlife', extraTags: ['freeliving', 'ausstattung'], enabled: true },
  { slug: 'womo-tipps-tricks', targetId: 'rvlife', extraTags: ['ausstattung', 'freeliving'], enabled: true },
  { slug: 'digitale-nomaden', targetId: 'rvlife', extraTags: ['digital-nomad', 'nomade'], enabled: true },
  { slug: 'stellplatz', targetId: 'places', extraTags: ['stellplatz'], enabled: true },
  { slug: 'gallery', targetId: 'articles', extraTags: ['vanlife', 'camping'], enabled: true },
  // Standardmäßig übersprungen:
  { slug: 'status', targetId: 'articles', extraTags: ['leben'], enabled: false },
  { slug: 'bilder-des-tages', targetId: 'articles', extraTags: [], enabled: false },
];

const FALLBACK: DefaultMappingEntry = {
  slug: '',
  targetId: 'articles',
  extraTags: [],
  enabled: true,
};

function entryFor(slug: string): DefaultMappingEntry {
  return DEFAULT_MAPPING.find(m => m.slug === slug) || { ...FALLBACK, slug };
}

/**
 * Erstellt CategoryMappings für geladene WP-Kategorien
 * (bestehende Mappings mit gleicher ID bleiben erhalten)
 */
export function buildDefaultMappings(
  wpCategories: { id: number | string; slug: string }[],
  existing: CategoryMapping[] = []
): CategoryMapping[] {
  return wpCategories.map(cat => {
    const existingMapping = existing.find(m => m.wpCategoryId === String(cat.id));
    if (existingMapping) return existingMapping;

    const def = entryFor(cat.slug);
    return {
      wpCategoryId: String(cat.id),
      wpCategorySlug: cat.slug,
      targetId: def.targetId,
      extraTags: [...def.extraTags],
      enabled: def.enabled,
    };
  });
}

/**
 * Wendet das Mapping auf einen Artikel an:
 * - Zielkategorie = Mapping der ersten (nach Reihenfolge) aktiv gemappten Kategorie des Artikels
 * - extraTags = Vereinigung aller Extra-Tags der gemappten Kategorien
 *
 * @returns null wenn keine aktive Zuordnung existiert (Artikel wird übersprungen)
 */
export function resolveMappingForPost(
  postCategoryIds: string[],
  mappings: CategoryMapping[]
): { targetId: string; extraTags: string[] } | null {
  let targetId: string | null = null;
  const extraTags = new Set<string>();

  for (const catId of postCategoryIds) {
    const mapping = mappings.find(m => m.wpCategoryId === catId && m.enabled);
    if (!mapping) continue;
    if (!targetId) targetId = mapping.targetId;
    mapping.extraTags.forEach(t => extraTags.add(t));
  }

  if (!targetId) return null;
  return { targetId, extraTags: Array.from(extraTags) };
}

/**
 * Prüft ob ein Zielkategorie-ID gültig ist
 */
export function isValidTargetCategory(id: string): boolean {
  return TARGET_CATEGORIES.some(c => c.id === id);
}
