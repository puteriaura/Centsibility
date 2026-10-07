import fs from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
// Run the deployed TypeScript helpers themselves under Node, without a Deno installation.
export async function sourceUrl(file) {
  let code = ts.transpileModule(await fs.readFile(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const imports = [...code.matchAll(/from ["'](\.\.?\/[^"']+\.ts)["']/g)];
  for (const match of imports) code = code.replace(match[1], await sourceUrl(path.resolve(path.dirname(file), match[1])));
  for (const match of [...code.matchAll(/from ["'](npm:([^"']+))["']/g)]) code = code.replace(match[1], pathToFileURL(require.resolve(match[2].replace(/@\d[^@]*$/, ''))).href);
  return `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
}
