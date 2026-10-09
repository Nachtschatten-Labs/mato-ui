import * as React from 'react'
import { cn } from '@/lib/utils'

function Input({ className, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      data-slot="input"
      className={cn(
        'flex h-12 w-full rounded-[var(--r-ctrl)] border border-transparent bg-background px-4 text-base text-foreground shadow-(--sunk) outline-none transition placeholder:text-[var(--t4)] focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
