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
# Nombre de tentatives et délai d'IPC pour absorber le -10005 (IPC_TIMEOUT)
INIT_ATTEMPTS = 4
INIT_TIMEOUT_MS = 60_000  # laisse le temps au terminal de démarrer à froid


def _initialize_and_login() -> tuple[bool, str]:
    """
    Initialise CETTE instance de terminal (via --terminal) en mode portable,
    puis se connecte au compte. Chaque worker a son propre terminal → pas de
    conflit entre comptes.

    Gestion du -10005 (IPC_TIMEOUT) : quand on démarre beaucoup de terminaux
    en même temps, le premier handshake IPC peut expirer alors que le terminal
    est simplement lent à démarrer. On retente avec un backoff au lieu
    d'abandonner, et on passe un `timeout` explicite à initialize().
    """
    if not MT5_AVAILABLE:
        return False, "MetaTrader5 non disponible sur ce système."

    last_code, last_msg = 0, ""
    for attempt in range(1, INIT_ATTEMPTS + 1):
        # portable=True → le terminal stocke ses données dans son propre dossier.
        # timeout → durée max (ms) accordée au handshake IPC de démarrage.
        ok = mt5.initialize(
            path=ARGS.terminal,
            login=int(ARGS.login),
            password=ARGS.password,
            server=ARGS.server,
            portable=True,
            timeout=INIT_TIMEOUT_MS,
        )
        if ok:
            info = mt5.account_info()
            if info is None:
                last_code, last_msg = mt5.last_error()
                mt5.shutdown()
            elif str(info.login) != str(ARGS.login):
                return False, f"Login inattendu: {info.login} != {ARGS.login}"
            else:
                with _lock:
                    _state["initialized"] = True
                    _state["logged"] = True
                    _state["last_error"] = ""
                if attempt > 1:
                    log.info("Initialisation réussie à la tentative %d.", attempt)
                return True, ""
        else:
            last_code, last_msg = mt5.last_error()

        # -10005 = IPC_TIMEOUT (terminal lent à démarrer). On retente.
        wait = min(2.0 * attempt, 8.0)
        log.warning(
            "initialize/login tentative %d/%d échouée (code %s: %s). Nouvel essai dans %.1fs.",
            attempt, INIT_ATTEMPTS, last_code, last_msg, wait,
        )
        try:
            mt5.shutdown()
        except Exception:
            pass
        time.sleep(wait)

    with _lock:
        _state["last_error"] = f"code {last_code}: {last_msg}"
    return False, f"initialize/login échoué après {INIT_ATTEMPTS} tentatives (code {last_code}: {last_msg})"


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


def _ensure_symbol_ready(symbol: str) -> Optional[str]:
    """Résout + rend le symbole visible dans le Market Watch avant de trader."""
    resolved = _resolve_symbol(symbol)
    if resolved is None:
        return None
    info = mt5.symbol_info(resolved)
    if info is None:
        return None
    if not info.visible:
        mt5.symbol_select(resolved, True)
        time.sleep(0.05)
    return resolved


def _filling_mode(symbol: str):
    """Détermine le mode de remplissage supporté par le symbole/broker."""
    info = mt5.symbol_info(symbol)
    if info is not None:
        mode = info.filling_mode
        if mode & 1:  # SYMBOL_FILLING_FOK
            return mt5.ORDER_FILLING_FOK
        if mode & 2:  # SYMBOL_FILLING_IOC
            return mt5.ORDER_FILLING_IOC
    return mt5.ORDER_FILLING_RETURN


