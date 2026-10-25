#!/usr/bin/env bash
# Builds in WSL with the Connect IQ SDK installed on Windows; `run` also starts the Windows simulator.
# Reads WORKER_URL from watch/.env.
set -euo pipefail
cd "$(dirname "$0")"

WIN=/mnt/c/Windows/System32
win() { (cd /mnt/c && "$WIN/cmd.exe" /c "$@" 2>/dev/null | tr -d '\r'); }

DEVICE="${DEVICE:-fr165}"
KEY="${CIQ_KEY:-$HOME/.config/garmin/developer_key.der}"
CIQ_HOME="$(wslpath "$(win echo %APPDATA%)")/Garmin/ConnectIQ"
SDK="$(wslpath "$(tr -d '\r' < "$CIQ_HOME/current-sdk.cfg")")/bin"
JAVA="$(wslpath "$(win where java | head -1)")"
PRG=bin/train-status.prg
URL_PATTERN='^https://[^<>&"]+$'

[[ -f .env ]] && source .env
: "${WORKER_URL:?set WORKER_URL in watch/.env (see .env.example)}"
[[ "$WORKER_URL" =~ $URL_PATTERN ]] || { echo "WORKER_URL must be an https:// URL" >&2; exit 1; }

mkdir -p bin/env
cat > bin/env/env.xml <<XML
<strings>
    <string id="WorkerUrl" scope="background" translatable="false">$WORKER_URL</string>
</strings>
XML

"$JAVA" -Dfile.encoding=UTF-8 -jar "$(wslpath -w "$SDK/monkeybrains.jar")" \
  -f "$(wslpath -w monkey.jungle)" -d "$DEVICE" -o "$(wslpath -w "$PRG")" -y "$(wslpath -w "$KEY")" -l 3 -w \
  | tr -d '\r'

if [[ "${1:-}" == "run" ]]; then
  if ! win tasklist /FI "IMAGENAME eq simulator.exe" | grep -qi simulator.exe; then
    (cd /mnt/c && "$WIN/WindowsPowerShell/v1.0/powershell.exe" -NoProfile -Command "Start-Process '$(wslpath -w "$SDK/simulator.exe")'")
    sleep 5
  fi
  win "$(wslpath -w "$SDK/monkeydo.bat")" "$(wslpath -w "$PRG")" "$DEVICE"
fi
