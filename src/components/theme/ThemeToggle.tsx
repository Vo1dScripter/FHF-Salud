'use client';

import { useSyncExternalStore } from 'react';

const themeEvent = 'fhf-theme-change';
const storageKey = 'fhf-theme';

function getSnapshot() {
  return document.documentElement.dataset.theme === 'dark';
}

function subscribe(onChange: () => void) {
  function syncStorage(event: StorageEvent) {
    if (event.key === storageKey || event.key === null) {
      document.documentElement.dataset.theme =
        event.newValue === 'dark' ? 'dark' : 'light';
      onChange();
    }
  }
  window.addEventListener(themeEvent, onChange);
  window.addEventListener('storage', syncStorage);
  return () => {
    window.removeEventListener(themeEvent, onChange);
    window.removeEventListener('storage', syncStorage);
  };
}

export default function ThemeToggle() {
  const isDark = useSyncExternalStore(subscribe, getSnapshot, () => false);

  function toggleTheme() {
    const nextTheme = getSnapshot() ? 'light' : 'dark';
    document.documentElement.dataset.theme = nextTheme;
    try {
      window.localStorage.setItem(storageKey, nextTheme);
    } catch {
      // La preferencia sigue funcionando en esta pestaña si el almacenamiento está bloqueado.
    }
    window.dispatchEvent(new Event(themeEvent));
  }

  return (
    <button
      aria-checked={isDark}
      aria-label='Modo oscuro'
      className='fhf-theme-toggle'
      onClick={toggleTheme}
      role='switch'
      type='button'
    >
      <svg
        aria-hidden='true'
        fill='none'
        height='18'
        stroke='currentColor'
        strokeLinecap='round'
        strokeLinejoin='round'
        strokeWidth='2'
        viewBox='0 0 24 24'
        width='18'
      >
        {isDark ? (
          <path d='M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.463.402.807a6.25 6.25 0 0 0 8.268 8.268c.344-.215.829-.003.803.397' />
        ) : (
          <>
            <circle cx='12' cy='12' r='4' />
            <path d='M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42m0-14.14-1.42 1.42m-11.3 11.3-1.42 1.42' />
          </>
        )}
      </svg>
      <span>{isDark ? 'Oscuro' : 'Claro'}</span>
    </button>
  );
}
