/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Forked users point media anywhere. Allow https by default; tighten if you self-host.
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  experimental: { optimizePackageImports: ['react-markdown'] },
};
export default nextConfig;
