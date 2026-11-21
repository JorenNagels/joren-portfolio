# joren.nagels.dev: CV & portfolio

My website and CV, in **Dutch and English**, built from a single source.

```
src/content/profile.ts    ← CV content: profile, experience, skills, education (NL + EN side by side)
src/content/projects.ts   ← portfolio projects (NL + EN side by side)
src/content/ui.ts         ← interface labels
src/components/street/    ← the homepage: a boat trip down the Leie between toy guild houses, posters you can click (three.js, toon shading, ink-line pass)
src/app/[locale]/         ← /nl/ and /en/: the portfolio site
src/app/[locale]/cv/      ← /nl/cv/ and /en/cv/: the CV, an A4 page that prints to exactly 2 pages
src/app/[locale]/walk/    ← dev-only previews of the 3D figures (/walk, /model), unlinked and not indexed
blender/person.py         ← builds public/people/person.glb (body + clothes) around the site's skeleton
scripts/screenshots.mjs   ← refreshes project screenshots from the live sites
src/lib/seo.ts            ← canonical + hreflang per page, and the Person schema search engines read
src/app/sitemap.ts        ← /sitemap.xml; src/app/robots.ts is /robots.txt
scripts/og.mjs            ← builds public/og.jpg (the link preview card) and the app icon
```

Every text is an `{ nl, en }` pair, so the two languages can't drift apart: TypeScript fails the
build if one is missing.

## Use

```bash
npm install
npm run dev                 # http://localhost:3000/nl/ and /en/
npm run build               # static site in out/
npm run preview             # serve out/ on http://localhost:4173
npm run screenshots         # optional: re-capture project images (all, or e.g. `-- flowsha`)
npm run og                  # optional: rebuild the link preview card after a name/photo change
```

**Phone number:** it's never published on the website. The CV page has a hidden phone row that
only gets filled in when the CV is exported to PDF, outside this repo.

## Search engines

The site is meant to be found: `/`, `/nl/`, `/en/`, `/nl/cv/` and `/en/cv/` are in the sitemap, and
`robots.txt` allows everything. The `/walk/` and `/model/` previews stay out with a `noindex` meta tag
rather than a `Disallow`, so Google can fetch them and actually read the noindex.

Canonical and hreflang live on each **page**, in `src/lib/seo.ts`, never on `[locale]/layout.tsx`. A
canonical on the layout is inherited by everything under it, which once made both CV pages point at the
home page and ask to be dropped from the index.

Remaining one-time step, outside this repo: verify the domain in
[Google Search Console](https://search.google.com/search-console) and submit
`https://joren.nagels.dev/sitemap.xml`. Nothing links to the site except the GitHub profile, so without
that it can take a long while to be picked up.

**The email is public.** `njoren@gmail.com` is in the page HTML as a `mailto:`, so indexing exposes it to
scrapers. That is a deliberate trade for being findable; swap it for a form if the spam ever outweighs it.

## Deploy

`out/` is plain static HTML. `/` picks NL or EN from the browser language.

It runs on AWS (account `nagels-dev`), all defined in `infra/` (Terraform): a private S3 bucket
behind CloudFront at https://joren.nagels.dev, with a free ACM certificate and Route 53 DNS. A
CloudFront Function maps `/nl/` to `nl/index.html` (S3 has no directory index), 301s the two other
names on the certificate (`nagels.dev` and `www.nagels.dev`) to `joren.nagels.dev`, and redirects
slash-less URLs. The hostname lives in `infra/variables.tf` (`domain`) and, for the site's own
canonical and OG URLs, in `src/content/profile.ts` (`person.site`).

- **Push to `main`**: nothing is deployed.
- **Push a tag `v1`, `v2`, ... made on main** (`git tag v3 && git push origin v3`): GitHub Actions
  (`.github/workflows/deploy.yml`) runs `terraform apply`, builds the site and uploads `out/`, then
  clears the CloudFront cache.
- **Pull request touching `infra/`**: `plan.yml` shows the `terraform plan` in the run summary.

GitHub signs in to AWS through OIDC (roles `github-deploy` for `v*` tags, read-only `github-plan` for PRs),
so there are no AWS keys in the repo or in GitHub secrets.

One-time setup, from your own machine (GitHub Actions can't create the role it signs in with):

```bash
aws sso login --sso-session jjco
export AWS_PROFILE=nagels-dev
infra/bootstrap.sh                       # creates the Terraform state bucket
cd infra && terraform init && terraform apply
```

## Credits

Background music: "Champ de tournesol" by Komiku, CC0
([OpenGameArt](https://opengameart.org/content/champ-de-tournesol)).
