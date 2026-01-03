import { type MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Xpend',
    short_name: 'Xpend',
    description: 'Xpend: control de gasto y procurement estratégico.',
    start_url: '/',
    display: 'standalone',
    background_color: '#F7D047',
    theme_color: '#F7D047',
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

