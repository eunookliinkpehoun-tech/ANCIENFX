"""
ANCIENFX - MT5 Worker
=====================
UN worker = UN processus Python = UNE instance de terminal MT5 = UN compte.

Strategie de connexion (la seule fiable avec les brokers comme XMGlobal) :
  1. Lancer terminal64.exe avec /login: /password: /server: /portable en subprocess
  2. Attendre que le processus soit stable (3-5s)
  3. Appeler mt5.initialize(path=...) SANS passer de credentials a Python
  4. Verifier account_info() pour confirmer la connexion

Pourquoi pas mt5.initialize(login=..., portable=True) ?
  Cette forme force MT5 a relancer une connexion broker depuis Python, ce qui
  echoue avec -10005 sur la plupart des brokers car le canal IPC n'est pas pret.
  En lancant le terminal avec ses propres arguments CLI, il gere lui-meme la
  connexion broker, et Python s'y attache une fois qu'il est connecte.
"""

import argparse
import logging
import os
import subprocess
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
parser.add_argument("--login",    required=True)
parser.add_argument("--password", required=True)
parser.add_argument("--server",   required=True)
parser.add_argument("--terminal", required=True, help="Chemin vers terminal64.exe")
parser.add_argument("--port",     type=int, required=True)
parser.add_argument("--secret",   default="")
ARGS = parser.parse_args()

