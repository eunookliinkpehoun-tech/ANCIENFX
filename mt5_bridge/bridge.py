"""
ANCIENFX - MT5 Bridge (MANAGER multi-terminal)
==============================================
Ce serveur est le point d'entrée unique appelé par Next.js (MT5_BRIDGE_URL).
Il NE parle PAS directement à MetaTrader5.

Architecture (connexion SIMULTANÉE de N comptes) :

    Next.js ──HTTP──▶  bridge.py (MANAGER, port 8765)
                          │  spawn / proxy / kill
              ┌───────────┼─────────────┐
              ▼           ▼             ▼
        worker.py    worker.py     worker.py     ...  (jusqu'à 20+)
        login A      login B       login C
        terminal A   terminal B    terminal C    (instances portables séparées)
        port 9101    port 9102     port 9103

  → Chaque compte a SON processus + SON terminal MT5 → tous connectés en même temps.
  → Le manager garde le même contrat HTTP qu'avant : service.ts ne change quasiment pas.

Routes exposées (identiques à l'ancienne version) :
  POST /connect        {login, password, server}
  POST /sync           {login, server}
  POST /disconnect     {login, server}
  POST /positions      {login, server}
  POST /history        {login, server, days}
  POST /symbol_info    {login, server, symbol}
  GET  /health
  GET  /accounts       (bonus : liste tous les comptes connectés)

Démarrer : python bridge.py
"""

import os
import sys
import time
import socket
import logging
import threading
import subprocess
from datetime import datetime, timezone
from typing import Optional

import requests
from flask import Flask, jsonify, request

import provision
from copy_engine import CopyEngine, CopyConfig

# ── Configuration ──────────────────────────────────────────────────────────────
BRIDGE_PORT    = int(os.environ.get("BRIDGE_PORT", 8765))
BRIDGE_SECRET  = os.environ.get("BRIDGE_SECRET", "")
WORKER_PORT_BASE = int(os.environ.get("WORKER_PORT_BASE", 9101))
MAX_WORKERS    = int(os.environ.get("MAX_WORKERS", 40))
WORKER_BOOT_TIMEOUT = int(os.environ.get("WORKER_BOOT_TIMEOUT", 180))  # sec — laisser le temps aux brokers lents
PYTHON_EXE     = os.environ.get("PYTHON_EXE", sys.executable)

try:
    import MetaTrader5  # noqa: F401
    MT5_AVAILABLE = True
except ImportError:
    MT5_AVAILABLE = False

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [manager] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("mt5-manager")

app = Flask(__name__)
_HERE = os.path.dirname(os.path.abspath(__file__))
_WORKER_SCRIPT = os.path.join(_HERE, "worker.py")

# ── Registre des workers ─────────────────────────────────────────────────────────
# key -> { proc, port, login, server, started_at }
_workers: dict[str, dict] = {}
_lock = threading.Lock()


# ── Helpers ────────────────────────────────────────────────────────────────────
def _key(login: str, server: str) -> str:
    return f"{login}|{server}"


def _check_secret() -> Optional[tuple]:
    if BRIDGE_SECRET and request.headers.get("X-Bridge-Secret", "") != BRIDGE_SECRET:
        return jsonify({"ok": False, "message": "Non autorisé."}), 401
    return None


def _worker_headers() -> dict:
    return {"X-Bridge-Secret": BRIDGE_SECRET} if BRIDGE_SECRET else {}


def _free_port() -> int:
    """Trouve un port libre pour un nouveau worker."""
    used = {w["port"] for w in _workers.values()}
    for offset in range(MAX_WORKERS):
        port = WORKER_PORT_BASE + offset
        if port in used:
            continue
        # Vérifie que le port est réellement libre sur la machine
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(("127.0.0.1", port)) != 0:
                return port
    raise RuntimeError("Aucun port libre pour un nouveau worker (MAX_WORKERS atteint).")


def _worker_url(port: int, path: str) -> str:
    return f"http://127.0.0.1:{port}{path}"


