import fs from 'node:fs';
const contract=fs.readFileSync(new URL('../../src/lib/api/contract.ts',import.meta.url),'utf8');
const server=fs.readFileSync(new URL('../src/server.ts',import.meta.url),'utf8');
const rows=[...contract.matchAll(/^  (\w+): \{ method: "(GET|POST|PUT|PATCH|DELETE)", path: "([^"]+)"/gm)].map(m=>({name:m[1],method:m[2],path:m[3],purpose:m[1].replace(/[A-Z]/g,m=>' '+m.toLowerCase()).trim(),authentication:/admin/i.test(m[1])?'admin session':/customer|cart|checkout|order/i.test(m[1])?'customer session or token':'public',authorization:/admin/i.test(m[1])?'server-side role/permission':/customer|cart|checkout|order/i.test(m[1])?'object ownership or access token':'none',implementationFile:'backend/src/server.ts',implemented:new RegExp(`app\\.(get|post|put|patch|delete)\\(['\"]\\/v1${m[3].replace(/[.*+?^${}()|[\\]\\\\]/g,'\\$&')}`).test(server),tests:'backend/test/integration.sh or backend/test/*.test.js'}));
fs.writeFileSync(new URL('../endpoint-inventory.json',import.meta.url),JSON.stringify({generatedAt:new Date().toISOString(),source:'src/lib/api/contract.ts',endpoints:rows},null,2)+'\n');
console.log(`wrote endpoint-inventory.json (${rows.length} endpoints)`);
