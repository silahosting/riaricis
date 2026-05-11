import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  WAMessageContent,
  WAMessageKey,
  proto,
  isJidBroadcast,
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import express from 'express'
import pino from 'pino'
import QRCode from 'qrcode'
import fs from 'fs'
import path from 'path'

// Configuration
const PORT = process.env.PORT || 3001
const VERCEL_API_URL = process.env.VERCEL_API_URL || 'http://localhost:3000'
const BOT_SECRET = process.env.BOT_SECRET || 'your-secret-key'
const AUTH_FOLDER = process.env.AUTH_FOLDER || './auth_info'

// Logger
const logger = pino({ level: 'info' })

// Express app for QR code and pairing code
const app = express()
app.use(express.json())

// Store for connection state
interface ConnectionState {
  qrCode: string | null
  qrDataUrl: string | null
  pairingCode: string | null
  isConnected: boolean
  phoneNumber: string | null
  lastUpdated: Date
}

const connectionState: ConnectionState = {
  qrCode: null,
  qrDataUrl: null,
  pairingCode: null,
  isConnected: false,
  phoneNumber: null,
  lastUpdated: new Date(),
}

let sock: ReturnType<typeof makeWASocket> | null = null

// API Routes
app.get('/status', (req, res) => {
  res.json({
    ...connectionState,
    uptime: process.uptime(),
  })
})

app.get('/qr', (req, res) => {
  if (connectionState.isConnected) {
    res.json({ success: false, message: 'Already connected', isConnected: true })
  } else if (connectionState.qrDataUrl) {
    res.json({ 
      success: true, 
      qrDataUrl: connectionState.qrDataUrl,
      qrCode: connectionState.qrCode,
    })
  } else {
    res.json({ success: false, message: 'QR not available yet' })
  }
})

app.post('/pairing-code', async (req, res) => {
  const { phoneNumber } = req.body
  
  if (!phoneNumber) {
    return res.status(400).json({ success: false, message: 'Phone number required' })
  }

  if (connectionState.isConnected) {
    return res.json({ success: false, message: 'Already connected', isConnected: true })
  }

  try {
    // Restart connection with pairing code mode
    if (sock) {
      await restartWithPairingCode(phoneNumber)
      res.json({ success: true, message: 'Pairing code requested, check /status for the code' })
    } else {
      res.status(500).json({ success: false, message: 'Socket not initialized' })
    }
  } catch (error) {
    logger.error('Error requesting pairing code:', error)
    res.status(500).json({ success: false, message: 'Failed to request pairing code' })
  }
})

app.post('/logout', async (req, res) => {
  try {
    if (sock) {
      await sock.logout()
    }
    // Clear auth folder
    if (fs.existsSync(AUTH_FOLDER)) {
      fs.rmSync(AUTH_FOLDER, { recursive: true })
    }
    connectionState.isConnected = false
    connectionState.qrCode = null
    connectionState.qrDataUrl = null
    connectionState.pairingCode = null
    connectionState.phoneNumber = null
    
    // Restart connection
    setTimeout(() => startConnection(), 1000)
    
    res.json({ success: true, message: 'Logged out successfully' })
  } catch (error) {
    logger.error('Error logging out:', error)
    res.status(500).json({ success: false, message: 'Failed to logout' })
  }
})

app.post('/send-message', async (req, res) => {
  const { secret, to, message, type = 'text' } = req.body

  if (secret !== BOT_SECRET) {
    return res.status(401).json({ success: false, message: 'Unauthorized' })
  }

  if (!connectionState.isConnected || !sock) {
    return res.status(503).json({ success: false, message: 'WhatsApp not connected' })
  }

  try {
    const jid = to.includes('@s.whatsapp.net') ? to : `${to}@s.whatsapp.net`
    
    if (type === 'text') {
      await sock.sendMessage(jid, { text: message })
    } else if (type === 'image') {
      await sock.sendMessage(jid, { 
        image: { url: message.url },
        caption: message.caption || ''
      })
    }
    
    res.json({ success: true, message: 'Message sent' })
  } catch (error) {
    logger.error('Error sending message:', error)
    res.status(500).json({ success: false, message: 'Failed to send message' })
  }
})

