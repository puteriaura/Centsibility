import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { openDb } from './harness.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const files = fs.readdirSync(__dirname)
    .filter((f) => f.endsWith('.test.mjs'))
    .sort();

  const includeDeferred = process.argv.includes("--include-deferred");
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  for (const file of files) {
    const fullPath = path.join(__dirname, file);
    const mod = await import(pathToFileURL(fullPath).href);
    if (!mod.tests || !Array.isArray(mod.tests)) {
      console.warn(`Skipping ${file}: no tests array exported`);
      continue;
    }

    const tests = mod.tests.filter((test) => includeDeferred || !test.requiresDeferred);
    if (tests.length === 0) continue;
    const db = await openDb({ includeDeferred });

    for (const test of tests) {
      totalTests++;
      try {
        await test.fn(db);
        console.log(`PASS ${file} > ${test.name}`);
        passedTests++;
      } catch (err) {
        console.error(`FAIL ${file} > ${test.name}`);
        console.error(err);
        failedTests++;
      }
    }
    await db.close();
  }

  console.log(`\nSummary: ${passedTests} passed, ${failedTests} failed, ${totalTests} total`);
  if (failedTests > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal harness error:', err);
  process.exit(1);
});
