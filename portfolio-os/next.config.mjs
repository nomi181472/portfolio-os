/** @type {import('next').NextConfig} */
const deploymentId =
  process.env.NEXT_PUBLIC_DEPLOYMENT_ID ||
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ||
  'v12';

const deploymentTimestamp =
  process.env.NEXT_PUBLIC_DEPLOYMENT_TIMESTAMP ||
  Date.now().toString();

const nextConfig = {
  env: {
    NEXT_PUBLIC_DEPLOYMENT_ID: deploymentId,
    NEXT_PUBLIC_DEPLOYMENT_TIMESTAMP: deploymentTimestamp,
  },
  images: {
    // Forked users point media anywhere. Allow https by default; tighten if you self-host.
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  experimental: { optimizePackageImports: ['react-markdown'] },
};
export default nextConfig;
