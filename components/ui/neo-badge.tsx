import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const neoBadgeVariants = cva(
  'inline-flex items-center px-3 py-1.5 text-xs font-semibold tracking-wide rounded-full backdrop-blur-sm',
  {
    variants: {
      variant: {
        default: 'bg-primary/20 text-primary shadow-lg shadow-primary/20',
        secondary: 'bg-secondary/20 text-secondary shadow-lg shadow-secondary/20',
        accent: 'bg-accent/20 text-accent shadow-lg shadow-accent/20',
        destructive: 'bg-destructive/20 text-destructive shadow-lg shadow-destructive/20',
        success: 'bg-success/20 text-success shadow-lg shadow-success/20',
        warning: 'bg-warning/20 text-warning shadow-lg shadow-warning/20',
        outline: 'glass text-white/80',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface NeoBadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof neoBadgeVariants> {}

function NeoBadge({ className, variant, ...props }: NeoBadgeProps) {
  return (
    <div className={cn(neoBadgeVariants({ variant }), className)} {...props} />
  )
}

export { NeoBadge, neoBadgeVariants }
