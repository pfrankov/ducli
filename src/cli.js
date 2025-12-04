import { Command } from 'commander';
import dotenv from 'dotenv';
import path from 'path';
import { pathToFileURL } from 'url';
import { loadConfig, resolveConfigPath, saveConfigFile } from './config.js';
import { run } from './index.js';

dotenv.config();

export function createProgram() {
  const program = new Command();
  program
    .name('duplicalis')
    .description('Detect duplicate or near-duplicate React components (code + styles)');

  program
    .command('help')
    .description('Show help')
    .action(() => {
      program.outputHelp();
    });

  const scan = program
    .command('scan', { isDefault: true })
    .description('Scan for duplicate or near-duplicate components')
    .argument('[target]', 'Path to scan (defaults to cwd; positional treated as --cmd)')
    .option('-c, --cmd <path>', 'Root path to scan')
    .option('-o, --out <path>', 'Output JSON path')
    .option('--include <globs...>', 'Include globs')
    .option('--exclude <globs...>', 'Exclude globs')
    .option('--threshold <number>', 'Similarity threshold', parseFloat)
    .option(
      '--high-threshold <number>',
      'High similarity threshold (labels almost-identical)',
      parseFloat
    )
    .option('--max-threshold <number>', 'Maximum similarity to include in the report', parseFloat)
    .option('--limit <number>', 'Max matches per component', parseInt)
    .option('--model <model>', 'Embedding model adapter: local|remote|mock')
    .option('--model-path <path>', 'Local model path')
    .option('--model-repo <url>', 'Model repo base URL for auto-download')
    .option('--auto-download-model', 'Download model files automatically if missing')
    .option('--cache-path <path>', 'Path for embedding cache file')
    .option('--no-progress', 'Disable console progress bars')
    .option('--api-url <url>', 'Remote API URL')
    .option('--api-key <key>', 'Remote API key')
    .option('--api-model <name>', 'Remote API model name')
    .option('--api-timeout <ms>', 'Remote API timeout', parseInt)
    .option('--disable-analyses <list...>', 'Disable analyses (e.g. style-duplicate)')
    .option('--style-extensions <list...>', 'Style extensions to include')
    .option('--ignore-component-name <patterns...>', 'Regex patterns to drop components by name')
    .option(
      '--ignore-component-usage <patterns...>',
      'Regex patterns; drop components that render matching components'
    )
    .option('--relative-paths', 'Show paths relative to root instead of absolute')
    .option(
      '--min-path-distance <number>',
      'Minimum directory distance between reported pairs',
      parseInt
    )
    .option('--compare <globs...>', 'Limit matches to comparisons involving these files/globs')
    .option('--config <path>', 'Config file path')
    .option(
      '--save-config [path]',
      'Persist the current run configuration to duplicalis.config.json or the provided path'
    )
    .option('--no-ignores', 'Disable file/component ignore markers')
    .action(async (target, opts) => {
      const rootArg = opts.cmd || target || process.cwd();
      const resolvedRoot = path.resolve(rootArg);
      const configPath = resolveConfigPath(resolvedRoot, opts.config);
      const cliOptions = {
        root: resolvedRoot,
        out: opts.out,
        include: opts.include,
        exclude: opts.exclude,
        similarityThreshold: opts.threshold,
        highSimilarityThreshold: opts.highThreshold,
        maxSimilarityThreshold: opts.maxThreshold,
        limit: opts.limit,
        model: opts.model,
        modelPath: opts.modelPath,
        modelRepo: opts.modelRepo,
        autoDownloadModel: opts.autoDownloadModel,
        cachePath: opts.cachePath,
        showProgress: opts.progress,
        disableAnalyses: opts.disableAnalyses,
        styleExtensions: opts.styleExtensions,
        allowIgnores: opts.ignores,
        ignoreComponentNamePatterns: opts.ignoreComponentName,
        ignoreComponentUsagePatterns: opts.ignoreComponentUsage,
        relativePaths: opts.relativePaths,
        minPathDistance: opts.minPathDistance,
        compareGlobs: opts.compare,
        remote: {
          url: opts.apiUrl,
          apiKey: opts.apiKey,
          model: opts.apiModel,
          timeoutMs: opts.apiTimeout,
        },
      };
      const config = loadConfig({ ...cliOptions, config: configPath });
      if (opts.saveConfig !== undefined) {
        const provided = typeof opts.saveConfig === 'string' ? opts.saveConfig : null;
        const targetPath = provided
          ? path.isAbsolute(provided)
            ? provided
            : path.resolve(resolvedRoot, provided)
          : configPath;
        const savedPath = saveConfigFile(config, targetPath);
        config.configPath = savedPath;
        config.configSaved = true;
      } else {
        config.configPath = configPath;
      }
      await run(config);
    });

  program.addCommand(scan);
  return program;
}

export async function runCli(argv = process.argv) {
  const program = createProgram();
  await program.parseAsync(argv);
  return program;
}

/* v8 ignore start -- only exercised when invoked as a standalone binary */
const invokedDirectly = import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  runCli().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
/* v8 ignore stop */
