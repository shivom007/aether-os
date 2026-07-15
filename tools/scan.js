const fs = require('fs');
const path = require('path');

const IGNORE_DIRS = new Set(['node_modules', '.git', '.next', 'dist', 'out']);
const EXTENSIONS = new Set(['.js', '.ts', '.tsx', '.go', '.css']);

let stats = {
  web: { files: 0, lines: 0 },
  api: { files: 0, lines: 0 },
  todos: []
};

function scan(dir, type) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      if (!IGNORE_DIRS.has(file)) {
        scan(fullPath, type);
      }
    } else {
      const ext = path.extname(file);
      if (EXTENSIONS.has(ext)) {
        stats[type].files++;
        const content = fs.readFileSync(fullPath, 'utf8');
        const lines = content.split('\n');
        stats[type].lines += lines.length;
        
        lines.forEach((line, index) => {
          if (line.includes('TODO') || line.includes('FIXME') || line.includes('HACK')) {
            stats.todos.push(`${fullPath}:${index + 1} - ${line.trim()}`);
          }
        });
      }
    }
  }
}

try {
  scan(path.join(__dirname, '..', 'apps', 'web'), 'web');
} catch (e) {}
try {
  scan(path.join(__dirname, '..', 'services', 'api'), 'api');
} catch (e) {}

console.log('=== CODEBASE SCAN RESULTS ===');
console.log(`Web (React/TS): ${stats.web.files} files, ${stats.web.lines} lines of code`);
console.log(`API (Go): ${stats.api.files} files, ${stats.api.lines} lines of code`);
console.log('\n--- Outstanding TODOs / FIXMEs ---');
stats.todos.forEach(t => console.log(t));
