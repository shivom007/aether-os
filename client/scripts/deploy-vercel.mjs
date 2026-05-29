import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';

const middlewarePath = path.resolve(process.cwd(), 'middleware.ts');
const proxyPath = path.resolve(process.cwd(), 'proxy.ts');

console.log("🚀 Starting Vercel Pre-Deploy Script...");

// 1. Rename and replace content
let content = fs.readFileSync(middlewarePath, 'utf-8');
content = content.replace(/export async function middleware/g, 'export async function proxy');
fs.writeFileSync(proxyPath, content);
fs.unlinkSync(middlewarePath);
console.log("✅ Converted middleware.ts to proxy.ts");

try {
  // 2. Deploy
  console.log("☁️ Deploying to Vercel...");
  execSync('vercel --prod', { stdio: 'inherit' });
} catch (error) {
  console.error('❌ Vercel deployment failed.');
} finally {
  // 3. Restore
  console.log("🔄 Restoring middleware.ts...");
  fs.renameSync(proxyPath, middlewarePath);
  try {
    execSync('git restore middleware.ts', { stdio: 'ignore' });
  } catch (e) {
    // ignore if git restore fails
  }
  console.log("✅ Done!");
}
