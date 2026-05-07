'use client'

import { useState, useEffect } from 'react'
import { Bot, Key, Power, Save, Eye, EyeOff, AlertCircle, CheckCircle, Webhook, Trash2, RefreshCw, CreditCard, User, Image } from 'lucide-react'
import { NeoButton } from '@/components/ui/neo-button'
import { NeoInput } from '@/components/ui/neo-input'
import { NeoBadge } from '@/components/ui/neo-badge'
import { saveBotSettingsAction, toggleBotStatusAction } from '@/actions/settings.actions'
import type { BotSettings, PaymentSettings } from '@/types'

export default function SettingsPage() {
  const [settings, setSettings] = useState<BotSettings | null>(null)
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [showToken, setShowToken] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [webhookInfo, setWebhookInfo] = useState<{ url: string; pending_update_count: number } | null>(null)
  const [settingWebhook, setSettingWebhook] = useState(false)
  const [savingPayment, setSavingPayment] = useState(false)

  useEffect(() => {
    fetchSettings()
    fetchWebhookInfo()
    fetchPaymentSettings()
  }, [])

  async function fetchSettings() {
    try {
      const res = await fetch('/api/settings')
      if (res.ok) {
        const data = await res.json()
        setSettings(data.settings)
      }
    } catch (error) {
      console.error('Error fetching settings:', error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchWebhookInfo() {
    try {
      const res = await fetch('/api/telegram/set-webhook')
      if (res.ok) {
        const data = await res.json()
        setWebhookInfo(data.webhookInfo)
      }
    } catch (error) {
      console.error('Error fetching webhook info:', error)
    }
  }

  async function fetchPaymentSettings() {
    try {
      // Use internal flag to bypass admin check - this is read-only for display
      const res = await fetch('/api/admin/payment-settings?internal=true')
      if (res.ok) {
        const data = await res.json()
        setPaymentSettings(data.settings)
      }
    } catch (error) {
      console.error('Error fetching payment settings:', error)
    }
  }

  async function handleSetWebhook() {
    setSettingWebhook(true)
    setMessage(null)
    
    try {
      const res = await fetch('/api/telegram/set-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      
      if (res.ok) {
        setMessage({ type: 'success', text: data.message })
        fetchWebhookInfo()
      } else {
        setMessage({ type: 'error', text: data.error })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Gagal memasang webhook' })
    } finally {
      setSettingWebhook(false)
    }
  }

  async function handleDeleteWebhook() {
    setSettingWebhook(true)
    setMessage(null)
    
    try {
      const res = await fetch('/api/telegram/set-webhook', {
        method: 'DELETE',
      })
      const data = await res.json()
      
      if (res.ok) {
        setMessage({ type: 'success', text: data.message })
        setWebhookInfo(null)
      } else {
        setMessage({ type: 'error', text: data.error })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Gagal menghapus webhook' })
    } finally {
      setSettingWebhook(false)
    }
  }

  async function handleSubmit(formData: FormData) {
    setSaving(true)
    setMessage(null)
    
    const result = await saveBotSettingsAction(formData)
    
    if (result.error) {
      setMessage({ type: 'error', text: result.error })
    } else {
      setMessage({ type: 'success', text: 'Pengaturan berhasil disimpan!' })
      fetchSettings()
    }
    
    setSaving(false)
  }

  async function handleToggle() {
    setToggling(true)
    setMessage(null)
    
    const result = await toggleBotStatusAction()
    
    if (result.error) {
      setMessage({ type: 'error', text: result.error })
    } else {
      setMessage({ type: 'success', text: `Bot ${result.isActive ? 'diaktifkan' : 'dinonaktifkan'}!` })
      fetchSettings()
    }
    
    setToggling(false)
  }

  async function handlePaymentMethodChange(method: 'orkut' | 'midtrans') {
    setSavingPayment(true)
    setMessage(null)
    
    try {
      const res = await fetch('/api/settings/payment-method', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethod: method }),
      })
      
      if (res.ok) {
        setMessage({ type: 'success', text: `Metode pembayaran diubah ke ${method === 'orkut' ? 'Orkut QRIS' : 'Midtrans QRIS'}` })
        fetchSettings()
      } else {
        const data = await res.json()
        setMessage({ type: 'error', text: data.error || 'Gagal mengubah metode pembayaran' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Gagal mengubah metode pembayaran' })
    } finally {
      setSavingPayment(false)
    }
  }

  // Determine active payment method
  const getActivePaymentMethod = () => {
    if (!paymentSettings) return null
    
    const methods: string[] = []
    if (paymentSettings.orkutEnabled) methods.push('Orkut QRIS')
    if (paymentSettings.midtransEnabled) methods.push('Midtrans QRIS')
    
    if (methods.length === 0) return null
    
    const defaultMethod = paymentSettings.defaultPaymentMethod === 'midtrans' ? 'Midtrans QRIS' : 'Orkut QRIS'
    
    return {
      methods,
      defaultMethod,
      isMultiple: methods.length > 1
    }
  }

  const paymentInfo = getActivePaymentMethod()

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-12 h-12 bg-primary/20 rounded-xl animate-pulse flex items-center justify-center">
          <div className="w-5 h-5 rounded-full bg-primary animate-ping" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pengaturan Bot</h1>
        <p className="text-muted-foreground text-sm">Konfigurasi token dan Owner ID untuk menjalankan bot Anda</p>
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl flex items-center gap-3 ${
            message.type === 'success' 
              ? 'bg-success/10 text-success border border-success/20' 
              : 'bg-destructive/10 text-destructive border border-destructive/20'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0" />
          )}
          <span className="font-medium text-sm">{message.text}</span>
        </div>
      )}

      {/* Bot Status Card */}
      <div className={`p-5 rounded-xl border ${
        settings?.isActive 
          ? 'bg-gradient-to-br from-accent/20 to-accent/5 border-accent/30' 
          : 'bg-gradient-to-br from-warning/20 to-warning/5 border-warning/30'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              settings?.isActive ? 'bg-accent/20 text-accent' : 'bg-warning/20 text-warning'
            }`}>
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <p className="font-semibold">Status Bot</p>
              <div className="flex items-center gap-2 mt-1">
                <NeoBadge variant={settings?.isActive ? 'success' : 'warning'}>
                  {settings?.isActive ? 'Aktif' : 'Nonaktif'}
                </NeoBadge>
                {settings?.botName && (
                  <span className="text-sm text-muted-foreground">@{settings.botName}</span>
                )}
              </div>
            </div>
          </div>
          
          <NeoButton
            variant={settings?.isActive ? 'destructive' : 'success'}
            onClick={handleToggle}
            disabled={toggling || !settings}
            className="w-full sm:w-auto"
          >
            <Power className="w-4 h-4" />
            {toggling ? 'Memproses...' : settings?.isActive ? 'Nonaktifkan' : 'Aktifkan'}
          </NeoButton>
        </div>
      </div>

      {/* Payment Method Selection Card */}
      <div className={`p-5 rounded-xl border ${
        paymentInfo 
          ? 'bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border-emerald-500/30' 
          : 'bg-card border-border'
      }`}>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              paymentInfo ? 'bg-emerald-500/20 text-emerald-500' : 'bg-muted text-muted-foreground'
            }`}>
              <CreditCard className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <p className="font-semibold">Metode Pembayaran QRIS</p>
              {paymentInfo ? (
                <p className="text-xs text-muted-foreground mt-1">
                  Pilih metode pembayaran yang akan digunakan di bot Anda
                </p>
              ) : (
                <div className="mt-1">
                  <NeoBadge variant="warning">Belum Dikonfigurasi</NeoBadge>
                  <p className="text-xs text-muted-foreground mt-2">
                    Hubungi admin untuk mengaktifkan metode pembayaran QRIS.
                  </p>
                </div>
              )}
            </div>
          </div>
          
          {paymentInfo && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {paymentSettings?.orkutEnabled && (
                <label 
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    settings?.preferredPaymentMethod === 'orkut' || (!settings?.preferredPaymentMethod && paymentSettings?.defaultPaymentMethod === 'orkut')
                      ? 'border-emerald-500 bg-emerald-500/10' 
                      : 'border-border hover:border-muted-foreground/50 bg-card'
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="orkut"
                    checked={settings?.preferredPaymentMethod === 'orkut' || (!settings?.preferredPaymentMethod && paymentSettings?.defaultPaymentMethod === 'orkut')}
                    onChange={() => handlePaymentMethodChange('orkut')}
                    className="w-4 h-4 accent-emerald-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">Orkut QRIS</span>
                      {(settings?.preferredPaymentMethod === 'orkut' || (!settings?.preferredPaymentMethod && paymentSettings?.defaultPaymentMethod === 'orkut')) && (
                        <NeoBadge variant="success" className="text-xs">Aktif</NeoBadge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Fee: Rp 100-200 (random)</p>
                  </div>
                </label>
              )}
              
              {paymentSettings?.midtransEnabled && (
                <label 
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    settings?.preferredPaymentMethod === 'midtrans'
                      ? 'border-emerald-500 bg-emerald-500/10' 
                      : 'border-border hover:border-muted-foreground/50 bg-card'
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="midtrans"
                    checked={settings?.preferredPaymentMethod === 'midtrans'}
                    onChange={() => handlePaymentMethodChange('midtrans')}
                    className="w-4 h-4 accent-emerald-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">Midtrans QRIS</span>
                      {settings?.preferredPaymentMethod === 'midtrans' && (
                        <NeoBadge variant="success" className="text-xs">Aktif</NeoBadge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Fee: 0.7% | Support: GoPay, OVO, DANA</p>
                  </div>
                </label>
              )}
            </div>
          )}
          
          {paymentInfo && savingPayment && (
            <p className="text-xs text-muted-foreground text-center">Menyimpan pilihan...</p>
          )}
        </div>
      </div>

      {/* Webhook Status Card */}
      <div className={`p-5 rounded-xl border ${
        webhookInfo?.url 
          ? 'bg-gradient-to-br from-primary/20 to-primary/5 border-primary/30' 
          : 'bg-card border-border'
      }`}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                webhookInfo?.url ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
              }`}>
                <Webhook className="w-6 h-6" />
              </div>
              <div>
                <p className="font-semibold">Webhook Telegram</p>
                <div className="flex items-center gap-2 mt-1">
                  <NeoBadge variant={webhookInfo?.url ? 'success' : 'destructive'}>
                    {webhookInfo?.url ? 'Terpasang' : 'Belum Dipasang'}
                  </NeoBadge>
                  {webhookInfo?.pending_update_count !== undefined && webhookInfo.pending_update_count > 0 && (
                    <span className="text-xs text-muted-foreground">({webhookInfo.pending_update_count} pending)</span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex gap-2">
              <NeoButton
                variant="default"
                onClick={handleSetWebhook}
                disabled={settingWebhook || !settings?.botToken}
                className="flex-1 sm:flex-none"
              >
                {webhookInfo?.url ? <RefreshCw className="w-4 h-4" /> : <Webhook className="w-4 h-4" />}
                {settingWebhook ? 'Memproses...' : webhookInfo?.url ? 'Perbarui' : 'Pasang Webhook'}
              </NeoButton>
              {webhookInfo?.url && (
                <NeoButton
                  variant="destructive"
                  size="icon"
                  onClick={handleDeleteWebhook}
                  disabled={settingWebhook}
                >
                  <Trash2 className="w-4 h-4" />
                </NeoButton>
              )}
            </div>
          </div>
          
          {webhookInfo?.url && (
            <div className="bg-muted/50 p-3 rounded-lg text-xs font-mono break-all text-muted-foreground border border-border/50">
              {webhookInfo.url}
            </div>
          )}
          
          {!settings?.botToken && (
            <p className="text-sm text-muted-foreground">
              Simpan pengaturan bot terlebih dahulu sebelum memasang webhook.
            </p>
          )}
        </div>
      </div>

      {/* Bot Configuration */}
      <div className="p-5 rounded-xl bg-card border border-border">
        <div className="mb-5">
          <h3 className="font-semibold">Konfigurasi Bot</h3>
          <p className="text-sm text-muted-foreground">
            Masukkan token bot dari BotFather dan ID Telegram Anda
          </p>
        </div>
        
        <form action={handleSubmit}>
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label htmlFor="botToken" className="text-sm font-medium text-muted-foreground">
                Bot Token
              </label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <NeoInput
                  id="botToken"
                  name="botToken"
                  type={showToken ? 'text' : 'password'}
                  placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                  className="pl-11 pr-12 font-mono text-sm"
                  defaultValue={settings?.botToken || ''}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showToken ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Dapatkan token dari @BotFather di Telegram
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="ownerId" className="text-sm font-medium text-muted-foreground">
                Owner ID
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <NeoInput
                  id="ownerId"
                  name="ownerId"
                  type="text"
                  placeholder="123456789"
                  className="pl-11 font-mono"
                  defaultValue={settings?.ownerId || ''}
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground">
                ID Telegram Anda. Dapatkan dari @userinfobot
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="botName" className="text-sm font-medium text-muted-foreground">
                Nama Bot (Opsional)
              </label>
              <div className="relative">
                <Bot className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <NeoInput
                  id="botName"
                  name="botName"
                  type="text"
                  placeholder="mybot"
                  className="pl-11"
                  defaultValue={settings?.botName || ''}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Username bot tanpa @ (untuk referensi)
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="botPhotoUrl" className="text-sm font-medium text-muted-foreground">
                URL Foto Bot (Opsional)
              </label>
              <div className="relative">
                <Image className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <NeoInput
                  id="botPhotoUrl"
                  name="botPhotoUrl"
                  type="url"
                  placeholder="https://example.com/photo.jpg"
                  className="pl-11"
                  defaultValue={settings?.botPhotoUrl || ''}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                URL gambar untuk tampilan bot (menu utama, list produk, dll). Gunakan link dari Catbox, Imgur, atau hosting lainnya.
              </p>
              {settings?.botPhotoUrl && (
                <div className="mt-2 p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-2">Preview:</p>
                  <img 
                    src={settings.botPhotoUrl} 
                    alt="Bot photo preview" 
                    className="max-w-[200px] max-h-[150px] rounded-lg object-cover border border-border"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none'
                    }}
                  />
                </div>
              )}
            </div>

            <label className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted/70 transition-colors">
              <input
                type="checkbox"
                id="isActive"
                name="isActive"
                defaultChecked={settings?.isActive || false}
                className="w-5 h-5 rounded border-border accent-primary cursor-pointer"
              />
              <span className="font-medium text-sm">
                Aktifkan bot setelah menyimpan
              </span>
            </label>

            <NeoButton type="submit" disabled={saving} className="w-full sm:w-auto">
              <Save className="w-4 h-4" />
              {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
            </NeoButton>
          </div>
        </form>
      </div>

      {/* Help Card */}
      <div className="p-5 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30">
        <h3 className="font-semibold mb-3">Cara Mendapatkan Token Bot</h3>
        <ol className="list-decimal list-inside flex flex-col gap-2 text-sm text-muted-foreground">
          <li>Buka Telegram dan cari @BotFather</li>
          <li>Kirim perintah /newbot untuk membuat bot baru</li>
          <li>Ikuti instruksi dan beri nama bot Anda</li>
          <li>Salin token yang diberikan ke field di atas</li>
          <li>Untuk Owner ID, cari @userinfobot dan kirim pesan apapun</li>
        </ol>
      </div>
    </div>
  )
}
