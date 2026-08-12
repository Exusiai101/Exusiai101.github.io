// Turns the raw HTML in .cache/handbook/ into the JSON the graph page reads.
//
//   node scripts/handbook/parse.mjs
//
// Outputs into public/uwa-units/:
//   graph.json         every unit, graph fields + verbatim rule text     (loaded once)
//   majors.json        major -> level -> group -> units, core vs option
//   details/<PREFIX>.json  heavy prose, fetched on demand per subject
//   report.json        parser warnings, read this after every re-scrape
//
// The handbook wraps every field in <!--START x--> / <!--END x--> comments (or
// <!--NULL x--> when absent), which is what makes this tractable. If UWA ever
// drops those markers, report.json is what will tell you.

import { mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CACHE = join(ROOT, ".cache", "handbook");
const OUT = join(ROOT, "public", "uwa-units");

const UNIT_CODE = /\b[A-Z]{4}\d{4}\b/g;
const warnings = [];
const warn = (scope, message) => warnings.push({ scope, message });

// ---------------------------------------------------------------- helpers

/** Inner HTML of a <!--START name--> ... <!--END name--> block, or null. */
function section(html, name) {
  const match = html.match(
    new RegExp(`<!--START ${name}-->([\\s\\S]*?)<!--END ${name}-->`),
  );
  return match ? match[1] : null;
}

/**
 * Body of a field, without the handbook's own <dt> caption.
 *
 * Each field block is a <dt>Label</dt><dd>value</dd> pair, so passing the raw
 * block through would print the caption twice once the page adds its own.
 */
function sectionBody(html, name) {
  const block = section(html, name);
  if (!block) return null;
  const $ = cheerio.load(block, null, false);
  const parts = $("dd")
    .map((_, el) => $(el).html() ?? "")
    .get();
  return parts.length ? parts.join(" ") : block;
}

/**
 * Collapse HTML to readable plain text.
 *
 * Rules lay their alternatives out with <br>, and wrap unit lists in a
 * <div class="auto"> with no surrounding whitespace, so tag boundaries have to
 * become spaces or codes end up glued to the prose around them.
 */
function toText(html) {
  if (!html) return "";
  const spaced = html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<(p|div|li|dd|dt|tr|td)\b[^>]*>/gi, " $&")
    .replace(/<\/(p|div|li|dd|dt|tr|td)>/gi, "$& ");
  return cheerio
    .load(spaced, null, false)
    .root()
    .text()
    .replace(/\s+/g, " ")
    .trim();
}

/** Tidy a fragment for embedding in the page: drop target attrs, keep links. */
function toHtml(html) {
  if (!html) return "";
  const $ = cheerio.load(html, null, false);
  $("a").removeAttr("target");
  return $.root().html()?.replace(/\s+/g, " ").trim() ?? "";
}

/**
 * Rule fragments for the detail panel.
 *
 * Handbook links to other units become `data-unit` markers instead of absolute
 * URLs. That cuts a ~55 character href down to a code, and lets the page treat
 * a unit mentioned inside a rule as a jump to that node rather than a link off
 * the site. Links to anything else (courses, majors) are kept as real links.
 */
function ruleHtml(html) {
  if (!html) return "";
  const $ = cheerio.load(html, null, false);
  $("a").each((_, el) => {
    const $a = $(el);
    $a.removeAttr("target");
    const code = /unitdetails\?code=([A-Z]{4}\d{4})/.exec(
      $a.attr("href") ?? "",
    )?.[1];
    if (code) {
      $a.removeAttr("href");
      $a.attr("data-unit", code);
    }
  });
  return $.root().html()?.replace(/\s+/g, " ").trim() ?? "";
}

/**
 * Every unit code referenced by a rule fragment.
 *
 * Both sources are needed: most rules hyperlink their units, but a meaningful
 * minority (notably Incompatibility blocks) print bare codes with no anchor.
 * Anchors alone would silently drop those edges.
 */
function referencedUnits(html) {
  const $ = cheerio.load(html, null, false);
  const codes = new Set();
  $('a[href*="code="]').each((_, el) => {
    const m = /code=([A-Z]{4}\d{4})/.exec($(el).attr("href") ?? "");
    if (m) codes.add(m[1]);
  });
  for (const m of toText(html).matchAll(UNIT_CODE)) codes.add(m[0]);
  return [...codes].sort();
}

