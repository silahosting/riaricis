import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getWhatsAppSettingsByUserId } from '@/lib/github-db'

// POST - Request pairing code from WhatsApp bot
export async function POST(request: NextRequest) {
  const user = await getSession()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const settings = await getWhatsAppSettingsByUserId(user.id)
  
  if (!settings) {
    return NextResponse.json(
      { error: 'WhatsApp not configured. Please add your bot settings first.' },
      { status: 400 }
    )
  }

  if (!settings.botUrl) {
    return NextResponse.json(
      { error: 'Bot URL not configured' },
      { status: 400 }
    )
  }

  try {
    const body = await request.json()
    const { phoneNumber } = body

    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      )
    }

    const response = await fetch(`${settings.botUrl}/pairing-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber }),
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to request pairing code from bot' },
        { status: 502 }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error requesting pairing code:', error)
    return NextResponse.json(
      { error: 'Bot is not reachable. Make sure your WhatsApp bot is running.' },
      { status: 502 }
    )
  }
}
