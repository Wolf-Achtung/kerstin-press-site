/**
 * Image Optimization Script
 * Erstellt optimierte Vollbilder und Cover-Ausschnitte
 *
 * Usage: node scripts/images.mjs
 */

import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

// Konfiguration
const CONFIG = {
  srcDir: path.join(ROOT, 'images/src'),
  fullDir: path.join(ROOT, 'images/full'),
  coverDir: path.join(ROOT, 'images/cover'),
  cropsConfig: path.join(ROOT, 'images/crops.json'),
  manifestPath: path.join(ROOT, 'images/manifest.json'),

  // Vollbild-Einstellungen
  full: {
    maxWidth: 2400,
    quality: 88,  // Höhere Qualität für Textlesbarkeit
    effort: 4
  },

  // Cover-Einstellungen (16:9 Ratio)
  cover: {
    width: 1200,
    height: 675,  // 16:9 Format
    quality: 85,
    effort: 4
  },

  // Unterstützte Dateiformate
  supportedFormats: ['.jpg', '.jpeg', '.png', '.webp']
};

/**
 * Lädt die Crop-Konfiguration
 */
async function loadCropsConfig() {
  try {
    const data = await fs.readFile(CONFIG.cropsConfig, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.log('ℹ️  Keine crops.json gefunden, verwende Standard-Crop-Strategie');
    return {};
  }
}

/**
 * Ermittelt alle Bilddateien im Source-Verzeichnis
 */
async function getSourceImages() {
  const files = await fs.readdir(CONFIG.srcDir);
  return files.filter(file => {
    const ext = path.extname(file).toLowerCase();
    return CONFIG.supportedFormats.includes(ext);
  });
}

/**
 * Erstellt optimiertes Vollbild
 */
async function createFullImage(inputPath, outputPath) {
  const image = sharp(inputPath);
  const metadata = await image.metadata();

  // Bestimme Qualität basierend auf Bildinhalt
  // Größere Bilder mit hoher DPI sind wahrscheinlich Text-lastig
  const isTextHeavy = metadata.width > 4000 || metadata.density > 200;
  const quality = isTextHeavy ? 90 : CONFIG.full.quality;

  let pipeline = image;

  // Resize nur wenn größer als maxWidth
  if (metadata.width > CONFIG.full.maxWidth) {
    pipeline = pipeline.resize({
      width: CONFIG.full.maxWidth,
      withoutEnlargement: true,
      kernel: sharp.kernel.lanczos3
    });

    // Leichtes Sharpen nach Resize für Textschärfe
    if (isTextHeavy) {
      pipeline = pipeline.sharpen({
        sigma: 0.5,
        m1: 0.5,
        m2: 0.5
      });
    }
  }

  await pipeline
    .webp({
      quality: quality,
      effort: CONFIG.full.effort,
      smartSubsample: true
    })
    .toFile(outputPath);

  const stats = await fs.stat(outputPath);
  return {
    width: metadata.width > CONFIG.full.maxWidth ? CONFIG.full.maxWidth : metadata.width,
    originalSize: metadata.size,
    newSize: stats.size,
    quality
  };
}

/**
 * Erstellt Cover-Ausschnitt mit intelligenter Crop-Strategie
 */
async function createCoverImage(inputPath, outputPath, filename, cropsConfig) {
  const image = sharp(inputPath);
  const metadata = await image.metadata();

  // Prüfe ob es eine spezielle Crop-Konfiguration gibt
  const cropConfig = cropsConfig[filename];

  let pipeline = image;

  if (cropConfig) {
    if (cropConfig.left !== undefined && cropConfig.top !== undefined) {
      // Manuelle Bounding-Box (normierte Werte 0-1)
      const left = Math.round(cropConfig.left * metadata.width);
      const top = Math.round(cropConfig.top * metadata.height);
      const width = Math.round((cropConfig.width || 0.5) * metadata.width);
      const height = Math.round((cropConfig.height || 0.5) * metadata.height);

      pipeline = pipeline.extract({
        left,
        top,
        width,
        height
      });
    } else if (cropConfig.strategy) {
      // Vordefinierte Strategie (north, center, attention, entropy)
      pipeline = pipeline.resize({
        width: CONFIG.cover.width,
        height: CONFIG.cover.height,
        fit: 'cover',
        position: cropConfig.strategy
      });

      await pipeline
        .webp({
          quality: CONFIG.cover.quality,
          effort: CONFIG.cover.effort
        })
        .toFile(outputPath);

      return { strategy: cropConfig.strategy };
    }
  }

  // Standard: attention-based crop (fokussiert auf interessante Bereiche)
  await pipeline
    .resize({
      width: CONFIG.cover.width,
      height: CONFIG.cover.height,
      fit: 'cover',
      position: 'attention'  // Verwendet Saliency Detection
    })
    .webp({
      quality: CONFIG.cover.quality,
      effort: CONFIG.cover.effort
    })
    .toFile(outputPath);

  return { strategy: 'attention' };
}

/**
 * Generiert ID aus Dateiname
 */
function getImageId(filename) {
  return path.basename(filename, path.extname(filename));
}

/**
 * Hauptfunktion
 */
async function main() {
  console.log('🖼️  Starte Bildoptimierung...\n');

  // Stelle sicher, dass Output-Verzeichnisse existieren
  await fs.mkdir(CONFIG.fullDir, { recursive: true });
  await fs.mkdir(CONFIG.coverDir, { recursive: true });

  // Lade Crop-Konfiguration
  const cropsConfig = await loadCropsConfig();

  // Finde alle Quellbilder
  const sourceImages = await getSourceImages();

  if (sourceImages.length === 0) {
    console.log('⚠️  Keine Bilder in images/src gefunden.');
    return;
  }

  console.log(`📁 Gefunden: ${sourceImages.length} Bilder\n`);

  const manifest = [];

  for (const filename of sourceImages) {
    const id = getImageId(filename);
    const inputPath = path.join(CONFIG.srcDir, filename);
    const fullOutputPath = path.join(CONFIG.fullDir, `${id}.webp`);
    const coverOutputPath = path.join(CONFIG.coverDir, `${id}_cover.webp`);

    console.log(`📷 Verarbeite: ${filename}`);

    try {
      // Erstelle Vollbild
      const fullResult = await createFullImage(inputPath, fullOutputPath);
      console.log(`   ✓ Full: ${fullResult.width}px, Q${fullResult.quality}`);

      // Erstelle Cover
      const coverResult = await createCoverImage(inputPath, coverOutputPath, filename, cropsConfig);
      console.log(`   ✓ Cover: ${CONFIG.cover.width}x${CONFIG.cover.height}, Strategie: ${coverResult.strategy}`);

      // Füge zum Manifest hinzu
      manifest.push({
        id,
        cover: `images/cover/${id}_cover.webp`,
        full: `images/full/${id}.webp`,
        original: `images/src/${filename}`
      });

    } catch (err) {
      console.error(`   ✗ Fehler: ${err.message}`);
    }

    console.log('');
  }

  // Schreibe Manifest
  await fs.writeFile(
    CONFIG.manifestPath,
    JSON.stringify(manifest, null, 2),
    'utf8'
  );

  console.log(`📋 Manifest erstellt: images/manifest.json`);
  console.log(`\n✅ Fertig! ${manifest.length} Bilder optimiert.`);

  // Zeige Größenvergleich
  console.log('\n📊 Dateigrößen:');
  for (const item of manifest) {
    const fullPath = path.join(ROOT, item.full);
    const coverPath = path.join(ROOT, item.cover);
    const origPath = path.join(ROOT, item.original);

    const [fullStats, coverStats, origStats] = await Promise.all([
      fs.stat(fullPath),
      fs.stat(coverPath),
      fs.stat(origPath)
    ]);

    const formatSize = (bytes) => {
      if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
      return `${(bytes / 1024).toFixed(0)} KB`;
    };

    console.log(`   ${item.id}:`);
    console.log(`      Original: ${formatSize(origStats.size)}`);
    console.log(`      Full:     ${formatSize(fullStats.size)} (${Math.round(fullStats.size / origStats.size * 100)}%)`);
    console.log(`      Cover:    ${formatSize(coverStats.size)}`);
  }
}

main().catch(console.error);
