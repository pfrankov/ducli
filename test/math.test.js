import { describe, it, expect } from 'vitest';
import { cosine, normalize } from '../src/math.js';

describe('math helpers', () => {
  it('handles zero vectors safely', () => {
    const vec = normalize([0, 0, 0]);
    expect(vec.every((v) => v === 0)).toBe(true);
    expect(cosine([0, 0], [0, 0])).toBe(0);
  });
});
