r"""
ANCIENFX - Provisioning des instances MT5
=========================================
Crée une copie PORTABLE dédiée du terminal MT5 pour chaque compte.

Pourquoi ?
  Windows interdit de lancer plusieurs instances portable depuis le même
  dossier (Program Files, protégé en écriture + données partagées).
  Pour connecter N comptes simultanément, chaque worker doit avoir SA propre
  copie du terminal, dans son propre dossier, lancée avec /portable.

Chaque instance vit dans :  <INSTANCES_DIR>\<login>\
avec son terminal64.exe et son propre dossier de données MQL5/config.

Ce module est utilisé par bridge.py — pas besoin de le lancer à la main.
"""

import os
import shutil
import logging
from pathlib import Path

log = logging.getLogger("mt5-provision")

# Dossier source du terminal MT5 installé (configurable via .env)
BASE_TERMINAL = os.environ.get(
    "MT5_BASE_TERMINAL",
    r"C:\Program Files\MetaTrader 5\terminal64.exe",
)

# Dossier racine où sont créées les instances par compte
INSTANCES_DIR = os.environ.get("MT5_INSTANCES_DIR", r"C:\ancienfx_mt5")

# Dossiers/fichiers volumineux inutiles à copier (logs, historiques, bases)
_SKIP = {"logs", "Bases", "history", "MQL5\\Logs", "Tester"}


def _base_dir() -> Path:
    """Dossier d'installation MT5 (parent de terminal64.exe)."""
    return Path(BASE_TERMINAL).parent


def instance_terminal_path(login: str) -> Path:
    """Chemin du terminal64.exe de l'instance dédiée à ce compte."""
    return Path(INSTANCES_DIR) / str(login) / "terminal64.exe"


def _ignore_heavy(dirpath, names):
    """Filtre shutil.copytree : ignore les dossiers volumineux inutiles."""
    ignored = set()
    for name in names:
        rel = os.path.relpath(os.path.join(dirpath, name), _base_dir())
        for skip in _SKIP:
            if rel == skip or rel.startswith(skip + os.sep):
                ignored.add(name)
    return ignored


def ensure_instance(login: str) -> str:
    """
    S'assure qu'une instance portable du terminal existe pour ce compte.
    Retourne le chemin absolu de terminal64.exe de l'instance.
    Idempotent : ne recopie pas si l'instance existe déjà.
    """
    base = _base_dir()
    if not base.exists():
        raise FileNotFoundError(
            f"Terminal MT5 introuvable: {BASE_TERMINAL}. "
            f"Définissez MT5_BASE_TERMINAL dans .env si le chemin diffère."
        )

    target = Path(INSTANCES_DIR) / str(login)
    target_exe = target / "terminal64.exe"

    if target_exe.exists():
        log.info("Instance déjà présente pour %s → %s", login, target_exe)
        return str(target_exe)

    log.info("Création de l'instance MT5 pour %s (copie de %s)...", login, base)
    target.parent.mkdir(parents=True, exist_ok=True)

    # Copie de l'installation (sans les dossiers volumineux)
    shutil.copytree(base, target, ignore=_ignore_heavy, dirs_exist_ok=True)

    if not target_exe.exists():
        raise RuntimeError(f"Copie terminée mais terminal64.exe manquant dans {target}")

    log.info("Instance prête pour %s → %s", login, target_exe)
    return str(target_exe)


def remove_instance(login: str) -> bool:
    """
    Supprime l'instance d'un compte (libère l'espace disque).
    À n'appeler que si le worker est arrêté.
    """
    target = Path(INSTANCES_DIR) / str(login)
    if target.exists():
        try:
            shutil.rmtree(target, ignore_errors=True)
            log.info("Instance supprimée pour %s", login)
            return True
        except Exception as exc:
            log.warning("Suppression instance %s échouée: %s", login, exc)
            return False
    return False
