const DB_NAME = 'agendou-onboarding';
const STORE_NAME = 'drafts';
const LOGO_KEY = 'logo';

let memoryLogo: File | null = null;

const openDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB indisponível neste navegador.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Não foi possível abrir o armazenamento local.'));
  });

const runTransaction = async <T>(
  mode: IDBTransactionMode,
  executor: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> => {
  const db = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, mode);
      const request = executor(transaction.objectStore(STORE_NAME));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Falha no armazenamento local.'));
    });
  } finally {
    db.close();
  }
};

export const saveLogoDraft = async (file: File): Promise<void> => {
  memoryLogo = file;
  try {
    await runTransaction('readwrite', (store) => store.put(file, LOGO_KEY));
  } catch (error) {
    // O fallback em memória cobre navegadores sem IndexedDB. O arquivo só não
    // sobrevive a um recarregamento da página nesse cenário.
    console.warn('Unable to persist onboarding logo draft:', error);
  }
};

export const readLogoDraft = async (): Promise<File | null> => {
  if (memoryLogo) return memoryLogo;

  try {
    const stored = await runTransaction<File | Blob | undefined>('readonly', (store) => store.get(LOGO_KEY));
    if (!stored) return null;
    const file = stored instanceof File
      ? stored
      : new File([stored], 'logo', { type: stored.type });
    memoryLogo = file;
    return file;
  } catch (error) {
    console.warn('Unable to read onboarding logo draft:', error);
    return null;
  }
};

export const clearLogoDraft = async (): Promise<void> => {
  memoryLogo = null;
  try {
    await runTransaction('readwrite', (store) => store.delete(LOGO_KEY));
  } catch (error) {
    console.warn('Unable to clear onboarding logo draft:', error);
  }
};
