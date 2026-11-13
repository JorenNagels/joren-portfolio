# jorennagels.be: CV & portfolio

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

`out/` is plain static HTML. Host it on S3 + CloudFront, GitHub Pages or Netlify. `/` picks NL or
EN from the browser language.

## Credits

Background music: "Champ de tournesol" by Komiku, CC0
([OpenGameArt](https://opengameart.org/content/champ-de-tournesol)).