def _worker_get(port: int, path: str, timeout: float = 8.0) -> requests.Response:
    return requests.get(_worker_url(port, path), headers=_worker_headers(), timeout=timeout)


def _worker_post(port: int, path: str, body: dict, timeout: float = 10.0) -> requests.Response:
    return requests.post(_worker_url(port, path), json=body, headers=_worker_headers(), timeout=timeout)


def _wait_worker_ready(port: int, timeout: int) -> tuple[bool, str]:
    """
    Attend que le worker soit demarre ET connecte (logged=True).
    Le worker demarre Flask immediatement, puis connecte MT5 en background.
    On attend donc la reponse HTTP d'abord, puis logged=True ensuite.
    """
    deadline = time.time() + timeout
    last_err = "Le worker n'a pas repondu a temps."
    http_alive = False
    last_log_t = time.time()
    while time.time() < deadline:
        try:
            res = _worker_get(port, "/health", timeout=3.0)
            if res.ok:
                data = res.json()
                if not http_alive:
                    http_alive = True
                    log.info("Worker port %d: Flask actif, connexion broker en cours...", port)
                if data.get("logged"):
                    return True, ""
                # Affiche la progression toutes les 15s
                if time.time() - last_log_t > 15:
                    last_log_t = time.time()
                    last_err_tmp = data.get("last_error", "")
                    remaining = int(deadline - time.time())
                    log.info("Worker port %d: connexion broker en cours (timeout dans %ds)%s",
                             port, remaining, f" | erreur: {last_err_tmp}" if last_err_tmp else "")
                if data.get("last_error"):
                    last_err = data["last_error"]
        except Exception:
            pass
        time.sleep(1.0)
    if not http_alive:
        return False, "Le worker n'a pas demarre (Flask inaccessible) — verifier Python/port."
    # Derniere chance : lire last_error courant du worker avant de le tuer
    try:
        res = _worker_get(port, "/health", timeout=3.0)
        if res.ok:
            final_err = res.json().get("last_error", last_err)
            if final_err:
                last_err = final_err
    except Exception:
        pass
    return False, f"Connexion broker MT5 timeout apres {timeout}s. Erreur MT5: {last_err}"


# Sérialise les démarrages à froid : lancer 20 terminaux d'un coup provoque des
# -10005 (IPC_TIMEOUT). On démarre les terminaux un par un.
_spawn_lock = threading.Lock()


def _spawn_worker(login: str, password: str, server: str) -> tuple[bool, str, Optional[int]]:
    """Provisionne l'instance terminal + lance le worker. Retourne (ok, err, port)."""
    with _spawn_lock:
        return _spawn_worker_locked(login, password, server)


def _spawn_worker_locked(login: str, password: str, server: str) -> tuple[bool, str, Optional[int]]:
    # 1) Instance portable dédiée du terminal
    try:
        terminal_path = provision.ensure_instance(login)
    except Exception as exc:
        return False, f"Provisioning échoué: {exc}", None

    # 2) Port libre
    try:
        port = _free_port()
    except RuntimeError as exc:
        return False, str(exc), None

    # 3) Lancement du sous-processus worker
    cmd = [
        PYTHON_EXE, _WORKER_SCRIPT,
        "--login", str(login),
        "--password", password,
        "--server", server,
        "--terminal", terminal_path,
        "--port", str(port),
    ]
    if BRIDGE_SECRET:
        cmd += ["--secret", BRIDGE_SECRET]

    log.info("Lancement worker %s@%s sur port %d", login, server, port)
    log.info("  terminal: %s", terminal_path)

    # Log du worker dans un fichier dedie pour pouvoir diagnostiquer les erreurs MT5
    log_dir = os.path.join(_HERE, "worker_logs")
    os.makedirs(log_dir, exist_ok=True)
    log_file = os.path.join(log_dir, f"worker_{login}.log")

    try:
        log_fh = open(log_file, "a", buffering=1)
        proc = subprocess.Popen(
            cmd,
            cwd=_HERE,
            stdout=log_fh,
            stderr=log_fh,
        )
    except Exception as exc:
        return False, f"Impossible de lancer le worker: {exc}", None
    log.info("  logs worker -> %s", log_file)

    with _lock:
        _workers[_key(login, server)] = {
            "proc": proc,
            "port": port,
            "login": login,
            "server": server,
            "started_at": time.time(),
        }

    # 4) Attente de connexion
    ok, err = _wait_worker_ready(port, WORKER_BOOT_TIMEOUT)
    if not ok:
        log.warning("Worker %s non prêt: %s", login, err)
        _kill_worker(login, server)
        return False, err, None

    return True, "", port


