'use client'

import { useState } from 'react'
import { Package, DollarSign, Tag, FileText, Save, ArrowLeft, Database, CheckCircle2, XCircle, AlertCircle, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { NeoButton } from '@/components/ui/neo-button'
import { NeoInput } from '@/components/ui/neo-input'
import { NeoTextarea } from '@/components/ui/neo-textarea'
import { NeoSelect } from '@/components/ui/neo-select'
import { StatusModal, useStatusModal } from '@/components/ui/status-modal'
import { LoadingButton } from '@/components/ui/loading-button'
import { PRODUCT_CATEGORIES } from '@/lib/constants'
import type { Product } from '@/types'

interface ProductFormProps {
  product?: Product
  onSubmit: (formData: FormData) => Promise<{ error?: string } | void>
  submitLabel?: string
}

export function ProductForm({ product, onSubmit, submitLabel = 'Simpan Produk' }: ProductFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [loadingState, setLoadingState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [stockItems, setStockItems] = useState<string>(product?.items?.join('\n') || '')
  const [showSuccess, setShowSuccess] = useState(false)
  const { showSuccess: showSuccessModal, showError: showErrorModal, StatusModalComponent } = useStatusModal()

  // Calculate stock count from items
  const stockCount = stockItems.split('\n').filter(item => item.trim().length > 0).length

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setLoadingState('loading')
    setError(null)
    
    // Add items to formData
    formData.set('items', stockItems)
    formData.set('stock', stockCount.toString())
    
    try {
      const result = await onSubmit(formData)
      
      if (result?.error) {
        setError(result.error)
        setLoading(false)
        setLoadingState('error')
        showErrorModal(
          'Gagal Menyimpan Produk',
          result.error,
          { actionLabel: 'Coba Lagi' }
        )
        toast.error(result.error, {
          icon: <XCircle className="w-5 h-5" />,
          description: 'Silakan periksa kembali data produk Anda',
        })
        // Reset state after animation
        setTimeout(() => setLoadingState('idle'), 2000)
      } else {
        setLoadingState('success')
        setShowSuccess(true)
        showSuccessModal(
          product ? 'Produk Berhasil Diperbarui!' : 'Produk Berhasil Ditambahkan!',
          product ? 'Perubahan telah disimpan ke katalog' : 'Produk baru siap dijual di bot Telegram Anda',
          { 
            actionLabel: 'Lihat Produk',
            onAction: () => router.push('/dashboard/products'),
            showConfetti: true,
            autoClose: 3000 
          }
        )
        toast.success(product ? 'Produk berhasil diperbarui!' : 'Produk berhasil ditambahkan!', {
          icon: <CheckCircle2 className="w-5 h-5" />,
          description: product ? 'Perubahan telah disimpan' : 'Produk baru telah ditambahkan ke katalog',
        })
        // Success will be shown briefly then redirect
        setTimeout(() => {
          router.push('/dashboard/products')
        }, 3000)
      }
    } catch (err) {
      setLoading(false)
      setLoadingState('error')
      showErrorModal(
        'Terjadi Kesalahan',
        'Silakan coba lagi nanti',
        { actionLabel: 'Tutup' }
      )
      toast.error('Terjadi kesalahan', {
        icon: <XCircle className="w-5 h-5" />,
        description: 'Silakan coba lagi nanti',
      })
      setTimeout(() => setLoadingState('idle'), 2000)
    }
  }

  // Success overlay
  if (showSuccess) {
    return (
      <>
        {StatusModalComponent}
        <div className="p-5 rounded-xl bg-card border border-success/30 relative overflow-hidden bg-gradient-to-b from-success/10 to-success/5">
          <div className="flex flex-col items-center justify-center py-16 animate-bounce-in">
            {/* Animated success icon */}
            <div className="relative w-24 h-24 mb-6">
              <div className="absolute inset-0 rounded-full bg-success/20 animate-success-glow" />
              <div className="absolute inset-2 rounded-full bg-success/30 animate-pulse" />
              <div className="absolute inset-0 flex items-center justify-center">
                <CheckCircle2 className="w-12 h-12 text-success animate-scale-up" />
              </div>
            </div>
            
            <h3 className="text-2xl font-bold text-success mb-2 animate-slide-up">
              {product ? 'Produk Diperbarui!' : 'Produk Ditambahkan!'}
            </h3>
            <p className="text-muted-foreground text-sm animate-slide-up stagger-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-success animate-float" />
              Mengalihkan ke halaman produk...
              <Sparkles className="w-4 h-4 text-success animate-float" style={{ animationDelay: '0.5s' }} />
            </p>
            
            {/* Loading bar */}
            <div className="w-48 h-1 bg-muted/50 rounded-full mt-6 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-success to-primary rounded-full transition-all duration-[3000ms] ease-linear"
                style={{ width: '100%' }}
              />
            </div>
          </div>
          
          {/* Confetti animation */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className="absolute w-3 h-3 rounded-full animate-confetti-fall"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: '-20px',
                  backgroundColor: ['#22c55e', '#06b6d4', '#8b5cf6', '#f59e0b', '#ec4899'][i % 5],
                  animationDelay: `${Math.random() * 1}s`,
                  animationDuration: `${2 + Math.random() * 2}s`,
                }}
              />
            ))}
          </div>
          
          {/* Sparkle decorations */}
          <Sparkles className="absolute top-8 left-8 w-5 h-5 text-success/40 animate-float" />
          <Sparkles className="absolute top-12 right-12 w-4 h-4 text-primary/40 animate-float" style={{ animationDelay: '0.3s' }} />
          <Sparkles className="absolute bottom-16 left-16 w-4 h-4 text-warning/40 animate-float" style={{ animationDelay: '0.6s' }} />
          <Sparkles className="absolute bottom-12 right-8 w-5 h-5 text-secondary/40 animate-float" style={{ animationDelay: '0.9s' }} />
        </div>
      </>
    )
  }

  return (
    <>
      {StatusModalComponent}
      <div className="p-5 rounded-xl bg-card border border-border animate-fade-in">
        <div className="flex items-center gap-4 mb-6 animate-slide-down">
          <Link href="/dashboard/products">
            <button className="p-2 hover:bg-muted rounded-lg transition-all hover:scale-105 active:scale-95">
              <ArrowLeft className="w-5 h-5" />
            </button>
          </Link>
          <div>
            <h2 className="font-semibold text-lg">{product ? 'Edit Produk' : 'Tambah Produk Baru'}</h2>
            <p className="text-sm text-muted-foreground">
              {product ? 'Perbarui informasi produk' : 'Isi informasi produk yang akan dijual'}
            </p>
          </div>
        </div>

        <form action={handleSubmit}>
        <div className="flex flex-col gap-5">
          {error && (
            <div className="bg-destructive/10 text-destructive p-3 rounded-lg border border-destructive/20 text-sm font-medium">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="name" className="text-sm font-medium text-muted-foreground">
                Nama Produk
              </label>
              <div className="relative">
                <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <NeoInput
                  id="name"
                  name="name"
                  type="text"
                  placeholder="Netflix Premium"
                  className="pl-11"
                  defaultValue={product?.name || ''}
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="category" className="text-sm font-medium text-muted-foreground">
                Kategori
              </label>
              <div className="relative">
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                <NeoSelect
                  id="category"
                  name="category"
                  className="pl-11"
                  defaultValue={product?.category || ''}
                  required
                >
                  <option value="">Pilih Kategori</option>
                  {PRODUCT_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </NeoSelect>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="description" className="text-sm font-medium text-muted-foreground">
              Deskripsi
            </label>
            <div className="relative">
              <FileText className="absolute left-3 top-4 w-5 h-5 text-muted-foreground" />
              <NeoTextarea
                id="description"
                name="description"
                placeholder="Deskripsi lengkap produk..."
                className="pl-11 min-h-[80px]"
                defaultValue={product?.description || ''}
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="price" className="text-sm font-medium text-muted-foreground">
              Harga (Rp)
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <NeoInput
                id="price"
                name="price"
                type="number"
                min="0"
                step="1000"
                placeholder="50000"
                className="pl-11"
                defaultValue={product?.price || ''}
                required
              />
            </div>
          </div>

          {/* Stock Items Input */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label htmlFor="stockItems" className="text-sm font-medium text-muted-foreground">
                Isi Produk / Stock Items
              </label>
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                stockCount > 0 
                  ? 'bg-success/20 text-success' 
                  : 'bg-muted text-muted-foreground'
              }`}>
                {stockCount} item
              </span>
            </div>
            <div className="relative">
              <Database className="absolute left-3 top-4 w-5 h-5 text-muted-foreground" />
              <textarea
                id="stockItems"
                value={stockItems}
                onChange={(e) => setStockItems(e.target.value)}
                placeholder={`Masukkan isi produk (1 item per baris):\nuser1:pass1\nuser2:pass2\nuser3:pass3\n\nAtau pisahkan dengan koma:\nitem1, item2, item3`}
                className="flex w-full bg-input px-4 py-3 pl-11 text-sm rounded-lg border border-border transition-all placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary disabled:cursor-not-allowed disabled:opacity-50 resize-none font-mono min-h-[160px]"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Masukkan akun/voucher/item yang akan dikirim ke pembeli. Pisahkan dengan baris baru atau koma.
            </p>
          </div>

          <label className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted/70 transition-colors">
            <input
              type="checkbox"
              id="isActive"
              name="isActive"
              defaultChecked={product?.isActive ?? true}
              className="w-5 h-5 rounded border-border accent-primary cursor-pointer"
            />
            <span className="font-medium text-sm">
              Aktifkan produk (tampil di katalog)
            </span>
          </label>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <LoadingButton 
              type="submit" 
              disabled={loading} 
              loading={loadingState === 'loading'}
              loadingText="Menyimpan..."
              success={loadingState === 'success'}
              successText="Tersimpan!"
              error={loadingState === 'error'}
              errorText="Gagal!"
              className="flex-1 sm:flex-none"
            >
              <Save className="w-4 h-4" />
              {submitLabel}
            </LoadingButton>
            <Link href="/dashboard/products">
              <NeoButton type="button" variant="outline" className="w-full sm:w-auto hover:scale-105 active:scale-95 transition-transform">
                Batal
              </NeoButton>
            </Link>
          </div>
        </div>
      </form>
      </div>
    </>
  )
}
