// Petit stockage JSON persistant (descriptions de modificateurs, noms de héros...).
const fs = require('fs');
const path = require('path');

class JsonStore {
  constructor(file, defaults = {}) {
    this.file = file;
    this.data = { ...defaults };
    try { Object.assign(this.data, JSON.parse(fs.readFileSync(file, 'utf8'))); } catch { /* nouveau */ }
    this._timer = null;
  }
  save(delayMs = 2000) {
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this.flush(), delayMs);
  }
  flush() {
    clearTimeout(this._timer);
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(this.file, JSON.stringify(this.data));
    } catch (e) { console.error('Sauvegarde impossible :', this.file, e.message); }
  }
}

module.exports = { JsonStore };