logging.basicConfig(
    level=logging.INFO,
    format=f"%(asctime)s [worker:{ARGS.login}] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(f"worker-{ARGS.login}")

app = Flask(__name__)

# ── Etat du worker ─────────────────────────────────────────────────────────────
_state = {
    "logged":      False,
    "last_error":  "",
    "account":     None,
    "last_sync":   0.0,
    "initialized": False,
}
_lock = threading.Lock()

# ── Constantes de connexion ───────────────────────────────────────────────────
# Temps d'attente apres le lancement du terminal avant la premiere tentative IPC
TERMINAL_BOOT_WAIT = 6       # secondes
# Nombre de tentatives d'attachement IPC apres le boot
ATTACH_ATTEMPTS    = 10
ATTACH_WAIT_S      = 8       # secondes entre tentatives


# ── Securite ────────────────────────────────────────────────────────────────────
def _check_secret() -> Optional[tuple]:
    if ARGS.secret:
        if request.headers.get("X-Bridge-Secret", "") != ARGS.secret:
            return jsonify({"ok": False, "message": "Non autorise."}), 401
    return None


# ── Lancement du terminal MT5 via CLI ─────────────────────────────────────────
def _launch_terminal() -> Optional[subprocess.Popen]:
    """
    Lance terminal64.exe avec les arguments de connexion natifs de MT5.
    Le terminal gere lui-meme la connexion broker — beaucoup plus fiable
    que de passer login/password a mt5.initialize() via Python.

    Arguments CLI de MetaTrader 5 (documentes par MetaQuotes) :
      /portable    : mode portable (donnees dans le dossier du terminal)
      /login:N     : numero de compte
      /password:X  : mot de passe
      /server:S    : nom du serveur broker
      /skipupdate  : ne pas checker les mises a jour au demarrage
    """
    terminal = ARGS.terminal
    if not os.path.exists(terminal):
        log.error("terminal64.exe introuvable: %s", terminal)
        return None

    cmd = [
        terminal,
        "/portable",
        f"/login:{ARGS.login}",
        f"/password:{ARGS.password}",
        f"/server:{ARGS.server}",
        "/skipupdate",
    ]
    log.info("Lancement terminal: %s /login:%s /server:%s", terminal, ARGS.login, ARGS.server)
    try:
        proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        log.info("Terminal PID=%d lance. Attente %ds pour le boot...", proc.pid, TERMINAL_BOOT_WAIT)
        return proc
    except Exception as exc:
        log.error("Impossible de lancer le terminal: %s", exc)
        return None


# ── Attachement IPC a un terminal deja en cours ───────────────────────────────
def _attach_to_terminal() -> tuple[bool, str]:
    """
    S'attache au terminal via mt5.initialize(path=...) SANS passer de credentials.
    Le terminal a deja ete lance par _launch_terminal() et s'est connecte au broker.
    On attend que account_info() retourne le bon compte.
    """
    if not MT5_AVAILABLE:
        return False, "MetaTrader5 non disponible sur ce systeme."

    last_code, last_msg = 0, "inconnu"

    for attempt in range(1, ATTACH_ATTEMPTS + 1):
        ok = mt5.initialize(path=ARGS.terminal)
        if ok:
            info = mt5.account_info()
            if info is None:
                last_code, last_msg = mt5.last_error()
                log.info("initialize() ok, account_info() pas encore dispo (tentative %d/%d, code %s). Retry %ds...",
                         attempt, ATTACH_ATTEMPTS, last_code, ATTACH_WAIT_S)
                mt5.shutdown()
                time.sleep(ATTACH_WAIT_S)
                continue

            if str(info.login) != str(ARGS.login):
                log.warning("Compte inattendu: terminal=%s attendu=%s (tentative %d/%d).",
                            info.login, ARGS.login, attempt, ATTACH_ATTEMPTS)
                mt5.shutdown()
                time.sleep(ATTACH_WAIT_S)
                continue

            is_demo = info.trade_mode == mt5.ACCOUNT_TRADE_MODE_DEMO
            with _lock:
                _state["initialized"] = True
                _state["logged"]      = True
                _state["last_error"]  = ""
                _state["account"] = {
                    "login":       str(info.login),
                    "server":      info.server,
                    "broker":      info.company,
                    "accountType": "DEMO" if is_demo else "REEL",
                    "leverage":    info.leverage,
                    "isDemo":      is_demo,
                    "balance":     round(info.balance, 2),
                    "equity":      round(info.equity, 2),
                    "freeMargin":  round(info.margin_free, 2),
                    "dailyProfit": round(info.profit, 2),
                    "currency":    info.currency,
                }
            log.info("Connecte: %s@%s | %s | balance=%.2f %s",
                     info.login, info.server,
                     "DEMO" if is_demo else "REEL",
                     info.balance, info.currency)
            return True, ""

        last_code, last_msg = mt5.last_error()
        log.warning("initialize() tentative %d/%d echouee (code %s: %s). Retry %ds...",
                    attempt, ATTACH_ATTEMPTS, last_code, last_msg, ATTACH_WAIT_S)
        try:
            mt5.shutdown()
        except Exception:
            pass
        time.sleep(ATTACH_WAIT_S)

    err = f"Attachement IPC echoue apres {ATTACH_ATTEMPTS} tentatives (code {last_code}: {last_msg})"
    with _lock:
        _state["last_error"] = err
    return False, err


def _initialize_and_login() -> tuple[bool, str]:
    """
    Point d'entree principal : lance le terminal avec ses credentials,
    attend le boot, puis s'y attache via IPC.
    """
    # Etape 1 : lancer le terminal avec login/password/server en arguments CLI
    proc = _launch_terminal()
    if proc is None:
        return False, f"Impossible de lancer {ARGS.terminal}"

    # Etape 2 : attendre que le terminal soit demarre et connecte au broker
    time.sleep(TERMINAL_BOOT_WAIT)

    # Etape 3 : s'attacher via IPC
    ok, err = _attach_to_terminal()
    if not ok:
        # Tuer le terminal si l'attachement echoue pour ne pas laisser un zombie
        try:
            proc.terminate()
        except Exception:
            pass
    return ok, err


def _account_snapshot() -> Optional[dict]:
    if not MT5_AVAILABLE:
        return None
    info = mt5.account_info()
    if info is None:
        return None
    is_demo = info.trade_mode == mt5.ACCOUNT_TRADE_MODE_DEMO
    return {
        "login":       str(info.login),
        "server":      ARGS.server,
        "broker":      info.company,
        "accountType": "DEMO" if is_demo else "REEL",
        "leverage":    info.leverage,
        "isDemo":      is_demo,
        "balance":     round(info.balance, 2),
        "equity":      round(info.equity, 2),
        "freeMargin":  round(info.margin_free, 2),
        "dailyProfit": round(info.profit, 2),
        "currency":    info.currency,
    }


def _resolve_symbol(raw: str) -> Optional[str]:
    """Resolution du suffixe: EURUSDm -> EURUSD, etc."""
    if not MT5_AVAILABLE:
        return raw
    if mt5.symbol_info(raw) is not None:
        return raw
    base = raw.rstrip("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ").rstrip(".")
    for c in (base, raw + "m", raw + ".a", raw + ".r", base + "m"):
        if c and mt5.symbol_info(c) is not None:
            return c
    return None


# ── Sync auto ─────────────────────────────────────────────────────────────────
def _auto_sync():
    while True:
        time.sleep(30)
        with _lock:
            if not _state["logged"]:
                continue
        try:
            snap = _account_snapshot()
            if snap:
                with _lock:
                    _state["account"]   = snap
                    _state["last_sync"] = time.time()
        except Exception as exc:
            log.warning("auto_sync error: %s", exc)


# ── Routes Flask ─────────────────────────────────────────────────────────────

@app.route("/health")
def health():
    with _lock:
        return jsonify({
            "ok":          _state["logged"],
            "logged":      _state["logged"],
            "initialized": _state["initialized"],
            "last_error":  _state["last_error"],
        })


@app.route("/account")
def account():
    err = _check_secret()
    if err:
        return err
    with _lock:
        if not _state["logged"]:
            return jsonify({"ok": False, "message": _state["last_error"] or "Non connecte."}), 503
    snap = _account_snapshot()
    if snap is None:
        return jsonify({"ok": False, "message": "account_info() indisponible."}), 503
    return jsonify({"ok": True, **snap})


@app.route("/tick/<symbol>")
def tick(symbol: str):
    err = _check_secret()
    if err:
        return err
    with _lock:
        if not _state["logged"]:
            return jsonify({"ok": False, "message": "Non connecte."}), 503
    resolved = _resolve_symbol(symbol)
    if resolved is None:
        return jsonify({"ok": False, "message": f"Symbole {symbol} introuvable."}), 404
    t = mt5.symbol_info_tick(resolved)
    if t is None:
        return jsonify({"ok": False, "message": f"Pas de tick pour {resolved}."}), 404
    return jsonify({"ok": True, "symbol": resolved, "bid": t.bid, "ask": t.ask, "time": t.time})


@app.route("/positions")
def positions():
    err = _check_secret()
    if err:
        return err
    with _lock:
        if not _state["logged"]:
            return jsonify({"ok": False, "message": "Non connecte."}), 503
    raw = mt5.positions_get()
    if raw is None:
        raw = []
    result = []
    for p in raw:
        result.append({
            "ticket":     p.ticket,
            "symbol":     p.symbol,
            "type":       "BUY" if p.type == 0 else "SELL",
            "volume":     p.volume,
            "openPrice":  p.price_open,
            "currentPrice": p.price_current,
            "profit":     round(p.profit, 2),
            "swap":       round(p.swap, 2),
            "comment":    p.comment,
            "magic":      p.magic,
            "openTime":   datetime.fromtimestamp(p.time, tz=timezone.utc).isoformat(),
        })
    return jsonify({"ok": True, "positions": result})


@app.route("/order", methods=["POST"])
def order():
    err = _check_secret()
    if err:
        return err
    with _lock:
        if not _state["logged"]:
            return jsonify({"ok": False, "message": "Non connecte."}), 503
    data = request.json or {}
    symbol  = data.get("symbol", "")
    side    = data.get("side", "BUY").upper()
    volume  = float(data.get("volume", 0.01))
    sl      = float(data.get("sl", 0.0))
    tp      = float(data.get("tp", 0.0))
    comment = data.get("comment", "ANCIENFX")
    magic   = int(data.get("magic", 0))

    resolved = _resolve_symbol(symbol)
    if resolved is None:
        return jsonify({"ok": False, "message": f"Symbole {symbol} introuvable."}), 404

    order_type = mt5.ORDER_TYPE_BUY if side == "BUY" else mt5.ORDER_TYPE_SELL
    t = mt5.symbol_info_tick(resolved)
    if t is None:
        return jsonify({"ok": False, "message": f"Pas de prix pour {resolved}."}), 503
    price = t.ask if side == "BUY" else t.bid

    req = {
        "action":   mt5.TRADE_ACTION_DEAL,
        "symbol":   resolved,
        "volume":   volume,
        "type":     order_type,
        "price":    price,
        "sl":       sl,
        "tp":       tp,
        "deviation": 20,
        "magic":    magic,
        "comment":  comment,
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": mt5.ORDER_FILLING_IOC,
    }
    result = mt5.order_send(req)
    if result is None or result.retcode != mt5.TRADE_RETCODE_DONE:
        code = result.retcode if result else -1
        msg  = result.comment if result else "Pas de reponse"
        return jsonify({"ok": False, "message": f"Ordre refuse: {msg} (code {code})"}), 400
    return jsonify({
        "ok":     True,
        "ticket": result.order,
        "price":  result.price,
        "volume": result.volume,
    })


@app.route("/close", methods=["POST"])
def close():
    err = _check_secret()
    if err:
        return err
    with _lock:
        if not _state["logged"]:
            return jsonify({"ok": False, "message": "Non connecte."}), 503
    data   = request.json or {}
    ticket = int(data.get("ticket", 0))
    positions = mt5.positions_get(ticket=ticket)
    if not positions:
        return jsonify({"ok": False, "message": f"Position {ticket} introuvable."}), 404
    p = positions[0]
    close_type = mt5.ORDER_TYPE_SELL if p.type == 0 else mt5.ORDER_TYPE_BUY
    t = mt5.symbol_info_tick(p.symbol)
    if t is None:
        return jsonify({"ok": False, "message": f"Pas de prix pour {p.symbol}."}), 503
    price = t.bid if p.type == 0 else t.ask
    req = {
        "action":    mt5.TRADE_ACTION_DEAL,
        "symbol":    p.symbol,
        "volume":    p.volume,
        "type":      close_type,
        "position":  ticket,
        "price":     price,
        "deviation": 20,
        "magic":     p.magic,
        "comment":   "ANCIENFX-CLOSE",
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": mt5.ORDER_FILLING_IOC,
    }
    result = mt5.order_send(req)
    if result is None or result.retcode != mt5.TRADE_RETCODE_DONE:
        code = result.retcode if result else -1
        msg  = result.comment if result else "Pas de reponse"
        return jsonify({"ok": False, "message": f"Fermeture refusee: {msg} (code {code})"}), 400
    return jsonify({"ok": True, "ticket": ticket, "closed": True})


# ── Init en background + demarrage Flask ─────────────────────────────────────
RECONNECT_INTERVAL = 60  # secondes entre tentatives si connexion initiale echoue


def _init_in_background():
    """
    Demarre le terminal et s'y attache.
    Flask est deja demarre — le manager peut pinguer /health pendant ce temps.
    Si la connexion echoue, on retente indefiniment : le worker ne quitte jamais.
    """
    # Delai pour laisser Flask binder le port et repondre au premier ping manager
    time.sleep(2)
    attempt = 0
    while True:
        attempt += 1
        log.info("[background] Tentative de connexion #%d pour %s@%s",
                 attempt, ARGS.login, ARGS.server)
        ok, err = _initialize_and_login()
        if ok:
            return
        with _lock:
            _state["last_error"] = err
        log.error("[background] Echec connexion #%d: %s. Retry dans %ds...",
                  attempt, err, RECONNECT_INTERVAL)
        time.sleep(RECONNECT_INTERVAL)


if __name__ == "__main__":
    log.info("Demarrage worker — login=%s server=%s terminal=%s port=%d",
             ARGS.login, ARGS.server, ARGS.terminal, ARGS.port)

    threading.Thread(target=_init_in_background, daemon=True).start()
    threading.Thread(target=_auto_sync, daemon=True).start()
    app.run(host="127.0.0.1", port=ARGS.port, debug=False, threaded=True)
