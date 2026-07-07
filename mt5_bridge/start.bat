@echo off
REM ============================================================
REM  ANCIENFX - Lanceur du MANAGER MT5 (multi-terminal)
REM  A executer UNE SEULE FOIS sur le VPS Windows.
REM
REM  Le manager lance automatiquement UNE instance de terminal
REM  MT5 par compte connecte (connexion SIMULTANEE de 20+ comptes).
REM  => Inutile d'ouvrir MetaTrader 5 a la main.
REM ============================================================

setlocal

REM -- Python sur ce VPS
set PYTHON=C:\Python314\python.exe

REM -- Repertoire du bridge
set BRIDGE_DIR=%~dp0

REM -- Port d'ecoute local du manager (doit correspondre a MT5_BRIDGE_URL dans .env)
set BRIDGE_PORT=8765

REM -- Secret optionnel (laisser vide si non utilise)
set BRIDGE_SECRET=

REM -- Terminal MT5 installe (source qui sera copiee par compte)
set MT5_BASE_TERMINAL=C:\Program Files\MetaTrader 5\terminal64.exe

REM -- Dossier ou seront creees les instances par compte
set MT5_INSTANCES_DIR=C:\ancienfx_mt5

REM -- Nombre max de comptes simultanes
set MAX_WORKERS=40

REM ============================================================
REM  ETAPE 1 : Installer les dependances Python (premiere fois)
REM ============================================================
echo [1/2] Installation des dependances Python...
"%PYTHON%" -m pip install -r "%BRIDGE_DIR%requirements.txt" --quiet

REM ============================================================
REM  ETAPE 2 : Demarrer le MANAGER
REM ============================================================
echo [2/2] Demarrage du manager MT5 sur le port %BRIDGE_PORT%...
echo.
echo  Bridge URL a definir dans .env :
echo    MT5_BRIDGE_URL=http://127.0.0.1:%BRIDGE_PORT%
echo.
echo  Le manager lancera 1 terminal MT5 par compte connecte.
echo  Instances stockees dans : %MT5_INSTANCES_DIR%
echo.
echo  (Gardez cette fenetre ouverte. Ctrl+C pour arreter.)
echo.

set PYTHON_EXE=%PYTHON%
"%PYTHON%" "%BRIDGE_DIR%bridge.py"

pause
