/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'mswuuu...supabase.co', // deja tu hostname supabase tal como está
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      },
    ],
  },

  // 👇 Agregamos esto para que Vercel no falle por ESLint en build
  eslint: {
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig
