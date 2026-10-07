import fs from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
// Run the deployed TypeScript helpers themselves under Node, without a Deno installation.
export async function sourceUrl(file) {
  let code = ts.transpileModule(await fs.readFile(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const imports = [...code.matchAll(/from ["'](\.\.?\/[^"']+\.ts)["']/g)];
  for (const match of imports) code = code.replace(match[1], await sourceUrl(path.resolve(path.dirname(file), match[1])));
  return `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
}
