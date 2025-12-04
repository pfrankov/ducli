const patternCache = new WeakMap();

export function compilePatterns(patterns = []) {
  return (patterns || [])
    .filter(Boolean)
    .map((pattern) => {
      try {
        return new RegExp(pattern);
      } catch (_e) {
        return null;
      }
    })
    .filter(Boolean);
}

export function shouldIgnoreComponent(component, config) {
  const { nameMatchers, usageMatchers } = getMatchers(config);
  if (matchesAny(component.name, nameMatchers)) return true;
  const usageTokens = collectUsageTokens(component);
  return usageTokens.some((token) => matchesAny(token, usageMatchers));
}

function getMatchers(config = {}) {
  const cached = patternCache.get(config);
  if (cached) return cached;
  const compiled = {
    nameMatchers: compilePatterns(config.ignoreComponentNamePatterns),
    usageMatchers: compilePatterns(config.ignoreComponentUsagePatterns),
  };
  patternCache.set(config, compiled);
  return compiled;
}

function collectUsageTokens(component) {
  const tags = Array.isArray(component.jsxTags) ? component.jsxTags : [];
  const refs = Array.isArray(component.componentRefs) ? component.componentRefs : [];
  return [...tags, ...refs].filter(Boolean);
}

function matchesAny(value, matchers) {
  if (!value || !matchers.length) return false;
  return matchers.some((re) => re.test(value));
}
