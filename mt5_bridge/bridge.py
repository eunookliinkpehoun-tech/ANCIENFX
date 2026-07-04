"""
ANCIENFX - MT5 Bridge
=====================
Serveur Flask léger qui expose une API HTTP locale.
Tourne sur le VPS Windows. Next.js l'appelle via MT5_BRIDGE_URL.

Principe clé :
  - mt5.initialize()  →  s'attache au terminal MT5 déjà ouvert (aucun chemin hardcodé)
  - mt5.login(login, password, server)  →  connexion broker par identifiants
  - Résolution automatique des suffixes de symboles (EURUSDm → EURUSD, etc.)

Démarrer : python bridge.py
"""

import os
import sys
import threading
import time
import logging
from datetime import datetime, timezone
from typing import Optional

from flask import Flask, jsonify, request

# ── MetaTrader5 est disponible uniquement sur Windows ──────────────────────────
try:
    import MetaTrader5 as mt5
    MT5_AVAILABLE = True
except ImportError:
    MT5_AVAILABLE = False
    print("[bridge] AVERTISSEMENT: MetaTrader5 non trouvé. Mode stub activé.")

# ── Configuration ──────────────────────────────────────────────────────────────
BRIDGE_PORT     = int(os.environ.get("BRIDGE_PORT", 8765))
BRIDGE_SECRET   = os.environ.get("BRIDGE_SECRET", "")   # optionnel, header X-Bridge-Secret
SYNC_INTERVAL   = int(os.environ.get("SYNC_INTERVAL", 30))  # secondes entre syncs auto

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("mt5-bridge")

app = Flask(__name__)

# ── État global des sessions ───────────────────────────────────────────────────
# { "login|server": { login, password, server, account_info, last_sync } }
_sessions: dict[str, dict] = {}
_lock = threading.Lock()

# ── Helpers ────────────────────────────────────────────────────────────────────

def _session_key(login: str, server: str) -> str:
    return f"{login}|{server}"


def _check_secret() -> Optional[tuple]:
    """Vérifie le header X-Bridge-Secret si BRIDGE_SECRET est défini."""
    if BRIDGE_SECRET:
        sent = request.headers.get("X-Bridge-Secret", "")
        if sent != BRIDGE_SECRET:
            return jsonify({"ok": False, "message": "Non autorisé."}), 401
    return None


def _ensure_mt5() -> bool:
    """S'assure que MT5 est initialisé (attaché au terminal ouvert)."""
    if not MT5_AVAILABLE:
        return False
    if mt5.terminal_info() is not None:
        return True
    # S'attache au terminal déjà ouvert — aucun chemin passé
    if not mt5.initialize():
        log.error("mt5.initialize() a échoué: %s", mt5.last_error())
        return False
    log.info("mt5.initialize() OK — terminal attaché")
    return True


def _login_account(login: str, password: str, server: str) -> tuple[bool, str]:
    """Tente mt5.login(). Retourne (ok, message_erreur)."""
    if not _ensure_mt5():
        return False, "Impossible d'attacher le terminal MT5. Vérifiez qu'il est ouvert."
    ok = mt5.login(int(login), password=password, server=server)
    if not ok:
        code, msg = mt5.last_error()
        return False, f"Connexion échouée (code {code}): {msg}"
    return True, ""


def _account_info_dict(login: str, server: str) -> Optional[dict]:
    """Lit les infos du compte actuellement connecté dans MT5."""
    if not MT5_AVAILABLE:
        return None
    info = mt5.account_info()
    if info is None:
        return None

    is_demo = info.trade_mode == mt5.ACCOUNT_TRADE_MODE_DEMO

    return {
        "login": str(info.login),
        "server": server,
        "broker": info.company,
        "accountType": "DEMO" if is_demo else "RÉEL",
        "leverage": info.leverage,
        "isDemo": is_demo,
        "balance": round(info.balance, 2),
        "equity": round(info.equity, 2),
        "freeMargin": round(info.margin_free, 2),
        "dailyProfit": round(info.profit, 2),
        "currency": info.currency,
    }


def _resolve_symbol(raw: str) -> Optional[str]:
    """
    Résolution automatique du suffixe du symbole.
    Ex: EURUSDm → EURUSD si EURUSDm n'existe pas mais EURUSD existe.
    """
    if not MT5_AVAILABLE:
        return raw
    # Essai direct
    info = mt5.symbol_info(raw)
    if info is not None:
        return raw
    # Essai sans le suffixe (dernière lettre non numérique)
    base = raw.rstrip("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ").rstrip(".")
    # Essai avec les suffixes courants
    candidates = [raw, base, raw + "m", raw + ".a", raw + ".r"]
    for c in candidates:
        if mt5.symbol_info(c) is not None:
            return c
    return None


