import * as React from 'react'
import { cn } from '@/lib/utils'

function Alert({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      role="status"
      className={cn(
        'rounded-[var(--r-row)] border border-border bg-card px-4 py-3 text-sm text-foreground shadow-(--ring-ctrl)',
        className,
      )}
      {...props}
    />
  )
}

export { Alert }
