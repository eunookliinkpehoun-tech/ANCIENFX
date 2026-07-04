@echo off
REM ============================================================
REM  ANCIENFX - Lanceur du bridge MT5
REM  A executer UNE SEULE FOIS sur le VPS Windows.
REM ============================================================

setlocal

REM -- Python sur ce VPS
set PYTHON=C:\Python314\python.exe

REM -- Repertoire du bridge (ajuster si necessaire)
set BRIDGE_DIR=%~dp0

REM -- Port d'ecoute local du bridge (doit correspondre a MT5_BRIDGE_URL dans .env)
set BRIDGE_PORT=8765

REM -- Secret optionnel (laisser vide si non utilise)
set BRIDGE_SECRET=

REM ============================================================
REM  ETAPE 1 : Ouvrir MetaTrader 5 (s'il n'est pas deja ouvert)
REM ============================================================
echo [1/3] Verification de MetaTrader 5...
tasklist /fi "imagename eq terminal64.exe" 2>NUL | find /I "terminal64.exe" >NUL
if errorlevel 1 (
    echo [1/3] Demarrage de MetaTrader 5...
    start "" "C:\Program Files\MetaTrader 5\terminal64.exe"
    echo [1/3] Attente 15 secondes pour que MT5 se connecte au broker...
    timeout /t 15 /nobreak >NUL
) else (
    echo [1/3] MetaTrader 5 est deja ouvert.
)

REM ============================================================
REM  ETAPE 2 : Installer les dependances Python (premiere fois)
REM ============================================================
echo [2/3] Installation des dependances Python...
"%PYTHON%" -m pip install -r "%BRIDGE_DIR%requirements.txt" --quiet

REM ============================================================
REM  ETAPE 3 : Demarrer le bridge
REM ============================================================
echo [3/3] Demarrage du bridge MT5 sur le port %BRIDGE_PORT%...
echo.
echo  Bridge URL a definir dans .env :
echo    MT5_BRIDGE_URL=http://127.0.0.1:%BRIDGE_PORT%
echo.
echo  (Gardez cette fenetre ouverte. Ctrl+C pour arreter.)
echo.

set BRIDGE_PORT=%BRIDGE_PORT%
set BRIDGE_SECRET=%BRIDGE_SECRET%
"%PYTHON%" "%BRIDGE_DIR%bridge.py"

pause
