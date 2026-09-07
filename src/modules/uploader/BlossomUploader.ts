/**
 * Blossom Media Uploader
 * Lädt Medien zu Blossom Servern hoch — gleicher Code-Pfad wie mojobus.co
 * (@nostrify/nostrify BlossomUploader, NIP-BUD Auth).
 *
 * Standard: https://relay.mojobus.co (Haupt-Server, nur mojo/susanne)
 *           + https://blossom.primal.net (Backup, immer zusätzlich)
 */

import { BlossomUploader } from '@nostrify/nostrify/uploaders';
import type { NostrEvent } from '@nostrify/nostrify';
import { sha256 } from '@noble/hashes/sha256';

export interface BlossomServer {
  url: string;
  enabled: boolean;
  /** Backup-Server: Upload erfolgt zusätzlich, Fehler sind nicht fatal */
  backup?: boolean;
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
}

export const DEFAULT_UPLOAD_OPTIONS: BlossomUploadOptions = {
  servers: [
    { url: 'https://relay.mojobus.co', enabled: true, backup: false },
    { url: 'https://blossom.primal.net', enabled: true, backup: true },
  ],
  maxRetries: 3,
  timeout: 120000, // 2 Minuten (große Bilder/Videos)
};

/**
 * Berechnet SHA-256 Hash einer Datei
 */
export async function calculateFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hash = sha256(new Uint8Array(buffer));
  return Buffer.from(hash).toString('hex');
}

interface SignerLike {
  getPublicKey(): Promise<string>;
  signEvent(event: NostrEvent): Promise<NostrEvent>;
}

/**
 * Lädt eine Datei zu einem Blossom Server hoch (nostrify BlossomUploader)
 */
async function uploadToServer(
  server: BlossomServer,
  file: File,
  options: BlossomUploadOptions,
  onProgress?: (progress: UploadProgress) => void,
  signer?: SignerLike
): Promise<UploadResult> {
  let lastError: unknown = null;

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

      const uploader = new BlossomUploader({
        servers: [server.url],
        signer: signer as never,
      });

      // nostrify BlossomUploader: gibt NIP-94-artige Tags zurück (url, x, m, size, ...)
      const tags = await uploader.upload(file);

      const url = tags.find(([name]) => name === 'url')?.[1]
        || `${server.url.replace(/\/$/, '')}/${await calculateFileHash(file)}`;
      const hash = tags.find(([name]) => name === 'x')?.[1] || await calculateFileHash(file);

      onProgress?.({
        total: 1,
        completed: 1,
        currentFile: file.name,
        currentServer: server.url,
        percentage: 100,
        status: 'completed',
      });

      return {
        url,
        hash,
        size: file.size,
        type: file.type,
        server: server.url,
        nip94Tags: tags,
      };
    } catch (error) {
      lastError = error;
      console.error(`Upload zu ${server.url} fehlgeschlagen (Versuch ${attempt + 1}):`, error);

      if (attempt < options.maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
      }
    }
  }

  throw new Error(
    `Upload zu ${server.url} fehlgeschlagen nach ${options.maxRetries} Versuchen: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`
  );
}

/**
 * Lädt eine Datei hoch:
 * 1. Primäre Server (nicht backup) — Fehler sind fatal
 * 2. Backup-Server — Fehler werden nur geloggt
 *
 * @returns Ergebnis vom ersten erfolgreichen primären Server
 */
export async function uploadFile(
  file: File,
  options: Partial<BlossomUploadOptions> = {},
  onProgress?: (progress: UploadProgress) => void,
  signer?: SignerLike
): Promise<UploadResult> {
  const opts = { ...DEFAULT_UPLOAD_OPTIONS, ...options };
  const enabledServers = opts.servers.filter(s => s.enabled);

  const primaryServers = enabledServers.filter(s => !s.backup);
  const backupServers = enabledServers.filter(s => s.backup);

  if (primaryServers.length === 0 && backupServers.length === 0) {
    throw new Error('Kein aktivierter Blossom Server gefunden');
  }

  // Backup-Uploads parallel starten (nicht blockierend, Fehler egal)
  for (const backup of backupServers) {
    uploadToServer(backup, file, opts, onProgress, signer).catch(error => {
      console.warn(`Backup-Upload zu ${backup.url} fehlgeschlagen (nicht kritisch):`, error);
    });
  }

  // Primäre Server sequentiell (erste erfolgreiche gewinnt)
  let lastError: unknown = null;
  for (const server of primaryServers.length > 0 ? primaryServers : backupServers) {
    try {
      return await uploadToServer(server, file, opts, onProgress, signer);
    } catch (error) {
      lastError = error;
      console.error(`Upload zu ${server.url} fehlgeschlagen, versuche nächsten Server:`, error);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Alle Blossom-Uploads fehlgeschlagen');
}

/**
 * Lädt mehrere Dateien hoch
 */
export async function uploadFiles(
  files: File[],
  options: Partial<BlossomUploadOptions> = {},
  onProgress?: (progress: UploadProgress) => void,
  signer?: SignerLike
): Promise<UploadResult[]> {
  const results: UploadResult[] = [];
  const total = files.length;
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
        signer
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
    return /^[a-f0-9]{64}$/.test(parsed.pathname.split('/').pop() || '');
  } catch {
    return false;
  }
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