def _kill_worker(login: str, server: str) -> None:
    key = _key(login, server)
    with _lock:
        w = _workers.pop(key, None)
    if not w:
        return
    # Arrêt propre via /shutdown, puis kill si nécessaire
    try:
        _worker_post(w["port"], "/shutdown", {}, timeout=3.0)
    except Exception:
        pass
    proc = w["proc"]
    try:
        proc.wait(timeout=5)
    except Exception:
        try:
            proc.kill()
        except Exception:
            pass
    log.info("Worker arrêté: %s@%s", login, server)


def _get_worker(login: str, server: str) -> Optional[dict]:
    with _lock:
        return _workers.get(_key(login, server))


# ── Copy engine (master -> slaves) ───────────────────────────────────────────────
def _node(w: dict) -> dict:
    """Représentation légère d'un worker passée au moteur de copie."""
    return {"key": _key(w["login"], w["server"]), "login": w["login"], "server": w["server"], "port": w["port"]}


def _get_master_node() -> Optional[dict]:
    """Retourne le worker maître si connecté, sinon None."""
    login = copy_cfg.master_login
    server = copy_cfg.master_server
    if not login:
        return None
    with _lock:
        # Si le server maître n'est pas précisé, on matche sur le login seul.
        for w in _workers.values():
            if str(w["login"]) == str(login) and (not server or w["server"] == server):
                return _node(w)
    return None


def _list_slave_nodes() -> list:
    """Tous les workers SAUF le maître."""
    master_login = copy_cfg.master_login
    master_server = copy_cfg.master_server
    result = []
    with _lock:
        for w in _workers.values():
            is_master = str(w["login"]) == str(master_login) and (
                not master_server or w["server"] == master_server
            )
            if not is_master:
                result.append(_node(w))
    return result


copy_cfg = CopyConfig()
copy_engine = CopyEngine(
    get_master=_get_master_node,
    list_slaves=_list_slave_nodes,
    worker_get=lambda port, path: _worker_get(port, path),
    worker_post=lambda port, path, body: _worker_post(port, path, body),
    config=copy_cfg,
)


# ── Routes ───────────────────────────────────────────────────────────────────────
@app.route("/health", methods=["GET"])
def health():
    with _lock:
        workers_snapshot = [
            {"login": w["login"], "server": w["server"], "port": w["port"]}
            for w in _workers.values()
        ]
    return jsonify({
        "ok": True,
        "mt5_available": MT5_AVAILABLE,
        "terminal_connected": len(workers_snapshot) > 0,
        "active_sessions": len(workers_snapshot),
        "workers": workers_snapshot,
        "max_workers": MAX_WORKERS,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })


