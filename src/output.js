import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { highlight } from 'cli-highlight';
import { banner } from './duplicalis.js';
import { duplicalisBanner } from './banner-text.js';

export function emitReport(entries, pairs = [], config, stats) {
  const components = entries.map((entry) => ({
    id: entry.component.id,
    name: entry.component.name,
    filePath: relativize(entry.component.filePath, config.root, config.relativePaths),
    hasStyles: !!entry.styleText,
    hooks: entry.component.hooks.length,
    loc: entry.component.loc,
    snippet: trimSource(entry.component.source),
  }));

  const report = { components, pairs, stats };
  const outPath = config.out ? path.resolve(config.root, config.out) : null;
  if (outPath) {
    /* v8 ignore next */
    if (outPath.endsWith('.txt')) {
      fs.writeFileSync(outPath, toTextReport(report, entries, config), 'utf8');
    } else {
      fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
    }
  }
  printConsole(report, config, outPath, entries);
}

function printConsole(report, config, outPath, entries) {
  printBanner();
  console.log('');
  printTextBanner();
  const mode = formatMode(config);
  console.log(chalk.bold('\nDuplicate React component report'));
  console.log(mode);
  printRunConfig(config, outPath);
  printMatches(report, config, entries);
  printStatsTable(report, outPath);
}

/* v8 ignore start */
function relativize(filePath, root, useRelative) {
  if (!filePath) return '';
  try {
    if (!useRelative) return filePath;
    const rel = path.relative(root || process.cwd(), filePath);
    return rel || filePath;
    /* v8 ignore next */
  } catch (_e) {
    return filePath;
  }
}
/* v8 ignore stop */

/* v8 ignore start */
function formatMode(config) {
  if (config.model === 'remote') {
    return `model: remote (${config.remote?.model || ''} @ ${config.remote?.url || 'n/a'})`;
  }
  if (config.model === 'mock') return 'model: mock (deterministic hashing)';
  return `model: local (path: ${config.modelPath}, auto-download: ${config.autoDownloadModel ? 'on' : 'off'})`;
}
/* v8 ignore stop */

function printRunConfig(config, outPath) {
  console.log(chalk.bold('Run config'));
  console.log(`  root: ${config.root}`);
  if (config.configPath) {
    const suffix = config.configSaved ? ' (updated this run)' : '';
    console.log(`  config: ${config.configPath}${suffix}`);
  }
  if (outPath) console.log(`  output: ${outPath}`);
  console.log(`  cache: ${config.cachePath || 'none'}`);
  console.log(
    `  thresholds: min ${config.similarityThreshold} · high-label ${config.highSimilarityThreshold} · max ${config.maxSimilarityThreshold ?? 1}`
  );
  const limitText =
    typeof config.limit === 'number' && Number.isFinite(config.limit) ? config.limit : 'all';
  console.log(`  limit: ${limitText}`);
  console.log(`  include: ${(config.include || []).join(', ') || '—'}`);
  console.log(`  exclude: ${(config.exclude || []).join(', ') || '—'}`);
}

function printMatches(report, config, entries) {
  console.log(chalk.bold('\nTop matches (with snippets):'));
  if (!report.pairs.length) {
    console.log('  none above threshold');
    return;
  }
  const byId = new Map(entries.map((e) => [e.component.id, e]));
  const separator = chalk.dim('─'.repeat(80));
  const limit = Number.isFinite(config.limit) ? config.limit : report.pairs.length;
  const maxPairs = Math.min(limit, report.pairs.length);
  report.pairs.slice(0, maxPairs).forEach((pair, idx) => {
    const left = byId.get(pair.a);
    const right = byId.get(pair.b);
    console.log(`\n${separator}`);
    const number = chalk.black.bgYellow.bold(` ${String(idx + 1).padStart(2, ' ')} `);
    const title = `${number}  score: ${pair.similarity}`;
    console.log(chalk.bold(chalk.cyan(title)));
    const tagLine = pair.labels.length ? pair.labels.map((l) => `#${l}`).join('    ') : '—';
    console.log(chalk.white(tagLine));
    if (pair.hints?.length) {
      pair.hints.forEach((h) => console.log(chalk.gray(`  - ${h}`)));
    }
    printSnippetBlock('A', left?.component, config.root, config.relativePaths);
    printSnippetBlock('B', right?.component, config.root, config.relativePaths);
  });
  console.log(separator);
}

