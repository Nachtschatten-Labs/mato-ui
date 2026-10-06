import type { SolanaClient } from '@solana/client'
import type { Address } from '@solana/kit'
import { NATIVE_FEE_BUFFER_ATOMS, NATIVE_SOL_DECIMALS } from '../constants'
import { getSpendableNativeAtoms } from '../lib/amounts'
import { formatAtoms } from '../lib/format'

async function fetchWrappedBalance(client: SolanaClient, owner: Address) {
  const ata = await client.wsol.deriveWsolAddress(owner)
  const account = await client.runtime.rpc
    .getAccountInfo(ata, { commitment: 'confirmed', encoding: 'base64' })
    .send()
  if (account.value === null) return 0n

  // The SDK's fetchWsolBalance treats every RPC failure as a zero balance.
  // Only a missing account means zero; propagate failed reads to avoid overwrapping.
  const balance = await client.runtime.rpc
    .getTokenAccountBalance(ata, { commitment: 'confirmed' })
    .send()
  return BigInt(balance.value.amount)
}

export async function getSolOrderWrapAmount({
  amount,
  client,
  owner,
}: {
  amount: bigint
  client: SolanaClient
  owner: Address
}) {
  // Refresh the shared native balance store and fund from current chain data,
  // rather than the balances captured when the order form last rendered.
  const [nativeLamports, wrappedAtoms] = await Promise.all([
    client.actions.fetchBalance(owner, 'confirmed'),
    fetchWrappedBalance(client, owner),
  ])
  const reserve = formatAtoms(NATIVE_FEE_BUFFER_ATOMS, NATIVE_SOL_DECIMALS)
  if (nativeLamports < NATIVE_FEE_BUFFER_ATOMS) {
    throw new Error(
      `Not enough native SOL for fees and account rent. Keep at least ${reserve} SOL in your wallet.`,
    )
  }

  const availableAtoms = getSpendableNativeAtoms(nativeLamports, wrappedAtoms)
  if (amount > availableAtoms) {
    const available = formatAtoms(availableAtoms, NATIVE_SOL_DECIMALS, 9)
    throw new Error(
      `Amount exceeds your current SOL balance. Available to sell: ${available} SOL after reserving ${reserve} SOL for fees and account rent.`,
    )
  }

  return amount > wrappedAtoms ? amount - wrappedAtoms : 0n
}
