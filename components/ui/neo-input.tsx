import * as React from 'react'
import { cn } from '@/lib/utils'

export interface NeoInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const NeoInput = React.forwardRef<HTMLInputElement, NeoInputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-12 w-full bg-muted border border-border px-4 py-2 text-sm text-foreground rounded-xl transition-all duration-300 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
NeoInput.displayName = 'NeoInput'

export { NeoInput }
