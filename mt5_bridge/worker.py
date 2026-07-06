"""
ANCIENFX - MT5 Worker
=====================
UN worker = UN processus Python = UNE instance de terminal MT5 = UN compte.

Pattern: le terminal MT5 doit DEJA ETRE OUVERT ET CONNECTE sur le VPS.
Le worker s'y attache via mt5.initialize(path=...) SANS passer de credentials.
Inspire de github.com/therichkidcl-spec/mcp-mt5.

Lancement (fait par le manager, pas a la main) :
  python worker.py --login 123 \
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
parser.add_argument("--password", default="")   # garde pour compat, non utilise
parser.add_argument("--server", default="")     # garde pour compat, non utilise
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


# ── Connexion MT5 ───────────────────────────────────────────────────────────────
# Pattern inspire de therichkidcl-spec/mcp-mt5 :
# Le terminal doit DEJA ETRE OUVERT ET CONNECTE sur le VPS.
# Le worker s'y attache simplement via mt5.initialize(path=...) SANS login/password.
# C'est la seule methode fiable — passer login= ou appeler mt5.login() apres
# un initialize() en mode portable echoue avec -10005 sur la plupart des brokers.
ATTACH_ATTEMPTS = 8
ATTACH_WAIT_S   = 5   # attente entre tentatives d'attachement


def _initialize_and_login() -> tuple[bool, str]:
    """
    Attache le processus Python au terminal MT5 DEJA OUVERT sur le VPS.
    Aucun login/password n'est passe : le terminal est deja authentifie.
    Si le terminal n'est pas encore demarre, on retente toutes les 5s.
    """
    if not MT5_AVAILABLE:
        return False, "MetaTrader5 non disponible sur ce systeme."

    last_code, last_msg = 0, "inconnu"
    for attempt in range(1, ATTACH_ATTEMPTS + 1):
        # initialize() SANS portable=True, SANS login/password/server
        # On s'attache au terminal deja en cours d'execution identifie par path=
        ok = mt5.initialize(path=ARGS.terminal)
        if ok:
            info = mt5.account_info()
            if info is None:
                last_code, last_msg = mt5.last_error()
                log.warning("initialize() ok mais account_info() vide — terminal pas encore connecte au broker? (code %s: %s)", last_code, last_msg)
                mt5.shutdown()
                time.sleep(ATTACH_WAIT_S)
                continue
            # Verifier que le terminal est connecte au bon compte
            if str(info.login) != str(ARGS.login):
                log.warning("Compte inattendu: terminal connecte a %s, attendu %s. Tentative %d/%d.",
                            info.login, ARGS.login, attempt, ATTACH_ATTEMPTS)
                mt5.shutdown()
                time.sleep(ATTACH_WAIT_S)
                continue
            with _lock:
                _state["initialized"] = True
                _state["logged"]      = True
                _state["last_error"]  = ""
            log.info("Attache au compte %s@%s (balance=%.2f %s)",
                     info.login, info.server, info.balance, info.currency)
            return True, ""
        last_code, last_msg = mt5.last_error()
        log.warning("initialize() tentative %d/%d echouee (code %s: %s). Retry dans %ds.",
                    attempt, ATTACH_ATTEMPTS, last_code, last_msg, ATTACH_WAIT_S)
        try:
            mt5.shutdown()
        except Exception:
            pass
        time.sleep(ATTACH_WAIT_S)

    with _lock:
        _state["last_error"] = f"initialize echoue apres {ATTACH_ATTEMPTS} tentatives (code {last_code}: {last_msg})"
    return False, _state["last_error"]


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
RECONNECT_INTERVAL = 30  # secondes entre les tentatives de reconnexion auto


def _init_in_background():
    """
    Init MT5 en arriere-plan. Le worker NE QUITTE PAS si le login echoue :
    il continue de repondre a /health (logged=False, last_error=...) et
    retente la connexion automatiquement jusqu'a succes ou arret explicite.
    Cela permet au manager de lire l'erreur exacte au lieu de voir "process mort".
    """
    # Attendre que Flask soit demarre et lie au port avant de bloquer le GIL
    # avec mt5.initialize(). Sans ce delai, mt5.initialize() (meme dans un thread)
    # bloque le GIL assez longtemps pour que Flask ne puisse pas repondre au
    # premier ping du manager -> le manager voit "Flask inaccessible".
    time.sleep(2)
    log.info("Init MT5 en arriere-plan pour %s@%s ...", ARGS.login, ARGS.server)
    attempt = 0
    while True:
        attempt += 1
        log.info("[background] Tentative de connexion #%d pour %s@%s", attempt, ARGS.login, ARGS.server)
        ok, err = _initialize_and_login()
        if ok:
            log.info("Connecte au compte %s@%s", ARGS.login, ARGS.server)
            return
        with _lock:
            _state["last_error"] = err
        log.error("[background] Connexion echouee (tentative %d): %s", attempt, err)
        log.info("[background] Nouvelle tentative dans %ds...", RECONNECT_INTERVAL)
        time.sleep(RECONNECT_INTERVAL)


if __name__ == "__main__":
    log.info("Demarrage worker — terminal=%s port=%d", ARGS.terminal, ARGS.port)

    # IMPORTANT : Flask demarre AVANT l'init MT5 (en background).
    # Sans ca, le manager voit "pas de reponse" pendant toute la connexion broker
    # et tue le worker avant meme qu'il ait eu le temps de se connecter.
    threading.Thread(target=_init_in_background, daemon=True).start()
    threading.Thread(target=_auto_sync, daemon=True).start()
    app.run(host="127.0.0.1", port=ARGS.port, debug=False, threaded=True)
