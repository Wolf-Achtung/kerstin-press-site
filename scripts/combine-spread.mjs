/**
 * Combine Spread Script
 * Kombiniert zwei Bilder zu einem Spread (nebeneinander)
 *
 * Usage: node scripts/combine-spread.mjs <left-url> <right-url> <output-name>
 *
 * Beispiel:
 * node scripts/combine-spread.mjs "https://..." "https://..." "uniqlo-spread"
 */

import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

/**
 * Lädt ein Bild von einer URL herunter
 */
async function downloadImage(url) {
  return new Promise((resolve, reject) => {
    // Google Drive URL konvertieren
    let downloadUrl = url;
    const driveMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (driveMatch) {
      const fileId = driveMatch[1];
      downloadUrl = `https://lh3.googleusercontent.com/d/${fileId}=s0`;
    }

    console.log(`📥 Lade: ${downloadUrl.substring(0, 80)}...`);

    const protocol = downloadUrl.startsWith('https') ? https : http;

    protocol.get(downloadUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'image/*'
      }
    }, (response) => {
      // Handle redirects
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        console.log(`   ↪ Redirect zu: ${response.headers.location.substring(0, 60)}...`);
        downloadImage(response.headers.location).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }

      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        const buffer = Buffer.concat(chunks);
        console.log(`   ✓ ${(buffer.length / 1024).toFixed(0)} KB heruntergeladen`);
        resolve(buffer);
      });
      response.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * Kombiniert zwei Bilder nebeneinander
 */
async function combineImages(leftBuffer, rightBuffer, outputPath) {
  // Lade beide Bilder und hole Metadaten
  const leftImage = sharp(leftBuffer);
  const rightImage = sharp(rightBuffer);

  const [leftMeta, rightMeta] = await Promise.all([
    leftImage.metadata(),
    rightImage.metadata()
  ]);

  console.log(`\n📐 Bildgrößen:`);
  console.log(`   Links:  ${leftMeta.width}x${leftMeta.height}`);
  console.log(`   Rechts: ${rightMeta.width}x${rightMeta.height}`);

  // Bestimme die Ziel-Höhe (die größere der beiden)
  const targetHeight = Math.max(leftMeta.height, rightMeta.height);

  // Skaliere beide Bilder auf die gleiche Höhe
  const leftResized = await leftImage
    .resize({ height: targetHeight, withoutEnlargement: false })
    .toBuffer();

  const rightResized = await rightImage
    .resize({ height: targetHeight, withoutEnlargement: false })
    .toBuffer();

  // Hole die neuen Breiten nach dem Resize
  const leftResizedMeta = await sharp(leftResized).metadata();
  const rightResizedMeta = await sharp(rightResized).metadata();

  const totalWidth = leftResizedMeta.width + rightResizedMeta.width;

  console.log(`\n🔗 Kombiniere zu: ${totalWidth}x${targetHeight}`);

  // Kombiniere die Bilder nebeneinander
  await sharp({
    create: {
      width: totalWidth,
      height: targetHeight,
      channels: 3,
      background: { r: 255, g: 255, b: 255 }
    }
  })
    .composite([
      { input: leftResized, left: 0, top: 0 },
      { input: rightResized, left: leftResizedMeta.width, top: 0 }
    ])
    .webp({ quality: 90 })
    .toFile(outputPath);

  const stats = await fs.stat(outputPath);
  console.log(`\n✅ Gespeichert: ${outputPath}`);
  console.log(`   Größe: ${(stats.size / 1024).toFixed(0)} KB`);
}

/**
 * Hauptfunktion
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 3) {
    console.log(`
🖼️  Combine Spread - Kombiniert zwei Bilder zu einem Spread

Usage: node scripts/combine-spread.mjs <left-url> <right-url> <output-name>

Beispiel:
  node scripts/combine-spread.mjs \\
    "https://drive.google.com/file/d/ABC123/view" \\
    "https://drive.google.com/file/d/DEF456/view" \\
    "uniqlo-spread"

Das Ergebnis wird in images/src/<output-name>.webp gespeichert.
    `);
    process.exit(1);
  }

  const [leftUrl, rightUrl, outputName] = args;
  const outputPath = path.join(ROOT, 'images', 'src', `${outputName}.webp`);

  console.log('🖼️  Combine Spread\n');

  try {
    // Lade beide Bilder herunter
    console.log('📥 Lade Bilder herunter...\n');
    const [leftBuffer, rightBuffer] = await Promise.all([
      downloadImage(leftUrl),
      downloadImage(rightUrl)
    ]);

    // Kombiniere die Bilder
    await combineImages(leftBuffer, rightBuffer, outputPath);

    console.log(`
📋 Nächste Schritte:
   1. Lade ${outputName}.webp auf Google Drive hoch
   2. Aktualisiere das Google Sheet:
      - bild_url_2 = neue Google Drive URL des kombinierten Bildes
      - bild_url_3 = leer lassen (löschen)
   3. Cache leeren (Strg+Shift+R)
`);

  } catch (err) {
    console.error(`\n❌ Fehler: ${err.message}`);
    process.exit(1);
  }
}

main();
