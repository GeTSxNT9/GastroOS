const fs = require('node:fs');
const path = require('node:path');
const cssPath = path.join(__dirname, '..', 'css', 'gastroos.css');
const css = fs.readFileSync(cssPath, 'utf8');
const counts = new Map();
const re = /([^{}]+)\{[^{}]*\}/g;
let match;
while ((match = re.exec(css))) {
  const selector = match[1].trim().replace(/\s+/g, ' ');
  if (!selector || selector.startsWith('@') || selector.includes('\n')) continue;
  counts.set(selector, (counts.get(selector) || 0) + 1);
}
const repeated = [...counts.entries()].filter(([, count]) => count > 1).sort((a, b) => b[1] - a[1]);
console.log(`Reglas CSS analizadas: ${counts.size}`);
console.log(`Selectores repetidos detectados: ${repeated.length}`);
for (const [selector, count] of repeated.slice(0, 40)) console.log(`${count}x ${selector}`);
console.log('\nNota: las repeticiones pueden ser overrides intencionados; revisar antes de eliminar reglas para no alterar el diseño.');
