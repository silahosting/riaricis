'use client'

import { useState, useEffect, useCallback } from 'react'
import { 
  MessageCircle, 
  Settings, 
  QrCode, 
  Phone, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  LogOut,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  ExternalLink
} from 'lucide-react'
import { NeoCard } from '@/components/ui/neo-card'
import { NeoButton } from '@/components/ui/neo-button'
import { NeoInput } from '@/components/ui/neo-input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import type { WhatsAppSettings } from '@/types'

interface ConnectionStatus {
  isConfigured: boolean
  isConnected: boolean
  phoneNumber?: string
  qrCode?: string
  qrDataUrl?: string
  pairingCode?: string
  uptime?: number
  botOffline?: boolean
  message?: string
}

export default function WhatsAppPage() {
  const [settings, setSettings] = useState<WhatsAppSettings | null>(null)
  const [status, setStatus] = useState<ConnectionStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [copied, setCopied] = useState(false)
  
  // Form state
  const [botUrl, setBotUrl] = useState('')
  const [botSecret, setBotSecret] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')

  // Fetch settings and status
  const fetchData = useCallback(async () => {
    try {
      const [settingsRes, statusRes] = await Promise.all([
        fetch('/api/whatsapp/settings'),
        fetch('/api/whatsapp/status')
      ])

      if (settingsRes.ok) {
        const data = await settingsRes.json()
        setSettings(data.settings)
        if (data.settings) {
          setBotUrl(data.settings.botUrl || '')
          setBotSecret(data.settings.botSecret || '')
        }
      }

      if (statusRes.ok) {
        const data = await statusRes.json()
        setStatus(data)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Auto-refresh status every 5 seconds when not connected
  useEffect(() => {
    if (status?.isConfigured && !status?.isConnected) {
      const interval = setInterval(fetchData, 5000)
      return () => clearInterval(interval)
    }
  }, [status?.isConfigured, status?.isConnected, fetchData])

  // Save settings
  const handleSaveSettings = async () => {
    if (!botUrl || !botSecret) {
      toast.error('Bot URL dan Bot Secret wajib diisi')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/whatsapp/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botUrl, botSecret })
      })

      if (res.ok) {
        const data = await res.json()
        setSettings(data.settings)
        toast.success('Pengaturan berhasil disimpan')
        fetchData()
      } else {
        const error = await res.json()
        toast.error(error.error || 'Gagal menyimpan pengaturan')
      }
    } catch {
      toast.error('Terjadi kesalahan')
    } finally {
      setSaving(false)
    }
  }

  // Request QR code
  const handleGetQR = async () => {
    setConnecting(true)
    try {
      const res = await fetch('/api/whatsapp/qr')
      if (res.ok) {
        const data = await res.json()
        if (data.isConnected) {
          toast.success('Sudah terhubung ke WhatsApp!')
          fetchData()
        } else if (data.qrDataUrl) {
          setStatus(prev => ({ ...prev!, qrDataUrl: data.qrDataUrl, qrCode: data.qrCode }))
        } else {
          toast.info('QR code belum tersedia, tunggu sebentar...')
        }
      } else {
        const error = await res.json()
        toast.error(error.error || 'Gagal mendapatkan QR code')
      }
    } catch {
      toast.error('Bot tidak dapat dijangkau')
    } finally {
      setConnecting(false)
    }
  }

  // Request pairing code
  const handleGetPairingCode = async () => {
    if (!phoneNumber) {
      toast.error('Masukkan nomor WhatsApp')
      return
    }

    setConnecting(true)
    try {
      const res = await fetch('/api/whatsapp/pairing-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber })
      })

      if (res.ok) {
        toast.success('Pairing code sedang diminta, cek status')
        setTimeout(fetchData, 2000)
      } else {
        const error = await res.json()
        toast.error(error.error || 'Gagal mendapatkan pairing code')
      }
    } catch {
      toast.error('Bot tidak dapat dijangkau')
    } finally {
      setConnecting(false)
    }
  }

  // Logout
  const handleLogout = async () => {
    if (!confirm('Yakin ingin logout dari WhatsApp?')) return

    try {
      const res = await fetch('/api/whatsapp/logout', { method: 'POST' })
      if (res.ok) {
        toast.success('Berhasil logout dari WhatsApp')
        fetchData()
      } else {
        const error = await res.json()
        toast.error(error.error || 'Gagal logout')
      }
    } catch {
      toast.error('Terjadi kesalahan')
    }
  }

  // Copy pairing code
  const handleCopyPairingCode = () => {
    if (status?.pairingCode) {
      navigator.clipboard.writeText(status.pairingCode.replace(/-/g, ''))
      setCopied(true)
      toast.success('Pairing code disalin')
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">WhatsApp Bot</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Kelola koneksi WhatsApp Bot Anda
          </p>
        </div>
        <NeoButton variant="outline" onClick={fetchData}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </NeoButton>
      </div>

      {/* Connection Status Card */}
      <NeoCard className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-primary" />
            Status Koneksi
          </h2>
          {status?.isConnected ? (
            <span className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
              <Wifi className="w-4 h-4" />
              Terhubung
            </span>
          ) : status?.botOffline ? (
            <span className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 px-3 py-1 rounded-full">
              <AlertCircle className="w-4 h-4" />
              Bot Offline
            </span>
          ) : (
            <span className="flex items-center gap-2 text-sm text-muted-foreground bg-muted px-3 py-1 rounded-full">
              <WifiOff className="w-4 h-4" />
              Tidak Terhubung
            </span>
          )}
        </div>

        {status?.isConnected && status.phoneNumber && (
          <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
            <div className="flex items-center gap-3">
              <Phone className="w-5 h-5 text-emerald-600" />
              <div>
                <p className="text-sm text-emerald-600 font-medium">Nomor Terhubung</p>
                <p className="text-lg font-semibold text-emerald-700">+{status.phoneNumber}</p>
              </div>
              <div className="ml-auto">
                <NeoButton variant="destructive" size="sm" onClick={handleLogout}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </NeoButton>
              </div>
            </div>
          </div>
        )}

        {status?.botOffline && (
          <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
            <p className="text-amber-700 text-sm">
              Bot WhatsApp tidak dapat dijangkau. Pastikan bot sudah berjalan di cPanel/server Anda.
            </p>
          </div>
        )}
      </NeoCard>

      {/* Settings or Connection */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Settings Card */}
        <NeoCard className="p-6">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <Settings className="w-5 h-5 text-primary" />
            Pengaturan Bot
          </h2>

          <div className="space-y-4">
            <div>
              <Label htmlFor="botUrl">Bot URL</Label>
              <NeoInput
                id="botUrl"
                placeholder="https://wabot.domainmu.com"
                value={botUrl}
                onChange={(e) => setBotUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                URL dari WhatsApp bot yang berjalan di cPanel/server
              </p>
            </div>

            <div>
              <Label htmlFor="botSecret">Bot Secret</Label>
              <NeoInput
                id="botSecret"
                type="password"
                placeholder="your-secret-key"
                value={botSecret}
                onChange={(e) => setBotSecret(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Secret key yang sama dengan di environment bot
              </p>
            </div>

            <NeoButton onClick={handleSaveSettings} disabled={saving} className="w-full">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Simpan Pengaturan
            </NeoButton>
          </div>
        </NeoCard>

        {/* Connection Card */}
        <NeoCard className="p-6">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <QrCode className="w-5 h-5 text-primary" />
            Hubungkan WhatsApp
          </h2>

          {!settings ? (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">
                Simpan pengaturan bot terlebih dahulu
              </p>
            </div>
          ) : status?.isConnected ? (
            <div className="text-center py-8">
              <Check className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <p className="text-emerald-600 font-medium">
                WhatsApp sudah terhubung
              </p>
            </div>
          ) : (
            <Tabs defaultValue="qr" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="qr">QR Code</TabsTrigger>
                <TabsTrigger value="pairing">Pairing Code</TabsTrigger>
              </TabsList>

              <TabsContent value="qr" className="mt-4">
                <div className="text-center">
                  {status?.qrDataUrl ? (
                    <div className="space-y-4">
                      <img
                        src={status.qrDataUrl}
                        alt="WhatsApp QR Code"
                        className="w-48 h-48 mx-auto rounded-xl border"
                      />
                      <p className="text-sm text-muted-foreground">
                        Scan QR code ini dengan WhatsApp
                      </p>
                      <NeoButton variant="outline" onClick={handleGetQR} disabled={connecting}>
                        {connecting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                        Refresh QR
                      </NeoButton>
                    </div>
                  ) : (
                    <div className="space-y-4 py-8">
                      <QrCode className="w-16 h-16 text-muted-foreground mx-auto" />
                      <p className="text-muted-foreground text-sm">
                        Klik tombol di bawah untuk mendapatkan QR code
                      </p>
                      <NeoButton onClick={handleGetQR} disabled={connecting}>
                        {connecting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <QrCode className="w-4 h-4 mr-2" />}
                        Dapatkan QR Code
                      </NeoButton>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="pairing" className="mt-4">
                <div className="space-y-4">
                  {status?.pairingCode ? (
                    <div className="text-center space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Masukkan kode ini di WhatsApp:
                      </p>
                      <div 
                        className="text-3xl font-mono font-bold tracking-widest bg-muted p-4 rounded-xl cursor-pointer hover:bg-muted/80 transition-colors"
                        onClick={handleCopyPairingCode}
                      >
                        {status.pairingCode}
                        <button className="ml-3 text-muted-foreground hover:text-foreground">
                          {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Buka WhatsApp &gt; Settings &gt; Linked Devices &gt; Link a Device &gt; Link with Phone Number
                      </p>
                    </div>
                  ) : (
                    <>
                      <div>
                        <Label htmlFor="phoneNumber">Nomor WhatsApp</Label>
                        <NeoInput
                          id="phoneNumber"
                          placeholder="628123456789"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Format: 628xxx (tanpa + atau 0)
                        </p>
                      </div>
                      <NeoButton onClick={handleGetPairingCode} disabled={connecting} className="w-full">
                        {connecting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Phone className="w-4 h-4 mr-2" />}
                        Dapatkan Pairing Code
                      </NeoButton>
                    </>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </NeoCard>
      </div>

      {/* Instructions */}
      <NeoCard className="p-6">
        <h2 className="text-lg font-semibold mb-4">Cara Setup WhatsApp Bot</h2>
        <div className="space-y-4 text-sm text-muted-foreground">
          <div className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">1</span>
            <div>
              <p className="font-medium text-foreground">Upload Bot ke cPanel</p>
              <p>Upload folder <code className="bg-muted px-1 py-0.5 rounded">whatsapp-bot</code> ke cPanel ArenaHost. Buat subdomain seperti <code className="bg-muted px-1 py-0.5 rounded">wabot.domainmu.com</code> dan setup Node.js App.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">2</span>
            <div>
              <p className="font-medium text-foreground">Set Environment Variables (.env)</p>
              <p>
                <code className="bg-muted px-1 py-0.5 rounded">VERCEL_API_URL</code> = URL website ini<br/>
                <code className="bg-muted px-1 py-0.5 rounded">BOT_SECRET</code> = Secret key yang sama
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">3</span>
            <div>
              <p className="font-medium text-foreground">Input Pengaturan di Sini</p>
              <p>Masukkan Bot URL dari cPanel (subdomain) dan Bot Secret yang sama.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">4</span>
            <div>
              <p className="font-medium text-foreground">Scan QR / Pairing Code</p>
              <p>Hubungkan WhatsApp menggunakan QR code atau pairing code.</p>
            </div>
          </div>
        </div>

        <div className="mt-6 p-4 bg-muted rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <ExternalLink className="w-4 h-4 text-primary" />
            <span className="font-medium text-sm">Link Berguna</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <a 
              href="https://arenahost.id" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-xs bg-background px-3 py-1.5 rounded-full hover:bg-primary hover:text-white transition-colors"
            >
              ArenaHost.id
            </a>
            <a 
              href="https://github.com/silahosting/riaricis/blob/main/whatsapp-bot/SETUP-CPANEL.md" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-xs bg-background px-3 py-1.5 rounded-full hover:bg-primary hover:text-white transition-colors"
            >
              Panduan Setup cPanel
            </a>
          </div>
        </div>
      </NeoCard>
    </div>
  )
}
