import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { embedComponents, findSimilarities } from '../src/similarity.js';
import { MockEmbeddingBackend } from '../src/embedding/mock.js';
import { loadCache, saveCache } from '../src/cache.js';

const baseComponent = (id, source) => ({
  id: `${id}#${id}`,
  name: id,
  filePath: `${id}.tsx`,
  props: { names: [], spreads: 0 },
  hooks: [],
  logicTokens: [],
  literals: [],
  jsxTags: ['div'],
  jsxPaths: [],
  textNodes: [],
  classNames: [],
  returnsCount: 1,
  styleImports: [],
  isWrapper: false,
  source,
});

describe('similarity', () => {
  it('respects limit and custom weights', async () => {
    const components = [
      baseComponent('A', 'one'),
      baseComponent('B', 'one two'),
      baseComponent('C', 'one two three'),
    ];
    const backend = new MockEmbeddingBackend(4);
    const { entries } = await embedComponents(components, backend, {
      weight: { code: 0.5, style: 0.5 },
      styleExtensions: ['.css'],
      root: process.cwd(),
    });
    const { pairs } = findSimilarities(entries, {
      similarityThreshold: 0.1,
      highSimilarityThreshold: 0.9,
      limit: 1,
    });
    const counts = {};
    pairs.forEach((pair) => {
      counts[pair.a] = (counts[pair.a] || 0) + 1;
      counts[pair.b] = (counts[pair.b] || 0) + 1;
    });
    expect(Math.max(...Object.values(counts))).toBeLessThanOrEqual(1);
  });

  it('returns all matches when limit is not provided', () => {
    const makeEntry = (id, vector) => ({
      component: {
        id: `${id}#${id}`,
        name: id,
        filePath: `${id}.tsx`,
        props: { names: [], spreads: 0 },
        hooks: [],
        logicTokens: [],
        literals: [],
        jsxTags: [],
        jsxPaths: [],
        textNodes: [],
        classNames: [],
        returnsCount: 0,
        styleImports: [],
        isWrapper: false,
        source: '',
      },
      vector,
      codeVec: vector,
      styleVec: vector,
      structureVec: vector,
      holisticVec: vector,
      hasStyles: false,
    });
    const entries = [makeEntry('A', [1, 0]), makeEntry('B', [1, 0]), makeEntry('C', [1, 0])];
    const { pairs } = findSimilarities(entries, {
      similarityThreshold: 0.1,
      highSimilarityThreshold: 0.9,
    });
    expect(pairs.length).toBe(3);
  });

  it('skips pairs below threshold', async () => {
    const components = [baseComponent('A', 'one'), baseComponent('B', 'unrelated text here')];
    const backend = new MockEmbeddingBackend(4);
    const { entries } = await embedComponents(components, backend, {
      weight: { code: 0.7, style: 0.3 },
      styleExtensions: ['.css'],
      root: process.cwd(),
    });
    const { pairs } = findSimilarities(entries, {
      similarityThreshold: 1,
      highSimilarityThreshold: 1,
      limit: 1,
    });
    expect(pairs.length).toBe(0);
  });

  it('re-embeds when content changes and cleans missing files randomly', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'duplicalis-cache-test-'));
    const cachePath = path.join(dir, 'cache.json');
    const compFile = path.join(dir, 'Comp.tsx');
    fs.writeFileSync(compFile, 'export const Comp = () => "a";');
    const components = [baseComponent(compFile, fs.readFileSync(compFile, 'utf8'))];
    const backend = { embed: vi.fn(async (text) => new Array(4).fill(text.length)) };

    const config = {
      weight: { code: 1, style: 0 },
      styleExtensions: [],
      root: dir,
      cachePath,
      showProgress: false,
      cleanProbability: 0,
    };

    await embedComponents(components, backend, config);
    expect(backend.embed).toHaveBeenCalledTimes(3);

    backend.embed.mockClear();
    await embedComponents(components, backend, config);
    expect(backend.embed).toHaveBeenCalledTimes(0);

    backend.embed.mockClear();
    fs.writeFileSync(compFile, 'export const Comp = () => "b";');
    components[0].source = fs.readFileSync(compFile, 'utf8');
    components[0].jsxTags.push('span');
    await embedComponents(components, backend, config);
    expect(backend.embed).toHaveBeenCalledTimes(3);

    // force clean removed file
    const cacheRaw = loadCache(cachePath);
    cacheRaw.entries['local:missing#missing'] = { fingerprint: 'x', codeVec: [1], styleVec: [1] };
    saveCache(cachePath, cacheRaw);
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0); // trigger clean
    await embedComponents(components, backend, {
      weight: { code: 1, style: 0 },
      styleExtensions: [],
      root: dir,
      cachePath,
      showProgress: false,
      cleanProbability: 1,
    });
    randomSpy.mockRestore();
    const cleaned = loadCache(cachePath);
    expect(cleaned.entries['local:missing#missing']).toBeUndefined();
  });

  it('ignores malformed cache keys during cleanup', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'duplicalis-bad-cache-'));
    const cachePath = path.join(dir, 'cache.json');
    const cache = {
      version: 1,
      entries: {
        '': { fingerprint: 'x', codeVec: [1], styleVec: [1], structureVec: [1], holisticVec: [1] },
        nocolon: { fingerprint: 'y', codeVec: [1], styleVec: [1], structureVec: [1], holisticVec: [1] },
      },
    };
    saveCache(cachePath, cache);
    const backend = { embed: vi.fn(async () => [1, 0, 0]) };
    await embedComponents([baseComponent('Tmp', 'tmp')], backend, {
      weight: { code: 1, style: 0 },
      styleExtensions: [],
      root: dir,
      cachePath,
      showProgress: false,
      cleanProbability: 1,
    });
    const cleaned = loadCache(cachePath);
    expect(cleaned.entries['']).toBeDefined();
    expect(cleaned.entries.nocolon).toBeDefined();
  });

  it('tracks coverage and best similarity stats alongside limited pairs', () => {
    const makeEntry = (id, vector) => ({
      component: {
        id: `${id}#${id}`,
        name: id,
        filePath: `${id}.tsx`,
        props: { names: [], spreads: 0 },
        hooks: [],
        logicTokens: [],
        literals: [],
        jsxTags: [],
        jsxPaths: [],
        textNodes: [],
        classNames: [],
        returnsCount: 0,
        styleImports: [],
        isWrapper: false,
        source: '',
      },
      vector,
      codeVec: vector,
      styleVec: vector,
      structureVec: vector,
      holisticVec: vector,
      hasStyles: false,
    });
    const entries = [makeEntry('A', [1, 0]), makeEntry('B', [0.6, 0.8]), makeEntry('C', [0, 1])];
    const { pairs, scorecard } = findSimilarities(entries, {
      similarityThreshold: 0.5,
      highSimilarityThreshold: 0.9,
      limit: 1,
    });
    expect(scorecard.coveredComponents).toBe(3);
    expect(scorecard.minBestSimilarity).toBeCloseTo(0.6, 4);
    expect(scorecard.maxBestSimilarity).toBeCloseTo(0.8, 4);
    expect(pairs.length).toBe(1);
  });

  it('handles runs without comparable pairs', () => {
    const entry = {
      component: {
        id: 'Solo#Solo',
        name: 'Solo',
        filePath: 'Solo.tsx',
        props: { names: [], spreads: 0 },
        hooks: [],
        logicTokens: [],
        literals: [],
        jsxTags: [],
        jsxPaths: [],
        textNodes: [],
        classNames: [],
        returnsCount: 0,
        styleImports: [],
        isWrapper: false,
        source: '',
      },
      vector: [1, 0],
      codeVec: [1, 0],
      styleVec: [1, 0],
      structureVec: [1, 0],
      holisticVec: [1, 0],
      hasStyles: false,
    };
    const result = findSimilarities([entry], {
      similarityThreshold: 0.5,
      highSimilarityThreshold: 0.9,
      limit: 2,
    });
    expect(result.pairs).toEqual([]);
    expect(result.scorecard.coveredComponents).toBe(0);
    expect(result.scorecard.maxSimilarity).toBe(0);
  });

  it('suppresses expected wrapper and low-signal pairs', () => {
    const makeEntry = (id, vector, extras = {}) => ({
      component: {
        id: `${id}#${id}`,
        name: id,
        filePath: `${id}.tsx`,
        props: extras.props || { names: [], spreads: 0 },
        hooks: extras.hooks || [],
        logicTokens: extras.logicTokens || [],
        literals: extras.literals || [],
        jsxTags: extras.jsxTags || [],
        jsxPaths: [],
        textNodes: extras.textNodes || [],
        classNames: [],
        returnsCount: 0,
        styleImports: [],
        isWrapper: extras.isWrapper || false,
        source: extras.source || '',
      },
      vector,
      codeVec: vector,
      styleVec: vector,
      structureVec: vector,
      holisticVec: vector,
      hasStyles: false,
    });
    const entries = [
      makeEntry('WrapperA', [1, 0, 0], {
        isWrapper: true,
        props: { names: ['variant'], spreads: 0 },
        jsxTags: ['Button'],
        source: 'export const WrapperA = () => <Button variant="a" />;',
      }),
      makeEntry('WrapperB', [1, 0, 0], {
        isWrapper: true,
        props: { names: ['variant'], spreads: 0 },
        jsxTags: ['Button'],
        source: 'export const WrapperB = () => <Button variant="b" />;',
      }),
      makeEntry('TinyA', [0, 1, 0], {
        props: { names: ['size'], spreads: 0 },
        jsxTags: ['Box'],
        source: 'const TinyA = () => <Box size="s" />;',
      }),
      makeEntry('TinyB', [0, 1, 0], {
        props: { names: ['size'], spreads: 0 },
        jsxTags: ['Box'],
        source: 'const TinyB = () => <Box size="l" />;',
      }),
      makeEntry('RealA', [0, 0, 1], {
        logicTokens: ['fetch'],
        source: 'const RealA = () => { useEffect(); return <div />; };',
      }),
      makeEntry('RealB', [0, 0, 1], {
        logicTokens: ['fetch'],
        source: 'const RealB = () => { useEffect(); return <div />; };',
      }),
      makeEntry('WrapperC', [0, 0.5, 0.5], {
        isWrapper: true,
        props: { names: ['size'], spreads: 0 },
        jsxTags: ['Card'],
        literals: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
        source: 'export const WrapperC = () => <Card size="l" />;',
      }),
      makeEntry('WrapperD', [0, 0.5, 0.5], {
        isWrapper: true,
        props: { names: ['size'], spreads: 0 },
        jsxTags: ['Pane'],
        literals: ['1', '2', '3', '4', '5', '6', '7'],
        source: 'export const WrapperD = () => <Pane size="m" />;',
      }),
    ];
    const { pairs, scorecard } = findSimilarities(entries, {
      similarityThreshold: 0.9,
      highSimilarityThreshold: 0.95,
      limit: 3,
    });
    const pairIds = pairs.map((pair) => [pair.a, pair.b].sort().join('|'));
    expect(pairIds).toContain('RealA#RealA|RealB#RealB');
    expect(pairIds.length).toBe(1);
    expect(scorecard.suppressedPairs).toBe(3);
    expect(scorecard.suppressionReasons['wrapper-specialization']).toBe(2);
    expect(scorecard.suppressionReasons['low-signal-pair']).toBe(1);
  });

  it('suppresses wrappers that pin different base components', () => {
    const makeWrapper = (name, componentRef) => ({
      component: {
        id: `${name}#${name}`,
        name,
        filePath: `${name}.tsx`,
        props: { names: ['Component'], spreads: 0 },
        hooks: [],
        logicTokens: [],
        literals: [],
        jsxTags: ['Playground'],
        jsxPaths: [],
        textNodes: [],
        classNames: [],
        componentRefs: [componentRef],
        returnsCount: 1,
        styleImports: [],
        isWrapper: true,
        source: `export const ${name} = () => <Playground Component={${componentRef}} />;`,
      },
      vector: [0.9, 0.9],
      codeVec: [0.9, 0.9],
      styleVec: [0.9, 0.9],
      structureVec: [0.9, 0.9],
      holisticVec: [0.9, 0.9],
      hasStyles: false,
    });
    const { pairs, scorecard } = findSimilarities(
      [
        makeWrapper('TopAudioPlayerPlayground', 'TopAudioPlayer'),
        makeWrapper('TopAudioPlayerActionPlayground', 'TopAudioPlayerAction'),
      ],
      {
        similarityThreshold: 0.7,
        highSimilarityThreshold: 0.9,
        limit: 2,
      },
    );
    expect(pairs.length).toBe(0);
    expect(scorecard.suppressionReasons['wrapper-different-base']).toBe(1);
  });

  it('respects a maximum similarity threshold', () => {
    const makeEntry = (id, vector) => ({
      component: {
        id: `${id}#${id}`,
        name: id,
        filePath: `${id}.tsx`,
        props: { names: [], spreads: 0 },
        hooks: [],
        logicTokens: [],
        literals: [],
        jsxTags: [],
        jsxPaths: [],
        textNodes: [],
        classNames: [],
        returnsCount: 0,
        styleImports: [],
        isWrapper: false,
        source: '',
      },
      vector,
      codeVec: vector,
      styleVec: vector,
      structureVec: vector,
      holisticVec: vector,
      hasStyles: false,
    });
    const { pairs, scorecard } = findSimilarities(
      [makeEntry('HighA', [1, 0]), makeEntry('HighB', [1, 0])],
      {
        similarityThreshold: 0.5,
        highSimilarityThreshold: 0.9,
        maxSimilarityThreshold: 0.8,
        limit: 2,
      },
    );
    expect(pairs.length).toBe(0);
    expect(scorecard.suppressionReasons['over-max-threshold']).toBe(1);
  });

  it('suppresses direct composition relationships', () => {
    const makeEntry = (id, refs = []) => ({
      component: {
        id: `${id}#${id}`,
        name: id,
        filePath: `${id}.tsx`,
        props: { names: [], spreads: 0 },
        hooks: [],
        logicTokens: [],
        literals: [],
        jsxTags: [],
        jsxPaths: [],
        textNodes: [],
        classNames: [],
        componentRefs: refs,
        returnsCount: 0,
        styleImports: [],
        isWrapper: false,
        source: '',
      },
      vector: [1, 0],
      codeVec: [1, 0],
      styleVec: [1, 0],
      structureVec: [1, 0],
      holisticVec: [1, 0],
      hasStyles: false,
    });
    const { pairs, scorecard } = findSimilarities(
      [makeEntry('Parent', ['Child']), makeEntry('Child', [])],
      {
        similarityThreshold: 0.5,
        highSimilarityThreshold: 0.9,
        maxSimilarityThreshold: 1,
        limit: 2,
      },
    );
    expect(pairs.length).toBe(0);
    expect(scorecard.suppressionReasons['component-composition']).toBe(1);
  });

  it('skips pairs that are too close by path distance', () => {
    const makeEntry = (id, filePath) => ({
      component: {
        id: `${filePath}#${id}`,
        name: id,
        filePath,
        props: { names: [], spreads: 0 },
        hooks: [],
        logicTokens: [],
        literals: [],
        jsxTags: [],
        jsxPaths: [],
        textNodes: [],
        classNames: [],
        returnsCount: 0,
        styleImports: [],
        isWrapper: false,
        source: '',
      },
      vector: [1, 0],
      codeVec: [1, 0],
      styleVec: [1, 0],
      structureVec: [1, 0],
      holisticVec: [1, 0],
      hasStyles: false,
    });
    const { pairs, scorecard } = findSimilarities(
      [makeEntry('A', '/repo/ui/ButtonA.tsx'), makeEntry('B', '/repo/ui/ButtonB.tsx')],
      {
        similarityThreshold: 0.5,
        highSimilarityThreshold: 0.9,
        maxSimilarityThreshold: 1,
        minPathDistance: 1,
        limit: 2,
      },
    );
    expect(pairs.length).toBe(0);
    expect(scorecard.suppressionReasons['near-path']).toBe(1);

    const far = findSimilarities(
      [makeEntry('A', '/repo/ui/button/ButtonA.tsx'), makeEntry('B', '/repo/components/ButtonB.tsx')],
      {
        similarityThreshold: 0.5,
        highSimilarityThreshold: 0.9,
        maxSimilarityThreshold: 1,
        minPathDistance: 1,
        limit: 2,
      },
    );
    expect(far.pairs.length).toBe(1);
  });

  it('suppresses sparse components even when metadata is missing', () => {
    const makeEntry = (id) => ({
      component: {
        id: `${id}#${id}`,
        name: id,
        filePath: `${id}.tsx`,
        props: { spreads: 1 },
        hooks: undefined,
        logicTokens: undefined,
        literals: ['1', '2', '3', '4', '5', '6', '7'],
        jsxTags: undefined,
        jsxPaths: undefined,
        textNodes: undefined,
        classNames: undefined,
        returnsCount: 1,
        styleImports: [],
        isWrapper: false,
        source: '',
      },
      vector: [1, 1],
      codeVec: [1, 1],
      styleVec: [1, 1],
      structureVec: [1, 1],
      holisticVec: [1, 1],
      hasStyles: false,
    });
    const { pairs, scorecard } = findSimilarities([makeEntry('LooseA'), makeEntry('LooseB')], {
      similarityThreshold: 0.5,
      highSimilarityThreshold: 0.9,
      limit: 2,
    });
    expect(pairs.length).toBe(0);
    expect(scorecard.suppressedPairs).toBe(1);
    expect(scorecard.suppressionReasons['low-signal-pair']).toBe(1);
  });

  it('returns empty combined vector when weights are zeroed', async () => {
    const components = [baseComponent('Zero', 'zero')];
    const backend = { embed: vi.fn(async () => [1, 1, 1]) };
    const { entries } = await embedComponents(components, backend, {
      weight: { code: 0, style: 0, structure: 0, holistic: 0 },
      styleExtensions: [],
      root: process.cwd(),
      showProgress: false,
    });
    expect(entries[0].vector).toEqual([]);
  });

  it('ignores style weight when no style signal is present', async () => {
    const components = [
      {
        ...baseComponent('NoStyles', 'plain'),
        classNames: [],
        styleImports: [],
      },
    ];
    const backend = { embed: vi.fn(async () => [1, 0]) };
    const { entries } = await embedComponents(components, backend, {
      weight: { code: 1, style: 1, structure: 0, holistic: 0 },
      styleExtensions: [],
      root: process.cwd(),
      showProgress: false,
    });
    expect(entries[0].styleVec).toEqual([0, 0]);
    expect(entries[0].vector).toEqual([1, 0]);
  });

  it('keeps higher-signal long components in the report', () => {
    const longSource = new Array(20).fill('return <div />;').join('\n');
    const makeEntry = (id) => ({
      component: {
        id: `${id}#${id}`,
        name: id,
        filePath: `${id}.tsx`,
        props: { names: ['children'], spreads: 0 },
        hooks: [],
        logicTokens: [],
        literals: [],
        jsxTags: ['div'],
        jsxPaths: [],
        textNodes: [],
        classNames: [],
        returnsCount: 1,
        styleImports: [],
        isWrapper: false,
        source: longSource,
      },
      vector: [1, 0],
      codeVec: [1, 0],
      styleVec: [1, 0],
      structureVec: [1, 0],
      holisticVec: [1, 0],
      hasStyles: false,
    });
    const entries = [makeEntry('BigA'), makeEntry('BigB')];
    const { pairs, scorecard } = findSimilarities(entries, {
      similarityThreshold: 0.8,
      highSimilarityThreshold: 0.9,
      limit: 2,
    });
    expect(pairs.length).toBe(1);
    expect(scorecard.suppressedPairs).toBe(0);
  });

  it('keeps short components when they carry enough signal', () => {
    const makeEntry = (id) => ({
      component: {
        id: `${id}#${id}`,
        name: id,
        filePath: `${id}.tsx`,
        props: { names: ['value'], spreads: 0 },
        hooks: ['useEffect'],
        logicTokens: ['handleClick'],
        literals: ['ok'],
        jsxTags: ['Pane'],
        jsxPaths: [],
        textNodes: ['label'],
        classNames: ['rich'],
        returnsCount: 1,
        styleImports: [],
        isWrapper: false,
        source: 'const Comp = () => <Pane>text</Pane>;',
      },
      vector: [0.5, 0.5],
      codeVec: [0.5, 0.5],
      styleVec: [0.5, 0.5],
      structureVec: [0.5, 0.5],
      holisticVec: [0.5, 0.5],
      hasStyles: false,
    });
    const entries = [makeEntry('RichA'), makeEntry('RichB')];
    const { pairs, scorecard } = findSimilarities(entries, {
      similarityThreshold: 0.8,
      highSimilarityThreshold: 0.9,
      limit: 2,
    });
    expect(pairs.length).toBe(1);
    expect(scorecard.suppressedPairs).toBe(0);
  });

  it('filters pairs to compare targets when compare globs are provided', () => {
    const makeEntry = (id, filePath, isTarget) => ({
      component: {
        id: `${id}#${id}`,
        name: id,
        filePath,
        props: { names: [], spreads: 0 },
        hooks: [],
        logicTokens: [],
        literals: [],
        jsxTags: [],
        jsxPaths: [],
        textNodes: [],
        classNames: [],
        returnsCount: 0,
        styleImports: [],
        isWrapper: false,
        source: '',
        isCompareTarget: isTarget,
      },
      vector: [1, 0],
      codeVec: [1, 0],
      styleVec: [1, 0],
      structureVec: [1, 0],
      holisticVec: [1, 0],
      hasStyles: false,
    });
    const entries = [
      makeEntry('Changed', '/repo/ui/Changed.tsx', true),
      makeEntry('BaselineA', '/repo/ui/BaselineA.tsx', false),
      makeEntry('BaselineB', '/repo/ui/BaselineB.tsx', false),
      makeEntry('ChangedToo', '/repo/ui/ChangedToo.tsx', true),
    ];
    const { pairs, scorecard } = findSimilarities(entries, {
      similarityThreshold: 0.1,
      highSimilarityThreshold: 0.9,
      limit: 10,
      compareGlobs: ['**/Changed*.tsx'],
    });
    const ids = pairs.map((pair) => [pair.a, pair.b].sort().join('|'));
    expect(ids.some((pair) => pair.includes('Changed#Changed') && pair.includes('BaselineA#BaselineA'))).toBe(true);
    expect(ids.some((pair) => pair.includes('ChangedToo#ChangedToo') && pair.includes('BaselineB#BaselineB'))).toBe(true);
    expect(ids.some((pair) => pair.includes('BaselineA#BaselineA') && pair.includes('BaselineB#BaselineB'))).toBe(false);
    expect(ids.some((pair) => pair.includes('Changed#Changed') && pair.includes('ChangedToo#ChangedToo'))).toBe(false);
    expect(scorecard.suppressionReasons['compare-filter']).toBeGreaterThan(0);
  });

  it('upgrades partial cache entries and rebuilds structure vectors', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'duplicalis-partial-cache-'));
    const cachePath = path.join(dir, 'cache.json');
    const component = {
      ...baseComponent('Partial', 'export const Partial = () => <div />;'),
      filePath: path.join(dir, 'Partial.tsx'),
      jsxPaths: ['a>b>c>d>e>f>g'],
      textNodes: ['hello'],
    };
    const backend = { embed: vi.fn(async () => [1, 1, 1, 1]) };
    const config = {
      weight: { code: 1, style: 0 },
      styleExtensions: [],
      root: dir,
      cachePath,
      showProgress: false,
      cleanProbability: 0,
    };
    await embedComponents([component], backend, config);
    const cache = loadCache(cachePath);
    const key = Object.keys(cache.entries)[0];
    cache.entries[key] = { fingerprint: cache.entries[key].fingerprint, codeVec: [1, 1, 1, 1] };
    saveCache(cachePath, cache);
    backend.embed.mockClear();
    backend.embed.mockImplementation(async () => [2, 2, 2, 2]);

    await embedComponents([component], backend, config);
    expect(backend.embed).toHaveBeenCalledTimes(2);
  });
});
