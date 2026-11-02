// Postavi varijable okruženja pa pokreni naredbu (radi isto na Windowsu i Linuxu, bez cross-env).
// Primjer: node scripts/with-env.mjs A=1 B=2 -- npm run build
import { spawn } from 'node:child_process';

const args = process.argv.slice(2);
const sep = args.indexOf('--');
if (sep < 1) {
  console.error('Upotreba: node scripts/with-env.mjs IME=vrijednost ... -- naredba');
  process.exit(2);
}
const env = { ...process.env };
for (const pair of args.slice(0, sep)) {
  const i = pair.indexOf('=');
  env[pair.slice(0, i)] = pair.slice(i + 1);
}
const [cmd, ...rest] = args.slice(sep + 1);
const child = spawn(cmd, rest, { stdio: 'inherit', env, shell: process.platform === 'win32' });
child.on('exit', (code) => process.exit(code ?? 1));
