# ANCIENFX — MT5 Bridge (multi-terminal)

Moteur Python qui permet à l'application Next.js de piloter **plusieurs comptes MetaTrader 5 connectés SIMULTANÉMENT** via HTTP.

---

## Le problème résolu

La librairie Python `MetaTrader5` ne peut piloter **qu'un seul terminal par processus**, et un terminal MT5 n'est connecté qu'à **un seul compte à la fois**. Pour connecter 20+ comptes en même temps (master + slaves), il faut donc :

- **1 processus Python par compte** (`worker.py`)
- **1 instance portable du terminal MT5 par compte** (copiée par `provision.py`)
- **1 manager** (`bridge.py`) qui orchestre tout et expose une API HTTP unique

```
[Next.js / Vercel]
        │  HTTP (MT5_BRIDGE_URL)
        ▼
[bridge.py — MANAGER, port 8765]
        │  spawn / proxy / kill
   ┌────┼──────────────┐
   ▼    ▼              ▼
worker worker   ...   worker            (jusqu'à MAX_WORKERS)
login A login B       login N
term. A term. B       term. N           (instances MT5 séparées, portable)
:9101   :9102         :91xx
```

Chaque compte a **son** processus + **son** terminal → **tous connectés en même temps**, aucun conflit.

---

## Composants

| Fichier | Rôle |
|---|---|
| `bridge.py` | **Manager**. Point d'entrée HTTP unique appelé par Next.js. Lance/arrête/proxy les workers. |
| `worker.py` | **1 worker = 1 processus = 1 terminal = 1 compte.** Parle directement à MetaTrader5. |
| `provision.py` | Crée une copie portable dédiée du terminal MT5 pour chaque compte. |
| `start.bat` | Lanceur VPS : installe les dépendances puis démarre le manager. |

---

## Pré-requis

| Logiciel | Note |
|---|---|
| Windows 10/11 ou Windows Server | Requis par MetaTrader5 |
| MetaTrader 5 Terminal installé | `C:\Program Files\MetaTrader 5\terminal64.exe` (source à copier) |
| Python 3.10+ | Votre VPS : `C:\Python314\python.exe` |
| Espace disque | ~40–80 Mo par compte (copie légère du terminal) |

> **Pas besoin d'ouvrir MT5 à la main.** Le manager lance une instance dédiée par compte automatiquement.

---

## Démarrage (une seule fois par session VPS)

**Double-cliquez sur `start.bat`** dans le dossier `mt5_bridge/`.

Le script installe les dépendances Python puis démarre le manager sur le port 8765. Gardez la fenêtre ouverte.

Quand un compte se connecte depuis l'interface ANCIENFX :
1. Le manager copie le terminal MT5 dans `C:\ancienfx_mt5\<login>\` (première fois seulement).
2. Il lance un worker qui ouvre cette instance en mode `/portable` et se connecte au compte.
3. Le compte reste connecté tant que le worker tourne — en parallèle de tous les autres.

---

## Variables d'environnement

### Côté Next.js / Vercel

```env
MT5_BRIDGE_URL=http://127.0.0.1:8765
BRIDGE_SECRET=votre_secret_ici      # optionnel mais recommandé si exposé
```

### Côté manager (définies dans `start.bat`, ajustables)

```env
BRIDGE_PORT=8765
MT5_BASE_TERMINAL=C:\Program Files\MetaTrader 5\terminal64.exe
MT5_INSTANCES_DIR=C:\ancienfx_mt5
MAX_WORKERS=40
WORKER_PORT_BASE=9101
PYTHON_EXE=C:\Python314\python.exe
```

---

## Exposition via tunnel (si Next.js est sur Vercel et le VPS distant)

**Cloudflare Tunnel (gratuit) :**

```bat
winget install Cloudflare.cloudflared
cloudflared tunnel --url http://127.0.0.1:8765
```

Mettez l'URL `https://xxxx.trycloudflare.com` fournie dans `MT5_BRIDGE_URL`, et **activez `BRIDGE_SECRET`**.

---

## Routes exposées par le manager

| Méthode | Route | Description |
|---|---|---|
| GET | `/health` | Statut + liste des workers actifs |
| GET | `/accounts` | Tous les comptes connectés avec leur snapshot |
| POST | `/connect` | Connexion d'un compte (`login`, `password`, `server`) → lance un worker |
| POST | `/sync` | Rafraîchit les données d'un compte (`login`, `server`) |
| POST | `/disconnect` | Arrête le worker du compte (`login`, `server`) |
| POST | `/positions` | Positions ouvertes (`login`, `server`) |
| POST | `/history` | Historique (`login`, `server`, `days`) |
| POST | `/symbol_info` | Résolution de symbole (`symbol`, + `login`/`server` optionnels) |

Le contrat HTTP est **identique** à la version mono-terminal : le code Next.js (`lib/mt5/service.ts`) n'a pas à changer.

---

## Résolution automatique des symboles

Suffixes broker (`EURUSDm`, `EURUSD.a`, etc.) résolus automatiquement par chaque worker selon son propre broker.

---

## Dépannage

| Problème | Solution |
|---|---|
| `Provisioning échoué` | Vérifiez `MT5_BASE_TERMINAL` (chemin du terminal source) |
| Worker non prêt (timeout) | Mauvais mot de passe/serveur, ou 1er lancement lent → augmentez `WORKER_BOOT_TIMEOUT` |
| `Limite de N comptes atteinte` | Augmentez `MAX_WORKERS` dans `start.bat` |
| `ModuleNotFoundError: requests` | Relancez `start.bat` (installe les dépendances) |
| Disque plein | Chaque compte = une copie du terminal. Supprimez les instances inutilisées dans `C:\ancienfx_mt5\` |
| Compte connecté mais infos illisibles | Le broker rejette la lecture → vérifiez que le compte est actif chez le broker |

---

## Compte maître (référence)

```
Login  : 436507179
Server : Exness-MT5Trial9
```

> Le mot de passe n'est jamais stocké dans ce dépôt — il est saisi depuis l'interface ANCIENFX et transmis au worker à la volée.