@app.route("/accounts", methods=["GET"])
def accounts():
    """Liste tous les comptes connectés avec leur dernier snapshot."""
    guard = _check_secret()
    if guard:
        return guard
    result = []
    with _lock:
        items = list(_workers.values())
    for w in items:
        entry = {"login": w["login"], "server": w["server"], "connected": False, "account": None}
        try:
            res = _worker_get(w["port"], "/health", timeout=3.0)
            if res.ok:
                entry["connected"] = res.json().get("logged", False)
            acc = _worker_get(w["port"], "/account", timeout=5.0)
            if acc.ok and acc.json().get("ok"):
                entry["account"] = acc.json()["account"]
        except Exception:
            pass
        result.append(entry)
    return jsonify({"ok": True, "accounts": result})


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

    # Déjà connecté ? On renvoie le snapshot courant.
    existing = _get_worker(login, server)
    if existing:
        try:
            res = _worker_get(existing["port"], "/account", timeout=6.0)
            if res.ok and res.json().get("ok"):
                return jsonify({"ok": True, "account": res.json()["account"], "reused": True})
        except Exception:
            pass
        # Worker mort/bloqué → on le remplace
        _kill_worker(login, server)

    with _lock:
        if len(_workers) >= MAX_WORKERS:
            return jsonify({"ok": False, "message": f"Limite de {MAX_WORKERS} comptes atteinte."}), 429

    ok, err, port = _spawn_worker(login, password, server)
    if not ok:
        return jsonify({"ok": False, "message": err}), 401

    try:
        res = _worker_get(port, "/account", timeout=8.0)
        if not res.ok or not res.json().get("ok"):
            _kill_worker(login, server)
            return jsonify({"ok": False, "message": "Compte connecté mais infos illisibles."}), 500
        account = res.json()["account"]
    except Exception as exc:
        _kill_worker(login, server)
        return jsonify({"ok": False, "message": f"Erreur lecture compte: {exc}"}), 500

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

    w = _get_worker(login, server)
    if not w:
        return jsonify({"ok": False, "message": "Session introuvable. Reconnectez le compte."}), 404
    try:
        res = _worker_get(w["port"], "/account", timeout=8.0)
        payload = res.json()
        return jsonify(payload), res.status_code
    except Exception as exc:
        return jsonify({"ok": False, "message": f"Worker injoignable: {exc}"}), 502


@app.route("/positions", methods=["POST"])
def positions():
    guard = _check_secret()
    if guard:
        return guard
    data   = request.json or {}
    login  = str(data.get("login", "")).strip()
    server = str(data.get("server", "")).strip()

    w = _get_worker(login, server)
    if not w:
        return jsonify({"ok": False, "message": "Session introuvable."}), 404
    try:
        res = _worker_get(w["port"], "/positions", timeout=8.0)
        return jsonify(res.json()), res.status_code
    except Exception as exc:
        return jsonify({"ok": False, "message": f"Worker injoignable: {exc}"}), 502


@app.route("/history", methods=["POST"])
def history():
    guard = _check_secret()
    if guard:
        return guard
    data   = request.json or {}
    login  = str(data.get("login", "")).strip()
    server = str(data.get("server", "")).strip()
    days   = int(data.get("days", 30))

    w = _get_worker(login, server)
    if not w:
        return jsonify({"ok": False, "message": "Session introuvable."}), 404
    try:
        res = _worker_post(w["port"], "/history", {"days": days}, timeout=15.0)
        return jsonify(res.json()), res.status_code
    except Exception as exc:
        return jsonify({"ok": False, "message": f"Worker injoignable: {exc}"}), 502


@app.route("/symbol_info", methods=["POST"])
def symbol_info_route():
    guard = _check_secret()
    if guard:
        return guard
    data   = request.json or {}
    login  = str(data.get("login", "")).strip()
    server = str(data.get("server", "")).strip()
    symbol = str(data.get("symbol", "")).strip()

    # Si un compte précis est fourni, on interroge son worker.
    w = _get_worker(login, server) if login and server else None
    if not w:
        # Sinon, on prend n'importe quel worker connecté (les symboles broker sont communs).
        with _lock:
            w = next(iter(_workers.values()), None)
    if not w:
        return jsonify({"ok": False, "message": "Aucun compte connecté pour résoudre le symbole."}), 404
    try:
        res = _worker_post(w["port"], "/symbol_info", {"symbol": symbol}, timeout=8.0)
        return jsonify(res.json()), res.status_code
    except Exception as exc:
        return jsonify({"ok": False, "message": f"Worker injoignable: {exc}"}), 502


