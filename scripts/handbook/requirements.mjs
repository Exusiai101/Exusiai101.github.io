// Classifies the parts of a prerequisite rule that name no unit code.
//
// Of 2715 units carrying a prerequisite rule, 1106 produce no graph edge at
// all: their rule gates on enrolment in a course, on a points total, or on
// "any Level 2 ANTH unit". Drawn naively those units look like starting
// points. This module turns that prose into structured requirements so the
// page can draw the ones that are real dependencies and label the rest.
//
// The rule HTML is far more machine-readable than its flattened text. Two
// signals carry the structure, and both survive parse.mjs's ruleHtml():
//
//   <em>   the handbook's own connectives, a closed vocabulary of 14 across
//          the whole catalogue ("or", "enrolment in", "successful completion
//          of", ...). This is the tokenizer; regexing the prose is not.
//   <a>    ruleHtml() strips href from *unit* links only, so coursedetails,
//          honoursdetails and majordetails hrefs remain and identify the
//          referent type unambiguously.
//
// Known limits, all deliberate:
//
//   - Nested and/or precedence is flattened. ENGL4102 reads
//     "(HON-EGLST) or (HON-GNDST and any two level 2/3 ENGL)"; the unit-set is
//     bound to one branch only, and that binding is lost. The verbatim rule
//     HTML sits directly beneath the chips in the detail panel for exactly
//     this reason.
//   - Numbered rules (PODI3111's "(1) a. ... or b. ...") over-split and land
//     in "other", which is inert.
//   - Only rules.prerequisites is classified. Co-requisites and advisable
//     prior study have the same generic-language problem; treating them is a
//     scope decision, not an oversight.

import * as cheerio from "cheerio";

/**
 * Collapse HTML to readable plain text.
 *
 * Rules lay their alternatives out with <br>, and wrap unit lists in a
 * <div class="auto"> with no surrounding whitespace, so tag boundaries have to
 * become spaces or codes end up glued to the prose around them.
 */
export function toText(html) {
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

/**
 * Prose subject names the handbook uses in place of a four-letter prefix.
 *
 * Exported so a re-scrape can audit it: parse.mjs warns about every
 * "<something> unit(s)" phrase that lands here without a match.
 */
export const SUBJECT_ALIASES = {
  accounting: "ACCT",
  anthropology: "ANTH",
  archaeology: "ARCY",
  biology: "BIOL",
  chemistry: "CHEM",
  chinese: "CHIN",
  economics: "ECON",
  english: "ENGL",
  finance: "FINA",
  "fine arts": "ARTF",
  french: "FREN",
  genetics: "GENE",
  geography: "GEOG",
  german: "GRMN",
  history: "HIST",
  "human biology": "ANHB",
  indonesian: "INDO",
  italian: "ITAL",
  japanese: "JAPN",
  korean: "KORE",
  linguistics: "LING",
  management: "MGMT",
  marketing: "MKTG",
  mathematics: "MATH",
  music: "MUSC",
  philosophy: "PHIL",
  physics: "PHYS",
  politics: "POLS",
  psychology: "PSYC",
  sociology: "SOCS",
  statistics: "STAT",
};

const UNIT_CODE = /\b[A-Z]{4}\d{4}\b/g;

/** Quantity words the handbook uses before "unit(s)". */
const COUNT_WORDS = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
};

/**
 * Words that may sit immediately before "unit(s)" without naming a subject.
 * Anything else there is a prose subject we failed to resolve - see the
 * over-broad guard in classifyPrereqRule().
 */
const HARMLESS_BEFORE_UNIT = new Set([
  "any",
  "a",
  "an",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "level",
  "points",
  "point",
  "credit",
  "further",
  "additional",
  "other",
  "elective",
  "core",
  "same",
  "these",
  "those",
  "the",
  "of",
  "and",
  "or",
  "complementary",
]);

const EXTERNAL =
  /\bATAR\b|\bWACE\b|\bIELTS\b|\bTOEFL\b|\bJLPT\b|\bISLPR\b|\bWAM\b|audition|portfolio|interview|proficiency|approval|permission|police clearance|working with children|work experience|weighted average mark/i;

// ------------------------------------------------------------- tokenizing

/**
 * Normalise one <em> connective. The vocabulary is closed: across all 2715
 * rules there are exactly 14 distinct values, so this is a lookup, not a
 * parse.
 */
