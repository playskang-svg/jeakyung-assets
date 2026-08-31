/* 소식/정보 전용 페이지 (/news/).
 *
 * 분류 탭으로 목록을 거르고, 글을 누르면 같은 화면에서 본문이 열린다.
 * 본문에서는 뒤로가기 / 목록 보기 / 닫기 버튼과 브라우저 뒤로가기가 모두
 * 목록으로 돌아온다. 정적 페이지라 supabase-js 없이 PostgREST RPC를 직접
 * 호출한다(js/news.js 와 같은 방식).
 */
(function () {
    'use strict';

    var SUPABASE_URL = 'https://vzswlvumcdxnryrfwkkl.supabase.co';
    var SUPABASE_KEY = 'sb_publishable_Jl43SzCeIQ90W-yYKgCQNA_2bS1K7Sd';
    var ARTICLE_LIMIT = 50;
    var ALL = '__all__';

    var listView = document.getElementById('news-list-view');
    var grid = document.getElementById('news-grid');
    var tabs = document.getElementById('news-categories');
    var articleView = document.getElementById('news-article-view');
    if (!listView || !grid || !tabs || !articleView || typeof fetch !== 'function') return;

    var elCategory = document.getElementById('news-article-category');
    var elDate = document.getElementById('news-article-date');
    var elTitle = document.getElementById('news-article-title');
    var elSummary = document.getElementById('news-article-summary');
    var elThumb = document.getElementById('news-article-thumb');
    var elBody = document.getElementById('news-article-body');

    var articles = [];
    var activeCategory = ALL;
    var openId = null;
    var detailCache = {};

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

    /* --- 본문 정리: js/news.js 와 같은 허용 기준 --- */
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
        Array.prototype.slice.call(parsed.body.querySelectorAll('*')).forEach(function (element) {
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

    /* ------------------------------------------------------------- 목록 */
    function visibleArticles() {
        if (activeCategory === ALL) return articles;
        return articles.filter(function (a) { return (a.category || '') === activeCategory; });
    }

    function renderTabs() {
        var names = [];
        articles.forEach(function (a) {
            if (a.category && names.indexOf(a.category) === -1) names.push(a.category);
        });
        tabs.innerHTML = '';
        if (names.length === 0) return;

        [[ALL, '전체']].concat(names.map(function (n) { return [n, n]; })).forEach(function (pair) {
            var button = element('button', 'news-category' + (activeCategory === pair[0] ? ' is-active' : ''), pair[1]);
            button.type = 'button';
            button.setAttribute('aria-pressed', activeCategory === pair[0] ? 'true' : 'false');
            button.addEventListener('click', function () {
                activeCategory = pair[0];
                renderTabs();
                renderList();
            });
            tabs.appendChild(button);
        });
    }

    function buildCard(article) {
        var item = document.createElement('li');
        var card = element('button', 'news-card');
        card.type = 'button';
        card.addEventListener('click', function () { openArticle(article.id, true); });

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

        var body = element('span', 'news-card-body');
        var meta = element('span', 'news-card-meta');
        if (article.category) meta.appendChild(element('span', 'site-news-chip', article.category));
        var time = element('time', null, formatDate(article.published_at));
        time.setAttribute('dateTime', article.published_at);
        meta.appendChild(time);
        body.appendChild(meta);
        body.appendChild(element('strong', null, article.title));
        if (article.summary) body.appendChild(element('span', 'news-card-summary', article.summary));
        var more = element('span', 'news-card-more', '자세히 보기 ');
        var arrow = element('i', null, '→');
        arrow.setAttribute('aria-hidden', 'true');
        more.appendChild(arrow);
        body.appendChild(more);

        card.appendChild(body);
        item.appendChild(card);
        return item;
    }

    function renderList() {
        var items = visibleArticles();
        grid.innerHTML = '';
        grid.removeAttribute('aria-busy');
        if (items.length === 0) {
            var empty = element('li', 'news-empty-row');
            empty.appendChild(element('p', 'news-empty', '이 분류에 등록된 글이 없습니다.'));
            grid.appendChild(empty);
            return;
        }
        items.forEach(function (article) { grid.appendChild(buildCard(article)); });
    }

    /* ------------------------------------------------------------- 본문 */
    function showList() {
        openId = null;
        articleView.hidden = true;
        listView.hidden = false;
        document.title = '소식/정보 | 재경닷컴';
    }

    function fillArticle(article, detail) {
        if (article.category) {
            elCategory.textContent = article.category;
            elCategory.hidden = false;
        } else {
            elCategory.hidden = true;
        }
        elDate.textContent = formatDate(article.published_at);
        elDate.setAttribute('dateTime', article.published_at);
        elTitle.textContent = article.title;

        if (article.summary) {
            elSummary.textContent = article.summary;
            elSummary.hidden = false;
        } else {
            elSummary.hidden = true;
        }

        elThumb.innerHTML = '';
        // 썸네일이 본문 맨 앞 이미지에서 자동으로 뽑힌 경우, 본문에도 같은 이미지가
        // 있으므로 위에 또 띄우면 두 번 나온다. 그때는 생략한다.
        var bodyHasThumb = article.thumbnail_url && detail
            && detail.content_html && detail.content_html.indexOf(article.thumbnail_url) !== -1;
        if (article.thumbnail_url && !bodyHasThumb) {
            var image = document.createElement('img');
            image.src = article.thumbnail_url;
            image.alt = '';
            elThumb.appendChild(image);
            elThumb.hidden = false;
        } else {
            elThumb.hidden = true;
        }

        elBody.innerHTML = detail ? sanitizeHtml(detail.content_html) : '';
        document.title = article.title + ' | 소식/정보 | 재경닷컴';
    }

    function openArticle(id, pushState) {
        var article = null;
        for (var i = 0; i < articles.length; i += 1) {
            if (articles[i].id === id) { article = articles[i]; break; }
        }
        if (!article) return;

        openId = id;
        listView.hidden = true;
        articleView.hidden = false;
        window.scrollTo({ top: 0, behavior: 'auto' });
        if (pushState && window.history && window.history.pushState) {
            window.history.pushState({ articleId: id }, '', '?article=' + encodeURIComponent(id));
        }

        fillArticle(article, null);
        elBody.innerHTML = '';
        elBody.appendChild(element('p', 'site-news-dialog-state', '본문을 불러오고 있습니다.'));

        if (detailCache[id]) {
            fillArticle(article, detailCache[id]);
            return;
        }

        callRpc('get_public_site_article', { p_id: id }).then(function (rows) {
            var found = Array.isArray(rows) ? rows[0] : rows;
            if (!found) throw new Error('not_found');
            detailCache[id] = found;
            if (openId === id) fillArticle(article, found);
        }).catch(function () {
            if (openId !== id) return;
            elBody.innerHTML = '';
            var failed = element('p', 'site-news-dialog-state', '본문을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
            failed.setAttribute('role', 'alert');
            elBody.appendChild(failed);
        });
    }

    /* 뒤로가기 / 목록 보기 / 닫기 — 모두 목록으로 돌아온다. */
    function closeArticle() {
        if (!openId) return;
        if (window.history && window.history.state && window.history.state.articleId) {
            window.history.back();   // popstate 처리기가 showList 를 부른다
        } else {
            if (window.history && window.history.replaceState) {
                window.history.replaceState({}, '', window.location.pathname);
            }
            showList();
        }
    }

    Array.prototype.slice.call(articleView.querySelectorAll('[data-news-close]')).forEach(function (button) {
        button.addEventListener('click', closeArticle);
    });

    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && openId) closeArticle();
    });

    window.addEventListener('popstate', function (event) {
        var id = event.state && event.state.articleId;
        if (id) openArticle(id, false);
        else showList();
    });

    /* -------------------------------------------------------------- 시작 */
    function currentArticleParam() {
        var match = window.location.search.match(/[?&]article=([^&]+)/);
        return match ? decodeURIComponent(match[1]) : null;
    }

    callRpc('get_public_site_articles', { p_limit: ARTICLE_LIMIT }).then(function (rows) {
        articles = Array.isArray(rows) ? rows : [];
        if (articles.length === 0) {
            grid.innerHTML = '';
            grid.removeAttribute('aria-busy');
            var empty = element('li', 'news-empty-row');
            empty.appendChild(element('p', 'news-empty', '준비 중입니다. 곧 새로운 소식으로 찾아뵙겠습니다.'));
            grid.appendChild(empty);
            return;
        }
        renderTabs();
        renderList();

        var requested = currentArticleParam();
        if (requested) openArticle(requested, false);
    }).catch(function () {
        grid.innerHTML = '';
        grid.removeAttribute('aria-busy');
        var failed = element('li', 'news-empty-row');
        failed.appendChild(element('p', 'news-empty', '소식을 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.'));
        grid.appendChild(failed);
    });
}());
