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
  const body = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(body.message || body.error || body.detail || `guests API ${resp.status}`);
  }
  return body;
}

export function useGuestIdentity() {
  const [uuid, setUuid] = useState(() => localStorage.getItem('wedding_guest_uuid') || '');
  const [name, setName] = useState(() => localStorage.getItem('wedding_guest_name') || '');
  const [registered, setRegistered] = useState(false);
  const [registerError, setRegisterError] = useState('');

  const isIdentified = Boolean(uuid && name);

  // On mount: re-upsert if already identified (handles DB resets and return visitors)
  useEffect(() => {
    const storedUuid = localStorage.getItem('wedding_guest_uuid');
    const storedName = localStorage.getItem('wedding_guest_name');
    if (storedUuid && storedName) {
      registerGuest(storedUuid, storedName)
        .then(() => setRegistered(true))
        .catch((err) => {
          console.error('[useGuestIdentity] re-register failed:', err.message);
          setRegisterError(err.message);
        });
    }
  }, []);

  // Throws on DB failure so Cover.jsx can show the error
  async function identify(displayName) {
    const id = uuid || generateUUID();
    const trimmed = displayName.trim();
    setRegisterError('');
    await registerGuest(id, trimmed); // throws if API fails (409 = name taken)
    localStorage.setItem('wedding_guest_uuid', id);
    localStorage.setItem('wedding_guest_name', trimmed);
    setUuid(id);
    setName(trimmed);
    setRegistered(true);
  }

  return { uuid, name, isIdentified, registered, registerError, identify };
}
