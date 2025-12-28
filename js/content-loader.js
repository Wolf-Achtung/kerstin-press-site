/**
 * Content Loader für Kerstin Geffert Website
 * Lädt Inhalte dynamisch aus Google Sheets
 */

(function() {
  'use strict';

  // ============================================
  // KONFIGURATION - Hier Sheet-ID eintragen!
  // ============================================
  const CONFIG = {
    // Google Sheet ID (aus der URL kopieren)
    SHEET_ID: 'HIER_SHEET_ID_EINTRAGEN',

    // Sheet-Name (Tab-Name unten im Sheet)
    SHEET_NAME: 'Tabellenblatt1',

    // Cache-Dauer in Minuten (0 = kein Cache)
    CACHE_MINUTES: 5
  };

  // ============================================
  // GOOGLE SHEETS API
  // ============================================

  function getSheetUrl() {
    return `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(CONFIG.SHEET_NAME)}`;
  }

  async function fetchSheetData() {
    // Cache prüfen
    const cached = getCachedData();
    if (cached) {
      console.log('Content aus Cache geladen');
      return cached;
    }

    try {
      const response = await fetch(getSheetUrl());
      const text = await response.text();

      // Google gibt JSONP zurück, wir müssen es parsen
      const jsonString = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?/);
      if (!jsonString || !jsonString[1]) {
        throw new Error('Ungültige Antwort von Google Sheets');
      }

      const data = JSON.parse(jsonString[1]);
      const rows = parseSheetData(data);

      // Cache speichern
      setCachedData(rows);

      return rows;
    } catch (error) {
      console.error('Fehler beim Laden der Sheet-Daten:', error);
      return null;
    }
  }

  function parseSheetData(data) {
    const table = data.table;
    const headers = table.cols.map(col => col.label?.toLowerCase() || '');
    const rows = [];

    for (const row of table.rows) {
      const item = {};
      row.c.forEach((cell, index) => {
        const header = headers[index];
        if (header) {
          item[header] = cell?.v ?? '';
        }
      });

      // Nur Zeilen mit Position verwenden
      if (item.position) {
        rows.push(item);
      }
    }

    // Nach Position sortieren
    rows.sort((a, b) => Number(a.position) - Number(b.position));

    return rows;
  }

  // ============================================
  // CACHE FUNKTIONEN
  // ============================================

  function getCacheKey() {
    return `kerstin_content_${CONFIG.SHEET_ID}`;
  }

  function getCachedData() {
    if (CONFIG.CACHE_MINUTES <= 0) return null;

    try {
      const cached = localStorage.getItem(getCacheKey());
      if (!cached) return null;

      const { data, timestamp } = JSON.parse(cached);
      const age = (Date.now() - timestamp) / 1000 / 60;

      if (age > CONFIG.CACHE_MINUTES) {
        localStorage.removeItem(getCacheKey());
        return null;
      }

      return data;
    } catch {
      return null;
    }
  }

  function setCachedData(data) {
    if (CONFIG.CACHE_MINUTES <= 0) return;

    try {
      localStorage.setItem(getCacheKey(), JSON.stringify({
        data,
        timestamp: Date.now()
      }));
    } catch {
      // Storage voll oder nicht verfügbar
    }
  }

  // ============================================
  // HTML GENERIERUNG
  // ============================================

  function convertDriveUrl(url) {
    if (!url) return '';

    // Google Drive Link umwandeln
    const driveMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (driveMatch) {
      return `https://drive.google.com/uc?export=view&id=${driveMatch[1]}`;
    }

    return url;
  }

  function convertYoutubeUrl(url) {
    if (!url) return '';

    // YouTube Watch-Link zu Embed umwandeln
    let videoId = '';

    const watchMatch = url.match(/[?&]v=([a-zA-Z0-9_-]+)/);
    if (watchMatch) {
      videoId = watchMatch[1];
    }

    const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
    if (shortMatch) {
      videoId = shortMatch[1];
    }

    if (videoId) {
      return `https://www.youtube.com/embed/${videoId}`;
    }

    return url;
  }

  function createImageTile(item) {
    const imageUrl = convertDriveUrl(item.bild_url);

    return `
      <article class="tile tile-image" data-date="${item.datum || ''}">
        <div class="tile-media">
          <div class="press-image-wrapper" data-full="${imageUrl}">
            <img
              src="${imageUrl}"
              loading="lazy"
              decoding="async"
              alt="${item.titel_de || ''}"
            />
            <span class="zoom-hint lang-de">Klick zum Vergrößern</span>
            <span class="zoom-hint lang-en">Click to enlarge</span>
          </div>
        </div>
        <div class="tile-text">
          ${item.medium ? `<span class="tile-medium">${item.medium}</span>` : ''}
          ${item.titel_de ? `<h3 class="tile-title lang-de">${item.titel_de}</h3>` : ''}
          ${item.titel_en ? `<h3 class="tile-title lang-en">${item.titel_en}</h3>` : ''}
          ${item.datum ? `<p class="tile-date">${formatDate(item.datum)}</p>` : ''}
        </div>
      </article>
    `;
  }

  function createQuoteTile(item) {
    return `
      <article class="tile tile-quote">
        ${item.zitat_de ? `<blockquote class="lang-de">„${item.zitat_de}"</blockquote>` : ''}
        ${item.zitat_en ? `<blockquote class="lang-en">"${item.zitat_en}"</blockquote>` : ''}
        ${item.medium ? `<p class="quote-meta">– ${item.medium}</p>` : '<p class="quote-meta">– Kerstin Geffert</p>'}
      </article>
    `;
  }

  function createVideoTile(item) {
    const embedUrl = convertYoutubeUrl(item.link);

    return `
      <article class="tile tile-video">
        <div class="tile-media">
          <div class="video-wrapper">
            <iframe
              src="${embedUrl}"
              title="${item.titel_de || 'Video'}"
              frameborder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowfullscreen
            ></iframe>
          </div>
        </div>
        <div class="tile-text">
          ${item.medium ? `<span class="tile-medium">${item.medium}</span>` : ''}
          ${item.titel_de ? `<h3 class="tile-title lang-de">${item.titel_de}</h3>` : ''}
          ${item.titel_en ? `<h3 class="tile-title lang-en">${item.titel_en}</h3>` : ''}
          ${item.datum ? `<p class="tile-date">${formatDate(item.datum)}</p>` : ''}
        </div>
      </article>
    `;
  }

  function createTile(item) {
    const typ = (item.typ || '').toLowerCase().trim();

    switch (typ) {
      case 'bild':
      case 'image':
        return createImageTile(item);
      case 'zitat':
      case 'quote':
        return createQuoteTile(item);
      case 'video':
        return createVideoTile(item);
      default:
        console.warn('Unbekannter Typ:', typ);
        return '';
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';

    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('de-DE', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  }

  // ============================================
  // RENDERING
  // ============================================

  function renderContent(rows) {
    const leftColumn = document.getElementById('content-left');
    const rightColumn = document.getElementById('content-right');

    if (!leftColumn || !rightColumn) {
      console.error('Content-Container nicht gefunden');
      return;
    }

    let leftHtml = '';
    let rightHtml = '';

    for (const item of rows) {
      const spalte = (item.spalte || '').toLowerCase().trim();
      const tileHtml = createTile(item);

      if (spalte === 'rechts' || spalte === 'right') {
        rightHtml += tileHtml;
      } else {
        leftHtml += tileHtml;
      }
    }

    leftColumn.innerHTML = leftHtml;
    rightColumn.innerHTML = rightHtml;

    // Lightbox neu initialisieren
    initLightbox();

    // Sprache anwenden
    applyCurrentLanguage();
  }

  function initLightbox() {
    // Lightbox-Event-Listener für neue Bilder
    const imageItems = document.querySelectorAll('.press-image-wrapper');
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    const lightboxLink = document.getElementById('lightbox-link');

    if (!lightbox || !lightboxImg) return;

    imageItems.forEach((item, index) => {
      item.style.cursor = 'pointer';
      item.addEventListener('click', () => {
        const fullSrc = item.dataset.full;
        const img = item.querySelector('img');
        const alt = img ? img.alt : '';

        lightboxImg.src = fullSrc;
        lightboxImg.alt = alt;
        if (lightboxLink) lightboxLink.href = fullSrc;

        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';
      });
    });
  }

  function applyCurrentLanguage() {
    // Aktuelle Sprache aus Body-Klasse lesen und anwenden
    const isEnglish = document.body.classList.contains('lang-en');
    // Die CSS-Regeln übernehmen automatisch die Anzeige
  }

  // ============================================
  // INITIALISIERUNG
  // ============================================

  async function init() {
    // Prüfen ob Sheet-ID konfiguriert ist
    if (CONFIG.SHEET_ID === 'HIER_SHEET_ID_EINTRAGEN') {
      console.log('Google Sheet noch nicht konfiguriert - zeige statischen Content');
      return;
    }

    console.log('Lade Content aus Google Sheet...');

    const rows = await fetchSheetData();

    if (rows && rows.length > 0) {
      renderContent(rows);
      console.log(`${rows.length} Einträge geladen`);
    } else {
      console.log('Keine Daten gefunden - zeige statischen Content');
    }
  }

  // Starten wenn DOM bereit
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Globale Funktion zum manuellen Neuladen
  window.reloadContent = async function() {
    localStorage.removeItem(getCacheKey());
    await init();
  };

})();
