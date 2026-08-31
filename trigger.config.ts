import { defineConfig } from '@trigger.dev/sdk'

export default defineConfig({
  // ClearSignal project ref (overridable via TRIGGER_PROJECT_ID).
  project: process.env.TRIGGER_PROJECT_ID || 'proj_asmgraqylwwxozdsmmjx',
  // @supabase/realtime-js requires Node's native WebSocket implementation.
  // Trigger's default `node` runtime is Node 21.7.3; Node 22 is supported
  // explicitly by Trigger v4 and provides the required global WebSocket.
  runtime: 'node-22',
  dirs: ['./trigger'],
  // Full audits run 3 sequential Claude calls + a multi-engine web-search scan.
  maxDuration: 600,
})
