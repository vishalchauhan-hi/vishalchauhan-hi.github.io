# vishalchauhan-hi.github.io

Personal site of **Vishal Chauhan**, Assistant Professor (HCI), The University of Tokyo.
Live at **https://vishalchauhan-hi.github.io**.

Plain HTML, CSS and JavaScript on GitHub Pages: no framework, no build step, no
trackers. That is deliberate. These are the only languages browsers run natively,
so the site is fast and will keep working for years. A small safety net (one
Node script and one Python script) checks every change before it goes live.

---

## The 3-step update routine

Every change follows the same three steps, so a mistake can never take the live site down.

1. **Branch.** Make the change on a new branch, never directly on `main`.
2. **Pull request.** Open a PR. The **Site checks** run automatically (about 20 s).
3. **Merge.** When the checks are green, merge. GitHub Pages publishes in 1–2 minutes.

### From the GitHub website (no setup, good for small text edits)

1. Open the file on GitHub and click the ✏️ pencil.
2. Make the edit. Click **Commit changes…**, choose **Create a new branch**, then **Propose changes**.
3. Click **Create pull request**, wait for the green ✓ next to **Site checks**, then click **Merge**.

### From your Mac (for photos, papers and anything bigger)

```bash
cd ~/Desktop/vishalchauhan-hi-redesign      # or wherever you cloned the repo
git switch main && git pull                  # always start from the live version
git switch -c news-nov-2026                  # a short name for this update
```

Make your edits, then run the checks and preview:

```bash
node scripts/check-site.mjs                  # must say ✓ All checks passed
python3 -m http.server 8000                  # preview at http://localhost:8000 (Ctrl+C to stop)
```

Ship it:

```bash
git add -A && git commit -m "Add Nov 2026 news"
git push -u origin HEAD
gh pr create --fill                          # or open the link git prints
```

Merge the PR on GitHub once **Site checks** is green.

---

## Recipes

### Add a news item (most common)

1. **`news.html`** is the full archive. Add a new `<li>` at the **top** of the current year's list:

   ```html
   <li>
     <span class="news-date">Nov 2026</span>
     <span>What happened, with a <a href="https://example.com">link</a> and <strong>emphasis</strong>.</span>
   </li>
   ```

   For a new year, copy a whole `<div class="news-year">…</div>` block, put it above
   the previous year and change the `<h2>`.

2. **Homepage (optional).** If it should also appear on the homepage, add your own
   short version at the top of the list in `index.html`, section `<section id="recent">`.
   The homepage wording is yours and is never overwritten. Remove the oldest item
   when the list gets longer than about five.

### Add or change a project page

Project pages (`projects.html` and `project-<name>.html`) are built from one file,
`projects/projects.json`. Paper details come from `publications.html`, so add the paper
there first, then list its id under the project's `steps`.

1. Edit `projects/projects.json` (copy an existing entry for a new project).
2. Build: `node scripts/build-projects.mjs`.
3. Never edit the generated `project-*.html` files by hand.

### Write a blog post (with pictures)

Posts are plain text files in `blog/` written in Markdown, so you never touch HTML.

1. Copy the template: `cp blog/_template.md blog/my-trip.md`. The file name becomes the
   web address: `blog-my-trip.html`. Files starting with `_` are never published.
2. Put your photos in `assets/images/blog/my-trip/` and shrink them:
   `python3 tools/optimize-images.py assets/images/blog/my-trip/*`
3. Write. Fill in the header (`title`, `date`, `summary`, optional `tags` and `cover`).
   Then use these marks:
   - an empty line between paragraphs
   - `## Heading` for a heading
   - `**bold**`, `*italic*` and `[link](https://…)`
   - `![caption](assets/images/blog/my-trip/photo.jpg)` for a picture, with the caption
     shown under it. Put 2–3 picture lines right after each other and they sit side by side.
   - `> quote` for a quote
4. Build: `node scripts/build-blog.mjs`. This makes the post page and adds it to the
   Blog list, newest first.