// ------------------------------------------------------------ unit index

const RULE_KEYS = {
  prerequisites: "prerequisites",
  "co-requisites": "corequisites",
  corequisites: "corequisites",
  incompatibility: "incompatibility",
  "advisable prior study": "advisable",
};

/**
 * The search page returns the whole catalogue in one document, with per-unit
 * metadata in a definition list. This is the only place credit points, level,
 * and availability are available without opening 3344 individual pages.
 */
function parseUnitIndex(html) {
  const $ = cheerio.load(html);
  const units = new Map();

  $("li.filter-item").each((_, el) => {
    const $el = $(el);
    const href = $el.find("a").first().attr("href") ?? "";
    const code = /code=([A-Z]{4}\d{4})/.exec(href)?.[1];
    if (!code) return;

    const heading = $el.find("h4").first().text().trim();
    const title = heading.replace(/\s*\[[A-Z]{4}\d{4}\]\s*$/, "").trim();

    const fields = new Map();
    $el.find("dl dt").each((_, dt) => {
      const key = $(dt).text().replace(/:\s*$/, "").trim().toLowerCase();
      const values = [];
      for (let n = $(dt).next(); n.length && n.is("dd"); n = n.next()) {
        values.push(n.text().trim());
      }
      fields.set(key, values);
    });

    const first = (key) => fields.get(key)?.[0] ?? "";

    units.set(code, {
      code,
      title,
      subject: code.slice(0, 4),
      credits: Number(first("credit points")) || null,
      // The index omits "Level" for a fair number of units; the first digit of
      // the code carries the same information and is always present.
      level: Number(first("level")) || Number(code[4]) || null,
      levelOfStudy: first("level of study"),
      school: first("school"),
      fieldOfEducation: first("field of education"),
      availability: fields.get("availability") ?? [],
      location: fields.get("location") ?? [],
      coordinators: first("coordinator(s)"),
    });
  });

  if (units.size === 0) warn("index", "no units parsed from units-search.html");
  return units;
}

// ------------------------------------------------------------- unit page

function parseUnitPage(code, html) {
  const rules = {};
  const rulesBlock = section(html, "unit_urules");

  if (rulesBlock) {
    const $ = cheerio.load(rulesBlock);
    let matched = 0;
    $("dl.requirements dt").each((_, dt) => {
      const label = $(dt).text().replace(/\s+/g, " ").trim().toLowerCase();
      const key = RULE_KEYS[label];
      const body = $(dt).next("dd");
      if (!body.length) return;
      if (!key) {
        warn(code, `unrecognised rule heading "${label}"`);
        return;
      }
      matched++;
      const fragment = body.html() ?? "";
      // Only the HTML is kept: the page renders it directly, and carrying a
      // plain-text copy of every rule roughly doubled graph.json for nothing.
      rules[key] = {
        html: ruleHtml(fragment),
        units: referencedUnits(fragment).filter((u) => u !== code),
      };
    });
    // A handful of units carry only an enrolment cap, emitted as a stray
    // <tr><td> inside the <dl> rather than a dt/dd pair. No prerequisite
    // information is lost, but the cap itself matters when planning.
    if (matched === 0) {
      const quota =
        /<em>Approved quota<\/em>\s*:\s*<\/b>([\s\S]*?)<\/td>/i.exec(
          rulesBlock,
        );
      if (quota) {
        rules.quota = { html: ruleHtml(quota[1]), units: [] };
      } else {
        warn(code, "unit_urules present but no rule headings parsed");
      }
    }
  }

  // Availability also lives on the unit page; the index is preferred, but this
  // is the fallback when a unit is missing from search results.
  const offering = section(html, "unit_offering");
  const availability = [];
  if (offering) {
    const $ = cheerio.load(offering);
    $("tbody tr").each((_, tr) => {
      const cell = cheerio.load(tr)("td").first().text().trim();
      if (cell) availability.push(cell);
    });
  }

  return {
    rules,
    availability,
    detail: {
      description: toHtml(sectionBody(html, "unit_content")),
      outcomes: toHtml(sectionBody(html, "unit_outcome")),
      assessment: toHtml(sectionBody(html, "unit_ams")),
      contactHours: toHtml(sectionBody(html, "unit_contact")),
      coordinators: toText(sectionBody(html, "unit_unitcoord")),
      courseNotes: toHtml(sectionBody(html, "unit_newCourses")),
    },
  };
}

