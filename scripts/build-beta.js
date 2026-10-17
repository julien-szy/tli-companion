// Installateur bêta local (jamais publié) : npm run beta -- 0.9.10-beta.3
// Va dans dist/ avec les autres installateurs. electron-builder y écrit beta.yml (pas latest.yml),
// donc les fichiers de la version publique ne sont pas touchés.
const { execSync } = require('child_process');
const path = require('path');

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+-beta\.\d+$/.test(version || '')) {
  console.error('Usage : npm run beta -- <x.y.z-beta.n>   (ex. 0.9.10-beta.3)');
  process.exit(1);
}
execSync(`npx electron-builder --win nsis -c.extraMetadata.version=${version}`, { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
console.log(`\nBêta prête : dist\\TLI-Companion-Setup-${version}.exe (non publiée)`);
