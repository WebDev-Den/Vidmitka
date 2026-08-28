// Generates non-secret source fingerprints for the independent QA batch.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
const base = '58a3f9151b56041f0e4feebf558ce7a160fe6c4f';
const git = (...args) => execFileSync('git', ['-c', 'core.quotepath=false', '-c', 'core.safecrlf=false', ...args], { encoding: 'utf8' });
const files = [...new Set([...git('diff', '--name-only', base).trim().split('\n'), ...git('ls-files', '--others', '--exclude-standard').trim().split('\n')])]
  .filter(p => p && !p.startsWith('info/qa/') && p !== 'info/tasks.md' && !/(^|\/)(\.env|\.next|\.vercel)|tsbuildinfo$/.test(p)).sort();
const rows = files.map(path => ({path, sha256: createHash('sha256').update(readFileSync(path)).digest('hex')}));
const aggregate = createHash('sha256').update(rows.map(r => `${r.path}\0${r.sha256}\n`).join('')).digest('hex');
const dir = 'info/qa/artifacts/QA-20260828-01';
mkdirSync(dir, {recursive:true});
const result = {base, head:git('rev-parse','HEAD').trim(), date:new Date().toISOString(), aggregate, files:rows, status:git('status','--short')};
writeFileSync(`${dir}/fingerprint-${process.argv[2] ?? 'initial'}.json`, JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({aggregate, files:rows.length, head:result.head}));
