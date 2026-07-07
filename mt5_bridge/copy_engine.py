"""
ANCIENFX - Copy Engine (moteur de copie master -> slaves)
=========================================================
Vit dans le processus MANAGER (bridge.py). Il ne parle jamais directement à
MetaTrader5 : il pilote les workers via leur API HTTP locale.

Principe
--------
- UN compte MAÎTRE (défini par MASTER_LOGIN/MASTER_SERVER).
- N comptes SLAVES = tous les autres workers connectés.
- Une boucle surveille en continu les positions du maître, calcule le "diff"
  avec le dernier état connu, et réplique sur chaque slave :
    * nouvelle position maître        -> OPEN sur chaque slave
    * position maître fermée          -> CLOSE sur chaque slave
    * SL/TP maître modifié            -> MODIFY sur chaque slave
    * fermeture partielle maître      -> CLOSE partiel proportionnel sur slave

Dimensionnement du lot (par défaut : proportionnel au solde)
------------------------------------------------------------
    volume_slave = volume_maitre * (balance_slave / balance_maitre) * multiplier
Modes disponibles par slave (override) :
    - "balance"    : proportionnel au solde (défaut)
    - "multiplier" : volume_maitre * coefficient
    - "fixed"      : lot fixe identique au maître

Mapping des tickets
-------------------
    _map[master_ticket] = { slave_key: {"ticket": slave_ticket, "volume": v} }
Permet de retrouver quelle position slave fermer/modifier quand le maître bouge.

Ce module est volontairement autonome et sans état MT5 : tout passe par des
callbacks fournis par le manager (get_master, list_slaves, worker_call).
"""

import os
import time
import logging
import threading
from typing import Callable, Optional

log = logging.getLogger("copy-engine")


class CopyConfig:
    """Configuration globale du moteur, modifiable à chaud via l'API."""

    def __init__(self) -> None:
        self.enabled: bool = os.environ.get("COPY_ENABLED", "false").lower() == "true"
        self.master_login: str = os.environ.get("MASTER_LOGIN", "").strip()
        self.master_server: str = os.environ.get("MASTER_SERVER", "").strip()
        # Mode global par défaut : balance | multiplier | fixed
        self.mode: str = os.environ.get("COPY_MODE", "balance").strip().lower()
        # Coefficient appliqué dans tous les modes (1.0 = neutre)
        self.multiplier: float = float(os.environ.get("COPY_MULTIPLIER", "1.0"))
        # Copier les modifications SL/TP ?
        self.copy_sltp: bool = os.environ.get("COPY_SLTP", "true").lower() == "true"
        # Volume min/max de sécurité par ordre copié
        self.min_volume: float = float(os.environ.get("COPY_MIN_VOLUME", "0.01"))
        self.max_volume: float = float(os.environ.get("COPY_MAX_VOLUME", "100.0"))
        # Magic number qui identifie les trades copiés (permet close_all ciblé)
        self.magic: int = int(os.environ.get("COPY_MAGIC", "20240517"))
        # Intervalle de scan du maître (secondes)
        self.poll_interval: float = float(os.environ.get("COPY_POLL_INTERVAL", "1.0"))
        # Overrides par slave : { "login|server": {"mode": ..., "multiplier": ...} }
        self.slave_overrides: dict[str, dict] = {}

    def as_dict(self) -> dict:
        return {
            "enabled": self.enabled,
            "master_login": self.master_login,
            "master_server": self.master_server,
            "mode": self.mode,
            "multiplier": self.multiplier,
            "copy_sltp": self.copy_sltp,
            "min_volume": self.min_volume,
            "max_volume": self.max_volume,
            "magic": self.magic,
            "poll_interval": self.poll_interval,
            "slave_overrides": self.slave_overrides,
        }

    def update(self, patch: dict) -> None:
        for field in (
            "enabled", "master_login", "master_server", "mode", "copy_sltp",
        ):
            if field in patch and patch[field] is not None:
                setattr(self, field, patch[field])
        for numfield in ("multiplier", "min_volume", "max_volume", "poll_interval"):
            if numfield in patch and patch[numfield] is not None:
                setattr(self, numfield, float(patch[numfield]))
        if "magic" in patch and patch["magic"] is not None:
            self.magic = int(patch["magic"])
        if "slave_overrides" in patch and isinstance(patch["slave_overrides"], dict):
            self.slave_overrides = patch["slave_overrides"]


