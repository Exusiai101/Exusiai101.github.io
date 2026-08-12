# CLAUDE.md

Astro static site (personal profile + a UWA handbook prerequisite graph),
deployed to GitHub Pages on every push to `main`.

## Commands

```bash
npm run dev              # http://localhost:4321
npm run build            # static output to dist/ (gitignored)
npm run preview          # serve the build
npm run scrape:handbook  # fetch.mjs + parse.mjs; see below before running
npm run annotate:handbook # re-derive genericPrereqs in graph.json, no network
```

No test or lint script. `npm run build` is the only check.

## Architecture

Two mostly independent things:

- **Profile site** - `src/pages/index.astro` + `src/components/*.astro`. All copy
  lives in `src/data/profile.ts`; edit strings there, not markup.
- **UWA unit graph** - `src/pages/uwa-units/index.astro` (markup, controls,
  legend) + `src/scripts/uwa-graph.ts` (all behaviour: fetch, cytoscape,
  layout, detail panel). Data is static JSON in `public/uwa-units/`.

Shared: `src/layouts/Base.astro`, and `src/styles/global.css` which defines the
whole palette as CSS custom properties for both light and dark.

## Handbook data pipeline

`scripts/handbook/fetch.mjs` downloads raw HTML into `.cache/handbook/`
(gitignored, ~25 min cold, resumable - cached pages are skipped).
`scripts/handbook/parse.mjs` turns that cache into `public/uwa-units/`:

| File                    | Contents                                                                                                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `graph.json`            | every unit: graph edges + verbatim rule HTML (loaded once)                                                                                                                                  |
| `majors.json`           | major -> level -> group -> units, core vs option, plus `type`/`note`/`entry` (major names are not unique - three Chemistry majors, two Marine Science - and these are what tell them apart) |
| `details/<PREFIX>.json` | heavy prose, fetched on demand per subject                                                                                                                                                  |
| `report.json`           | parser warnings - **read this after every re-scrape**                                                                                                                                       |

Useful flags: `node scripts/handbook/fetch.mjs --only=CITS` (one subject, for
development), `--refresh` (ignore cache).

Parsing relies on the handbook's `<!--START x-->` / `<!--END x-->` comment
markers. If UWA drops them, `report.json` is what will say so.

### Generic prerequisites

1106 of the 2715 prerequisite rules name no unit code at all ("any Level 2 ANTH
unit", "48 points", "Enrolment in 62510"), so they yield no edge and their units
would draw as false roots. `scripts/handbook/requirements.mjs` classifies that
prose into a `genericPrereqs` array on each unit, keyed `unit-set` | `points` |
`enrolment` | `external` | `other`. It tokenises on the handbook's own `<em>`
connectives (a closed vocabulary of 14) and on `coursedetails`/`majordetails`/
`honoursdetails` anchors - **not** on the flattened text.

`parse.mjs` emits the field natively; `annotate.mjs` re-derives it on an
existing `graph.json` with no network, so the classifier can be changed without
a re-scrape. Both must produce identical output - run `annotate.mjs` twice and
compare hashes after touching `requirements.mjs`.

Only `unit-set` is drawn. `uwa-graph.ts` resolves it against **the selected
major's own units** and funnels them through one shared pseudo-node
(`id` prefixed `req:`) so the disjunction reads as "any one of these", not "all
of these". Everything else becomes a detail-panel chip plus a dashed node
border.

Run the scrape once a year when the handbook rolls over - not casually. It hits
a university's public site.

## Gotchas

- **Cytoscape cannot see CSS custom properties.** It paints into a canvas, so
  tokens are read out of the document by `tokens()` and passed as plain strings,
  and the stylesheet is rebuilt on `prefers-color-scheme` change.
- **Call `cy.resize()` before fitting.** The graph mounts while its section is
  still `hidden`, and unhiding an element fires no resize event, so cytoscape
  otherwise lays out against a stale (often zero) viewport.
- **dagre's `minLen` must be >= 1.** Passing 0 to keep co-requisites on one rank
  corrupts ranking and throws; they are drawn dashed instead.
- **Asset paths must use `import.meta.env.BASE_URL`.** CI overrides `--site` and
  `--base` at build time (`.github/workflows/astro.yml`), so hardcoded absolute
  paths break on Pages.
- **`public/uwa-units/` is in `.prettierignore`.** The JSON is generated
  minified; prettier collapses short arrays in a way `JSON.stringify` does not,
  so a formatted copy and a generated copy can never agree and every
  regeneration churned the whole file. Formatting also cost ~640KB on a file
  fetched on every page load.
- **Requirement pseudo-nodes must not reach `units.get()`.** Their ids start
  `req:`, so `focusUnit` branches to `focusRequirement` first - otherwise
  `loadDetail` would fetch `details/req:.json`. Node counts use `cy.nodes("[^type]")`
  to exclude them.
- **Shared pseudo-nodes can invent cycles.** Two level 2 units that each ask for
  "any level 2 unit" would point at each other through their funnels. Guarded by
  keying the node on its resolved match list *and* a `reachable()` check; funnel
  edges also carry `kind: "requirement"` so `findCycles` (prereq-only) ignores
  them.
- `cytoscape-dagre` ships no types; the shim is `src/types/cytoscape-dagre.d.ts`.
- Anything from the handbook goes through `esc()` before `innerHTML`, except
  rule HTML, which is inserted verbatim on purpose (the and/or wording is the
  point).
