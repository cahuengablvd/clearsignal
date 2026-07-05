import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createMonitoredSite } from '@/lib/monitoring'
import { enforceRateLimits, clientIp, emailDomain } from '@/lib/rate-limit'
import { signToken } from '@/lib/tokens'

const requestSchema = z.object({
  email: z.string().email(),
  url: z.string().url(),
  competitors: z.array(z.string().url()).optional().default([]),
  icp_description: z.string().optional().default(''),
})

const DAY_MS = 24 * 60 * 60 * 1000
const MONITORING_SIGNUP_DAILY_LIMIT = Number(process.env.MONITORING_SIGNUP_DAILY_LIMIT ?? 10)

export async function POST(req: NextRequest) {
  try {
    if (process.env.MONITORING_SIGNUP_ENABLED !== 'true') {
      return NextResponse.json({ error: 'Monitoring signup is not enabled' }, { status: 404 })
    }

    const input = requestSchema.parse(await req.json())

    const hour = 60 * 60 * 1000
    const rl = await enforceRateLimits([
      { key: 'monitor:global:daily', limit: MONITORING_SIGNUP_DAILY_LIMIT, windowMs: DAY_MS },
      { key: `monitor:email:${input.email.toLowerCase()}`, limit: 5, windowMs: hour },
      { key: `monitor:ip:${clientIp(req)}`, limit: 10, windowMs: hour },
      { key: `monitor:domain:${emailDomain(input.email)}`, limit: 15, windowMs: hour },
    ])
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
    }

    const { id } = await createMonitoredSite(input)
    // Signed token gates the dashboard link we hand back.
    const token = signToken('monitor', id)
    return NextResponse.json({ id, dashboard: `/monitoring/${id}?token=${token}` })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: err.errors }, { status: 400 })
    }
    console.error('Create monitored site error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create monitored site' },
      { status: 500 }
    )
  }
}
