const fs = require('fs');
const path = require('path');

const IGNORE_DIRS = new Set(['node_modules', '.git', '.next', 'dist', 'out']);
const EXTENSIONS = new Set(['.js', '.ts', '.tsx', '.go', '.css']);

let stats = {
  client: { files: 0, lines: 0 },
  server: { files: 0, lines: 0 },
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
  scan(path.join(__dirname, 'client'), 'client');
} catch (e) {}
try {
  scan(path.join(__dirname, 'server'), 'server');
} catch (e) {}

console.log('=== CODEBASE SCAN RESULTS ===');
console.log(`Client (React/TS): ${stats.client.files} files, ${stats.client.lines} lines of code`);
console.log(`Server (Go): ${stats.server.files} files, ${stats.server.lines} lines of code`);
console.log('\n--- Outstanding TODOs / FIXMEs ---');
stats.todos.forEach(t => console.log(t));
