import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';

// Dossier persistant de l'app où sont copiées les photos.
// Ce dossier n'est PAS touché quand on supprime une photo de la galerie.
const IMAGES_DIR = FileSystem.documentDirectory + 'images/';

// S'assure que le dossier des images existe.
async function ensureImagesDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(IMAGES_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(IMAGES_DIR, { intermediates: true });
  }
}

// Génère un nom de fichier unique basé sur l'horodatage.
function uniqueName(): string {
  return `img-${Date.now()}.jpg`;
}

// Copie une photo (provenant de la galerie ou de la caméra) dans le stockage
// persistant de l'app et renvoie le chemin du fichier copié.
async function copyToAppStorage(uri: string): Promise<string> {
  await ensureImagesDir();
  const destination = IMAGES_DIR + uniqueName();
  await FileSystem.copyAsync({ from: uri, to: destination });
  return destination;
}

// Demande la permission d'accéder à la galerie de photos.
export async function requestGalleryPermission(): Promise<boolean> {
  const permission =
    await ImagePicker.requestMediaLibraryPermissionsAsync();
  return permission.granted;
}

// Ouvre la galerie pour choisir une photo, la copie dans l'app et
// renvoie le chemin du fichier (ou null si annulé).
export async function pickImageFromGallery(): Promise<string | null> {
  const granted = await requestGalleryPermission();
  if (!granted) {
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.8,
  });
  if (result.canceled || result.assets.length === 0) {
    return null;
  }
  const asset = result.assets[0];
  return copyToAppStorage(asset.uri);
}

// Demande la permission d'utiliser la caméra.
export async function requestCameraPermission(): Promise<boolean> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  return permission.granted;
}

// Ouvre la caméra pour prendre une photo, la copie dans l'app et
// renvoie le chemin du fichier (ou null si annulé).
export async function takePhotoWithCamera(): Promise<string | null> {
  const granted = await requestCameraPermission();
  if (!granted) {
    return null;
  }
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 0.8,
  });
  if (result.canceled || result.assets.length === 0) {
    return null;
  }
  const asset = result.assets[0];
  return copyToAppStorage(asset.uri);
}
