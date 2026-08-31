/* 소식/정보 — 메인 히어로 아래 카드 목록과 본문 팝업.
 *
 * 이 페이지는 정적 HTML로 배포되므로 supabase-js를 쓰지 않고 PostgREST의 RPC
 * 엔드포인트를 fetch로 직접 호출한다. 아래 키는 공개용 publishable 키이며
 * 이미 공개 번들에 포함돼 있던 값이다. 두 RPC 모두 anon 실행만 허용돼 있고
 * 읽기 전용이라 로그인 없이 읽는 것 외에는 아무것도 할 수 없다.
 */
(function () {
    'use strict';

    var SUPABASE_URL = 'https://vzswlvumcdxnryrfwkkl.supabase.co';
    var SUPABASE_KEY = 'sb_publishable_Jl43SzCeIQ90W-yYKgCQNA_2bS1K7Sd';
    var ARTICLE_LIMIT = 9;

    var grid = document.getElementById('news-grid');
    if (!grid || typeof fetch !== 'function') return;

    function callRpc(name, body) {
        return fetch(SUPABASE_URL + '/rest/v1/rpc/' + name, {
            method: 'POST',
            headers: {
                apikey: SUPABASE_KEY,
                Authorization: 'Bearer ' + SUPABASE_KEY,
                'Content-Type': 'application/json',
                Accept: 'application/json'
            },
            body: JSON.stringify(body || {})
        }).then(function (response) {
            if (!response.ok) throw new Error('rpc_failed_' + response.status);
            return response.json();
        });
    }

    /* 본문은 관리자가 저장할 때 서버에서 한 번 걸러지지만, 화면에 넣기 전에
     * 한 번 더 허용 태그만 남긴다. (React 쪽 popupHtml.js와 같은 기준) */
    var ALLOWED_TAGS = ['A', 'B', 'BLOCKQUOTE', 'BR', 'CODE', 'DIV', 'EM', 'H1', 'H2', 'H3', 'H4', 'HR',
        'I', 'IMG', 'LI', 'OL', 'P', 'PRE', 'S', 'SPAN', 'STRONG', 'TABLE', 'TBODY', 'TD',
        'TH', 'THEAD', 'TR', 'U', 'UL'];
    var BLOCKED_TAGS = ['BASE', 'BUTTON', 'EMBED', 'FORM', 'IFRAME', 'INPUT', 'LINK', 'META', 'OBJECT', 'SCRIPT', 'STYLE'];
    var SAFE_STYLE = ['background-color', 'border', 'border-radius', 'color', 'font-size', 'font-weight',
        'line-height', 'margin', 'margin-bottom', 'margin-left', 'margin-right', 'margin-top',
        'padding', 'padding-bottom', 'padding-left', 'padding-right', 'padding-top', 'text-align'];

    function sanitizeStyle(value) {
        return value.split(';').map(function (declaration) {
            var parts = declaration.split(':');
            if (parts.length < 2) return '';
            var property = parts.shift().trim().toLowerCase();
            var styleValue = parts.join(':').trim();
            if (SAFE_STYLE.indexOf(property) === -1) return '';
            if (/url\s*\(|expression\s*\(|javascript:|position\s*:/i.test(styleValue)) return '';
            return property + ': ' + styleValue;
        }).filter(Boolean).join('; ');
    }

    function sanitizeHtml(value) {
        if (!value) return '';
        var parsed = new DOMParser().parseFromString('<body>' + String(value) + '</body>', 'text/html');
        var elements = Array.prototype.slice.call(parsed.body.querySelectorAll('*'));

        elements.forEach(function (element) {
            if (BLOCKED_TAGS.indexOf(element.tagName) !== -1) {
                if (element.parentNode) element.parentNode.removeChild(element);
                return;
            }
            if (ALLOWED_TAGS.indexOf(element.tagName) === -1) {
                var parent = element.parentNode;
                if (!parent) return;
                while (element.firstChild) parent.insertBefore(element.firstChild, element);
                parent.removeChild(element);
                return;
            }

            Array.prototype.slice.call(element.attributes).forEach(function (attribute) {
                var name = attribute.name.toLowerCase();
                var allowed = name === 'style'
                    || (element.tagName === 'A' && ['href', 'target', 'rel'].indexOf(name) !== -1)
                    || (element.tagName === 'IMG' && ['src', 'alt', 'width', 'height', 'loading'].indexOf(name) !== -1)
                    || (['TD', 'TH'].indexOf(element.tagName) !== -1 && ['colspan', 'rowspan'].indexOf(name) !== -1);
                if (!allowed || name.indexOf('on') === 0) element.removeAttribute(attribute.name);
            });

            if (element.hasAttribute('style')) {
                var safeStyle = sanitizeStyle(element.getAttribute('style') || '');
                if (safeStyle) element.setAttribute('style', safeStyle);
                else element.removeAttribute('style');
            }

            if (element.tagName === 'IMG') {
                var src = element.getAttribute('src') || '';
                // https 절대주소나 사이트 내부 경로만 남긴다.
                if (!/^(https:\/\/|\/)/i.test(src)) {
                    if (element.parentNode) element.parentNode.removeChild(element);
                    return;
                }
                element.setAttribute('loading', 'lazy');
            }

            if (element.tagName === 'A') {
                var href = element.getAttribute('href') || '';
                if (!/^(https?:|mailto:|tel:|#|\/)/i.test(href)) element.removeAttribute('href');
                if (element.getAttribute('target') === '_blank') element.setAttribute('rel', 'noopener noreferrer');
                else element.removeAttribute('target');
            }
        });

        return parsed.body.innerHTML;
    }

    function formatDate(value) {
        var date = new Date(value);
        if (isNaN(date.getTime())) return '';
        return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
    }

    function element(tag, className, text) {
        var node = document.createElement(tag);
        if (className) node.className = className;
        if (text != null) node.textContent = text;
        return node;
    }

    /* ---------------------------------------------------------------- 팝업 */
    var overlay = null;
    var lastFocused = null;

    function closeDialog() {
        if (!overlay) return;
        document.removeEventListener('keydown', onKeyDown);
        document.body.style.overflow = '';
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        overlay = null;
        if (lastFocused && lastFocused.focus) lastFocused.focus();
    }

    function onKeyDown(event) {
        if (event.key === 'Escape') closeDialog();
    }

    function openDialog(article) {
        closeDialog();
        lastFocused = document.activeElement;

        overlay = element('div', 'site-popup-layer');
        overlay.setAttribute('role', 'presentation');
        overlay.addEventListener('click', function (event) {
            if (event.target === overlay) closeDialog();
        });

        var dialog = element('section', 'site-popup-dialog site-popup-dialog--large site-news-dialog');
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-label', article.title);

        var header = element('header');
        var heading = element('div', 'site-news-dialog-heading');
        if (article.category) heading.appendChild(element('span', 'site-news-chip', article.category));
        heading.appendChild(element('h2', null, article.title));
        var time = element('time', null, formatDate(article.published_at));
        time.setAttribute('dateTime', article.published_at);
        heading.appendChild(time);
        header.appendChild(heading);

        var closeButton = element('button', null, '×');
        closeButton.type = 'button';
        closeButton.setAttribute('aria-label', '닫기');
        closeButton.addEventListener('click', closeDialog);
        header.appendChild(closeButton);

        var body = element('div', 'site-popup-body');
        body.appendChild(element('p', 'site-news-dialog-state', '본문을 불러오고 있습니다.'));

        var footer = element('footer');
        var actions = element('div', 'site-popup-footer-actions');
        var footerClose = element('button', null, '닫기');
        footerClose.type = 'button';
        footerClose.addEventListener('click', closeDialog);
        actions.appendChild(footerClose);
        footer.appendChild(actions);

        dialog.appendChild(header);
        dialog.appendChild(body);
        dialog.appendChild(footer);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';
        document.addEventListener('keydown', onKeyDown);
        closeButton.focus();

        callRpc('get_public_site_article', { p_id: article.id }).then(function (rows) {
            var found = Array.isArray(rows) ? rows[0] : rows;
            if (!found) throw new Error('not_found');
            body.innerHTML = '';
            var document_ = element('div', 'site-popup-document');
            document_.innerHTML = sanitizeHtml(found.content_html);
            body.appendChild(document_);
        }).catch(function () {
            body.innerHTML = '';
            var failed = element('p', 'site-news-dialog-state', '본문을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
            failed.setAttribute('role', 'alert');
            body.appendChild(failed);
        });
    }

    /* ---------------------------------------------------------------- 목록 */
    function buildCard(article) {
        var item = document.createElement('li');
        var card = element('button', 'news-card');
        card.type = 'button';
        card.addEventListener('click', function () { openDialog(article); });

        var thumb = element('span', 'news-card-thumb');
        if (article.thumbnail_url) {
            var image = document.createElement('img');
            image.src = article.thumbnail_url;
            image.alt = '';
            image.loading = 'lazy';
            image.decoding = 'async';
            thumb.appendChild(image);
        } else {
            var fallback = element('span', 'news-card-thumb-fallback', 'JEAKYUNG');
            fallback.setAttribute('aria-hidden', 'true');
            thumb.appendChild(fallback);
        }
        card.appendChild(thumb);

        var cardBody = element('span', 'news-card-body');
        var meta = element('span', 'news-card-meta');
        if (article.category) meta.appendChild(element('span', 'site-news-chip', article.category));
        var time = element('time', null, formatDate(article.published_at));
        time.setAttribute('dateTime', article.published_at);
        meta.appendChild(time);
        cardBody.appendChild(meta);

        cardBody.appendChild(element('strong', null, article.title));
        if (article.summary) cardBody.appendChild(element('span', 'news-card-summary', article.summary));

        var more = element('span', 'news-card-more', '자세히 보기 ');
        var arrow = element('i', null, '→');
        arrow.setAttribute('aria-hidden', 'true');
        more.appendChild(arrow);
        cardBody.appendChild(more);

        card.appendChild(cardBody);
        item.appendChild(card);
        return item;
    }

    function renderEmpty(message) {
        var section = grid.parentNode;
        grid.removeAttribute('aria-busy');
        if (section) {
            var note = element('p', 'news-empty', message);
            grid.parentNode.replaceChild(note, grid);
        }
    }

    callRpc('get_public_site_articles', { p_limit: ARTICLE_LIMIT }).then(function (articles) {
        if (!Array.isArray(articles) || articles.length === 0) {
            renderEmpty('준비 중입니다. 곧 새로운 소식으로 찾아뵙겠습니다.');
            return;
        }
        grid.innerHTML = '';
        grid.removeAttribute('aria-busy');
        articles.forEach(function (article) { grid.appendChild(buildCard(article)); });
    }).catch(function () {
        renderEmpty('소식을 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.');
    });
}());
