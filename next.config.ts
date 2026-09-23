import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The dev-tools badge would show up in Design QA screenshots.
  devIndicators: false,
  // Lets a second dev server run side by side (e.g. QA scripts) without clobbering `.next`.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  async headers() {
    return [
      {
        // Font files are versioned by path (/fonts/<family>/<version>/…) — safe to cache forever.
        source: '/fonts/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
};

export default nextConfig;
