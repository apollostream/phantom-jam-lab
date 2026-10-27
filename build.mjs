// Inline the engine into the app and emit the artifact page (dist/phantom-jam-lab.html, published to
// claude.ai) plus a standalone copy (dist/index.html, deployed to GitHub Pages).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const engine = readFileSync('src/engine.js', 'utf8');
const app = readFileSync('src/app.html', 'utf8').replace('/*__ENGINE__*/', () => engine);
mkdirSync('dist', { recursive: true });
writeFileSync('dist/phantom-jam-lab.html', app);
writeFileSync('dist/index.html',
  '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n' +
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' +
  // The artifact host supplies this reset; the standalone page (GitHub Pages) carries its own.
  '<style>body { margin: 0; } img { max-width: 100%; }</style>\n' +
  '</head>\n<body>\n' + app + '\n</body>\n</html>\n');
console.log(`built dist/ (${(app.length / 1024).toFixed(1)} KB)`);
