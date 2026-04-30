import { useState, useEffect } from 'react';

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

async function registerGuest(uuid, display_name) {
  const resp = await fetch('/api/guests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uuid, display_name }),
  });
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error(body.error || `guests API ${resp.status}`);
  }
  return resp.json();
}

export function useGuestIdentity() {
  const [uuid, setUuid] = useState(() => localStorage.getItem('wedding_guest_uuid') || '');
  const [name, setName] = useState(() => localStorage.getItem('wedding_guest_name') || '');
  const [registered, setRegistered] = useState(false);

  const isIdentified = Boolean(uuid && name);

  // On mount: re-upsert if already identified (handles DB resets and return visitors)
  useEffect(() => {
    const storedUuid = localStorage.getItem('wedding_guest_uuid');
    const storedName = localStorage.getItem('wedding_guest_name');
    if (storedUuid && storedName) {
      registerGuest(storedUuid, storedName)
        .then(() => setRegistered(true))
        .catch((err) => console.warn('[useGuestIdentity] re-register failed:', err));
    }
  }, []);

  // Returns a promise so callers can await DB confirmation before navigating
  async function identify(displayName) {
    const id = uuid || generateUUID();
    const trimmed = displayName.trim();
    localStorage.setItem('wedding_guest_uuid', id);
    localStorage.setItem('wedding_guest_name', trimmed);
    setUuid(id);
    setName(trimmed);
    try {
      await registerGuest(id, trimmed);
      setRegistered(true);
    } catch (err) {
      console.error('[useGuestIdentity] identify failed:', err);
      // Don't throw — guest UUID is in localStorage, upload will surface DB error if needed
    }
  }

  return { uuid, name, isIdentified, registered, identify };
}
