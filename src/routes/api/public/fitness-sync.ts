import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-sync-secret',
  'Access-Control-Max-Age': '86400',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })

const num = z.coerce.number().finite().min(0).max(100000)

const daySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  steps: num.optional().default(0),
  active_calories: num.optional().default(0),
  exercise_minutes: num.optional().default(0),
  stand_hours: num.max(24).optional().default(0),
})

const payloadSchema = z.union([daySchema, z.array(daySchema).min(1).max(400)])

export const Route = createFileRoute('/api/public/fitness-sync')({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),

      GET: async () => json({ ok: true, endpoint: 'fitness-sync', method: 'POST' }),

      POST: async ({ request }) => {
        const secret = process.env['SYNC_SECRET']
        if (!secret) return json({ error: 'Sync not configured' }, 500)

        const provided = request.headers.get('x-sync-secret') ?? ''
        if (provided.length !== secret.length || provided !== secret) {
          return json({ error: 'Unauthorized' }, 401)
        }

        let raw: unknown
        try {
          raw = await request.json()
        } catch {
          return json({ error: 'Invalid JSON body' }, 400)
        }

        const parsed = payloadSchema.safeParse(raw)
        if (!parsed.success) {
          return json({ error: 'Invalid payload', details: parsed.error.issues }, 400)
        }

        const rows = Array.isArray(parsed.data) ? parsed.data : [parsed.data]

        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
        const { error } = await supabaseAdmin
          .from('fitness_rings')
          .upsert(rows, { onConflict: 'date' })

        if (error) return json({ error: error.message }, 500)

        return json({ ok: true, synced: rows.length })
      },
    },
  },
})
