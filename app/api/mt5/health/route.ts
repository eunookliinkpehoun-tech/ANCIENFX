import { NextResponse } from "next/server"
import { checkBridgeHealth } from "@/lib/mt5/service"

/**
 * GET /api/mt5/health
 * Retourne l'état du bridge Python et du terminal MT5.
 * Utilisé par le dashboard pour afficher le statut de connexion au terminal.
 */
export async function GET() {
  const health = await checkBridgeHealth()

  if (!health) {
    return NextResponse.json({
      ok: true,
      bridgeReachable: false,
      mt5Available: false,
      terminalConnected: false,
      activeSessions: 0,
      message: process.env.MT5_BRIDGE_URL
        ? "Bridge MT5 inaccessible. Vérifiez que start.bat est lancé sur le VPS."
        : "MT5_BRIDGE_URL non configuré (mode développement).",
    })
  }

  return NextResponse.json({
    ok: true,
    bridgeReachable: true,
    mt5Available: health.mt5Available,
    terminalConnected: health.terminalConnected,
    activeSessions: health.activeSessions,
    timestamp: health.timestamp,
    message: health.terminalConnected
      ? "Terminal MT5 connecté et opérationnel."
      : "Bridge actif mais terminal MT5 non connecté. Ouvrez MetaTrader 5.",
  })
}
