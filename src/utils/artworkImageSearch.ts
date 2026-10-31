import * as FileSystem from 'expo-file-system/legacy';

const TIMEOUT = 15000;

// Appelle fetch avec un délai maximal et renvoie null en cas d'échec.
async function fetchWithTimeout(url: string): Promise<Response | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return response.ok ? response : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// Essaie 3 sources gratuites sans clé API dans l'ordre :
// 1. Wikipedia (pageimages)
// 2. Metropolitan Museum of Art
// 3. Art Institute of Chicago
// Renvoie l'URL directe de l'image ou null si aucune trouvée.
export async function searchImageUrl(
  title: string,
  artist: string
): Promise<string | null> {
  const query = `${title} ${artist}`.trim();
  if (query.length === 0) return null;

  // ---- 1. Wikipedia ----
  try {
    const wikiUrl = [
      'https://en.wikipedia.org/w/api.php?action=query',
      '&prop=pageimages',
      `&titles=${encodeURIComponent(query)}`,
      '&pithumbsize=1600',
      '&format=json',
    ].join('');
    const res = await fetchWithTimeout(wikiUrl);
    if (res) {
      const data = await res.json();
      const pages = data?.query?.pages ?? {};
      for (const pageId in pages) {
        const thumb = pages[pageId]?.thumbnail?.source as string | undefined;
        if (thumb) return thumb;
      }
    }
  } catch {
    // on passe à la source suivante
  }

  // ---- 2. Metropolitan Museum of Art ----
  try {
    const metSearch = [
      'https://collectionapi.metmuseum.org/public/collection/v1/search?q=',
      encodeURIComponent(query),
    ].join('');
    const res = await fetchWithTimeout(metSearch);
    if (res) {
      const data = await res.json();
      const ids = data?.objectIDs as number[] | undefined;
      if (ids && ids.length > 0) {
        const objUrl = [
          'https://collectionapi.metmuseum.org/public/collection/v1/objects/',
          String(ids[0]),
        ].join('');
        const objRes = await fetchWithTimeout(objUrl);
        if (objRes) {
          const obj = await objRes.json();
          const img = (obj?.primaryImageSmall ?? obj?.primaryImage) as string | undefined;
          if (img) return img;
        }
      }
    }
  } catch {
    // on passe à la source suivante
  }

  // ---- 3. Art Institute of Chicago ----
  try {
    const chiUrl = [
      'https://api.artic.edu/api/v1/artworks/search?q=',
      encodeURIComponent(query),
      '&fields=image_id,title&limit=1',
    ].join('');
    const res = await fetchWithTimeout(chiUrl);
    if (res) {
      const data = await res.json();
      const art = data?.data?.[0] as { image_id?: string } | undefined;
      if (art?.image_id) {
        return [
          'https://www.artic.edu/iiif/2/',
          art.image_id,
          '/full/843,/0/default.jpg',
        ].join('');
      }
    }
  } catch {
    // rien trouvé
  }

  return null;
}

// --------------- Téléchargement et copie dans le stockage de l'app ---------------
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
export async function downloadImage(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(url, { signal: controller.signal });
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