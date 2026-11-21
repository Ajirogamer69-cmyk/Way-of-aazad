/* The Way of Aazad - data layer (GitHub edition).
 * Visitors: read data/posts.json, a plain file served by GitHub Pages.
 * Admin:    reads and writes that file in your GitHub repo through the GitHub API,
 *           using a personal access token that stays in this browser.
 * Demo:     "Try demo mode" keeps posts in this browser's localStorage only.
 * Include with: <script src="js/store.js" data-base=""></script>  (data-base="../" inside /admin/)
 */
(function () {
  'use strict';
  var BASE = (document.currentScript && document.currentScript.getAttribute('data-base')) || '';
  var SITE_DIR = 'public';
  var POSTS_PATH = SITE_DIR + '/data/posts.json';
  var K_CFG = 'aazad_gh', K_DEMO = 'aazad_demo', K_POSTS = 'aazad_posts';
  var COVER_RE = /^uploads\/[a-f0-9]{12,}\.(jpg|png|webp|gif)$/;

  var DISCIPLINES = [
    { slug: 'logic-mathematics', name: 'Logic & Mathematics', sym: '\u2234', blurb: 'Proof, pattern and the quiet music of number.' },
    { slug: 'philosophy', name: 'Philosophy', sym: '\u03a6', blurb: 'Questions worth asking slowly, and badly answered often.' },
    { slug: 'astronomy-physics', name: 'Astronomy & Physics', sym: '\u2609', blurb: 'Stars, orbits, and the laws that hold them together.' },
    { slug: 'literature-language', name: 'Literature & Language', sym: '\u00b6', blurb: 'Words, books, translation and the shape of sentences.' },
    { slug: 'computing', name: 'Computing', sym: '\u2699', blurb: 'Machines, code and the craft of making them do things.' },
    { slug: 'art-imagination', name: 'Art & Imagination', sym: '\u2766', blurb: 'Drawing, music, invention and idle daydreams.' }
  ];

  /* ---------- text helpers ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function inline(s) {
    s = esc(s);
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" rel="noopener noreferrer" target="_blank">$1</a>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    return s;
  }
  // Tiny, safe markdown: ## heading, > quote, - list, --- ornament, **bold**, *italic*, [text](https://link)
  function md(src) {
    var blocks = String(src || '').replace(/\r\n/g, '\n').split(/\n{2,}/), out = [];
    blocks.forEach(function (b) {
      b = b.replace(/^\n+|\n+$/g, '');
      if (!b) return;
      if (/^---+$/.test(b.trim())) { out.push('<hr>'); return; }
      if (/^##\s+/.test(b)) { out.push('<h3>' + inline(b.replace(/^##\s+/, '')) + '</h3>'); return; }
      if (/^#\s+/.test(b)) { out.push('<h3>' + inline(b.replace(/^#\s+/, '')) + '</h3>'); return; }
      if (/^>\s?/.test(b)) { out.push('<blockquote>' + inline(b.replace(/^>\s?/gm, '').replace(/\n/g, ' ')) + '</blockquote>'); return; }
      if (/^[-*]\s+/.test(b)) {
        out.push('<ul>' + b.split('\n').map(function (l) { return '<li>' + inline(l.replace(/^[-*]\s+/, '')) + '</li>'; }).join('') + '</ul>');
        return;
      }
      out.push('<p>' + inline(b).replace(/\n/g, '<br>') + '</p>');
    });
    return out.join('\n');
  }
  function fmtDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  function discName(slug) {
    for (var i = 0; i < DISCIPLINES.length; i++) if (DISCIPLINES[i].slug === slug) return DISCIPLINES[i].name;
    return slug || '';
  }
  function slugify(t) {
    return String(t || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'untitled';
  }
  function plain(body) { return String(body || '').replace(/[#>*_\[\]()`-]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function makeExcerpt(body) {
    var t = plain(body);
    return t.length > 170 ? t.slice(0, 167).replace(/\s+\S*$/, '') + '\u2026' : t;
  }
  function byNewest(a, b) { return new Date(b.publishedAt || b.createdAt) - new Date(a.publishedAt || a.createdAt); }
  function byUpdated(a, b) { return new Date(b.updatedAt) - new Date(a.updatedAt); }
  function randHex(n) {
    var a = new Uint8Array(n); crypto.getRandomValues(a);
    return Array.prototype.map.call(a, function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
  }
  function uid() { return randHex(6); }

  function guessRepo() {
    var h = location.hostname;
    if (!/\.github\.io$/i.test(h)) return '';
    var owner = h.split('.')[0], seg = location.pathname.split('/').filter(Boolean);
    return owner + '/' + (seg.length && !/\.html?$/i.test(seg[0]) ? seg[0] : owner + '.github.io');
  }

  /* ---------- browser storage (always guarded) ---------- */
  var LS = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { throw new Error('This browser is blocking storage, so it cannot remember your sign-in.'); } },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  function isDemo() { return LS.get(K_DEMO, false) === true; }
  function cfg() { var c = LS.get(K_CFG, null); return c && c.repo && c.token ? c : null; }

  /* ---------- reading the site's own data files ---------- */
  function fileJSON(name) {
    return fetch(BASE + name + '?v=' + Math.floor(Date.now() / 60000), { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('missing ' + name);
      return r.json();
    });
  }
  function seedPosts() { return fileJSON('seed/posts.json').catch(function () { return []; }); }
  function livePosts() { return fileJSON('data/posts.json').catch(seedPosts); }
  function demoPosts() {
    var cur = LS.get(K_POSTS, null);
    if (cur) return Promise.resolve(cur);
    return seedPosts().then(function (p) { LS.set(K_POSTS, p); return p; });
  }
  function allPosts() { return isDemo() ? demoPosts() : livePosts(); }

  /* ---------- GitHub API ---------- */
  function authErr() { var e = new Error('Please connect to GitHub first.'); e.status = 401; return e; }
  function httpError(status, j) {
    var m;
    if (status === 401) m = 'GitHub did not accept that token. It may be wrong or expired.';
    else if (status === 403) m = /rate limit/i.test((j && j.message) || '') ? 'GitHub rate limit reached. Wait a few minutes and try again.' : 'The token does not have permission. It needs "Contents: Read and write" on this repository.';
    else if (status === 404) m = 'Repository or file not found. Check the repository name, and that the token can access it.';
    else if (status === 409 || status === 422) m = 'GitHub reported a conflict. Please try again.';
    else m = (j && j.message) || ('GitHub error (' + status + ').');
    var e = new Error(m); e.status = status; return e;
  }
  function ghFetch(c, method, path, body, accept) {
    var h = { Accept: accept || 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', Authorization: 'Bearer ' + c.token };
    var opt = { method: method, headers: h, cache: 'no-store' };
    if (body) { h['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
    return fetch('https://api.github.com' + path, opt).catch(function () { throw new Error('Could not reach GitHub. Check your internet connection.'); });
  }
  function gh(method, path, body) {
    var c = cfg(); if (!c) return Promise.reject(authErr());
    return ghFetch(c, method, path, body).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw httpError(r.status, j); return j; });
    });
  }
  function cpath(c, path) { return '/repos/' + c.repo + '/contents/' + path.split('/').map(encodeURIComponent).join('/'); }

  function toB64(str) { return bytesB64(new TextEncoder().encode(str)); }
  function bytesB64(bytes) {
    var s = '', i, ch = 0x8000;
    for (i = 0; i < bytes.length; i += ch) s += String.fromCharCode.apply(null, bytes.subarray(i, i + ch));
    return btoa(s);
  }
  function fromB64(b) {
    var bin = atob(b.replace(/\s/g, '')), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function getFile(path) {
    var c = cfg(); if (!c) return Promise.reject(authErr());
    var url = cpath(c, path) + '?ref=' + encodeURIComponent(c.branch || 'main');
    return gh('GET', url).then(function (j) {
      if (j.encoding === 'base64' && typeof j.content === 'string' && j.content.length) return { sha: j.sha, text: fromB64(j.content) };
      return ghFetch(c, 'GET', url, null, 'application/vnd.github.raw+json').then(function (r) {
        if (!r.ok) throw httpError(r.status, {});
        return r.text();
      }).then(function (t) { return { sha: j.sha, text: t }; });
    }, function (e) { if (e.status === 404) return null; throw e; });
  }
  function putFile(path, b64, sha, message) {
    var c = cfg(); if (!c) return Promise.reject(authErr());
    var body = { message: message, content: b64, branch: c.branch || 'main' };
    if (sha) body.sha = sha;
    return gh('PUT', cpath(c, path), body);
  }
  function dropIfUnused(cover, list) {
    var c = cfg();
    if (!c || !cover || !COVER_RE.test(cover)) return;
    if (list.some(function (p) { return p.cover === cover; })) return;
    var path = SITE_DIR + '/' + cover;
    gh('GET', cpath(c, path) + '?ref=' + encodeURIComponent(c.branch || 'main')).then(function (j) {
      return gh('DELETE', cpath(c, path), { message: 'Remove unused cover ' + cover, sha: j.sha, branch: c.branch || 'main' });
    }).catch(function () {});
  }

  function readPostsRemote() {
    return getFile(POSTS_PATH).then(function (f) {
      if (f) {
        var list;
        try { list = JSON.parse(f.text); } catch (e) { throw new Error('public/data/posts.json is not valid JSON. Fix it on GitHub, then try again.'); }
        return { sha: f.sha, list: Array.isArray(list) ? list : [] };
      }
      return seedPosts().then(function (l) { return { sha: null, list: l }; });
    });
  }
  // fn(list) -> { list, result, msg }. Re-reads and retries if GitHub reports a conflict.
  function mutatePosts(fn) {
    function attempt(n) {
      return readPostsRemote().then(function (cur) {
        var out = fn(cur.list);
        return putFile(POSTS_PATH, toB64(JSON.stringify(out.list, null, 2)), cur.sha, out.msg).then(function () { return out; }, function (e) {
          if ((e.status === 409 || e.status === 422) && n < 3) return attempt(n + 1);
          throw e;
        });
      });
    }
    return attempt(1);
  }

  function cleanPost(input, existing, all) {
    var title = String(input.title || '').trim();
    if (!title) throw new Error('Please give the article a title.');
    var status = input.status === 'published' ? 'published' : 'draft';
    var disc = DISCIPLINES.some(function (d) { return d.slug === input.discipline; }) ? input.discipline : DISCIPLINES[0].slug;
    var now = new Date().toISOString();
    var p = existing ? Object.assign({}, existing) : { id: uid(), createdAt: now };
    p.title = title.slice(0, 200);
    p.body = String(input.body || '').slice(0, 100000);
    p.excerpt = String(input.excerpt || '').trim().slice(0, 300) || makeExcerpt(p.body);
    p.discipline = disc;
    p.cover = String(input.cover || '');
    p.status = status;
    p.updatedAt = now;
    if (status === 'published' && !p.publishedAt) p.publishedAt = now;
    if (!p.slug) {
      var base = slugify(title), s = base, n = 2;
      while (all.some(function (x) { return x.slug === s && x.id !== p.id; })) s = base + '-' + n++;
      p.slug = s;
    }
    return p;
  }

  function shrink(file, maxW, q) {
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\//.test(file.type)) return reject(new Error('Please choose an image file.'));
      var fr = new FileReader();
      fr.onerror = function () { reject(new Error('Could not read that file.')); };
      fr.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error('That image could not be opened.')); };
        img.onload = function () {
          var w = img.naturalWidth, h = img.naturalHeight, s = Math.min(1, maxW / w);
          var c = document.createElement('canvas');
          c.width = Math.round(w * s); c.height = Math.round(h * s);
          var x = c.getContext('2d');
          x.fillStyle = '#E8DFC9'; x.fillRect(0, 0, c.width, c.height);
          x.drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL('image/jpeg', q));
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }

  /* ---------- public API ---------- */
  var Store = {
    DISCIPLINES: DISCIPLINES,
    mode: function () { return Promise.resolve(isDemo() ? 'demo' : 'repo'); },
    lastRepo: function () { return LS.get('aazad_repo', ''); },
    info: function () { var c = cfg(); return { demo: isDemo(), repo: c ? c.repo : '' }; },

    published: function () {
      return allPosts().then(function (p) { return p.filter(function (x) { return x.status === 'published'; }).sort(byNewest); });
    },
    bySlug: function (slug) {
      return allPosts().then(function (p) {
        var r = p.filter(function (x) { return x.slug === slug && x.status === 'published'; })[0];
        if (!r) { var e = new Error('Not found'); e.status = 404; throw e; }
        return r;
      });
    },

    me: function () { return Promise.resolve(isDemo() || !!cfg()); },
    login: function (repo, token) {
      repo = String(repo || '').trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '').replace(/\/+$/, '');
      token = String(token || '').trim();
      if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) return Promise.reject(new Error('Enter the repository as owner/name, for example yourname/the-way-of-aazad.'));
      if (!token) return Promise.reject(new Error('Paste your access token.'));
      var c = { repo: repo, token: token, branch: 'main' };
      return ghFetch(c, 'GET', '/repos/' + repo).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (!r.ok) throw httpError(r.status, j);
          if (j.permissions && j.permissions.push === false) throw new Error('This token can read the repository but not change it. Give it "Contents: Read and write".');
          c.branch = j.default_branch || 'main';
          LS.set(K_CFG, c); LS.set('aazad_repo', repo); LS.del(K_DEMO);
          return { ok: true };
        });
      });
    },
    enterDemo: function () { LS.set(K_DEMO, true); return demoPosts().then(function () { return { ok: true }; }); },
    logout: function () { LS.del(K_CFG); LS.del(K_DEMO); return Promise.resolve({ ok: true }); },

    adminList: function () {
      if (isDemo()) return demoPosts().then(function (p) { return p.slice().sort(byUpdated); });
      return readPostsRemote().then(function (r) { return r.list.slice().sort(byUpdated); });
    },
    adminGet: function (id) { return Store.adminList().then(function (l) { return l.filter(function (p) { return p.id === id; })[0] || null; }); },

    save: function (post) {
      if (isDemo()) {
        return demoPosts().then(function (all) {
          var ex = post.id ? all.filter(function (p) { return p.id === post.id; })[0] : null;
          var np = cleanPost(post, ex, all);
          if (ex) all[all.indexOf(ex)] = np; else all.push(np);
          LS.set(K_POSTS, all);
          return np;
        });
      }
      var oldCover = '';
      return mutatePosts(function (all) {
        var ex = post.id ? all.filter(function (p) { return p.id === post.id; })[0] : null;
        var np = cleanPost(post, ex, all);
        if (np.cover && !COVER_RE.test(np.cover)) throw new Error('Invalid cover image. Please upload it again.');
        oldCover = ex ? ex.cover : '';
        if (ex) all[all.indexOf(ex)] = np; else all.push(np);
        return { list: all, result: np, msg: (np.status === 'published' ? 'Publish: ' : 'Save draft: ') + np.title.slice(0, 60) };
      }).then(function (out) {
        if (oldCover && oldCover !== out.result.cover) dropIfUnused(oldCover, out.list);
        return out.result;
      });
    },
    remove: function (id) {
      if (isDemo()) return demoPosts().then(function (all) { LS.set(K_POSTS, all.filter(function (p) { return p.id !== id; })); return { ok: true }; });
      var gone = null;
      return mutatePosts(function (all) {
        var i = -1; all.forEach(function (p, k) { if (p.id === id) i = k; });
        if (i < 0) throw new Error('That article was already deleted.');
        gone = all.splice(i, 1)[0];
        return { list: all, result: true, msg: 'Delete: ' + gone.title.slice(0, 60) };
      }).then(function (out) { dropIfUnused(gone.cover, out.list); return { ok: true }; });
    },
    // Resizes the photo in the browser, then stores it. Resolves to { url, preview }.
    uploadCover: function (file) {
      return shrink(file, 1400, 0.85).then(function (dataUrl) {
        if (isDemo()) return shrink(file, 900, 0.7).then(function (d) { return { url: d, preview: d }; });
        var name = randHex(12) + '.jpg';
        return putFile(SITE_DIR + '/uploads/' + name, dataUrl.split(',')[1], null, 'Upload cover ' + name).then(function () {
          return { url: 'uploads/' + name, preview: dataUrl };
        });
      });
    }
  };

  window.Aazad = { Store: Store, DISCIPLINES: DISCIPLINES, esc: esc, md: md, fmtDate: fmtDate, discName: discName, plain: plain, base: BASE, guessRepo: guessRepo };
})();
        
