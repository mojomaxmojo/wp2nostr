import { Link } from 'react-router-dom';
import { useSeoMeta } from '@unhead/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Upload, Settings, ArrowRight, Download } from 'lucide-react';

const Index = () => {
  useSeoMeta({
    title: 'WordPress zu Nostr — mojobus.org → mojobus.co',
    description: 'Importiert WordPress-Beiträge von mojobus.org direkt als mojobus.co-kompatible Nostr Long Form Articles. Automatische Media-Uploads zu Blossom, Markdown-Konvertierung und Kategorie-Mapping.',
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <header className="border-b bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <FileText className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">WordPress zu Nostr</h1>
                <p className="text-sm text-muted-foreground">mojobus.org → mojobus.co</p>
              </div>
            </div>
            <Link to="/wp-import">
              <Button>
                Import starten
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            WordPress zu Nostr Konverter
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Importiert Artikel direkt von der WordPress-REST-API (mojobus.org) und veröffentlicht
            sie als mojobus.co-kompatible Long Form Articles — mit Kategorie-Mapping,
            Media-Upload zu Blossom und Markdown-Konvertierung.
          </p>
          <div className="flex gap-4 justify-center">
            <Link to="/wp-import">
              <Button size="lg" className="text-lg px-8">
                <Upload className="mr-2 h-5 w-5" />
                Jetzt starten
              </Button>
            </Link>
            <Link to="/wp-import?tab=settings">
              <Button size="lg" variant="outline" className="text-lg px-8">
                <Settings className="mr-2 h-5 w-5" />
                Einstellungen
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          <Card className="border-2 hover:border-blue-500 transition-colors">
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-2">
                <Download className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <CardTitle>Direkt-Import über REST-API</CardTitle>
              <CardDescription>
                Kein XML-Export nötig: Kategorien und Beiträge werden direkt von mojobus.org geladen.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2 hover:border-purple-500 transition-colors">
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-2">
                <FileText className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <CardTitle>mojobus.co-Kompatibel</CardTitle>
              <CardDescription>
                NIP-23 Artikel mit exakt dem Tag-Schema von mojobus.co — erscheinen automatisch unter /artikel, /artikel/rvlife usw.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2 hover:border-pink-500 transition-colors">
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center mb-2">
                <Settings className="h-6 w-6 text-pink-600 dark:text-pink-600" />
              </div>
              <CardTitle>Volle Kontrolle</CardTitle>
              <CardDescription>
                Kategorie-Mapping, Dry-Run, Duplikat-Schutz, Blossom-Server und Relays frei konfigurierbar.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2 hover:border-purple-500 transition-colors">
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-2">
                <FileText className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <CardTitle>Long Form Articles</CardTitle>
              <CardDescription>
                Beiträge werden als Nostr Long Form Articles (NIP-23) veröffentlicht mit vollen Tags und Metadaten.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2 hover:border-pink-500 transition-colors">
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center mb-2">
                <Settings className="h-6 w-6 text-pink-600 dark:text-pink-400" />
              </div>
              <CardTitle>Volle Kontrolle</CardTitle>
              <CardDescription>
                Konfigurieren Sie Blossom Server, Relays, Tags und mehr in detaillierten Einstellungen.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* Additional Features */}
      <section className="container mx-auto px-4 py-16 bg-white/50 dark:bg-gray-800/50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Funktionen</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <div className="h-6 w-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <div className="h-2 w-2 rounded-full bg-green-500" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Media-Upload zu Blossom</h3>
                <p className="text-sm text-muted-foreground">
                  Bilder automatisch zu Blossom Servern hochladen mit NIP-94 Unterstützung und Multi-Server Redundanz
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-6 w-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <div className="h-2 w-2 rounded-full bg-green-500" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">WordPress Kategorien & Tags</h3>
                <p className="text-sm text-muted-foreground">
                  Alle Kategorien und Tags werden übernommen. Manuelle Tags für bessere Nostr-Discovery möglich
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-6 w-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <div className="h-2 w-2 rounded-full bg-green-500" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Original Veröffentlichungsdaten</h3>
                <p className="text-sm text-muted-foreground">
                  Behalten Sie die ursprünglichen Veröffentlichungsdaten bei oder wählen Sie eine andere Strategie
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-6 w-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <div className="h-2 w-2 rounded-full bg-green-500" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">YouTube Embeds</h3>
                <p className="text-sm text-muted-foreground">
                  Videos von YouTube werden automatisch als iframes eingebunden
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-6 w-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <div className="h-2 w-2 rounded-full bg-green-500" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Keine Links zum Original</h3>
                <p className="text-sm text-muted-foreground">
                  Inhalte bleiben vollständig auf Nostr, ohne Links zum ursprünglichen WordPress-Blog
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-6 w-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <div className="h-2 w-2 rounded-full bg-green-500" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Nostr Login</h3>
                <p className="text-sm text-muted-foreground">
                  Sichere Anmeldung mit NIP-07 oder Nostr Connect für das Veröffentlichen
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white/50 dark:bg-gray-800/50">
        <div className="container mx-auto px-4 py-6">
          <div className="text-center text-sm text-muted-foreground">
            <p className="mb-2">Importiert von <a href="https://mojobus.org" className="hover:underline" target="_blank" rel="noopener noreferrer">mojobus.org</a> → veröffentlicht für <a href="https://mojobus.co" className="hover:underline" target="_blank" rel="noopener noreferrer">mojobus.co</a></p>
            <p>
              Built with <a href="https://shakespeare.diy" className="hover:underline" target="_blank" rel="noopener noreferrer">Shakespeare</a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
