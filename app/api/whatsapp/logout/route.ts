import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getWhatsAppSettingsByUserId, updateWhatsAppSettings } from '@/lib/github-db'

// POST - Logout from WhatsApp
export async function POST() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const settings = await getWhatsAppSettingsByUserId(user.id)
  
  if (!settings) {
    return NextResponse.json(
      { error: 'WhatsApp not configured' },
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
    // Call bot logout endpoint
    const response = await fetch(`${settings.botUrl}/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to logout from bot' },
        { status: 502 }
      )
    }

    // Update local status
    await updateWhatsAppSettings(user.id, {
      isConnected: false,
      phoneNumber: undefined,
    })

    return NextResponse.json({ success: true, message: 'Logged out successfully' })
  } catch (error) {
    console.error('Error logging out:', error)
    return NextResponse.json(
      { error: 'Bot is not reachable' },
      { status: 502 }
    )
  }
}
