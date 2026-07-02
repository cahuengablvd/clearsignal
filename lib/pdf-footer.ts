import { execSync } from 'child_process'

let cachedBuildHash: string | null = null

export function buildHash(): string {
  if (cachedBuildHash) return cachedBuildHash

  const vercelHash = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7)
  try {
    cachedBuildHash = execSync('git rev-parse --short HEAD', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    cachedBuildHash = vercelHash || 'unknown'
  }

  return cachedBuildHash
}

export function footerText(generatedAt = new Date()): string {
  const hash = buildHash()
  const version = process.env.TRIGGER_VERSION || process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'dev'
  return `ClearSignal audit | Build: ${hash} | Version: ${version} | Generated: ${generatedAt.toISOString()}`
}
