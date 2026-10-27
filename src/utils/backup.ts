import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { getArtworks, addArtwork } from '@/db/database';

// Nom du fichier de sauvegarde.
const BACKUP_NAME = 'gallery-backup.json';
const BACKUP_PATH = FileSystem.documentDirectory + BACKUP_NAME;
const IMAGES_DIR = FileSystem.documentDirectory + 'images/';

// Structure d'une œuvre dans le fichier de sauvegarde.
type BackupArtwork = {
  title: string;
  artist: string;
  description: string;
  year: string;
  imageBase64?: string | null;
};

// S'assure que le dossier des images existe.
async function ensureImagesDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(IMAGES_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(IMAGES_DIR, { intermediates: true });
  }
}

// Lit une image locale en base64.
async function readImageBase64(uri: string): Promise<string> {
  return await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
}

// Exporte toutes les œuvres (avec leurs images en base64) dans un fichier
// JSON, puis ouvre le panneau de partage pour le sauvegarder ailleurs.
// Ne contient JAMAIS la clé API ni le mot de passe.
export async function exportBackup(): Promise<boolean> {
  const artworks = await getArtworks();

  const data: BackupArtwork[] = [];
  for (const artwork of artworks) {
    let imageBase64: string | null | undefined = null;
    if (artwork.imageUri) {
      try {
        imageBase64 = await readImageBase64(artwork.imageUri);
      } catch (error) {
        console.warn('Image illisible pour l’œuvre', artwork.id, error);
      }
    }
    data.push({
      title: artwork.title,
      artist: artwork.artist,
      description: artwork.description,
      year: artwork.year,
      imageBase64,
    });
  }

  const json = JSON.stringify(
    { version: 1, artworks: data },
    null,
    2
  );

  await FileSystem.writeAsStringAsync(BACKUP_PATH, json);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(BACKUP_PATH, {
      mimeType: 'application/json',
      dialogTitle: 'Sauvegarder votre collection',
      UTI: 'public.json',
    });
    return true;
  }
  return false;
}

// Importe une sauvegarde choisie par l'utilisateur : lit le fichier JSON,
// recopie les images dans le stockage persistant et insère les œuvres.
export async function importBackup(): Promise<number> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
  });

  if (result.canceled || result.assets.length === 0) {
    return 0;
  }

  const uri = result.assets[0].uri;
  const json = await FileSystem.readAsStringAsync(uri);
  const parsed = JSON.parse(json) as { artworks?: BackupArtwork[] };

  if (!parsed.artworks || !Array.isArray(parsed.artworks)) {
    throw new Error('Le fichier de sauvegarde est invalide.');
  }

  await ensureImagesDir();
  let inserted = 0;

  for (const item of parsed.artworks) {
    let imageUri: string | null = null;
    if (item.imageBase64) {
      const destination =
        IMAGES_DIR + `img-import-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
      await FileSystem.writeAsStringAsync(destination, item.imageBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      imageUri = destination;
    }
    await addArtwork({
      title: item.title || 'Sans titre',
      artist: item.artist || '',
      description: item.description || '',
      year: item.year || '',
      imageUri,
    });
    inserted++;
  }

  return inserted;
}
