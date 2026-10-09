import { Popover } from '@base-ui/react/popover'
import { Info } from 'lucide-react'
import type { ReactNode } from 'react'

/** Information that can be opened by hover, keyboard, click, or touch. */
export function InfoTooltip({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={label}
        openOnHover
        delay={120}
        closeDelay={60}
        className="-my-1 inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Info aria-hidden="true" className="size-3.5" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          className="z-50"
          side="top"
          sideOffset={8}
          collisionPadding={12}
        >
          <Popover.Popup
            aria-label={label}
            initialFocus={false}
            className="max-w-[min(16rem,var(--available-width))] rounded-lg bg-[var(--float)] px-3 py-2 text-sm leading-5 text-popover-foreground shadow-[var(--float-ring),var(--shadow-tip)] outline-none"
          >
            <Popover.Arrow className="size-2 rotate-45 bg-[var(--float)] data-[side=top]:-bottom-1 data-[side=bottom]:-top-1 data-[side=left]:-right-1 data-[side=right]:-left-1" />
            <Popover.Description>{children}</Popover.Description>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
