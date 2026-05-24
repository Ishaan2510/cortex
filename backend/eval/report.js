/**
 * Markdown report generator for eval runs.
 *
 * Produces a human-readable summary that can be:
 *   - opened in a PR comment
 *   - uploaded as a GitHub Actions artifact
 *   - committed to the repo as historical record
 */

function pct(x) {
  return (x * 100).toFixed(1) + '%';
}

function writeMarkdownReport(report, baseline) {
  const lines = [];

  lines.push('# LLM Eval Report');
  lines.push('');
  lines.push(`**Timestamp:** ${report.timestamp}`);
  lines.push(`**Commit:** \`${report.commit}\``);
  lines.push(`**Regression threshold:** ${report.regression_threshold_pp} percentage points`);
  lines.push('');

  // Summary status
  if (report.regressions.length > 0) {
    lines.push(`## ❌ Status: REGRESSION DETECTED`);
    lines.push('');
    lines.push('| Operation | Baseline | Current | Drop |');
    lines.push('|---|---|---|---|');
    for (const r of report.regressions) {
      lines.push(
        `| ${r.operation} | ${pct(r.baseline_rate)} | ${pct(r.current_rate)} | ${r.drop_pp.toFixed(1)} pp |`
      );
    }
    lines.push('');
  } else {
    lines.push(`## ✅ Status: PASSED`);
    lines.push('');
    lines.push('All operations within regression threshold.');
    lines.push('');
  }

  // Per-operation table
  lines.push('## Per-Operation Pass Rates');
  lines.push('');
  lines.push('| Operation | Cases | Pass Rate | Baseline | Delta |');
  lines.push('|---|---|---|---|---|');
  for (const [op, stats] of Object.entries(report.operations)) {
    const base = baseline?.operations?.[op];
    const baseStr = base ? pct(base.pass_rate) : '—';
    const deltaPp = base ? ((stats.pass_rate - base.pass_rate) * 100).toFixed(1) : '—';
    const deltaStr = base ? `${deltaPp >= 0 ? '+' : ''}${deltaPp} pp` : '—';
    lines.push(
      `| ${op} | ${stats.passed}/${stats.total_cases} | ${pct(stats.pass_rate)} | ${baseStr} | ${deltaStr} |`
    );
  }
  lines.push('');

  // Per-case detail
  lines.push('## Case Details');
  lines.push('');
  for (const c of report.cases) {
    const icon = c.passed ? '✅' : '❌';
    lines.push(`### ${icon} \`${c.operation}\` / \`${c.id}\``);
    if (c.description) lines.push(`*${c.description}*`);
    lines.push('');
    if (c.error) {
      lines.push(`**Error:** ${c.error}`);
      lines.push('');
      continue;
    }
    lines.push(`- **Provider used:** ${c.providerUsed} (chain: ${c.providerChain.join(' → ')})`);
    lines.push(`- **Duration:** ${c.durationMs} ms`);
    lines.push('');
    lines.push('| Check | Result | Detail |');
    lines.push('|---|---|---|');
    for (const check of c.checks) {
      const r = check.passed ? '✅' : '❌';
      lines.push(`| ${check.type} | ${r} | ${check.detail} |`);
    }
    lines.push('');
    lines.push('<details><summary>Output</summary>');
    lines.push('');
    lines.push('```');
    lines.push(c.output.slice(0, 2000));
    if (c.output.length > 2000) lines.push('... [truncated]');
    lines.push('```');
    lines.push('');
    lines.push('</details>');
    lines.push('');
  }

  return lines.join('\n');
}

module.exports = { writeMarkdownReport };