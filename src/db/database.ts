import * as SQLite from 'expo-sqlite';

// Type représentant une œuvre d'art enregistrée dans la collection.
export type Artwork = {
  id: number;
  title: string;
  artist: string;
  description: string;
  year: string;
  imageUri: string | null;
};

// Type pour la création d'une œuvre (sans l'id, généré automatiquement).
export type NewArtwork = {
  title: string;
  artist: string;
  description: string;
  year: string;
  imageUri: string | null;
};

// Nom du fichier de la base de données locale (sur le téléphone).
const DB_NAME = 'gallery.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

// Ouvre (ou réutilise) la base de données et s'assure que la table existe.
export async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;
        CREATE TABLE IF NOT EXISTS artworks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          artist TEXT NOT NULL,
          description TEXT NOT NULL,
          year TEXT NOT NULL,
          imageUri TEXT
        );
      `);
      return db;
    })();
  }
  return dbPromise;
}

// Récupère toutes les œuvres, triées de la plus récente à la plus ancienne.
export async function getArtworks(): Promise<Artwork[]> {
  const db = await initDatabase();
  const rows = await db.getAllAsync<Artwork>(
    'SELECT * FROM artworks ORDER BY id DESC;'
  );
  return rows;
}

// Récupère une œuvre précise grâce à son identifiant.
export async function getArtwork(id: number): Promise<Artwork | null> {
  const db = await initDatabase();
  const row = await db.getFirstAsync<Artwork>(
    'SELECT * FROM artworks WHERE id = ?;',
    id
  );
  return row ?? null;
}

// Ajoute une nouvelle œuvre et renvoie la ligne créée (avec son id).
export async function addArtwork(artwork: NewArtwork): Promise<Artwork> {
  const db = await initDatabase();
  const result = await db.runAsync(
    `INSERT INTO artworks (title, artist, description, year, imageUri)
     VALUES (?, ?, ?, ?, ?);`,
    artwork.title,
    artwork.artist,
    artwork.description,
    artwork.year,
    artwork.imageUri
  );
  const inserted = await getArtwork(result.lastInsertRowId);
  if (!inserted) {
    throw new Error('Impossible de récupérer l’œuvre ajoutée.');
  }
  return inserted;
}

// Met à jour les informations d'une œuvre existante.
export async function updateArtwork(
  id: number,
  artwork: NewArtwork
): Promise<void> {
  const db = await initDatabase();
  await db.runAsync(
    `UPDATE artworks
     SET title = ?, artist = ?, description = ?, year = ?, imageUri = ?
     WHERE id = ?;`,
    artwork.title,
    artwork.artist,
    artwork.description,
    artwork.year,
    artwork.imageUri,
    id
  );
}

// Supprime une œuvre grâce à son identifiant.
export async function deleteArtwork(id: number): Promise<void> {
  const db = await initDatabase();
  await db.runAsync('DELETE FROM artworks WHERE id = ?;', id);
}
