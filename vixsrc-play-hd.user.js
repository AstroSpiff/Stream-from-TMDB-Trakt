// ==UserScript==
// @name         VixSrc Play HD – TMDB & Trakt (List+HEAD Check)  
// @namespace    http://tampermonkey.net/  
// @version      1.6  
// @description  Pallino ▶ per film/episodi TMDB & Trakt: prima API list, poi fallback HEAD check.  
// @match        https://www.themoviedb.org/*  
// @match        https://trakt.tv/*  
// @grant        none  
// ==/UserScript==

;(function(){
  'use strict';

  // ——— Verifiche ———

  // HEAD check generico
  async function isLinkValid(baseUrl) {
    try {
      const r = await fetch(baseUrl, { method:'HEAD', mode:'cors' });
      return r.ok;
    } catch {
      return false;
    }
  }

  // API list movie
  async function isMovieAvailable(tmdbId) {
    try {
      const url = `https://vixsrc.to/api/list/movie?lang=it&tmdbId=${tmdbId}`;
      const r = await fetch(url, { method:'GET', mode:'cors' });
      if (!r.ok) return false;
      const arr = await r.json();
      return Array.isArray(arr) && arr.length>0;
    } catch {
      return false;
    }
  }

  // API list episode
  async function isEpisodeAvailable(tmdbId, season, episode) {
    try {
      const url = `https://vixsrc.to/api/list/episode?lang=it&tmdbId=${tmdbId}&season=${season}&episode=${episode}`;
      const r = await fetch(url, { method:'GET', mode:'cors' });
      if (!r.ok) return false;
      const arr = await r.json();
      return Array.isArray(arr) && arr.length>0;
    } catch {
      return false;
    }
  }

  // ——— Creazione e iniezione bottone ———

  function createCircleBtn(fullUrl) {
    const a = document.createElement('a');
    a.href = fullUrl + '?autoplay=true&theme=dark&lang=it&res=1080';
    a.target = '_blank';
    a.textContent = '▶';
    Object.assign(a.style, {
      position:   'absolute',
      bottom:     '10px',
      right:      '10px',
      width:      '36px',
      height:     '36px',
      background: '#e50914',
      color:      '#fff',
      fontSize:   '18px',
      lineHeight: '36px',
      textAlign:  'center',
      borderRadius:'50%',
      textDecoration:'none',
      zIndex:     '9999',
      cursor:     'pointer',
      pointerEvents:'auto'
    });
    a.classList.add('vix-circle-btn');
    return a;
  }

  function injectCircle(container, fullUrl) {
    if (!container || container.querySelector('.vix-circle-btn')) return;
    container.style.position = 'relative';
    container.appendChild(createCircleBtn(fullUrl));
  }

  // wrappers che provano prima API, poi HEAD
  async function tryInjectMovie(container, tmdbId) {
    const baseUrl = `https://vixsrc.to/movie/${tmdbId}`;
    if (await isMovieAvailable(tmdbId) || await isLinkValid(baseUrl)) {
      injectCircle(container, baseUrl);
    }
  }

  async function tryInjectEpisode(container, tmdbId, season, episode) {
    const baseUrl = `https://vixsrc.to/tv/${tmdbId}/${season}/${episode}`;
    if (await isEpisodeAvailable(tmdbId,season,episode) || await isLinkValid(baseUrl)) {
      injectCircle(container, baseUrl);
    }
  }

  // ——— TMDB scan ———

  function scanTMDB() {
    const parts = location.pathname.split('/').filter(Boolean);

    // film detail
    if (parts[0]==='movie' && parts[1]) {
      const tmdbId = parts[1].split('-')[0];
      const posterContainer = document.querySelector('.poster img')?.parentElement;
      tryInjectMovie(posterContainer, tmdbId);
    }

    // serie: miniature episodi in ogni lista
    document.querySelectorAll('.episode_list .card[data-url]').forEach(card => {
      const urlAttr = card.getAttribute('data-url');
      const m = urlAttr.match(/\/tv\/(\d+)\/season\/(\d+)\/episode\/(\d+)/);
      if (!m) return;
      const [ , id, season, episode ] = m;
      const imgDiv = card.querySelector('.image');
      tryInjectEpisode(imgDiv, id, season, episode);
    });
  }

  // ——— Trakt scan ———

  function scanTrakt() {
    const parts = location.pathname.split('/').filter(Boolean);
    const type  = parts[0]; // 'movies' o 'shows'
    const tmdbLink = document.querySelector(
      `a[href*="themoviedb.org/${ type==='movies'?'movie':'tv' }"]`
    );
    if (!tmdbLink) return;
    const hrefParts = tmdbLink.href.split('/');
    const tmdbId = hrefParts.pop()||hrefParts.pop();

    // film detail
    if (type==='movies') {
      const posterContainer = document.querySelector('.col-image .poster img')?.parentElement
                           || document.querySelector('.poster img')?.parentElement;
      tryInjectMovie(posterContainer, tmdbId);
    }

    // show: miniature episodi
    if (type==='shows') {
      document.querySelectorAll('a[href*="/seasons/"][href*="/episodes/"] img').forEach(img => {
        const href = img.closest('a').href;
        const m = href.match(/\/seasons\/(\d+)\/episodes\/(\d+)/);
        if (!m) return;
        const [ , season, episode ] = m;
        tryInjectEpisode(img.parentElement, tmdbId, season, episode);
      });
    }
  }

  // ——— Esecuzione + SPA observer ———

  async function run() {
    if (location.hostname.includes('themoviedb.org')) await scanTMDB();
    else if (location.hostname.includes('trakt.tv'))       await scanTrakt();
  }

  run();
  new MutationObserver(run).observe(document.body, {
    childList: true, subtree: true
  });

})();
