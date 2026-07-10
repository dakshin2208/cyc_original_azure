import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Service-role client so we can write to a locked-down (RLS, no public policies)
// table. The service role key is only ever used here on the server.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)

export async function POST(request: Request) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('rank-predictor-lead: missing Supabase env vars')
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  try {
    const body = await request.json()
    const { name, phone, generalRank, community, communityRank, cutoff, userId, userEmail } = body

    // Basic validation
    if (!name || !phone || !community || generalRank == null || communityRank == null) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { error } = await supabaseAdmin.from('rank_predictor_submissions').insert({
      name: String(name).trim(),
      phone: String(phone).trim(),
      general_rank: Number(generalRank),
      community: String(community).trim(),
      community_rank: Number(communityRank),
      cutoff: cutoff == null ? null : Number(cutoff),
      user_id: userId ?? null,
      user_email: userEmail ?? null,
    })

    if (error) {
      console.error('rank-predictor-lead insert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('rank-predictor-lead route error:', e)
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 })
  }
}