5. Preview it (`python3 -m http.server 8000`, then open http://localhost:8000/blog.html),
   then commit, open a PR, and merge when green.

Always edit the `.md` file, never the generated `blog-*.html`. If you forget to build,
the checks tell you.

### Add a publication

1. Open `publications.html` and find the year (`<!-- ========== 2026 ========== -->`).
2. Copy an existing `<article class="pub" id="…">…</article>` and paste it at the top of that year.
3. Change the `id` (lowercase-with-hyphens, e.g. `chi-2027-robots`), title, authors
   (wrap yourself in `<span class="me">…</span>`), venue, blurb and links.
4. Update the count in the year heading: `<h2>2026 <span>3 publications</span></h2>`.
5. **Thumbnail (optional):** save it as `assets/images/thumb-<name>.png`, run
   `python3 tools/optimize-images.py assets/images/thumb-<name>.png`, and keep the
   `<a class="pub-thumb">` block. With no thumbnail, delete that block.
6. **Award:** keep the `<span class="award">🏆 Honourable Mention</span>` line, or delete it.

To feature a paper on the homepage too, copy one `<li>` inside `<ol class="papers">`
in `index.html` (section `Selected papers`) and edit it. Keep it to about four papers.

### Add photos to Moments

1. Copy the photos into `assets/images/` with clear names (`chi2027-talk.jpg`).
2. Shrink them and remove GPS data: `python3 tools/optimize-images.py assets/images/chi2027-*.jpg`
3. In `moments.html`, copy a whole `<figure class="moment-tile">…</figure>` block,
   paste it at the top of `moments-grid`, and edit the cover image, `alt` text,
   title, place and date. Add one `<li data-src="…">caption</li>` per photo.

### Change a "From the field" photo on the homepage

The taped photos are in `index.html`, section `From the field`. Each one is a
`<figure class="note" style="--tilt:-1.2deg">` with an `<img>` and a handwritten
`<figcaption>`. Put the photo in `assets/images/notes/` and run the image tool on it.
`--tilt` is the small rotation; keep it between `-2deg` and `2deg`.

### Replace the portrait

Overwrite `photo.jpg` (keep the name), then run `python3 tools/optimize-images.py photo.jpg`.

### Update the CV PDF (monthly)

On the 1st of each month GitHub opens a reminder issue. To update, give the tool
your **normal** CV PDF, on a new branch:

```bash
tools/update-cv.sh ~/Downloads/02_Curriculum_Vitae.pdf
```

It makes the public web copy automatically: it **removes your phone number**
and replaces the **Referees** section with "Available on request." (your
original file is not touched). It then saves it as
`assets/cv/Vishal_Chauhan_CV.pdf` (the link never changes), makes the
first-page preview, sets "N pages · updated <month>" on the CV page and runs
the checks. If anything private is still found, it stops and changes nothing.

Then commit, open a PR, merge when green, and close the reminder issue.

### Edit the written CV

`cv.html` is hand-written. Copy an existing `<div class="cv-entry">` and edit it.

---

## The tools

| Command | What it does |
|---|---|
| `node scripts/check-site.mjs` | Checks the whole site (same as the PR check). |
| `node scripts/stamp-assets.mjs` | After changing any CSS/JS file: updates the `?v=` stamps so browsers load the new version right away. |
| `node scripts/build-blog.mjs` | Turns `blog/*.md` posts into pages and updates the Blog list. |
| `tools/update-cv.sh path/to/cv.pdf` | Puts a new CV PDF on the site; removes phone number and referees from the public copy. |
| `python3 tools/optimize-images.py [files…]` | Shrinks images, keeps names, strips GPS/camera data. Safe to re-run. |

You need **Node** (already on this Mac) and **Pillow** for the image tool
(`python3 -m pip install --user pillow`, one time only).

### What the checks catch

- A link, image, video, script or stylesheet pointing to a file that doesn't exist.
- A link to `page.html#section` where that section doesn't exist.
- Images without `alt` text.
- A page missing its title, description, the name in the header, the standard
  menu (Research · Publications · CV · News · Blog · Moments · About · Contact), the
  light/dark toggle or the footer. This keeps every page consistent.
- Any image over **600 KB** or video over **6 MB**, so the site stays fast.
- CSS/JS links whose `?v=` version stamp is out of date (visitors would see an old design).
- Broken JSON-LD (the profile data Google reads).

Each problem names the file and line and says how to fix it.

---

## File map

```
index.html          Homepage: hero + street, about, news, research, service, teaching,
                    selected papers, field photos, working together, contact
spiu.html           The Smart Pole Interaction Unit: scroll teardown + how it was built
blog.html           Blog list (generated)    blog-*.html  Posts (generated)
blog/               Your posts as .md files, the post template and page template
publications.html   All papers, grouped by year
news.html           All news, newest first
moments.html        Event photo gallery
cv.html             Curriculum vitae
photo.jpg           Portrait
assets/style.css    Site-wide design: colours, type, layout (light + dark)
assets/hci.css      Styles for the street, pole teardown, papers and photos
assets/hci.js       The street (homepage), pole teardown and model video (spiu.html)
assets/images/      Images. notes/ = taped photos, making/ = CAD, print, drawing, video
scripts/            Site checks (Node, no dependencies)
tools/              Image optimiser (Python + Pillow)
.github/            The PR check workflow and PR template
```

You will rarely touch `assets/hci.js`. The street and the pole drawing are drawn
in code, and their labels are near the top of each section in that file.

---

## Design rules

- **Fonts:** IBM Plex Sans everywhere. Caveat (handwriting) only for the
  hand-drawn notes on the homepage. Don't add other fonts.
- **Colours:** use the variables at the top of `assets/style.css` (`--ink`,
  `--paper`, `--accent`, …) so dark mode keeps working. Cyan `#24A9B8` means
  "vehicle intent" (eHMI) and nothing else.
- **Motion:** things move only when the visitor does something (cursor, scroll,
  hover) or when the thing really moves (a car). No looping decoration.
- **Real over generated:** use your own photos, figures and drawings.
- **No trackers, no frameworks, no build step.**

---

## Troubleshooting

- **Site checks failed:** open the PR, click **Details** next to the red ✗, read
  the line that starts with ✗, fix it, then commit and push again. The check reruns.
- **`git push` fails on a big upload:** `git config http.postBuffer 524288000`, then push again.
- **Live site looks old:** hard-refresh (Cmd+Shift+R) or open a private window.
- **Started from an old copy?** Run `git switch main && git pull` before editing,
  so you never push an outdated version over newer work.
