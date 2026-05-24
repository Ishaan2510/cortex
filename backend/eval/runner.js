/**
 * Eval runner — loads YAML cases, calls the LLM router, scores outputs,
 * writes reports, and exits with code 1 if any operation regresses
 * beyond the configured threshold.
 *
 * Usage:
 *   node eval/runner.js                  # normal run, regression check enforced
 *   node eval/runner.js --update-baseline  # save current results as new baseline
 *
 * Env vars required: GROQ_API_KEY, CEREBRAS_API_KEY, GOOGLE_API_KEY, OPENROUTER_API_KEY
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const { routeAndCall } = require('../src/services/llmRouter');
const { getSystemPrompt } = require('../src/services/operations');
const { runCheck } = require('./scorers');
const { writeMarkdownReport } = require('./report');

const REGRESSION_THRESHOLD_PP = 5; // percentage points
const CASES_DIR = path.join(__dirname, 'cases');
const RESULTS_DIR = path.join(__dirname, 'results');
const BASELINE_PATH = path.join(__dirname, 'baseline.json');

function loadCases() {
  const files = fs.readdirSync(CASES_DIR).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));
  const allCases = [];
  for (const file of files) {
    const raw = fs.readFileSync(path.join(CASES_DIR, file), 'utf8');
    const parsed = yaml.load(raw);
    if (!parsed.operation || !Array.isArray(parsed.cases)) {
      console.warn(`Skipping ${file}: must have 'operation' and 'cases' fields`);
      continue;
    }
    for (const c of parsed.cases) {
      allCases.push({ ...c, operation: parsed.operation, file });
    }
  }
  return allCases;
}

async function runCase(testCase) {
  const systemPrompt = getSystemPrompt(testCase.operation, testCase.custom_prompt);
  const userMessage = testCase.input;
  const inputLength = userMessage.length;

  const start = Date.now();
  let output, attempted, error;
  try {
    const result = await routeAndCall({
      systemPrompt,
      userMessage,
      operation: testCase.operation,
      inputLength,
      hasImage: false,
      imageData: null,
    });
    output = result.result;
    attempted = result.attempted;
  } catch (err) {
    error = err.message;
    output = '';
    attempted = [];
  }
  const durationMs = Date.now() - start;

  const checkResults = (testCase.checks || []).map((check) => ({
    type: check.type,
    config: check,
    ...runCheck(output, check),
  }));

  const passed = !error && checkResults.every((r) => r.passed);

  return {
    id: testCase.id,
    operation: testCase.operation,
    description: testCase.description,
    passed,
    error,
    durationMs,
    providerChain: attempted,
    providerUsed: attempted[attempted.length - 1] || null,
    output,
    checks: checkResults,
  };
}

function aggregate(results) {
  const byOp = {};
  for (const r of results) {
    if (!byOp[r.operation]) byOp[r.operation] = { passed: 0, total: 0 };
    byOp[r.operation].total += 1;
    if (r.passed) byOp[r.operation].passed += 1;
  }
  const operations = {};
  for (const [op, counts] of Object.entries(byOp)) {
    operations[op] = {
      pass_rate: counts.total ? counts.passed / counts.total : 0,
      passed: counts.passed,
      total_cases: counts.total,
    };
  }
  return operations;
}

function loadBaseline() {
  if (!fs.existsSync(BASELINE_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
  } catch (err) {
    console.warn(`Could not parse baseline: ${err.message}`);
    return null;
  }
}

function checkRegressions(current, baseline) {
  if (!baseline) return { regressions: [], firstRun: true };
  const regressions = [];
  for (const [op, currentStats] of Object.entries(current)) {
    const baselineStats = baseline.operations?.[op];
    if (!baselineStats) continue;
    const dropPp = (baselineStats.pass_rate - currentStats.pass_rate) * 100;
    if (dropPp > REGRESSION_THRESHOLD_PP) {
      regressions.push({
        operation: op,
        baseline_rate: baselineStats.pass_rate,
        current_rate: currentStats.pass_rate,
        drop_pp: dropPp,
      });
    }
  }
  return { regressions, firstRun: false };
}

async function main() {
  const args = process.argv.slice(2);
  const updateBaseline = args.includes('--update-baseline');

  if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true });

  const cases = loadCases();
  if (cases.length === 0) {
    console.error('No eval cases found.');
    process.exit(1);
  }
  console.log(`Loaded ${cases.length} cases across ${new Set(cases.map((c) => c.operation)).size} operations`);

  const results = [];
  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    process.stdout.write(`[${i + 1}/${cases.length}] ${c.operation} / ${c.id} ... `);
    const result = await runCase(c);
    results.push(result);
    console.log(result.passed ? 'PASS' : `FAIL${result.error ? ` (${result.error})` : ''}`);
  }

  const operations = aggregate(results);
  const baseline = loadBaseline();
  const { regressions, firstRun } = checkRegressions(operations, baseline);

  const timestamp = new Date().toISOString();
  const reportData = {
    timestamp,
    commit: process.env.GITHUB_SHA || 'local',
    regression_threshold_pp: REGRESSION_THRESHOLD_PP,
    operations,
    regressions,
    cases: results,
  };

  const safeTimestamp = timestamp.replace(/[:.]/g, '-');
  const jsonPath = path.join(RESULTS_DIR, `${safeTimestamp}.json`);
  const mdPath = path.join(RESULTS_DIR, `${safeTimestamp}.md`);
  fs.writeFileSync(jsonPath, JSON.stringify(reportData, null, 2));
  fs.writeFileSync(mdPath, writeMarkdownReport(reportData, baseline));

  console.log('\n=== Summary ===');
  for (const [op, stats] of Object.entries(operations)) {
    const pct = (stats.pass_rate * 100).toFixed(1);
    const baseStat = baseline?.operations?.[op];
    const delta = baseStat
      ? ` (baseline ${(baseStat.pass_rate * 100).toFixed(1)}%)`
      : '';
    console.log(`  ${op}: ${stats.passed}/${stats.total_cases} = ${pct}%${delta}`);
  }
  console.log(`\nReport: ${mdPath}`);

  if (updateBaseline) {
    const newBaseline = {
      last_updated: timestamp,
      commit: reportData.commit,
      operations,
    };
    fs.writeFileSync(BASELINE_PATH, JSON.stringify(newBaseline, null, 2));
    console.log(`Baseline updated: ${BASELINE_PATH}`);
    process.exit(0);
  }

  if (firstRun) {
    console.log('\nNo baseline found. Run with --update-baseline to create one.');
    process.exit(0);
  }

  if (regressions.length > 0) {
    console.error(`\nFAILED: ${regressions.length} operation(s) regressed beyond ${REGRESSION_THRESHOLD_PP}pp:`);
    for (const r of regressions) {
      console.error(
        `  ${r.operation}: ${(r.current_rate * 100).toFixed(1)}% vs baseline ${(r.baseline_rate * 100).toFixed(1)}% (drop ${r.drop_pp.toFixed(1)}pp)`
      );
    }
    process.exit(1);
  }

  console.log('\nAll operations within regression threshold. PASSED.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Eval runner crashed:', err);
  process.exit(2);
});