function connective(raw) {
  const text = (raw ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  return {
    join: /^(and\b|,)/.test(text) ? "and" : "or",
    verb: /enrolment in/.test(text)
      ? "enrolment"
      : /completion of/.test(text)
        ? "completion"
        : null,
    // "or equivalent" / "or higher" / "or with permission" widen the rule in a
    // way no unit list can express; carried through so the chip can say so.
    hedge: /equivalent|higher|permission|associated combined degree/.test(text),
  };
}

/**
 * Split a rule into operand fragments, each tagged with the connective that
 * introduced it. The leading fragment (before any <em>) is joined with "and":
 * it is the rule's opening term, not an alternative to anything.
 */
export function clauses(html) {
  if (!html) return [];
  const out = [];
  const parts = html.split(/<em>([^<]*)<\/em>/g);
  // split() with one capture group yields [text, capture, text, capture, ...]
  for (let i = 0; i < parts.length; i += 2) {
    const raw = i === 0 ? "and" : parts[i - 1];
    // Not every connective is marked up. CITS5014 runs "</div>and Completion
    // of at least 24 points of level 4/5 CITS..." as plain text straight off
    // the end of an enrolment block, so a second requirement hides inside the
    // first fragment unless these are split out too.
    const pieces = (parts[i] ?? "").split(
      /\b((?:and|or)\s+(?:successful\s+)?completion of)\b/i,
    );
    for (let j = 0; j < pieces.length; j += 2) {
      const fragment = pieces[j] ?? "";
      const text = toText(fragment);
      if (!text) continue;
      out.push({
        html: fragment,
        text,
        ...connective(j === 0 ? raw : pieces[j - 1]),
      });
    }
  }
  return out;
}

// --------------------------------------------------------- classification

function levelsIn(text) {
  const found = new Set();
  // "level 4/5 units" and "Level 4/Level 5" both appear.
  const re = /level\s*([1-5])(?:\s*\/\s*(?:level\s*)?([1-5]))?/gi;
  for (const m of text.matchAll(re)) {
    found.add(Number(m[1]));
    if (m[2]) found.add(Number(m[2]));
  }
  return [...found].sort();
}

/**
 * Subject prefixes named by a clause.
 *
 * Bare four-letter tokens are filtered against the live catalogue, which is
 * what stops ATAR, WACE, WAM and friends being read as subjects. Slash lists
 * ("CITS/STAT/PHIL units") and prose names both feed the same set.
 */
function subjectsIn(text, prefixes) {
  const found = new Set();
  for (const m of text.matchAll(/\b([A-Z]{4})\b/g)) {
    if (prefixes.has(m[1])) found.add(m[1]);
  }
  for (const m of text.matchAll(/\b([A-Za-z][A-Za-z ]{2,24}?)\s+units?\b/gi)) {
    const alias = SUBJECT_ALIASES[m[1].trim().toLowerCase()];
    if (alias && prefixes.has(alias)) found.add(alias);
  }
  return [...found].sort();
}

function quantityIn(text) {
  const points = /\b(\d+)\s*(?:credit\s*)?points?\b/i.exec(text);
  if (points) return { points: Number(points[1]) };
  const count = /\b(any\s+)?(a|an|one|two|three|four|five|six)\s+(?:\S+\s+){0,4}?units?\b/i.exec(
    text,
  );
  if (count) return { units: COUNT_WORDS[count[2].toLowerCase()] };
  return null;
}

function majorsIn(html, text) {
  const found = new Set();
  for (const m of html.matchAll(/majordetails\?code=(MJD-[A-Z0-9]+)/g)) {
    found.add(m[1]);
  }
  for (const m of text.matchAll(
    /\b([A-Z][\w'&-]*(?:\s+(?:of|and|the|[A-Z][\w'&-]*))*)\s+major\b/g,
  )) {
    found.add(m[1].trim());
  }
  return [...found].sort();
}

function schoolsIn(text, schools) {
  const m = /Schools?\s+of\s+([^.;]+)/i.exec(text);
  if (!m) return [];
  return m[1]
    .split(/\bor\b|,/i)
    .map((s) => s.trim())
    .filter((s) => schools.has(s));
}

/**
 * A clause whose only content is unit codes already produced real edges. It
 * must not also become a chip, or every ordinary rule grows a duplicate.
 */
function isPlainUnitList(text) {
  const stripped = text.replace(UNIT_CODE, " ");
  return UNIT_CODE.test(text) && !/\blevel\s*[1-5]\b/i.test(stripped);
}

/**
 * Over-broad guard. A unit-set with no subject, major or school matches every
 * unit in the major at that level - correct for "any level 2 unit", wrong for
 * "level 2 Unit(s) in genetics", where the subject is prose we failed to
 * resolve. Detect the leftover noun and demote rather than draw a funnel that
 * claims more than the handbook does.
 */
