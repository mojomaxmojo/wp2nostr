/**
 * WordPress Import Page
 * Importiert Artikel direkt von der WordPress-REST-API (mojobus.org)
 * und veröffentlicht sie als mojobus.co-kompatible NIP-23 Artikel.
 *
 * Flow: Kategorien laden → Zielkategorien zuordnen → Artikel laden →
 *       Medien zu Blossom → Veröffentlichen (oder Dry-Run)
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { ProgressIndicator, type ProgressStep } from '@/components/progress/ProgressIndicator';
import { ArticlePreview } from '@/components/article-preview/ArticlePreview';
import { CategoryMapper } from '@/components/wp-import/CategoryMapper';
import { SettingsPanel } from '@/components/wp-import/SettingsPanel';
import {
  fetchWPCategories,
  fetchWPPosts,
  type WPCategory,
} from '@/modules/parser/WordPressRestClient';
import { parseWordPressXML, type WordPressPost } from '@/modules/parser/WordPressParser';
import { convertHTMLToMarkdown, validateMarkdown } from '@/modules/converter/HTMLToMarkdown';
import { uploadFiles, validateFileForUpload, type UploadProgress } from '@/modules/uploader/BlossomUploader';
import {
  downloadMedias,
  extractImageUrlsFromArticle,
  replaceUrlsInMarkdown,
} from '@/modules/uploader/MediaDownloader';
import {
  publishArticles,
  buildArticleTags,
  buildDTag,
} from '@/modules/publisher/NostrPublisher';
import { resolveMappingForPost, buildDefaultMappings } from '@/modules/config/CategoryMapping';
import { loadConfig, saveConfig, type ImportConfig } from '@/modules/config/ConfigManager';
import {
  loadImportIndex,
  markImported,
  clearImportIndex,
  importIndexStats,
} from '@/modules/import/ImportIndex';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostr } from '@nostrify/react';
import { LoginArea } from '@/components/auth/LoginArea';
import { useToast } from '@/hooks/useToast';
import {
  FileText,
  Image as ImageIcon,
  Play,
  AlertCircle,
  FolderOpen,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  Download,
  FlaskConical,
  ExternalLink,
  Trash2,
} from 'lucide-react';

// mojobus.co Autoren (nur diese erscheinen auf mojobus.co und dürfen
// auf relay.mojobus.co hochladen)
const MOJOBUS_AUTHORS: Record<string, string> = {
  '4d584dab7c880a9809e7df0476d745bfe9a3fe91a1c062bc1fec024e0b5e1f1f': 'mojo (Max)',
  '94ebd1c0940881de438b7f3c532b73e0d4d6c6b0160d3fe0b8a55fe49d477bd4': 'susanne',
};

interface ConvertedArticle {
  post: WordPressPost;
  markdown: string;
  valid: boolean;
  errors: string[];
  selected: boolean;
  mediaUrls: Map<string, string>; // Original URL -> Blossom URL
  featuredBlossomUrl?: string; // Titelbild → Blossom URL
  targetCategoryId: string;
  extraTags: string[];
  dTag: string;
  alreadyImported: boolean;
  uploadResults?: {
    success: number;
    failed: number;
  };
}

interface PublishOutcome {
  title: string;
  dTag: string;
  naddr?: string;
  success: boolean;
  dryRun: boolean;
  relayCount: number;
}

function mappingsToRecord(mappings: { wpCategoryId: string }[]) {
  const record: Record<string, (typeof mappings)[number]> = {};
  for (const m of mappings) record[m.wpCategoryId] = m;
  return record;
}

export function WPImportPage() {
  const { toast } = useToast();
  const { user } = useCurrentUser();
  const { nostr } = useNostr();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [config, setConfigState] = useState<ImportConfig>(loadConfig());
  const setConfig = (next: ImportConfig) => {
    setConfigState(next);
    saveConfig(next);
  };

  // REST-Import
  const [wpCategories, setWpCategories] = useState<WPCategory[]>([]);
  const [mappings, setMappings] = useState<Record<string, ImportConfig['categoryMapping'][number]>>({});
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);

  // Artikel
  const [convertedArticles, setConvertedArticles] = useState<Map<string, ConvertedArticle>>(new Map());
  const [isUploading, setIsUploading] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [publishResults, setPublishResults] = useState<PublishOutcome[]>([]);

  // Import-Index (Dedup)
  const [indexStats, setIndexStats] = useState(importIndexStats());

  // Progress
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([]);
  const [totalProgress, setTotalProgress] = useState(0);

  const updateProgress = useCallback((step: Partial<ProgressStep>) => {
    setProgressSteps(prev => {
      const newSteps = [...prev];
      const lastIndex = newSteps.length - 1;
      if (lastIndex >= 0) {
        newSteps[lastIndex] = { ...newSteps[lastIndex], ...step };
      }
      return newSteps;
    });
  }, []);

  const addProgressStep = useCallback((name: string, status: ProgressStep['status'] = 'pending') => {
    setProgressSteps(prev => [...prev, { name, status }]);
  }, []);

  const resetProgress = useCallback(() => {
    setProgressSteps([]);
    setTotalProgress(0);
  }, []);

  // ==========================================================================
  // Schritt 1: Kategorien von der Quelle laden
  // ==========================================================================

  const handleLoadCategories = async () => {
    setIsLoadingCategories(true);
    resetProgress();
    addProgressStep('Kategorien laden', 'in-progress');

    try {
      const categories = await fetchWPCategories(config.sourceSite, config.corsProxy);
      setWpCategories(categories);

      // Mappings (bestehende behalten, neue mit Defaults befüllen)
      const existing = Object.values(mappings);
      const built = buildDefaultMappings(categories, existing);
      setMappings(mappingsToRecord(built));

      updateProgress({
        status: 'completed',
        message: `${categories.length} Kategorien geladen (insgesamt ${categories.reduce((s, c) => s + c.count, 0)} Beiträge)`,
      });
    } catch (error) {
      console.error('Fehler beim Laden der Kategorien:', error);
      updateProgress({
        status: 'failed',
        message: error instanceof Error ? error.message : 'Unbekannter Fehler',
      });
      toast({
        title: 'Fehler',
        description: `Kategorien konnten nicht geladen werden: ${error instanceof Error ? error.message : ''}`,
        variant: 'destructive',
      });
    } finally {
      setIsLoadingCategories(false);
    }
  };

  const handleResetMapping = () => {
    const built = buildDefaultMappings(wpCategories, []);
    setMappings(mappingsToRecord(built));
    toast({ title: 'Mapping zurückgesetzt', description: 'Standard-Zuordnungen wiederhergestellt.' });
  };

  // ==========================================================================
  // Schritt 2: Artikel der aktiven Kategorien laden & konvertieren
  // ==========================================================================

  const handleLoadArticles = async () => {
    const enabledMappings = Object.values(mappings).filter(m => m.enabled);
    if (enabledMappings.length === 0) {
      toast({
        title: 'Keine Kategorien aktiv',
        description: 'Aktivieren Sie mindestens eine Kategorie im Mapping',
        variant: 'destructive',
      });
      return;
    }

    setIsLoadingPosts(true);
    resetProgress();
    setPublishResults([]);
    addProgressStep('Artikel laden', 'in-progress');

    try {
      const categoryIds = enabledMappings.map(m => m.wpCategoryId);
      const { posts, total } = await fetchWPPosts({
        site: config.sourceSite,
        categoryIds,
        corsProxy: config.corsProxy,
        onProgress: (loaded, t) => {
          updateProgress({
            message: `${loaded}/${t} Artikel geladen`,
            percentage: t > 0 ? Math.round((loaded / t) * 50) : 0,
          });
        },
      });

      updateProgress({
        message: `${posts.length}/${total} Artikel geladen`,
        percentage: 50,
      });

      addProgressStep('Artikel konvertieren', 'in-progress');

      // Mapping-Lookup über Kategorienamen: REST liefert Namen, das Mapping
      // läuft über IDs. Daher bauen wir pro Post die ID-Liste aus der
      // geladenen Kategorie-Liste (Name → ID).
      const nameToId = new Map<string, string>();
      wpCategories.forEach(c => nameToId.set(c.name.toLowerCase(), String(c.id)));

      const index = loadImportIndex();
      const articles = new Map<string, ConvertedArticle>();
      let convertedCount = 0;

      for (const post of posts) {
        try {
          // Kategorienamen → WP-IDs für das Mapping
          const categoryIdsForPost = post.categories
            .map(name => nameToId.get(name.toLowerCase()))
            .filter((id): id is string => Boolean(id));

          const resolved = resolveMappingForPost(categoryIdsForPost, Object.values(mappings))
            || { targetId: config.defaultTargetCategory, extraTags: [] };

          const markdown = convertHTMLToMarkdown(post.content, {
            removeWordPressShortcodes: config.removeWordPressShortcodes,
            preserveImages: true,
            preserveLinks: true,
            convertYouTubeEmbeds: true,
          });
          const validation = validateMarkdown(markdown);

          const alreadyImported = Boolean(index[post.postId]);

          articles.set(post.postId, {
            post,
            markdown,
            valid: validation.valid,
            errors: validation.errors,
            // Bereits importierte standardmäßig abwählen (skipImported)
            selected: !(config.skipImported && alreadyImported),
            mediaUrls: new Map(),
            targetCategoryId: resolved.targetId,
            extraTags: resolved.extraTags,
            dTag: buildDTag(post.postId, post.slug),
            alreadyImported,
          });

          convertedCount++;
          updateProgress({
            message: `${convertedCount}/${posts.length} Artikel konvertiert`,
            percentage: 50 + Math.round((convertedCount / posts.length) * 50),
          });
        } catch (error) {
          console.error(`Fehler beim Konvertieren von Post ${post.postId}:`, error);
        }
      }

      setConvertedArticles(articles);
      updateProgress({
        status: 'completed',
        message: `${articles.size} Artikel konvertiert, ${Array.from(articles.values()).filter(a => a.alreadyImported).length} bereits importiert`,
      });
      setTotalProgress(100);

      toast({
        title: 'Artikel geladen',
        description: `${articles.size} Artikel gefunden (${Array.from(articles.values()).filter(a => a.alreadyImported).length} bereits importiert)`,
      });
    } catch (error) {
      console.error('Fehler beim Laden der Artikel:', error);
      updateProgress({
        status: 'failed',
        message: error instanceof Error ? error.message : 'Unbekannter Fehler',
      });
      toast({
        title: 'Fehler',
        description: error instanceof Error ? error.message : 'Artikel konnten nicht geladen werden',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingPosts(false);
    }
  };

  // ==========================================================================
  // Schritt 3: Medien herunterladen & zu Blossom hochladen (Pipeline)
  // Wird manuell über den Button und automatisch beim Veröffentlichen genutzt
  // ==========================================================================

  /**
   * Sammelt noch nicht hochgeladene Bild-URLs (Inhalt + Titelbild)
   * aus den ausgewählten Artikeln
   */
  const collectPendingMedia = (articlesMap: Map<string, ConvertedArticle>): Set<string> => {
    const pending = new Set<string>();
    articlesMap.forEach((article) => {
      if (!article.selected) return;
      const urls = extractImageUrlsFromArticle(article.post.content);
      if (article.post.featuredImageUrl) urls.push(article.post.featuredImageUrl);
      for (const url of urls) {
        if (!article.mediaUrls.has(url)) pending.add(url);
      }
    });
    return pending;
  };

  /**
   * Media-Pipeline: sammeln → herunterladen → zu Blossom → URLs ersetzen.
   * Gibt eine aktualisierte Article-Map zurück (State wird NICHT gesetzt).
   */
  const runMediaPipeline = async (
    articlesMap: Map<string, ConvertedArticle>
  ): Promise<{
    articles: Map<string, ConvertedArticle>;
    foundCount: number;
    downloadedCount: number;
    uploadedCount: number;
  }> => {
    const pendingUrls = collectPendingMedia(articlesMap);
    const foundCount = pendingUrls.size;

    if (foundCount === 0) {
      return { articles: articlesMap, foundCount: 0, downloadedCount: 0, uploadedCount: 0 };
    }

    updateProgress({ message: `${foundCount} Medien gefunden`, percentage: 0 });

    // Medien herunterladen (via CORS-Proxy-Fallback)
    const downloadedMedias = await downloadMedias(
      Array.from(pendingUrls),
      (progress) => {
        updateProgress({
          message: `${progress.completed}/${progress.total} Medien heruntergeladen`,
          percentage: Math.round((progress.completed / progress.total) * 50),
        });
      },
      config.corsProxy
    );

    updateProgress({
      status: 'completed',
      message: `${downloadedMedias.length}/${foundCount} Medien heruntergeladen`,
    });

    if (downloadedMedias.length === 0) {
      return { articles: articlesMap, foundCount, downloadedCount: 0, uploadedCount: 0 };
    }

    // Zu Blossom hochladen (relay.mojobus.co + primal Backup)
    addProgressStep('Medien zu Blossom hochladen', 'in-progress');

    const uploadResults = await uploadFiles(
      downloadedMedias.map(m => m.file),
      {
        servers: config.blossomServers,
        maxRetries: 3,
        timeout: 120000,
      },
      (progress: UploadProgress) => {
        updateProgress({
          message: `${progress.completed}/${progress.total} Medien hochgeladen`,
          percentage: 50 + Math.round((progress.completed / progress.total) * 50),
        });
        setTotalProgress(progress.percentage);
      },
      user?.signer
    );

    // URL-Map erstellen (Original URL -> Blossom URL)
    const urlMap = new Map<string, string>();
    uploadResults.forEach((result, index) => {
      urlMap.set(downloadedMedias[index].originalUrl, result.url);
    });

    // URLs in Markdown ersetzen + Titelbilder mappen
    addProgressStep('URLs ersetzen', 'in-progress');
    const updatedArticles = new Map<string, ConvertedArticle>();

    articlesMap.forEach((article, postId) => {
      if (article.selected) {
        // Bisherige Merges beibehalten + neue hinzufügen
        const mergedMap = new Map<string, string>([...article.mediaUrls, ...urlMap]);
        const updatedMarkdown = replaceUrlsInMarkdown(article.markdown, urlMap);
        const featuredBlossom = article.post.featuredImageUrl
          ? mergedMap.get(article.post.featuredImageUrl)
          : undefined;
        updatedArticles.set(postId, {
          ...article,
          markdown: updatedMarkdown,
          featuredBlossomUrl: featuredBlossom,
          mediaUrls: mergedMap,
        });
      } else {
        updatedArticles.set(postId, article);
      }
    });

    return { articles: updatedArticles, foundCount, downloadedCount: downloadedMedias.length, uploadedCount: uploadResults.length };
  };

  const handleUploadMedia = async () => {
    if (!user || !user.signer) {
      toast({
        title: 'Nicht eingeloggt',
        description: 'Bitte loggen Sie sich ein um Medien hochzuladen',
        variant: 'destructive',
      });
      return;
    }

    if (!config.uploadMedia) {
      toast({
        title: 'Upload deaktiviert',
        description: 'Aktivieren Sie den Media-Upload in den Einstellungen',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);
    resetProgress();
    addProgressStep('Medien herunterladen', 'in-progress');

    try {
      const result = await runMediaPipeline(convertedArticles);

      if (result.foundCount === 0) {
        updateProgress({ status: 'completed', message: 'Keine Medien zum Hochladen' });
        toast({ title: 'Keine Medien', description: 'Die ausgewählten Artikel enthalten keine neuen Bilder.' });
        return;
      }

      setConvertedArticles(result.articles);

      if (result.uploadedCount === 0) {
        updateProgress({ status: 'failed', message: 'Keine Medien konnten heruntergeladen werden' });
        toast({
          title: 'Keine Medien',
          description: 'Keine Medien konnten heruntergeladen werden',
          variant: 'destructive',
        });
        return;
      }

      updateProgress({
        status: 'completed',
        message: `${result.uploadedCount} Medien erfolgreich zu Blossom hochgeladen`,
      });
      setTotalProgress(100);

      toast({
        title: 'Upload abgeschlossen',
        description: `${result.uploadedCount} Medien erfolgreich hochgeladen`,
      });
    } catch (error) {
      console.error('Fehler beim Hochladen:', error);
      updateProgress({ status: 'failed', message: error instanceof Error ? error.message : 'Upload fehlgeschlagen' });
      toast({
        title: 'Upload fehlgeschlagen',
        description: error instanceof Error ? error.message : 'Konnte Medien nicht hochladen',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  // ==========================================================================
  // Schritt 4: Veröffentlichen (NIP-23, mojobus.co-Schema)
  // ==========================================================================

  const handlePublish = async () => {
    if (!user || !user.signer) {
      toast({
        title: 'Nicht eingeloggt',
        description: 'Bitte loggen Sie sich ein um Artikel zu publishen',
        variant: 'destructive',
      });
      return;
    }

    if (!nostr) {
      toast({
        title: 'Fehler',
        description: 'Nostr-Verbindung nicht verfügbar',
        variant: 'destructive',
      });
      return;
    }

    // Vorauswahl zählen (für Bestätigungsdialog)
    const pendingSelection = Array.from(convertedArticles.values())
      .filter(a => a.selected && !(config.skipImported && a.alreadyImported && !config.dryRun));

    if (pendingSelection.length === 0) {
      toast({
        title: 'Keine Artikel ausgewählt',
        description: 'Bitte wählen Sie mindestens einen Artikel aus',
        variant: 'destructive',
      });
      return;
    }

    if (config.requireConfirmation && !config.dryRun) {
      const confirmed = confirm(
        `${pendingSelection.length} Artikel werden als ${MOJOBUS_AUTHORS[user.pubkey] || user.pubkey.slice(0, 8)} veröffentlicht.\n\nBilder werden automatisch zu Blossom hochgeladen. Fortfahren?`
      );
      if (!confirmed) return;
    }

    setIsPublishing(true);
    resetProgress();
    addProgressStep(config.dryRun ? 'Dry-Run: Events erzeugen' : 'Artikel veröffentlichen', 'in-progress');

    let currentArticles = convertedArticles;

    try {
      // Automatischer Media-Upload vor dem Veröffentlichen
      // (nicht im Dry-Run — dort wird nichts gesendet/hochgeladen)
      if (config.uploadMedia && !config.dryRun) {
        const pendingMediaCount = collectPendingMedia(currentArticles).size;
        if (pendingMediaCount > 0) {
          addProgressStep(`Medien automatisch hochladen (${pendingMediaCount})`, 'in-progress');
          try {
            const mediaResult = await runMediaPipeline(currentArticles);
            if (mediaResult.uploadedCount > 0) {
              currentArticles = mediaResult.articles;
              setConvertedArticles(currentArticles);
              updateProgress({
                status: 'completed',
                message: `${mediaResult.uploadedCount}/${mediaResult.foundCount} Medien automatisch hochgeladen`,
              });
            } else {
              updateProgress({
                status: 'completed',
                message: 'Media-Upload fehlgeschlagen — Artikel verwenden Original-URLs',
              });
              toast({
                title: 'Media-Upload fehlgeschlagen',
                description: 'Artikel werden mit den Original-Bild-URLs von mojobus.org veröffentlicht.',
                variant: 'destructive',
              });
            }
          } catch (mediaError) {
            console.error('Automatischer Media-Upload fehlgeschlagen:', mediaError);
            updateProgress({
              status: 'completed',
              message: 'Media-Upload fehlgeschlagen — Artikel verwenden Original-URLs',
            });
            toast({
              title: 'Media-Upload fehlgeschlagen',
              description: 'Artikel werden mit den Original-Bild-URLs von mojobus.org veröffentlicht.',
              variant: 'destructive',
            });
          }
        }
      }

      // Ausgewählte Artikel sammeln (mit ggf. aktualisierten Bild-URLs)
      const selectedArticles = Array.from(currentArticles.values())
        .filter(a => a.selected && !(config.skipImported && a.alreadyImported && !config.dryRun))
        .map((a) => {
          const tags = buildArticleTags({
            targetCategoryId: a.targetCategoryId,
            extraTags: a.extraTags,
            globalTags: config.globalTags,
            wpCategories: a.post.categories,
            wpTags: a.post.tags,
            preserveCategories: config.preserveCategories,
            preserveTags: config.preserveTags,
          });

          return {
            title: a.post.title,
            content: a.markdown,
            summary: a.post.excerpt,
            image: a.featuredBlossomUrl || a.post.featuredImageUrl,
            targetCategoryId: a.targetCategoryId,
            dTag: a.dTag,
            slug: a.post.slug,
            url: a.post.link,
            publishedAt: Math.floor(a.post.publishDate.getTime() / 1000),
            tags,
          };
        });

      if (selectedArticles.length === 0) {
        toast({
          title: 'Keine Artikel ausgewählt',
          description: 'Bitte wählen Sie mindestens einen Artikel aus',
          variant: 'destructive',
        });
        return;
      }

      const sign = async (event: Parameters<typeof user.signer.signEvent>[0]) => {
        return user.signer.signEvent(event);
      };

      const publishToRelay = async (relayUrl: string, event: Parameters<ReturnType<typeof nostr.relay>['event']>[0]) => {
        const relay = nostr.relay(relayUrl);
        await relay.event(event);
        return true;
      };

      const results = await publishArticles(
        selectedArticles,
        {
          posterName: config.posterName,
          posterWebsite: config.posterWebsite,
          relays: config.relays,
          postInterval: config.postInterval * 1000,
          preservePublishDate: config.preservePublishDate,
          dryRun: config.dryRun,
        },
        user.pubkey,
        sign as never,
        publishToRelay as never,
        (progress) => {
          updateProgress({
            message: config.dryRun
              ? `${Math.floor(progress.completed)}/${progress.total} Events erzeugt`
              : `${Math.floor(progress.completed)}/${progress.total} Artikel veröffentlicht`,
            percentage: progress.percentage,
          });
          setTotalProgress(progress.percentage);
        }
      );

      const successCount = results.filter(r => r.relays.some(relay => relay.success)).length;

      // Erfolgreiche Artikel in den Import-Index aufnehmen (kein Dry-Run)
      if (!config.dryRun) {
        for (const result of results) {
          const article = selectedArticles.find(a => a.dTag === result.articleId)
            ?? selectedArticles.find(a => result.event.tags.find(([n, v]) => n === 'd' && v === a.dTag));
          if (article) {
            const post = Array.from(currentArticles.values()).find(p => p.dTag === article.dTag);
            markImported({
              wpPostId: post?.post.postId || article.dTag,
              wpTitle: article.title,
              dTag: result.articleId,
              eventId: result.eventId,
              naddr: result.naddr,
              slug: article.slug,
              targetCategoryId: article.targetCategoryId,
              publishedAt: article.publishedAt,
              importedAt: Date.now(),
              dryRun: false,
            });
          }
        }
        setIndexStats(importIndexStats());
      }

      // Ergebnisse für die Anzeige aufbereiten
      const outcomes: PublishOutcome[] = results.map((r) => {
        const dTag = r.articleId;
        const article = selectedArticles.find(a => a.dTag === dTag)
          ?? selectedArticles.find(a => r.event.tags.find(([n, v]) => n === 'd' && v === a.dTag));
        return {
          title: article?.title || dTag,
          dTag,
          naddr: r.naddr,
          success: r.relays.some(relay => relay.success),
          dryRun: Boolean(config.dryRun),
          relayCount: r.relays.filter(relay => relay.success).length,
        };
      });
      setPublishResults(outcomes);

      updateProgress({
        status: 'completed',
        message: config.dryRun
          ? `${successCount}/${selectedArticles.length} Events erzeugt (nicht gesendet)`
          : `${successCount}/${selectedArticles.length} Artikel erfolgreich veröffentlicht`,
      });
      setTotalProgress(100);

      toast({
        title: config.dryRun ? 'Dry-Run abgeschlossen' : 'Veröffentlichung abgeschlossen',
        description: config.dryRun
          ? `${successCount} Events erzeugt — es wurde nichts gesendet`
          : `${successCount} Artikel erfolgreich auf Nostr veröffentlicht`,
      });
    } catch (error) {
      console.error('Fehler beim Veröffentlichen:', error);
      updateProgress({ status: 'failed', message: error instanceof Error ? error.message : 'Veröffentlichung fehlgeschlagen' });
      toast({
        title: 'Veröffentlichung fehlgeschlagen',
        description: error instanceof Error ? error.message : 'Konnte Artikel nicht veröffentlichen',
        variant: 'destructive',
      });
    } finally {
      setIsPublishing(false);
    }
  };

  // ==========================================================================
  // Fallback: XML-Import (alter Flow)
  // ==========================================================================

  const processXmlFile = async (file: File) => {
    if (!file.name.endsWith('.xml')) {
      toast({
        title: 'Fehler',
        description: 'Bitte laden Sie eine WordPress XML-Exportdatei hoch',
        variant: 'destructive',
      });
      return;
    }

    setIsLoadingPosts(true);
    resetProgress();
    setPublishResults([]);
    addProgressStep('WordPress XML parsen', 'in-progress');

    try {
      const content = await file.text();
      const data = await parseWordPressXML(content);
      updateProgress({ status: 'completed', message: `${data.posts.length} Artikel gefunden` });

      addProgressStep('Artikel konvertieren', 'in-progress');

      const index = loadImportIndex();
      const articles = new Map<string, ConvertedArticle>();
      let convertedCount = 0;

      for (const post of data.posts) {
        try {
          const markdown = convertHTMLToMarkdown(post.content, {
            removeWordPressShortcodes: config.removeWordPressShortcodes,
            preserveImages: true,
            preserveLinks: true,
            convertYouTubeEmbeds: true,
          });
          const validation = validateMarkdown(markdown);
          const alreadyImported = Boolean(index[post.postId]);

          articles.set(post.postId, {
            post,
            markdown,
            valid: validation.valid,
            errors: validation.errors,
            selected: !(config.skipImported && alreadyImported),
            mediaUrls: new Map(),
            targetCategoryId: config.defaultTargetCategory,
            extraTags: [],
            dTag: buildDTag(post.postId, post.slug),
            alreadyImported,
          });

          convertedCount++;
          updateProgress({
            message: `${convertedCount}/${data.posts.length} Artikel konvertiert`,
            percentage: Math.round((convertedCount / data.posts.length) * 100),
          });
        } catch (error) {
          console.error(`Fehler beim Konvertieren von Post ${post.postId}:`, error);
        }
      }

      setConvertedArticles(articles);
      updateProgress({
        status: 'completed',
        message: `${articles.size} Artikel erfolgreich konvertiert`,
      });
      setTotalProgress(100);

      toast({
        title: 'Erfolg',
        description: `${articles.size} Artikel aus XML konvertiert`,
      });
    } catch (error) {
      console.error('Fehler beim Importieren:', error);
      updateProgress({ status: 'failed', message: error instanceof Error ? error.message : 'Unbekannter Fehler' });
      toast({
        title: 'Fehler',
        description: error instanceof Error ? error.message : 'Konnte WordPress XML nicht parsen',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingPosts(false);
    }
  };

  const handleXmlFileInput = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await processXmlFile(file);
    if (event.target) event.target.value = '';
  };

  const handleXmlDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await processXmlFile(file);
  };

  // ==========================================================================
  // UI-Helfer
  // ==========================================================================

  const toggleArticle = (postId: string) => {
    setConvertedArticles(prev => {
      const next = new Map(prev);
      const article = next.get(postId);
      if (article) {
        next.set(postId, { ...article, selected: !article.selected });
      }
      return next;
    });
  };

  const selectAllArticles = (selected: boolean) => {
    setConvertedArticles(prev => {
      const next = new Map(prev);
      next.forEach((article, postId) => {
        next.set(postId, { ...article, selected });
      });
      return next;
    });
  };

  const articlesList = useMemo(() => Array.from(convertedArticles.values()), [convertedArticles]);
  const selectedCount = articlesList.filter(a => a.selected).length;
  const importedCount = articlesList.filter(a => a.alreadyImported).length;

  const clearIndex = () => {
    if (!confirm('Import-Index zurücksetzen? Alle Artikel gelten danach wieder als "nicht importiert" (Duplikate möglich).')) return;
    clearImportIndex();
    setIndexStats(importIndexStats());
    toast({ title: 'Import-Index zurückgesetzt' });
  };

  const authorBadge = user ? MOJOBUS_AUTHORS[user.pubkey] : undefined;

  return (
    <div className="container mx-auto py-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">WordPress zu Nostr Import</h1>
        <p className="text-muted-foreground">
          Importiert Artikel von {config.sourceSite.replace(/^https?:\/\//, '')} als mojobus.co-kompatible Long Form Articles (NIP-23)
        </p>
      </div>

      {/* Login-Hinweis mit Autor-Prüfung */}
      {!user ? (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-8 w-8 text-amber-500" />
                <div>
                  <h3 className="font-semibold">Anmeldung erforderlich</h3>
                  <p className="text-sm text-muted-foreground">
                    Wichtig: Als <strong>mojo</strong> oder <strong>susanne</strong> einloggen —
                    nur diese Autoren erscheinen auf mojobus.co und dürfen auf relay.mojobus.co hochladen.
                  </p>
                </div>
              </div>
              <LoginArea />
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                {authorBadge ? (
                  <ShieldCheck className="h-8 w-8 text-green-500" />
                ) : (
                  <ShieldAlert className="h-8 w-8 text-amber-500" />
                )}
                <div>
                  <h3 className="font-semibold">
                    {authorBadge
                      ? `Eingeloggt als ${authorBadge} — mojobus.co-Autor ✓`
                      : 'Fremder Account erkannt'}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {authorBadge
                      ? 'Artikel erscheinen auf mojobus.co, Blossom-Uploads auf relay.mojobus.co sind erlaubt.'
                      : 'Artikel erscheinen auf mojobus.co NICHT in den Artikellisten und relay.mojobus.co lehnt Uploads ab. Bitte als mojo oder susanne einloggen.'}
                  </p>
                </div>
              </div>
              <LoginArea />
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="import" className="space-y-4">
        <TabsList>
          <TabsTrigger value="import">Import</TabsTrigger>
          <TabsTrigger value="articles">Artikel {articlesList.length > 0 && `(${selectedCount}/${articlesList.length})`}</TabsTrigger>
          <TabsTrigger value="settings">Einstellungen</TabsTrigger>
        </TabsList>

        {/* ============================== IMPORT TAB ============================== */}
        <TabsContent value="import" className="space-y-4">
          {/* Schritt 1: Quelle */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Schritt 1: Quelle laden
              </CardTitle>
              <CardDescription>
                Kategorien werden direkt über die WordPress-REST-API geladen (kein XML-Export nötig)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-end gap-3 flex-wrap">
                <div className="flex-1 min-w-64 space-y-2">
                  <Label htmlFor="source-site">WordPress-Quelle</Label>
                  <Input
                    id="source-site"
                    value={config.sourceSite}
                    onChange={(e) => setConfig({ ...config, sourceSite: e.target.value })}
                    placeholder="https://mojobus.org"
                  />
                </div>
                <Button onClick={handleLoadCategories} disabled={isLoadingCategories || isPublishing}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingCategories ? 'animate-spin' : ''}`} />
                  {isLoadingCategories ? 'Lade…' : wpCategories.length > 0 ? 'Kategorien neu laden' : 'Kategorien laden'}
                </Button>
              </div>
              {wpCategories.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Badge variant="secondary">{wpCategories.length} Kategorien</Badge>
                  <Badge variant="secondary">
                    {wpCategories.reduce((s, c) => s + c.count, 0)} Beiträge gesamt
                  </Badge>
                  <span>· Import-Index: {indexStats.total} Artikel bereits importiert</span>
                  <Button variant="ghost" size="sm" onClick={clearIndex} title="Import-Index zurücksetzen">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Schritt 2: Kategorien zuordnen */}
          {wpCategories.length > 0 && (
            <CategoryMapper
              categories={wpCategories}
              mappings={mappings}
              onChange={setMappings}
              onResetMapping={handleResetMapping}
            />
          )}

          {/* Schritt 3: Artikel laden & veröffentlichen */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Schritt 2: Artikel laden & veröffentlichen
              </CardTitle>
              <CardDescription>
                Lädt alle Beiträge der aktiven Kategorien und konvertiert sie zu Markdown
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <Button onClick={handleLoadArticles} disabled={isLoadingPosts || isLoadingCategories || wpCategories.length === 0 || isPublishing}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingPosts ? 'animate-spin' : ''}`} />
                  {isLoadingPosts ? 'Lade Artikel…' : 'Artikel laden'}
                </Button>

                <Button
                  onClick={handleUploadMedia}
                  disabled={isUploading || isPublishing || !config.uploadMedia || articlesList.length === 0}
                  variant="outline"
                  title="Optional – passiert automatisch beim Veröffentlichen"
                >
                  <ImageIcon className="h-4 w-4 mr-2" />
                  Medien hochladen
                </Button>

                <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border">
                  <FlaskConical className={`h-4 w-4 ${config.dryRun ? 'text-blue-500' : 'text-muted-foreground'}`} />
                  <Label htmlFor="dry-run" className="text-sm cursor-pointer">Dry-Run</Label>
                  <Switch
                    id="dry-run"
                    checked={config.dryRun}
                    onCheckedChange={(checked) => setConfig({ ...config, dryRun: checked })}
                  />
                </div>

                <Button
                  onClick={handlePublish}
                  disabled={isPublishing || !user || articlesList.length === 0}
                  variant={config.dryRun ? 'secondary' : 'default'}
                >
                  <Play className="h-4 w-4 mr-2" />
                  {config.dryRun ? 'Dry-Run starten' : 'Veröffentlichen'}
                </Button>
              </div>

              {articlesList.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap text-sm">
                    <Badge variant="default">{selectedCount} ausgewählt</Badge>
                    <Badge variant="secondary">{articlesList.length} geladen</Badge>
                    {importedCount > 0 && (
                      <Badge variant="outline">{importedCount} bereits importiert (übersprungen)</Badge>
                    )}
                    {config.dryRun && (
                      <Badge variant="outline" className="text-blue-600 border-blue-400">Dry-Run: es wird nichts gesendet</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {config.uploadMedia
                      ? '📷 Bilder und Titelbilder werden beim Veröffentlichen automatisch heruntergeladen und zu Blossom (relay.mojobus.co + Backup) hochgeladen. Im Dry-Run: keine Uploads.'
                      : '📷 Media-Upload ist deaktiviert (Einstellungen) – Artikel behalten die Original-Bild-URLs von mojobus.org.'}
                  </p>
                </div>
              )}

              {/* XML-Fallback */}
              <Separator />
              <details className="text-sm">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  Alternativ: WordPress XML-Exportdatei hochladen (Fallback)
                </summary>
                <div
                  className={`mt-3 border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                    isDragging ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20' : 'border-muted-foreground/25'
                  }`}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                  onDrop={handleXmlDrop}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xml"
                    onChange={handleXmlFileInput}
                    disabled={isLoadingPosts || isUploading || isPublishing}
                    className="hidden"
                    id="xml-upload"
                  />
                  <div className="flex flex-col items-center gap-2">
                    <FolderOpen className="h-10 w-10 text-muted-foreground" />
                    <Button
                      variant="outline"
                      disabled={isLoadingPosts || isUploading || isPublishing}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      XML-Datei hochladen
                    </Button>
                    <p className="text-xs text-muted-foreground">XML-Artikel erhalten die Standard-Zielkategorie</p>
                  </div>
                </div>
              </details>
            </CardContent>
          </Card>

          {progressSteps.length > 0 && (
            <ProgressIndicator steps={progressSteps} totalPercentage={totalProgress} />
          )}

          {/* Ergebnisse */}
          {publishResults.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Ergebnisse</CardTitle>
                <CardDescription>
                  {publishResults.filter(r => r.success).length}/{publishResults.length} erfolgreich
                  {publishResults.some(r => r.dryRun) && ' (Dry-Run — nichts wurde gesendet)'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-96 overflow-y-auto pr-2">
                  <div className="space-y-2">
                    {publishResults.map((result, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 text-sm py-1.5 border-b last:border-0">
                        <span className="flex-1 truncate">{result.title}</span>
                        {result.dryRun ? (
                          <Badge variant="outline" className="text-blue-600 border-blue-400">Dry-Run OK</Badge>
                        ) : result.success ? (
                          result.naddr ? (
                            <a
                              href={`https://mojobus.co/${result.naddr}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-blue-500 hover:underline text-xs"
                            >
                              auf mojobus.co <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <Badge variant="outline" className="text-green-600">✓ {result.relayCount} Relays</Badge>
                          )
                        ) : (
                          <Badge variant="destructive">fehlgeschlagen</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ============================== ARTIKEL TAB ============================== */}
        <TabsContent value="articles" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Artikel
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => selectAllArticles(true)}
                    disabled={articlesList.length === 0}
                  >
                    Alle auswählen
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => selectAllArticles(false)}
                    disabled={articlesList.length === 0}
                  >
                    Auswahl aufheben
                  </Button>
                </div>
              </CardTitle>
              <CardDescription>
                Wählen Sie die Artikel aus, die Sie veröffentlichen möchten (Zielkategorie wird pro Artikel angezeigt)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {articlesList.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Keine Artikel geladen. Laden Sie zuerst Kategorien und Artikel über die REST-API.</p>
                </div>
              ) : (
                <ScrollArea className="h-[calc(100vh-24rem)]">
                  <div className="grid gap-4">
                    {articlesList.map((article) => (
                      <ArticlePreview
                        key={article.post.postId}
                        post={article.post}
                        markdownContent={article.markdown}
                        selected={article.selected}
                        onToggle={toggleArticle}
                        targetCategoryId={article.targetCategoryId}
                        extraTags={article.extraTags}
                        alreadyImported={article.alreadyImported}
                        featuredImageUrl={article.featuredBlossomUrl || article.post.featuredImageUrl}
                      />
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================== EINSTELLUNGEN TAB ============================== */}
        <TabsContent value="settings">
          <SettingsPanel config={config} onChange={setConfig} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
