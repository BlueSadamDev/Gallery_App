import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

// Clés de stockage sécurisé pour le compte utilisateur.
const USERNAME_KEY = 'auth_username';
const PASSWORD_HASH_KEY = 'auth_password_hash';
const LOGGED_IN_KEY = 'auth_logged_in';

// Hashe le mot de passe en SHA-256 (jamais stocké en clair).
export async function hashPassword(password: string): Promise<string> {
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    password
  );
}

// Crée le compte utilisateur au premier lancement.
export async function registerUser(
  username: string,
  password: string
): Promise<void> {
  const hash = await hashPassword(password);
  await SecureStore.setItemAsync(USERNAME_KEY, username.trim());
  await SecureStore.setItemAsync(PASSWORD_HASH_KEY, hash);
}

// Vérifie les identifiants lors de la connexion et ouvre la session.
export async function loginUser(
  username: string,
  password: string
): Promise<boolean> {
  const storedUsername = await SecureStore.getItemAsync(USERNAME_KEY);
  const storedHash = await SecureStore.getItemAsync(PASSWORD_HASH_KEY);
  if (!storedUsername || !storedHash) return false;

  const usernameMatch = storedUsername === username.trim();
  if (!usernameMatch) return false;

  const inputHash = await hashPassword(password);
  if (inputHash !== storedHash) return false;

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