function hasUnresolvedSubject(text) {
  for (const m of text.matchAll(/\b([\w'-]+)\s+units?\b/gi)) {
    const word = m[1].toLowerCase();
    // Digits are quantities ("24 points of level 1 units"), never subjects.
    if (/^\d+$/.test(word)) continue;
    if (!HARMLESS_BEFORE_UNIT.has(word)) return true;
  }
  // "units in statistics" names a subject; "units in any discipline" or
  // "unit in the Bachelor of Arts" does not narrow by subject at all.
  return /\bunits?\s+(?:in|from)\s+(?!any\b|the\b|this\b|your\b|each\b)[a-z]/.test(
    text,
  );
}

function classifyClause(clause, ctx) {
  const { html, text, verb } = clause;

  const hasLevel = /\blevel\s*[1-5]\b/i.test(text);

  // Enrolment first, because "Enrolment in level 5 53560 Master of Physics"
  // carries a level token but is an admission gate, not a choice of units.
  // An anchor or a governing <em> settles it outright; bare "enrolled in"
  // prose only wins when no level is named, so MKTG3308's "any one level 2
  // Marketing unit for students enrolled in Business Analytics Major" stays
  // the unit-set it actually is.
  if (
    /coursedetails\?code=|honoursdetails\?code=/.test(html) ||
    verb === "enrolment" ||
    (!hasLevel && /\b(enrolment|enrolled)\s+in\b/i.test(text))
  ) {
    return { kind: "enrolment" };
  }

  if (hasLevel) {
    const subjects = subjectsIn(text, ctx.prefixes);
    const majors = majorsIn(html, text);
    const schools = schoolsIn(text, ctx.schools);
    if (!subjects.length && !majors.length && !schools.length) {
      if (hasUnresolvedSubject(text)) {
        ctx.onUnresolved?.(text);
        return { kind: "other" };
      }
    }
    return {
      kind: "unit-set",
      levels: levelsIn(text),
      subjects,
      quantity: quantityIn(text),
      majors,
      schools,
    };
  }

  if (/\b\d+\s*(?:credit\s*)?points?\b/i.test(text)) return { kind: "points" };
  if (EXTERNAL.test(text)) return { kind: "external" };
  if (text.split(/\s+/).length >= 3) return { kind: "other" };
  return null;
}

// ------------------------------------------------------------------ merge

/** Canonical form of a requirement, for the "did these two merge" question. */
function sameScope(a, b) {
  return (
    a.kind === "unit-set" &&
    b.kind === "unit-set" &&
    // A bare level requirement and a subject-scoped one describe different
    // things; only merge alternatives that are the same shape.
    Boolean(a.subjects.length || a.majors.length || a.schools.length) ===
      Boolean(b.subjects.length || b.majors.length || b.schools.length)
  );
}

/**
 * Fold "or"-joined unit-sets into one requirement.
 *
 * Load-bearing. ASIA3004 is "any Level 2 ASIA unit <em>or</em> a Level 2 GEND
 * unit <em>or</em> a Level 2 ANTH unit". Left unmerged that becomes three
 * pseudo-nodes all arrowing into ASIA3004, which reads as "you need all
 * three" - the exact misreading the funnel shape exists to prevent.
 * "and"-joined clauses stay separate, because those genuinely are conjunctions.
 */
function mergeAlternatives(items) {
  const out = [];
  for (const item of items) {
    const prev = out[out.length - 1];
    if (prev && item.join === "or" && sameScope(prev, item)) {
      prev.levels = [...new Set([...prev.levels, ...item.levels])].sort();
      prev.subjects = [...new Set([...prev.subjects, ...item.subjects])].sort();
      prev.majors = [...new Set([...prev.majors, ...item.majors])].sort();
      prev.schools = [...new Set([...prev.schools, ...item.schools])].sort();
      prev.quantity = prev.quantity ?? item.quantity;
      prev.hedge = prev.hedge || item.hedge;
      prev.text = `${prev.text} or ${item.text}`;
      continue;
    }
    out.push(item);
  }
  return out;
}

/** Collapse repeats of the same kind that carry no distinguishing structure. */
function dedupe(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = [
      item.kind,
      item.levels.join("/"),
      item.subjects.join("."),
      item.majors.join("."),
      item.schools.join("."),
      item.kind === "unit-set" ? "" : item.text,
    ].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ------------------------------------------------------------------- main

/**
 * Structured view of the parts of a prerequisite rule that name no unit.
 *
 * @param {string} html  rules.prerequisites.html, as written by ruleHtml()
 * @param {{prefixes: Set<string>, schools: Set<string>, onUnresolved?: (text: string) => void}} ctx
 * @returns {Array<object>} possibly empty; keys that are empty are omitted
 */
export function classifyPrereqRule(html, ctx = {}) {
  if (!html) return [];
  const context = {
    prefixes: ctx.prefixes ?? new Set(),
    schools: ctx.schools ?? new Set(),
    onUnresolved: ctx.onUnresolved,
  };

  const classified = [];
  for (const clause of clauses(html)) {
    if (isPlainUnitList(clause.text)) continue;
    const result = classifyClause(clause, context);
    if (!result) continue;
    classified.push({
      kind: result.kind,
      levels: result.levels ?? [],
      subjects: result.subjects ?? [],
      majors: result.majors ?? [],
      schools: result.schools ?? [],
      quantity: result.quantity ?? null,
      hedge: clause.hedge,
      text: clause.text,
      join: clause.join,
    });
  }

  return dedupe(mergeAlternatives(classified)).map((item) => {
    // graph.json is fetched on every page load, so empty keys are dropped
    // rather than serialised as [] or null 2715 times over.
    const out = { kind: item.kind };
    if (item.levels.length) out.levels = item.levels;
    if (item.subjects.length) out.subjects = item.subjects;
    if (item.majors.length) out.majors = item.majors;
    if (item.schools.length) out.schools = item.schools;
    if (item.quantity) out.quantity = item.quantity;
    if (item.hedge) out.hedge = true;
    out.text = item.text.length > 200 ? `${item.text.slice(0, 197)}...` : item.text;
    return out;
  });
}
