# Deploy Semua ke cPanel ArenaHost

Panduan lengkap deploy website Next.js + WhatsApp Bot ke cPanel ArenaHost paket 25rb.

## Persyaratan

- cPanel dengan fitur "Setup Node.js App"
- Node.js versi 18 atau 20
- Akses SSH/Terminal (opsional tapi recommended)

---

## Langkah 1: Persiapan di Komputer Lokal

### 1.1. Clone/Download Repository

```bash
git clone https://github.com/silahosting/riaricis.git
cd riaricis
```

### 1.2. Install Dependencies & Build

```bash
npm install
npm run build
```

Setelah build selesai, akan ada folder `.next/standalone` yang berisi semua file yang dibutuhkan.

### 1.3. Siapkan File untuk Upload

Buat folder baru untuk upload, copy file-file ini:

```
upload/
├── .next/
│   └── standalone/      <- SEMUA ISI FOLDER INI
│   └── static/          <- COPY JUGA
├── public/              <- SEMUA ISI FOLDER PUBLIC
├── whatsapp-bot/
│   ├── index.js
│   └── package.json
├── .env                 <- BUAT MANUAL (lihat di bawah)
├── package.json
└── server.js            <- BUAT MANUAL (lihat di bawah)
```

---

## Langkah 2: Buat File Tambahan

### 2.1. Buat file `server.js` (di root folder)

```javascript
const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const path = require('path')

// Load environment variables
require('dotenv').config()

const dev = false
const hostname = '0.0.0.0'
const port = parseInt(process.env.PORT || '3000', 10)

const app = next({ dev, hostname, port, dir: __dirname })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true)
      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error('Error occurred handling', req.url, err)
      res.statusCode = 500
      res.end('internal server error')
    }
  }).listen(port, hostname, (err) => {
    if (err) throw err
    console.log(`> Ready on http://${hostname}:${port}`)
  })
})
```

### 2.2. Buat file `.env`

```env
# === WEBSITE CONFIG ===
PORT=3000
NODE_ENV=production

# GitHub Database (untuk menyimpan data)
GITHUB_TOKEN=ghp_xxxxxxxxxxxx
GITHUB_OWNER=silahosting
GITHUB_REPO=riaricis
GITHUB_PATH=data/db.json

# Session Secret (buat random string)
SESSION_SECRET=random-string-32-karakter-atau-lebih

# === WHATSAPP BOT CONFIG ===
WA_BOT_PORT=3001
WA_BOT_SECRET=secret-key-untuk-bot

# Telegram Bot (jika pakai)
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_ADMIN_ID=your-telegram-id
```

---

## Langkah 3: Upload ke cPanel

### 3.1. Buat Domain/Subdomain

1. Login ke cPanel ArenaHost
2. Pergi ke **Domains** > **Subdomains** atau **Addon Domains**
3. Buat domain, misal: `app.domainmu.com`
4. Catat folder root-nya (biasanya `/home/username/app.domainmu.com`)

### 3.2. Upload File

1. Buka **File Manager** di cPanel
2. Masuk ke folder domain
3. Upload semua file dari folder `upload/` yang sudah disiapkan
4. Atau pakai FTP untuk upload lebih cepat

**Struktur di cPanel setelah upload:**
```
/home/username/app.domainmu.com/
├── .next/
│   ├── standalone/
│   └── static/
├── public/
├── whatsapp-bot/
├── node_modules/       <- akan dibuat otomatis
├── .env
├── package.json
└── server.js
```

### 3.3. Copy Static Files

**PENTING:** Setelah upload, copy folder static ke tempat yang benar:

Di Terminal cPanel atau SSH:
```bash
cd ~/app.domainmu.com
cp -r .next/static .next/standalone/.next/
cp -r public .next/standalone/
```

---

## Langkah 4: Setup Node.js App di cPanel

### 4.1. Buat Aplikasi Node.js

1. Di cPanel, cari **Setup Node.js App**
2. Klik **Create Application**
3. Isi:
   - **Node.js version**: `18` atau `20`
   - **Application mode**: `Production`
   - **Application root**: `/home/username/app.domainmu.com/.next/standalone`
   - **Application URL**: `app.domainmu.com`
   - **Application startup file**: `server.js`

4. Klik **Create**

### 4.2. Setup Environment Variables

Di halaman Node.js App, scroll ke bagian **Environment variables**, tambahkan:

| Name | Value |
|------|-------|
| PORT | 3000 |
| NODE_ENV | production |
| GITHUB_TOKEN | ghp_xxxx |
| GITHUB_OWNER | silahosting |
| GITHUB_REPO | riaricis |
| GITHUB_PATH | data/db.json |
| SESSION_SECRET | random-string |

### 4.3. Install Dependencies

1. Klik **Run NPM Install**
2. Tunggu sampai selesai

### 4.4. Start Aplikasi

1. Klik **Start** atau **Restart**
2. Buka `https://app.domainmu.com` di browser
3. Website seharusnya sudah jalan!

---

## Langkah 5: Setup WhatsApp Bot (Opsional)

Jika mau menjalankan WhatsApp Bot juga:

### 5.1. Buat Subdomain Terpisah untuk Bot

1. Buat subdomain baru: `wabot.domainmu.com`
2. Folder: `/home/username/wabot.domainmu.com`

### 5.2. Upload WhatsApp Bot

Upload isi folder `whatsapp-bot/` ke folder subdomain tersebut.

### 5.3. Setup Node.js App untuk Bot

1. **Application root**: `/home/username/wabot.domainmu.com`
2. **Startup file**: `index.js`
3. **Environment variables**:
   - PORT: 3001
   - VERCEL_API_URL: https://app.domainmu.com
   - BOT_SECRET: secret-key-untuk-bot

### 5.4. Start Bot

Klik Start, lalu buka `https://wabot.domainmu.com` untuk scan QR code.

---

## Troubleshooting

### Error: Application tidak bisa start

1. Cek log di cPanel Node.js App
2. Pastikan semua environment variables sudah diisi
3. Pastikan folder `.next/standalone` ada dan lengkap

### Error: 503 Service Unavailable

1. Tunggu 1-2 menit setelah start
2. Coba restart aplikasi
3. Cek apakah port sudah benar

### Error: Cannot find module 'next'

Jalankan `npm install` di folder `.next/standalone`:
```bash
cd ~/app.domainmu.com/.next/standalone
npm install next react react-dom
```

### Website lambat

cPanel shared hosting memang lebih lambat dari Vercel. Untuk performa lebih baik, pertimbangkan:
- VPS (DigitalOcean, Vultr, IDCloudHost)
- Railway/Render (gratis tier)

---

## Catatan Penting

1. **Backup rutin** - cPanel shared hosting bisa tiba-tiba restart, pastikan data penting di-backup

2. **Memory limit** - Paket 25rb biasanya punya memory limit. Jika error "out of memory", kurangi fitur atau upgrade paket

3. **SSL** - Pastikan SSL sudah aktif di cPanel untuk HTTPS

4. **Update** - Setiap kali update code, perlu build ulang dan upload lagi

---

## Alternatif Lebih Mudah

Jika setup di atas terlalu ribet, pertimbangkan:

1. **Vercel (Gratis)** - Deploy otomatis dari GitHub, tidak perlu setup manual
2. **Railway ($5/bulan)** - Simple, support Node.js, auto-deploy
3. **VPS Murah ($3-5/bulan)** - Full control, bisa jalankan apa saja

Website: tetap di Vercel (gratis, cepat, auto-deploy)
WhatsApp Bot: di cPanel/Railway/VPS (butuh long-running process)
