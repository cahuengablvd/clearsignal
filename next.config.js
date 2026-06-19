/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Keep native/large deps out of the bundle so serverless functions build
    // and the Lambda Chromium can load at runtime.
    serverComponentsExternalPackages: [
      'puppeteer-core',
      '@sparticuz/chromium',
      '@trigger.dev/sdk',
    ],
    // @sparticuz/chromium loads its Chromium binary from its own bin/ folder at
    // runtime, so nothing imports it directly and file-tracing drops it. Force
    // it into the PDF route's function bundle.
    outputFileTracingIncludes: {
      '/api/audit/[id]/pdf': ['./node_modules/@sparticuz/chromium/bin/**'],
    },
  },
}

module.exports = nextConfig