function printSnippetBlock(label, component, root, useRelative) {
  if (!component) return;
  console.log('');
  const displayPath = relativize(component.filePath, root, useRelative);
  const header = `${label}) ${component.name}`;
  console.log(chalk.yellow(header));
  console.log(chalk.gray(`    ${displayPath}`));
  const snippet = trimSource(component.source);
  if (!snippet.trim()) {
    console.log('    [no snippet]');
    return;
  }
  const highlighted = applyHighlight(snippet, component.filePath);
  const lines = highlighted.split('\n');
  lines.forEach((line) => console.log(`    ${line}`));
}

function trimSource(source = '') {
  const lines = source.split('\n').filter((l) => l.trim() !== '');
  const limited = lines.slice(0, 12);
  const processed = limited.map((line) => (line.length > 120 ? `${line.slice(0, 117)}...` : line));
  return processed.join('\n');
}

/* v8 ignore start */
function applyHighlight(snippet, filePath) {
  try {
    const language = detectLanguage(filePath);
    return highlight(snippet, { language, ignoreIllegals: true });
  } catch (error) {
    /* v8 ignore next */
    return snippet;
  }
}

function detectLanguage(filePath) {
  if (!filePath) return undefined;
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) return 'typescript';
  if (filePath.endsWith('.jsx') || filePath.endsWith('.js')) return 'javascript';
  if (
    filePath.endsWith('.css') ||
    filePath.endsWith('.scss') ||
    filePath.endsWith('.sass') ||
    filePath.endsWith('.less')
  )
    return 'css';
  return undefined;
}
/* v8 ignore stop */

function printStatsTable(report, outPath) {
  console.log(chalk.bold('\nRun stats'));
  const rows = buildStatsRows(report);
  renderTable(rows);
  if (outPath) console.log(chalk.dim(`JSON written to ${outPath}`));
}

function buildStatsRows(report) {
  const stats = report.stats || {};
  const scorecard = stats.scorecard || {};
  const cache = stats.cache || {};
  const cacheParts = [
    cache.hits != null ? `hits ${cache.hits}` : null,
    cache.misses != null ? `misses ${cache.misses}` : null,
    cache.cleaned != null ? `cleaned ${cache.cleaned}` : null,
    cache.uncachedCount != null ? `uncached ${cache.uncachedCount}` : null,
  ].filter(Boolean);
  const timingParts = [
    stats.scanMs != null ? `scan ${stats.scanMs}ms` : null,
    stats.parseMs != null ? `parse ${stats.parseMs}ms` : null,
    stats.embedMs != null ? `embed ${stats.embedMs}ms` : null,
    stats.similarityMs != null ? `similarity ${stats.similarityMs}ms` : null,
  ].filter(Boolean);
  const pairedCount = countPairedComponents(report.pairs);
  const componentCount = report.components.length;
  const coveragePercent =
    componentCount === 0 ? 0 : Math.round((pairedCount / componentCount) * 100);
  return [
    {
      label: 'match coverage',
      value: `${pairedCount}/${componentCount} (${coveragePercent}%)`,
      emphasis: true,
    },
    { label: 'pairs reported', value: report.pairs.length },
    { label: 'pairs suppressed', value: formatSuppression(scorecard) },
    { label: 'components scanned', value: componentCount },
    { label: 'timings (ms)', value: timingParts.join(' | ') || 'n/a' },
    { label: 'cache', value: cacheParts.join(' | ') || 'n/a' },
  ];
}

