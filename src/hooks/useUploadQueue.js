import { useState, useEffect, useCallback } from 'react';

const DB_NAME = 'wedding_upload_queue';
const STORE   = 'pending_uploads';
const VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror   = ()  => reject(req.error);
  });
}

async function enqueue(payload) {
  const db    = await openDB();
  const tx    = db.transaction(STORE, 'readwrite');
  const store = tx.objectStore(STORE);
  return new Promise((res, rej) => {
    const req    = store.add({ payload, enqueuedAt: Date.now() });
    req.onsuccess = () => res(req.result);
    req.onerror   = () => rej(req.error);
  });
}

async function dequeue(id) {
  const db    = await openDB();
  const tx    = db.transaction(STORE, 'readwrite');
  const store = tx.objectStore(STORE);
  return new Promise((res, rej) => {
    const req    = store.delete(id);
    req.onsuccess = () => res();
    req.onerror   = () => rej(req.error);
  });
}

async function getPending() {
  const db    = await openDB();
  const tx    = db.transaction(STORE, 'readonly');
  const store = tx.objectStore(STORE);
  return new Promise((res, rej) => {
    const req    = store.getAll();
    req.onsuccess = () => res(req.result);
    req.onerror   = () => rej(req.error);
  });
}

async function flushQueue(onSuccess) {
  const items = await getPending();
  for (const item of items) {
    try {
      const resp = await fetch('/api/upload', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(item.payload),
      });
      if (resp.ok) {
        await dequeue(item.id);
        onSuccess?.();
      }
    } catch {
      break; // still offline, stop
    }
  }
}

export function useUploadQueue() {
  const [pendingCount, setPendingCount] = useState(0);

  const refresh = useCallback(async () => {
    const items = await getPending();
    setPendingCount(items.length);
  }, []);

  useEffect(() => {
    refresh();
    const handler = () => flushQueue(refresh);
    window.addEventListener('online', handler);
    return () => window.removeEventListener('online', handler);
  }, [refresh]);

  async function uploadOrQueue(payload) {
    if (navigator.onLine) {
      const resp = await fetch('/api/upload', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      if (resp.ok) return { ok: true, data: await resp.json() };
      // server error — still queue
    }
    await enqueue(payload);
    await refresh();
    // Register background sync if supported
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      const reg = await navigator.serviceWorker.ready;
      reg.sync.register('wedding-upload-sync').catch(() => {});
    }
    return { ok: false, queued: true };
  }

  return { pendingCount, uploadOrQueue, refreshQueue: refresh };
}
