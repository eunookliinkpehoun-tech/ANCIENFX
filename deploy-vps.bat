@echo off
REM ============================================================
REM  ANCIENFX - Deploiement tout-en-un sur le VPS Windows
REM  Lance : install deps -> migrations DB -> build -> start
REM  Prerequis : Node.js + pnpm + MySQL installes sur le VPS
REM ============================================================
setlocal
cd /d "%~dp0"

echo(
echo ============================================================
echo   ANCIENFX - Deploiement VPS
echo ============================================================
echo(

REM --- 1. Verifier pnpm ---
where pnpm >nul 2>nul
if errorlevel 1 (
  echo [ERREUR] pnpm introuvable. Installe-le avec :  npm install -g pnpm
  pause
  exit /b 1
)

REM --- 2. Verifier le .env ---
if not exist ".env" (
  echo [ERREUR] Fichier .env manquant. Cree-le avec DB_HOST, DB_PORT, DB_NAME,
  echo          DB_USER, DB_PASS, SECRET_KEY et MT5_BRIDGE_URL.
  pause
  exit /b 1
)

REM --- 3. Installer les dependances ---
echo [1/4] Installation des dependances...
call pnpm install --frozen-lockfile
if errorlevel 1 (
  echo [ERREUR] pnpm install a echoue.
  pause
  exit /b 1
)

REM --- 4. Migrations base de donnees ---
echo(
echo [2/4] Application des migrations MySQL...
call pnpm migrate
if errorlevel 1 (
  echo [ERREUR] Les migrations ont echoue. Verifie que MySQL tourne et que les
  echo          identifiants du .env sont corrects.
  pause
  exit /b 1
)

REM --- 5. Build production ---
echo(
echo [3/4] Build de l'application Next.js...
call pnpm build
if errorlevel 1 (
  echo [ERREUR] Le build a echoue.
  pause
  exit /b 1
)

REM --- 6. Demarrage ---
echo(
echo [4/4] Demarrage du serveur sur http://0.0.0.0:3000 ...
echo   (Laisse cette fenetre ouverte. Ctrl+C pour arreter.)
echo(
set PORT=3000
call pnpm start -H 0.0.0.0 -p 3000

endlocal
