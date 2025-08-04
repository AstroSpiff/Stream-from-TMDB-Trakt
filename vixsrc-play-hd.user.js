// ==UserScript==
// @name         VixSrc Play HD – TMDB & Trakt (Link Check)
// @namespace    http://tampermonkey.net/
// @version      1.4
// @description  Film e episodi: solo pallino rosso ▶ in basso-destra, con HEAD check del link prima di mostrarsi.
// @match        https://www.themoviedb.org/*
// @match        https://trakt.tv/*
// @grant        none
// ==/UserScript==

(function(){
  'use strict';

  // verifica che l’endpoint risponda OK (HEAD)  
  async function isLinkValid(baseUrl) {
    try {
      const response = await fetch(baseUrl, { method: 'HEAD', mode: 'cors' });
      return response.ok;
    } catch (e) {
      console.warn('VixSrc link check failed:', e);
      return false;
    }
  }

  // crea il pallino rosso ▶  
  function createCircleBtn(baseUrl) {
    const a = document.createElement('a');
    a.href = baseUrl + '?autoplay=true&theme=dark&lang=it&res=1080';
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
    return a;
  }

  // inietta il pallino solo se non già presente
  function injectCircle(container, baseUrl) {
    if (!container || container.querySelector('.vix-circle-btn')) return;
    container.style.position = 'relative';
    const btn = createCircleBtn(baseUrl);
    btn.classList.add('vix-circle-btn');
    container.appendChild(btn);
  }

  // prova a iniettare dopo il controllo link  
  function tryInject(container, baseUrl) {
    if (!container) return;
    // lancia controllo HEAD e poi inietta
    isLinkValid(baseUrl).then(valid => {
      if (valid) injectCircle(container, baseUrl);
    });
  }

  // scansione TMDB
  function scanTMDB() {
    const parts = location.pathname.split('/').filter(Boolean);

    // — dettaglio film
    if (parts[0] === 'movie' && parts[1]) {
      const tmdbId = parts[1].split('-')[0];
      const posterEl = document.querySelector('.poster img')?.parentElement;
      tryInject(posterEl, `https://vixsrc.to/movie/${tmdbId}`);
    }

    // — elenco episodi (stagione o dettagli)
    document.querySelectorAll('.episode_list .card[data-url]').forEach(card => {
      const dataUrl = card.getAttribute('data-url');
      const m = dataUrl.match(/\/tv\/(\d+)\/season\/(\d+)\/episode\/(\d+)/);
      if (!m) return;
      const [ , id, season, episode ] = m;
      const imgDiv = card.querySelector('.image');
      tryInject(imgDiv, `https://vixsrc.to/tv/${id}/${season}/${episode}`);
    });
  }

  // scansione Trakt
  function scanTrakt() {
    const parts = location.pathname.split('/').filter(Boolean);
    const type  = parts[0]; // 'movies' o 'shows'
    const tmdbLink = document.querySelector(
      `a[href*="themoviedb.org/${ type==='movies'?'movie':'tv' }"]`
    );
    if (!tmdbLink) return;
    const hrefParts = tmdbLink.href.split('/');
    const tmdbId = hrefParts.pop() || hrefParts.pop();

    // — dettaglio film
    if (type === 'movies') {
      const posterEl = document.querySelector('.col-image .poster img')?.parentElement
                    || document.querySelector('.poster img')?.parentElement;
      tryInject(posterEl, `https://vixsrc.to/movie/${tmdbId}`);
    }

    // — elenco episodi stagioni
    if (type === 'shows') {
      document.querySelectorAll('a[href*="/seasons/"][href*="/episodes/"] img').forEach(img => {
        const href = img.closest('a').href;
        const m = href.match(/\/seasons\/(\d+)\/episodes\/(\d+)/);
        if (!m) return;
        const [ , season, episode ] = m;
        tryInject(img.parentElement, `https://vixsrc.to/tv/${tmdbId}/${season}/${episode}`);
      });
    }
  }

  // inizializza ed osserva cambi SPA
  function run() {
    if (location.hostname.includes('themoviedb.org')) scanTMDB();
    else if (location.hostname.includes('trakt.tv'))       scanTrakt();
  }

  run();
  new MutationObserver(run).observe(document.body, { childList:true, subtree:true });

})();
