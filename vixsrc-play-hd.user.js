// ==UserScript==
// @name         VixSrc Play HD – TMDB & Trakt (Availability Check)
// @namespace    http://tampermonkey.net/
// @version      1.5
// @description  Film e episodi: pallino rosso ▶ in basso-destra, verifica disponibilità via API before showing button.
// @match        https://www.themoviedb.org/*
// @match        https://trakt.tv/*
// @grant        none
// ==/UserScript==

(function(){
    'use strict';

    // ◆ Verifica se un film è disponibile (API List Movie)
    async function isMovieAvailable(tmdbId) {
        try {
            const url = `https://vixsrc.to/api/list/movie?lang=it&tmdbId=${tmdbId}`;
            const resp = await fetch(url, { method: 'GET', mode: 'cors' });
            if (!resp.ok) return false;
            const data = await resp.json();
            return Array.isArray(data) && data.length > 0;
        } catch (e) {
            console.warn('VixSrc movie list API error:', e);
            return false;
        }
    }

    // ◆ Verifica se un episodio è disponibile (API List Episode)
    async function isEpisodeAvailable(tmdbId, season, episode) {
        try {
            const url = `https://vixsrc.to/api/list/episode?lang=it&tmdbId=${tmdbId}&season=${season}&episode=${episode}`;
            const resp = await fetch(url, { method: 'GET', mode: 'cors' });
            if (!resp.ok) return false;
            const data = await resp.json();
            return Array.isArray(data) && data.length > 0;
        } catch (e) {
            console.warn('VixSrc episode list API error:', e);
            return false;
        }
    }

    // ◆ Crea il pallino rosso ▶
    function createCircleBtn(baseUrl) {
        const a = document.createElement('a');
        a.href = baseUrl + '?autoplay=true&theme=dark&lang=it&res=1080';
        a.target = '_blank';
        a.textContent = '▶';
        a.className = 'vix-circle-btn';
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

    // ◆ Inietta il pallino rosso in un container
    function injectCircle(container, baseUrl) {
        if (!container || container.querySelector('.vix-circle-btn')) return;
        container.style.position = 'relative';
        container.appendChild(createCircleBtn(baseUrl));
    }

    // ◆ Tenta di iniettare per film, dopo aver controllato disponibilità
    function tryInjectMovie(container, tmdbId) {
        if (!container) return;
        isMovieAvailable(tmdbId).then(ok => {
            if (ok) injectCircle(container, `https://vixsrc.to/movie/${tmdbId}`);
        });
    }

    // ◆ Tenta di iniettare per episodio, dopo aver controllato disponibilità
    function tryInjectEpisode(container, tmdbId, season, episode) {
        if (!container) return;
        isEpisodeAvailable(tmdbId, season, episode).then(ok => {
            if (ok) injectCircle(container, `https://vixsrc.to/tv/${tmdbId}/${season}/${episode}`);
        });
    }

    // ◆ Scansione TMDB
    function scanTMDB() {
        const parts = location.pathname.split('/').filter(Boolean);

        // — Film detail
        if (parts[0] === 'movie' && parts[1]) {
            const tmdbId   = parts[1].split('-')[0];
            const posterEl = document.querySelector('.poster img')?.parentElement;
            tryInjectMovie(posterEl, tmdbId);
        }

        // — Episodi (stagione elenco o dettaglio episodio via .episode_list)
        document.querySelectorAll('.episode_list .card[data-url]').forEach(card => {
            const dataUrl = card.getAttribute('data-url');
            const m = dataUrl.match(/\/tv\/(\d+)\/season\/(\d+)\/episode\/(\d+)/);
            if (!m) return;
            const [ , id, season, episode ] = m;
            const imgDiv = card.querySelector('.image');
            tryInjectEpisode(imgDiv, id, season, episode);
        });
    }

    // ◆ Scansione Trakt
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
            tryInjectMovie(posterEl, tmdbId);
        }

        // — Episodi lista stagioni/elenco
        if (type === 'shows') {
            document.querySelectorAll('a[href*="/seasons/"][href*="/episodes/"] img').forEach(img => {
                const href = img.closest('a').href;
                const m = href.match(/\/seasons\/(\d+)\/episodes\/(\d+)/);
                if (!m) return;
                const [ , season, episode ] = m;
                tryInjectEpisode(img.parentElement, tmdbId, season, episode);
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
