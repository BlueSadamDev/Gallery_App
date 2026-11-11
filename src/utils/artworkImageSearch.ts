import * as FileSystem from 'expo-file-system/legacy';
import { USER_AGENT } from '@/services/artworkSearch/wikidata.ts';

// --------------- Téléchargement et copie dans le stockage de l'app ---------------
// L'ancienne recherche d'image (1er résultat de Wikipedia / Met / Chicago, sans
// vérification) a été remplacée par la recherche Wikidata (src/services/artworkSearch).

const DOWNLOAD_DIR = FileSystem.documentDirectory + 'images/';

async function ensureDownloadDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(DOWNLOAD_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(DOWNLOAD_DIR, { intermediates: true });
  }
}

function uniqueName(): string {
  return `web-${Date.now()}.jpg`;
}

// Convertit un ArrayBuffer en chaîne Base64 (pour l'écriture sur le téléphone).
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Télécharge l'image depuis une URL distante et la copie dans le dossier
// persistant de l'app. Renvoie le chemin local ou null en cas d'échec.
// Seul le chemin local est enregistré : aucune adresse Internet n'est conservée.
export async function downloadImage(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, 'Api-User-Agent': USER_AGENT },
      signal: controller.signal,
    });
    if (!response.ok) return null;

    const arrayBuffer = await response.arrayBuffer();
    const base64 = arrayBufferToBase64(arrayBuffer);

    await ensureDownloadDir();
    const destination = DOWNLOAD_DIR + uniqueName();
    await FileSystem.writeAsStringAsync(destination, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return destination;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
