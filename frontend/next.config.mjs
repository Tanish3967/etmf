/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['lucide-react'],
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
