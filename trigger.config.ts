import { defineConfig } from '@trigger.dev/sdk'

export default defineConfig({
  // Set TRIGGER_PROJECT_ID in your env (from the Trigger.dev dashboard).
  project: process.env.TRIGGER_PROJECT_ID || 'proj_set_me',
  dirs: ['./trigger'],
  // Full audits run 3 sequential Claude calls + a multi-engine web-search scan.
  maxDuration: 600,
})