@app.route("/open", methods=["POST"])
def open_position():
    """
    Ouvre une position marché.
    Body: {symbol, type: BUY|SELL, volume, sl?, tp?, magic?, comment?, deviation?}
    """
    guard = _check_secret()
    if guard:
        return guard
    if not MT5_AVAILABLE:
        return jsonify({"ok": False, "message": "MT5 indisponible."}), 503

    data = request.json or {}
    raw_symbol = str(data.get("symbol", "")).strip()
    side = str(data.get("type", "")).upper()
    volume = float(data.get("volume", 0))
    sl = float(data.get("sl", 0) or 0)
    tp = float(data.get("tp", 0) or 0)
    magic = int(data.get("magic", 0) or 0)
    comment = str(data.get("comment", "ANCIENFX"))[:31]
    deviation = int(data.get("deviation", 20))

    if not raw_symbol or side not in ("BUY", "SELL") or volume <= 0:
        return jsonify({"ok": False, "message": "symbol, type (BUY/SELL) et volume>0 requis."}), 400

    symbol = _ensure_symbol_ready(raw_symbol)
    if symbol is None:
        return jsonify({"ok": False, "message": f"Symbole '{raw_symbol}' indisponible sur ce broker."}), 404

    tick = mt5.symbol_info_tick(symbol)
    if tick is None:
        return jsonify({"ok": False, "message": "Prix indisponible."}), 503

    order_type = mt5.ORDER_TYPE_BUY if side == "BUY" else mt5.ORDER_TYPE_SELL
    price = tick.ask if side == "BUY" else tick.bid

    # Normalise le volume aux contraintes du symbole
    info = mt5.symbol_info(symbol)
    step = info.volume_step or 0.01
    volume = max(info.volume_min, min(info.volume_max, round(volume / step) * step))
    volume = round(volume, 2)

    req = {
        "action": mt5.TRADE_ACTION_DEAL,
        "symbol": symbol,
        "volume": volume,
        "type": order_type,
        "price": price,
        "deviation": deviation,
        "magic": magic,
        "comment": comment,
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": _filling_mode(symbol),
    }
    if sl > 0:
        req["sl"] = sl
    if tp > 0:
        req["tp"] = tp

    result = mt5.order_send(req)
    if result is None:
        code, msg = mt5.last_error()
        return jsonify({"ok": False, "message": f"order_send nul (code {code}): {msg}"}), 502
    if result.retcode != mt5.TRADE_RETCODE_DONE:
        return jsonify({"ok": False, "message": f"Ordre rejeté (retcode {result.retcode}): {result.comment}", "retcode": result.retcode}), 502

    return jsonify({
        "ok": True,
        "ticket": result.order,
        "position": getattr(result, "position", result.order),
        "volume": volume,
        "price": round(result.price, 5),
        "symbol": symbol,
    })


@app.route("/close", methods=["POST"])
def close_position():
    """
    Ferme une position par ticket (partiellement si volume fourni).
    Body: {ticket, volume?, deviation?}
    """
    guard = _check_secret()
    if guard:
        return guard
    if not MT5_AVAILABLE:
        return jsonify({"ok": False, "message": "MT5 indisponible."}), 503

    data = request.json or {}
    ticket = int(data.get("ticket", 0) or 0)
    deviation = int(data.get("deviation", 20))
    if ticket <= 0:
        return jsonify({"ok": False, "message": "ticket requis."}), 400

    pos_list = mt5.positions_get(ticket=ticket)
    if not pos_list:
        # Déjà fermée → succès idempotent
        return jsonify({"ok": True, "already_closed": True})
    pos = pos_list[0]

    volume = float(data.get("volume", pos.volume) or pos.volume)
    volume = min(volume, pos.volume)

    tick = mt5.symbol_info_tick(pos.symbol)
    if tick is None:
        return jsonify({"ok": False, "message": "Prix indisponible."}), 503

    # Sens inverse pour clôturer
    if pos.type == mt5.ORDER_TYPE_BUY:
        close_type = mt5.ORDER_TYPE_SELL
        price = tick.bid
    else:
        close_type = mt5.ORDER_TYPE_BUY
        price = tick.ask

    req = {
        "action": mt5.TRADE_ACTION_DEAL,
        "symbol": pos.symbol,
        "volume": round(volume, 2),
        "type": close_type,
        "position": ticket,
        "price": price,
        "deviation": deviation,
        "magic": pos.magic,
        "comment": "ANCIENFX close",
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": _filling_mode(pos.symbol),
    }
    result = mt5.order_send(req)
    if result is None:
        code, msg = mt5.last_error()
        return jsonify({"ok": False, "message": f"order_send nul (code {code}): {msg}"}), 502
    if result.retcode != mt5.TRADE_RETCODE_DONE:
        return jsonify({"ok": False, "message": f"Clôture rejetée (retcode {result.retcode}): {result.comment}", "retcode": result.retcode}), 502

    return jsonify({"ok": True, "ticket": ticket, "closed_volume": round(volume, 2)})


