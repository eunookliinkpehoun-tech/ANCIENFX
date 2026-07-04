"""
ANCIENFX - MT5 Worker
=====================
UN worker = UN processus Python = UNE instance de terminal MT5 = UN compte.

C'est la brique qui permet la connexion SIMULTANÉE de plusieurs comptes.
La librairie Python `MetaTrader5` ne peut piloter qu'UN terminal par processus.
Pour connecter N comptes en même temps, on lance N workers, chacun attaché
à sa propre copie portable du terminal MT5 (voir provision.py).

Le manager (bridge.py) lance ce worker en sous-processus et communique
avec lui via une petite API HTTP locale sur un port dédié.

Lancement (fait par le manager, pas à la main) :
  python worker.py --login 123 --password xxx --server Exness-MT5Trial9 \
      --terminal "C:\\ancienfx_mt5\\123\\terminal64.exe" \
      --port 9101 --secret mysecret
"""

import argparse
import logging
import threading
import time
from datetime import datetime, timezone
from typing import Optional

from flask import Flask, jsonify, request

try:
    import MetaTrader5 as mt5
    MT5_AVAILABLE = True
except ImportError:
    MT5_AVAILABLE = False


# ── Arguments ────────────────────────────────────────────────────────────────
parser = argparse.ArgumentParser()
parser.add_argument("--login", required=True)
parser.add_argument("--password", required=True)
parser.add_argument("--server", required=True)
parser.add_argument("--terminal", required=True, help="Chemin vers terminal64.exe de CETTE instance")
parser.add_argument("--port", type=int, required=True)
parser.add_argument("--secret", default="")
ARGS = parser.parse_args()

