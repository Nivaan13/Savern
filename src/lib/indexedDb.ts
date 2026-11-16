import { SyncOperation, WorkspaceData } from '../types/finance.ts';

const DB_NAME = 'savern-offline-v1';
const DB_VERSION = 1;
const STORE_WORKSPACES = 'workspaces';
const STORE_SYNC_QUEUE = 'syncQueue';
const STORE_META = 'meta';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is unavailable in this environment.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_WORKSPACES)) {
        db.createObjectStore(STORE_WORKSPACES, { keyPath: 'workspaceKey' });
      }
      if (!db.objectStoreNames.contains(STORE_SYNC_QUEUE)) {
        const queueStore = db.createObjectStore(STORE_SYNC_QUEUE, { keyPath: 'opId' });
        queueStore.createIndex('workspaceKey', 'workspaceKey', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open IndexedDB'));
  });
}

export async function loadWorkspaceFromIdb(workspaceKey: string): Promise<WorkspaceData | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_WORKSPACES, 'readonly');
      const store = tx.objectStore(STORE_WORKSPACES);
      const req = store.get(workspaceKey);
      req.onsuccess = () => resolve(req.result ? (req.result.data as WorkspaceData) : null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IndexedDB read fallback:', err);
    return null;
  }
}

export async function saveWorkspaceToIdb(workspaceKey: string, data: WorkspaceData): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_WORKSPACES, 'readwrite');
      const store = tx.objectStore(STORE_WORKSPACES);
      store.put({
        workspaceKey,
        updatedAt: new Date().toISOString(),
        data,
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('IndexedDB write failed:', err);
  }
}

export async function deleteWorkspaceFromIdb(workspaceKey: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_WORKSPACES, 'readwrite');
      tx.objectStore(STORE_WORKSPACES).delete(workspaceKey);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('IndexedDB delete failed:', err);
  }
}

export async function enqueueSyncOperation(op: SyncOperation): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_SYNC_QUEUE, 'readwrite');
      tx.objectStore(STORE_SYNC_QUEUE).put(op);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Failed to enqueue sync operation:', err);
  }
}

export async function getSyncQueueForWorkspace(workspaceKey: string): Promise<SyncOperation[]> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SYNC_QUEUE, 'readonly');
      const index = tx.objectStore(STORE_SYNC_QUEUE).index('workspaceKey');
      const req = index.getAll(workspaceKey);
      req.onsuccess = () =>
        resolve(
          ((req.result as SyncOperation[]) || []).sort((a, b) =>
            a.timestamp.localeCompare(b.timestamp)
          )
        );
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function removeSyncOperations(opIds: string[]): Promise<void> {
  if (opIds.length === 0) return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_SYNC_QUEUE, 'readwrite');
      const store = tx.objectStore(STORE_SYNC_QUEUE);
      for (const id of opIds) {
        store.delete(id);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Failed to clear sync operations:', err);
  }
}

export async function updateSyncOperationStatus(op: SyncOperation): Promise<void> {
  await enqueueSyncOperation(op);
}

export async function getLastSyncTime(workspaceKey: string): Promise<string | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_META, 'readonly');
      const req = tx.objectStore(STORE_META).get(`lastSync:${workspaceKey}`);
      req.onsuccess = () => resolve(req.result?.value ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function setLastSyncTime(workspaceKey: string, iso: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_META, 'readwrite');
      tx.objectStore(STORE_META).put({ key: `lastSync:${workspaceKey}`, value: iso });
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // ignore
  }
}
