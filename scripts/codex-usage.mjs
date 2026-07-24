#!/usr/bin/env node
/**
 * Report Codex token usage per session for a given day.
 *
 * Codex writes a full transcript per session to
 * ~/.codex/sessions/<yyyy>/<mm>/<dd>/rollout-*.jsonl, and each transcript
 * carries running `token_count` events. The last one in a file is that
 * session's total, so the day's spend can be read straight off disk without
 * any API access.
 *
 * Usage:
 *   npm run codex-usage           # today
 *   npm run codex-usage 2026-07-24
 */
import { createReadStream } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { createInterface } from 'node:readline'
import { homedir } from 'node:os'
import path from 'node:path'

function dayParts(arg) {
  const d = arg ? new Date(`${arg}T12:00:00`) : new Date()
  if (Number.isNaN(d.getTime())) {
    console.error(`Not a date: ${arg}. Use YYYY-MM-DD.`)
    process.exit(1)
  }
  return {
    y: String(d.getFullYear()),
    m: String(d.getMonth() + 1).padStart(2, '0'),
    d: String(d.getDate()).padStart(2, '0'),
  }
}

/** Read one transcript, returning its working directory and final totals. */
async function readSession(file) {
  const out = { file: path.basename(file), cwd: null, requests: 0, input: 0, cached: 0, output: 0 }
  const rl = createInterface({ input: createReadStream(file), crlfDelay: Infinity })
  for await (const line of rl) {
    // Cheap pre-filter: parsing every line of a 15 MB transcript is wasteful.
    if (!line.includes('token_count') && !line.includes('session_meta')) continue
    let event
    try {
      event = JSON.parse(line)
    } catch {
      continue
    }
    const payload = event.payload || {}
    if (event.type === 'session_meta') out.cwd = payload.cwd || out.cwd
    if (event.type === 'event_msg' && payload.type === 'token_count') {
      const total = payload.info?.total_token_usage
      if (!total) continue
      out.requests += 1
      // Running totals: the last event wins.
      out.input = total.input_tokens ?? out.input
      out.cached = total.cached_input_tokens ?? out.cached
      out.output = total.output_tokens ?? out.output
    }
  }
  return out
}

const n = (value) => value.toLocaleString('en-US')

const { y, m, d } = dayParts(process.argv[2])
const dir = path.join(homedir(), '.codex', 'sessions', y, m, d)

let files
try {
  files = (await readdir(dir)).filter((f) => f.endsWith('.jsonl'))
} catch {
  console.log(`No Codex sessions found for ${y}-${m}-${d} (looked in ${dir})`)
  process.exit(0)
}

const sessions = (await Promise.all(files.map((f) => readSession(path.join(dir, f)))))
  .filter((s) => s.requests > 0)
  .sort((a, b) => b.input - a.input)

console.log(`\nCodex usage for ${y}-${m}-${d}\n`)
for (const s of sessions) {
  const project = s.cwd ? path.basename(s.cwd) : 'unknown'
  const cacheHit = s.input > 0 ? Math.round((s.cached / s.input) * 100) : 0
  console.log(`${project}`)
  console.log(`  path      ${s.cwd || '-'}`)
  console.log(`  requests  ${n(s.requests)}`)
  console.log(`  input     ${n(s.input)} tokens (${cacheHit}% cached)`)
  console.log(`  output    ${n(s.output)} tokens`)
  if (s.requests > 0) console.log(`  avg input ${n(Math.round(s.input / s.requests))} tokens/request`)
  console.log('')
}

const totalInput = sessions.reduce((sum, s) => sum + s.input, 0)
const totalOutput = sessions.reduce((sum, s) => sum + s.output, 0)
const totalReqs = sessions.reduce((sum, s) => sum + s.requests, 0)
console.log(`TOTAL  ${n(totalReqs)} requests  ${n(totalInput)} input  ${n(totalOutput)} output`)

// The number that matters: input tokens spent per token of useful output.
if (totalOutput > 0) {
  const ratio = Math.round(totalInput / totalOutput)
  console.log(`Input per output token: ${n(ratio)}:1`)
  if (ratio > 200) {
    console.log('\nA ratio above ~200:1 means sessions ran too long: every step')
    console.log('resends the whole history. Split the work into fresh sessions.')
  }
}
console.log('')