logging.basicConfig(
    level=logging.INFO,
    format=f"%(asctime)s [worker:{ARGS.login}] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(f"worker-{ARGS.login}")

app = Flask(__name__)

# ── État du worker ─────────────────────────────────────────────────────────────
_state = {
    "logged": False,
    "last_error": "",
    "account": None,      # dernier snapshot du compte
    "last_sync": 0.0,
    "initialized": False,
}
_lock = threading.Lock()


# ── Sécurité ────────────────────────────────────────────────────────────────────
def _check_secret() -> Optional[tuple]:
    if ARGS.secret:
        if request.headers.get("X-Bridge-Secret", "") != ARGS.secret:
            return jsonify({"ok": False, "message": "Non autorisé."}), 401
    return None


# ── Connexion MT5 (propre à cette instance de terminal) ─────────────────────────
def _initialize_and_login() -> tuple[bool, str]:
    """
    Initialise CETTE instance de terminal (via --terminal) en mode portable,
    puis se connecte au compte. Chaque worker a son propre terminal → pas de
    conflit entre comptes.
    """
    if not MT5_AVAILABLE:
        return False, "MetaTrader5 non disponible sur ce système."

    # portable=True → le terminal stocke ses données dans son propre dossier
    ok = mt5.initialize(
        path=ARGS.terminal,
        login=int(ARGS.login),
        password=ARGS.password,
        server=ARGS.server,
        portable=True,
    )
    if not ok:
        code, msg = mt5.last_error()
        return False, f"initialize/login échoué (code {code}): {msg}"

    # Vérifie que le login est bien celui attendu
    info = mt5.account_info()
    if info is None:
        return False, "account_info() vide après login."
    if str(info.login) != str(ARGS.login):
        return False, f"Login inattendu: {info.login} != {ARGS.login}"

    with _lock:
        _state["initialized"] = True
        _state["logged"] = True
        _state["last_error"] = ""
    return True, ""


def _account_snapshot() -> Optional[dict]:
    if not MT5_AVAILABLE:
        return None
    info = mt5.account_info()
    if info is None:
        return None
    is_demo = info.trade_mode == mt5.ACCOUNT_TRADE_MODE_DEMO
    return {
        "login": str(info.login),
        "server": ARGS.server,
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
    """Résolution du suffixe: EURUSDm → EURUSD, etc. (propre à ce broker)."""
    if not MT5_AVAILABLE:
        return raw
    if mt5.symbol_info(raw) is not None:
        return raw
    base = raw.rstrip("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ").rstrip(".")
    for c in (base, raw + "m", raw + ".a", raw + ".r", base + "m"):
        if c and mt5.symbol_info(c) is not None:
            return c
    return None


# ── Routes HTTP (appelées par le manager uniquement) ────────────────────────────
@app.route("/health", methods=["GET"])
def health():
    with _lock:
        return jsonify({
            "ok": True,
            "login": ARGS.login,
            "server": ARGS.server,
            "logged": _state["logged"],
            "initialized": _state["initialized"],
            "last_error": _state["last_error"],
            "last_sync": _state["last_sync"],
        })


@app.route("/account", methods=["GET"])
def account():
    guard = _check_secret()
    if guard:
        return guard
    snap = _account_snapshot()
    if snap is None:
        with _lock:
            return jsonify({"ok": False, "message": _state["last_error"] or "Compte non lisible."}), 503
    with _lock:
        _state["account"] = snap
        _state["last_sync"] = time.time()
    return jsonify({"ok": True, "account": snap})


@app.route("/positions", methods=["GET"])
def positions():
    guard = _check_secret()
    if guard:
        return guard
    if not MT5_AVAILABLE:
        return jsonify({"ok": True, "positions": []})
    raw = mt5.positions_get()
    result = []
    if raw:
        for p in raw:
            result.append({
                "ticket": p.ticket,
                "symbol": p.symbol,
                "type": "BUY" if p.type == mt5.ORDER_TYPE_BUY else "SELL",
                "volume": p.volume,
                "openPrice": round(p.price_open, 5),
                "sl": round(p.sl, 5),
                "tp": round(p.tp, 5),
                "profit": round(p.profit, 2),
                "swap": round(p.swap, 2),
                "comment": p.comment,
                "openTime": datetime.fromtimestamp(p.time, tz=timezone.utc).isoformat(),
            })
    return jsonify({"ok": True, "positions": result})


@app.route("/history", methods=["POST"])
def history():
    guard = _check_secret()
    if guard:
        return guard
    days = int((request.json or {}).get("days", 30))
    if not MT5_AVAILABLE:
        return jsonify({"ok": True, "deals": []})
    from_ts = int(time.time() - days * 86400)
    to_ts = int(time.time()) + 60
    deals = mt5.history_deals_get(from_ts, to_ts)
    result = []
    if deals:
        for d in deals:
            if d.profit == 0 and d.entry == mt5.DEAL_ENTRY_IN:
                continue
            result.append({
                "ticket": d.ticket,
                "symbol": d.symbol,
                "type": "BUY" if d.type == mt5.DEAL_TYPE_BUY else "SELL",
                "volume": d.volume,
                "price": round(d.price, 5),
                "profit": round(d.profit, 2),
                "commission": round(d.commission, 2),
                "swap": round(d.swap, 2),
                "comment": d.comment,
                "time": datetime.fromtimestamp(d.time, tz=timezone.utc).isoformat(),
            })
    return jsonify({"ok": True, "deals": result})


@app.route("/symbol_info", methods=["POST"])
def symbol_info_route():
    guard = _check_secret()
    if guard:
        return guard
    symbol = str((request.json or {}).get("symbol", "")).strip()
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


@app.route("/shutdown", methods=["POST"])
def shutdown():
    guard = _check_secret()
    if guard:
        return guard
    log.info("Arrêt demandé.")
    if MT5_AVAILABLE:
        mt5.shutdown()
    # Arrêt propre du serveur Flask
    func = request.environ.get("werkzeug.server.shutdown")
    if func:
        func()
    else:
        # Fallback dur
        threading.Timer(0.5, lambda: __import__("os")._exit(0)).start()
    return jsonify({"ok": True})


# ── Sync automatique local ──────────────────────────────────────────────────────
def _auto_sync():
    while True:
        time.sleep(15)
        if not MT5_AVAILABLE:
            continue
        try:
            # Si la connexion est tombée, on retente
            if mt5.account_info() is None:
                ok, err = _initialize_and_login()
                if not ok:
                    with _lock:
                        _state["logged"] = False
                        _state["last_error"] = err
                    log.warning("Reconnexion échouée: %s", err)
                    continue
            snap = _account_snapshot()
            if snap:
                with _lock:
                    _state["account"] = snap
                    _state["last_sync"] = time.time()
                    _state["logged"] = True
        except Exception as exc:
            with _lock:
                _state["last_error"] = str(exc)
            log.warning("Auto-sync erreur: %s", exc)


# ── Démarrage ────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    log.info("Démarrage worker — terminal=%s port=%d", ARGS.terminal, ARGS.port)
    ok, err = _initialize_and_login()
    if ok:
        log.info("Connecté au compte %s@%s", ARGS.login, ARGS.server)
    else:
        with _lock:
            _state["last_error"] = err
        log.error("Connexion initiale échouée: %s", err)

    threading.Thread(target=_auto_sync, daemon=True).start()
    app.run(host="127.0.0.1", port=ARGS.port, debug=False, threaded=True)
