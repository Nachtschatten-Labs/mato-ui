import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { Toaster as Sonner } from 'sonner'
import type { ToasterProps } from 'sonner'
import './sonner.css'

const TOAST_DURATION = 8000

const toastIcons = {
  done: <path d="M3.5 8.5l3 3 6-7" />,
  pause: <path d="M6 4v8M10 4v8" />,
  play: (
    <path d="M5.5 3.5l7 4.5-7 4.5z" fill="currentColor" strokeWidth="1.5" />
  ),
  wait: (
    <>
      <circle cx="8" cy="8" r="6" strokeWidth="1.5" />
      <path d="M8 4.8V8l2.2 1.4" strokeWidth="1.5" />
    </>
  ),
  error: <path d="M8 4v4.5M8 11.5h.01" />,
  warning: <path d="M8 4v4.5M8 11.5h.01" />,
}

function ToastIcon({ kind }: { kind: keyof typeof toastIcons }) {
  return (
    <span className="toast-icon" data-kind={kind} aria-hidden="true">
      <svg className="toast-ring" viewBox="0 0 28 28">
        <circle cx="14" cy="14" r="13" />
      </svg>
      <svg
        width="12"
        height="12"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {toastIcons[kind]}
      </svg>
    </span>
  )
}

function Toaster({
  duration = TOAST_DURATION,
  icons,
  style,
  toastOptions,
  ...props
}: ToasterProps) {
  const [documentHidden, setDocumentHidden] = useState(false)

  useEffect(() => {
    const syncVisibility = () => setDocumentHidden(document.hidden)
    syncVisibility()
    document.addEventListener('visibilitychange', syncVisibility)
    return () =>
      document.removeEventListener('visibilitychange', syncVisibility)
  }, [])

  return (
    <Sonner
      position="bottom-right"
      theme="dark"
      duration={duration}
      gap={8}
      offset={32}
      mobileOffset={16}
      icons={{
        success: <ToastIcon kind="done" />,
        info: <ToastIcon kind="wait" />,
        warning: <ToastIcon kind="warning" />,
        error: <ToastIcon kind="error" />,
        ...icons,
      }}
      style={
        {
          '--width': '400px',
          '--toast-duration': `${toastOptions?.duration ?? duration}ms`,
          '--toast-ring-play-state': documentHidden ? 'paused' : 'running',
          ...style,
        } as CSSProperties
      }
      toastOptions={{
        ...toastOptions,
        className: ['mato-toast', toastOptions?.className]
          .filter(Boolean)
          .join(' '),
      }}
      {...props}
    />
  )
}

export { Toaster, ToastIcon }
