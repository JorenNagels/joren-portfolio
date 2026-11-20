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
```

**Phone number:** it's never published on the website. The CV page has a hidden phone row that
only gets filled in when the CV is exported to PDF, outside this repo.

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