// ------------------------------------------------------------ major page

/**
 * Major pages nest as: <h4>Level N</h4> -> group heading -> "Take ..." sentence
 * -> <table data-type="DSM"> of units. The "Take all units" wording is what
 * distinguishes a compulsory group from a pick-N-points option group, so it is
 * carried through verbatim rather than reduced to a boolean.
 */
function parseMajorPage(code, html) {
  const $ = cheerio.load(html);
  const name = ($('meta[property="og:title"]').attr("content") ?? "")
    .replace(/\s*\[[^\]]*\]\s*$/, "")
    .trim();

  // Several majors share a name (three Chemistry majors, two Marine Science,
  // two Korean Studies), so the name alone cannot identify one. These three
  // fields are what the handbook itself uses to tell them apart: the page
  // heading ("Major" / "Extended Major" / "Second Major"), the highlighted
  // availability note, and the admission prerequisite.
  const type = /^(.*?)\s*Overview$/
    .exec($("h3").first().text().replace(/\s+/g, " ").trim())?.[1]
    ?.trim();
  const intro = section(html, "introduction_to_major") ?? "";
  const note = toText(
    cheerio.load(intro, null, false)("p.highlight-box").first().html(),
  );
  const entry = toText(sectionBody(html, "prerequisite_definition"));

  const levels = [];

  $(".unitsequence h4").each((_, h4) => {
    const levelLabel = $(h4).text().trim();
    const body = $(h4).next();
    if (!body.length) return;

    const groups = [];
    let heading = "";
    let take = "";

    body.find("h5, p, table[data-type]").each((_, el) => {
      const $el = $(el);
      if ($el.is("h5")) {
        heading = $el.text().replace(/\s+/g, " ").trim();
        return;
      }
      if ($el.is("p")) {
        const text = $el.text().replace(/\s+/g, " ").trim();
        if (/^Take\b/i.test(text)) take = text.replace(/:\s*$/, "");
        return;
      }

      const units = [];
      $el.find("tbody tr").each((_, tr) => {
        const $tr = $(tr);
        const unitCode = /code=([A-Z]{4}\d{4})/.exec(
          $tr.find('a[href*="code="]').first().attr("href") ?? "",
        )?.[1];
        if (!unitCode) return;
        const cells = $tr.find("td");
        // The table's "unit requirements" column restates the unit's own rule,
        // which the detail panel already shows from the unit page. Skipping it
        // keeps majors.json small.
        units.push({
          code: unitCode,
          availability: $(cells[0]).text().replace(/\s+/g, " ").trim(),
        });
      });
      if (!units.length) return;

      groups.push({
        label: heading || "Units",
        take,
        // "Take all units (24 points)" is compulsory; anything phrased as a
        // points value is a choice between alternatives.
        kind: /^take all\b/i.test(take) ? "core" : "option",
        units,
      });
    });

    if (groups.length) levels.push({ level: levelLabel, groups });
  });

  // Language and engineering majors are disambiguation pages: no units of their
  // own, just links to the variant a student qualifies for. Record the variants
  // so the page can point at them instead of rendering an empty graph.
  const variants = [
    ...new Set(
      [
        ...($(".content").html() ?? "").matchAll(
          /majordetails\?code=([A-Z]{3}-[A-Z0-9]+)/g,
        ),
      ]
        .map((m) => m[1])
        .filter((c) => c !== code),
    ),
  ];

  if (!levels.length && !variants.length) {
    warn(code, "no unit tables and no variant links parsed from major page");
  }

  return {
    code,
    name,
    kind: levels.length ? "major" : "disambiguation",
    type: type || "",
    note,
    entry,
    levels,
    variants: levels.length ? [] : variants,
  };
}

// ----------------------------------------------------------------- main

async function cachedFiles(dir) {
  try {
    return await readdir(join(CACHE, dir));
  } catch {
    return [];
  }
}

