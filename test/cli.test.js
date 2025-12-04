import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, it, expect } from 'vitest';
import { runCli } from '../src/cli.js';

describe('cli', () => {
  it('runs with mock model adapter and writes report', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'duplicalis-cli-'));
    const out = path.join(dir, 'cli-report.json');
    await runCli(['node', 'duplicalis', 'scan', '--cmd', 'examples', '--model', 'mock', '--out', out, '--threshold', '0.8', '--limit', '1']);
    expect(fs.existsSync(out)).toBe(true);
  });

  it('accepts positional path as cmd', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'duplicalis-cli-'));
    const out = path.join(dir, 'cli-report.json');
    await runCli(['node', 'duplicalis', 'scan', 'examples', '--model', 'mock', '--out', out, '--limit', '1']);
    expect(fs.existsSync(out)).toBe(true);
  });

  it('accepts bare positional path without command', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'duplicalis-cli-'));
    const out = path.join(dir, 'cli-report.json');
    await runCli(['node', 'duplicalis', 'examples', '--model', 'mock', '--out', out, '--limit', '1']);
    expect(fs.existsSync(out)).toBe(true);
  });

  it('shows help command', async () => {
    const write = process.stdout.write;
    process.stdout.write = () => true;
    await runCli(['node', 'duplicalis', 'help']);
    process.stdout.write = write;
  });

  it('falls back to cwd when no path provided', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'duplicalis-cli-'));
    const out = path.join(dir, 'cli-report.json');
    await runCli(['node', 'duplicalis', 'scan', '--model', 'mock', '--out', out, '--limit', '1']);
    expect(fs.existsSync(out)).toBe(true);
  });

  it('persists config when --save-config is passed', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'duplicalis-cli-'));
    const out = path.join(dir, 'cli-report.json');
    const configPath = path.join(dir, 'duplicalis.config.json');
    await runCli([
      'node',
      'duplicalis',
      'scan',
      'examples',
      '--model',
      'mock',
      '--out',
      out,
      '--limit',
      '1',
      '--save-config',
      configPath,
    ]);
    const saved = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    expect(saved.model).toBe('mock');
    expect(saved.limit).toBe(1);

    const relRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'duplicalis-cli-rel-'));
    const relReport = path.join(relRoot, 'cli-report.json');
    await runCli([
      'node',
      'duplicalis',
      'scan',
      '--cmd',
      relRoot,
      '--model',
      'mock',
      '--out',
      relReport,
      '--limit',
      '1',
      '--save-config',
      'configs/duplicalis.config.json',
    ]);
    expect(fs.existsSync(path.join(relRoot, 'configs/duplicalis.config.json'))).toBe(true);

    const flagOnlyRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'duplicalis-cli-flag-'));
    await runCli([
      'node',
      'duplicalis',
      'scan',
      '--cmd',
      flagOnlyRoot,
      '--model',
      'mock',
      '--limit',
      '1',
      '--save-config',
    ]);
    expect(fs.existsSync(path.join(flagOnlyRoot, 'duplicalis.config.json'))).toBe(true);
  });
});
