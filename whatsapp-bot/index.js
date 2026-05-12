require('dotenv').config()
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys')
const { Boom } = require('@hapi/boom')
const express = require('express')
const pino = require('pino')
const QRCode = require('qrcode')
const fs = require('fs')
const path = require('path')

// Configuration
const PORT = process.env.PORT || 3001
const VERCEL_API_URL = process.env.VERCEL_API_URL || 'http://localhost:3000'
const BOT_SECRET = process.env.BOT_SECRET || 'your-secret-key'
const AUTH_FOLDER = process.env.AUTH_FOLDER || './session'

// Express app
const app = express()
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Connection state
const state = {
  qrCode: null,
  qrDataUrl: null,
  pairingCode: null,
  isConnected: false,
  phoneNumber: null,
  waitingForPairing: false,
  pendingPhoneNumber: null
}

let sock = null

// =====================
// WEB INTERFACE
// =====================

// Home page - Simple dashboard
app.get('/', (req, res) => {
  const html = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WhatsApp Bot - cPanel</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; padding: 20px; }
    .container { max-width: 500px; margin: 0 auto; }
    .card { background: white; border-radius: 16px; padding: 24px; margin-bottom: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); }
    h1 { color: #1a1a1a; font-size: 24px; margin-bottom: 8px; }
    .subtitle { color: #666; margin-bottom: 24px; }
    .status { display: flex; align-items: center; gap: 8px; padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; }
    .status.connected { background: #d4edda; color: #155724; }
    .status.disconnected { background: #f8d7da; color: #721c24; }
    .status.waiting { background: #fff3cd; color: #856404; }
    .dot { width: 10px; height: 10px; border-radius: 50%; }
    .dot.green { background: #28a745; }
    .dot.red { background: #dc3545; }
    .dot.yellow { background: #ffc107; animation: pulse 1s infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
    .qr-container { text-align: center; padding: 20px; background: #f8f9fa; border-radius: 12px; margin-bottom: 16px; }
    .qr-container img { max-width: 250px; border-radius: 8px; }
    .pairing-code { font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #667eea; text-align: center; padding: 20px; background: #f8f9fa; border-radius: 12px; margin-bottom: 16px; }
    .form-group { margin-bottom: 16px; }
    label { display: block; margin-bottom: 8px; font-weight: 500; color: #333; }
    input { width: 100%; padding: 12px 16px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 16px; transition: border-color 0.2s; }
    input:focus { outline: none; border-color: #667eea; }
    .btn { width: 100%; padding: 14px; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; }
    .btn:active { transform: scale(0.98); }
    .btn-primary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
    .btn-primary:hover { box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4); }
    .btn-danger { background: #dc3545; color: white; margin-top: 8px; }
    .btn-secondary { background: #6c757d; color: white; margin-top: 8px; }
    .info { font-size: 13px; color: #666; margin-top: 8px; }
    .tabs { display: flex; gap: 8px; margin-bottom: 16px; }
    .tab { flex: 1; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; background: white; cursor: pointer; text-align: center; font-weight: 500; transition: all 0.2s; }
    .tab.active { border-color: #667eea; background: #667eea; color: white; }
    .tab-content { display: none; }
    .tab-content.active { display: block; }
    .phone-info { background: #e8f4fd; padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; }
    .phone-info strong { color: #0066cc; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <h1>WhatsApp Bot</h1>
      <p class="subtitle">Control Panel untuk cPanel Hosting</p>
      
      <div id="status-container">
        <!-- Status will be loaded here -->
      </div>
      
      <div id="connected-view" style="display: none;">
        <div class="phone-info">
          <strong>Terhubung sebagai:</strong> <span id="phone-display">-</span>
        </div>
        <button class="btn btn-danger" onclick="logout()">Logout WhatsApp</button>
      </div>
      
      <div id="disconnected-view" style="display: none;">
        <div class="tabs">
          <div class="tab active" onclick="switchTab('qr')">QR Code</div>
          <div class="tab" onclick="switchTab('pairing')">Pairing Code</div>
        </div>
        
        <div id="tab-qr" class="tab-content active">
          <div class="qr-container" id="qr-container">
            <p style="color: #666;">Memuat QR Code...</p>
          </div>
          <p class="info">Scan QR code ini dengan WhatsApp di HP Anda</p>
        </div>
        
        <div id="tab-pairing" class="tab-content">
          <div id="pairing-form">
            <div class="form-group">
              <label>Nomor WhatsApp</label>
              <input type="tel" id="phone" placeholder="628123456789" />
            </div>
            <button class="btn btn-primary" onclick="requestPairingCode()">Dapatkan Pairing Code</button>
            <p class="info">Masukkan nomor tanpa + atau spasi. Contoh: 628123456789</p>
          </div>
          <div id="pairing-result" style="display: none;">
            <div class="pairing-code" id="pairing-code">-</div>
            <p class="info" style="text-align: center;">Masukkan kode ini di WhatsApp > Perangkat Tertaut > Tautkan Perangkat</p>
            <button class="btn btn-secondary" onclick="resetPairing()">Minta Kode Baru</button>
          </div>
        </div>
      </div>
    </div>
    
    <div class="card">
      <h3 style="margin-bottom: 12px; font-size: 16px;">Informasi</h3>
      <p style="font-size: 13px; color: #666; line-height: 1.6;">
        Bot URL: <strong>${VERCEL_API_URL ? 'Terhubung' : 'Belum diset'}</strong><br>
        Port: <strong>${PORT}</strong><br>
        Uptime: <strong id="uptime">-</strong>
      </p>
    </div>
  </div>
  
  <script>
    function switchTab(tab) {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      document.querySelector('.tab:nth-child(' + (tab === 'qr' ? '1' : '2') + ')').classList.add('active');
      document.getElementById('tab-' + tab).classList.add('active');
    }
    
    async function checkStatus() {
      try {
        const res = await fetch('/status');
        const data = await res.json();
        
        const statusContainer = document.getElementById('status-container');
        const connectedView = document.getElementById('connected-view');
        const disconnectedView = document.getElementById('disconnected-view');
        
        if (data.isConnected) {
          statusContainer.innerHTML = '<div class="status connected"><div class="dot green"></div>Terhubung ke WhatsApp</div>';
          connectedView.style.display = 'block';
          disconnectedView.style.display = 'none';
          document.getElementById('phone-display').textContent = data.phoneNumber || '-';
        } else if (data.waitingForPairing) {
          statusContainer.innerHTML = '<div class="status waiting"><div class="dot yellow"></div>Menunggu Pairing Code</div>';
          connectedView.style.display = 'none';
          disconnectedView.style.display = 'block';
        } else {
          statusContainer.innerHTML = '<div class="status disconnected"><div class="dot red"></div>Tidak Terhubung</div>';
          connectedView.style.display = 'none';
          disconnectedView.style.display = 'block';
        }
        
        // Update QR code
        if (data.qrDataUrl && !data.isConnected) {
          document.getElementById('qr-container').innerHTML = '<img src="' + data.qrDataUrl + '" alt="QR Code" />';
        } else if (!data.isConnected) {
          document.getElementById('qr-container').innerHTML = '<p style="color: #666;">QR Code belum tersedia. Tunggu sebentar...</p>';
        }
        
        // Update pairing code
        if (data.pairingCode) {
          document.getElementById('pairing-form').style.display = 'none';
          document.getElementById('pairing-result').style.display = 'block';
          document.getElementById('pairing-code').textContent = data.pairingCode;
        }
        
        // Update uptime
        const uptime = Math.floor(data.uptime || 0);
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        document.getElementById('uptime').textContent = hours + 'j ' + minutes + 'm';
        
      } catch (err) {
        console.error('Error checking status:', err);
      }
    }
    
    async function requestPairingCode() {
      const phone = document.getElementById('phone').value.replace(/[^0-9]/g, '');
      if (!phone || phone.length < 10) {
        alert('Masukkan nomor WhatsApp yang valid');
        return;
      }
      
      try {
        const res = await fetch('/pairing-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phoneNumber: phone })
        });
        const data = await res.json();
        
        if (data.success) {
          if (data.pairingCode) {
            document.getElementById('pairing-form').style.display = 'none';
            document.getElementById('pairing-result').style.display = 'block';
            document.getElementById('pairing-code').textContent = data.pairingCode;
          } else {
            alert('Pairing code sedang diproses. Tunggu sebentar...');
          }
        } else {
          alert(data.message || 'Gagal mendapatkan pairing code');
        }
      } catch (err) {
        alert('Error: ' + err.message);
      }
    }
    
    function resetPairing() {
      document.getElementById('pairing-form').style.display = 'block';
      document.getElementById('pairing-result').style.display = 'none';
      document.getElementById('phone').value = '';
    }
    
    async function logout() {
      if (!confirm('Yakin ingin logout dari WhatsApp?')) return;
      
      try {
        const res = await fetch('/logout', { method: 'POST' });
        const data = await res.json();
        alert(data.message);
        location.reload();
      } catch (err) {
        alert('Error: ' + err.message);
      }
    }
    
    // Check status every 3 seconds
    checkStatus();
    setInterval(checkStatus, 3000);
  </script>
</body>
</html>
  `
  res.send(html)
})

// API: Get status
app.get('/status', (req, res) => {
  res.json({
    ...state,
    uptime: process.uptime()
  })
})

// API: Get QR code
app.get('/qr', (req, res) => {
  if (state.isConnected) {
    return res.json({ success: false, message: 'Sudah terhubung', isConnected: true })
  }
  if (state.qrDataUrl) {
    return res.json({ success: true, qrDataUrl: state.qrDataUrl, qrCode: state.qrCode })
  }
  res.json({ success: false, message: 'QR belum tersedia' })
})

// API: Request pairing code
app.post('/pairing-code', async (req, res) => {
  const { phoneNumber } = req.body
  
  if (!phoneNumber) {
    return res.status(400).json({ success: false, message: 'Nomor telepon diperlukan' })
  }
  
  if (state.isConnected) {
    return res.json({ success: false, message: 'Sudah terhubung', isConnected: true })
  }
  
  try {
    const cleanNumber = phoneNumber.replace(/[^0-9]/g, '')
    state.pendingPhoneNumber = cleanNumber
    state.waitingForPairing = true
    
    // Restart socket untuk pairing mode
    await restartForPairing(cleanNumber)
    
    // Wait for pairing code (max 10 seconds)
    let attempts = 0
    while (!state.pairingCode && attempts < 20) {
      await new Promise(r => setTimeout(r, 500))
      attempts++
    }
    
    if (state.pairingCode) {
      res.json({ success: true, pairingCode: state.pairingCode })
    } else {
      res.json({ success: true, message: 'Pairing code sedang diproses, cek /status' })
    }
  } catch (error) {
    console.error('Error pairing:', error)
    res.status(500).json({ success: false, message: 'Gagal request pairing code' })
  }
})

// API: Logout
app.post('/logout', async (req, res) => {
  try {
    if (sock) {
      await sock.logout()
    }
    
    // Clear session
    if (fs.existsSync(AUTH_FOLDER)) {
      fs.rmSync(AUTH_FOLDER, { recursive: true, force: true })
    }
    
    state.isConnected = false
    state.qrCode = null
    state.qrDataUrl = null
    state.pairingCode = null
    state.phoneNumber = null
    state.waitingForPairing = false
    
    // Restart
    setTimeout(() => startWhatsApp(), 2000)
    
    res.json({ success: true, message: 'Berhasil logout' })
  } catch (error) {
    console.error('Logout error:', error)
    res.status(500).json({ success: false, message: 'Gagal logout' })
  }
})

// API: Send message (from Vercel)
app.post('/send-message', async (req, res) => {
  const { secret, to, message, type = 'text' } = req.body
  
  if (secret !== BOT_SECRET) {
    return res.status(401).json({ success: false, message: 'Unauthorized' })
  }
  
  if (!state.isConnected || !sock) {
    return res.status(503).json({ success: false, message: 'WhatsApp tidak terhubung' })
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
    
    res.json({ success: true, message: 'Pesan terkirim' })
  } catch (error) {
    console.error('Send error:', error)
    res.status(500).json({ success: false, message: 'Gagal kirim pesan' })
  }
})

// =====================
// WHATSAPP CONNECTION
// =====================

async function restartForPairing(phoneNumber) {
  if (sock) {
    sock.ev.removeAllListeners('connection.update')
    sock.ev.removeAllListeners('messages.upsert')
    sock.ev.removeAllListeners('creds.update')
    sock.end(undefined)
    sock = null
  }
  
  // Clear old session
  if (fs.existsSync(AUTH_FOLDER)) {
    fs.rmSync(AUTH_FOLDER, { recursive: true, force: true })
  }
  
  await startWhatsApp(true, phoneNumber)
}

async function startWhatsApp(usePairingCode = false, phoneNumber = null) {
  const { state: authState, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER)
  
  sock = makeWASocket({
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    auth: {
      creds: authState.creds,
      keys: makeCacheableSignalKeyStore(authState.keys, pino({ level: 'silent' }))
    },
    browser: ['Ubuntu', 'Chrome', '20.0.04']
  })
  
  // Connection update handler
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update
    
    // Handle QR code
    if (qr && !usePairingCode) {
      state.qrCode = qr
      state.qrDataUrl = await QRCode.toDataURL(qr)
      console.log('[WA] QR Code updated')
    }
    
    // Handle pairing code
    if (usePairingCode && phoneNumber && !sock.authState.creds.registered) {
      try {
        const code = await sock.requestPairingCode(phoneNumber)
        state.pairingCode = code.match(/.{1,4}/g)?.join('-') || code
        state.waitingForPairing = true
        console.log('[WA] Pairing code:', state.pairingCode)
      } catch (err) {
        console.error('[WA] Pairing error:', err)
      }
    }
    
    // Connection closed
    if (connection === 'close') {
      const reason = new Boom(lastDisconnect?.error)?.output?.statusCode
      console.log('[WA] Connection closed, reason:', reason)
      
      state.isConnected = false
      state.qrCode = null
      state.qrDataUrl = null
      
      if (reason !== DisconnectReason.loggedOut) {
        setTimeout(() => startWhatsApp(), 5000)
      }
    }
    
    // Connected
    if (connection === 'open') {
      state.isConnected = true
      state.qrCode = null
      state.qrDataUrl = null
      state.pairingCode = null
      state.waitingForPairing = false
      state.phoneNumber = sock.user?.id?.split(':')[0] || null
      
      console.log('[WA] Connected as:', state.phoneNumber)
      
      // Notify Vercel
      notifyVercel('connected', state.phoneNumber)
    }
  })
  
  // Message handler
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return
    
    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue
      if (msg.key.remoteJid === 'status@broadcast') continue
      
      const text = msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption ||
        ''
      
      const from = msg.key.remoteJid
      const pushName = msg.pushName || 'Unknown'
      
      console.log(`[WA] Message from ${from}: ${text}`)
      
      // Forward to Vercel API
      const response = await forwardToVercel(from, text, pushName, msg.key.id)
      
      // Send reply if any
      if (response?.reply) {
        await sock.sendMessage(from, { text: response.reply })
      }
    }
  })
  
  sock.ev.on('creds.update', saveCreds)
}

async function notifyVercel(status, phoneNumber) {
  if (!VERCEL_API_URL) return
  
  try {
    await fetch(`${VERCEL_API_URL}/api/whatsapp/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Bot-Secret': BOT_SECRET
      },
      body: JSON.stringify({ status, phoneNumber })
    })
  } catch (err) {
    console.error('[WA] Notify error:', err)
  }
}

async function forwardToVercel(from, message, pushName, messageId) {
  if (!VERCEL_API_URL) return null
  
  try {
    const res = await fetch(`${VERCEL_API_URL}/api/whatsapp/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Bot-Secret': BOT_SECRET
      },
      body: JSON.stringify({ from, message, pushName, messageId, timestamp: Date.now() })
    })
    return await res.json()
  } catch (err) {
    console.error('[WA] Forward error:', err)
    return null
  }
}

// =====================
// START SERVER
// =====================

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════╗
║     WhatsApp Bot - cPanel Edition         ║
╠═══════════════════════════════════════════╣
║  Server running on port ${PORT}              ║
║  Open browser: http://localhost:${PORT}      ║
╚═══════════════════════════════════════════╝
  `)
  startWhatsApp()
})

// Handle errors
process.on('uncaughtException', (err) => {
  console.error('[ERROR] Uncaught:', err)
})

process.on('unhandledRejection', (err) => {
  console.error('[ERROR] Unhandled:', err)
})
