// Run the existing Deno helper suite under Node using only an assertion/test shim.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';
import { sourceUrl } from './source-loader.mjs';
const cases=[];
globalThis.Deno={env:{get:()=>''},test:(name,fn)=>cases.push({name,fn})};
globalThis.marketTestAssert={assertEquals:assert.deepEqual,assertNotEquals:assert.notDeepEqual,assert};
let source=await fs.readFile('supabase/functions/_shared/market_test.ts','utf8');
source=source.replace(/import \{ assertEquals, assertNotEquals, assert \} from [^;]+;/,'const {assertEquals,assertNotEquals,assert}=globalThis.marketTestAssert;');
source=source.replace('./market.ts',await sourceUrl('supabase/functions/_shared/market.ts'));
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
for(const test of cases){await test.fn();console.log('PASS',test.name)}
console.log(`PASS ${cases.length} existing Market helper cases (Node assertion/test shim, not Deno runtime)`);
