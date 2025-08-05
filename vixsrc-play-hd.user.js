// ==UserScript==
// @name         VixSrc Play HD – Trakt Anchor Observer (pushState & replaceState fix)
// @namespace    http://tampermonkey.net/
// @version      1.13
// @description  Aggiunge un pallino rosso ▶ in basso-destra su film & episodi di serie TV in Trakt, intercettando SPA pushState/replaceState e DOM mutations.  
// @match        https://trakt.tv/*  
// @grant        none  
// ==/UserScript==

;(function(){
  'use strict';

  // ◆ Crea il pallino rosso ▶
  function createCircleBtn(url) {
    const a = document.createElement('a');
    a.href = url + '?autoplay=true&theme=dark&lang=it&res=1080';
    a.target = '_blank';
    a.textContent = '▶';
    Object.assign(a.style, {
      position:      'absolute',
      bottom:        '10px',
      right:         '10px',
      width:         '36px',
      height:        '36px',
      background:    '#e50914',
      color:         '#fff',
      fontSize:      '18px',
      lineHeight:    '36px',
      textAlign:     'center',
      borderRadius:  '50%',
      textDecoration:'none',
      zIndex:        '9999',
      cursor:        'pointer',
      pointerEvents: 'auto'
    });
    a.className = 'vix-circle-btn';
    return a;
  }

  // ◆ Inietta il pulsante se non già presente
  function injectCircle(container, url) {
    if (!container || container.querySelector('.vix-circle-btn')) return;
    container.style.position = 'relative';
    container.appendChild(createCircleBtn(url));
  }

  // ◆ Scarica e parsifica la pagina di dettaglio Trakt per estrarre TMDB ID
  async function fetchTmdbIdFromDetailPage(path) {
    try {
      const res = await fetch(path, { credentials: 'include' });
      const txt = await res.text();
      const doc = new DOMParser().parseFromString(txt, 'text/html');
      const el  = doc.querySelector('a[href*="themoviedb.org/movie/"], a[href*="themoviedb.org/tv/"]');
      if (!el) return null;
      const m = el.href.match(/themoviedb\.org\/(?:movie|tv)\/(\d+)/);
      return m ? m[1] : null;
    } catch {
      return null;
    }
  }

  // ◆ Processa ogni <a> “movie” o “episode”
  async function processAnchor(a) {
    if (a.__vix_processed) return;
    a.__vix_processed = true;

    const url = new URL(a.href, location.origin);
    const path = url.pathname;
    let outUrl = null;

    // — Film
    if (/^\/movies\/[^/]+/.test(path)) {
      const tmdbId = await fetchTmdbIdFromDetailPage(path);
      if (tmdbId) {
        outUrl = `https://vixsrc.to/movie/${tmdbId}`;
      }
    }
    // — Episodio
    const epMatch = path.match(/^\/shows\/[^/]+\/seasons\/(\d+)\/episodes\/(\d+)/);
    if (!outUrl && epMatch) {
      const season  = epMatch[1];
      const episode = epMatch[2];
      const tmdbShowId = await fetchTmdbIdFromDetailPage(path);
      if (tmdbShowId) {
        outUrl = `https://vixsrc.to/tv/${tmdbShowId}/${season}/${episode}`;
      }
    }
    if (!outUrl) return;

    // trova il contenitore giusto: poster.with-overflow, fanart, poster
    const container = a.closest('div.poster.with-overflow')
                   || a.closest('div.fanart')
                   || a.closest('div.poster');
    injectCircle(container, outUrl);
  }

  // ◆ Scansiona tutti gli <a> rilevanti già presenti
  function scanAllAnchors() {
    document.querySelectorAll('a[href^="/movies/"], a[href^="/shows/"]').forEach(processAnchor);
  }

  // ── Hook SPA navigation: pushState + replaceState ────────────────────────
  ['pushState','replaceState'].forEach(fn => {
    const orig = history[fn];
    history[fn] = function(...args) {
      const ret = orig.apply(this, args);
      setTimeout(scanAllAnchors, 300);
      return ret;
    };
  });
  window.addEventListener('popstate', () => setTimeout(scanAllAnchors, 300));

  // ── Observer per intercettare nuovi <a> nel DOM ──────────────────────────
  const observer = new MutationObserver(muts => {
    muts.forEach(m => {
      m.addedNodes.forEach(node => {
        if (!(node instanceof Element)) return;
        if (node.matches('a[href^="/movies/"], a[href^="/shows/"]')) {
          processAnchor(node);
        }
        node.querySelectorAll && node.querySelectorAll('a[href^="/movies/"], a[href^="/shows/"]')
            .forEach(processAnchor);
      });
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // ── Esegui al caricamento iniziale ────────────────────────────────────────
  window.addEventListener('load', () => setTimeout(scanAllAnchors, 300));

})();
