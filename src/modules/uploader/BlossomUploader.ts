/**
 * Blossom Media Uploader
 * Lädt Medien zu Blossom Servern hoch mit NIP-94 Unterstützung
 */

import type { NostrEvent } from '@nostrify/nostrify';
import { hmacSha256, sha256 } from '@noble/hashes/sha256';
import { hexToBytes } from '@noble/hashes/utils';

export interface BlossomServer {
  url: string;
  enabled: boolean;
}

export interface UploadResult {
  url: string;
  hash: string;
  size: number;
  type: string;
  server: string;
  nip94Tags: string[][];
}

export interface UploadProgress {
  total: number;
  completed: number;
  currentFile: string;
  currentServer: string;
  percentage: number;
  status: 'uploading' | 'completed' | 'failed';
}

export interface BlossomUploadOptions {
  servers: BlossomServer[];
  maxRetries: number;
  timeout: number; // Millisekunden
  chunkSize?: number; // Bytes für chunked uploads
}

export const DEFAULT_UPLOAD_OPTIONS: BlossomUploadOptions = {
  servers: [
    { url: 'https://blossom.primal.net', enabled: true },
    { url: 'https://cdn.nostrcheck.me', enabled: true },
  ],
  maxRetries: 3,
  timeout: 60000, // 60 Sekunden
};

/**
 * Blossom Server Upload URL konstruieren
 */
function getBlossomUploadUrl(serverUrl: string, hash: string): string {
  const baseUrl = serverUrl.replace(/\/$/, '');
  return `${baseUrl}/upload`;
}

/**
 * Blossom Server Listing URL konstruieren
 */
function getBlossomListingUrl(serverUrl: string, pubkey: string): string {
  const baseUrl = serverUrl.replace(//', '')', '');
  return `${baseUrl}/list/${pubkey}`;
}

/**
 * Berechnet SHA-256 Hash einer Datei
 */
export async function calculateFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hash = sha256(new Uint8Array(buffer));
  return Buffer.from(hash).toString('hex');
}

/**
 * Lädt eine Datei zu einem Blossom Server hoch
 */
async function uploadToServer(
  server: BlossomServer,
  file: File,
  hash: string,
  options: BlossomUploadOptions,
  onProgress?: (progress: UploadProgress) => void,
  sign?: (event: NostrEvent) => Promise<NostrEvent>
): Promise<UploadResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('sha256', hash);

  const uploadUrl = getBlossomUploadUrl(server.url, hash);

  for (let attempt = 0; attempt < options.maxRetries; attempt++) {
    try {
      onProgress?.({
        total: 1,
        completed: 0,
        currentFile: file.name,
        currentServer: server.url,
        percentage: 0,
        status: 'uploading',
      });

      // Event mit NIP-94 Tags erstellen (wenn signer vorhanden)
      const now = Math.floor(Date.now() / 1000);
      const tags: string[][] = [
        ['url', uploadUrl],
        ['m', file.type],
        ['x', hash],
        ['size', file.size.toString()],
        ['published_at', now.toString()],
      ];

      // Dateiname und Typ
      if (file.name) tags.push(['name', file.name]);
      if (file.type) tags.push(['dim', file.type]);

      const event: NostrEvent = {
        kind: 1063,
        content: '',
        created_at: now,
        tags,
        pubkey: '', // Wird vom Signer gesetzt
      };

      // Event signieren (wenn Signer vorhanden)
      let signedEvent = event;
      if (sign) {
        try {
          signedEvent = await sign(event);
        } catch (error) {
          console.warn('Event konnte nicht signiert werden, Upload ohne Auth-Header:', error);
        }
      }

      // Authorization Header erstellen (wenn signiertes Event vorhanden)
      const headers: HeadersInit = {};
      if (signedEvent.pubkey) {
        // Blossom Auth Format
        const authData = JSON.stringify({
          event: signedEvent,
        });
        headers['Authorization'] = `Nostr ${btoa(JSON.stringify(signedEvent))}`;
      }

      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers,
        body: formData,
        signal: AbortSignal.timeout(options.timeout),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload fehlgeschlagen: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      
      onProgress?.({
        total: 1,
        completed: 1,
        currentFile: file.name,
        currentServer: server.url,
        percentage: 100,
        status: 'completed',
      });

      return {
        url: result.url || uploadUrl.replace('/upload', `/${hash}`),
        hash,
        size: file.size,
        type: file.type,
        server: server.url,
        nip94Tags: [
          ['url', result.url || uploadUrl.replace('/upload', `/${hash}`)],
          ['m', file.type],
          ['x', hash],
          ['size', file.size.toString()],
          ['published_at', now.toString()],
          file.name ? ['name', file.name] : [],
        ].filter(tag => tag.length > 0) as string[][],
      };
    } catch (error) {
      console.error(`Upload zu ${server.url} fehlgeschlagen (Versuch ${attempt + 1}):`, error);
      
      if (attempt === options.maxRetries - 1) {
        throw new Error(`Upload zu ${server.url} fehlgeschlagen nach ${options.maxRetries} Versuchen: ${error}`);
      }
      
      // Vor erneutem Versuch warten
      await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
    }
  }

  throw new Error(`Upload zu ${server.url} fehlgeschlagen`);
}

