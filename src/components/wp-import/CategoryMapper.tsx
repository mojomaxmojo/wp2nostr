/**
 * CategoryMapper Komponente
 * Ordnet WordPress-Kategorien den mojobus.co-Zielkategorien zu.
 * Die Zielkategorien entsprechen der mojobus.co-Struktur (Artikel, RV Life,
 * Leon Story, Plätze) — mojobus.co-Code wird nicht verändert.
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { FolderOpen, RotateCcw } from 'lucide-react';
import type { WPCategory } from '@/modules/parser/WordPressRestClient';
import type { CategoryMapping } from '@/modules/config/types';
import { TARGET_CATEGORIES, getTargetCategory } from '@/modules/config/TargetCategories';

export interface CategoryMapperProps {
  categories: WPCategory[];
  mappings: Record<string, CategoryMapping>;
  onChange: (mappings: Record<string, CategoryMapping>) => void;
  onResetMapping: () => void;
}

export function CategoryMapper({ categories, mappings, onChange, onResetMapping }: CategoryMapperProps) {
  const updateMapping = (wpCategoryId: string, updates: Partial<CategoryMapping>) => {
    const current = mappings[wpCategoryId];
    if (!current) return;
    onChange({
      ...mappings,
      [wpCategoryId]: { ...current, ...updates },
    });
  };

  const toggleTag = (wpCategoryId: string, tag: string) => {
    const current = mappings[wpCategoryId];
    if (!current) return;
    const has = current.extraTags.includes(tag);
    updateMapping(wpCategoryId, {
      extraTags: has
        ? current.extraTags.filter(t => t !== tag)
        : [...current.extraTags, tag],
    });
  };

  const resetOne = (wpCategoryId: string) => {
    const current = mappings[wpCategoryId];
    if (!current) return;
    onChange({ ...mappings, [wpCategoryId]: { ...current, extraTags: [] } });
  };

  if (categories.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FolderOpen className="h-10 w-10 mx-auto mb-3 opacity-50" />
        <p>Noch keine Kategorien geladen.</p>
      </div>
    );
  }

  const enabledCount = categories.filter(c => mappings[String(c.id)]?.enabled).length;
  const totalPosts = categories.reduce((sum, c) => sum + (mappings[String(c.id)]?.enabled ? c.count : 0), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Kategorien zuordnen (mojobus.co-Ziele)</span>
          <Button variant="outline" size="sm" onClick={onResetMapping}>
            <RotateCcw className="h-4 w-4 mr-1" />
            Mapping zurücksetzen
          </Button>
        </CardTitle>
        <CardDescription>
          {enabledCount} von {categories.length} Kategorien aktiv · {totalPosts} Artikel werden geladen.
          Jede WordPress-Kategorie wird einer mojobus.co-Kategorie zugeordnet (bestimmt Pflicht-Tags & Anzeigeort).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="max-h-[28rem] overflow-y-auto pr-2">
          <div className="space-y-3">
            {categories.map((category) => {
              const mapping = mappings[String(category.id)];
              if (!mapping) return null;
              const target = getTargetCategory(mapping.targetId);
              const sub = mapping.subcategoryId
                ? target?.subcategories.find(s => s.id === mapping.subcategoryId)
                : undefined;
              const subcategoryId = sub?.id;
              // Optional-Tags: Unterkategorie bevorzugt, sonst Hauptkategorie
              const optionalTagSource = sub ? sub.optionalTags : (target?.optionalTags || []);

              return (
                <div
                  key={category.id}
                  className={cn(
                    'rounded-lg border p-3 space-y-3 transition-opacity',
                    mapping.enabled ? 'opacity-100' : 'opacity-50'
                  )}
                >
                  <div className="flex items-center gap-3 flex-wrap">
                    <Switch
                      checked={mapping.enabled}
                      onCheckedChange={(checked) => updateMapping(String(category.id), { enabled: checked })}
                      aria-label={`Kategorie ${category.name} aktivieren`}
                    />
                    <div className="flex-1 min-w-40">
                      <Label className="font-medium">{category.name}</Label>
                      <p className="text-xs text-muted-foreground">/{category.slug}</p>
                    </div>
                    <Badge variant="secondary">{category.count} Beiträge</Badge>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap ml-9">
                    <Select
                      value={mapping.targetId}
                      onValueChange={(value) => {
                        // Unterkategorie verwerfen, wenn sie zur neuen Hauptkategorie nicht passt
                        const newTarget = getTargetCategory(value);
                        const subStillValid = newTarget?.subcategories.some(s => s.id === mapping.subcategoryId);
                        updateMapping(String(category.id), {
                          targetId: value,
                          subcategoryId: subStillValid ? mapping.subcategoryId : undefined,
                        });
                      }}
                      disabled={!mapping.enabled}
                    >
                      <SelectTrigger className="w-56">
                        <SelectValue placeholder="Zielkategorie" />
                      </SelectTrigger>
                      <SelectContent>
                        {TARGET_CATEGORIES.map((tc) => (
                          <SelectItem key={tc.id} value={tc.id}>
                            {tc.icon} {tc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {target && target.subcategories.length > 0 && (
                      <Select
                        value={mapping.subcategoryId || 'none'}
                        onValueChange={(value) => updateMapping(String(category.id), { subcategoryId: value === 'none' ? undefined : value })}
                        disabled={!mapping.enabled}
                      >
                        <SelectTrigger className="w-56">
                          <SelectValue placeholder="Unterkategorie" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— keine Unterkategorie —</SelectItem>
                          {target.subcategories.map((sub) => (
                            <SelectItem key={sub.id} value={sub.id}>
                              {sub.emoji} {sub.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => resetOne(String(category.id))}
                      disabled={!mapping.enabled || mapping.extraTags.length === 0}
                      title="Extra-Tags entfernen"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {/* Ziel-Route + Pflicht-Tags anzeigen */}
                  {target && (
                    <div className="ml-9 flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className="text-xs" style={{ borderColor: target.color }}>
                        {target.route}
                      </Badge>
                      {target.requiredTags.map(tag => (
                        <Badge key={tag} variant="default" className="text-xs">
                          #{tag}
                        </Badge>
                      ))}
                      {/* Auto-Tags der Unterkategorie (immer gesetzt) */}
                      {subcategoryId && sub && sub.autoTags.map(tag => (
                        <Badge key={tag} variant="default" className="text-xs opacity-80" title="Automatisch durch Unterkategorie">
                          #{tag} ✓
                        </Badge>
                      ))}
                      {mapping.extraTags.map(tag => (
                        <button
                          key={tag}
                          onClick={() => toggleTag(String(category.id), tag)}
                          className="focus:outline-none"
                          title="Tag entfernen"
                          disabled={!mapping.enabled}
                        >
                          <Badge variant="secondary" className="text-xs cursor-pointer hover:bg-secondary/80">
                            #{tag} ×
                          </Badge>
                        </button>
                      ))}
                      {/* Verfügbare optionale Tags zum Hinzufügen (Unterkategorie bevorzugt) */}
                      {mapping.enabled && optionalTagSource
                        .filter(tag => !mapping.extraTags.includes(tag))
                        .slice(0, 12)
                        .map(tag => (
                          <button
                            key={tag}
                            onClick={() => toggleTag(String(category.id), tag)}
                            className="focus:outline-none"
                            title="Tag hinzufügen"
                          >
                            <Badge variant="outline" className="text-xs cursor-pointer hover:bg-accent">
                              + {tag}
                            </Badge>
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
