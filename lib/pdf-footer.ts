import { execSync } from 'child_process'

let cachedBuildHash: string | null = null

export function buildHash(): string {
  if (cachedBuildHash) return cachedBuildHash

  const vercelHash = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7)
  if (vercelHash) {
    cachedBuildHash = vercelHash
    return cachedBuildHash
  }
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

export type GenerationIdentity = {
  engine_version?: string
  engine_commit?: string
}

export function footerText(generatedAt = new Date(), generation?: GenerationIdentity): string {
  const hash = buildHash()
  const engineVersion = generation?.engine_version || 'not recorded'
  const engine = generation?.engine_commit
    ? `${engineVersion} (${generation.engine_commit.slice(0, 7)})`
    : engineVersion
  return `ClearSignal audit | Renderer build: ${hash} | Generating engine: ${engine} | Generated: ${generatedAt.toISOString()}`
}

export function scoreFooterText(): string {
  return 'Source: ClearSignal AI Visibility Score — getclearsignal.io'
}