/**
 * Lädt eine Datei zu einem primären Server hoch
 */
async function uploadToPrimaryServer(
  file: File,
  options: BlossomUploadOptions,
  onProgress?: (progress: UploadProgress) => void,
  sign?: (event: NostrEvent) => Promise<NostrEvent>
): Promise<UploadResult> {
  // Primären Server wählen (erster aktivierter)
  const primaryServer = options.servers.find(s => s.enabled);
  if (!primaryServer) {
    throw new Error('Kein aktivierter Blossom Server gefunden');
  }

  const hash = await calculateFileHash(file);
  return uploadToServer(primaryServer, file, hash, options, onProgress, sign);
}

/**
 * Lädt eine Datei zu mehreren Servern hoch (Redundanz)
 */
async function uploadToMultipleServers(
  file: File,
  options: BlossomUploadOptions,
  onProgress?: (progress: UploadProgress) => void,
  sign?: (event: NostrEvent) => Promise<NostrEvent>
): Promise<UploadResult[]> {
  const enabledServers = options.servers.filter(s => s.enabled);
  if (enabledServers.length === 0) {
    throw new Error('Kein aktivierter Blossom Server gefunden');
  }

  const hash = await calculateFileHash(file);
  const results: UploadResult[] = [];
  let completed = 0;

  // Parallel upload zu allen Servern
  const uploadPromises = enabledServers.map(server =>
    uploadToServer(server, file, hash, options, (progress) => {
      onProgress?.({
        ...progress,
        total: enabledServers.length,
        completed: completed,
        currentServer: server.url,
      });
    }, sign).then(result => {
      completed++;
      onProgress?.({
        total: enabledServers.length,
        completed,
        currentFile: file.name,
        currentServer: server.url,
        percentage: Math.round((completed / enabledServers.length) * 100),
        status: 'completed',
      });
      return result;
    })
  );

  try {
    results.push(...await Promise.all(uploadPromises));
  } catch (error) {
    // Mindestens ein Server sollte erfolgreich sein
    if (results.length === 0) {
      throw error;
    }
    console.warn('Einige Server uploads fehlgeschlagen, aber mindestens einer erfolgreich:', error);
  }

  return results;
}

/**
 * Lädt eine einzelne Datei hoch
 */
export async function uploadFile(
  file: File,
  options: Partial<BlossomUploadOptions> = {},
  onProgress?: (progress: UploadProgress) => void,
  sign?: (event: NostrEvent) => Promise<NostrEvent>
): Promise<UploadResult> {
  const opts = { ...DEFAULT_UPLOAD_OPTIONS, ...options };

  // Upload zu allen aktivierten Servern
  const results = await uploadToMultipleServers(file, opts, onProgress, sign);

  // Primäres Ergebnis zurückgeben (erster Server)
  return results[0];
}

/**
 * Lädt mehrere Dateien hoch
 */
export async function uploadFiles(
  files: File[],
  options: Partial<BlossomUploadOptions> = {},
  onProgress?: (progress: UploadProgress) => void,
  sign?: (event: NostrEvent) => Promise<NostrEvent>
): Promise<UploadResult[]> {
  const results: UploadResult[] = [];
  let total = files.length;
  let completed = 0;

  for (const file of files) {
    onProgress?.({
      total,
      completed,
      currentFile: file.name,
      currentServer: '',
      percentage: Math.round((completed / total) * 100),
      status: 'uploading',
    });

    try {
      const result = await uploadFile(
        file,
        options,
        (fileProgress) => {
          onProgress?.({
            ...fileProgress,
            total,
            completed,
            percentage: Math.round(((completed + fileProgress.percentage / 100) / total) * 100),
          });
        },
        sign
      );
      results.push(result);
      completed++;
    } catch (error) {
      console.error(`Upload von ${file.name} fehlgeschlagen:`, error);
      // Andere Dateien trotzdem versuchen
      completed++;
    }
  }

  onProgress?.({
    total,
    completed,
    currentFile: '',
    currentServer: '',
    percentage: 100,
    status: 'completed',
  });

  return results;
}

/**
 * Prüft ob ein URL ein Blossom URL ist
 */
export function isBlossomUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.pathname === '/upload' ||
           /^[a-f0-9]{64}$/.test(parsed.pathname.split('/').pop() || '');
  } catch {
    return false;
  }
}

/**
 * Extrahiert den Hash aus einem Blossom URL
 */
export function extractHashFromBlossomUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const hash = parsed.pathname.split('/').pop();
    if (hash && /^[a-f0-9]{64}$/.test(hash)) {
      return hash;
    }
  } catch {
    // Ignore
  }
  return null;
}

/**
 * Validiert eine Datei für den Upload
 */
export function validateFileForUpload(
  file: File,
  maxSize: number
): { valid: boolean; error?: string } {
  if (file.size === 0) {
    return { valid: false, error: 'Datei ist leer' };
  }

  if (file.size > maxSize) {
    return {
      valid: false,
      error: `Datei zu groß: ${Math.round(file.size / 1024 / 1024)}MB (Maximum: ${Math.round(maxSize / 1024 / 1024)}MB)`,
    };
  }

  return { valid: true };
}
