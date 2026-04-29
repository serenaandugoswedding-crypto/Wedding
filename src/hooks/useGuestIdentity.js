import { useState, useEffect } from 'react';

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function useGuestIdentity() {
  const [uuid, setUuid] = useState(() => localStorage.getItem('wedding_guest_uuid') || '');
  const [name, setName] = useState(() => localStorage.getItem('wedding_guest_name') || '');
  const isIdentified = Boolean(uuid && name);

  function identify(displayName) {
    const id = uuid || generateUUID();
    localStorage.setItem('wedding_guest_uuid', id);
    localStorage.setItem('wedding_guest_name', displayName.trim());
    setUuid(id);
    setName(displayName.trim());
  }

  return { uuid, name, isIdentified, identify };
}
