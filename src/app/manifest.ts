import { type MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Xpend',
    short_name: 'Xpend',
    description: 'Xpend: control de gasto y procurement estratégico.',
    start_url: '/',
    display: 'standalone',
    background_color: '#2BE7AE',
    theme_color: '#2BE7AE',
    icons: [
      {
        src: '/favicon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any'
      }
    ]
  }
}

