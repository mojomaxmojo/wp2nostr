/**
 * Standard-Zuordnung: WordPress-Kategorie (mojobus.org) → mojobus.co-Zielkategorie
 * inkl. Unterkategorien (mojobus.co-Untermenüs).
 *
 * Basierend auf den Live-Kategorien von mojobus.org (wp-json/wp/v2/categories).
 * Kann im UI pro Kategorie überschrieben werden.
 */

import type { CategoryMapping } from './types';
import { TARGET_CATEGORIES, getSubcategoryById } from './TargetCategories';

interface DefaultMappingEntry {
  slug: string;
  targetId: string;
  /** mojobus.co-Unterkategorie (ARTICLE_CATEGORIES-ID) */
  subcategoryId?: string;
  extraTags: string[];
  enabled: boolean;
}

/**
 * Standard-Mapping nach WP-Slug.
 * 'status' und 'bilder-des-tages' sind standardmäßig deaktiviert (Kurz-Updates/Fotos).
 */
const DEFAULT_MAPPING: DefaultMappingEntry[] = [
  { slug: 'leben-im-wohnmobil', targetId: 'articles', subcategoryId: 'leben', extraTags: ['rvlife', 'ausstattung'], enabled: true },
  { slug: 'wohnmobil-reiseberichte', targetId: 'articles', subcategoryId: 'reisen', extraTags: ['europa'], enabled: true },
  { slug: 'selbstausbau', targetId: 'articles', subcategoryId: 'diy-ausbau', extraTags: [], enabled: true },
  { slug: 'womo-leben', targetId: 'articles', subcategoryId: 'vanlife', extraTags: ['leben'], enabled: true },
  { slug: 'wohlfuehlen', targetId: 'rvlife', subcategoryId: 'rvlife-lifestyle', extraTags: [], enabled: true },
  { slug: 'weblog', targetId: 'articles', subcategoryId: 'leben', extraTags: [], enabled: true },
  { slug: 'persoenliches', targetId: 'articles', subcategoryId: 'erfahrung', extraTags: [], enabled: true },
  { slug: 'tagebuch', targetId: 'articles', subcategoryId: 'erfahrung', extraTags: ['leben'], enabled: true },
  { slug: 'rumtreiberin', targetId: 'articles', subcategoryId: 'erfahrung', extraTags: ['vanlife'], enabled: true },
  { slug: 'wohnmobil-tipps-tricks', targetId: 'rvlife', subcategoryId: 'rvlife-ausstattung', extraTags: ['freeliving'], enabled: true },
  { slug: 'womo-tipps-tricks', targetId: 'rvlife', subcategoryId: 'rvlife-ausstattung', extraTags: ['freeliving'], enabled: true },
  { slug: 'digitale-nomaden', targetId: 'rvlife', subcategoryId: 'rvlife-freeliving', extraTags: ['digital-nomad'], enabled: true },
  { slug: 'stellplatz', targetId: 'places', extraTags: ['stellplatz'], enabled: true },
  { slug: 'gallery', targetId: 'articles', subcategoryId: 'vanlife', extraTags: ['camping'], enabled: true },
  // Standardmäßig übersprungen:
  { slug: 'status', targetId: 'articles', subcategoryId: 'erfahrung', extraTags: ['leben'], enabled: false },
  { slug: 'bilder-des-tages', targetId: 'articles', subcategoryId: 'vanlife', extraTags: [], enabled: false },
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
      subcategoryId: def.subcategoryId,
      extraTags: [...def.extraTags],
      enabled: def.enabled,
    };
  });
}

/**
 * Wendet das Mapping auf einen Artikel an:
 * - Zielkategorie = Mapping der ersten (nach Reihenfolge) aktiv gemappten Kategorie des Artikels
 * - Unterkategorie + extraTags = Vereinigung der gemappten Kategorien
 *
 * @returns null wenn keine aktive Zuordnung existiert (Artikel wird übersprungen)
 */
export function resolveMappingForPost(
  postCategoryIds: string[],
  mappings: CategoryMapping[]
): { targetId: string; subcategoryId?: string; extraTags: string[] } | null {
  let targetId: string | null = null;
  let subcategoryId: string | undefined;
  const extraTags = new Set<string>();

  for (const catId of postCategoryIds) {
    const mapping = mappings.find(m => m.wpCategoryId === catId && m.enabled);
    if (!mapping) continue;
    if (!targetId) {
      targetId = mapping.targetId;
      subcategoryId = mapping.subcategoryId;
    }
    mapping.extraTags.forEach(t => extraTags.add(t));
  }

  if (!targetId) return null;
  return { targetId, subcategoryId, extraTags: Array.from(extraTags) };
}

/**
 * Prüft ob eine Unterkategorie zur gewählten Hauptkategorie passt
 */
export function isSubcategoryValidForTarget(subcategoryId: string | undefined, targetId: string): boolean {
  if (!subcategoryId) return true;
  const sub = getSubcategoryById(subcategoryId);
  if (!sub) return false;
  const target = TARGET_CATEGORIES.find(c => c.id === targetId);
  return Boolean(target?.subcategories.some(s => s.id === subcategoryId));
}

/**
 * Prüft ob ein Zielkategorie-ID gültig ist
 */
export function isValidTargetCategory(id: string): boolean {
  return TARGET_CATEGORIES.some(c => c.id === id);
}
