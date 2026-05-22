#!/bin/bash
# ============================================
# Royal Chess 3D - APK Build Script
# Prince InfoTech Dhule | v1.0.1
# ============================================

set -e

echo "============================================"
echo "  Royal Chess 3D - APK Builder"
echo "  Prince InfoTech Dhule"
echo "============================================"
echo ""

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

# Step 1: Check dependencies
echo "[1/8] Checking dependencies..."
command -v node >/dev/null 2>&1 || { echo "ERROR: Node.js not found. Install: pkg install nodejs"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "ERROR: npm not found."; exit 1; }

NODE_VER=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VER" -lt 16 ]; then
    echo "ERROR: Node.js 16+ required (found v$NODE_VER)"
    exit 1
fi
echo "  Node.js $(node -v) - OK"
echo "  npm $(npm -v) - OK"

# Step 2: Install npm dependencies
echo ""
echo "[2/8] Installing npm dependencies..."
npm install --legacy-peer-deps 2>&1 | tail -5
echo "  Dependencies installed."

# Step 3: Initialize Capacitor (if not already)
echo ""
echo "[3/8] Initializing Capacitor..."
if [ ! -f "capacitor.config.json" ]; then
    npx cap init "Royal Chess 3D" com.pitd.chess.test1 --web-dir . 2>&1
fi
echo "  Capacitor config ready."

# Step 4: Add Android platform
echo ""
echo "[4/8] Adding Android platform..."
if [ ! -d "android/app" ]; then
    npx cap add android 2>&1
else
    echo "  Android platform already exists, skipping."
fi

# Step 5: Copy custom Android files (overwrite Capacitor defaults)
echo ""
echo "[5/8] Applying custom Android configuration..."

# Copy custom manifest if exists
if [ -f "android/app/src/main/AndroidManifest.xml" ]; then
    echo "  Custom AndroidManifest.xml preserved."
fi

# Step 6: Sync web assets to Android
echo ""
echo "[6/8] Syncing web assets to Android..."
npx cap sync android 2>&1 | tail -10
echo "  Sync complete."

# Step 7: Generate app icon (create a simple one if missing)
echo ""
echo "[7/8] Preparing app icons..."
ICON_DIR="android/app/src/main/res"
if ! ls "$ICON_DIR"/mipmap-*/ic_launcher.png >/dev/null 2>&1; then
    echo "  Generating app icon from SVG..."
    # Use node canvas or ImageMagick if available
    if command -v convert >/dev/null 2>&1; then
        for size in 48 72 96 144 192; do
            density="mipmap"
            case $size in
                48)  folder="mdpi";;
                72)  folder="hdpi";;
                96)  folder="xhdpi";;
                144) folder="xxhdpi";;
                192) folder="xxxhdpi";;
            esac
            convert -background "#0f0f1a" -fill "#d4a843" -gravity center \
                -size "${size}x${size}" \
                -font Helvetica -pointsize $((size/3)) \
                label:"♔" \
                "$ICON_DIR/mipmap-$folder/ic_launcher.png" 2>/dev/null || true
            cp "$ICON_DIR/mipmap-$folder/ic_launcher.png" \
               "$ICON_DIR/mipmap-$folder/ic_launcher_round.png" 2>/dev/null || true
        done
        echo "  Icons generated."
    else
        echo "  WARNING: ImageMagick not found. Using default icons."
        echo "  Install with: pkg install imagemagick"
    fi
else
    echo "  App icons already exist."
fi

# Step 8: Build APK
echo ""
echo "[8/8] Building APK..."
cd android

# Check for JAVA_HOME
if [ -z "$JAVA_HOME" ]; then
    # Try common locations
    for p in /data/data/com.termux/files/usr/lib/jvm/java-17-openjdk \
             /data/data/com.termux/files/usr/lib/jvm/java-11-openjdk \
             $PREFIX/lib/jvm/java-17-openjdk \
             $PREFIX/lib/jvm/java-11-openjdk; do
        if [ -d "$p" ]; then
            export JAVA_HOME="$p"
            break
        fi
    done
fi

if [ -z "$JAVA_HOME" ]; then
    echo "  WARNING: JAVA_HOME not set."
    echo "  Install JDK: pkg install openjdk-17"
    echo "  Then: export JAVA_HOME=\$PREFIX/lib/jvm/java-17-openjdk"
    exit 1
fi

echo "  JAVA_HOME=$JAVA_HOME"

# Build debug APK
echo "  Building debug APK..."
./gradlew assembleDebug 2>&1 | tail -20

APK_PATH="app/build/outputs/apk/debug/app-debug.apk"
if [ -f "$APK_PATH" ]; then
    cp "$APK_PATH" "$PROJECT_DIR/chess-debug.apk"
    echo ""
    echo "============================================"
    echo "  BUILD SUCCESSFUL!"
    echo "============================================"
    echo "  Debug APK: $PROJECT_DIR/chess-debug.apk"
    echo "  Package: com.pitd.chess.test1"
    echo "  Version: 1.0.1"
    echo ""
    echo "  To install on device:"
    echo "    adb install chess-debug.apk"
    echo "  Or transfer the APK to your phone."
    echo "============================================"
else
    echo ""
    echo "ERROR: APK not found at $APK_PATH"
    echo "Check build logs above for errors."
    exit 1
fi
