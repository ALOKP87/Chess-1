# Royal Chess 3D - APK Build Instructions

## Prerequisites

Install required tools in Termux:

```bash
pkg update && pkg upgrade
pkg install nodejs openjdk-17 git
export JAVA_HOME=$PREFIX/lib/jvm/java-17-openjdk
echo 'export JAVA_HOME=$PREFIX/lib/jvm/java-17-openjdk' >> ~/.bashrc
```

## Quick Build (Automated)

```bash
cd /storage/emulated/0/Venter/HopWeb/Projects/chess
chmod +x build-apk.sh
./build-apk.sh
```

## Manual Build (Step by Step)

### Step 1: Install dependencies
```bash
cd /storage/emulated/0/Venter/HopWeb/Projects/chess
npm install --legacy-peer-deps
```

### Step 2: Initialize Capacitor
```bash
npx cap init "Royal Chess 3D" com.pitd.chess.test1 --web-dir .
```

### Step 3: Add Android platform
```bash
npx cap add android
```

### Step 4: Sync web to Android
```bash
npx cap sync android
```

### Step 5: Build Debug APK
```bash
cd android
chmod +x gradlew
./gradlew assembleDebug
```

### Step 6: Copy APK
```bash
cp app/build/outputs/apk/debug/app-debug.apk ../chess-debug.apk
```

## APK Location

After build:
- Debug APK: `/storage/emulated/0/Venter/HopWeb/Projects/chess/chess-debug.apk`

## Install on Device

```bash
adb install chess-debug.apk
```

Or copy `chess-debug.apk` to your phone and install directly.

## Project Info

- Package: `com.pitd.chess.test1`
- Version: `1.0.1`
- Developer: Prince InfoTech Dhule
- Email: princeit.dh@gmail.com
- Graphics: FM Graphics (@fmgr.aphics)
