// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { toast, type Action } from 'sonner'
import { showTransactionError } from './transaction-toast'

vi.mock('sonner', () => ({ toast: { warning: vi.fn(), error: vi.fn() } }))

describe('transaction error toast', () => {
  afterEach(() => vi.clearAllMocks())
  it('offers an explorer link for a submitted transaction with unknown confirmation', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    showTransactionError({
      error: 'Check before retrying.',
      status: 'unconfirmed',
      signature: 'submitted-signature',
      title: 'Close failed',
      id: 'close-position-error',
      endpoint: 'https://mato.markets/rpc',
    })
    expect(toast.error).not.toHaveBeenCalled()
    expect(toast.warning).toHaveBeenCalledWith(
      'Confirmation unavailable',
      expect.objectContaining({ description: 'Check before retrying.' }),
    )
    const options = vi.mocked(toast.warning).mock.calls[0][1]!
    ;(options.action as Action).onClick({} as Parameters<Action['onClick']>[0])
    expect(open).toHaveBeenCalledWith(
      expect.stringContaining('/tx/submitted-signature'),
      '_blank',
      'noopener,noreferrer',
    )
  })
  it('keeps known failures as error notifications', () => {
    showTransactionError({
      error: 'Insufficient funds',
      status: 'error',
      signature: null,
      title: 'Close failed',
      id: 'close-position-error',
      endpoint: 'https://mato.markets/rpc',
    })
    expect(toast.warning).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledWith('Close failed', {
      description: 'Insufficient funds',
      id: 'close-position-error',
    })
  })
})
