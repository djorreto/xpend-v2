/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'vlyqrosqapwgzyovbqpg.supabase.co',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      },
    ],
  },
  experimental: {
    outputFileTracingIncludes: {
      '/api/si/classify': ['./data/xpend-taxonomia-v1.json'],
      '/api/si/classify-batch': ['./data/xpend-taxonomia-v1.json'],
      '/api/si/model': ['./data/xpend-taxonomia-v1.json'],
      '/api/si/export': ['./data/xpend-taxonomia-v1.json'],
      '/api/admin/model-versions': ['./data/xpend-taxonomia-v1.json'],
    },
  },
}

module.exports = nextConfig
