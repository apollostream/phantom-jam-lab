// Inline the engine into the app and emit the artifact page plus a standalone copy.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const engine = readFileSync('src/engine.js', 'utf8');
const app = readFileSync('src/app.html', 'utf8').replace('/*__ENGINE__*/', () => engine);
mkdirSync('dist', { recursive: true });
writeFileSync('dist/phantom-jam-lab.html', app);
writeFileSync('dist/index.html',
  '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n' +
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' +
  '</head>\n<body>\n' + app + '\n</body>\n</html>\n');
console.log(`built dist/ (${(app.length / 1024).toFixed(1)} KB)`);
