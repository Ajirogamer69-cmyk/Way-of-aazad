/* The Way of Aazad \u2014 public pages (header, footer, sidebar and page renderers) */
(function () {
  'use strict';
  var A = window.Aazad, S = A.Store, esc = A.esc, D = A.DISCIPLINES;
  var page = document.body.getAttribute('data-page') || 'home';
  function $(id) { return document.getElementById(id); }

  var NAV = [
    ['index.html', 'Home', 'home'], ['journal.html', 'The Journal', 'journal'],
    ['disciplines.html', 'The Disciplines', 'disciplines'], ['archives.html', 'The Archives', 'archives'],
    ['library.html', 'The Library', 'library'], ['about.html', 'About Aazad', 'about'],
    ['guestbook.html', 'Guestbook', 'guestbook']
  ];

  /* antique armillary sphere, drawn as a little engraving */
  function sphere() {
    var ticks = '';
    for (var i = 0; i < 36; i++) {
      var a = i * 10 * Math.PI / 180, r1 = 46, r2 = i % 3 === 0 ? 42 : 44;
      ticks += '<line x1="' + (50 + r1 * Math.cos(a)).toFixed(1) + '" y1="' + (50 + r1 * Math.sin(a)).toFixed(1) +
        '" x2="' + (50 + r2 * Math.cos(a)).toFixed(1) + '" y2="' + (50 + r2 * Math.sin(a)).toFixed(1) + '"/>';
    }
    return '<svg viewBox="0 0 100 100" role="img" aria-label="Armillary sphere engraving" fill="none" stroke="#A18B63" stroke-width=".9">' +
      '<circle cx="50" cy="50" r="46"/><circle cx="50" cy="50" r="40" stroke-width=".5"/>' + ticks +
      '<ellipse cx="50" cy="50" rx="40" ry="13"/><ellipse cx="50" cy="50" rx="13" ry="40"/>' +
      '<ellipse cx="50" cy="50" rx="40" ry="13" transform="rotate(-23.5 50 50)" stroke-width=".6"/>' +
      '<ellipse cx="50" cy="50" rx="28" ry="40" stroke-width=".5" transform="rotate(30 50 50)"/>' +
      '<line x1="50" y1="2" x2="50" y2="98"/><circle cx="50" cy="50" r="6" fill="#A18B63"/>' +
      '<circle cx="86" cy="30" r="2.2" fill="#E8DFC9" stroke="none"/><circle cx="20" cy="74" r="1.6" fill="#E8DFC9" stroke="none"/></svg>';
  }
  /* pixel-art star (8x8) */
  function pixelStar(color) {
    var g = ['...XX...', '...XX...', '..XXXX..', 'XXXXXXXX', '.XXXXXX.', '..XXXX..', '.XX..XX.', 'XX....XX'], r = '';
    g.forEach(function (row, y) { row.split('').forEach(function (c, x) { if (c === 'X') r += '<rect x="' + x + '" y="' + y + '" width="1" height="1"/>'; }); });
    return '<svg width="16" height="16" viewBox="0 0 8 8" shape-rendering="crispEdges" fill="' + (color || '#A18B63') + '" aria-hidden="true">' + r + '</svg>';
  }

  function head() {
    var nav = NAV.map(function (n) {
      return '<li><a href="' + n[0] + '"' + (n[2] === page || (page === 'post' && n[2] === 'journal') ? ' class="on"' : '') + '>' + n[1] + '</a></li>';
    }).join('');
    $('head').innerHTML =
      '<div class="masthead">' + sphere() + '<div><h1 class="title"><a href="index.html">The Way of Aazad</a></h1>' +
      '<p class="tagline">Between Logic and Imagination.</p><div class="byline">Aazad &middot; Polymath &middot; A Personal Intellectual Journal</div></div></div>' +
      '<ul class="nav">' + nav + '</ul>';
  }
  function foot() {
    $('foot').innerHTML = '<div class="footer">' + pixelStar() + ' &nbsp;<i>Between Logic and Imagination</i>&nbsp; ' + pixelStar() +
      '<br>Handwritten in the spirit of the early web &middot; Best viewed with an open mind<br>&copy; ' + new Date().getFullYear() +
      ' Aazad &middot; <a href="admin/">admin</a></div>';
  }

  function card(p) {
    var thumb = p.cover ? '<a class="thumb" href="post.html?slug=' + encodeURIComponent(p.slug) + '"><img src="' + esc(p.cover) + '" alt="" loading="lazy"></a>'
      : '<a class="thumb none" href="post.html?slug=' + encodeURIComponent(p.slug) + '" aria-hidden="true">' + sphereMini() + '</a>';
    return '<article class="card">' + thumb + '<div><h3><a href="post.html?slug=' + encodeURIComponent(p.slug) + '">' + esc(p.title) + '</a></h3>' +
      '<div class="meta">' + esc(A.fmtDate(p.publishedAt || p.createdAt)) + ' &middot; <a class="tag" href="journal.html?d=' + esc(p.discipline) + '">' + esc(A.discName(p.discipline)) + '</a></div>' +
      '<p class="excerpt">' + esc(p.excerpt) + '</p></div></article>';
  }
  function sphereMini() {
    return '<svg width="44" height="44" viewBox="0 0 100 100" fill="none" stroke="#A18B63" stroke-width="2"><circle cx="50" cy="50" r="44"/><ellipse cx="50" cy="50" rx="44" ry="14"/><ellipse cx="50" cy="50" rx="14" ry="44"/><circle cx="50" cy="50" r="6" fill="#A18B63"/></svg>';
  }

  function side(posts) {
    var counts = {};
    posts.forEach(function (p) { counts[p.discipline] = (counts[p.discipline] || 0) + 1; });
    var disc = D.map(function (d) { return '<li><a href="journal.html?d=' + d.slug + '">' + esc(d.name) + '</a> (' + (counts[d.slug] || 0) + ')</li>'; }).join('');
    var recent = posts.slice(0, 5).map(function (p) { return '<li><a href="post.html?slug=' + encodeURIComponent(p.slug) + '">' + esc(p.title) + '</a></li>'; }).join('') || '<li><i>Nothing yet.</i></li>';
    $('side').innerHTML =
      '<div class="box"><h4>Aazad</h4><div class="in">Reader, writer, tinkerer. This is my corner of the web for ideas that refuse to stay in one subject. <a href="about.html">More about me&hellip;</a></div></div>' +
      '<div class="box"><h4>The Disciplines</h4><div class="in"><ul>' + disc + '</ul></div></div>' +
      '<div class="box"><h4>Recently Added</h4><div class="in"><ul>' + recent + '</ul></div></div>' +
      '<div class="box"><h4>Sign the Guestbook</h4><div class="in">Passing through? <a href="guestbook.html">Leave a note</a>.</div></div>';
  }

  function demoBanner() {
    S.mode().then(function (m) {
      if (m !== 'demo') return;
      var b = document.createElement('div');
      b.className = 'banner-demo';
      b.innerHTML = 'Preview mode &mdash; posts live in this browser only. <a href="admin/">Open the admin</a> (password: <b>demo</b>)';
      document.body.insertBefore(b, document.body.firstChild);
    });
  }
  function adminFab(postId) {
    S.me().then(function (ok) {
      if (!ok) return;
      var a = document.createElement('a');
      a.className = 'btn fab'; a.href = 'admin/#new'; a.textContent = '\u270e Write';
      document.body.appendChild(a);
      if (postId && $('editlink')) { $('editlink').innerHTML = ' &middot; <a href="admin/#edit=' + encodeURIComponent(postId) + '">Edit this article</a>'; }
    });
  }

  /* ---------- page renderers ---------- */
  var R = {};
  R.home = function (posts) {
    var latest = posts.slice(0, 3).map(card).join('') || '<p><i>The journal is empty for now. Check back soon.</i></p>';
    var grid = D.map(function (d) {
      return '<div class="disc"><div class="sym">' + d.sym + '</div><h3><a href="journal.html?d=' + d.slug + '">' + esc(d.name) + '</a></h3><p>' + esc(d.blurb) + '</p></div>';
    }).join('');
    $('content').innerHTML =
      '<h2>Welcome, Traveller</h2><p>This is <b>The Way of Aazad</b> &mdash; a personal journal kept by someone who cannot decide between the proof and the poem, and has stopped trying to. ' +
      'Here you will find essays and notes on mathematics, philosophy, the night sky, books, machines and the odd drawing, all gathered between <i>logic</i> and <i>imagination</i>.</p><hr class="orn">' +
      '<h2>Latest from the Journal</h2>' + latest + '<p><a href="journal.html">&raquo; Read the whole Journal</a> &nbsp;&middot;&nbsp; <a href="archives.html">&raquo; Browse the Archives</a></p><hr class="orn">' +
      '<h2>The Disciplines</h2><div class="grid">' + grid + '</div>';
  };

  R.journal = function (posts) {
    var d = new URLSearchParams(location.search).get('d');
    var list = d ? posts.filter(function (p) { return p.discipline === d; }) : posts;
    var title = d ? 'The Journal &mdash; ' + esc(A.discName(d)) : 'The Journal';
    $('content').innerHTML = '<h2>' + title + '</h2>' +
      (d ? '<p class="small"><a href="journal.html">&laquo; Show all entries</a></p>' : '') +
      (list.map(card).join('') || '<p><i>No entries here yet.</i></p>');
  };

  R.post = function () {
    var slug = new URLSearchParams(location.search).get('slug') || '';
    S.bySlug(slug).then(function (p) {
      document.title = p.title + ' \u2014 The Way of Aazad';
      $('content').innerHTML = '<article class="post"><h2 class="post-title">' + esc(p.title) + '</h2>' +
        '<div class="meta">' + esc(A.fmtDate(p.publishedAt || p.createdAt)) + ' &middot; <a class="tag" href="journal.html?d=' + esc(p.discipline) + '">' + esc(A.discName(p.discipline)) + '</a><span id="editlink"></span></div>' +
        (p.cover ? '<img class="post-cover" src="' + esc(p.cover) + '" alt="">' : '') +
        '<div class="post-body">' + A.md(p.body) + '</div><hr class="orn"><p><a href="journal.html">&laquo; Back to The Journal</a></p></article>';
      adminFab(p.id);
    }).catch(function () {
      $('content').innerHTML = '<h2>Page Not Found</h2><p>That entry could not be found. It may be a draft, or it may have been removed.</p><p><a href="journal.html">&laquo; Back to The Journal</a></p>';
    });
  };

  R.disciplines = function (posts) {
    var counts = {};
    posts.forEach(function (p) { counts[p.discipline] = (counts[p.discipline] || 0) + 1; });
    $('content').innerHTML = '<h2>The Disciplines</h2><p>Six rooms in one house. Pick a door.</p><div class="grid">' + D.map(function (d) {
      var n = counts[d.slug] || 0;
      return '<div class="disc"><div class="sym">' + d.sym + '</div><h3>' + esc(d.name) + '</h3><p>' + esc(d.blurb) + '</p><a href="journal.html?d=' + d.slug + '">' + n + ' entr' + (n === 1 ? 'y' : 'ies') + ' &raquo;</a></div>';
    }).join('') + '</div>';
  };

  R.archives = function (posts) {
    var years = {}, months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    posts.forEach(function (p) {
      var d = new Date(p.publishedAt || p.createdAt), y = d.getFullYear(), m = d.getMonth();
      years[y] = years[y] || {}; (years[y][m] = years[y][m] || []).push(p);
    });
    var html = Object.keys(years).sort(function (a, b) { return b - a; }).map(function (y) {
      return '<h3>' + y + '</h3>' + Object.keys(years[y]).sort(function (a, b) { return b - a; }).map(function (m) {
        return '<p class="small"><b>' + months[m] + '</b></p><ul>' + years[y][m].map(function (p) {
          var d = new Date(p.publishedAt || p.createdAt);
          return '<li><span class="d">' + d.getDate() + ' ' + months[m].slice(0, 3) + '</span><a href="post.html?slug=' + encodeURIComponent(p.slug) + '">' + esc(p.title) + '</a> <small>&mdash; ' + esc(A.discName(p.discipline)) + '</small></li>';
        }).join('') + '</ul>';
      }).join('');
    }).join('');
    $('content').innerHTML = '<h2>The Archives</h2><p>Every published entry, in order of appearance. ' + posts.length + ' in total.</p><div class="arch">' + (html || '<p><i>Nothing archived yet.</i></p>') + '</div>';
  };

  R.guestbook = function () {
    var f = $('gbform'), msg = $('gbmsg');
    function load() {
      S.guestbook().then(function (list) {
        $('gblist').innerHTML = list.map(function (e) {
          return '<div class="entry"><span class="who">' + esc(e.name) + '</span> <span class="meta">&middot; ' + esc(A.fmtDate(e.at)) + '</span><p>' + esc(e.message) + '</p></div>';
        }).join('') || '<p><i>No signatures yet. Be the first.</i></p>';
      });
    }
    f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var b = f.querySelector('button'); b.disabled = true; msg.className = 'status-line'; msg.textContent = 'Signing\u2026';
      S.sign(f.name.value, f.message.value, f.website.value).then(function () {
        f.reset(); msg.className = 'status-line ok'; msg.textContent = 'Thank you for signing the guestbook.'; load();
      }).catch(function (e) { msg.className = 'status-line err'; msg.textContent = e.message; })
        .then(function () { b.disabled = false; });
    });
    load();
  };

  /* ---------- boot ---------- */
  head(); foot(); demoBanner();
  var needsPosts = { home: 1, journal: 1, disciplines: 1, archives: 1 };
  if (page === 'post' || page === 'guestbook') {
    R[page]();
    S.published().then(side).catch(function () { side([]); });
    if (page === 'guestbook') adminFab();
  } else if (needsPosts[page]) {
    S.published().then(function (posts) { R[page](posts); side(posts); adminFab(); })
      .catch(function () { $('content').innerHTML = '<p>Sorry &mdash; the journal could not be loaded right now.</p>'; side([]); });
  } else {
    S.published().then(side).catch(function () { side([]); });
    adminFab();
  }
})();
