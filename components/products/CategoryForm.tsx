'use client'

import { useState } from 'react'
import { FolderOpen, Hash, FileText, Save, ArrowLeft, CheckCircle2, XCircle, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { NeoButton } from '@/components/ui/neo-button'
import { NeoInput } from '@/components/ui/neo-input'
import { NeoTextarea } from '@/components/ui/neo-textarea'
import { LoadingButton } from '@/components/ui/loading-button'
import { createCategoryAction, updateCategoryAction } from '@/actions/product.actions'
import type { ProductCategory } from '@/types'

interface CategoryFormProps {
  category?: ProductCategory
}

export function CategoryForm({ category }: CategoryFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [loadingState, setLoadingState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setLoadingState('loading')
    setError(null)
    
    try {
      let result
      if (category) {
        result = await updateCategoryAction(category.id, formData)
      } else {
        result = await createCategoryAction(formData)
      }
      
      if (result?.error) {
        setError(result.error)
        setLoading(false)
        setLoadingState('error')
        toast.error(result.error, {
          icon: <XCircle className="w-5 h-5" />,
        })
        setTimeout(() => setLoadingState('idle'), 2000)
      } else {
        setLoadingState('success')
        setShowSuccess(true)
        toast.success(category ? 'Kategori berhasil diperbarui!' : 'Kategori berhasil ditambahkan!', {
          icon: <CheckCircle2 className="w-5 h-5" />,
        })
        setTimeout(() => {
          router.push('/dashboard/products')
        }, 2000)
      }
    } catch {
      setLoading(false)
      setLoadingState('error')
      toast.error('Terjadi kesalahan', {
        icon: <XCircle className="w-5 h-5" />,
      })
      setTimeout(() => setLoadingState('idle'), 2000)
    }
  }

  if (showSuccess) {
    return (
      <div className="glass-card p-5 rounded-3xl relative overflow-hidden">
        <div className="flex flex-col items-center justify-center py-16 animate-bounce-in">
          <div className="relative w-24 h-24 mb-6">
            <div className="absolute inset-0 rounded-full bg-success/20 animate-pulse" />
            <div className="absolute inset-0 flex items-center justify-center">
              <CheckCircle2 className="w-12 h-12 text-success" />
            </div>
          </div>
          
          <h3 className="text-2xl font-bold text-success mb-2">
            {category ? 'Kategori Diperbarui!' : 'Kategori Ditambahkan!'}
          </h3>
          <p className="text-white/60 text-sm flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-success animate-pulse" />
            Mengalihkan ke halaman produk...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="glass-card p-5 rounded-3xl animate-fade-in">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/dashboard/products">
          <button className="p-2 hover:bg-white/10 rounded-xl transition-all">
            <ArrowLeft className="w-5 h-5" />
          </button>
        </Link>
        <div>
          <h2 className="font-semibold text-lg">{category ? 'Edit Kategori' : 'Tambah Kategori Baru'}</h2>
          <p className="text-sm text-white/60">
            {category ? 'Perbarui informasi kategori' : 'Buat kategori produk (contoh: Alight Motion, Canva Pro)'}
          </p>
        </div>
      </div>

      <form action={handleSubmit}>
        <div className="flex flex-col gap-5">
          {error && (
            <div className="bg-destructive/10 text-destructive p-3 rounded-xl border border-destructive/20 text-sm font-medium">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="code" className="text-sm font-medium text-white/60">
                Code Kategori
              </label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                <NeoInput
                  id="code"
                  name="code"
                  type="text"
                  placeholder="AM, CP, NF"
                  className="pl-11 font-mono uppercase"
                  defaultValue={category?.code || ''}
                  disabled={!!category}
                  required
                  maxLength={10}
                />
              </div>
              <p className="text-xs text-white/40">
                Code unik untuk kategori (tidak bisa diubah)
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="name" className="text-sm font-medium text-white/60">
                Nama Kategori
              </label>
              <div className="relative">
                <FolderOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                <NeoInput
                  id="name"
                  name="name"
                  type="text"
                  placeholder="Alight Motion"
                  className="pl-11"
                  defaultValue={category?.name || ''}
                  required
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="description" className="text-sm font-medium text-white/60">
              Deskripsi (Opsional)
            </label>
            <div className="relative">
              <FileText className="absolute left-3 top-4 w-5 h-5 text-white/40" />
              <NeoTextarea
                id="description"
                name="description"
                placeholder="Deskripsi kategori produk..."
                className="pl-11 min-h-[80px]"
                defaultValue={category?.description || ''}
              />
            </div>
          </div>

          <label className="flex items-center gap-3 p-4 glass rounded-xl cursor-pointer hover:bg-white/10 transition-colors">
            <input
              type="checkbox"
              id="isActive"
              name="isActive"
              defaultChecked={category?.isActive ?? true}
              className="w-5 h-5 rounded accent-primary cursor-pointer"
            />
            <span className="font-medium text-sm">
              Aktifkan kategori (tampil di katalog)
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
              {category ? 'Simpan Perubahan' : 'Tambah Kategori'}
            </LoadingButton>
            <Link href="/dashboard/products">
              <NeoButton type="button" variant="outline" className="w-full sm:w-auto">
                Batal
              </NeoButton>
            </Link>
          </div>
        </div>
      </form>
    </div>
  )
}
