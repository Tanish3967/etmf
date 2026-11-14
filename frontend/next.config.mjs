import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['lucide-react'],
  turbopack: {
    root: __dirname
  },
  // Proxy API requests to Go API Gateway or backend
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: process.env.API_GATEWAY_URL ? `${process.env.API_GATEWAY_URL}/api/:path*` : 'http://localhost:3002/api/:path*'
      }
    ];
  }
};

export default nextConfig;
