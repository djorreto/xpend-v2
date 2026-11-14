/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'qtncgtqgvilbjhrvzoxe.supabase.co',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'http',
        hostname: '127.0.0.1',
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
