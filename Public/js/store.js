/* The Way of Aazad \u2014 data layer.
 * SERVER mode: talks to /api (real login, files on disk).
 * DEMO mode:   no server found (e.g. GitHub Pages / preview) -> uses this browser's localStorage.
 *              Demo admin password is "demo". Nothing is shared between visitors.
 * Include with: <script src="js/store.js" data-base=""></script>  (data-base="../" inside /admin/)
 */
(function () {
  'use strict';
  var BASE = (document.currentScript && document.currentScript.getAttribute('data-base')) || '';

  var DISCIPLINES = [
    { slug: 'logic-mathematics', name: 'Logic & Mathematics', sym: '\u2234', blurb: 'Proof, pattern and the quiet music of number.' },
    { slug: 'philosophy', name: 'Philosophy', sym: '\u03a6', blurb: 'Questions worth asking slowly, and badly answered often.' },
    { slug: 'astronomy-physics', name: 'Astronomy & Physics', sym: '\u2609', blurb: 'Stars, orbits, and the laws that hold them together.' },
    { slug: 'literature-language', name: 'Literature & Language', sym: '\u00b6', blurb: 'Words, books, translation and the shape of sentences.' },
    { slug: 'computing', name: 'Computing', sym: '\u2699', blurb: 'Machines, code and the craft of making them do things.' },
    { slug: 'art-imagination', name: 'Art & Imagination', sym: '\u2766', blurb: 'Drawing, music, invention and idle daydreams.' }
  ];

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
  function plain(body) {
    return String(body || '').replace(/[#>*_\[\]()`-]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function makeExcerpt(body) {
    var t = plain(body);
    return t.length > 170 ? t.slice(0, 167).replace(/\s+\S*$/, '') + '\u2026' : t;
  }
  function byNewest(a, b) { return new Date(b.publishedAt || b.createdAt) - new Date(a.publishedAt || a.createdAt); }

  /* ---------- mode detection ---------- */
  var modeP = null;
  function mode() {
    if (modeP) return modeP;
    modeP = fetch(BASE + 'api/ping', { headers: { accept: 'application/json' }, cache: 'no-store' })
      .then(function (r) { return r.ok && (r.headers.get('content-type') || '').indexOf('json') > -1 ? r.json() : null; })
      .then(function (j) { return j && j.ok ? 'server' : 'demo'; })
      .catch(function () { return 'demo'; });
    return modeP;
  }

  function api(method, url, body) {
    var opt = { method: method, headers: { accept: 'application/json' }, credentials: 'same-origin' };
    if (body !== undefined) { opt.headers['content-type'] = 'application/json'; opt.body = JSON.stringify(body); }
    return fetch(BASE + url, opt).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) { var e = new Error(j.error || ('Request failed (' + r.status + ')')); e.status = r.status; throw e; }
        return j;
      });
    });
  }

  /* ---------- demo storage ---------- */
  var LS = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { throw new Error('Browser storage is full or blocked.'); } }
  };
  var seeded = null;
  function demoPosts() {
    var cur = LS.get('aazad_posts', null);
    if (cur) return Promise.resolve(cur);
    if (!seeded) seeded = fetch(BASE + 'seed/posts.json').then(function (r) { return r.json(); }).catch(function () { return []; });
    return seeded.then(function (p) { LS.set('aazad_posts', p); return p; });
  }
  function demoGuest() {
    var cur = LS.get('aazad_guest', null);
    if (cur) return Promise.resolve(cur);
    return fetch(BASE + 'seed/guestbook.json').then(function (r) { return r.json(); }).catch(function () { return []; })
      .then(function (g) { LS.set('aazad_guest', g); return g; });
  }
  function demoAuthed() { try { return sessionStorage.getItem('aazad_demo_admin') === '1'; } catch (e) { return false; } }
  function uid() { return Math.random().toString(16).slice(2, 10) + Date.now().toString(16); }

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
    if (!existing || !p.slug) {
      var base = slugify(title), s = base, n = 2;
      while (all.some(function (x) { return x.slug === s && x.id !== p.id; })) s = base + '-' + n++;
      p.slug = s;
    }
    return p;
  }

  /* ---------- public API ---------- */
  var Store = {
    mode: mode,
    DISCIPLINES: DISCIPLINES,

    published: function () {
      return mode().then(function (m) {
        if (m === 'server') return api('GET', 'api/posts').then(function (j) { return j.posts; });
        return demoPosts().then(function (p) { return p.filter(function (x) { return x.status === 'published'; }).sort(byNewest); });
      });
    },
    bySlug: function (slug) {
      return mode().then(function (m) {
        if (m === 'server') return api('GET', 'api/posts/' + encodeURIComponent(slug)).then(function (j) { return j.post; });
        return demoPosts().then(function (p) {
          return p.filter(function (x) { return x.slug === slug && x.status === 'published'; })[0] || null;
        }).then(function (r) { if (!r) { var e = new Error('Not found'); e.status = 404; throw e; } return r; });
      });
    },
    me: function () {
      return mode().then(function (m) {
        if (m === 'server') return api('GET', 'api/me').then(function (j) { return !!j.admin; }).catch(function () { return false; });
        return demoAuthed();
      });
    },
    login: function (user, pw) {
      return mode().then(function (m) {
        if (m === 'server') return api('POST', 'api/login', { username: user, password: pw });
        if (pw !== 'demo') throw new Error('Wrong password (demo mode password is "demo").');
        sessionStorage.setItem('aazad_demo_admin', '1');
        return { ok: true };
      });
    },
    logout: function () {
      return mode().then(function (m) {
        if (m === 'server') return api('POST', 'api/logout', {});
        try { sessionStorage.removeItem('aazad_demo_admin'); } catch (e) {}
        return { ok: true };
      });
    },
    adminList: function () {
      return mode().then(function (m) {
        if (m === 'server') return api('GET', 'api/admin/posts').then(function (j) { return j.posts; });
        return demoPosts().then(function (p) { return p.slice().sort(function (a, b) { return new Date(b.updatedAt) - new Date(a.updatedAt); }); });
      });
    },
    adminGet: function (id) {
      return Store.adminList().then(function (l) { return l.filter(function (p) { return p.id === id; })[0] || null; });
    },
    save: function (post) {
      return mode().then(function (m) {
        if (m === 'server') {
          return post.id ? api('PUT', 'api/admin/posts/' + encodeURIComponent(post.id), post).then(function (j) { return j.post; })
                         : api('POST', 'api/admin/posts', post).then(function (j) { return j.post; });
        }
        return demoPosts().then(function (all) {
          var ex = post.id ? all.filter(function (p) { return p.id === post.id; })[0] : null;
          var np = cleanPost(post, ex, all);
          if (ex) all[all.indexOf(ex)] = np; else all.push(np);
          LS.set('aazad_posts', all);
          return np;
        });
      });
    },
    remove: function (id) {
      return mode().then(function (m) {
        if (m === 'server') return api('DELETE', 'api/admin/posts/' + encodeURIComponent(id));
        return demoPosts().then(function (all) { LS.set('aazad_posts', all.filter(function (p) { return p.id !== id; })); return { ok: true }; });
      });
    },
    // Resizes the picked image in the browser, then stores it. Returns the URL to use as cover.
    uploadCover: function (file) {
      return shrink(file, 1400, 0.85).then(function (dataUrl) {
        return mode().then(function (m) {
          if (m === 'server') return api('POST', 'api/admin/upload', { dataUrl: dataUrl }).then(function (j) { return j.url; });
          return shrink(file, 900, 0.7); // smaller in demo so localStorage doesn't overflow
        });
      });
    },

    guestbook: function () {
      return mode().then(function (m) {
        if (m === 'server') return api('GET', 'api/guestbook').then(function (j) { return j.entries; });
        return demoGuest().then(function (g) { return g.slice().sort(function (a, b) { return new Date(b.at) - new Date(a.at); }); });
      });
    },
    sign: function (name, message, trap) {
      name = String(name || '').trim(); message = String(message || '').trim();
      if (!name || !message) return Promise.reject(new Error('Please fill in your name and a message.'));
      return mode().then(function (m) {
        if (m === 'server') return api('POST', 'api/guestbook', { name: name, message: message, website: trap || '' });
        return demoGuest().then(function (g) {
          g.push({ id: uid(), name: name.slice(0, 60), message: message.slice(0, 1000), at: new Date().toISOString() });
          LS.set('aazad_guest', g); return { ok: true };
        });
      });
    },
    removeEntry: function (id) {
      return mode().then(function (m) {
        if (m === 'server') return api('DELETE', 'api/admin/guestbook/' + encodeURIComponent(id));
        return demoGuest().then(function (g) { LS.set('aazad_guest', g.filter(function (e) { return e.id !== id; })); return { ok: true }; });
      });
    }
  };

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

  window.Aazad = { Store: Store, DISCIPLINES: DISCIPLINES, esc: esc, md: md, fmtDate: fmtDate, discName: discName, plain: plain, base: BASE };
})();
 
