import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatsCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  variant?: 'default' | 'primary' | 'secondary' | 'accent' | 'success' | 'warning'
  description?: string
  className?: string
  animationDelay?: number
}

export function StatsCard({ title, value, icon: Icon, variant = 'default', description, className, animationDelay = 0 }: StatsCardProps) {
  const styles = {
    default: {
      bg: 'glass-card',
      text: 'text-white',
      icon: 'bg-white/10 text-white/60',
    },
    primary: {
      bg: 'glass-card',
      text: 'text-white',
      icon: 'bg-primary/20 text-primary shadow-lg shadow-primary/20',
    },
    secondary: {
      bg: 'glass-card',
      text: 'text-white',
      icon: 'bg-secondary/20 text-secondary shadow-lg shadow-secondary/20',
    },
    accent: {
      bg: 'glass-card',
      text: 'text-white',
      icon: 'bg-accent/20 text-accent shadow-lg shadow-accent/20',
    },
    success: {
      bg: 'glass-card',
      text: 'text-white',
      icon: 'bg-success/20 text-success shadow-lg shadow-success/20',
    },
    warning: {
      bg: 'glass-card',
      text: 'text-white',
      icon: 'bg-warning/20 text-warning shadow-lg shadow-warning/20',
    },
  }

  const style = styles[variant]

  return (
    <div 
      className={cn(
        'p-5 rounded-3xl hover:scale-[1.02] transition-all duration-300 animate-slide-up group',
        style.bg, 
        style.text,
        className
      )}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-white/60">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {description && (
            <p className="text-xs mt-2 text-white/50">{description}</p>
          )}
        </div>
        <div className={cn('w-11 h-11 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300', style.icon)}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  )
}
