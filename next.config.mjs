/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Enable standalone output for Docker
  output: 'standalone',

  // Images configuration
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "urbaneye-gee-production.up.railway.app"
      }
    ]
  }
};

export default nextConfig;
