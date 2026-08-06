import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SACA UN TURNITO',
    short_name: 'UN TURNITO',
    description: 'Turnos online simples, seguros y ordenados.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f8f8fc',
    theme_color: '#3157f6',
    orientation: 'any',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  };
}
