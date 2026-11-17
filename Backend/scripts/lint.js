import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const backendDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ignoredDirectories = new Set(['node_modules', 'uploads', '.git']);
const javascriptFiles = [];

async function collectJavaScriptFiles(directory) {
  const entries = await readdir(directory);
  for (const entry of entries) {
    const fullPath = path.join(directory, entry);
    const fileInfo = await stat(fullPath);
    if (fileInfo.isDirectory()) {
      if (!ignoredDirectories.has(entry)) await collectJavaScriptFiles(fullPath);
    } else if (entry.endsWith('.js')) {
      javascriptFiles.push(fullPath);
    }
  }
}

await collectJavaScriptFiles(backendDirectory);
let hasErrors = false;
for (const file of javascriptFiles) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    hasErrors = true;
    process.stderr.write(`${path.relative(backendDirectory, file)}\n${result.stderr}`);
  }
}

if (hasErrors) process.exitCode = 1;
else console.log(`Syntax check passed for ${javascriptFiles.length} backend JavaScript files.`);
