import * as React from 'react'
import { cn } from '@/lib/utils'

export interface NeoTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const NeoTextarea = React.forwardRef<HTMLTextAreaElement, NeoTextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'flex min-h-[120px] w-full glass-input px-4 py-3 text-sm rounded-2xl transition-all duration-300 placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50 resize-none',
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
NeoTextarea.displayName = 'NeoTextarea'

export { NeoTextarea }
