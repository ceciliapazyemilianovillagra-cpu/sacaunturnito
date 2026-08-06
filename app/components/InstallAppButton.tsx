'use client';

import { useEffect, useState } from 'react';

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export default function InstallAppButton() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [help, setHelp] = useState('');

  useEffect(() => {
    const capture = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', capture);
    return () => window.removeEventListener('beforeinstallprompt', capture);
  }, []);

  async function install() {
    if (prompt) {
      await prompt.prompt();
      await prompt.userChoice;
      setPrompt(null);
      return;
    }
    const safari = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setHelp(
      safari
        ? 'En Safari tocá Compartir y luego “Agregar a pantalla de inicio”.'
        : 'Abrí el menú del navegador y elegí “Instalar aplicación” o “Agregar a pantalla principal”.',
    );
  }

  return (
    <div className="install-app-action">
      <button className="secondary-button install-app-button" type="button" onClick={install}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v11m0 0 4-4m-4 4-4-4M5 17v3h14v-3" /></svg>
        Instalar aplicación
      </button>
      {help && <p className="install-help" role="status">{help}</p>}
    </div>
  );
}
