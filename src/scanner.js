import fg from 'fast-glob';
import path from 'path';

export async function findSourceFiles(config) {
  /* v8 ignore next */
  const patterns =
    config.include && config.include.length ? config.include : ['**/*.{ts,tsx,js,jsx}'];
  /* v8 ignore next */
  const ignore = [...(config.exclude || [])];
  const files = await fg(patterns, {
    cwd: config.root,
    ignore,
    onlyFiles: true,
    absolute: true,
  });
  return files.map((file) => path.resolve(file));
}
