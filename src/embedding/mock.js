export class MockEmbeddingBackend {
  constructor(dimension = 64) {
    this.dimension = dimension;
  }

  async embed(text) {
    const vector = new Array(this.dimension).fill(0);
    const tokens = text.toLowerCase().split(/\W+/).filter(Boolean);
    tokens.forEach((token, index) => {
      const hash = simpleHash(token + index);
      const slot = hash % this.dimension;
      vector[slot] += 1;
    });
    return normalize(vector);
  }
}

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function normalize(vector) {
  /* v8 ignore next */
  const norm = Math.sqrt(vector.reduce((acc, val) => acc + val * val, 0)) || 1;
  return vector.map((v) => v / norm);
}
