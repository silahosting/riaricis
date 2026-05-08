import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  
  if (session) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Subtle gradient background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px]" />
        <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] bg-secondary/5 rounded-full blur-[100px]" />
      </div>
      
      <div className="w-full max-w-md relative z-10">
        {children}
      </div>
    </div>
  )
}
