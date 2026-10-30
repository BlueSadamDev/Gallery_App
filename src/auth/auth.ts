import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

// Clés de stockage sécurisé pour le compte utilisateur.
const USERNAME_KEY = 'auth_username';
const PASSWORD_HASH_KEY = 'auth_password_hash';
const LOGGED_IN_KEY = 'auth_logged_in';

// Taille du sel aléatoire en octets.
const SALT_BYTES = 32;

// Marqueur qui distingue un hash "ancien" (sans sel) d'un hash "nouveau" (avec sel).
// Les hash anciens sont des hexstrings (SHA-256) de 64 caractères exactement.
// Les hash nouveaux sont stockés comme "sel_hex:hash_hex".
const HASH_SEPARATOR = ':';

// ---------------------------------------------------------------------------
// Génère un sel aléatoire cryptographique.
// ---------------------------------------------------------------------------
async function generateSalt(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(SALT_BYTES);
  // Convertit chaque octet en hexadécimal (deux caractères par octet).
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------------------
// Hashe un mot de passe + sel en SHA-256 (jamais stocké en clair).
// Renvoie "sel_hex:hash_hex".
// ---------------------------------------------------------------------------
async function hashWithSalt(password: string, saltHex: string): Promise<string> {
  const salted = saltHex + password;
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    salted,
  );
  return saltHex + HASH_SEPARATOR + hash;
}

// ---------------------------------------------------------------------------
// Vérifie si une valeur correspond à l'ancien format (SHA-256 seul, 64 hex).
// ---------------------------------------------------------------------------
function isLegacyHash(value: string): boolean {
  return /^[0-9a-f]{64}$/i.test(value);
}

// ---------------------------------------------------------------------------
// Crée le compte utilisateur avec un sel aléatoire.
// ---------------------------------------------------------------------------
export async function registerUser(
  username: string,
  password: string
): Promise<void> {
  const salt = await generateSalt();
  const stored = await hashWithSalt(password, salt);
  await SecureStore.setItemAsync(USERNAME_KEY, username.trim());
  await SecureStore.setItemAsync(PASSWORD_HASH_KEY, stored);
}

// ---------------------------------------------------------------------------
// Vérifie les identifiants lors de la connexion et ouvre la session.
// Gère aussi la migration des anciens hashs (SHA-256 sans sel).
// ---------------------------------------------------------------------------
export async function loginUser(
  username: string,
  password: string
): Promise<boolean> {
  const storedUsername = await SecureStore.getItemAsync(USERNAME_KEY);
  const storedHash = await SecureStore.getItemAsync(PASSWORD_HASH_KEY);
  if (!storedUsername || !storedHash) return false;

  if (storedUsername !== username.trim()) return false;

  // --- Migration de l'ancien format (SHA-256 sans sel) ---
  if (isLegacyHash(storedHash)) {
    const legacyHash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      password,
    );
    if (legacyHash !== storedHash) return false;

    // Mot de passe correct → on migre vers le nouveau format avec sel.
    const salt = await generateSalt();
    const newStored = await hashWithSalt(password, salt);
    await SecureStore.setItemAsync(PASSWORD_HASH_KEY, newStored);
    await SecureStore.setItemAsync(LOGGED_IN_KEY, 'true');
    return true;
  }

  // --- Nouveau format (sel:hash) ---
  const separatorIndex = storedHash.indexOf(HASH_SEPARATOR);
  if (separatorIndex === -1) return false; // format inattendu

  const storedSalt = storedHash.slice(0, separatorIndex);
  const storedDigest = storedHash.slice(separatorIndex + 1);

  const computed = await hashWithSalt(password, storedSalt);
  const computedDigest = computed.slice(computed.indexOf(HASH_SEPARATOR) + 1);

  if (computedDigest !== storedDigest) return false;

  await SecureStore.setItemAsync(LOGGED_IN_KEY, 'true');
  return true;
}

// Déconnecte l'utilisateur (retire la session).
export async function logoutUser(): Promise<void> {
  await SecureStore.deleteItemAsync(LOGGED_IN_KEY);
}

// Indique si l'utilisateur est actuellement connecté (session ouverte).
export async function isLoggedIn(): Promise<boolean> {
  const value = await SecureStore.getItemAsync(LOGGED_IN_KEY);
  return value === 'true';
}

// Indique si un compte existe déjà (pour savoir si on crée ou on se connecte).
export async function isUserRegistered(): Promise<boolean> {
  const username = await SecureStore.getItemAsync(USERNAME_KEY);
  const hash = await SecureStore.getItemAsync(PASSWORD_HASH_KEY);
  return Boolean(username && hash);
}

// Récupère le nom d'utilisateur enregistré (ou null).
export async function getUsername(): Promise<string | null> {
  return await SecureStore.getItemAsync(USERNAME_KEY);
}
