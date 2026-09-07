import { TWOB_ANCHOR_PROGRAM_ADDRESS } from '@/lib/generated/twob/src/generated/programs'

export function transactionsEnabled() {
  return (
    import.meta.env.VITE_ENABLE_TRANSACTIONS === 'true' &&
    import.meta.env.VITE_VERIFIED_PROGRAM_ID === TWOB_ANCHOR_PROGRAM_ADDRESS
  )
}

export function assertTransactionsEnabled() {
  if (!transactionsEnabled()) {
    throw new Error(
      'Trading is disabled until the program configuration has been verified.',
    )
  }
}
