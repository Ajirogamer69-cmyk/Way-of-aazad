'use strict';
/**
 * The Way of Aazad — tiny blog server. No npm dependencies (Node 18+).
 *   - Public site:  /            (static files in ./public)
 *   - Admin:        /admin/      (log in, write, upload cover, draft/publish, edit, delete)
 *   - Data:         ./data/posts.json, guestbook.json, uploads/   (set DATA_DIR to move it)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/* ---------- config (.env file or real environment variables) ---------- */
(function loadEnv() {
  try {
    fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/).forEach((l) => {
      const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    });
  } catch (e) { /* no .env — fine */ }
})();

const PORT = parseInt(process.env.PORT, 10) || 3000;
const PROD = process.env.NODE_ENV === 'production';
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const DATA = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, 'data');
const UPLOADS = path.join(DATA, 'uploads');
const POSTS_FILE = path.join(DATA, 'posts.json');
const GUEST_FILE = path.join(DATA, 'guestbook.json');
const ADMIN_USER = process.env.ADMIN_USER || 'aazad';
const SESSION_HOURS = 24 * 7;

let ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_PASSWORD) {
  if (PROD) { console.error('FATAL: set ADMIN_PASSWORD in the environment before running in production.'); process.exit(1); }
  ADMIN_PASSWORD = crypto.randomBytes(9).toString('base64url');
  console.log('\n  No ADMIN_PASSWORD set — using a temporary one for this run:');
  console.log('  username: ' + ADMIN_USER + '\n  password: ' + ADMIN_PASSWORD + '\n');
}
let SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
  if (PROD) console.warn('WARNING: SESSION_SECRET not set — admin sessions will reset on every restart.');
  SESSION_SECRET = crypto.randomBytes(32).toString('hex');
}

const SALT = crypto.randomBytes(16);
const PW_HASH = crypto.scryptSync(ADMIN_PASSWORD, SALT, 64);
const USER_HASH = crypto.createHash('sha256').update(ADMIN_USER).digest();

const DISCIPLINES = ['logic-mathematics', 'philosophy', 'astronomy-physics', 'literature-language', 'computing', 'art-imagination'];

/* ---------- storage ---------- */
fs.mkdirSync(UPLOADS, { recursive: true });
function readJSON(file, fallback) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return fallback; } }
function writeJSON(file, data) {
  const tmp = file + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}
function seed(file, seedName) {
  if (!fs.existsSync(file)) writeJSON(file, readJSON(path.join(PUBLIC, 'seed', seedName), []));
}
seed(POSTS_FILE, 'posts.json');
seed(GUEST_FILE, 'guestbook.json');
const getPosts = () => readJSON(POSTS_FILE, []);
const getGuest = () => readJSON(GUEST_FILE, []);

/* ---------- helpers ---------- */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json'
};
const SEC_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'same-origin',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
};