# ── Routes API ─────────────────────────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health():
    terminal_ok = False
    terminal_info = {}
    if MT5_AVAILABLE:
        info = mt5.terminal_info()
        terminal_ok = info is not None
        if info:
            terminal_info = {
                "path": info.path,
                "data_path": info.data_path,
                "connected": info.connected,
                "build": info.build,
            }
    return jsonify({
        "ok": True,
        "mt5_available": MT5_AVAILABLE,
        "terminal_connected": terminal_ok,
        "terminal": terminal_info,
        "active_sessions": len(_sessions),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })


@app.route("/connect", methods=["POST"])
def connect():
    guard = _check_secret()
    if guard:
        return guard

    data = request.json or {}
    login    = str(data.get("login", "")).strip()
    password = str(data.get("password", ""))
    server   = str(data.get("server", "")).strip()

    if not login or not password or not server:
        return jsonify({"ok": False, "message": "login, password et server sont obligatoires."}), 400

    if not MT5_AVAILABLE:
        return jsonify({"ok": False, "message": "MetaTrader5 non disponible sur ce système."}), 503

    ok, err = _login_account(login, password, server)
    if not ok:
        log.warning("Connexion refusée pour %s@%s: %s", login, server, err)
        return jsonify({"ok": False, "message": err}), 401

    account = _account_info_dict(login, server)
    if account is None:
        return jsonify({"ok": False, "message": "Impossible de lire les informations du compte."}), 500

    key = _session_key(login, server)
    with _lock:
        _sessions[key] = {
            "login": login,
            "password": password,
            "server": server,
            "account": account,
            "last_sync": time.time(),
        }

    log.info("Connecté: %s@%s  balance=%.2f", login, server, account["balance"])
    return jsonify({"ok": True, "account": account})


@app.route("/sync", methods=["POST"])
def sync():
    guard = _check_secret()
    if guard:
        return guard

    data   = request.json or {}
    login  = str(data.get("login", "")).strip()
    server = str(data.get("server", "")).strip()
    key    = _session_key(login, server)

    with _lock:
        session = _sessions.get(key)

    if session is None:
        return jsonify({"ok": False, "message": "Session introuvable. Reconnectez le compte."}), 404

    if not MT5_AVAILABLE:
        return jsonify({"ok": False, "message": "MetaTrader5 non disponible."}), 503

    # Re-login si nécessaire
    if mt5.account_info() is None or str(mt5.account_info().login) != login:
        ok, err = _login_account(session["login"], session["password"], session["server"])
        if not ok:
            return jsonify({"ok": False, "message": err}), 500

    account = _account_info_dict(login, server)
    if account is None:
        return jsonify({"ok": False, "message": "Impossible de lire les infos du compte."}), 500

    with _lock:
        _sessions[key]["account"]   = account
        _sessions[key]["last_sync"] = time.time()

    return jsonify({"ok": True, "account": account})


@app.route("/disconnect", methods=["POST"])
def disconnect():
    guard = _check_secret()
    if guard:
        return guard

    data   = request.json or {}
    login  = str(data.get("login", "")).strip()
    server = str(data.get("server", "")).strip()
    key    = _session_key(login, server)

    with _lock:
        _sessions.pop(key, None)

    # On ne déconnecte pas MT5 globalement car d'autres sessions peuvent être actives
    log.info("Session supprimée: %s@%s", login, server)
    return jsonify({"ok": True})


@app.route("/positions", methods=["POST"])
def positions():
    guard = _check_secret()
    if guard:
        return guard

    data   = request.json or {}
    login  = str(data.get("login", "")).strip()
    server = str(data.get("server", "")).strip()
    key    = _session_key(login, server)

    with _lock:
        session = _sessions.get(key)

    if session is None:
        return jsonify({"ok": False, "message": "Session introuvable."}), 404

    if not MT5_AVAILABLE:
        return jsonify({"ok": True, "positions": []}), 200

    if mt5.account_info() is None or str(mt5.account_info().login) != login:
        ok, err = _login_account(session["login"], session["password"], session["server"])
        if not ok:
            return jsonify({"ok": False, "message": err}), 500

    raw_positions = mt5.positions_get()
    result = []
    if raw_positions:
        for p in raw_positions:
            result.append({
                "ticket":    p.ticket,
                "symbol":    p.symbol,
                "type":      "BUY" if p.type == mt5.ORDER_TYPE_BUY else "SELL",
                "volume":    p.volume,
                "openPrice": round(p.price_open, 5),
                "sl":        round(p.sl, 5),
                "tp":        round(p.tp, 5),
                "profit":    round(p.profit, 2),
                "swap":      round(p.swap, 2),
                "comment":   p.comment,
                "openTime":  datetime.fromtimestamp(p.time, tz=timezone.utc).isoformat(),
            })

    return jsonify({"ok": True, "positions": result})


