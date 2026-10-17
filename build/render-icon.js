// Génère build/icon.png (256 px) et src/ui/tray.png (32 px) à partir de src/ui/logo.svg.
// Usage : node_modules\electron\dist\electron.exe build/render-icon.js
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const svg = fs.readFileSync(path.join(__dirname, '..', 'src', 'ui', 'logo.svg'), 'utf8');
  const render = async (size, out) => {
    const win = new BrowserWindow({ width: size, height: size, show: false, transparent: true, frame: false, useContentSize: true,
      webPreferences: { offscreen: true } });
    const html = `<html><body style="margin:0;background:transparent;overflow:hidden">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`;
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    await new Promise((r) => setTimeout(r, 300));
    const img = await win.webContents.capturePage({ x: 0, y: 0, width: size, height: size });
    fs.writeFileSync(out, img.resize({ width: size, height: size }).toPNG());
    win.destroy();
    console.log('écrit', out);
  };
  await render(256, path.join(__dirname, 'icon.png'));
  await render(32, path.join(__dirname, '..', 'src', 'ui', 'tray.png'));
  app.quit();
});
