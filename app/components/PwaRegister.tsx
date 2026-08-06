'use client';

import { useEffect } from 'react';

export default function PwaRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // La aplicación sigue funcionando aunque el navegador rechace la instalación.
      });
    }
  }, []);

  return null;
}