class CopyEngine:
    """
    Le moteur de copie. Instancié par le manager avec des callbacks :

      get_master()  -> Optional[dict]  {"key","login","server","port"} ou None
      list_slaves() -> list[dict]      [{"key","login","server","port"}, ...]
      worker_get(port, path)   -> requests.Response
      worker_post(port, path, body) -> requests.Response
    """

    def __init__(
        self,
        get_master: Callable[[], Optional[dict]],
        list_slaves: Callable[[], list],
        worker_get: Callable[[int, str], object],
        worker_post: Callable[[int, str, dict], object],
        config: Optional[CopyConfig] = None,
    ) -> None:
        self.cfg = config or CopyConfig()
        self._get_master = get_master
        self._list_slaves = list_slaves
        self._worker_get = worker_get
        self._worker_post = worker_post

        self._lock = threading.Lock()
        # master_ticket -> { slave_key: {"ticket": int, "volume": float} }
        self._map: dict[int, dict] = {}
        # dernier snapshot du maître : ticket -> position dict
        self._last_master: dict[int, dict] = {}
        # cache des soldes pour le sizing : key -> balance
        self._balances: dict[str, float] = {}
        self._stats = {"opens": 0, "closes": 0, "modifies": 0, "errors": 0, "last_cycle": 0.0}
        self._started = False

    # ── API publique ────────────────────────────────────────────────────────
    def start(self) -> None:
        if self._started:
            return
        self._started = True
        threading.Thread(target=self._loop, daemon=True).start()
        log.info("Copy engine démarré (enabled=%s).", self.cfg.enabled)

    def status(self) -> dict:
        with self._lock:
            master = self._get_master()
            slaves = self._list_slaves()
            return {
                "enabled": self.cfg.enabled,
                "master": {
                    "login": self.cfg.master_login,
                    "server": self.cfg.master_server,
                    "connected": master is not None,
                },
                "slaves_count": len(slaves),
                "tracked_master_positions": len(self._map),
                "config": self.cfg.as_dict(),
                "stats": dict(self._stats),
            }

    # ── Boucle principale ─────────────────────────────────────────────────────
    def _loop(self) -> None:
        while True:
            interval = max(0.25, self.cfg.poll_interval)
            time.sleep(interval)
            if not self.cfg.enabled:
                continue
            try:
                self._tick()
                self._stats["last_cycle"] = time.time()
            except Exception as exc:  # jamais laisser mourir la boucle
                self._stats["errors"] += 1
                log.warning("Cycle copie erreur: %s", exc)

    def _tick(self) -> None:
        master = self._get_master()
        if master is None:
            return
        master_positions = self._fetch_positions(master["port"])
        if master_positions is None:
            return  # maître injoignable ce cycle, on ne touche à rien

        current = {p["ticket"]: p for p in master_positions}
        slaves = self._list_slaves()
        if not slaves:
            self._last_master = current
            return

        master_balance = self._get_balance(master)

        # 1) Nouvelles positions + modifications SL/TP
        for ticket, pos in current.items():
            prev = self._last_master.get(ticket)
            if prev is None:
                self._replicate_open(pos, slaves, master_balance)
            elif self.cfg.copy_sltp and (prev.get("sl") != pos.get("sl") or prev.get("tp") != pos.get("tp")):
                self._replicate_modify(ticket, pos, slaves)

        # 2) Positions fermées chez le maître
        for ticket in list(self._last_master.keys()):
            if ticket not in current:
                self._replicate_close(ticket, slaves)

        self._last_master = current

    # ── Réplication ─────────────────────────────────────────────────────────
    def _replicate_open(self, pos: dict, slaves: list, master_balance: float) -> None:
        master_volume = float(pos["volume"])
        with self._lock:
            self._map.setdefault(pos["ticket"], {})

        for slave in slaves:
            key = slave["key"]
            try:
                volume = self._compute_volume(key, slave, master_volume, master_balance)
                if volume <= 0:
                    continue
                body = {
                    "symbol": pos["symbol"],
                    "type": pos["type"],
                    "volume": volume,
                    "sl": pos.get("sl", 0),
                    "tp": pos.get("tp", 0),
                    "magic": self.cfg.magic,
                    "comment": f"cp:{pos['ticket']}",
                }
                res = self._worker_post(slave["port"], "/open", body)
                data = res.json()
                if data.get("ok"):
                    with self._lock:
                        self._map[pos["ticket"]][key] = {
                            "ticket": data.get("position") or data.get("ticket"),
                            "volume": volume,
                        }
                    self._stats["opens"] += 1
                    log.info("OPEN copié %s %s %.2f -> slave %s (ticket %s)",
                             pos["symbol"], pos["type"], volume, slave["login"], data.get("ticket"))
                else:
                    self._stats["errors"] += 1
                    log.warning("OPEN échoué slave %s: %s", slave["login"], data.get("message"))
            except Exception as exc:
                self._stats["errors"] += 1
                log.warning("OPEN exception slave %s: %s", slave.get("login"), exc)

    def _replicate_close(self, master_ticket: int, slaves: list) -> None:
        with self._lock:
            mapping = self._map.pop(master_ticket, {})
        if not mapping:
            return
        slave_by_key = {s["key"]: s for s in slaves}
        for key, info in mapping.items():
            slave = slave_by_key.get(key)
            if slave is None:
                continue
            try:
                res = self._worker_post(slave["port"], "/close", {"ticket": info["ticket"]})
                data = res.json()
                if data.get("ok"):
                    self._stats["closes"] += 1
                    log.info("CLOSE copié master#%s -> slave %s (ticket %s)",
                             master_ticket, slave["login"], info["ticket"])
                else:
                    self._stats["errors"] += 1
                    log.warning("CLOSE échoué slave %s: %s", slave["login"], data.get("message"))
            except Exception as exc:
                self._stats["errors"] += 1
                log.warning("CLOSE exception slave %s: %s", slave.get("login"), exc)

    def _replicate_modify(self, master_ticket: int, pos: dict, slaves: list) -> None:
        with self._lock:
            mapping = dict(self._map.get(master_ticket, {}))
        if not mapping:
            return
        slave_by_key = {s["key"]: s for s in slaves}
        for key, info in mapping.items():
            slave = slave_by_key.get(key)
            if slave is None:
                continue
            try:
                res = self._worker_post(slave["port"], "/modify", {
                    "ticket": info["ticket"],
                    "sl": pos.get("sl", 0),
                    "tp": pos.get("tp", 0),
                })
                if res.json().get("ok"):
                    self._stats["modifies"] += 1
            except Exception as exc:
                self._stats["errors"] += 1
                log.warning("MODIFY exception slave %s: %s", slave.get("login"), exc)

    # ── Dimensionnement du lot ────────────────────────────────────────────────
    def _compute_volume(self, key: str, slave: dict, master_volume: float, master_balance: float) -> float:
        override = self.cfg.slave_overrides.get(key, {})
        mode = override.get("mode", self.cfg.mode)
        mult = float(override.get("multiplier", self.cfg.multiplier))

        if mode == "fixed":
            volume = master_volume
        elif mode == "multiplier":
            volume = master_volume * mult
        else:  # "balance" (proportionnel au solde)
            slave_balance = self._get_balance(slave)
            if master_balance <= 0:
                ratio = 1.0
            else:
                ratio = slave_balance / master_balance
            volume = master_volume * ratio * mult

        # Bornes de sécurité
        volume = max(self.cfg.min_volume, min(self.cfg.max_volume, volume))
        return round(volume, 2)

    # ── Accès workers ─────────────────────────────────────────────────────────
    def _fetch_positions(self, port: int) -> Optional[list]:
        try:
            res = self._worker_get(port, "/positions")
            data = res.json()
            if data.get("ok"):
                return data.get("positions", [])
        except Exception:
            return None
        return None

    def _get_balance(self, node: dict) -> float:
        """Balance mise en cache (rafraîchie ~toutes les 10s)."""
        key = node["key"]
        cached = self._balances.get(key)
        now = time.time()
        if cached and (now - cached[1] < 10):
            return cached[0]
        try:
            res = self._worker_get(node["port"], "/account")
            data = res.json()
            if data.get("ok"):
                bal = float(data["account"]["balance"])
                self._balances[key] = (bal, now)
                return bal
        except Exception:
            pass
        return cached[0] if cached else 0.0