@app.route("/history", methods=["POST"])
def history():
    guard = _check_secret()
    if guard:
        return guard

    data   = request.json or {}
    login  = str(data.get("login", "")).strip()
    server = str(data.get("server", "")).strip()
    days   = int(data.get("days", 30))
    key    = _session_key(login, server)

    with _lock:
        session = _sessions.get(key)

    if session is None:
        return jsonify({"ok": False, "message": "Session introuvable."}), 404

    if not MT5_AVAILABLE:
        return jsonify({"ok": True, "deals": []}), 200

    if mt5.account_info() is None or str(mt5.account_info().login) != login:
        ok, err = _login_account(session["login"], session["password"], session["server"])
        if not ok:
            return jsonify({"ok": False, "message": err}), 500

    from_ts = int((time.time() - days * 86400))
    to_ts   = int(time.time()) + 60

    deals = mt5.history_deals_get(from_ts, to_ts)
    result = []
    if deals:
        for d in deals:
            if d.profit == 0 and d.entry == mt5.DEAL_ENTRY_IN:
                continue  # ignorer les ouvertures à profit 0
            result.append({
                "ticket":    d.ticket,
                "symbol":    d.symbol,
                "type":      "BUY" if d.type == mt5.DEAL_TYPE_BUY else "SELL",
                "volume":    d.volume,
                "price":     round(d.price, 5),
                "profit":    round(d.profit, 2),
                "commission":round(d.commission, 2),
                "swap":      round(d.swap, 2),
                "comment":   d.comment,
                "time":      datetime.fromtimestamp(d.time, tz=timezone.utc).isoformat(),
            })

    return jsonify({"ok": True, "deals": result})


@app.route("/symbol_info", methods=["POST"])
def symbol_info_route():
    """Utilitaire : résolution de symbole avec suffixe automatique."""
    guard = _check_secret()
    if guard:
        return guard

    data   = request.json or {}
    symbol = str(data.get("symbol", "")).strip()

    if not symbol:
        return jsonify({"ok": False, "message": "symbol obligatoire."}), 400

    resolved = _resolve_symbol(symbol)
    if resolved is None:
        return jsonify({"ok": False, "message": f"Symbole '{symbol}' introuvable."}), 404

    info = mt5.symbol_info(resolved) if MT5_AVAILABLE else None
    return jsonify({
        "ok": True,
        "original": symbol,
        "resolved": resolved,
        "info": {
            "bid": round(info.bid, 5),
            "ask": round(info.ask, 5),
            "spread": info.spread,
            "digits": info.digits,
            "volume_min": info.volume_min,
            "volume_step": info.volume_step,
        } if info else None,
    })


# ── Sync automatique en arrière-plan ───────────────────────────────────────────

def _auto_sync_worker():
    """Rafraîchit silencieusement les sessions toutes les SYNC_INTERVAL secondes."""
    while True:
        time.sleep(SYNC_INTERVAL)
        if not MT5_AVAILABLE:
            continue
        with _lock:
            keys = list(_sessions.keys())
        for key in keys:
            with _lock:
                session = _sessions.get(key)
            if session is None:
                continue
            try:
                current_info = mt5.account_info()
                if current_info is None or str(current_info.login) != session["login"]:
                    ok, _ = _login_account(
                        session["login"], session["password"], session["server"]
                    )
                    if not ok:
                        continue
                account = _account_info_dict(session["login"], session["server"])
                if account:
                    with _lock:
                        if key in _sessions:
                            _sessions[key]["account"]   = account
                            _sessions[key]["last_sync"] = time.time()
                    log.debug("Auto-sync OK: %s  balance=%.2f", key, account["balance"])
            except Exception as exc:
                log.warning("Auto-sync erreur pour %s: %s", key, exc)


# ── Point d'entrée ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    log.info("=" * 60)
    log.info("ANCIENFX MT5 Bridge — port %d", BRIDGE_PORT)
    log.info("MT5 disponible : %s", MT5_AVAILABLE)
    if BRIDGE_SECRET:
        log.info("Sécurité : X-Bridge-Secret activé")
    log.info("=" * 60)

    # Pré-attacher le terminal au démarrage
    if MT5_AVAILABLE:
        if _ensure_mt5():
            log.info("Terminal MT5 attaché au démarrage.")
        else:
            log.warning("Terminal MT5 non attaché. Assurez-vous qu'il est ouvert.")

    # Thread de sync automatique
    t = threading.Thread(target=_auto_sync_worker, daemon=True)
    t.start()

    # Flask — écoute uniquement en local (127.0.0.1) par sécurité
    app.run(host="127.0.0.1", port=BRIDGE_PORT, debug=False, threaded=True)
