/* The Way of Aazad \u2014 admin dashboard */
(function () {
  'use strict';
  var A = window.Aazad, S = A.Store, esc = A.esc, D = A.DISCIPLINES;
  var app = document.getElementById('app');
  var isDemo = false, ignoreHash = false;

  function setStatus(el, msg, kind) { el.className = 'status-line' + (kind ? ' ' + kind : ''); el.textContent = msg || ''; }
  function go(h) { ignoreHash = false; var before = location.hash; location.hash = h; if (location.hash === before) route(); }

  /* ---------- views ---------- */
  function viewLogin(msg) {
    app.innerHTML = '<div class="loginbox"><h2>Sign in</h2>' +
      (isDemo ? '<p class="notice">Preview mode: nothing is stored on a server. The password is <b>demo</b>.</p>' : '') +
      '<form id="lf" autocomplete="on">' +
      (isDemo ? '' : '<label for="u">Username</label><input type="text" id="u" name="username" autocomplete="username" autocapitalize="none" required>') +
      '<label for="p">Password</label><input type="password" id="p" name="password" autocomplete="current-password" required>' +
      '<div class="btnrow"><button type="submit">Enter</button></div><p class="status-line" id="ls" role="status"></p></form></div>';
    var ls = document.getElementById('ls'); if (msg) setStatus(ls, msg, 'err');
    document.getElementById('lf').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target, b = f.querySelector('button'); b.disabled = true; setStatus(ls, 'Checking\u2026');
      S.login(f.username ? f.username.value : '', f.password.value)
        .then(function () { go('#'); })
        .catch(function (er) { setStatus(ls, er.message, 'err'); b.disabled = false; f.password.value = ''; });
    });
  }

  function bar(active) {
    return '<div class="admin-bar">' +
      '<a class="btn' + (active === 'list' ? '' : ' alt') + '" href="#">Articles</a>' +
      '<a class="btn' + (active === 'new' ? '' : ' alt') + '" href="#new">+ New article</a>' +
      '<a class="btn' + (active === 'gb' ? '' : ' alt') + '" href="#guestbook">Guestbook</a>' +
      '<span class="sp"></span><button class="alt" id="out">Sign out</button></div>';
  }
  function wireBar() {
    document.getElementById('out').addEventListener('click', function () { S.logout().then(function () { go('#'); }); });
  }

  function viewList(filter) {
    filter = filter || 'all';
    S.adminList().then(function (posts) {
      var shown = posts.filter(function (p) { return filter === 'all' || p.status === filter; });
      var rows = shown.map(function (p) {
        var date = A.fmtDate(p.status === 'published' ? (p.publishedAt || p.createdAt) : p.updatedAt);
        return '<div class="row"><div class="grow"><b>' + esc(p.title) + '</b><div class="meta"><span class="badge ' + (p.status === 'published' ? 'pub' : 'draft') + '">' + (p.status === 'published' ? 'Published' : 'Draft') + '</span> ' +
          esc(A.discName(p.discipline)) + ' &middot; ' + esc(date) + '</div></div><div class="btns">' +
          '<a class="btn" href="#edit=' + esc(p.id) + '">Edit</a> ' +
          (p.status === 'published' ? '<a class="btn alt" href="../post.html?slug=' + encodeURIComponent(p.slug) + '" target="_blank">View</a> ' : '') +
          '<button class="danger" data-del="' + esc(p.id) + '" data-title="' + esc(p.title) + '">Delete</button></div></div>';
      }).join('') || '<p><i>Nothing here yet.</i></p>';
      var counts = { all: posts.length, published: 0, draft: 0 };
      posts.forEach(function (p) { counts[p.status]++; });
      app.innerHTML = bar('list') + '<h2>Articles</h2><div class="admin-bar">' +
        ['all', 'published', 'draft'].map(function (k) { return '<button class="' + (filter === k ? '' : 'alt') + '" data-f="' + k + '">' + k.charAt(0).toUpperCase() + k.slice(1) + ' (' + counts[k] + ')</button>'; }).join('') +
        '</div>' + rows + '<p class="status-line" id="ls" role="status"></p>';
      wireBar();
      Array.prototype.forEach.call(app.querySelectorAll('[data-f]'), function (b) { b.addEventListener('click', function () { viewList(b.getAttribute('data-f')); }); });
      Array.prototype.forEach.call(app.querySelectorAll('[data-del]'), function (b) {
        b.addEventListener('click', function () {
          if (!confirm('Delete "' + b.getAttribute('data-title') + '" permanently?')) return;
          b.disabled = true;
          S.remove(b.getAttribute('data-del')).then(function () { viewList(filter); })
            .catch(function (e) { b.disabled = false; setStatus(document.getElementById('ls'), e.message, 'err'); });
        });
      });
    }).catch(handleErr);
  }

  function viewEditor(id) {
    (id ? S.adminGet(id) : Promise.resolve(null)).then(function (post) {
      if (id && !post) { app.innerHTML = bar('list') + '<p>That article was not found.</p>'; wireBar(); return; }
      var cur = post ? Object.assign({}, post) : { title: '', body: '', excerpt: '', discipline: D[0].slug, cover: '', status: 'draft' };
      app.innerHTML = bar(id ? 'list' : 'new') + '<h2>' + (id ? 'Edit article' : 'New article') + '</h2>' +
        '<form id="ef" autocomplete="off">' +
        '<label for="t">Title</label><input type="text" id="t" maxlength="200" value="' + esc(cur.title) + '" placeholder="A title worth reading">' +
        '<label for="d">Category / discipline</label><select id="d">' + D.map(function (d) { return '<option value="' + d.slug + '"' + (d.slug === cur.discipline ? ' selected' : '') + '>' + esc(d.name) + '</option>'; }).join('') + '</select>' +
        '<label>Cover image</label><div class="coverbox" id="cb"></div>' +
        '<label for="b">Article</label>' +
        '<div class="toolbar" id="tb">' +
        '<button type="button" data-w="**|**|bold">B</button><button type="button" data-w="*|*|italic">I</button>' +
        '<button type="button" data-l="## ">H</button><button type="button" data-l="> ">&ldquo; &rdquo;</button><button type="button" data-l="- ">&bull; List</button>' +
        '<button type="button" data-link="1">Link</button><button type="button" data-ins="\n\n---\n\n">&#10086;</button><button type="button" class="alt" id="pv">Preview</button></div>' +
        '<textarea id="b" placeholder="Write here. Blank line = new paragraph. ## Heading, > quote, - list, **bold**, *italic*.">' + esc(cur.body) + '</textarea>' +
        '<div class="post-body notice" id="pvbox" style="display:none"></div>' +
        '<label for="x">Short summary <span style="font-weight:normal">(optional &mdash; made automatically if left blank)</span></label><input type="text" id="x" maxlength="300" value="' + esc(cur.excerpt || '') + '">' +
        '<div class="btnrow"><button type="button" class="alt" id="sd">Save as draft</button><button type="button" id="pb">' + (cur.status === 'published' ? 'Update published' : 'Publish') + '</button>' +
        (id ? '<button type="button" class="danger" id="dl">Delete</button>' : '') + '</div>' +
        '<p class="status-line" id="es" role="status"></p></form>';
      wireBar();
      var es = document.getElementById('es'), ta = document.getElementById('b');

      function drawCover() {
        var cb = document.getElementById('cb');
        cb.innerHTML = (cur.cover ? '<img src="' + esc(cur.cover) + '" alt="Cover preview">' : '') +
          '<input type="file" id="cf" accept="image/*">' + (cur.cover ? ' <button type="button" class="alt" id="cr">Remove</button>' : '');
        document.getElementById('cf').addEventListener('change', function (e) {
          var f = e.target.files[0]; if (!f) return;
          setStatus(es, 'Uploading cover\u2026');
          S.uploadCover(f).then(function (url) { cur.cover = url; drawCover(); setStatus(es, 'Cover ready \u2014 remember to save.', 'ok'); })
            .catch(function (er) { setStatus(es, er.message, 'err'); });
        });
        var cr = document.getElementById('cr');
        if (cr) cr.addEventListener('click', function () { cur.cover = ''; drawCover(); });
      }
      drawCover();

      function wrap(a, b) {
        var s = ta.selectionStart, e = ta.selectionEnd, v = ta.value, sel = v.slice(s, e) || 'text';
        ta.value = v.slice(0, s) + a + sel + b + v.slice(e);
        ta.focus(); ta.setSelectionRange(s + a.length, s + a.length + sel.length);
      }
      function lineStart(p) {
        var s = ta.selectionStart, v = ta.value, ls = v.lastIndexOf('\n', s - 1) + 1;
        ta.value = v.slice(0, ls) + p + v.slice(ls); ta.focus(); ta.setSelectionRange(s + p.length, s + p.length);
      }
      document.getElementById('tb').addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        if (b.getAttribute('data-w')) { var w = b.getAttribute('data-w').split('|'); wrap(w[0], w[1]); }
        else if (b.getAttribute('data-l')) lineStart(b.getAttribute('data-l'));
        else if (b.getAttribute('data-ins')) { var s = ta.selectionStart; ta.value = ta.value.slice(0, s) + b.getAttribute('data-ins') + ta.value.slice(s); ta.focus(); }
        else if (b.getAttribute('data-link')) {
          var u = prompt('Link address (https://\u2026)'); if (u && /^https?:\/\//i.test(u)) wrap('[', '](' + u + ')');
          else if (u) alert('Links must start with http:// or https://');
        }
      });
      var pvbox = document.getElementById('pvbox');
      document.getElementById('pv').addEventListener('click', function () {
        var on = pvbox.style.display === 'none';
        pvbox.style.display = on ? 'block' : 'none';
        if (on) pvbox.innerHTML = A.md(ta.value) || '<i>Nothing to preview.</i>';
        this.textContent = on ? 'Hide preview' : 'Preview';
      });

      function save(status, btn) {
        var data = { id: cur.id || undefined, title: document.getElementById('t').value, discipline: document.getElementById('d').value,
          body: ta.value, excerpt: document.getElementById('x').value, cover: cur.cover || '', status: status };
        if (!data.title.trim()) { setStatus(es, 'Please give the article a title.', 'err'); return; }
        var btns = app.querySelectorAll('#ef button'); Array.prototype.forEach.call(btns, function (b) { b.disabled = true; });
        setStatus(es, 'Saving\u2026');
        S.save(data).then(function (saved) {
          cur = Object.assign(cur, saved); id = saved.id;
          setStatus(es, status === 'published' ? 'Published. It now appears in The Journal and The Archives.' : 'Saved as draft.', 'ok');
          document.getElementById('pb').textContent = status === 'published' ? 'Update published' : 'Publish';
          var nh = '#edit=' + saved.id; if (location.hash !== nh) { ignoreHash = true; location.hash = nh; }
          if (!document.getElementById('dl') && saved.id) { var d = document.createElement('button'); d.type = 'button'; d.className = 'danger'; d.id = 'dl'; d.textContent = 'Delete'; document.querySelector('#ef .btnrow').appendChild(d); wireDelete(); }
        }).catch(function (er) { setStatus(es, er.message, 'err'); if (er.status === 401) go('#'); })
          .then(function () { Array.prototype.forEach.call(app.querySelectorAll('#ef button'), function (b) { b.disabled = false; }); });
      }
      document.getElementById('sd').addEventListener('click', function () { save('draft'); });
      document.getElementById('pb').addEventListener('click', function () { save('published'); });
      function wireDelete() {
        var dl = document.getElementById('dl'); if (!dl) return;
        dl.addEventListener('click', function () {
          if (!cur.id || !confirm('Delete this article permanently?')) return;
          S.remove(cur.id).then(function () { go('#'); }).catch(function (er) { setStatus(es, er.message, 'err'); });
        });
      }
      wireDelete();
      if (location.hash === '#new') document.getElementById('t').focus();
    }).catch(handleErr);
  }

  function viewGuestbook() {
    S.guestbook().then(function (list) {
      app.innerHTML = bar('gb') + '<h2>Guestbook</h2>' + (list.map(function (e) {
        return '<div class="entry"><span class="who">' + esc(e.name) + '</span> <span class="meta">&middot; ' + esc(A.fmtDate(e.at)) + '</span><p>' + esc(e.message) + '</p>' +
          '<button class="danger" data-gd="' + esc(e.id) + '">Delete</button></div>';
      }).join('') || '<p><i>No entries yet.</i></p>') + '<p class="status-line" id="ls"></p>';
      wireBar();
      Array.prototype.forEach.call(app.querySelectorAll('[data-gd]'), function (b) {
        b.addEventListener('click', function () {
          if (!confirm('Delete this guestbook entry?')) return;
          S.removeEntry(b.getAttribute('data-gd')).then(viewGuestbook).catch(function (e) { setStatus(document.getElementById('ls'), e.message, 'err'); });
        });
      });
    }).catch(handleErr);
  }

  function handleErr(e) {
    if (e && e.status === 401) return viewLogin('Your session ended. Please sign in again.');
    app.innerHTML = '<p class="notice">Something went wrong: ' + esc(e && e.message || e) + '</p>';
  }

  /* ---------- routing ---------- */
  function route() {
    S.me().then(function (ok) {
      if (!ok) return viewLogin();
      var h = location.hash || '#';
      if (h === '#new') return viewEditor(null);
      if (h.indexOf('#edit=') === 0) return viewEditor(decodeURIComponent(h.slice(6)));
      if (h === '#guestbook') return viewGuestbook();
      viewList('all');
    });
  }
  window.addEventListener('hashchange', function () { if (ignoreHash) { ignoreHash = false; return; } route(); });
  S.mode().then(function (m) { isDemo = m === 'demo'; route(); });
})();
  
