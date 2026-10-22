# GitHub Pages
1. Push to `main`. 2. Repo Settings → Pages → Source: **GitHub Actions**. 3. The workflow sets `VITE_BASE=/<repo-name>/` automatically; for a custom base, change the `VITE_BASE` env in `.github/workflows/deploy-pages.yml`. Hash routing means nested URLs survive refresh. Only static files are hosted.
