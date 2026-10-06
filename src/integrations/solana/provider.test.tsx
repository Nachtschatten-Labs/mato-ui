// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getWalletStandardConnectors,
  watchWalletStandardConnectors,
} from '@solana/client'
import {
  address,
  blockhash,
  compileTransaction,
  createTransactionMessage,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
} from '@solana/kit'
import { SolanaProvider } from './provider'
import type { WalletConnector } from '@solana/client'

const mocks = vi.hoisted(() => {
  const clients: Array<any> = []

  return {
    clients,
    createClient: vi.fn((config: { walletConnectors: Array<any> }) => {
      const client: any = {
        connectors: {
          all: config.walletConnectors,
          get: (id: string) =>
            config.walletConnectors.find((connector) => connector.id === id),
        },
        destroy: vi.fn(),
        runtime: {
          rpc: null,
        },
        store: {
          getState: vi.fn(() => ({
            wallet: client.wallet,
          })),
          setState: vi.fn((updater) => {
            const state = { lastUpdatedAt: 0, wallet: client.wallet }
            const nextState =
              typeof updater === 'function' ? updater(state) : updater
            client.wallet = nextState.wallet
          }),
        },
        wallet: {
          status: 'disconnected',
        },
      }

      clients.push(client)
      return client
    }),
    initialConnectors: [] as Array<any>,
    unwatch: vi.fn(),
    watcher: null as ((connectors: Array<any>) => void) | null,
  }
})

vi.mock('@solana/client', () => ({
  createClient: mocks.createClient,
  getWalletStandardConnectors: vi.fn(() => mocks.initialConnectors),
  watchWalletStandardConnectors: vi.fn((onChange) => {
    mocks.watcher = onChange
    onChange(mocks.initialConnectors)
    return mocks.unwatch
  }),
}))

vi.mock('@solana/react-hooks', async () => {
  const React = await import('react')

  return {
    SolanaProvider: ({
      children,
      client,
    }: {
      children: React.ReactNode
      client: any
    }) =>
      React.createElement(
        'div',
        {
          'data-testid': 'solana-provider',
          'data-wallet-connectors': client.connectors.all
            .map((connector: WalletConnector) => connector.name)
            .join(','),
        },
        children,
      ),
  }
})

function createConnector(name: string): WalletConnector {
  return {
    canAutoConnect: true,
    connect: vi.fn(),
    disconnect: vi.fn(),
    id: `wallet-standard:${name.toLowerCase()}`,
    isSupported: () => true,
    name,
    ready: true,
  } as unknown as WalletConnector
}

