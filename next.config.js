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
  },
}

module.exports = nextConfig