// Restart connection with pairing code
async function restartWithPairingCode(phoneNumber: string) {
  connectionState.phoneNumber = phoneNumber.replace(/[^0-9]/g, '')
  
  if (sock) {
    sock.ev.removeAllListeners('connection.update')
    sock.ev.removeAllListeners('messages.upsert')
    sock.end(undefined)
  }
  
  // Start new connection with pairing code mode
  await startConnection(true)
}

// Format number to Rupiah
function toRupiah(num: number): string {
  return new Intl.NumberFormat('id-ID').format(num)
}

// Send message handler to Vercel API
async function forwardToVercel(
  from: string,
  message: string,
  pushName: string,
  messageId: string
) {
  try {
    const response = await fetch(`${VERCEL_API_URL}/api/whatsapp/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Bot-Secret': BOT_SECRET,
      },
      body: JSON.stringify({
        from,
        message,
        pushName,
        messageId,
        timestamp: Date.now(),
      }),
    })

    if (!response.ok) {
      logger.error('Failed to forward message to Vercel:', await response.text())
    }

    return response.json()
  } catch (error) {
    logger.error('Error forwarding to Vercel:', error)
    return null
  }
}

// Main connection function
async function startConnection(usePairingCode = false) {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER)
  const { version } = await fetchLatestBaileysVersion()

  sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: !usePairingCode,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
    },
    generateHighQualityLinkPreview: true,
  })

  // Handle connection updates
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr && !usePairingCode) {
      connectionState.qrCode = qr
      connectionState.qrDataUrl = await QRCode.toDataURL(qr)
      connectionState.lastUpdated = new Date()
      logger.info('QR Code updated')
    }

    if (usePairingCode && !sock?.authState.creds.registered && connectionState.phoneNumber) {
      try {
        const code = await sock?.requestPairingCode(connectionState.phoneNumber)
        connectionState.pairingCode = code?.match(/.{1,4}/g)?.join('-') || code || null
        connectionState.lastUpdated = new Date()
        logger.info('Pairing code:', connectionState.pairingCode)
      } catch (error) {
        logger.error('Error getting pairing code:', error)
      }
    }

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut
      
      connectionState.isConnected = false
      connectionState.qrCode = null
      connectionState.qrDataUrl = null
      connectionState.pairingCode = null
      connectionState.lastUpdated = new Date()
      
      logger.info('Connection closed. Reconnecting:', shouldReconnect)
      
      if (shouldReconnect) {
        setTimeout(() => startConnection(), 5000)
      }
    } else if (connection === 'open') {
      connectionState.isConnected = true
      connectionState.qrCode = null
      connectionState.qrDataUrl = null
      connectionState.pairingCode = null
      connectionState.lastUpdated = new Date()
      
      logger.info('Connected to WhatsApp!')
      
      // Notify Vercel API that bot is connected
      try {
        await fetch(`${VERCEL_API_URL}/api/whatsapp/status`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Bot-Secret': BOT_SECRET,
          },
          body: JSON.stringify({ 
            status: 'connected',
            phoneNumber: sock?.user?.id?.split(':')[0] || null,
          }),
        })
      } catch (error) {
        logger.error('Error notifying Vercel:', error)
      }
    }
  })

  // Handle incoming messages
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      // Skip if not a real message or from broadcast
      if (!msg.message || msg.key.fromMe || isJidBroadcast(msg.key.remoteJid || '')) {
        continue
      }

      const messageContent = msg.message.conversation || 
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption ||
        ''

      const from = msg.key.remoteJid || ''
      const pushName = msg.pushName || 'Unknown'
      const messageId = msg.key.id || ''

      logger.info(`Message from ${from} (${pushName}): ${messageContent}`)

      // Forward message to Vercel API for processing
      const response = await forwardToVercel(from, messageContent, pushName, messageId)

      // If Vercel API returns a reply, send it
      if (response?.reply) {
        try {
          if (response.replyType === 'image') {
            await sock?.sendMessage(from, {
              image: { url: response.reply.url },
              caption: response.reply.caption || '',
            })
          } else {
            await sock?.sendMessage(from, { text: response.reply })
          }
        } catch (error) {
          logger.error('Error sending reply:', error)
        }
      }
    }
  })

  // Save credentials when updated
  sock.ev.on('creds.update', saveCreds)
}

// Start the server
app.listen(PORT, () => {
  logger.info(`WhatsApp Bot API running on port ${PORT}`)
  startConnection()
})
