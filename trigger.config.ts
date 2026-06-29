import { defineConfig } from '@trigger.dev/sdk'

export default defineConfig({
  // ClearSignal project ref (overridable via TRIGGER_PROJECT_ID).
  project: process.env.TRIGGER_PROJECT_ID || 'proj_asmgraqylwwxozdsmmjx',
  dirs: ['./trigger'],
  // Full audits run 3 sequential Claude calls + a multi-engine web-search scan.
  maxDuration: 600,
})
