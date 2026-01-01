/**
 * Settings Panel Komponente
 * Erlaubt das Konfigurieren des Import-Prozesses
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, Download, RotateCcw, Plus, Trash2, Check, X } from 'lucide-react';
import type { ImportConfig } from '@/modules/config/types';
import { DEFAULT_CONFIG, exportConfig, importConfig, resetConfig, saveConfig, loadConfig } from '@/modules/config/ConfigManager';

interface RelayConfig {
  url: string;
  enabled: boolean;
  read: boolean;
  write: boolean;
}

interface BlossomServerConfig {
  url: string;
  enabled: boolean;
}

export interface SettingsPanelProps {
  config: ImportConfig;
  onChange: (config: ImportConfig) => void;
}

export function SettingsPanel({ config, onChange }: SettingsPanelProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const handleSave = () => {
    saveConfig(config);
  };

  const handleReset = () => {
    if (confirm('Möchten Sie die Einstellungen auf Standardwerte zurücksetzen?')) {
      resetConfig();
      onChange(DEFAULT_CONFIG);
    }
  };

  const handleExport = () => {
    setIsExporting(true);
    try {
      const conf = exportConfig(config);
      const blob = new Blob([conf], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `wp-nostr-import-${Date.now()}.conf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export fehlgeschlagen:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const imported = importConfig(content);
        onChange({ ...DEFAULT_CONFIG, ...imported });
        saveConfig({ ...DEFAULT_CONFIG, ...imported });
      } catch (error) {
        console.error('Import fehlgeschlagen:', error);
        alert('Konfigurationsdatei konnte nicht importiert werden');
      } finally {
        setIsImporting(false);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const updateConfig = (updates: Partial<ImportConfig>) => {
    onChange({ ...config, ...updates });
  };

  const toggleRelay = (index: number) => {
    const newRelays = [...config.relays];
    newRelays[index].enabled = !newRelays[index].enabled;
    updateConfig({ relays: newRelays });
  };

  const toggleBlossomServer = (index: number) => {
    const newServers = [...config.blossomServers];
    newServers[index].enabled = !newServers[index].enabled;
    updateConfig({ blossomServers: newServers });
  };

  const addRelay = () => {
    const newRelays: RelayConfig[] = [
      ...config.relays,
      {
        url: 'wss://',
        enabled: true,
        read: true,
        write: true,
      },
    ];
    updateConfig({ relays: newRelays });
  };

  const removeRelay = (index: number) => {
    const newRelays = config.relays.filter((_, i) => i !== index);
    updateConfig({ relays: newRelays });
  };

  const updateRelayUrl = (index: number, url: string) => {
    const newRelays = [...config.relays];
    newRelays[index].url = url;
    updateConfig({ relays: newRelays });
  };

  const addBlossomServer = () => {
    const newServers: BlossomServerConfig[] = [
      ...config.blossomServers,
      {
        url: 'https://',
        enabled: true,
      },
    ];
    updateConfig({ blossomServers: newServers });
  };

  const removeBlossomServer = (index: number) => {
    const newServers = config.blossomServers.filter((_, i) => i !== index);
    updateConfig({ blossomServers: newServers });
  };

  const updateBlossomServerUrl = (index: number, url: string) => {
    const newServers = [...config.blossomServers];
    newServers[index].url = url;
    updateConfig({ blossomServers: newServers });
  };

  return (
    <ScrollArea className="h-[calc(100vh-12rem)]">
      <div className="space-y-4 pr-4">
        {/* Header Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Einstellungen</span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                  disabled={isExporting}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Exportieren
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleImport}
                  disabled={isImporting}
                  asChild
                >
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept=".conf"
                      onChange={handleImport}
                      className="hidden"
                    />
                    <Upload className="h-4 w-4 mr-2" />
                    Importieren
                  </label>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Zurücksetzen
                </Button>
                <Button onClick={handleSave}>
                  Speichern
                </Button>
              </div>
            </CardTitle>
            <CardDescription>
              Konfigurieren Sie den WordPress zu Nostr Import
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Blossom Server */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Blossom Server</CardTitle>
            <CardDescription>
              Server für Media-Uploads (NIP-94)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {config.blossomServers.map((server, index) => (
              <div key={index} className="flex items-center gap-2">
                <Switch
                  checked={server.enabled}
                  onCheckedChange={() => toggleBlossomServer(index)}
                />
                <Input
                  value={server.url}
                  onChange={(e) => updateBlossomServerUrl(index, e.target.value)}
                  placeholder="https://blossom.primal.net"
                  className="flex-1"
                />
                {config.blossomServers.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeBlossomServer(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={addBlossomServer}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Server hinzufügen
            </Button>
          </CardContent>
        </Card>

        {/* Relays */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Nostr Relays</CardTitle>
            <CardDescription>
              Mindestens 6 Relays empfohlen. nostr-01.yakihonne.com und relay.primal.net müssen enthalten sein.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {config.relays.map((relay, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={relay.enabled}
                    onCheckedChange={() => toggleRelay(index)}
                  />
                  <Input
                    value={relay.url}
                    onChange={(e) => updateRelayUrl(index, e.target.value)}
                    placeholder="wss://relay.damus.io"
                    className="flex-1"
                  />
                  {config.relays.length > 6 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeRelay(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="flex gap-2 ml-9">
                  <Badge variant={relay.read ? 'default' : 'secondary'}>
                    {relay.read ? 'Read' : 'No Read'}
                  </Badge>
                  <Badge variant={relay.write ? 'default' : 'secondary'}>
                    {relay.write ? 'Write' : 'No Write'}
                  </Badge>
                </div>
              </div>
            ))}
            {config.relays.length < 6 && (
              <Button
                variant="outline"
                size="sm"
                onClick={addRelay}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Relay hinzufügen
              </Button>
            )}
            {config.relays.length < 6 && (
              <p className="text-xs text-red-500">
                ⚠️ Mindestens 6 Relays empfohlen
              </p>
            )}
          </CardContent>
        </Card>

        <Separator />

        {/* Posting Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Posting Einstellungen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Poster Name</Label>
              <Input
                value={config.posterName}
                onChange={(e) => updateConfig({ posterName: e.target.value })}
                placeholder="mojobus.cc"
              />
            </div>
            <div className="space-y-2">
              <Label>Poster Website</Label>
              <Input
                value={config.posterWebsite}
                onChange={(e) => updateConfig({ posterWebsite: e.target.value })}
                placeholder="http://mojobus.cc"
              />
            </div>
            <div className="space-y-2">
              <Label>Post Intervall (Sekunden)</Label>
              <Input
                type="number"
                value={config.postInterval}
                onChange={(e) => updateConfig({ postInterval: parseInt(e.target.value) })}
                min="1"
                max="60"
              />
            </div>
          </CardContent>
        </Card>

        {/* Tags */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tags</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="preserveCategories">WordPress Kategorien übernehmen</Label>
              <Switch
                id="preserveCategories"
                checked={config.preserveCategories}
                onCheckedChange={(checked) => updateConfig({ preserveCategories: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="preserveTags">WordPress Tags übernehmen</Label>
              <Switch
                id="preserveTags"
                checked={config.preserveTags}
                onCheckedChange={(checked) => updateConfig({ preserveTags: checked })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="globalTags">Globale Tags (für alle Artikel)</Label>
              <Textarea
                id="globalTags"
                value={config.globalTags.join(', ')}
                onChange={(e) => updateConfig({
                  globalTags: e.target.value.split(',').map(t => t.trim()).filter(Boolean)
                })}
                placeholder="nostr, blogging, wordpress"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Publishing */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Veröffentlichung</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="preservePublishDate">Original Veröffentlichungsdatum behalten</Label>
              <Switch
                id="preservePublishDate"
                checked={config.preservePublishDate}
                onCheckedChange={(checked) => updateConfig({ preservePublishDate: checked })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Media */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Media</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="uploadMedia">Media zu Blossom hochladen</Label>
              <Switch
                id="uploadMedia"
                checked={config.uploadMedia}
                onCheckedChange={(checked) => updateConfig({ uploadMedia: checked })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxImageSize">Maximale Bildgröße (MB)</Label>
              <Input
                id="maxImageSize"
                type="number"
                value={Math.round(config.maxImageSize / 1024 / 1024)}
                onChange={(e) => updateConfig({
                  maxImageSize: parseInt(e.target.value) * 1024 * 1024
                })}
                min="1"
                max="100"
              />
            </div>
          </CardContent>
        </Card>

        {/* Content */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Inhalt</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="removeWPShortcodes">WordPress Shortcodes entfernen</Label>
              <Switch
                id="removeWPShortcodes"
                checked={config.removeWordPressShortcodes}
                onCheckedChange={(checked) => updateConfig({ removeWordPressShortcodes: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="convertToMarkdown">HTML zu Markdown konvertieren</Label>
              <Switch
                id="convertToMarkdown"
                checked={config.convertHtmlToMarkdown}
                onCheckedChange={(checked) => updateConfig({ convertHtmlToMarkdown: checked })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Preview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Vorschau</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="showPreview">Vorschau anzeigen</Label>
              <Switch
                id="showPreview"
                checked={config.showPreview}
                onCheckedChange={(checked) => updateConfig({ showPreview: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="requireConfirmation">Vor dem Posten bestätigen</Label>
              <Switch
                id="requireConfirmation"
                checked={config.requireConfirmation}
                onCheckedChange={(checked) => updateConfig({ requireConfirmation: checked })}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}
