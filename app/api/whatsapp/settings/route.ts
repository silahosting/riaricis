import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { 
  getWhatsAppSettingsByUserId, 
  createWhatsAppSettings, 
  updateWhatsAppSettings,
  deleteWhatsAppSettings 
} from '@/lib/github-db'

// GET - Get WhatsApp settings for current user
export async function GET() {
  const user = await getSession()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const settings = await getWhatsAppSettingsByUserId(user.id)
  
  // Also try to get connection status from the bot
  if (settings?.botUrl && settings?.isActive) {
    try {
      const response = await fetch(`${settings.botUrl}/status`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      })
      
      if (response.ok) {
        const status = await response.json()
        // Update local status if different
        if (status.isConnected !== settings.isConnected) {
          await updateWhatsAppSettings(user.id, {
            isConnected: status.isConnected,
            phoneNumber: status.phoneNumber || settings.phoneNumber,
          })
          settings.isConnected = status.isConnected
          settings.phoneNumber = status.phoneNumber || settings.phoneNumber
        }
      }
    } catch {
      // Bot might be offline
    }
  }

  return NextResponse.json({ settings })
}

// POST - Create or update WhatsApp settings
export async function POST(request: NextRequest) {
  const user = await getSession()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { botUrl, botSecret } = body

    if (!botUrl || !botSecret) {
      return NextResponse.json(
        { error: 'Bot URL and Bot Secret are required' },
        { status: 400 }
      )
    }

    // Check if settings already exist
    const existing = await getWhatsAppSettingsByUserId(user.id)

    if (existing) {
      // Update existing settings
      const updated = await updateWhatsAppSettings(user.id, {
        botUrl,
        botSecret,
        isActive: true,
      })
      return NextResponse.json({ settings: updated })
    } else {
      // Create new settings
      const created = await createWhatsAppSettings({
        userId: user.id,
        botUrl,
        botSecret,
        isActive: true,
        isConnected: false,
      })
      return NextResponse.json({ settings: created })
    }
  } catch (error) {
    console.error('Error saving WhatsApp settings:', error)
    return NextResponse.json(
      { error: 'Failed to save settings' },
      { status: 500 }
    )
  }
}

// DELETE - Remove WhatsApp settings
export async function DELETE() {
  const user = await getSession()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await deleteWhatsAppSettings(user.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting WhatsApp settings:', error)
    return NextResponse.json(
      { error: 'Failed to delete settings' },
      { status: 500 }
    )
  }
}
