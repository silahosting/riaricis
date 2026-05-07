'use client'

import { Menu, Bell } from 'lucide-react'
import { NeoButton } from '@/components/ui/neo-button'
import type { SessionUser } from '@/types'

interface NavbarProps {
  user: SessionUser
  onMenuClick: () => void
}

export function Navbar({ user, onMenuClick }: NavbarProps) {
  return (
    <header className="glass-nav p-4 flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 hover:bg-white/10 rounded-xl transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        
        <div className="hidden sm:block">
          <h2 className="font-semibold text-lg">Selamat Datang!</h2>
          <p className="text-sm text-white/60">{user.name}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className="p-2 hover:bg-white/10 rounded-xl transition-colors relative">
          <Bell className="w-5 h-5 text-white/60" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full animate-pulse shadow-lg shadow-primary/50" />
        </button>
        
        {user.profilePhotoUrl ? (
          <img 
            src={user.profilePhotoUrl} 
            alt={user.name}
            className="w-10 h-10 rounded-2xl object-cover shadow-lg shadow-secondary/30"
            onError={(e) => {
              const target = e.target as HTMLImageElement
              target.style.display = 'none'
              target.nextElementSibling?.classList.remove('hidden')
            }}
          />
        ) : null}
        <div className={`w-10 h-10 bg-gradient-to-br from-secondary to-primary rounded-2xl flex items-center justify-center font-semibold text-white shadow-lg shadow-secondary/30 ${user.profilePhotoUrl ? 'hidden' : ''}`}>
          {user.name.charAt(0).toUpperCase()}
        </div>
      </div>
    </header>
  )
}
