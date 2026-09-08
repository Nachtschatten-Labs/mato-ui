import { toast } from 'sonner'
import { formatExplorerTransactionUrl } from './format'

export function showTransactionError({
  error,
  status,
  signature,
  title,
  id,
  endpoint,
}: {
  error: string
  status: string
  signature: string | null
  title: string
  id: string
  endpoint: string
}) {
  if (status === 'unconfirmed' && signature) {
    toast.warning('Confirmation unavailable', {
      description: error,
      id,
      action: {
        label: 'View transaction',
        onClick: () => {
          window.open(
            formatExplorerTransactionUrl(signature, endpoint),
            '_blank',
            'noopener,noreferrer',
          )
        },
      },
    })
    return
  }
  toast.error(title, { description: error, id })
}
