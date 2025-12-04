import { describe, it, expect } from 'vitest';
import { buildRepresentation } from '../src/representation.js';

const baseComponent = (overrides = {}) => ({
  name: 'Comp',
  filePath: 'Comp.tsx',
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
  ...overrides,
});

describe('representation', () => {
  it('handles missing structural data and empty source', () => {
    const component = baseComponent({ jsxPaths: undefined, textNodes: undefined });
    const rep = buildRepresentation(component, '');
    expect(rep.structureRep.includes('VDOM PATHS none')).toBe(true);
    expect(rep.holisticRep.includes('STYLE')).toBe(false);
  });

  it('captures styles, truncates paths, and normalizes long text nodes', () => {
    const component = baseComponent({
      jsxPaths: ['a>b>c>d>e>f>g'],
      textNodes: ['short text', 'lorem ipsum dolor sit amet, consectetur adipiscing elit'],
      classNames: ['box'],
      source: 'export const Comp = () => <div className="box">hello</div>;',
    });
    const rep = buildRepresentation(component, '.box { color: red; }');
    expect(rep.structureRep.includes('a>b...f>g')).toBe(true);
    expect(rep.structureRep.includes('lorem ipsum dolor sit amet')).toBe(true);
    expect(rep.holisticRep.includes('STYLE')).toBe(true);
  });
});
