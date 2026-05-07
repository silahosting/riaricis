'use client'

import { useActionState, useEffect } from 'react'
import Link from 'next/link'
import { Bot, Mail, Lock, User, ArrowRight, AlertCircle, Loader2, Sparkles, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { NeoButton } from '@/components/ui/neo-button'
import { NeoInput } from '@/components/ui/neo-input'
import { NeoCard, NeoCardHeader, NeoCardTitle, NeoCardDescription, NeoCardContent, NeoCardFooter } from '@/components/ui/neo-card'
import { registerAction } from '@/actions/auth.actions'

export default function RegisterPage() {
  const [state, formAction, isPending] = useActionState(
    async (_prevState: { error: string | null }, formData: FormData) => {
      const result = await registerAction(formData)
      return result || { error: null }
    },
    { error: null }
  )

  // Show toast on error
  useEffect(() => {
    if (state?.error) {
      toast.error('Registrasi Gagal', {
        description: state.error,
        icon: <AlertCircle className="w-5 h-5" />,
      })
    }
  }, [state?.error])

  return (
    <NeoCard className="liquid-glass rounded-[32px] animate-scale-in">
      <NeoCardHeader className="text-center">
        <div className="mx-auto w-16 h-16 bg-gradient-to-br from-secondary to-primary rounded-3xl flex items-center justify-center mb-4 shadow-lg shadow-secondary/30 animate-float relative">
          <UserPlus className="w-8 h-8 text-white" />
          <Sparkles className="absolute -top-1 -right-1 w-4 h-4 text-warning animate-pulse" />
        </div>
        <NeoCardTitle className="text-xl font-bold normal-case animate-slide-down">Buat Akun Baru</NeoCardTitle>
        <NeoCardDescription className="animate-slide-down stagger-1 text-white/60">
          Daftar untuk mulai sewa dan kelola bot Anda
        </NeoCardDescription>
      </NeoCardHeader>
      
      <NeoCardContent>
        <form action={formAction} className="flex flex-col gap-4">
          {state?.error && (
            <div className="bg-destructive/10 text-destructive p-3 rounded-lg border border-destructive/20 text-sm font-medium animate-shake flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {state.error}
            </div>
          )}
          
          <div className="flex flex-col gap-2 animate-slide-up stagger-1">
            <label htmlFor="name" className="text-sm font-medium text-white/60">
              Nama Lengkap
            </label>
            <div className="relative group">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <NeoInput
                id="name"
                name="name"
                type="text"
                placeholder="John Doe"
                className="pl-11 transition-all focus:scale-[1.01]"
                required
              />
            </div>
          </div>
          
          <div className="flex flex-col gap-2 animate-slide-up stagger-2">
            <label htmlFor="email" className="text-sm font-medium text-white/60">
              Email
            </label>
            <div className="relative group">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <NeoInput
                id="email"
                name="email"
                type="email"
                placeholder="email@example.com"
                className="pl-11 transition-all focus:scale-[1.01]"
                required
              />
            </div>
          </div>
          
          <div className="flex flex-col gap-2 animate-slide-up stagger-3">
            <label htmlFor="password" className="text-sm font-medium text-white/60">
              Password
            </label>
            <div className="relative group">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <NeoInput
                id="password"
                name="password"
                type="password"
                placeholder="Min. 6 karakter"
                className="pl-11 transition-all focus:scale-[1.01]"
                required
                minLength={6}
              />
            </div>
          </div>
          
          <div className="flex flex-col gap-2 animate-slide-up stagger-4">
            <label htmlFor="confirmPassword" className="text-sm font-medium text-white/60">
              Konfirmasi Password
            </label>
            <div className="relative group">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <NeoInput
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="Ulangi password"
                className="pl-11 transition-all focus:scale-[1.01]"
                required
                minLength={6}
              />
            </div>
          </div>
          
          <NeoButton 
            type="submit" 
            variant="secondary" 
            className="w-full mt-2 animate-slide-up stagger-5 hover:scale-[1.02] active:scale-[0.98] transition-transform" 
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Mendaftarkan...
              </>
            ) : (
              <>
                Daftar Sekarang
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </NeoButton>
        </form>
      </NeoCardContent>
      
      <NeoCardFooter className="justify-center animate-fade-in stagger-6">
        <p className="text-sm text-white/60">
          Sudah punya akun?{' '}
          <Link href="/login" className="font-semibold text-primary hover:underline transition-colors">
            Masuk
          </Link>
        </p>
      </NeoCardFooter>
    </NeoCard>
  )
}
