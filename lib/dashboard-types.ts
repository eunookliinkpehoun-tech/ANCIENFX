export type BotState = "offline" | "active" | "running" | "payment_due"

export function isMt5Connected(account: Mt5AccountRow | null | undefined): boolean {
  return account?.status === "connected"
}

export type Mt5AccountRow = {
  id: number
  userId: number
  login: string
  server: string
  broker: string | null
  accountType: string | null
  leverage: number | null
  isDemo: boolean
  status: "connected" | "disconnected" | "expired"
  balance: number
  equity: number
  freeMargin: number
  dailyProfit: number
  currency: string
  connectedAt: string | null
  lastSyncAt: string | null
}

export type BotSessionRow = {
  id: number
  status: "idle" | "running" | "payment_due" | "paid" | "cancelled"
  startBalance: number | null
  endBalance: number | null
  profit: number | null
  platformShare: number | null
  amountDue: number | null
  startedAt: string | null
  cycleEndsAt: string | null
}

export type DashboardState = {
  user: {
    id: number
    name: string
    email: string
    referralCode: string
    trialEndsAt: string | null
    trialActive: boolean
    trialUsed: boolean
  }
  mt5Account: Mt5AccountRow | null
  botState: BotState
  botSession: BotSessionRow | null
  copyTradeEnabled: boolean
}
