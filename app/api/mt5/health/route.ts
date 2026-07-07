import { NextResponse } from "next/server"
import { checkBridgeHealth } from "@/lib/mt5/service"

/**
 * GET /api/mt5/health
 * Retourne l'état de la connexion MetaApi.
 * Utilisé par le dashboard pour afficher le statut du service MT4/MT5.
 */
export async function GET() {
  const health = await checkBridgeHealth()

  if (!health) {
    return NextResponse.json({
      ok: true,
      provider: "metaapi",
      configured: false,
      message: "MetaApi non configuré (METAAPI_TOKEN manquant).",
    })
  }

  return NextResponse.json({
    ok: true,
    provider: "metaapi",
    configured: true,
    region: health.region,
    timestamp: health.timestamp,
    message: "MetaApi configuré et opérationnel.",
  })
}
