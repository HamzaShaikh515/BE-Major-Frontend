/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  
  // Enable standalone output for Docker
  output: 'standalone',
  
  // Images configuration
  images: {
    domains: ['localhost'],
    unoptimized: true, // For development
  },
};

export default nextConfig;
