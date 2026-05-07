'use client'

import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const neoButtonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold tracking-wide transition-all duration-300 ease-out disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-5 [&_svg]:shrink-0 rounded-2xl active:scale-95',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_4px_20px_rgba(0,122,255,0.4)] hover:shadow-[0_8px_30px_rgba(0,122,255,0.5)]',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/90 shadow-[0_4px_20px_rgba(88,86,214,0.4)]',
        accent: 'bg-accent text-accent-foreground hover:bg-accent/90 shadow-[0_4px_20px_rgba(100,210,255,0.4)]',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-[0_4px_20px_rgba(255,59,48,0.4)]',
        success: 'bg-success text-success-foreground hover:bg-success/90 shadow-[0_4px_20px_rgba(48,209,88,0.4)]',
        warning: 'bg-warning text-warning-foreground hover:bg-warning/90 shadow-[0_4px_20px_rgba(255,159,10,0.4)]',
        outline: 'glass-button text-foreground hover:bg-white/15',
        ghost: 'bg-transparent border-transparent shadow-none hover:bg-white/10 rounded-2xl',
      },
      size: {
        default: 'h-12 px-6 py-2 text-sm',
        sm: 'h-10 px-4 text-xs',
        lg: 'h-14 px-8 text-base',
        icon: 'h-12 w-12 rounded-2xl',
        'icon-sm': 'h-10 w-10 rounded-2xl',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface NeoButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof neoButtonVariants> {
  asChild?: boolean
}

const NeoButton = React.forwardRef<HTMLButtonElement, NeoButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(neoButtonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
NeoButton.displayName = 'NeoButton'

export { NeoButton, neoButtonVariants }
