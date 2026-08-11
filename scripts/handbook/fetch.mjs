// Downloads the UWA Handbook into .cache/handbook/ as raw HTML.
//
// The cache is the point: parsing is iterated on constantly, fetching is not.
// Anything already on disk is skipped unless --refresh, so only the first cold
// run pays the ~25 minutes.
//
//   node scripts/handbook/fetch.mjs                 # everything, resume from cache
//   node scripts/handbook/fetch.mjs --only=CITS     # just one subject, for development
//   node scripts/handbook/fetch.mjs --refresh       # re-download even if cached
//
// Politeness: 4 at a time with a small delay. This runs once a year against a
// university's public site, so it should stay well under anything they'd notice.

import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CACHE = join(ROOT, '.cache', 'handbook');
const BASE = 'https://www.handbooks.uwa.edu.au';

const USER_AGENT =
  'Exusiai101-handbook-graph/1.0 (+https://exusiai101.github.io/uwa-units/; personal course-planning project; annual scrape)';

const CONCURRENCY = 4;
const DELAY_MS = 150;
const MAX_ATTEMPTS = 4;

const args = process.argv.slice(2);
const REFRESH = args.includes('--refresh');
const ONLY = (args.find((a) => a.startsWith('--only=')) ?? '')
  .replace('--only=', '')
  .split(',')
  .map((s) => s.trim().toUpperCase())
  .filter(Boolean);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** Fetch with retry/backoff. Returns the body, or throws after MAX_ATTEMPTS. */
async function get(url) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_ATTEMPTS) await sleep(500 * 2 ** (attempt - 1));
    }
  }
  throw new Error(`${url} failed after ${MAX_ATTEMPTS} attempts: ${lastErr.message}`);
}

/** Download to `path` unless it is already cached. Returns 'cached' | 'fetched'. */
async function cache(url, path) {
  if (!REFRESH && (await exists(path))) return 'cached';
  const body = await get(url);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, body);
  await sleep(DELAY_MS);
  return 'fetched';
}

/** Run `task` over `items` with a fixed worker pool, logging progress. */
async function pool(label, items, task) {
  let done = 0;
  let fetched = 0;
  const failures = [];
  const queue = [...items];

  const worker = async () => {
    for (;;) {
      const item = queue.shift();
      if (item === undefined) return;
      try {
        if ((await task(item)) === 'fetched') fetched++;
      } catch (err) {
        failures.push(`${item}: ${err.message}`);
      }
      done++;
      if (done % 100 === 0 || done === items.length) {
        process.stdout.write(`\r  ${label}: ${done}/${items.length} (${fetched} fetched)`);
      }
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  process.stdout.write('\n');
  if (failures.length) {
    console.warn(`  ${failures.length} failed:`);
    for (const f of failures.slice(0, 20)) console.warn(`    ${f}`);
  }
  return failures;
}

/**
 * Pull every code matching `pattern` out of a search-results page.
 * The handbook returns all results in one page with no pagination, so a single
 * request with an empty searchtext is the entire catalogue.
 */
function codesFrom(html, pattern) {
  return [...new Set([...html.matchAll(pattern)].map((m) => m[1]))].sort();
}

async function main() {
  await mkdir(CACHE, { recursive: true });

  console.log('Index pages');
  await cache(`${BASE}/search/?type=units&searchtext=`, join(CACHE, 'units-search.html'));
  await cache(`${BASE}/search/?type=majors&searchtext=`, join(CACHE, 'majors-search.html'));

  const unitsIndex = await readFile(join(CACHE, 'units-search.html'), 'utf8');
  const majorsIndex = await readFile(join(CACHE, 'majors-search.html'), 'utf8');

  let unitCodes = codesFrom(unitsIndex, /unitdetails\?code=([A-Z]{4}\d{4})/g);
  let majorCodes = codesFrom(majorsIndex, /majordetails\?code=([A-Z]{3}-[A-Z0-9]+)/g);

  // --only narrows units (the expensive half) but always keeps every major:
  // 155 pages is cheap, and major structure is what the graph is scoped by.
  if (ONLY.length) {
    unitCodes = unitCodes.filter((c) => ONLY.includes(c.slice(0, 4)));
    console.log(`--only=${ONLY.join(',')}: ${unitCodes.length} units, all ${majorCodes.length} majors`);
  }

  console.log(`Units (${unitCodes.length})`);
  await pool('units', unitCodes, (code) =>
    cache(`${BASE}/unitdetails?code=${code}`, join(CACHE, 'units', `${code}.html`)),
  );

  if (majorCodes.length) {
    console.log(`Majors (${majorCodes.length})`);
    await pool('majors', majorCodes, (code) =>
      cache(`${BASE}/majordetails?code=${code}`, join(CACHE, 'majors', `${code}.html`)),
    );

    // Some majors (languages, engineering) are disambiguation pages that only
    // link to their real variants, and a few of those variants never appear in
    // the search index. One extra pass over what was just downloaded picks them up.
    const seen = new Set(majorCodes);
    const discovered = new Set();
    for (const code of majorCodes) {
      const page = await readFile(join(CACHE, 'majors', `${code}.html`), 'utf8');
      const body = /START PAGE CONTENT([\s\S]*?)END PAGE CONTENT/.exec(page)?.[1] ?? '';
      for (const m of body.matchAll(/majordetails\?code=([A-Z]{3}-[A-Z0-9]+)/g)) {
        if (!seen.has(m[1])) discovered.add(m[1]);
      }
    }

    if (discovered.size) {
      console.log(`Linked majors not in the index (${discovered.size})`);
      await pool('linked', [...discovered], (code) =>
        cache(`${BASE}/majordetails?code=${code}`, join(CACHE, 'majors', `${code}.html`)),
      );
    }
  }

  console.log(`\nCache ready at .cache/handbook. Next: node scripts/handbook/parse.mjs`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
