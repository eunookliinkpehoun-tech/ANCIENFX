/**
 * ANCIENFX — Client MetaApi (singleton)
 * =====================================
 * Toute communication avec MetaApi.cloud passe par ce module.
 * Remplace l'ancien bridge Python (mt5_bridge).
 *
 * Variables d'environnement :
 *   METAAPI_TOKEN     (requis)  — token API MetaApi.cloud
 *   METAAPI_REGION    (option)  — région de déploiement (ex: new-york, london, singapore)
 *   METAAPI_DOMAIN    (option)  — domaine custom (défaut agiliumtrade.agiliumtrade.ai)
 *
 * Le SDK MetaApi ouvre des connexions websocket lourdes : on garde donc
 * une seule instance par process (pattern singleton via globalThis).
 */

import MetaApi, { CopyFactory } from "metaapi.cloud-sdk"

export const APPLICATION = "ANCIENFX"

/** Région par défaut où sont déployés les comptes (économise les ressources en centralisant). */
export const DEFAULT_REGION = process.env.METAAPI_REGION || "new-york"

declare global {
  // eslint-disable-next-line no-var
  var ancienfxMetaApi: MetaApi | undefined
  // eslint-disable-next-line no-var
  var ancienfxCopyFactory: CopyFactory | undefined
}

/** Retourne le token MetaApi, ou null si non configuré. */
export function metaApiToken(): string | null {
  return process.env.METAAPI_TOKEN?.trim() || null
}

/** Indique si MetaApi est configuré (token présent). */
export function isMetaApiConfigured(): boolean {
  return metaApiToken() !== null
}

function opts() {
  const o: Record<string, unknown> = { application: APPLICATION }
  if (process.env.METAAPI_REGION) o.region = process.env.METAAPI_REGION
  if (process.env.METAAPI_DOMAIN) o.domain = process.env.METAAPI_DOMAIN
  return o
}

/** Instance MetaApi partagée. Lève une erreur si le token n'est pas configuré. */
export function getMetaApi(): MetaApi {
  const token = metaApiToken()
  if (!token) {
    throw new Error("METAAPI_TOKEN non configuré. Ajoutez-le aux variables d'environnement.")
  }
  if (!globalThis.ancienfxMetaApi) {
    globalThis.ancienfxMetaApi = new MetaApi(token, opts())
  }
  return globalThis.ancienfxMetaApi
}

/** Instance CopyFactory partagée. Lève une erreur si le token n'est pas configuré. */
export function getCopyFactory(): CopyFactory {
  const token = metaApiToken()
  if (!token) {
    throw new Error("METAAPI_TOKEN non configuré. Ajoutez-le aux variables d'environnement.")
  }
  if (!globalThis.ancienfxCopyFactory) {
    globalThis.ancienfxCopyFactory = new CopyFactory(token, opts())
  }
  return globalThis.ancienfxCopyFactory
}