@app.route("/disconnect", methods=["POST"])
def disconnect():
    guard = _check_secret()
    if guard:
        return guard
    data   = request.json or {}
    login  = str(data.get("login", "")).strip()
    server = str(data.get("server", "")).strip()
    _kill_worker(login, server)
    return jsonify({"ok": True})


# ── Contrôle du moteur de copie ──────────────────────────────────────────────────
@app.route("/copy/status", methods=["GET"])
def copy_status():
    guard = _check_secret()
    if guard:
        return guard
    return jsonify({"ok": True, **copy_engine.status()})


@app.route("/copy/config", methods=["POST"])
def copy_config():
    """
    Met à jour la configuration du moteur de copie (à chaud).
    Body (tous optionnels) :
      {enabled, master_login, master_server, mode, multiplier,
       copy_sltp, min_volume, max_volume, magic, poll_interval, slave_overrides}
    """
    guard = _check_secret()
    if guard:
        return guard
    patch = request.json or {}
    copy_cfg.update(patch)
    log.info("Config copie mise à jour: enabled=%s master=%s mode=%s x%.2f",
             copy_cfg.enabled, copy_cfg.master_login, copy_cfg.mode, copy_cfg.multiplier)
    return jsonify({"ok": True, **copy_engine.status()})


@app.route("/copy/enable", methods=["POST"])
def copy_enable():
    guard = _check_secret()
    if guard:
        return guard
    data = request.json or {}
    # Permet de définir le maître au moment de l'activation
    if data.get("master_login"):
        copy_cfg.master_login = str(data["master_login"]).strip()
    if data.get("master_server"):
        copy_cfg.master_server = str(data["master_server"]).strip()
    copy_cfg.enabled = True
    log.info("Copie ACTIVÉE (maître %s@%s)", copy_cfg.master_login, copy_cfg.master_server)
    return jsonify({"ok": True, **copy_engine.status()})


@app.route("/copy/disable", methods=["POST"])
def copy_disable():
    guard = _check_secret()
    if guard:
        return guard
    copy_cfg.enabled = False
    log.info("Copie DÉSACTIVÉE.")
    return jsonify({"ok": True, **copy_engine.status()})


# ── Surveillance des workers morts ─────────────────────────────────────────────
def _reaper():
    """Nettoie le registre des workers dont le processus s'est arrêté."""
    while True:
        time.sleep(20)
        dead = []
        with _lock:
            for key, w in list(_workers.items()):
                if w["proc"].poll() is not None:  # processus terminé
                    dead.append(key)
            for key in dead:
                _workers.pop(key, None)
        for key in dead:
            log.warning("Worker mort détecté et retiré du registre: %s", key)


# ── Arrêt propre : on tue tous les workers ──────────────────────────────────────
def _shutdown_all():
    with _lock:
        items = list(_workers.values())
    for w in items:
        _kill_worker(w["login"], w["server"])


if __name__ == "__main__":
    log.info("=" * 60)
    log.info("ANCIENFX MT5 Bridge (MANAGER multi-terminal) — port %d", BRIDGE_PORT)
    log.info("MT5 disponible : %s", MT5_AVAILABLE)
    log.info("Instances dir  : %s", provision.INSTANCES_DIR)
    log.info("Terminal base  : %s", provision.BASE_TERMINAL)
    log.info("Max workers    : %d", MAX_WORKERS)
    if BRIDGE_SECRET:
        log.info("Sécurité : X-Bridge-Secret activé")
    log.info("Copie : enabled=%s  maître=%s@%s  mode=%s",
             copy_cfg.enabled, copy_cfg.master_login or "(non défini)",
             copy_cfg.master_server or "-", copy_cfg.mode)
    log.info("=" * 60)

    threading.Thread(target=_reaper, daemon=True).start()
    copy_engine.start()

    try:
        app.run(host="127.0.0.1", port=BRIDGE_PORT, debug=False, threaded=True)
    finally:
        log.info("Arrêt du manager — fermeture de tous les workers...")
        _shutdown_all()
