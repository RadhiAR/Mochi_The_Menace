# Mochi the Menace website

A small static website for Mochi: a flip-open photo book, an About & links page,
and a Dog FAQ page with a question form. No frameworks, no build step, no
tracking.

## Folder structure

```
Mochi/
├── index.html            Home: the photo book + "Caught on camera" videos
├── about.html            About Mochi & her mom, social links, affiliate links
├── diet.html             Dog FAQ (food, health, grooming, gear...) + "Ask Mochi's mom" form
├── privacy.html          Privacy policy (needed for the form and the App Store)
├── admin.html            Q&A admin: add, edit, delete Q&As (unlock with your token)
├── README.md             This file
├── package.json          "npm run dev" and "npm test"
├── .gitignore            Files git should skip (junk files, secrets)
├── .gitattributes        Keeps line endings and photos safe in git
├── .github/workflows/
│   ├── pipeline.yml      alpha → tests → beta → your approval → prod
│   └── deploy.yml        Publishes prod to GitHub Pages
├── tests/                Unit tests (run with "npm test")
├── scripts/
│   └── dev-server.mjs    Local preview server (no installs needed)
├── css/
│   └── styles.css        All styling
├── js/
│   ├── config.js         ★ YOUR SETTINGS: links, email, captions
│   ├── main.js           Shared: social/affiliate links, profile photo, footer
│   ├── photobook.js      Finds photos/videos and runs the flip book
│   ├── faq.js            Shows published Q&As on the FAQ page
│   ├── admin.js          Runs the admin page
│   └── ask-form.js       The question form
└── assets/
    ├── images/           mochi1.jpg, mochi2.jpg, mochi3.jpg ...
    ├── videos/           mochi1.mp4, mochi2.mp4 ...
    └── icons/            favicon.svg, apple-touch-icon.png, paw.svg
```

## Adding photos and videos

1. Photos go in `assets/images/`, named `mochi1.jpg`, `mochi2.jpg`, `mochi3.jpg` ...
2. Videos go in `assets/videos/`, named `mochi1.mp4`, `mochi2.mp4` ...
3. That's it. The site finds them automatically, in number order.

Tips:
- Use lowercase names. On a web server, `Moch1.JPG` and `mochi1.jpg` are different files.
- Don't skip more than 4 numbers in a row, or the site stops looking.
- iPhone photos are often HEIC, which most browsers can't show. Export or share them as JPG
  (on iPhone: Settings > Camera > Formats > Most Compatible).
- Resize photos to about 1600 px on the long side so the book loads fast.
- Keep videos short and MP4 (H.264). That format plays everywhere, including iPhone.
- `mochi1` is the book cover and profile picture. Change `coverPhoto` in `js/config.js` to use another.

## Editing text and links

- Links, email, affiliate items and photo captions: `js/config.js` (comments explain each one).
- Paragraphs about Mochi and her mom, "Mochi's file": `about.html`
- FAQ questions and answers: `diet.html` (copy a `<details>` block into a topic section to add one)
- Search the files for `✏️ EDIT` to find every spot meant for your own words.

Anything with an empty link (`url: ''`) is hidden, so the live site never shows
dead buttons.

## Turning on the question form

Pick one in `js/config.js`:

- **Formspree (recommended):** create a free form at formspree.io, then paste its address into
  `formEndpoint`, for example `'https://formspree.io/f/abcdwxyz'`. Questions arrive in your inbox.
- **Email app:** leave `formEndpoint` empty and set `contactEmail`. The form opens the visitor's
  email app with their question filled in.

If you use a form service other than Formspree, add its domain to the
`Content-Security-Policy` line at the top of `diet.html` (in `connect-src` and `form-action`).

## Answering questions (admin page)

Questions from the "Ask Mochi's mom" form arrive in your email (Formspree).
To publish one with your answer:

1. Open https://radhiar.github.io/Mochi_The_Menace/admin.html
2. Paste your "Mochi pipeline" GitHub token and click **Unlock**
   (it's kept in that browser tab only).
3. Fill in the asker's name, their question and your answer, then **Add to the list**.
   Use **Edit** or **Delete** on any Q&A already published.
4. Click **Publish**. This saves `assets/data/faq.json` to alpha and starts the pipeline.
   Approve it in the Actions tab and the FAQ page updates.

Because the admin page saves straight to GitHub, run `git pull` in VS Code's terminal
before you start editing files on your computer. (One-time setup so pulls are smooth:
`git config --global pull.rebase true`.)

## Previewing on your computer

You need Node.js 18 or newer (check with `node -v`; get it from nodejs.org).
There is nothing to install with npm: the preview server uses only Node itself.

From inside the `Mochi` folder:

```
npm run dev
```

Your browser opens http://localhost:5173. Edit a file, save, refresh the browser.
Press `Ctrl + C` in the terminal to stop.

- `npm run dev:phone` also prints an address you can open on your phone (same Wi-Fi),
  so you can test the photo book on a real iPhone.
- Port taken? It moves to the next free one, or pick one: `PORT=3000 npm run dev`
  (Windows PowerShell: `$env:PORT=3000; npm run dev`).

## Pushing to GitHub

Repository: https://github.com/RadhiAR/Mochi_The_Menace

First time only (GitHub already has a starter README, so we adopt its history
instead of fighting it, then work on the `alpha` branch):

```
cd ~/Desktop/mochimain
git init -b main
git remote add origin https://github.com/RadhiAR/Mochi_The_Menace.git
git fetch origin
git reset origin/main
git branch -m alpha
git add .
git commit -m "Add Mochi website and pipeline"
git push -u origin alpha
```

Every time after that (always goes to alpha, then the pipeline takes over):

```
git add .
git commit -m "Describe what changed"
git push
```

## Pipeline: alpha → beta → prod

```
you push ──► alpha ──► unit tests ──pass──► beta ──► waits for your approval ──► prod ──► live site
                           │
                           └─fail──► stops here, nothing moves
```

- You only ever push to **alpha**. Never push to beta or prod yourself.
- Tests (`npm test`) check config.js, every page, link safety and the preview server.
  Run them on your computer before pushing to catch problems early.
- When tests pass, beta is updated automatically.
- GitHub then emails you. Open the run in the **Actions** tab, click
  **Review deployments**, tick **production**, and click **Approve and deploy**.
- prod is published to https://radhiar.github.io/Mochi_The_Menace/ by `deploy.yml`.
- If you push again before approving, the newer version replaces the older one waiting for approval.

### One-time setup on GitHub

1. **Pipeline token.** Profile picture > Settings > Developer settings > Personal access tokens >
   Fine-grained tokens > Generate new token. Repository access: only `Mochi_The_Menace`.
   Permissions: **Contents** read and write, **Workflows** read and write. Copy the token.
   (GitHub's built-in token can't move branches that contain workflow files, and its pushes
   don't start other workflows, so the pipeline needs this one.)
2. **Save it as a secret.** Repository > Settings > Secrets and variables > Actions >
   New repository secret. Name: `PIPELINE_TOKEN`. Value: the token.
3. **Approval gate.** Repository > Settings > Environments > New environment > name it
   `production` > tick **Required reviewers** > add yourself > Save protection rules.
4. **Pages.** Repository > Settings > Pages > Source: **GitHub Actions**.
5. **Let prod publish.** Repository > Settings > Environments > `github-pages` >
   Deployment branches and tags > add a rule for `prod`.
6. **Default branch.** Repository > Settings > General > Default branch: `alpha`.
   Then you can delete the old `main` branch.

When the token expires, the promote steps fail with a clear message. Create a new token
and update the `PIPELINE_TOKEN` secret.

Approvals only work while the repository is public on a free plan. Private repositories
need GitHub Enterprise for required reviewers.

### Using this in other repositories

Each repository has its own workflows, secrets and environments, so this setup doesn't
apply to your other repositories automatically. To reuse it, copy the `.github/workflows`
and `tests` folders into the other repository (or mark this repository as a template in
Settings > General), then repeat the one-time setup there.

When git asks for a password, GitHub wants a personal access token, not your
account password (GitHub > Settings > Developer settings > Personal access tokens).

Keep each video under about 50 MB. GitHub refuses files over 100 MB.

Everything in this repository is public, including `js/config.js`. Only put
things there you're happy for anyone to see.

## Publishing as a website (free options)

- **Netlify Drop:** drag the whole `Mochi` folder onto app.netlify.com/drop.
- **GitHub Pages (set up already):** the pipeline publishes the prod branch to
  https://radhiar.github.io/Mochi_The_Menace/. See "Pipeline" above.
- **Cloudflare Pages:** connect the repository or upload the folder.

All of these give you HTTPS, which the copy-code button and form need.

## Safety built in

- Content Security Policy on every page: only the site's own files can run.
- No cookies, analytics, ads, or third-party scripts or fonts.
- Links from `config.js` must be `https://`; anything else (like `javascript:`) is ignored.
- Visitor input is never inserted into the page as HTML.
- External links open in a new tab with `noopener noreferrer`; affiliate links also use `rel="sponsored"`.
- Affiliate disclosure shown next to affiliate links and in the footer.
- Vet disclaimer on the diet page.
- Form: validation, length limits, a hidden spam trap, and a 30-second resend cooldown.
- Accessible: keyboard page turning, visible focus, screen-reader labels, reduced-motion support.

## About the Apple App Store

A website can't be submitted to the App Store directly; it has to be wrapped in
an iOS app (for example with Capacitor and Xcode, plus an Apple Developer account).
This code is ready for that: everything loads from local files, it fits iPhone
screen notches, videos play inline, and it includes the privacy policy Apple asks for.

Apple's guideline 4.2 (Minimum Functionality) rejects apps that are just a website
in a wrapper, so an app version would need some native features (for example push
notifications for new posts, saving photos, or a share sheet). Publishing as a
website first is the quickest and cheapest route.
