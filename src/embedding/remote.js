export class RemoteEmbeddingBackend {
  constructor(config) {
    this.url = config.url;
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.timeoutMs = config.timeoutMs || 15000;
    if (!this.url || !this.apiKey) {
      throw new Error('Remote embedding requires API_URL and API_KEY.');
    }
  }

  async embed(text) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const payload = { model: this.model, input: text, prompt: text };
      const response = await fetch(this.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(`Remote embedding failed: ${response.status} ${message}`);
      }
      const data = await response.json();
      const embedding = data?.data?.[0]?.embedding || data?.embedding;
      if (!embedding) throw new Error('Remote embedding response missing embedding.');
      return normalize(embedding);
    } finally {
      clearTimeout(timeout);
    }
  }
}

function normalize(vector) {
  const norm = Math.sqrt(vector.reduce((acc, val) => acc + val * val, 0)) || 1;
  return vector.map((v) => v / norm);
}
