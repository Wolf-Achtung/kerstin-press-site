/**
 * Content Loader für Kerstin Geffert Website
 * Lädt Inhalte dynamisch aus Google Sheets
 * Unterstützt mehrere Bilder pro Editorial (Lightbox-Galerie)
 */

(function() {
  'use strict';

  // ============================================
  // KONFIGURATION - Hier Sheet-ID eintragen!
  // ============================================
  const CONFIG = {
    // Google Sheet ID (aus der URL kopieren)
    SHEET_ID: '1hvZRgfUx078ZxTCAadpwyBDgM5LSzlYsrs7yv4E9szU',

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
    const headers = table.cols.map(col => col.label?.toLowerCase().trim().replace(/[- ]/g, '_') || '');
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
      const fileId = driveMatch[1];
      // Zuverlässigere Methode für Google Drive Bilder
      return `https://lh3.googleusercontent.com/d/${fileId}`;
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

  // Sammle alle Bild-URLs aus einem Item (Bild-URL, Bild-URL-2, Bild-URL-3, etc.)
  function getImageUrls(item) {
    const urls = [];

    // Haupt-Bild-URL
    const mainUrl = item.bild_url || item['bild-url'] || item.bild_url_1 || item['bild-url-1'];
    if (mainUrl) {
      urls.push(convertDriveUrl(mainUrl));
    }

    // Zusätzliche Bilder (2-10)
    for (let i = 2; i <= 10; i++) {
      const urlKey = `bild_url_${i}`;
      const urlKeyAlt = `bild-url-${i}`;
      const url = item[urlKey] || item[urlKeyAlt];
      if (url) {
        urls.push(convertDriveUrl(url));
      }
    }

    return urls;
  }

  function createImageTile(item, groupId) {
    const imageUrls = getImageUrls(item);
    if (imageUrls.length === 0) return '';

    const mainImageUrl = imageUrls[0];
    // Speichere alle URLs als data-Attribut für die Lightbox
    const allUrlsJson = JSON.stringify(imageUrls);
    // Wenn ein Link vorhanden ist, wird statt Lightbox ein Popup/Modal geöffnet
    const popupLink = item.link || '';
    // Screenshot für Split-Modal (aus bild_url_2)
    const screenshotUrl = imageUrls.length > 1 ? imageUrls[1] : '';
    // Position für spezielle Behandlung (z.B. Seitenreihenfolge)
    const position = item.position || '';

    return `
      <article class="tile tile-image" data-date="${item.datum || ''}">
        <div class="tile-media">
          <div class="press-image-wrapper"
               data-full="${mainImageUrl}"
               data-gallery='${allUrlsJson}'
               data-group="${groupId}"
               data-position="${position}"
               data-medium="${item.medium || ''}"
               ${popupLink ? `data-popup-link="${popupLink}"` : ''}
               ${screenshotUrl ? `data-screenshot="${screenshotUrl}"` : ''}>
            <img
              src="${mainImageUrl}"
              loading="lazy"
              decoding="async"
              alt="${item.titel_de || ''}"
            />
            <span class="zoom-hint lang-de">${popupLink ? 'Klick für mehr Info' : 'Klick zum Vergrößern'}</span>
            <span class="zoom-hint lang-en">${popupLink ? 'Click for more info' : 'Click to enlarge'}</span>
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
        ${item.zitat_de ? `<blockquote class="lang-de">${item.zitat_de}</blockquote>` : ''}
        ${item.zitat_en ? `<blockquote class="lang-en">${item.zitat_en}</blockquote>` : ''}
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

  function createTile(item, index) {
    const typ = (item.typ || '').toLowerCase().trim();
    const groupId = `gallery-${index}`;

    switch (typ) {
      case 'bild':
      case 'image':
        return createImageTile(item, groupId);
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
    // Freitext erlaubt: "Ausgabe 1/2023", "Sommer 2022", "März 2024"
    if (!dateStr) return '';

    const str = String(dateStr);

    // Google Sheets Date-Objekt Format: "Date(2023,0,1)" → ignorieren, Freitext nutzen
    if (str.startsWith('Date(')) {
      // Wenn es ein Google Sheets Date ist, zeigen wir nichts an
      // (Kerstin soll stattdessen Freitext im Sheet eingeben)
      return '';
    }

    return str;
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

    // Tiles nach Spalte trennen
    const leftItems = [];
    const rightItems = [];

    rows.forEach((item, index) => {
      const spalte = (item.spalte || '').toLowerCase().trim();
      const tileHtml = createTile(item, index);

      if (spalte === 'rechts' || spalte === 'right') {
        rightItems.push(tileHtml);
      } else {
        leftItems.push(tileHtml);
      }
    });

    // Mobile-Order berechnen: Links=ungerade (1,3,5...), Rechts=gerade (2,4,6...)
    // CSS order wird inline gesetzt für korrektes Mobile-Reflow
    const addMobileOrder = (html, orderValue) => {
      return html.replace('<article class="tile', `<article style="--mobile-order:${orderValue}" class="tile`);
    };

    // Interleave items für Mobile-Reihenfolge erstellen
    // und aufeinanderfolgende Zitate vermeiden
    const maxLen = Math.max(leftItems.length, rightItems.length);
    const interleavedItems = [];

    for (let i = 0; i < maxLen; i++) {
      if (leftItems[i]) {
        interleavedItems.push({ html: leftItems[i], column: 'left' });
      }
      if (rightItems[i]) {
        interleavedItems.push({ html: rightItems[i], column: 'right' });
      }
    }

    // Aufeinanderfolgende Zitate erkennen und nach hinten verschieben
    const isQuote = (html) => html.includes('tile-quote');
    for (let i = 0; i < interleavedItems.length - 1; i++) {
      if (isQuote(interleavedItems[i].html) && isQuote(interleavedItems[i + 1].html)) {
        // Finde nächstes Nicht-Zitat zum Tauschen
        for (let j = i + 2; j < interleavedItems.length; j++) {
          if (!isQuote(interleavedItems[j].html)) {
            // Tausche Position i+1 mit j
            const temp = interleavedItems[i + 1];
            interleavedItems[i + 1] = interleavedItems[j];
            interleavedItems[j] = temp;
            break;
          }
        }
      }
    }

    // Order-Werte zuweisen und nach Spalten aufteilen
    let leftHtml = '';
    let rightHtml = '';

    interleavedItems.forEach((item, i) => {
      const orderedHtml = addMobileOrder(item.html, i + 1);
      if (item.column === 'left') {
        leftHtml += orderedHtml;
      } else {
        rightHtml += orderedHtml;
      }
    });

    leftColumn.innerHTML = leftHtml;
    rightColumn.innerHTML = rightHtml;

    // Lightbox neu initialisieren mit Galerie-Support
    initGalleryLightbox();

    // Sprache anwenden
    applyCurrentLanguage();
  }

  // ============================================
  // LIGHTBOX MIT GALERIE-SUPPORT
  // ============================================

  function initGalleryLightbox() {
    const imageItems = document.querySelectorAll('.press-image-wrapper');
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    const lightboxLink = document.getElementById('lightbox-link');
    const prevBtn = lightbox?.querySelector('.lightbox-prev');
    const nextBtn = lightbox?.querySelector('.lightbox-next');
    const closeBtn = lightbox?.querySelector('.lightbox-close');

    if (!lightbox || !lightboxImg) return;

    let currentGallery = [];
    let currentIndex = 0;

    function showImage(index) {
      if (index < 0 || index >= currentGallery.length) return;

      currentIndex = index;
      const src = currentGallery[index];

      lightboxImg.src = src;
      if (lightboxLink) lightboxLink.href = src;

      // Navigation ein/ausblenden
      if (prevBtn) prevBtn.style.display = currentGallery.length > 1 ? 'block' : 'none';
      if (nextBtn) nextBtn.style.display = currentGallery.length > 1 ? 'block' : 'none';
    }

    function openLightbox(galleryUrls, startIndex = 0) {
      currentGallery = galleryUrls;
      currentIndex = startIndex;

      showImage(currentIndex);
      lightbox.classList.add('active');
      document.body.style.overflow = 'hidden';
    }

    function closeLightbox() {
      lightbox.classList.remove('active');
      document.body.style.overflow = '';
      lightboxImg.src = '';
    }

    function showNext() {
      showImage((currentIndex + 1) % currentGallery.length);
    }

    function showPrev() {
      showImage((currentIndex - 1 + currentGallery.length) % currentGallery.length);
    }

    // Spread Modal (Zwei Seiten nebeneinander)
    const spreadModal = document.getElementById('spread-modal');
    const spreadImgLeft = document.getElementById('spread-img-left');
    const spreadImgRight = document.getElementById('spread-img-right');
    const spreadCloseBtn = spreadModal?.querySelector('.spread-modal-close');
    const spreadZoomLink = document.getElementById('spread-zoom-link');

    function openSpreadModal(leftUrl, rightUrl) {
      if (!spreadModal || !spreadImgLeft || !spreadImgRight) return;

      spreadImgLeft.src = leftUrl;
      spreadImgRight.src = rightUrl;
      // Zoom-Link auf das rechte Bild setzen (Innenseite)
      if (spreadZoomLink) {
        spreadZoomLink.href = rightUrl;
      }
      spreadModal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }

    function closeSpreadModal() {
      if (!spreadModal) return;
      spreadModal.classList.remove('active');
      spreadImgLeft.src = '';
      spreadImgRight.src = '';
      document.body.style.overflow = '';
    }

    if (spreadCloseBtn) {
      spreadCloseBtn.addEventListener('click', closeSpreadModal);
    }

    if (spreadModal) {
      spreadModal.addEventListener('click', (e) => {
        if (e.target === spreadModal) closeSpreadModal();
      });
    }

    // Article Split Modal (iframe + Screenshot)
    const articleModal = document.getElementById('article-modal');
    const articleIframe = document.getElementById('article-iframe');
    const articleScreenshot = document.getElementById('article-screenshot');
    const articleCloseBtn = articleModal?.querySelector('.article-modal-close');

    function openArticleModal(articleUrl, screenshotUrl) {
      if (!articleModal || !articleIframe || !articleScreenshot) return;

      articleIframe.src = articleUrl;
      articleScreenshot.src = screenshotUrl;
      articleModal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }

    function closeArticleModal() {
      if (!articleModal) return;
      articleModal.classList.remove('active');
      articleIframe.src = '';
      articleScreenshot.src = '';
      document.body.style.overflow = '';
    }

    if (articleCloseBtn) {
      articleCloseBtn.addEventListener('click', closeArticleModal);
    }

    if (articleModal) {
      articleModal.addEventListener('click', (e) => {
        if (e.target === articleModal) closeArticleModal();
      });
    }

    // Positionen für Seitenreihenfolge (aus Google Sheet)
    // Position 6 = Working Women, Position 13 = Freundin → Seiten tauschen
    const SWAP_ORDER_POSITIONS = [6, 13];

    // Hilfsfunktion: Prüft ob Medium-Name einen der Werte enthält
    function mediumMatches(medium, patterns) {
      return patterns.some(pattern => medium.includes(pattern));
    }

    // Single Modal (für Maxi Cover in Spread-Größe)
    const singleModal = document.getElementById('single-modal');
    const singleImg = document.getElementById('single-img');
    const singleCloseBtn = singleModal?.querySelector('.single-modal-close');
    const singleNextBtn = singleModal?.querySelector('.single-modal-next');

    // Speichert URLs für den Spread nach dem Cover
    let pendingSpread = null;

    function openSingleModal(coverUrl, spreadLeftUrl, spreadRightUrl) {
      if (!singleModal || !singleImg) return;

      pendingSpread = { left: spreadLeftUrl, right: spreadRightUrl };
      singleImg.src = coverUrl;
      singleModal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }

    function closeSingleModal() {
      if (!singleModal) return;
      singleModal.classList.remove('active');
      singleImg.src = '';
      document.body.style.overflow = '';
      pendingSpread = null;
    }

    if (singleCloseBtn) {
      singleCloseBtn.addEventListener('click', closeSingleModal);
    }

    if (singleNextBtn) {
      singleNextBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (pendingSpread) {
          const spread = { ...pendingSpread }; // Kopie speichern
          console.log('Next-Button geklickt, pendingSpread:', spread);
          closeSingleModal();
          setTimeout(() => {
            // Wenn left === right, zeige einzelnes Bild (Maxi-Fall)
            if (spread.left === spread.right) {
              console.log('→ Zeige Lightbox (Maxi: einzelnes Bild)');
              openLightbox([spread.left], 0);
            } else {
              // Sonst zeige Spread (Uniqlo-Fall)
              console.log('→ Zeige Spread-Modal (Uniqlo: zwei Seiten)');
              openSpreadModal(spread.left, spread.right);
            }
          }, 100);
        }
      });
    }

    if (singleModal) {
      singleModal.addEventListener('click', (e) => {
        if (e.target === singleModal) closeSingleModal();
      });
    }

    // Event-Listener für Bilder
    imageItems.forEach((item) => {
      item.style.cursor = 'pointer';
      item.addEventListener('click', () => {
        const popupLink = item.dataset.popupLink;
        const screenshotUrl = item.dataset.screenshot;
        const position = parseInt(item.dataset.position, 10) || 0;
        const medium = (item.dataset.medium || '').toLowerCase().trim();

        // Debug: Zeige Position, Medium und alle URLs in der Konsole
        const debugGallery = JSON.parse(item.dataset.gallery || '[]');
        console.log('Clicked:', { position, medium, galleryLength: debugGallery.length, urls: debugGallery });

        // Wenn Link UND Screenshot vorhanden: Article-Split-Modal öffnen
        if (popupLink && screenshotUrl) {
          openArticleModal(popupLink, screenshotUrl);
          return;
        }

        // Wenn nur Link vorhanden: In neuem Tab öffnen
        if (popupLink) {
          window.open(popupLink, '_blank');
          return;
        }

        // Galerie-URLs holen
        let galleryUrls;
        try {
          galleryUrls = JSON.parse(item.dataset.gallery || '[]');
        } catch {
          galleryUrls = [];
        }

        // Fallback auf einzelnes Bild
        if (galleryUrls.length === 0) {
          galleryUrls = [item.dataset.full];
        }

        // Bei 2 Bildern: Spread-Modal (Doppelseite)
        if (galleryUrls.length === 2) {
          // Maxi (Position 10 oder Medium 'maxi'): Cover erst, dann Spread alleine
          // galleryUrls[0] = Spread, galleryUrls[1] = Cover
          // → Erst Cover, dann nur Spread (als Einzelbild in Lightbox)
          if (position === 10 || mediumMatches(medium, ['maxi'])) {
            console.log('→ Maxi-Modus (2 Bilder):', medium, '- Cover erst, dann Spread alleine');
            openSingleModal(galleryUrls[1], galleryUrls[0], galleryUrls[0]);
            return;
          }

          // Freundin (13), Working Women (6): Seitenreihenfolge tauschen
          if (SWAP_ORDER_POSITIONS.includes(position)) {
            console.log('→ Swap-Modus: Seiten getauscht (Position', position, ')');
            openSpreadModal(galleryUrls[1], galleryUrls[0]);
            return;
          }

          // Standard: galleryUrls[0] links, galleryUrls[1] rechts
          console.log('→ Standard-Spread (Position', position, ')');
          openSpreadModal(galleryUrls[0], galleryUrls[1]);
          return;
        }

        // Magazine B / Uniqlo mit 3 Bildern: Erst Cover, dann Doppelseite
        // Bild 1 = Cover, Bild 2 = linke Seite, Bild 3 = rechte Seite
        // Position 9 oder Medium enthält 'magazine'/'uniqlo'
        if (galleryUrls.length === 3 && (position === 9 || mediumMatches(medium, ['magazine', 'uniqlo']))) {
          console.log('→ Magazine B/Uniqlo-Modus (3 Bilder):', medium, '- Cover erst, dann Doppelseite');
          openSingleModal(galleryUrls[0], galleryUrls[1], galleryUrls[2]);
          return;
        }

        // Bei 3+ Bildern: Normale Lightbox mit Navigation (Cover → Folgeseiten)
        console.log('→ Standard-Lightbox (Position', position, ', Bilder:', galleryUrls.length, ')');
        openLightbox(galleryUrls, 0);
      });
    });

    // Event-Listener für Navigation
    if (closeBtn) {
      closeBtn.addEventListener('click', closeLightbox);
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showPrev();
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showNext();
      });
    }

    // Schließen bei Klick auf Backdrop
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) closeLightbox();
    });

    // Tastaturnavigation
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        // Alle Modals schließen
        if (singleModal?.classList.contains('active')) {
          closeSingleModal();
        }
        if (spreadModal?.classList.contains('active')) {
          closeSpreadModal();
        }
        if (articleModal?.classList.contains('active')) {
          closeArticleModal();
        }
        if (lightbox.classList.contains('active')) {
          closeLightbox();
        }
        return;
      }

      // Pfeil rechts für Single-Modal → öffnet Spread
      if (e.key === 'ArrowRight' && singleModal?.classList.contains('active') && pendingSpread) {
        const spread = { ...pendingSpread }; // Kopie speichern
        closeSingleModal();
        setTimeout(() => {
          openSpreadModal(spread.left, spread.right);
        }, 100);
        return;
      }

      // Pfeiltasten nur für Lightbox
      if (!lightbox.classList.contains('active')) return;

      switch (e.key) {
        case 'ArrowRight':
          showNext();
          break;
        case 'ArrowLeft':
          showPrev();
          break;
      }
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
