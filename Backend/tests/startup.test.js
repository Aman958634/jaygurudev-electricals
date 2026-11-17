import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

const backendDirectory = fileURLToPath(new URL('../', import.meta.url));

test('occupied port exits cleanly with an actionable EADDRINUSE message', async () => {
  const occupiedServer = createServer();
  await new Promise((resolve, reject) => {
    occupiedServer.once('error', reject);
    occupiedServer.listen(0, resolve);
  });
  const { port } = occupiedServer.address();
  let output = '';

  try {
    const result = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ['server.js'], {
        cwd: backendDirectory,
        env: { ...process.env, PORT: String(port) },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      child.stdout.setEncoding('utf8').on('data', (chunk) => { output += chunk; });
      child.stderr.setEncoding('utf8').on('data', (chunk) => { output += chunk; });
      child.once('error', reject);
      child.once('exit', (code, signal) => resolve({ code, signal }));
    });

    assert.equal(result.code, 1);
    assert.equal(result.signal, null);
    assert.match(output, new RegExp(`port ${port} is already in use`, 'i'));
    assert.doesNotMatch(output, /Error: listen EADDRINUSE|^\s+at /m);
  } finally {
    await new Promise((resolve) => occupiedServer.close(resolve));
  }
});
