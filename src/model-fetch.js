import fs from 'fs';
import path from 'path';
import https from 'https';
import cliProgress from 'cli-progress';

const DEFAULT_FILES = [
  'config.json',
  'tokenizer.json',
  'tokenizer_config.json',
  'special_tokens_map.json',
  'vocab.txt',
  'onnx/model_quantized.onnx',
];

export async function ensureModel(modelDir, modelRepo, showProgress = true) {
  if (!modelDir) throw new Error('Model path is required for download.');
  const targetDir = path.resolve(modelDir);
  fs.mkdirSync(targetDir, { recursive: true });

  const missing = DEFAULT_FILES.filter((file) => !fs.existsSync(path.join(targetDir, file)));
  if (!missing.length) return;

  const bar = showProgress
    ? new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic)
    : null;
  if (bar) bar.start(missing.length, 0);

  let completed = 0;
  for (const file of missing) {
    const url = `${modelRepo}/${file}`;
    const dest = path.join(targetDir, file);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    await downloadFile(url, dest);
    completed += 1;
    if (bar) bar.update(completed);
  }
  if (bar) bar.stop();
}

function downloadFile(url, dest, redirectCount = 0) {
  const MAX_REDIRECTS = 5;
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, (res) => {
        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          file.close();
          fs.unlink(dest, () => {
            if (redirectCount >= MAX_REDIRECTS) {
              reject(new Error(`Too many redirects while downloading ${url}`));
              return;
            }
            const nextUrl = new URL(res.headers.location, url).toString();
            resolve(downloadFile(nextUrl, dest, redirectCount + 1));
          });
          return;
        }
        if (res.statusCode !== 200) {
          file.close();
          fs.unlink(dest, () => reject(new Error(`Failed to download ${url}: ${res.statusCode}`)));
          return;
        }
        res.pipe(file);
        file.on('finish', () => {
          file.close(resolve);
        });
      })
      .on('error', (err) => {
        file.close();
        fs.unlink(dest, () => reject(err));
      });
  });
}
