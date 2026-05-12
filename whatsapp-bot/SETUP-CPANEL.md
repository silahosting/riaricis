# Setup WhatsApp Bot di cPanel ArenaHost

## Persyaratan
- Hosting ArenaHost paket Bisnis 25rb (sudah support Node.js)
- Akses cPanel
- Domain/subdomain untuk bot (misal: `wabot.domainmu.com`)

## Langkah-langkah Setup

### 1. Buat Subdomain
1. Login ke cPanel ArenaHost
2. Cari **"Subdomains"** atau **"Subdomain"**
3. Buat subdomain baru, contoh: `wabot.domainmu.com`
4. Document Root: `/home/username/wabot` (sesuaikan username cpanel Anda)

### 2. Upload File Bot
1. Di cPanel, buka **"File Manager"**
2. Masuk ke folder `/home/username/wabot`
3. Upload file-file berikut dari folder `whatsapp-bot`:
   - `index.js` (file utama bot)
   - `package.json`
   - `.env` (rename dari `.env.example` dan isi nilai yang benar)

### 3. Buat File .env
Di folder bot, buat file `.env` dengan isi:
```env
PORT=3001
VERCEL_API_URL=https://riaricis.vercel.app
BOT_SECRET=buatSecretKeyRandomDisini123
AUTH_FOLDER=./session
```
**PENTING**: Ganti `BOT_SECRET` dengan string random yang aman. Gunakan nilai yang sama di dashboard website.

### 4. Setup Node.js App di cPanel
1. Di cPanel, cari **"Setup Node.js App"**
2. Klik **"Create Application"**
3. Isi form:
   - **Node.js version**: Pilih `18.x` atau `20.x`
   - **Application mode**: Production
   - **Application root**: `/home/username/wabot`
   - **Application URL**: `wabot.domainmu.com`
   - **Application startup file**: `index.js`
4. Klik **"Create"**

### 5. Install Dependencies
1. Setelah app dibuat, klik tombol **"Run NPM Install"**
2. Atau buka **"Terminal"** di cPanel dan jalankan:
   ```bash
   cd ~/wabot
   source /home/username/nodevenv/wabot/18/bin/activate
   npm install
   ```

### 6. Start Aplikasi
1. Kembali ke **"Setup Node.js App"**
2. Klik tombol **"Start App"** atau **"Restart"**
3. Bot sekarang berjalan!

### 7. Akses Web Interface Bot
1. Buka browser: `https://wabot.domainmu.com`
2. Akan muncul halaman control panel bot
3. Pilih metode koneksi:
   - **QR Code**: Scan dengan WhatsApp di HP
   - **Pairing Code**: Masukkan nomor WA, dapat kode 8 digit

### 8. Hubungkan ke Dashboard Website (Opsional)
1. Buka website: https://riaricis.vercel.app
2. Login dan masuk ke **Dashboard > WhatsApp Bot**
3. Isi:
   - **Bot URL**: `https://wabot.domainmu.com`
   - **Bot Secret**: Secret key yang sama dengan di file `.env`
4. Klik **Simpan**

---

## Troubleshooting

### Bot tidak bisa start
- Pastikan Node.js version minimal 18
- Cek log error di cPanel > Setup Node.js App > View Log
- Pastikan `npm install` sudah dijalankan

### QR Code tidak muncul
- Tunggu 5-10 detik setelah bot start
- Refresh halaman web bot
- Cek status di: `https://wabot.domainmu.com/status`

### Pairing Code error
- Pastikan nomor format benar: `628123456789` (tanpa + atau spasi)
- Nomor harus aktif dan belum terdaftar di perangkat lain

### Koneksi terputus
- Buat cron job untuk keep alive (lihat di bawah)
- Atau restart manual di cPanel jika terputus

### Setup Cron Job (Keep Alive)
1. Di cPanel, buka **"Cron Jobs"**
2. Tambah cron baru:
   - **Interval**: Every 5 minutes (`*/5 * * * *`)
   - **Command**: 
     ```
     curl -s https://wabot.domainmu.com/status > /dev/null 2>&1
     ```

---

## Struktur File
```
wabot/
├── .env              # Environment variables (BUAT MANUAL)
├── index.js          # File utama bot
├── package.json      # Dependencies
└── session/          # WhatsApp session (auto-generated)
```

## API Endpoints
| Endpoint | Method | Fungsi |
|----------|--------|--------|
| `/` | GET | Web interface (dashboard bot) |
| `/status` | GET | Cek status koneksi |
| `/qr` | GET | Dapatkan QR code |
| `/pairing-code` | POST | Request pairing code |
| `/logout` | POST | Logout WhatsApp |
| `/send-message` | POST | Kirim pesan (perlu secret) |
