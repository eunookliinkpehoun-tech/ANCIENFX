export type Mt5ConnectPayload = {
  login: string
  password: string
  server: string
}

export type Mt5AccountInfo = {
  login: string
  server: string
  broker: string
  accountType: string
  leverage: number
  isDemo: boolean
  balance: number
  equity: number
  freeMargin: number
  dailyProfit: number
  currency: string
}

const bridgeUrl = () => process.env.MT5_BRIDGE_URL?.replace(/\/$/, "")

function mockAccount(payload: Mt5ConnectPayload): Mt5AccountInfo {
  const isDemo = /demo/i.test(payload.server)
  const seed = Number(payload.login.slice(-4)) || 1000
  const balance = 10000 + seed * 1.27

  return {
    login: payload.login,
    server: payload.server,
    broker: isDemo ? "IC Markets (Demo)" : "IC Markets",
    accountType: isDemo ? "DEMO RAW SPREAD" : "RAW SPREAD",
    leverage: 500,
    isDemo,
    balance: Math.round(balance * 100) / 100,
    equity: Math.round((balance + 42.15) * 100) / 100,
    freeMargin: Math.round((balance - 120) * 100) / 100,
    dailyProfit: Math.round((seed % 300) * 100) / 100,
    currency: "USD",
  }
}

export async function connectMt5Account(payload: Mt5ConnectPayload): Promise<Mt5AccountInfo> {
  const url = bridgeUrl()

  if (url) {
    const res = await fetch(`${url}/connect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok || !data.ok) {
      throw new Error(data.message || "Connexion MT4/MT5 impossible.")
    }
    return data.account as Mt5AccountInfo
  }

  // Dev fallback when MT5 bridge is not running (Ubuntu). Simulates terminal validation.
  if (!payload.login || !payload.password || !payload.server) {
    throw new Error("Identifiants MT4/MT5 incomplets.")
  }
  if (payload.password.length < 4) {
    throw new Error("Mot de passe MT4/MT5 invalide.")
  }

  return mockAccount(payload)
}

export async function syncMt5Account(login: string, server: string): Promise<Mt5AccountInfo | null> {
  const url = bridgeUrl()
  if (!url) return null

  const res = await fetch(`${url}/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ login, server }),
  })
  const data = await res.json()
  if (!res.ok || !data.ok) return null
  return data.account as Mt5AccountInfo
}

export async function disconnectMt5Account(login: string, server: string): Promise<void> {
  const url = bridgeUrl()
  if (!url) return

  await fetch(`${url}/disconnect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ login, server }),
  })
}
