/* The Way of Aazad - admin dashboard (GitHub edition) */
(function () {
  'use strict';
  var A = window.Aazad, S = A.Store, esc = A.esc, D = A.DISCIPLINES;
  var app = document.getElementById('app');
  var ignoreHash = false;

  function setStatus(el, msg, kind) { if (!el) return; el.className = 'status-line' + (kind ? ' ' + kind : ''); el.textContent = msg || ''; }
  function go(h) { ignoreHash = false; var before = location.hash; location.hash = h; if (location.hash === before) route(); }
  function coverSrc(p) { var c = p.preview || p.cover || ''; if (!c) return ''; return /^(data:|https?:)/.test(c) ? c : '../' + c; }
  // Two-tap confirmation (works everywhere, including places that block pop-up dialogs).
  function armed(btn, text, fn) {
    var orig = btn.textContent;
    btn.addEventListener('click', function () {
      if (btn.getAttribute('data-armed')) { clearTimeout(btn._t); btn.removeAttribute('data-armed'); btn.textContent = orig; fn(); return; }
      btn.setAttribute('data-armed', '1'); btn.textContent = text;
      btn._t = setTimeout(function () { btn.removeAttribute('data-armed'); btn.textContent = orig; }, 4000);
    });
  }

  /* ---------- sign in ---------- */
  function viewLogin(msg) {
    var guess = S.lastRepo() || A.guessRepo();
    app.innerHTML = '<div class="loginbox"><h2>Connect to GitHub</h2>' +
      '<p class="notice">This admin saves your posts straight into your GitHub repository. You need a personal access token, which you create once (steps below). It stays in this browser only.</p>' +
      '<form id="lf" autocomplete="off">' +
      '<label for="r">Repository (owner/name)</label><input type="text" id="r" autocapitalize="none" autocorrect="off" spellcheck="false" value="' + esc(guess) + '" placeholder="yourname/the-way-of-aazad">' +
      '<label for="p">Access token</label><input type="password" id="p" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="github_pat_...">' +
      '<div class="btnrow"><button type="submit">Connect</button><button type="button" class="alt" id="demo">Try demo mode</button></div>' +
      '<p class="status-line" id="ls" role="status"></p></form>' +
      '<details class="notice"><summary><b>How do I get a token?</b></summary><ol style="margin:.6rem 0 0;padding-left:1.2rem">' +
      '<li>On GitHub: your profile photo, <b>Settings</b>, <b>Developer settings</b>, <b>Personal access tokens</b>, <b>Fine-grained tokens</b>, <b>Generate new token</b>.</li>' +
      '<li>Name it, and set an expiry date.</li>' +
      '<li><b>Repository access</b>: choose <i>Only select repositories</i> and pick this site\'s repository.</li>' +
      '<li><b>Permissions</b>, <b>Repository permissions</b>: set <b>Contents</b> to <i>Read and write</i>.</li>' +
      '<li>Tap <b>Generate token</b>, copy it, and paste it above.</li></ol></details>' +
      '<p class="small">Demo mode keeps posts in this browser only and sends nothing to GitHub.</p></div>';
    var ls = document.getElementById('ls'); if (msg) setStatus(ls, msg, 'err');
    document.getElementById('lf').addEventListener('submit', function (e) {
      e.preventDefault();
      var b = e.target.querySelector('button[type=submit]'); b.disabled = true; setStatus(ls, 'Checking with GitHub\u2026');
      S.login(document.getElementById('r').value, document.getElementById('p').value)
        .then(function () { go('#'); })
        .catch(function (er) { setStatus(ls, er.message, 'err'); b.disabled = false; });
    });
    document.getElementById('demo').addEventListener('click', function () { S.enterDemo().then(function () { go('#'); }).catch(function (er) { setStatus(ls, er.message, 'err'); }); });
  }

  function bar(active) {
    var i = S.info();
    return '<div class="admin-bar">' +
      '<a class="btn' + (active === 'list' ? '' : ' alt') + '" href="#">Articles</a>' +
      '<a class="btn' + (active === 'new' ? '' : ' alt') + '" href="#new">+ New article</a>' +
      '<span class="sp"></span><span class="meta">' + (i.demo ? 'Demo mode' : esc(i.repo)) + '</span>' +
      '<button class="alt" id="out">' + (i.demo ? 'Exit demo' : 'Disconnect') + '</button></div>';
  }
  function wireBar() { document.getElementById('out').addEventListener('click', function () { S.logout().then(function () { go('#'); }); }); }

  /* ---------- article list ---------- */
  function viewList(filter) {
    filter = filter || 'all';
    app.innerHTML = '<p><i>Loading\u2026</i></p>';
    S.adminList().then(function (posts) {
      var shown = posts.filter(function (p) { return filter === 'all' || p.status === filter; });
      var rows = shown.map(function (p) {
        var date = A.fmtDate(p.status === 'published' ? (p.publishedAt || p.createdAt) : p.updatedAt);
        return '<div class="row"><div class="grow"><b>' + esc(p.title) + '</b><div class="meta"><span class="badge ' + (p.status === 'published' ? 'pub' : 'draft') + '">' + (p.status === 'published' ? 'Published' : 'Draft') + '</span> ' +
          esc(A.discName(p.discipline)) + ' &middot; ' + esc(date) + '</div></div><div class="btns">' +
          '<a class="btn" href="#edit=' + esc(p.id) + '">Edit</a> ' +
          (p.status === 'published' ? '<a class="btn alt" href="../post.html?slug=' + encodeURIComponent(p.slug) + '" target="_blank">View</a> ' : '') +
          '<button class="danger" data-del="' + esc(p.id) + '">Delete</button></div></div>';
      }).join('') || '<p><i>Nothing here yet.</i></p>';
      var counts = { all: posts.length, published: 0, draft: 0 };
      posts.forEach(function (p) { counts[p.status]++; });
      app.innerHTML = bar('list') + '<h2>Articles</h2><div class="admin-bar">' +
        ['all', 'published', 'draft'].map(function (k) { return '<button class="' + (filter === k ? '' : 'alt') + '" data-f="' + k + '">' + k.charAt(0).toUpperCase() + k.slice(1) + ' (' + counts[k] + ')</button>'; }).join('') +
        '</div>' + rows + '<p class="status-line" id="ls" role="status"></p>';
      wireBar();
      Array.prototype.forEach.call(app.querySelectorAll('[data-f]'), function (b) { b.addEventListener('click', function () { viewList(b.getAttribute('data-f')); }); });
      Array.prototype.forEach.call(app.querySelectorAll('[data-del]'), function (b) {
        armed(b, 'Tap again to delete', function () {
          b.disabled = true; setStatus(document.getElementById('ls'), 'Deleting\u2026');
          S.remove(b.getAttribute('data-del')).then(function () { viewList(filter); })
            .catch(function (e) { b.disabled = false; if (e.status === 401) return viewLogin(e.message); setStatus(document.getElementById('ls'), e.message, 'err'); });
        });
      });
    }).catch(handleErr);
  }

  /* ---------- editor ---------- */
  function viewEditor(id) {
    app.innerHTML = '<p><i>Loading\u2026</i></p>';
    (id ? S.adminGet(id) : Promise.resolve(null)).then(function (post) {
      if (id && !post) { app.innerHTML = bar('list') + '<p>That article was not found.</p>'; wireBar(); return; }
      var info = S.info();
      var cur = post ? Object.assign({}, post) : { title: '', body: '', excerpt: '', discipline: D[0].slug, cover: '', status: 'draft' };
      app.innerHTML = bar(id ? 'list' : 'new') + '<h2>' + (id ? 'Edit article' : 'New article') + '</h2>' +
        '<form id="ef" autocomplete="off">' +
        '<label for="t">Title</label><input type="text" id="t" maxlength="200" value="' + esc(cur.title) + '" placeholder="A title worth reading">' +
        '<label for="d">Category / discipline</label><select id="d">' + D.map(function (d) { return '<option value="' + d.slug + '"' + (d.slug === cur.discipline ? ' selected' : '') + '>' + esc(d.name) + '</option>'; }).join('') + '</select>' +
        '<label>Cover image</label><div class="coverbox" id="cb"></div>' +
        '<label for="b">Article</label>' +
        '<div class="toolbar" id="tb">' +
        '<button type="button" data-w="**|**">B</button><button type="button" data-w="*|*">I</button>' +
        '<button type="button" data-l="## ">H</button><button type="button" data-l="> ">&ldquo; &rdquo;</button><button type="button" data-l="- ">&bull; List</button>' +
        '<button type="button" data-w="[|](https://)">Link</button><button type="button" data-ins="\n\n---\n\n">&#10086;</button><button type="button" class="alt" id="pv">Preview</button></div>' +
        '<textarea id="b" placeholder="Write here. Blank line = new paragraph. ## Heading, > quote, - list, **bold**, *italic*.">' + esc(cur.body) + '</textarea>' +
        '<div class="post-body notice" id="pvbox" style="display:none"></div>' +
        '<label for="x">Short summary <span style="font-weight:normal">(optional; made automatically if left blank)</span></label><input type="text" id="x" maxlength="300" value="' + esc(cur.excerpt || '') + '">' +
        '<div class="btnrow"><button type="button" class="alt" id="sd">Save as draft</button><button type="button" id="pb">' + (cur.status === 'published' ? 'Update published' : 'Publish') + '</button>' +
        (id ? '<button type="button" class="danger" id="dl">Delete</button>' : '') + '</div>' +
        '<p class="status-line" id="es" role="status"></p>' +
        (info.demo ? '' : '<p class="small">Saved to GitHub; your site updates about a minute after each save. Drafts live in the same data file the site reads, so keep anything private out of them.</p>') +
        '</form>';
      wireBar();
      var es = document.getElementById('es'), ta = document.getElementById('b');

      function drawCover() {
        var cb = document.getElementById('cb'), src = coverSrc(cur);
        cb.innerHTML = (src ? '<img src="' + esc(src) + '" alt="Cover preview">' : '') +
          '<input type="file" id="cf" accept="image/*">' + (cur.cover ? ' <button type="button" class="alt" id="cr">Remove</button>' : '');
        document.getElementById('cf').addEventListener('change', function (e) {
          var f = e.target.files[0]; if (!f) return;
          setStatus(es, 'Uploading cover\u2026');
          S.uploadCover(f).then(function (r) { cur.cover = r.url; cur.preview = r.preview; drawCover(); setStatus(es, 'Cover ready. Remember to save the article.', 'ok'); })
            .catch(function (er) { if (er.status === 401) return viewLogin(er.message); setStatus(es, er.message, 'err'); });
        });
        var cr = document.getElementById('cr');
        if (cr) cr.addEventListener('click', function () { cur.cover = ''; cur.preview = ''; drawCover(); });
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
      });
      var pvbox = document.getElementById('pvbox');
      document.getElementById('pv').addEventListener('click', function () {
        var on = pvbox.style.display === 'none';
        pvbox.style.display = on ? 'block' : 'none';
        if (on) pvbox.innerHTML = A.md(ta.value) || '<i>Nothing to preview.</i>';
        this.textContent = on ? 'Hide preview' : 'Preview';
      });

      function setBusy(on) { Array.prototype.forEach.call(app.querySelectorAll('#ef button'), function (b) { b.disabled = on; }); }
      function save(status) {
        var data = { id: cur.id || undefined, title: document.getElementById('t').value, discipline: document.getElementById('d').value,
          body: ta.value, excerpt: document.getElementById('x').value, cover: cur.cover || '', status: status };
        if (!data.title.trim()) { setStatus(es, 'Please give the article a title.', 'err'); return; }
        setBusy(true); setStatus(es, 'Saving\u2026');
        S.save(data).then(function (saved) {
          cur = Object.assign(cur, saved); id = saved.id;
          var live = S.info().demo ? 'It now appears in The Journal and The Archives.' : 'Saved to GitHub. It will appear in The Journal and The Archives in about a minute.';
          setStatus(es, status === 'published' ? 'Published. ' + live : (S.info().demo ? 'Saved as draft.' : 'Draft saved to GitHub.'), 'ok');
          document.getElementById('pb').textContent = status === 'published' ? 'Update published' : 'Publish';
          var nh = '#edit=' + saved.id; if (location.hash !== nh) { ignoreHash = true; location.hash = nh; }
          if (!document.getElementById('dl') && saved.id) {
            var d = document.createElement('button'); d.type = 'button'; d.className = 'danger'; d.id = 'dl'; d.textContent = 'Delete';
            document.querySelector('#ef .btnrow').appendChild(d); wireDelete();
          }
        }).catch(function (er) { if (er.status === 401) return viewLogin(er.message); setStatus(es, er.message, 'err'); })
          .then(function () { setBusy(false); });
      }
      document.getElementById('sd').addEventListener('click', function () { save('draft'); });
      document.getElementById('pb').addEventListener('click', function () { save('published'); });
      function wireDelete() {
        var dl = document.getElementById('dl'); if (!dl) return;
        armed(dl, 'Tap again to delete', function () {
          if (!cur.id) return;
          setBusy(true); setStatus(es, 'Deleting\u2026');
          S.remove(cur.id).then(function () { go('#'); }).catch(function (er) { setBusy(false); if (er.status === 401) return viewLogin(er.message); setStatus(es, er.message, 'err'); });
        });
      }
      wireDelete();
      if (location.hash === '#new') document.getElementById('t').focus();
    }).catch(handleErr);
  }

  function handleErr(e) {
    if (e && e.status === 401) return viewLogin(e.message || 'Please connect to GitHub.');
    app.innerHTML = bar('list') + '<p class="notice">Something went wrong: ' + esc(e && e.message || e) + '</p>';
    wireBar();
  }

  /* ---------- routing ---------- */
  function route() {
    S.me().then(function (ok) {
      if (!ok) return viewLogin();
      var h = location.hash || '#';
      if (h === '#new') return viewEditor(null);
      if (h.indexOf('#edit=') === 0) return viewEditor(decodeURIComponent(h.slice(6)));
      viewList('all');
    });
  }
  window.addEventListener('hashchange', function () { if (ignoreHash) { ignoreHash = false; return; } route(); });
  route();
})();
                         
