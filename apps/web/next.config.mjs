import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const mediaInfoWasmPath = require.resolve("mediainfo.js/MediaInfoModule.wasm")

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["wasm-erasure"],
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '105mb'
    },
    proxyClientMaxBodySize: '105mb'
  },
  allowedDevOrigins: ['192.168.31.102'],
  webpack(config) {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    }
    // The reed-solomon-erasure crate's transitive deps generate an
    // `import * from "env"` in the WASM JS glue. This module doesn't
    // exist in browsers but the code paths are never hit in WASM mode.
    config.resolve = {
      ...config.resolve,
      alias: {
        ...config.resolve?.alias,
        "MediaInfoModule.wasm": mediaInfoWasmPath,
      },
      fallback: {
        ...config.resolve?.fallback,
        env: false,
      },
    }
    return config
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'credentialless',
          }
        ],
      },
    ]
  },
  env: {
    // Automatically expose the server URL to the client bundle during build
    NEXT_PUBLIC_GO_API_URL: process.env.GO_API_URL || "http://localhost:8080/api/v1",
  },
}

export default nextConfig

if (!process.env.VERCEL) {
  import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
}
