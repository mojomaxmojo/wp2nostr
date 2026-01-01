/**
 * Artikel-Vorschau Komponente
 * Zeigt eine Vorschau des zu postenden Artikels an
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Calendar, Tag, Eye, CheckCircle2, XCircle } from 'lucide-react';
import type { WordPressPost } from '@/modules/parser/WordPressParser';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface ArticlePreviewProps {
  post: WordPressPost;
  markdownContent: string;
  selected: boolean;
  onToggle: (postId: string) => void;
  onValidate?: (postId: string, valid: boolean) => void;
}

export function ArticlePreview({ post, markdownContent, selected, onToggle, onValidate }: ArticlePreviewProps) {
  // Markdown für Vorschau vereinfacht rendern
  const renderMarkdownPreview = (markdown: string) => {
    let html = markdown;

    // YouTube Iframes behalten
    html = html.replace(
      /<iframe[^>]*src="https:\/\/www\.youtube\.com\/embed\/([^"]+)"[^>]*><\/iframe>/g,
      '<div class="my-4"><iframe width="560" height="315" src="https://www.youtube.com/embed/$1" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>'
    );

    // Einfaches Rendering für Vorschau (in Produktion: markdown-it verwenden)
    html = html
      .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold mt-4 mb-2">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-4 mb-2">$1</h1>')
      .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*)\*/gim, '<em>$1</em>')
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/gim, '<div class="my-2 text-sm text-muted-foreground">📷 $1</div>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" class="text-blue-500 hover:underline" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/\n/gim, '<br />');

    return html;
  };

  return (
    <Card className={`transition-colors ${selected ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20' : ''}`}>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            <CardTitle className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selected}
                onChange={() => onToggle(post.postId)}
                className="h-5 w-5 rounded border-gray-300"
              />
              <span className={selected ? '' : 'opacity-80'}>
                {post.title}
              </span>
            </CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-4 text-xs">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDistanceToNow(post.publishDate, { addSuffix: true, locale: de })}
              </span>
              <span className="flex items-center gap-1">
                <Tag className="h-3 w-3" />
                {post.categories.length > 0 && `${post.categories.length} Kategorien`}
                {post.tags.length > 0 && ` • ${post.tags.length} Tags`}
              </span>
              <span>
                {markdownContent.length} Zeichen
              </span>
            </CardDescription>
          </div>
          <div className="flex-shrink-0">
            {selected ? (
              <CheckCircle2 className="h-6 w-6 text-green-500" />
            ) : (
              <div className="h-6 w-6 rounded-full border-2 border-gray-300" />
            )}
          </div>
        </div>
      </CardHeader>
      <Separator />
      <CardContent className="pt-4">
        {/* Tags */}
        <div className="flex flex-wrap gap-2 mb-4">
          {post.categories.map((cat) => (
            <Badge key={cat} variant="secondary" className="text-xs">
              {cat}
            </Badge>
          ))}
          {post.tags.slice(0, 5).map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs">
              #{tag}
            </Badge>
          ))}
          {post.tags.length > 5 && (
            <Badge variant="outline" className="text-xs">
              +{post.tags.length - 5} mehr
            </Badge>
          )}
        </div>

        {/* Preview */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Eye className="h-4 w-4" />
            Vorschau
          </div>
          <ScrollArea className="h-64 w-full rounded-md border p-4">
            <div
              className="prose prose-sm dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: renderMarkdownPreview(markdownContent) }}
            />
          </ScrollArea>
        </div>

        {/* Excerpt */}
        {post.excerpt && (
          <div className="mt-4 p-3 bg-muted rounded-md">
            <p className="text-xs text-muted-foreground mb-1">Auszug:</p>
            <p className="text-sm">{post.excerpt}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
