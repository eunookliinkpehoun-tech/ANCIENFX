# ANCIENFX — Mise en ligne sur le VPS Windows

Toute la stack tourne sur **le même VPS Windows** : l'application web (Next.js), la base MySQL et le bridge MT5. C'est le montage le plus simple car MetaTrader 5 est déjà sur ce VPS.

```
┌──────────────────────── VPS Windows ────────────────────────┐
│                                                              │
│   Next.js (port 3000) ──HTTP──► Bridge MT5 (port 8765)       │
│        │                              │                       │
│        │                              ├─ Terminal compte 1    │
│        ▼                              ├─ Terminal compte 2    │
│   MySQL (port 3306)                   └─ Terminal compte N    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## Prérequis (à installer une fois sur le VPS)

| Logiciel | Vérifier | Installer |
|---|---|---|
| Node.js 20+ | `node -v` | https://nodejs.org |
| pnpm | `pnpm -v` | `npm install -g pnpm` |
| MySQL 8 | `mysql --version` | déjà installé ✔ |
| Python 3.11+ | `C:\Python314\python.exe --version` | déjà installé ✔ |
| MetaTrader 5 | — | `C:\Program Files\MetaTrader 5\terminal64.exe` ✔ |

## Fichier `.env` (à la racine du projet)

```env
# Base de données MySQL (locale au VPS)
DB_HOST=localhost
DB_PORT=3306
DB_NAME=xxxxx
DB_USER=xxxxx
DB_PASS=xxxxx

# Clé de signature des sessions (générer une longue chaîne aléatoire)
SECRET_KEY=xxxxx

# Bridge MT5 (local au VPS)
MT5_BRIDGE_URL=http://127.0.0.1:8765
BRIDGE_SECRET=                       # optionnel : un secret partagé bridge<->app
```

> Ces valeurs sont déjà renseignées. `DB_HOST=localhost` est correct car MySQL est sur le VPS.

---

## Démarrage (2 fenêtres)

### Fenêtre 1 — L'application web + base de données

Double-clique sur **`deploy-vps.bat`** (à la racine). Il enchaîne :

1. `pnpm install` — dépendances
2. `pnpm migrate` — crée les tables MySQL (users, mt5_accounts, …)
3. `pnpm build` — build de production
4. `pnpm start` — démarre le serveur sur le port **3000**

L'app est alors accessible localement sur `http://localhost:3000`.

### Fenêtre 2 — Le bridge MT5

Va dans `mt5_bridge\` et double-clique sur **`start.bat`**. Il démarre le manager sur le port **8765**. C'est lui qui lancera un terminal MT5 par compte, automatiquement.

> Aucun terminal MT5 à ouvrir à la main : le bridge s'en charge (voir la question -10005 plus bas).

---

## Rendre le site accessible depuis Internet

Choisis **une** des deux options.

### Option A — Accès direct par IP (rapide)

1. Ouvre le port 3000 dans le pare-feu Windows :
   ```powershell
   New-NetFirewallRule -DisplayName "ANCIENFX Web" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
   ```
2. Le site est joignable sur `http://IP_PUBLIQUE_DU_VPS:3000`.

> Sans HTTPS. Suffisant pour tester, pas idéal en production.

### Option B — Domaine + HTTPS via Cloudflare Tunnel (recommandé)

1. Installe `cloudflared` sur le VPS.
2. Lance un tunnel vers l'app :
   ```bat
   cloudflared tunnel --url http://localhost:3000
   ```
3. Cloudflare te donne une URL publique HTTPS (ou mappe ton domaine).

> N'expose **jamais** le port MySQL (3306) ni le bridge (8765) sur Internet : ils restent en local.

---

## Vérifier que tout marche

1. Ouvre le site → page d'accueil.
2. **Inscription** d'un compte → doit réussir (vérifie la table `users`).
3. **Connexion** → accès au dashboard.
4. Depuis le dashboard, **connecter un compte MT5** → le bridge lance un terminal dédié.
5. Vérifier le bridge : `curl http://127.0.0.1:8765/health`.

---

## Le timeout -10005 (IPC_TIMEOUT) — comment c'est géré

**Cause** : `-10005` = le canal IPC entre Python et le terminal MT5 n'a pas pu s'établir à temps. Ça arrive quand on démarre plusieurs terminaux d'un coup (démarrage à froid trop lent).

**Ce que fait le moteur (aucune action manuelle) :**

- **1 terminal par compte** : `provision.py` copie le terminal dans `C:\ancienfx_mt5\<login>\`. Chaque compte a le sien.
- **Lancement automatique** : `mt5.initialize(path=..., login=..., password=..., server=..., portable=True, timeout=60000)` **démarre le terminal ET se connecte** en un appel. Tu n'ouvres rien à la main.
- **Anti -10005** :
  - `timeout` explicite de 60 s sur l'initialisation (le terminal a le temps de démarrer à froid),
  - **retries avec backoff** si le handshake échoue,
  - **démarrage sérialisé** : les terminaux sont lancés **un par un**, jamais 20 simultanément (c'est ce qui saturait l'IPC).

**Faut-il ouvrir manuellement les terminaux des slaves ?** → **NON.** Maître et slaves suivent exactement le même chemin automatique. Zéro terminal à ouvrir à la main.

---

## Copy trading

Une fois maître + slaves connectés, active la copie (voir `mt5_bridge/README.md` §Copy trading) :

```bat
curl -X POST http://127.0.0.1:8765/copy/enable -H "Content-Type: application/json" ^
  -d "{\"master_login\":\"436507179\",\"master_server\":\"Exness-MT5Trial9\"}"
```

Suivi en direct : `curl http://127.0.0.1:8765/copy/status`.
