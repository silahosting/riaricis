import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getWhatsAppSettingsByUserId, updateWhatsAppSettings } from '@/lib/github-db'

// GET - Get connection status for current user
export async function GET() {
  const user = await getSession()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const settings = await getWhatsAppSettingsByUserId(user.id)
  
  if (!settings) {
    return NextResponse.json({ 
      isConfigured: false,
      isConnected: false 
    })
  }

  // Try to get live status from bot
  if (settings.botUrl) {
    try {
      const response = await fetch(`${settings.botUrl}/status`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      })

      if (response.ok) {
        const botStatus = await response.json()
        
        // Update local status
        if (botStatus.isConnected !== settings.isConnected) {
          await updateWhatsAppSettings(user.id, {
            isConnected: botStatus.isConnected,
            phoneNumber: botStatus.phoneNumber || settings.phoneNumber,
          })
        }

        return NextResponse.json({
          isConfigured: true,
          isConnected: botStatus.isConnected,
          phoneNumber: botStatus.phoneNumber,
          qrCode: botStatus.qrCode,
          qrDataUrl: botStatus.qrDataUrl,
          pairingCode: botStatus.pairingCode,
          uptime: botStatus.uptime,
          lastUpdated: botStatus.lastUpdated,
        })
      }
    } catch {
      // Bot is offline
      return NextResponse.json({
        isConfigured: true,
        isConnected: false,
        botOffline: true,
        message: 'Bot is not reachable',
      })
    }
  }

  return NextResponse.json({
    isConfigured: true,
    isConnected: settings.isConnected,
    phoneNumber: settings.phoneNumber,
  })
}

// POST - Update connection status (called by the bot)
export async function POST(request: NextRequest) {
  try {
    const botSecret = request.headers.get('X-Bot-Secret')
    const body = await request.json()
    const { status, phoneNumber } = body

    if (!botSecret) {
      return NextResponse.json({ error: 'Missing bot secret' }, { status: 401 })
    }

    // Find user by bot secret - we need to search through all settings
    // In production, you might want to index by botSecret
    const { getFileContent } = await import('@/lib/github-db')
    const { content } = await getFileContent()
    
    const settings = content.whatsappSettings?.find(s => s.botSecret === botSecret)
    
    if (!settings) {
      return NextResponse.json({ error: 'Invalid bot secret' }, { status: 401 })
    }

    // Update connection status
    await updateWhatsAppSettings(settings.userId, {
      isConnected: status === 'connected',
      phoneNumber: phoneNumber || settings.phoneNumber,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating status:', error)
    return NextResponse.json(
      { error: 'Failed to update status' },
      { status: 500 }
    )
  }
}
