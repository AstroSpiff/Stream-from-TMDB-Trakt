// ==UserScript==
// @name         VixSrc Play HD – TMDB & Trakt Circle Only
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  Film e episodi: solo pallino rosso ▶ in basso-destra. TMDB & Trakt, usa tmdbId/season/episode.
// @match        https://www.themoviedb.org/*
// @match        https://trakt.tv/*
// @grant        none
// ==/UserScript==

(function(){
    'use strict';

    // ◆ Creazione pallino rosso con triangolino
    function createCircleBtn(url) {
        const a = document.createElement('a');
        a.href = url + '?autoplay=true&theme=dark&lang=it&res=1080';
        a.target = '_blank';
        a.textContent = '▶';
        a.className = 'vix-circle-btn';
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
            borderRadius: '50%',
            textDecoration:'none',
            zIndex:     '9999',
            cursor:     'pointer',
            pointerEvents: 'auto'
        });
        return a;
    }

    // ◆ Inietta pallino rosso su un container
    function injectCircle(container, url) {
        if (!container || container.querySelector('.vix-circle-btn')) return;
        container.style.position = 'relative';
        container.appendChild(createCircleBtn(url));
    }

    // ◆ Scansione TMDB (film + tutti gli episodi)
    function scanTMDB() {
        const parts = location.pathname.split('/').filter(Boolean);

        // — Film detail
        if (parts[0] === 'movie' && parts[1]) {
            const tmdbId   = parts[1].split('-')[0];
            const posterEl = document.querySelector('.poster img')?.parentElement;
            injectCircle(posterEl, `https://vixsrc.to/movie/${tmdbId}`);
        }

        // — Episodi (stagione elenco o dettaglio episodio via .episode_list)
        document.querySelectorAll('.episode_list .card[data-url]').forEach(card => {
            const urlAttr = card.getAttribute('data-url');
            const m = urlAttr.match(/\/tv\/(\d+)\/season\/(\d+)\/episode\/(\d+)/);
            if (!m) return;
            const [ , id, season, episode ] = m;
            const imgDiv = card.querySelector('.image');
            injectCircle(imgDiv, `https://vixsrc.to/tv/${id}/${season}/${episode}`);
        });
    }

    // ◆ Scansione Trakt (film + episodi)
    function scanTrakt() {
        const parts = location.pathname.split('/').filter(Boolean);
        const type  = parts[0]; // 'movies' o 'shows'
        const tmdbLink = document.querySelector(
            `a[href*="themoviedb.org/${ type==='movies'?'movie':'tv' }"]`
        );
        if (!tmdbLink) return;
        const hrefParts = tmdbLink.href.split('/');
        const tmdbId = hrefParts[hrefParts.length-1] || hrefParts[hrefParts.length-2];

        // — Film detail
        if (type === 'movies') {
            const posterEl = document.querySelector('.col-image .poster img')?.parentElement
                          || document.querySelector('.poster img')?.parentElement;
            injectCircle(posterEl, `https://vixsrc.to/movie/${tmdbId}`);
        }

        // — Episodi lista stagioni/elenco
        if (type === 'shows') {
            document.querySelectorAll('a[href*="/seasons/"][href*="/episodes/"] img').forEach(img => {
                const href = img.closest('a').href;
                const m = href.match(/\/seasons\/(\d+)\/episodes\/(\d+)/);
                if (!m) return;
                const [ , season, episode ] = m;
                injectCircle(img.parentElement, `https://vixsrc.to/tv/${tmdbId}/${season}/${episode}`);
            });
        }
    }

    // ◆ Avvio + gestione SPA
    function run() {
        if (location.hostname.includes('themoviedb.org')) scanTMDB();
        else if (location.hostname.includes('trakt.tv'))       scanTrakt();
    }

    run();
    new MutationObserver(run).observe(document.body, { childList:true, subtree:true });

})();
