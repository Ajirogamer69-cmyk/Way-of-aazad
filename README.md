# The Way of Aazad

*Between Logic and Imagination.* A personal intellectual journal in the spirit of the 1998-2001 web (parchment and navy), with an admin dashboard. Hosted free on **GitHub Pages**; the admin saves posts straight into this repository. No server, no npm, no cost.

## How it works

- The site is the `public/` folder. A workflow (`.github/workflows/pages.yml`) publishes it to GitHub Pages on every push.
- Posts live in `public/data/posts.json`; cover images in `public/uploads/`.
- Visit `/admin/index.html` on your site, connect with a GitHub token, then write, upload a cover, pick a discipline, save a draft or publish, edit or delete. Each save is a commit, and the site updates about a minute later.
- The Guestbook links to this repository's GitHub Discussions.

## One-time setup

1. Repository must be **public** (free GitHub Pages requires it).
2. Add `.github/workflows/pages.yml` to the repo.
3. Settings, **Pages**, Source: **GitHub Actions**.
4. Settings, General, Features: tick **Discussions** (for the guestbook).
5. Create a fine-grained token: Settings (profile), Developer settings, Personal access tokens, Fine-grained tokens. Repository access: only this repository. Permission: **Contents: Read and write**.
6. Open `https://YOURNAME.github.io/REPO/admin/index.html`, paste the repository name and token.

## Writing format

Blank line = new paragraph, `## Heading`, `> quote`, `- list`, `**bold**`, `*italic*`, `[text](https://link)`, `---` ornament line. The toolbar inserts these.

## Good to know

- The token is stored in the browser you connect from. Use a token limited to this one repository, set an expiry, and revoke it on GitHub if a phone is lost. Don't connect on a shared computer.
- Drafts are saved in the same data file the site reads, so anyone who finds that file could read them. Keep private material out of drafts.
- Demo mode ("Try demo mode" on the admin sign-in) keeps posts in the browser only; nothing goes to GitHub.
- Disciplines are listed in `public/js/store.js`. Colours are variables at the top of `public/css/style.css`. About and Library are plain HTML pages.
