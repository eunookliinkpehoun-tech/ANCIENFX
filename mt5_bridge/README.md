# ANCIENFX — MT5 Bridge

Serveur Python léger qui permet à l'application Next.js de communiquer avec MetaTrader 5 via HTTP.

---

## Architecture

```
[Next.js / Vercel]  --HTTP-->  [MT5 Bridge (Flask, port 8765)]  --IPC-->  [MT5 Terminal]
```

- Le bridge tourne **uniquement sur le VPS Windows** où MT5 est installé.
- Next.js l'appelle via la variable d'environnement `MT5_BRIDGE_URL`.
- **Aucun chemin hardcodé** : `mt5.initialize()` s'attache au terminal déjà ouvert.

---

## Pré-requis

| Logiciel | Version minimale | Note |
|---|---|---|
| Windows 10/11 ou Windows Server | — | Requis par MetaTrader5 |
| MetaTrader 5 Terminal | Dernière version stable | Doit être ouvert avant le bridge |
| Python | 3.10+ (`C:\Python314\python.exe`) | Votre VPS : déjà installé |
| Packages Python | Flask, MetaTrader5 | Installés automatiquement par `start.bat` |

---

## Démarrage (une seule fois par session VPS)

**1. Ouvrez MetaTrader 5** (ou laissez `start.bat` le faire automatiquement).

**2. Double-cliquez sur `start.bat`** dans le dossier `mt5_bridge/`.

C'est tout. Le bridge se lance, attend les connexions de Next.js.

> Ne fermez **pas** la fenêtre du terminal — elle doit rester ouverte.

---

## Variables d'environnement (côté Next.js / Vercel)

```env
# URL du bridge (adapter si le VPS est distant via tunnel)
MT5_BRIDGE_URL=http://127.0.0.1:8765

# Optionnel : secret partagé pour sécuriser le bridge
BRIDGE_SECRET=votre_secret_ici
```

---

## Exposition via tunnel (si le VPS est distant)

Si Next.js est déployé sur Vercel et le VPS est une machine Windows distante, le bridge doit être exposé publiquement.

**Option recommandée : Cloudflare Tunnel (gratuit)**

```bat
REM Installer cloudflared
winget install Cloudflare.cloudflared

REM Lancer le tunnel
cloudflared tunnel --url http://127.0.0.1:8765
```

Cloudflare vous donnera une URL `https://xxxx.trycloudflare.com` à mettre dans `MT5_BRIDGE_URL`.

**Autres options :** ngrok, Tailscale, VPN site-to-site.

---

## Routes disponibles

| Méthode | Route | Description |
|---|---|---|
| GET | `/health` | Statut du bridge et du terminal MT5 |
| POST | `/connect` | Connexion d'un compte (`login`, `password`, `server`) |
| POST | `/sync` | Rafraîchissement des données d'un compte (`login`, `server`) |
| POST | `/disconnect` | Suppression de la session (`login`, `server`) |
| POST | `/positions` | Positions ouvertes (`login`, `server`) |
| POST | `/history` | Historique des trades (`login`, `server`, `days`) |
| POST | `/symbol_info` | Info + résolution automatique d'un symbole (`symbol`) |

---

## Résolution automatique des symboles

Si votre broker utilise des suffixes (`EURUSDm`, `EURUSD.a`, etc.), le bridge les résout automatiquement via l'endpoint `/symbol_info`.

---

## Sécurité

- Le bridge écoute uniquement sur `127.0.0.1` (loopback) par défaut.
- Activez `BRIDGE_SECRET` pour ajouter une authentification par header `X-Bridge-Secret`.
- Si vous exposez le bridge via tunnel, **activez impérativement** `BRIDGE_SECRET`.

---

## Dépannage

| Problème | Solution |
|---|---|
| `mt5.initialize()` échoue | Vérifiez que MetaTrader 5 est bien ouvert |
| `mt5.login()` retourne code -6 | Mauvais mot de passe ou serveur broker incorrect |
| Port 8765 occupé | Changez `BRIDGE_PORT` dans `start.bat` |
| `ModuleNotFoundError: MetaTrader5` | Relancez `start.bat` (installe les dépendances) |

---

## Compte maître (référence)

```
Login  : 436507179
Server : Exness-MT5Trial9
```

> Le mot de passe n'est jamais stocké dans ce fichier — il est saisi depuis l'interface ANCIENFX.
