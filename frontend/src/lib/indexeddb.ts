import { encrypt, decrypt } from './crypto';

const DB_NAME = 'chamate-db';
const DB_VERSION = 1;
const STORE_NAME = 'api-keys';

export interface ApiKeyRecord {
  provider: string;
  apiKey: string;      // 加密后的
  baseUrl?: string;
  createdAt: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'provider' });
      }
    };
  });
}

export async function saveApiKey(provider: string, apiKey: string, baseUrl?: string): Promise<void> {
  const db = await openDB();
  const encryptedKey = await encrypt(apiKey);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put({ provider, apiKey: encryptedKey, baseUrl, createdAt: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getApiKey(provider: string): Promise<{ apiKey: string; baseUrl?: string } | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(provider);
    request.onsuccess = async () => {
      if (!request.result) { resolve(null); return; }
      const decryptedKey = await decrypt(request.result.apiKey);
      resolve({ apiKey: decryptedKey, baseUrl: request.result.baseUrl });
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getAllApiKeys(): Promise<Array<{ provider: string; hasKey: boolean; baseUrl?: string }>> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => {
      resolve((request.result || []).map(r => ({ provider: r.provider, hasKey: !!r.apiKey, baseUrl: r.baseUrl })));
    };
    request.onerror = () => reject(request.error);
  });
}

export async function deleteApiKey(provider: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(provider);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
