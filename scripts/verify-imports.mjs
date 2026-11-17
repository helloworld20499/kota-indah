import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const IMPORT_RE = /(?:import|export)\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

const importMap = {};
const htmlPath = path.join(ROOT, 'index.html');
if (fs.existsSync(htmlPath)) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const mapMatch = html.match(/<script\s+type="importmap"[^>]*>([\s\S]*?)<\/script>/i);
  if (mapMatch) {
    try {
      const parsed = JSON.parse(mapMatch[1]);
      Object.assign(importMap, parsed.imports || {});
    } catch (err) {
      console.error('Invalid importmap JSON in index.html:', err.message);
      process.exit(1);
    }
  }
}

// Verify importmap targets exist
const missing = [];
for (const [spec, target] of Object.entries(importMap)) {
  if (spec.endsWith('/')) {
    const dirPath = path.resolve(ROOT, target);
    if (!fs.existsSync(dirPath)) missing.push({ from: 'index.html (importmap)', spec, resolved: dirPath });
  } else {
    const filePath = path.resolve(ROOT, target);
    if (!fs.existsSync(filePath)) missing.push({ from: 'index.html (importmap)', spec, resolved: filePath });
  }
}

function walkJs(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkJs(full, out);
    else if (entry.name.endsWith('.js') || entry.name.endsWith('.mjs')) out.push(full);
  }
  return out;
}

function resolveImportMap(spec) {
  if (importMap[spec]) return path.resolve(ROOT, importMap[spec]);
  for (const [k, v] of Object.entries(importMap)) {
    if (k.endsWith('/') && spec.startsWith(k)) {
      return path.resolve(ROOT, v + spec.slice(k.length));
    }
  }
  return null;
}

const filesToScan = [
  ...walkJs(path.join(ROOT, 'src')),
  ...walkJs(path.join(ROOT, 'vendor', 'three')),
];

let checked = 0;
for (const file of filesToScan) {
  const code = fs.readFileSync(file, 'utf8');
  IMPORT_RE.lastIndex = 0;
  let m;
  while ((m = IMPORT_RE.exec(code)) !== null) {
    const spec = m[1] || m[2];
    if (!spec) continue;
    checked++;
    if (spec.startsWith('./') || spec.startsWith('../')) {
      const resolved = path.resolve(path.dirname(file), spec);
      if (!fs.existsSync(resolved)) {
        missing.push({ from: path.relative(ROOT, file), spec, resolved: path.relative(ROOT, resolved) });
      }
    } else {
      const mapped = resolveImportMap(spec);
      if (!mapped || !fs.existsSync(mapped)) {
        missing.push({ from: path.relative(ROOT, file), spec, resolved: mapped || 'UNMAPPED_BARE_SPECIFIER' });
      }
    }
  }
}

// Check index.html script src references in src/
if (fs.existsSync(htmlPath)) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const scriptRe = /<script[^>]+src="([^"]+)"/g;
  let sm;
  while ((sm = scriptRe.exec(html)) !== null) {
    const src = sm[1];
    if (!src.startsWith('http')) {
      const resolved = path.resolve(ROOT, src);
      checked++;
      if (!fs.existsSync(resolved)) {
        missing.push({ from: 'index.html', spec: src, resolved: path.relative(ROOT, resolved) });
      }
    }
  }
}

if (missing.length) {
  console.error(`Missing imports (${missing.length}):`);
  for (const item of missing) {
    console.error(`  - [${item.from}] "${item.spec}" -> ${item.resolved}`);
  }
  process.exit(1);
}

console.log(`OK: verified ${filesToScan.length} files and ${checked} imports, 0 missing.`);
