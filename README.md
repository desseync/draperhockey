# DRAPER Hockey — V1

Premium, privacy-first Hugo starter for draperhockey.com.

## Local setup

1. Install Hugo Extended.
2. Open this folder in VS Code.
3. In the VS Code terminal:

```bash
hugo server -D
```

4. Open:

```text
http://localhost:1313
```

## GitHub

From the project folder:

```bash
git init
git add .
git commit -m "Initial Draper Hockey V1"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/draperhockey.git
git push -u origin main
```

## Netlify

1. Add a new project from Git.
2. Select the GitHub repository.
3. Netlify should use:
   - Build command: `hugo --gc --minify`
   - Publish directory: `public`
4. Deploy.
5. Add the custom domain `draperhockey.com`.
6. Enable Netlify Forms / form detection if you want the partner inquiry form to collect submissions.

The repo pins Hugo `0.165.0` in `netlify.toml`.

## Where to edit

- Homepage content: `layouts/index.html`
- Global navigation: `layouts/partials/nav.html`
- Footer: `layouts/partials/footer.html`
- Design: `static/css/main.css`
- Interactions: `static/js/main.js`
- Site settings: `hugo.toml`

## Photos later

V1 intentionally launches without requiring photos. When ready, add properly cropped WebP/AVIF images and wire them into the hero and story cards. Do not publish live schedules, schools, hotel details, or real-time location information for a minor.
