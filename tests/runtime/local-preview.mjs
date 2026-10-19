import path from 'node:path';
import { spawn } from 'node:child_process';

/** Only local synthetic checks; tolerate cold root compilation without changing ports. */
export async function localPreview(base = 'http://127.0.0.1:3000') {
  const url = new URL(base);
  if (!['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('Local preview required');
  const available = async () => { try { return (await fetch(base, { signal: AbortSignal.timeout(10000) })).ok; } catch { return false; } };
  if (await available()) return () => {};
  const server = spawn(process.execPath, [path.resolve('node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', url.port || '3000', '--strictPort'], { cwd: process.cwd(), windowsHide: true, stdio: 'ignore' });
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    if (await available()) return () => { if (server.exitCode === null) server.kill(); };
    // An existing server may own the exact port and still be compiling.
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (server.exitCode === null) server.kill();
  throw new Error('Local preview did not become available within 120 seconds');
}
