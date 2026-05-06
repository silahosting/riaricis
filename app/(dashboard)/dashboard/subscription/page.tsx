'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { NeoCard, NeoCardHeader, NeoCardTitle, NeoCardContent } from '@/components/ui/neo-card'
import { NeoButton } from '@/components/ui/neo-button'
import { NeoBadge } from '@/components/ui/neo-badge'
import { 
  Bot, 
  Wallet, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  Loader2,
  Sparkles,
  Package,
  Settings,
  ShieldCheck,
  AlertCircle
} from 'lucide-react'
import type { BotSubscription } from '@/types'

const BOT_SUBSCRIPTION_PRICE = 25000

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount)
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default function SubscriptionPage() {
  const router = useRouter()
  const [subscription, setSubscription] = useState<BotSubscription | null>(null)
  const [isActive, setIsActive] = useState(false)
  const [daysRemaining, setDaysRemaining] = useState(0)
  const [balance, setBalance] = useState(0)
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    fetchSubscription()
  }, [])

  async function fetchSubscription() {
    try {
      const res = await fetch('/api/subscription')
      if (res.ok) {
        const data = await res.json()
        setSubscription(data.subscription)
        setIsActive(data.isActive)
        setDaysRemaining(data.daysRemaining)
        setBalance(data.balance)
      }
    } catch (err) {
      console.error('Failed to fetch subscription:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handlePurchase() {
    if (balance < BOT_SUBSCRIPTION_PRICE) {
      setError('Saldo tidak mencukupi. Silakan top up saldo terlebih dahulu.')
      return
    }

    setPurchasing(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch('/api/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethod: 'saldo' }),
      })

      const data = await res.json()

      if (res.ok) {
        setSuccess('Langganan berhasil diaktifkan! Anda sekarang bisa mengakses fitur Produk dan Settings Bot.')
        await fetchSubscription()
        // Redirect to dashboard after 2 seconds
        setTimeout(() => {
          router.push('/dashboard/products')
        }, 2000)
      } else {
        setError(data.error || 'Gagal membeli langganan')
      }
    } catch (err) {
      setError('Terjadi kesalahan. Silakan coba lagi.')
    } finally {
      setPurchasing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">Sewa Auto Bot Order</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Langganan untuk mengakses fitur Produk dan Settings Bot
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-destructive/10 text-destructive border border-destructive/20 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-xl bg-success/10 text-success border border-success/20 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span className="text-sm">{success}</span>
        </div>
      )}

      {/* Current Status */}
      {isActive && subscription ? (
        <NeoCard className="bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border-emerald-500/30">
          <NeoCardContent className="p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
                <ShieldCheck className="w-7 h-7 text-emerald-500" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-emerald-500">Langganan Aktif</h2>
                <p className="text-muted-foreground text-sm">Anda memiliki akses penuh ke semua fitur</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-background/50 border border-border">
                <p className="text-muted-foreground text-xs">Sisa Waktu</p>
                <p className="text-2xl font-bold text-emerald-500">{daysRemaining} Hari</p>
              </div>
              <div className="p-4 rounded-xl bg-background/50 border border-border">
                <p className="text-muted-foreground text-xs">Berakhir Pada</p>
                <p className="font-semibold">{subscription.endDate ? formatDate(subscription.endDate) : '-'}</p>
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <NeoButton onClick={() => router.push('/dashboard/products')} className="flex-1">
                <Package className="w-4 h-4" />
                Kelola Produk
              </NeoButton>
              <NeoButton onClick={() => router.push('/dashboard/settings')} variant="outline" className="flex-1">
                <Settings className="w-4 h-4" />
                Settings Bot
              </NeoButton>
            </div>
          </NeoCardContent>
        </NeoCard>
      ) : (
        <>
          {/* Subscription Plan */}
          <NeoCard className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/30 overflow-hidden relative">
            <div className="absolute top-4 right-4">
              <NeoBadge variant="accent" className="text-xs">
                <Sparkles className="w-3 h-3 mr-1" />
                Recommended
              </NeoBadge>
            </div>
            <NeoCardContent className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center shadow-lg">
                  <Bot className="w-8 h-8 text-primary-foreground" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Sewa Auto Bot Order</h2>
                  <p className="text-muted-foreground text-sm">Paket 3 Bulan</p>
                </div>
              </div>

              <div className="mb-6">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-primary">{formatCurrency(BOT_SUBSCRIPTION_PRICE)}</span>
                  <span className="text-muted-foreground">/ 3 bulan</span>
                </div>
                <p className="text-muted-foreground text-sm mt-1">
                  Hanya {formatCurrency(Math.round(BOT_SUBSCRIPTION_PRICE / 3))} per bulan
                </p>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-sm">Akses fitur <strong>Kelola Produk</strong></span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-sm">Akses fitur <strong>Settings Bot</strong></span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-sm">Bot Telegram otomatis terima order</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-sm">Pembayaran QRIS otomatis</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-sm">Pengiriman produk otomatis</span>
                </div>
              </div>

              {/* Balance Info */}
              <div className="p-4 rounded-xl bg-background/50 border border-border mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Wallet className="w-5 h-5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Saldo Anda</span>
                  </div>
                  <span className={`font-bold ${balance >= BOT_SUBSCRIPTION_PRICE ? 'text-emerald-500' : 'text-destructive'}`}>
                    {formatCurrency(balance)}
                  </span>
                </div>
                {balance < BOT_SUBSCRIPTION_PRICE && (
                  <p className="text-xs text-destructive mt-2">
                    Saldo tidak mencukupi. Butuh minimal {formatCurrency(BOT_SUBSCRIPTION_PRICE)}
                  </p>
                )}
              </div>

              <NeoButton 
                onClick={handlePurchase} 
                disabled={purchasing || balance < BOT_SUBSCRIPTION_PRICE}
                className="w-full"
                size="lg"
              >
                {purchasing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Memproses...
                  </>
                ) : (
                  <>
                    <Wallet className="w-4 h-4" />
                    Bayar dengan Saldo
                  </>
                )}
              </NeoButton>

              <p className="text-xs text-muted-foreground text-center mt-3">
                Pembayaran akan langsung dipotong dari saldo Anda
              </p>
            </NeoCardContent>
          </NeoCard>

          {/* Info */}
          <div className="p-4 rounded-xl bg-muted/50 border border-border">
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium text-sm">Cara Top Up Saldo</p>
                <p className="text-muted-foreground text-xs mt-1">
                  Untuk menambah saldo, hubungi admin atau lakukan penjualan produk. 
                  Pendapatan dari penjualan akan otomatis masuk ke saldo Anda.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