async function main() {
  const unitsIndexHtml = await readFile(
    join(CACHE, "units-search.html"),
    "utf8",
  );
  const units = parseUnitIndex(unitsIndexHtml);
  console.log(`Indexed ${units.size} units`);

  const year =
    /Handbook\s+(\d{4})/.exec(
      cheerio
        .load(unitsIndexHtml)('meta[property="og:site_name"]')
        .attr("content") ?? "",
    )?.[1] ?? null;

  // Units
  const detailsBySubject = new Map();
  const unitFiles = await cachedFiles("units");
  let withDetail = 0;

  for (const file of unitFiles) {
    const code = file.replace(/\.html$/, "");
    const html = await readFile(join(CACHE, "units", file), "utf8");
    const parsed = parseUnitPage(code, html);

    const unit = units.get(code) ?? {
      code,
      title: "",
      subject: code.slice(0, 4),
      credits: null,
      level: null,
      levelOfStudy: "",
      school: "",
      fieldOfEducation: "",
      availability: [],
      location: [],
      coordinators: "",
    };

    unit.rules = parsed.rules;
    unit.prereqUnits = parsed.rules.prerequisites?.units ?? [];
    unit.coreqUnits = parsed.rules.corequisites?.units ?? [];
    unit.incompatibleUnits = parsed.rules.incompatibility?.units ?? [];
    unit.advisableUnits = parsed.rules.advisable?.units ?? [];
    if (!unit.availability.length) unit.availability = parsed.availability;
    units.set(code, unit);
    withDetail++;

    if (!detailsBySubject.has(unit.subject))
      detailsBySubject.set(unit.subject, {});
    detailsBySubject.get(unit.subject)[code] = parsed.detail;
  }

  console.log(`Parsed ${withDetail} unit pages`);

  // Units referenced by a rule but absent from the catalogue: usually retired
  // units the handbook still points at. Worth knowing, not worth failing on.
  const missing = new Set();
  for (const unit of units.values()) {
    for (const ref of unit.prereqUnits ?? []) {
      if (!units.has(ref)) missing.add(ref);
    }
  }
  if (missing.size) {
    warn(
      "graph",
      `${missing.size} prerequisite codes not in the catalogue: ${[...missing].sort().join(", ")}`,
    );
  }

  // Majors
  const majors = [];
  for (const file of await cachedFiles("majors")) {
    const code = file.replace(/\.html$/, "");
    const html = await readFile(join(CACHE, "majors", file), "utf8");
    majors.push(parseMajorPage(code, html));
  }
  majors.sort((a, b) => a.name.localeCompare(b.name));
  console.log(`Parsed ${majors.length} majors`);

  // Write
  await mkdir(join(OUT, "details"), { recursive: true });

  const scrapedAt = new Date().toISOString().slice(0, 10);
  const meta = { year, scrapedAt, source: "https://www.handbooks.uwa.edu.au" };

  // graph.json is fetched on every page load, so it carries only what the graph
  // draws. Coordinators, locations and long prose stay in details/<PREFIX>.json,
  // which is fetched only when a unit is actually opened.
  const graphUnits = [...units.values()]
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((u) => ({
      code: u.code,
      title: u.title,
      credits: u.credits,
      level: u.level,
      levelOfStudy: u.levelOfStudy,
      school: u.school,
      availability: u.availability,
      rules: u.rules ?? {},
      prereqUnits: u.prereqUnits ?? [],
      coreqUnits: u.coreqUnits ?? [],
      incompatibleUnits: u.incompatibleUnits ?? [],
      advisableUnits: u.advisableUnits ?? [],
    }));

  await writeFile(
    join(OUT, "graph.json"),
    JSON.stringify({ ...meta, units: graphUnits }),
  );
  await writeFile(
    join(OUT, "majors.json"),
    JSON.stringify({ ...meta, majors }),
  );
  for (const [subject, entries] of detailsBySubject) {
    await writeFile(
      join(OUT, "details", `${subject}.json`),
      JSON.stringify(entries),
    );
  }
  await writeFile(
    join(OUT, "report.json"),
    JSON.stringify(
      {
        ...meta,
        unitsIndexed: units.size,
        unitPagesParsed: withDetail,
        majors: majors.length,
        warnings,
      },
      null,
      2,
    ),
  );

  console.log(`\nHandbook ${year}, scraped ${scrapedAt}`);
  console.log(`${warnings.length} warnings -> public/uwa-units/report.json`);
  for (const w of warnings.slice(0, 15))
    console.log(`  ${w.scope}: ${w.message}`);
  if (warnings.length > 15) console.log(`  ... ${warnings.length - 15} more`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
