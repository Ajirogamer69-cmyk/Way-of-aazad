# The Way of Aazad

*Between Logic and Imagination.* A personal intellectual journal in the spirit of the 1998–2001 web (parchment & navy), with a built-in admin dashboard. Mobile-friendly. **No npm dependencies**, just Node 18+.

## Run it

```bash
cp .env.example .env     # then edit ADMIN_PASSWORD and SESSION_SECRET
node server.js           # http://localhost:3000   admin: http://localhost:3000/admin/
```

If you don't set `ADMIN_PASSWORD` in development, a temporary one is printed in the terminal.

## Admin (`/admin/`)

Sign in, then: write a title and article, upload a cover image, pick a discipline, **Save as draft** or **Publish**, edit or delete any post, and moderate the guestbook. Published posts show up automatically in **The Journal**, **The Archives**, the Disciplines counts and the sidebar. Drafts are never public. While signed in, public post pages show an **Edit this article** link and a floating **Write** button, so quick edits from your phone take two taps.

Writing format: blank line = new paragraph, `## Heading`, `> quote`, `- list`, `**bold**`, `*italic*`, `[text](https://link)`, `---` ornament line. Toolbar buttons insert these for you.

## Put it on GitHub

```bash
git init && git add . && git commit -m "The Way of Aazad"
git branch -M main
git remote add origin https://github.com/YOU/the-way-of-aazad.git
git push -u origin main
```

`.env` and `data/` are git-ignored, so your password and posts are never pushed.

## Hosting (important)

- **Real mode (login, saved posts, image uploads)** needs a Node host: Render, Railway, Fly.io, a VPS, etc. Start command: `node server.js`. Set the env vars from `.env.example` in the host's dashboard (including `NODE_ENV=production`), and attach a **persistent disk**, setting `DATA_DIR` to its path. Otherwise posts and uploads vanish when the host redeploys.
- **GitHub Pages** is static, so it cannot run the server. If you publish `public/` there, the site automatically falls back to **demo mode**: it works, but posts are stored only in the visitor's own browser, and the admin password is `demo`. Fine for a preview, not for a real blog.

## Customising

- Pages: `public/*.html` (About and Library are plain HTML, so edit them directly).
- Disciplines: the list in `public/js/store.js` **and** `DISCIPLINES` in `server.js` (keep them in sync).
- Look: `public/css/style.css` (colour variables at the top).
- First-run sample posts: `public/seed/posts.json` (copied into `data/` on first start only).

## Security notes

Password is verified with scrypt and constant-time comparison; sessions are HMAC-signed, `HttpOnly`, `SameSite=Strict` (and `Secure` over HTTPS); login locks for 15 minutes after 5 failures; uploads are size-limited and checked by file signature; all user text is HTML-escaped; strict Content-Security-Policy. Put the site behind HTTPS (every host above does this for you) and use a long password.
