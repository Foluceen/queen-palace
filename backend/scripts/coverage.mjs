import fs from 'node:fs';
const contract = fs.readFileSync(new URL('../../src/lib/api/contract.ts', import.meta.url), 'utf8');
const server = fs.readFileSync(new URL('../src/server.ts', import.meta.url), 'utf8');
const names = [...contract.matchAll(/^  (\w+): \{ method: "(GET|POST|PUT|PATCH|DELETE)", path: "([^"]+)"/gm)].map(m => ({name:m[1],method:m[2],path:m[3]}));
const implemented = new Set([...server.matchAll(/app\.(get|post|put|patch|delete)\(['"]([^'"]+)/gi)].map(m => `${m[1].toUpperCase()} ${m[2]}`));
const rows = names.map(x => ({...x, implemented: implemented.has(`${x.method} /v1${x.path}`)}));
const done = rows.filter(x=>x.implemented).length;
console.log(JSON.stringify({declared:names.length, implemented:done, missing:names.length-done, coveragePercent:Number((done/names.length*100).toFixed(2)), missingRoutes:rows.filter(x=>!x.implemented)},null,2));