describe('SolanaProvider', () => {
  afterEach(cleanup)

  beforeEach(() => {
    mocks.clients.length = 0
    mocks.initialConnectors.length = 0
    mocks.watcher = null
    vi.clearAllMocks()
  })

  it.each([
    ['solana:mainnet', 'solana:devnet'],
    ['solana:devnet', 'solana:mainnet'],
  ] as const)(
    'uses Wallet Standard mainnet for signing and sending when %s is listed first',
    async (...chains) => {
      const { createWalletStandardConnector } =
        await vi.importActual<typeof import('@solana/client')>('@solana/client')
      const walletAddress = address('11111111111111111111111111111111')
      const account = {
        address: walletAddress,
        publicKey: new Uint8Array(32),
        chains,
        features: [
          'solana:signTransaction',
          'solana:signAndSendTransaction',
        ] as const,
      }
      function validateChain(chain: string | undefined) {
        if (!account.chains.some((supported) => supported === chain)) {
          throw new Error('Invalid chain')
        }
      }
      const signAndSend = vi.fn(async ({ chain }: { chain: string }) => {
        validateChain(chain)
        return [{ signature: new Uint8Array(64) }]
      })
      const sign = vi.fn(
        async ({
          chain,
          transaction,
        }: {
          chain?: string
          transaction: Uint8Array
        }) => {
          validateChain(chain)
          return [{ signedTransaction: transaction }]
        },
      )
      const wallet = {
        version: '1.0.0',
        name: 'Multi-chain wallet',
        icon: 'data:image/svg+xml;base64,',
        accounts: [account],
        chains: account.chains,
        features: {
          'standard:connect': {
            version: '1.0.0',
            connect: vi.fn().mockResolvedValue({ accounts: [account] }),
          },
          'solana:signAndSendTransaction': {
            version: '1.0.0',
            supportedTransactionVersions: ['legacy', 0],
            signAndSendTransaction: signAndSend,
          },
          'solana:signTransaction': {
            version: '1.0.0',
            supportedTransactionVersions: ['legacy', 0],
            signTransaction: sign,
          },
        },
      } as const
      const transaction = compileTransaction(
        setTransactionMessageLifetimeUsingBlockhash(
          {
            blockhash: blockhash('11111111111111111111111111111111'),
            lastValidBlockHeight: 1n,
          },
          setTransactionMessageFeePayer(
            walletAddress,
            createTransactionMessage({ version: 0 }),
          ),
        ),
      )

      render(<SolanaProvider>child</SolanaProvider>)
      await waitFor(() => expect(mocks.watcher).toBeTruthy())

      const discoveries = [
        vi.mocked(getWalletStandardConnectors).mock.calls[0][0],
        vi.mocked(watchWalletStandardConnectors).mock.calls[0][1],
      ]
      for (const options of discoveries) {
        const session = await createWalletStandardConnector(
          wallet,
          options?.overrides?.(wallet),
        ).connect()
        const signableTransaction = transaction as unknown as Parameters<
          NonNullable<typeof session.sendTransaction>
        >[0]
        await session.sendTransaction!(signableTransaction)
        expect(signAndSend).toHaveBeenLastCalledWith(
          expect.objectContaining({ chain: 'solana:mainnet' }),
        )
        await session.signTransaction!(signableTransaction)
        expect(sign).toHaveBeenLastCalledWith(
          expect.objectContaining({ chain: 'solana:mainnet' }),
        )
      }
      expect(signAndSend).toHaveBeenCalledTimes(2)
      expect(sign).toHaveBeenCalledTimes(2)
    },
  )

  it('refreshes the client registry when wallets register after mount', async () => {
    const phantom = createConnector('Phantom')
    const solflare = createConnector('Solflare')
    mocks.initialConnectors.push(phantom)

    render(
      <SolanaProvider>
        <span>child</span>
      </SolanaProvider>,
    )

    expect(
      screen
        .getByTestId('solana-provider')
        .getAttribute('data-wallet-connectors'),
    ).toBe('Phantom')
    await waitFor(() => expect(mocks.watcher).toBeTruthy())

    act(() => {
      mocks.watcher?.([phantom, solflare])
    })

    expect(
      screen
        .getByTestId('solana-provider')
        .getAttribute('data-wallet-connectors'),
    ).toBe('Phantom,Solflare')
    expect(mocks.clients).toHaveLength(2)
    expect(mocks.clients[0].destroy).toHaveBeenCalledTimes(1)
  })

  it('preserves an active wallet session when rebuilding the client', async () => {
    const phantom = createConnector('Phantom')
    const solflare = createConnector('Solflare')
    const wallet = {
      connectorId: phantom.id,
      session: {
        account: {
          address: '11111111111111111111111111111111',
          publicKey: new Uint8Array(),
        },
        disconnect: vi.fn(),
      },
      status: 'connected',
    }
    mocks.initialConnectors.push(phantom)

    render(
      <SolanaProvider>
        <span>child</span>
      </SolanaProvider>,
    )
    await waitFor(() => expect(mocks.watcher).toBeTruthy())
    mocks.clients[0].wallet = wallet

    act(() => {
      mocks.watcher?.([phantom, solflare])
    })

    expect(mocks.clients[1].store.setState).toHaveBeenCalledTimes(1)
    expect(mocks.clients[1].wallet).toBe(wallet)
  })
})