function send(res, status, body, headers) {
  res.writeHead(status, Object.assign({}, SEC_HEADERS, headers || {}));
  res.end(body);
}
function json(res, status, obj, headers) {
  send(res, status, JSON.stringify(obj), Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, headers || {}));
}
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(Object.assign(new Error('Request too large'), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); }
      catch (e) { reject(Object.assign(new Error('Invalid JSON'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}
function clientIp(req) { return String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim(); }
function isHttps(req) { return PROD || req.headers['x-forwarded-proto'] === 'https'; }

/* ---------- sessions ---------- */
function sign(payload) { return crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url'); }
function makeToken() {
  const p = Buffer.from(JSON.stringify({ u: ADMIN_USER, exp: Date.now() + SESSION_HOURS * 3600e3 })).toString('base64url');
  return p + '.' + sign(p);
}
function parseCookies(req) {
  const o = {};
  String(req.headers.cookie || '').split(';').forEach((c) => { const i = c.indexOf('='); if (i > 0) o[c.slice(0, i).trim()] = c.slice(i + 1).trim(); });
  return o;
}
function isAdmin(req) {
  const t = parseCookies(req).aazad_session; if (!t) return false;
  const [p, s] = t.split('.'); if (!p || !s) return false;
  const good = Buffer.from(sign(p)), got = Buffer.from(s);
  if (good.length !== got.length || !crypto.timingSafeEqual(good, got)) return false;
  try { const d = JSON.parse(Buffer.from(p, 'base64url').toString()); return d.u === ADMIN_USER && d.exp > Date.now(); } catch (e) { return false; }
}
function cookie(req, value, maxAge) {
  return 'aazad_session=' + value + '; HttpOnly; SameSite=Strict; Path=/; Max-Age=' + maxAge + (isHttps(req) ? '; Secure' : '');
}
function requireAdmin(req, res) {
  if (isAdmin(req)) return true;
  json(res, 401, { error: 'Please sign in.' }); return false;
}
function sameOrigin(req) {
  const o = req.headers.origin; if (!o) return true;
  try { return new URL(o).host === req.headers.host; } catch (e) { return false; }
}

/* login throttle: 5 misses -> 15 minute lock, per IP */
const fails = new Map();
function throttled(ip) { const f = fails.get(ip); return f && f.until > Date.now() && f.n >= 5 ? Math.ceil((f.until - Date.now()) / 60000) : 0; }
function fail(ip) { const f = fails.get(ip) || { n: 0, until: 0 }; if (f.until < Date.now()) f.n = 0; f.n++; f.until = Date.now() + 15 * 60e3; fails.set(ip, f); }
/* guestbook throttle: 1 post / 30s per IP */
const gbLast = new Map();

/* ---------- posts ---------- */
function slugify(t) {
  return String(t).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'untitled';
}
function makeExcerpt(body) {
  const t = String(body).replace(/[#>*_\[\]()`-]/g, ' ').replace(/\s+/g, ' ').trim();
  return t.length > 170 ? t.slice(0, 167).replace(/\s+\S*$/, '') + '…' : t;
}
const COVER_RE = /^\/uploads\/[a-f0-9]{16,}\.(jpg|png|webp|gif)$/;
function validatePost(input, existing, all) {
  const title = String(input.title || '').trim();
  if (!title) throw Object.assign(new Error('Please give the article a title.'), { status: 400 });
  if (title.length > 200) throw Object.assign(new Error('Title is too long.'), { status: 400 });
  const body = String(input.body || '');
  if (body.length > 100000) throw Object.assign(new Error('Article is too long.'), { status: 400 });
  const cover = String(input.cover || '');
  if (cover && !COVER_RE.test(cover)) throw Object.assign(new Error('Invalid cover image.'), { status: 400 });
  const now = new Date().toISOString();
  const p = existing ? Object.assign({}, existing) : { id: crypto.randomBytes(6).toString('hex'), createdAt: now };
  p.title = title;
  p.body = body;
  p.excerpt = String(input.excerpt || '').trim().slice(0, 300) || makeExcerpt(body);
  p.discipline = DISCIPLINES.includes(input.discipline) ? input.discipline : DISCIPLINES[0];
  p.cover = cover;
  p.status = input.status === 'published' ? 'published' : 'draft';
  p.updatedAt = now;
  if (p.status === 'published' && !p.publishedAt) p.publishedAt = now;
  if (!p.slug) {
    const base = slugify(title); let s = base, n = 2;
    while (all.some((x) => x.slug === s)) s = base + '-' + n++;
    p.slug = s;
  }
  return p;
}
const byNewest = (a, b) => new Date(b.publishedAt || b.createdAt) - new Date(a.publishedAt || a.createdAt);

/* ---------- uploads ---------- */
function sniff(buf) {
  if (buf.length > 12 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length > 8 && buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length > 12 && buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') return 'webp';
  if (buf.length > 6 && /^GIF8[79]a/.test(buf.slice(0, 6).toString('latin1'))) return 'gif';
  return null;
}
function coverInUse(url, exceptId) { return getPosts().some((p) => p.cover === url && p.id !== exceptId); }
function dropCover(url) {
  if (!url || !COVER_RE.test(url)) return;
  fs.unlink(path.join(UPLOADS, path.basename(url)), () => {});
}

/* ---------- API ---------- */
async function api(req, res, pathname) {
  const method = req.method;
  if (method !== 'GET' && method !== 'HEAD' && !sameOrigin(req)) return json(res, 403, { error: 'Cross-origin request blocked.' });

  if (pathname === '/api/ping') return json(res, 200, { ok: true });

  if (pathname === '/api/login' && method === 'POST') {
    const ip = clientIp(req), wait = throttled(ip);
    if (wait) return json(res, 429, { error: 'Too many attempts. Try again in ' + wait + ' minute(s).' });
    const b = await readBody(req, 4096);
    const uOk = crypto.timingSafeEqual(crypto.createHash('sha256').update(String(b.username || '')).digest(), USER_HASH);
    const pOk = crypto.timingSafeEqual(crypto.scryptSync(String(b.password || ''), SALT, 64), PW_HASH);
    if (!(uOk && pOk)) { fail(ip); return json(res, 401, { error: 'Wrong username or password.' }); }
    fails.delete(ip);
    return json(res, 200, { ok: true }, { 'Set-Cookie': cookie(req, makeToken(), SESSION_HOURS * 3600) });
  }
  if (pathname === '/api/logout' && method === 'POST') return json(res, 200, { ok: true }, { 'Set-Cookie': cookie(req, '', 0) });
  if (pathname === '/api/me') return json(res, 200, { admin: isAdmin(req) });

  /* public reads */
  if (pathname === '/api/posts' && method === 'GET') {
    const posts = getPosts().filter((p) => p.status === 'published').sort(byNewest).map((p) => { const q = Object.assign({}, p); delete q.body; return q; });
    return json(res, 200, { posts });
  }
  let m = pathname.match(/^\/api\/posts\/([^/]+)$/);
  if (m && method === 'GET') {
    const slug = decodeURIComponent(m[1]);
    const p = getPosts().find((x) => x.slug === slug && x.status === 'published');
    return p ? json(res, 200, { post: p }) : json(res, 404, { error: 'Not found' });
  }
  if (pathname === '/api/guestbook' && method === 'GET') {
    return json(res, 200, { entries: getGuest().sort((a, b) => new Date(b.at) - new Date(a.at)).map(({ id, name, message, at }) => ({ id, name, message, at })) });
  }
  if (pathname === '/api/guestbook' && method === 'POST') {
    const b = await readBody(req, 8192);
    if (b.website) return json(res, 200, { ok: true }); // honeypot: pretend success
    const name = String(b.name || '').trim().slice(0, 60), message = String(b.message || '').trim().slice(0, 1000);
    if (!name || !message) return json(res, 400, { error: 'Please fill in your name and a message.' });
    const ip = clientIp(req);
    if (Date.now() - (gbLast.get(ip) || 0) < 30000) return json(res, 429, { error: 'Please wait a little before signing again.' });
    gbLast.set(ip, Date.now());
    const g = getGuest(); g.push({ id: crypto.randomBytes(6).toString('hex'), name, message, at: new Date().toISOString() });
    writeJSON(GUEST_FILE, g.slice(-500));
    return json(res, 201, { ok: true });
  }

  /* everything below needs the admin */
  if (!pathname.startsWith('/api/admin/')) return json(res, 404, { error: 'Not found' });
  if (!requireAdmin(req, res)) return;

  if (pathname === '/api/admin/posts' && method === 'GET') {
    return json(res, 200, { posts: getPosts().sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)) });
  }
  if (pathname === '/api/admin/posts' && method === 'POST') {
    const all = getPosts(), p = validatePost(await readBody(req, 300000), null, all);
    all.push(p); writeJSON(POSTS_FILE, all);
    return json(res, 201, { post: p });
  }
  m = pathname.match(/^\/api\/admin\/posts\/([a-f0-9]+|seed\d+)$/);
  if (m && method === 'PUT') {
    const all = getPosts(), i = all.findIndex((x) => x.id === m[1]);
    if (i < 0) return json(res, 404, { error: 'Article not found.' });
    const old = all[i], p = validatePost(await readBody(req, 300000), old, all);
    all[i] = p; writeJSON(POSTS_FILE, all);
    if (old.cover && old.cover !== p.cover && !coverInUse(old.cover, p.id)) dropCover(old.cover);
    return json(res, 200, { post: p });
  }
  if (m && method === 'DELETE') {
    const all = getPosts(), i = all.findIndex((x) => x.id === m[1]);
    if (i < 0) return json(res, 404, { error: 'Article not found.' });
    const [gone] = all.splice(i, 1); writeJSON(POSTS_FILE, all);
    if (gone.cover && !coverInUse(gone.cover, gone.id)) dropCover(gone.cover);
    return json(res, 200, { ok: true });
  }
  if (pathname === '/api/admin/upload' && method === 'POST') {
    const b = await readBody(req, 9 * 1024 * 1024);
    const mm = String(b.dataUrl || '').match(/^data:image\/(?:jpeg|png|webp|gif);base64,([A-Za-z0-9+/=]+)$/);
    if (!mm) return json(res, 400, { error: 'Please upload a JPEG, PNG, WebP or GIF image.' });
    const buf = Buffer.from(mm[1], 'base64');
    if (buf.length > 6 * 1024 * 1024) return json(res, 413, { error: 'Image is too large (6 MB max).' });
    const ext = sniff(buf);
    if (!ext) return json(res, 400, { error: 'That file does not look like a real image.' });
    const name = crypto.randomBytes(12).toString('hex') + '.' + ext;
    fs.writeFileSync(path.join(UPLOADS, name), buf);
    return json(res, 201, { url: '/uploads/' + name });
  }
  m = pathname.match(/^\/api\/admin\/guestbook\/([a-f0-9]+)$/);
  if (m && method === 'DELETE') {
    writeJSON(GUEST_FILE, getGuest().filter((e) => e.id !== m[1]));
    return json(res, 200, { ok: true });
  }
  return json(res, 404, { error: 'Not found' });
}

/* ---------- static files ---------- */
function serveFile(req, res, file, extra) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' });
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, Object.assign({}, SEC_HEADERS, { 'Content-Type': type, 'Content-Length': st.size }, extra || {}));
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
}
function within(base, target) { const r = path.relative(base, target); return r && !r.startsWith('..') && !path.isAbsolute(r); }

const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, 'http://x');
    let pathname;
    try { pathname = decodeURIComponent(u.pathname); } catch (e) { return send(res, 400, 'Bad request'); }
    if (pathname.includes('\0')) return send(res, 400, 'Bad request');

    if (pathname.startsWith('/api/')) return await api(req, res, pathname);
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');

    if (pathname === '/admin') return send(res, 301, '', { Location: '/admin/' });
    if (pathname.startsWith('/uploads/')) {
      const f = path.join(UPLOADS, path.basename(pathname));
      return serveFile(req, res, f, { 'Cache-Control': 'public, max-age=31536000, immutable' });
    }
    if (pathname.startsWith('/seed/')) return send(res, 404, 'Not found'); // seed files are only for demo mode

    let f = path.join(PUBLIC, pathname);
    if (pathname.endsWith('/')) f = path.join(f, 'index.html');
    if (!within(PUBLIC, f)) return send(res, 403, 'Forbidden');
    const extra = /\.(html)$/.test(f) ? { 'Cache-Control': 'no-cache' } : { 'Cache-Control': 'public, max-age=300' };
    return serveFile(req, res, f, extra);
  } catch (e) {
    const status = e.status || 500;
    if (status === 500) console.error(e);
    if (!res.headersSent) json(res, status, { error: status === 500 ? 'Server error' : e.message });
  }
});

server.listen(PORT, () => {
  console.log('The Way of Aazad is running:  http://localhost:' + PORT + '   (admin: /admin/)');
});
