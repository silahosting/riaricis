import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getWhatsAppSettingsByUserId } from '@/lib/github-db'

// GET - Get QR code from WhatsApp bot
export async function GET() {
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
    const response = await fetch(`${settings.botUrl}/qr`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to get QR from bot' },
        { status: 502 }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching QR:', error)
    return NextResponse.json(
      { error: 'Bot is not reachable. Make sure your WhatsApp bot is running.' },
      { status: 502 }
    )
  }
}
