#!/usr/bin/env bash
set -e

# Make the Firestore emulator's JVM discoverable on macOS Homebrew installs.
# No-op on systems where java is already on PATH.
if [ -d "/opt/homebrew/opt/openjdk@21/bin" ]; then
  export PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH"
fi

DATA_DIR="./.sandbox-data"
mkdir -p "$DATA_DIR"

# Only --import if we have a previous export, otherwise firebase errors out.
IMPORT_FLAG=""
if [ -f "$DATA_DIR/firebase-export-metadata.json" ]; then
  IMPORT_FLAG="--import=$DATA_DIR"
fi

EMULATOR_CMD="firebase emulators:start --only auth,firestore --export-on-exit=$DATA_DIR $IMPORT_FLAG"
APP_CMD="wait-on tcp:8080 && npm run seed && SANDBOX_MODE=true USE_EMULATOR=true NEXT_PUBLIC_USE_EMULATOR=true next dev"

exec npx concurrently -k -n emu,app -c blue,green "$EMULATOR_CMD" "$APP_CMD"
