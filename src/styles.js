import fs from 'fs';
import path from 'path';

const styleCache = new Map();

export function loadStyles(component, config) {
  const classNames = collectClassNames(component);
  const texts = [];
  /* v8 ignore next */
  const stylePaths = Array.from(
    new Set((component.styleImports || []).map((p) => normalizeStylePath(p)))
  );
  const cssInJs = extractCssInJs(component.source);
  const hasCssInJs = cssInJs.length > 0;
  if (hasCssInJs) texts.push(cssInJs.join('\n'));
  if (classNames.length) {
    stylePaths.forEach((stylePath) => {
      const content = readStyle(stylePath, config);
      if (!content) return;
      const filtered = filterStyle(content, classNames);
      if (filtered) texts.push(filtered);
    });
  }
  return { styleText: texts.join('\n'), stylePaths, hasCssInJs };
}

export function clearStyleCache() {
  styleCache.clear();
}

function normalizeStylePath(p) {
  /* v8 ignore next */
  return p.endsWith('.css') || p.endsWith('.scss') || p.endsWith('.sass') || p.endsWith('.less')
    ? p
    : `${p}.css`;
}

function readStyle(stylePath, config) {
  const resolved = stylePath.startsWith('.') ? path.resolve(config.root, stylePath) : stylePath;
  if (styleCache.has(resolved)) return styleCache.get(resolved);
  if (!fs.existsSync(resolved)) {
    styleCache.set(resolved, '');
    return '';
  }
  const content = fs.readFileSync(resolved, 'utf8');
  styleCache.set(resolved, content);
  return content;
}

function filterStyle(content, classNames) {
  /* v8 ignore next */
  if (!classNames.length) return content;
  const ranges = collectSelectorRanges(content, classNames);
  if (!ranges.length) return '';
  return ranges
    .map(([start, end]) => content.slice(start, end + 1).trim())
    .filter(Boolean)
    .join('\n\n');
}

function collectClassNames(component) {
  const names = new Set(component.classNames || []);
  const source = component.source || '';
  const dotMatches = source.matchAll(/styles\.([A-Za-z0-9_-]+)/g);
  for (const match of dotMatches) {
    names.add(match[1]);
  }
  const bracketMatches = source.matchAll(/styles\[['"]([^'"]+)['"]\]/g);
  for (const match of bracketMatches) {
    names.add(match[1]);
  }
  return Array.from(names);
}

function collectSelectorRanges(content, classNames) {
  const lowered = content.toLowerCase();
  const ranges = [];
  classNames.forEach((name) => {
    const pattern = new RegExp(`\\.${escapeRegExp(name.toLowerCase())}(?:[^A-Za-z0-9_-]|$)`, 'g');
    let match;
    while ((match = pattern.exec(lowered))) {
      const braceIndex = findNextBrace(content, match.index);
      const start = findSelectorStart(content, braceIndex);
      const end = findMatchingBrace(content, braceIndex);
      if (braceIndex !== -1 && start !== -1 && end !== -1) ranges.push([start, end]);
    }
  });
  return mergeRanges(ranges);
}

function findNextBrace(content, fromIndex) {
  /* v8 ignore next */
  if (fromIndex === -1) return -1;
  return content.indexOf('{', fromIndex);
}

function findSelectorStart(content, braceIndex) {
  /* v8 ignore next */
  if (braceIndex === -1) return -1;
  let idx = braceIndex - 1;
  while (idx >= 0) {
    const char = content[idx];
    if (char === '}' || char === ';') return idx + 1;
    idx -= 1;
  }
  return 0;
}

function findMatchingBrace(content, openIndex) {
  /* v8 ignore next */
  if (openIndex === -1) return -1;
  let depth = 0;
  for (let i = openIndex; i < content.length; i += 1) {
    const char = content[i];
    if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function mergeRanges(ranges) {
  if (!ranges.length) return [];
  const sorted = ranges.sort((a, b) => a[0] - b[0]);
  const merged = [sorted[0]];
  for (let i = 1; i < sorted.length; i += 1) {
    const [start, end] = sorted[i];
    const last = merged[merged.length - 1];
    if (start <= last[1] + 1) {
      last[1] = Math.max(last[1], end);
    } else {
      merged.push([start, end]);
    }
  }
  return merged;
}

function escapeRegExp(value = '') {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractCssInJs(source = '') {
  const matches = [];
  const regexes = [/css`([\s\S]*?)`/g, /styled\.[^(]+`([\s\S]*?)`/g, /styled\([^`]+`([\s\S]*?)`/g];
  regexes.forEach((regex) => {
    let match = regex.exec(source);
    while (match) {
      matches.push(match[1]);
      match = regex.exec(source);
    }
  });
  return matches;
}
