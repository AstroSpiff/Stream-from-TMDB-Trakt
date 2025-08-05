// ==UserScript==
// @name         VixSrc Play HD – Trakt Anchor Observer + Detail Pages
// @namespace    http://tampermonkey.net/
// @version      1.14
// @description  ▶ pallino rosso in basso-destra su film & episodi Trakt (liste SPA + pagine dettaglio)  
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
    if (getComputedStyle(container).position === 'static') {
      container.style.position = 'relative';
    }
    container.appendChild(createCircleBtn(url));
  }

  // ◆ Processa ogni <a> “movie” o “episode” nelle liste/dashboard
  async function processAnchor(a) {
    if (a.__vix_processed) return;
    a.__vix_processed = true;

    const href = a.getAttribute('href');
    // solo link interni Trakt
    if (!href.startsWith('/movies/') && !href.startsWith('/shows/')) return;

    // container candidato
    const container = a.closest('div.poster.with-overflow')
                   || a.closest('div.fanart')
                   || a.closest('div.poster');

    // se già dentro una pagina dettaglio, skip
    if (!container) return;

    // Estrai la path
    const path = href.split('?')[0];

    // — Film
    if (/^\/movies\/[^/]+/.test(path)) {
      // chiamo il dettaglio in pagina per recuperare TMDB ID
      const el = document.querySelector('a[href*="themoviedb.org/movie/"]');
      if (el) {
        const m = el.href.match(/themoviedb\.org\/movie\/(\d+)/);
        if (m) {
          injectCircle(container, `https://vixsrc.to/movie/${m[1]}`);
          return;
        }
      }
      // fallback fetch se non in pagina (liste/dashboard)
      const traktId = a.closest('[data-movie-id]')?.getAttribute('data-movie-id');
      if (traktId) {
        try {
          const res = await fetch(`/movies/${traktId}`,{credentials:'include'});
          const txt = await res.text();
          const doc = new DOMParser().parseFromString(txt,'text/html');
          const el2 = doc.querySelector('a[href*="themoviedb.org/movie/"]');
          const m2 = el2 && el2.href.match(/themoviedb\.org\/movie\/(\d+)/);
          if (m2) injectCircle(container, `https://vixsrc.to/movie/${m2[1]}`);
        } catch {}
      }
      return;
    }

    // — Episodio
    const epMatch = path.match(/^\/shows\/[^/]+\/seasons\/(\d+)\/episodes\/(\d+)/);
    if (epMatch) {
      // prova in pagina
      const el = document.querySelector('a[href*="themoviedb.org/tv/"]');
      if (el) {
        const m = el.href.match(/themoviedb\.org\/tv\/(\d+)\/season\/(\d+)\/episode\/(\d+)/);
        if (m) {
          injectCircle(container, `https://vixsrc.to/tv/${m[1]}/${m[2]}/${m[3]}`);
          return;
        }
      }
      // fallback fetch
      const epId = a.closest('[data-episode-id]')?.getAttribute('data-episode-id');
      if (epId) {
        try {
          const res = await fetch(`/episodes/${epId}`,{credentials:'include'});
          const txt = await res.text();
          const doc = new DOMParser().parseFromString(txt,'text/html');
          const el2 = doc.querySelector('a[href*="themoviedb.org/tv/"]');
          const m2 = el2 && el2.href.match(/themoviedb\.org\/tv\/(\d+)\/season\/(\d+)\/episode\/(\d+)/);
          if (m2) injectCircle(container, `https://vixsrc.to/tv/${m2[1]}/${m2[2]}/${m2[3]}`);
        } catch {}
      }
    }
  }

  // ◆ Scansiona tutti gli <a> rilevanti già presenti
  function scanAllAnchors() {
    document.querySelectorAll('a[href^="/movies/"], a[href^="/shows/"]').forEach(processAnchor);
  }

  // ── Aggiunge anche direttamente sulle pagine di dettaglio, senza click su <a>
  function scanDetailPage() {
    const path = location.pathname.split('?')[0];

    // — DETTAGLIO FILM
    if (/^\/movies\/[^/]+/.test(path)) {
      const el = document.querySelector('a[href*="themoviedb.org/movie/"]');
      const poster = document.querySelector('.sidebar.sticky.posters .poster.with-overflow');
      if (el && poster) {
        const m = el.href.match(/themoviedb\.org\/movie\/(\d+)/);
        if (m) injectCircle(poster, `https://vixsrc.to/movie/${m[1]}`);
      }
    }

    // — DETTAGLIO EPISODIO
    if (/^\/shows\/[^/]+\/seasons\/\d+\/episodes\/\d+/.test(path)) {
      const el = document.querySelector('a[href*="themoviedb.org/tv/"]');
      const poster = document.querySelector('.sidebar.sticky.posters .poster.with-overflow');
      if (el && poster) {
        const m = el.href.match(/themoviedb\.org\/tv\/(\d+)\/season\/(\d+)\/episode\/(\d+)/);
        if (m) injectCircle(poster, `https://vixsrc.to/tv/${m[1]}/${m[2]}/${m[3]}`);
      }
    }
  }

  // ── Hook SPA navigation: pushState + replaceState ────────────────────────
  ['pushState','replaceState'].forEach(fn => {
    const orig = history[fn];
    history[fn] = function(...args) {
      const ret = orig.apply(this, args);
      setTimeout(() => {
        scanDetailPage();
        scanAllAnchors();
      }, 300);
      return ret;
    };
  });
  window.addEventListener('popstate', () => {
    setTimeout(() => {
      scanDetailPage();
      scanAllAnchors();
    }, 300);
  });

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
  window.addEventListener('load', () => {
    setTimeout(() => {
      scanDetailPage();
      scanAllAnchors();
    }, 300);
  });

})();
