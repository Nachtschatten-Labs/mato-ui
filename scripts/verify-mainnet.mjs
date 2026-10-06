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
const base = 'So11111111111111111111111111111111111111112'
const quote = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
const market = 'FUDH6hiwDNjdQKbH7fveFFPoEE3mXk9i1g2WbgnSqob3'
const config = 'BKgwxz23KWsrp9BSgAuCngfUCrpQm6jprgYUbwmyNd2X'
const tokenProgram = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
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
const [derived] = await getProgramDerivedAddress({
  programAddress: target.programId,
  seeds: [
    new TextEncoder().encode('market'),
    getAddressEncoder().encode(base),
    getAddressEncoder().encode(quote),
    getU32Encoder().encode(1),
  ],
})
check(derived === market, 'Market PDA mismatch')
const addresses = [
  target.programId,
  market,
  base,
  quote,
  config,
  'BMoiccVR8MPtib67sT4vdi1Qsd6Q8d1UfkuPBsKp3oMu',
  'Fuo3w4sfesNkFVm6wy7r7upEw9meMYYwYZZLRKUEEKwN',
]
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
  data.readUInt32LE(152) === 1 && data[160] === 1,
  'Dedicated market identity mismatch',
)
check(data[161] === 0, 'Market is paused')
check(
  data.readBigUInt64LE(104) === 1000000n &&
    data.readBigUInt64LE(112) === 100000n,
  'Deposit minimums changed',
)
check(
  accounts[2].owner === tokenProgram &&
    accounts[3].owner === tokenProgram &&
    bytes(accounts[2])[44] === 9 &&
    bytes(accounts[3])[44] === 6,
  'Mint program/decimals mismatch',
)
check(
  accounts[4].owner === target.programId && bytes(accounts[4]).length === 152,
  'Program configuration mismatch',
)
for (const [index, mint] of [
  [5, base],
  [6, quote],
])
  check(
    accounts[index].owner === tokenProgram &&
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
    marketConfig.base_decimals === 9 &&
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
    'Market quoting is inactive. The maker must provide flows before the trading launch.',
  )
