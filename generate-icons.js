#!/usr/bin/env node
// ============================================
// Generate app icons from SVG
// Run: node generate-icons.js
// ============================================

const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const sizes = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
  'web': 512
};

const svgPath = path.join(__dirname, 'icon.svg');
const resDir = path.join(__dirname, 'android', 'app', 'src', 'main', 'res');

console.log('Royal Chess 3D - Icon Generator');
console.log('================================\n');

// Check for sharp (fast) or canvas (fallback)
let converter = null;

try {
  require.resolve('sharp');
  converter = 'sharp';
  console.log('Using: sharp');
} catch(e) {
  try {
    require.resolve('@napi-rs/canvas');
    converter = 'canvas';
    console.log('Using: @napi-rs/canvas');
  } catch(e2) {
    try {
      require.resolve('canvas');
      converter = 'canvas-legacy';
      console.log('Using: canvas');
    } catch(e3) {
      converter = 'svgexport';
      console.log('Using: svgexport (npm)');
    }
  }
}

async function generateWithSharp() {
  const sharp = require('sharp');
  const svgBuf = fs.readFileSync(svgPath);

  for (const [folder, size] of Object.entries(sizes)) {
    const outDir = folder === 'web' ? __dirname : path.join(resDir, folder);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    // ic_launcher.png
    await sharp(svgBuf).resize(size, size).png().toFile(path.join(outDir, 'ic_launcher.png'));
    // ic_launcher_round.png
    await sharp(svgBuf).resize(size, size).png().toFile(path.join(outDir, 'ic_launcher_round.png'));

    console.log(`  ${folder}: ${size}x${size} - done`);
  }

  // Also generate favicon
  await sharp(svgBuf).resize(192, 192).png().toFile(path.join(__dirname, 'favicon.png'));
  console.log('  favicon.png: 192x192 - done');
}

async function generateWithCanvas() {
  let createCanvas;
  try {
    ({ createCanvas } = require('@napi-rs/canvas'));
  } catch(e) {
    ({ createCanvas } = require('canvas'));
  }

  const { loadImage } = require('canvas') || require('@napi-rs/canvas');
  const { Resvg } = require('@resvg/resvg-js');

  const svgStr = fs.readFileSync(svgPath, 'utf-8');

  for (const [folder, size] of Object.entries(sizes)) {
    const outDir = folder === 'web' ? __dirname : path.join(resDir, folder);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const resvg = new Resvg(svgStr, { fitTo: { mode: 'width', value: size } });
    const pngData = resvg.render();
    const pngBuf = pngData.asPng();

    fs.writeFileSync(path.join(outDir, 'ic_launcher.png'), pngBuf);
    fs.writeFileSync(path.join(outDir, 'ic_launcher_round.png'), pngBuf);

    console.log(`  ${folder}: ${size}x${size} - done`);
  }

  const resvg = new Resvg(svgStr, { fitTo: { mode: 'width', value: 192 } });
  fs.writeFileSync(path.join(__dirname, 'favicon.png'), resvg.render().asPng());
  console.log('  favicon.png: 192x192 - done');
}

function generateWithSvgExport() {
  try {
    execSync('npm ls -g svgexport 2>/dev/null || npm install -g svgexport', { stdio: 'pipe' });
  } catch(e) {}

  for (const [folder, size] of Object.entries(sizes)) {
    const outDir = folder === 'web' ? __dirname : path.join(resDir, folder);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const outPath = path.join(outDir, 'ic_launcher.png');
    try {
      execSync(`svgexport "${svgPath}" "${outPath}" png ${size}:${size}`, { stdio: 'pipe' });
      fs.copyFileSync(outPath, path.join(outDir, 'ic_launcher_round.png'));
      console.log(`  ${folder}: ${size}x${size} - done`);
    } catch(e) {
      console.log(`  ${folder}: FAILED - ${e.message}`);
    }
  }

  try {
    execSync(`svgexport "${svgPath}" "${path.join(__dirname, 'favicon.png')}" png 192:192`, { stdio: 'pipe' });
    console.log('  favicon.png: 192x192 - done');
  } catch(e) {
    console.log('  favicon.png: FAILED');
  }
}

async function main() {
  try {
    switch(converter) {
      case 'sharp': await generateWithSharp(); break;
      case 'canvas':
      case 'canvas-legacy': await generateWithCanvas(); break;
      default: generateWithSvgExport();
    }
    console.log('\nAll icons generated successfully!');
    console.log('favicon.png is in the project root.');
  } catch(e) {
    console.error('Error:', e.message);
    console.log('\nFallback: Install sharp for reliable icon generation:');
    console.log('  npm install sharp');
    console.log('  node generate-icons.js');
  }
}

main();