function renderTable(rows) {
  const normalized = rows.map((row) => ({
    label: row.label,
    value: String(row.value),
    emphasis: row.emphasis,
  }));
  const labelWidth = Math.max(...normalized.map((row) => row.label.length));
  const valueWidth = Math.max(...normalized.map((row) => row.value.length));
  const totalWidth = labelWidth + valueWidth + 7;
  const top = `┌${'─'.repeat(totalWidth - 2)}┐`;
  const divider = `├${'─'.repeat(totalWidth - 2)}┤`;
  const bottom = `└${'─'.repeat(totalWidth - 2)}┘`;
  console.log(chalk.dim(top));
  normalized.forEach((row, index) => {
    const label = row.label.padEnd(labelWidth, ' ');
    const valueText = row.value.padEnd(valueWidth, ' ');
    const renderedValue = row.emphasis ? chalk.black.bgYellow(` ${valueText} `) : ` ${valueText} `;
    const renderedLabel = ` ${label} `;
    console.log(`│${renderedLabel}│${renderedValue}│`);
    if (index === 0) console.log(chalk.dim(divider));
  });
  console.log(chalk.dim(bottom));
}

function formatSuppression(scorecard) {
  if (!scorecard || typeof scorecard.suppressedPairs !== 'number') return 'n/a';
  if (scorecard.suppressedPairs === 0) return '0';
  const reasons = scorecard.suppressionReasons || {};
  const parts = Object.entries(reasons)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([reason, count]) => `${reason} ${count}`);
  return `${scorecard.suppressedPairs}${parts.length ? ` (${parts.join(' | ')})` : ''}`;
}

function countPairedComponents(pairs) {
  const ids = new Set();
  pairs.forEach((pair) => {
    if (pair.a) ids.add(pair.a);
    if (pair.b) ids.add(pair.b);
  });
  return ids.size;
}

/* v8 ignore start */
function printBanner() {
  if (!banner) return;
  const width = process.stdout.columns || 80;
  const lines = banner.trimEnd().split('\n');
  lines.forEach((line) => {
    const trimmed = line.replace(/\s+$/, '');
    const pad = Math.max(0, Math.floor((width - trimmed.length) / 2));
    console.log(' '.repeat(pad) + colorizeLine(trimmed));
  });
}

function colorizeLine(line) {
  const shades = {
    ' ': ' ',
    // light to dark palette tuned to the provided reference
    '░': chalk.hex('#8b4f34')('░'),
    '▒': chalk.hex('#c67856')('▒'),
    '▓': chalk.hex('#f2a47f')('▓'),
    '█': chalk.hex('#f7c2a0')('█'),
  };
  let result = '';
  for (const char of line) {
    result += shades[char] || char;
  }
  return result;
}

function printTextBanner() {
  if (!duplicalisBanner) return;
  const width = process.stdout.columns || 80;
  const lines = duplicalisBanner.trim().split('\n');
  lines.forEach((line) => {
    const trimmed = line.replace(/\s+$/, '');
    const pad = Math.max(0, Math.floor((width - trimmed.length) / 2));
    console.log(' '.repeat(pad) + trimmed);
  });
}
/* v8 ignore stop */

function toTextReport(report, entries, config) {
  const byId = new Map(entries.map((e) => [e.component.id, e.component]));
  const lines = [];
  report.pairs.forEach((pair) => {
    const compA = byId.get(pair.a);
    const compB = byId.get(pair.b);
    const labels = pair.labels.length ? pair.labels.map((l) => `#${l}`).join('\t') : '-';
    lines.push(`${pair.similarity} | ${labels}`);
    if (compA) {
      lines.push(relativize(compA.filePath, config.root, config.relativePaths));
    }
    if (compB) {
      lines.push(relativize(compB.filePath, config.root, config.relativePaths));
    }
    lines.push('');
  });
  return lines.join('\n').trimEnd() + '\n';
}
