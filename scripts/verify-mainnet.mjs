import { loadEnv } from 'vite'
import { readFile } from 'node:fs/promises'
import {
  getAddressDecoder,
  getAddressEncoder,
  getProgramDerivedAddress,
  getU32Encoder,
} from '@solana/kit'
const target = JSON.parse(
  await readFile(new URL('../deployment-target.json', import.meta.url), 'utf8'),
)
const env = loadEnv('production', process.cwd(), '')
const endpoint = env.SOLANA_RPC_URL || target.defaultRpcUrl
const quote = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
const config = 'BKgwxz23KWsrp9BSgAuCngfUCrpQm6jprgYUbwmyNd2X'
const tokenProgram = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
const markets = [
  {
    id: 1,
    base: 'So11111111111111111111111111111111111111112',
    baseDecimals: 9,
    baseTokenProgram: tokenProgram,
    minimumBaseDepositAtoms: 1000000n,
    market: 'FUDH6hiwDNjdQKbH7fveFFPoEE3mXk9i1g2WbgnSqob3',
  },
  {
    id: 0,
    base: 'ANTBTZQ1EUuTxUs3tfeampxdqTWPHmwyJmcWj4xoAyNe',
    baseDecimals: 6,
    baseTokenProgram: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',
    minimumBaseDepositAtoms: 1000n,
    market: 'H16ZeZee8yGw94kGVx4aEHmC8PwWjwuLuqsW2g8MK2Pz',
  },
]
function check(condition, message) {
  if (!condition) throw new Error(message)
}
async function rpc(method, params = []) {
  let response
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: AbortSignal.timeout(20000),
    })
  } catch {
    throw new Error(
      'Mainnet RPC request failed; check server-only SOLANA_RPC_URL.',
    )
  }
  check(response.ok, `Mainnet RPC HTTP ${response.status}`)
  const result = await response.json()
  check(!result.error, `Mainnet RPC rejected ${method}`)
  return result.result
}
const bytes = (a) => Buffer.from(a.data[0], 'base64')
const addressAt = (b, offset) =>
  getAddressDecoder().decode(b.subarray(offset, offset + 32))
check(
  (await rpc('getGenesisHash')) ===
    '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d',
  'RPC is not Solana mainnet-beta. Refusing release verification.',
)
for (const {
  id,
  base,
  baseDecimals,
  baseTokenProgram,
  minimumBaseDepositAtoms,
  market,
} of markets) {
  const [derived] = await getProgramDerivedAddress({
    programAddress: target.programId,
    seeds: [
      new TextEncoder().encode('market'),
      getAddressEncoder().encode(base),
      getAddressEncoder().encode(quote),
      getU32Encoder().encode(id),
    ],
  })
  check(derived === market, 'Market PDA mismatch')
  const vaults = await Promise.all(
    [
      [base, baseTokenProgram],
      [quote, tokenProgram],
    ].map(async ([mint, program]) => {
      const [vault] = await getProgramDerivedAddress({
        programAddress: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
        seeds: [
          getAddressEncoder().encode(market),
          getAddressEncoder().encode(program),
          getAddressEncoder().encode(mint),
        ],
      })
      return vault
    }),
  )
  const addresses = [target.programId, market, base, quote, config, ...vaults]
  const { context, value: accounts } = await rpc('getMultipleAccounts', [
    addresses,
    { encoding: 'base64', commitment: 'confirmed' },
  ])
  check(accounts.every(Boolean), 'Required mainnet accounts are missing')
  check(accounts[0].executable, 'Program is not executable')
  const programData = addressAt(bytes(accounts[0]), 4)
  const deployed = (
    await rpc('getAccountInfo', [
      programData,
      { encoding: 'base64', commitment: 'confirmed' },
    ])
  ).value
  check(
    deployed && bytes(deployed).readBigUInt64LE(4) === 452075425n,
    'Program was upgraded after the validated deployment; recheck its interface before releasing.',
  )
  const data = bytes(accounts[1])
  check(
    accounts[1].owner === target.programId && data.length === 488,
    'Market owner/layout mismatch',
  )
  check(
    data
      .subarray(0, 8)
      .equals(Buffer.from([219, 190, 213, 55, 0, 227, 198, 154])),
    'Market discriminator mismatch',
  )
  check(
    addressAt(data, 8) === base && addressAt(data, 40) === quote,
    'Market mints mismatch',
  )
  check(
    data.readUInt32LE(152) === id && data[160] === 0,
    'Open-liquidity market identity mismatch',
  )
  check(data[161] === 0, 'Market is paused')
  check(
    data.readBigUInt64LE(104) === minimumBaseDepositAtoms &&
      data.readBigUInt64LE(112) === 100000n,
    'Deposit minimums changed',
  )
  check(
    accounts[2].owner === baseTokenProgram &&
      accounts[3].owner === tokenProgram &&
      bytes(accounts[2])[44] === baseDecimals &&
      bytes(accounts[3])[44] === 6,
    'Mint program/decimals mismatch',
  )
  check(
    accounts[4].owner === target.programId && bytes(accounts[4]).length === 152,
    'Program configuration mismatch',
  )
  for (const [index, mint, program] of [
    [5, base, baseTokenProgram],
    [6, quote, tokenProgram],
  ])
    check(
      accounts[index].owner === program &&
        addressAt(bytes(accounts[index]), 0) === mint &&
        addressAt(bytes(accounts[index]), 32) === market,
      'Vault identity mismatch',
    )
  const api = env.VITE_READ_API_URL?.replace(/\/$/, '')
  check(api, 'VITE_READ_API_URL is required')
  const response = await fetch(`${api}/v1/markets/${market}/config`, {
    signal: AbortSignal.timeout(20000),
  })
  check(response.ok, 'Read API does not support the mainnet market address')
  const marketConfig = await response.json()
  check(
    marketConfig.market_address === market &&
      marketConfig.base_mint === base &&
      marketConfig.quote_mint === quote &&
      marketConfig.base_decimals === baseDecimals &&
      marketConfig.quote_decimals === 6,
    'Read API configuration mismatch',
  )
  const baseFlow = data.readBigUInt64LE(72) | (data.readBigUInt64LE(80) << 64n)
  const quoteFlow = data.readBigUInt64LE(88) | (data.readBigUInt64LE(96) << 64n)
  console.log(
    JSON.stringify(
      {
        status: 'verified',
        slot: context.slot,
        program: target.programId,
        market,
        marketId: id,
        marketKind: 'open-liquidity',
        feeBps: data[156],
        baseVaultAtoms: bytes(accounts[5]).readBigUInt64LE(64).toString(),
        quoteVaultAtoms: bytes(accounts[6]).readBigUInt64LE(64).toString(),
        activeFlows: baseFlow > 0n && quoteFlow > 0n,
      },
      null,
      2,
    ),
  )
  if (baseFlow === 0n || quoteFlow === 0n)
    console.log(
      'Market quoting is inactive. Ordinary liquidity providers must supply active flows for trading to accrue.',
    )
}
