# Setup WhatsApp Bot di cPanel ArenaHost

## Persyaratan
- Hosting ArenaHost paket Bisnis 25rb (sudah support Node.js)
- Akses cPanel
- Domain/subdomain untuk bot (misal: `wabot.domainmu.com`)

## Langkah-langkah Setup

### 1. Buat Subdomain (Opsional tapi Disarankan)
1. Login ke cPanel ArenaHost
2. Cari **"Subdomains"** atau **"Subdomain"**
3. Buat subdomain baru, contoh: `wabot.domainmu.com`
4. Document Root: `/home/username/wabot` (sesuaikan username)

### 2. Upload File Bot
1. Di cPanel, buka **"File Manager"**
2. Masuk ke folder `/home/username/wabot`
3. Upload semua file dari folder `whatsapp-bot` ini:
   - `package.json`
   - `tsconfig.json`
   - `.env` (rename dari `.env.example` dan isi nilai yang benar)
   - Folder `src/`

### 3. Setup Node.js App di cPanel
1. Di cPanel, cari **"Setup Node.js App"**
2. Klik **"Create Application"**
3. Isi form:
   - **Node.js version**: Pilih `18.x` atau lebih baru
   - **Application mode**: Production
   - **Application root**: `/home/username/wabot`
   - **Application URL**: `wabot.domainmu.com`
   - **Application startup file**: `dist/index.js`
4. Klik **"Create"**

### 4. Install Dependencies dan Build
1. Setelah app dibuat, akan muncul terminal command
2. Copy command untuk masuk ke environment Node.js (biasanya seperti):
   ```bash
   source /home/username/nodevenv/wabot/18/bin/activate && cd /home/username/wabot
   ```
3. Di cPanel, buka **"Terminal"** dan paste command di atas
4. Jalankan:
   ```bash
   npm install
   npm run build
   ```

### 5. Konfigurasi Environment Variables
1. Di folder bot, buat file `.env` dengan isi:
   ```env
   PORT=3001
   VERCEL_API_URL=https://riaricis.vercel.app
   BOT_SECRET=buatSecretKeyRandomDisini123
   AUTH_FOLDER=./auth_info
   ```
2. Ganti `BOT_SECRET` dengan string random yang aman
3. **PENTING**: Gunakan BOT_SECRET yang sama di dashboard WhatsApp website Anda

### 6. Start Aplikasi
1. Kembali ke **"Setup Node.js App"**
2. Klik tombol **"Run NPM Script"** pilih `start`
3. Atau klik **"Restart"** pada aplikasi

### 7. Konfigurasi di Dashboard Website
1. Buka website Anda: https://riaricis.vercel.app
2. Login dan masuk ke **Dashboard > WhatsApp Bot**
3. Isi:
   - **Bot URL**: `https://wabot.domainmu.com` (URL subdomain tadi)
   - **Bot Secret**: Secret key yang sama dengan di file `.env`
4. Klik **Simpan Pengaturan**
5. Setelah tersimpan, klik **Scan QR Code** atau **Pairing Code**

## Troubleshooting

### Bot tidak bisa start
- Pastikan Node.js version minimal 18
- Cek log error di cPanel > Setup Node.js App > Logs
- Pastikan semua dependencies terinstall: `npm install`

### QR Code tidak muncul
- Tunggu beberapa detik setelah bot start
- Cek status bot di: `https://wabot.domainmu.com/status`
- Pastikan URL dan Secret benar

### Koneksi terputus terus
- Beberapa shared hosting kill process yang berjalan lama
- Solusi: Gunakan cron job untuk restart bot setiap beberapa jam
- Atau upgrade ke VPS jika sering bermasalah

### Setup Cron Job (Keep Alive)
1. Di cPanel, buka **"Cron Jobs"**
2. Tambah cron job baru:
   - **Interval**: Every 5 minutes
   - **Command**: `curl -s https://wabot.domainmu.com/status > /dev/null`

## Struktur File
```
wabot/
├── .env              # Environment variables
├── package.json      # Dependencies
├── tsconfig.json     # TypeScript config
├── src/
│   └── index.ts      # Source code
├── dist/             # Compiled code (setelah build)
│   └── index.js
└── auth_info/        # WhatsApp session (auto-generated)
```

## API Endpoints Bot
- `GET /status` - Cek status koneksi
- `GET /qr` - Dapatkan QR code
- `POST /pairing-code` - Request pairing code
- `POST /logout` - Logout WhatsApp
- `POST /send-message` - Kirim pesan (perlu secret)
