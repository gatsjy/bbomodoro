// Builds release/ artifacts:
//   Bbomodoro-Windows.exe      single-file exe (resources embedded)
//   Bbomodoro-macOS.tar.gz     Bbomodoro.app (universal: Intel + Apple Silicon)
// tar.gz is used for macOS so the executable bit survives packaging on Windows.
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist', 'bbomodoro');
const OUT = path.join(ROOT, 'release');
const cfg = require(path.join(ROOT, 'neutralino.config.json'));
const run = (cmd) => execSync(cmd, { cwd: ROOT, stdio: 'inherit' });

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

run('node tools/make-icon.js');

// Windows: one self-contained exe
run('npx neu build --release --embed-resources');
fs.copyFileSync(path.join(DIST, 'bbomodoro-win_x64.exe'), path.join(OUT, 'Bbomodoro-Windows.exe'));

// macOS: untouched (signed) universal binary + resources.neu inside an .app
run('npx neu build --release');

const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>Bbomodoro</string>
  <key>CFBundleDisplayName</key><string>Bbomodoro</string>
  <key>CFBundleIdentifier</key><string>${cfg.applicationId}</string>
  <key>CFBundleVersion</key><string>${cfg.version}</string>
  <key>CFBundleShortVersionString</key><string>${cfg.version}</string>
  <key>CFBundleExecutable</key><string>launch</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>LSMinimumSystemVersion</key><string>10.13</string>
  <key>NSHighResolutionCapable</key><true/>
</dict>
</plist>
`;
const launcher = `#!/bin/sh
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"
exec "$DIR/bbomodoro" --path="$DIR"
`;

const app = 'Bbomodoro.app/Contents';
const entries = [
  { name: 'Bbomodoro.app/', dir: true },
  { name: app + '/', dir: true },
  { name: app + '/MacOS/', dir: true },
  { name: app + '/Resources/', dir: true },
  { name: app + '/Info.plist', data: Buffer.from(plist) },
  { name: app + '/MacOS/launch', data: Buffer.from(launcher), exec: true },
  { name: app + '/MacOS/bbomodoro', data: fs.readFileSync(path.join(DIST, 'bbomodoro-mac_universal')), exec: true },
  { name: app + '/MacOS/resources.neu', data: fs.readFileSync(path.join(DIST, 'resources.neu')) },
  { name: app + '/Resources/AppIcon.png', data: fs.readFileSync(path.join(ROOT, 'resources', 'icons', 'appIcon.png')) }
];

function tarHeader(e) {
  const h = Buffer.alloc(512);
  h.write(e.name, 0, 100, 'utf8');
  const oct = (n, len) => n.toString(8).padStart(len - 1, '0') + '\0';
  h.write(oct(e.dir || e.exec ? 0o755 : 0o644, 8), 100);
  h.write(oct(0, 8), 108); h.write(oct(0, 8), 116);
  h.write(oct(e.dir ? 0 : e.data.length, 12), 124);
  h.write(oct(Math.floor(Date.now() / 1000), 12), 136);
  h.write('        ', 148);
  h.write(e.dir ? '5' : '0', 156);
  h.write('ustar\0', 257); h.write('00', 263);
  let sum = 0; for (const b of h) sum += b;
  h.write(sum.toString(8).padStart(6, '0') + '\0 ', 148);
  return h;
}
const parts = [];
for (const e of entries) {
  parts.push(tarHeader(e));
  if (!e.dir) {
    parts.push(e.data);
    const pad = (512 - (e.data.length % 512)) % 512;
    if (pad) parts.push(Buffer.alloc(pad));
  }
}
parts.push(Buffer.alloc(1024));
fs.writeFileSync(path.join(OUT, 'Bbomodoro-macOS.tar.gz'), zlib.gzipSync(Buffer.concat(parts), { level: 9 }));

for (const f of fs.readdirSync(OUT)) {
  console.log(`  ${f}  ${(fs.statSync(path.join(OUT, f)).size / 1024 / 1024).toFixed(1)} MB`);
}
