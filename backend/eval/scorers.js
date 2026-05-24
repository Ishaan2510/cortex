/**
 * Eval scorers — pure functions that check LLM output against expected criteria.
 *
 * Each scorer signature: (output: string, config: object) => { passed: boolean, detail: string }
 *
 * The runner dispatches checks by `type` to the matching function here.
 * Adding a new check type means: add a function below, add it to the SCORERS map,
 * and document the YAML schema in the README.
 */

function formatBullets(output, { min, max }) {
  // Match leading whitespace, then a bullet marker (-, *, •), then a space
  const bulletLines = output
    .split('\n')
    .filter((line) => /^\s*[-*•]\s/.test(line));
  const count = bulletLines.length;
  const passed = count >= min && count <= max;
  return {
    passed,
    detail: `Found ${count} bullet lines (expected ${min}-${max})`,
  };
}

function mustContain(output, { terms, case_sensitive = false }) {
  if (!Array.isArray(terms) || terms.length === 0) {
    return { passed: true, detail: 'No terms specified' };
  }
  const haystack = case_sensitive ? output : output.toLowerCase();
  const missing = terms.filter((t) => {
    const needle = case_sensitive ? t : String(t).toLowerCase();
    return !haystack.includes(needle);
  });
  return {
    passed: missing.length === 0,
    detail: missing.length
      ? `Missing required terms: ${missing.join(', ')}`
      : `All ${terms.length} required terms present`,
  };
}

function mustNotContain(output, { terms, case_sensitive = false }) {
  if (!Array.isArray(terms) || terms.length === 0) {
    return { passed: true, detail: 'No terms specified' };
  }
  const haystack = case_sensitive ? output : output.toLowerCase();
  const found = terms.filter((t) => {
    const needle = case_sensitive ? t : String(t).toLowerCase();
    return haystack.includes(needle);
  });
  return {
    passed: found.length === 0,
    detail: found.length
      ? `Found forbidden terms: ${found.join(', ')}`
      : `No forbidden terms present`,
  };
}

function minLength(output, { chars }) {
  const len = output.length;
  return {
    passed: len >= chars,
    detail: `Output is ${len} chars (min ${chars})`,
  };
}

function maxLength(output, { chars }) {
  const len = output.length;
  return {
    passed: len <= chars,
    detail: `Output is ${len} chars (max ${chars})`,
  };
}

function regexMatch(output, { pattern, flags = '' }) {
  let re;
  try {
    re = new RegExp(pattern, flags);
  } catch (err) {
    return { passed: false, detail: `Invalid regex /${pattern}/${flags}: ${err.message}` };
  }
  const matched = re.test(output);
  return {
    passed: matched,
    detail: matched ? `Output matches /${pattern}/${flags}` : `Output does not match /${pattern}/${flags}`,
  };
}

const SCORERS = {
  format_bullets: formatBullets,
  must_contain: mustContain,
  must_not_contain: mustNotContain,
  min_length: minLength,
  max_length: maxLength,
  regex_match: regexMatch,
};

function runCheck(output, check) {
  const scorer = SCORERS[check.type];
  if (!scorer) {
    return { passed: false, detail: `Unknown check type: ${check.type}` };
  }
  try {
    return scorer(output, check);
  } catch (err) {
    return { passed: false, detail: `Scorer threw: ${err.message}` };
  }
}

module.exports = { SCORERS, runCheck };