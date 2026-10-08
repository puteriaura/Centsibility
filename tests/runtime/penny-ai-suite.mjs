// Run actual server helper tests offline; this is a Node shim, not a Deno deployment.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';
import { sourceUrl } from './source-loader.mjs';
const cases=[];
globalThis.Deno={env:{get:()=>undefined},test:(name,fn)=>cases.push({name,fn})};
globalThis.pennyTestAssert={assertEquals:assert.deepEqual,assertNotEquals:assert.notDeepEqual,assertThrows:assert.throws};
let source=await fs.readFile('supabase/functions/_shared/penny-ai_test.ts','utf8');
source=source.replace(/import \{ assertEquals, assertNotEquals, assertThrows \} from [^;]+;/,'const {assertEquals,assertNotEquals,assertThrows}=globalThis.pennyTestAssert;');
source=source.replace('./penny-ai.ts',await sourceUrl('supabase/functions/_shared/penny-ai.ts'));
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
try {
  await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
  for(const test of cases){try { await test.fn();console.log('PASS',test.name) } catch(error) { throw new Error(test.name+': '+error.message) }}
  console.log(`PASS ${cases.length} server helper tests (Node shim)`);
} catch(error){console.error(error.name+': '+error.message);process.exitCode=1}