@app.route("/modify", methods=["POST"])
def modify_position():
    """
    Modifie le SL/TP d'une position.
    Body: {ticket, sl?, tp?}
    """
    guard = _check_secret()
    if guard:
        return guard
    if not MT5_AVAILABLE:
        return jsonify({"ok": False, "message": "MT5 indisponible."}), 503

    data = request.json or {}
    ticket = int(data.get("ticket", 0) or 0)
    if ticket <= 0:
        return jsonify({"ok": False, "message": "ticket requis."}), 400

    pos_list = mt5.positions_get(ticket=ticket)
    if not pos_list:
        return jsonify({"ok": False, "message": "Position introuvable."}), 404
    pos = pos_list[0]

    sl = float(data.get("sl", pos.sl) or 0)
    tp = float(data.get("tp", pos.tp) or 0)

    req = {
        "action": mt5.TRADE_ACTION_SLTP,
        "symbol": pos.symbol,
        "position": ticket,
        "sl": sl,
        "tp": tp,
    }
    result = mt5.order_send(req)
    if result is None or result.retcode != mt5.TRADE_RETCODE_DONE:
        rc = result.retcode if result else "nul"
        return jsonify({"ok": False, "message": f"Modification SL/TP rejetée (retcode {rc})."}), 502

    return jsonify({"ok": True, "ticket": ticket, "sl": sl, "tp": tp})


@app.route("/close_all", methods=["POST"])
def close_all():
    """Ferme toutes les positions (optionnellement filtrées par magic). Body: {magic?}"""
    guard = _check_secret()
    if guard:
        return guard
    if not MT5_AVAILABLE:
        return jsonify({"ok": True, "closed": 0})

    data = request.json or {}
    magic_filter = data.get("magic")
    positions = mt5.positions_get() or []
    closed = 0
    for pos in positions:
        if magic_filter is not None and pos.magic != int(magic_filter):
            continue
        tick = mt5.symbol_info_tick(pos.symbol)
        if tick is None:
            continue
        if pos.type == mt5.ORDER_TYPE_BUY:
            close_type, price = mt5.ORDER_TYPE_SELL, tick.bid
        else:
            close_type, price = mt5.ORDER_TYPE_BUY, tick.ask
        req = {
            "action": mt5.TRADE_ACTION_DEAL,
            "symbol": pos.symbol,
            "volume": pos.volume,
            "type": close_type,
            "position": pos.ticket,
            "price": price,
            "deviation": 20,
            "magic": pos.magic,
            "comment": "ANCIENFX close_all",
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": _filling_mode(pos.symbol),
        }
        res = mt5.order_send(req)
        if res is not None and res.retcode == mt5.TRADE_RETCODE_DONE:
            closed += 1
    return jsonify({"ok": True, "closed": closed})


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
def _init_in_background():
    """
    Init MT5 en arriere-plan pour que Flask soit disponible immediatement.
    Le manager interroge /health en boucle jusqu'a logged=True.
    Cela resout le probleme des brokers lents (XMGlobal, FTMO...) qui peuvent
    prendre 60-120s pour etablir la connexion broker : le worker repond deja
    au /health du manager pendant ce temps, au lieu de paraitre "mort".
    """
    log.info("Init MT5 en arriere-plan pour %s@%s ...", ARGS.login, ARGS.server)
    ok, err = _initialize_and_login()
    if ok:
        log.info("Connecte au compte %s@%s", ARGS.login, ARGS.server)
    else:
        with _lock:
            _state["last_error"] = err
        log.error("Connexion initiale echouee: %s", err)


if __name__ == "__main__":
    log.info("Demarrage worker — terminal=%s port=%d", ARGS.terminal, ARGS.port)

    # IMPORTANT : Flask demarre AVANT l'init MT5 (en background).
    # Sans ca, le manager voit "pas de reponse" pendant toute la connexion broker
    # et tue le worker avant meme qu'il ait eu le temps de se connecter.
    threading.Thread(target=_init_in_background, daemon=True).start()
    threading.Thread(target=_auto_sync, daemon=True).start()
    app.run(host="127.0.0.1", port=ARGS.port, debug=False, threaded=True)
