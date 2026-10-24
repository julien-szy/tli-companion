// Catégorie de chaque objet pour la page Prix du site : déduite du type tlidb (en chinois) de data/items_seed_en.json.
// Écrit server/item_cats.json ({ id: catégorie }). À relancer quand items_seed_en.json change : node scripts/itemcats.js
const fs = require('fs');
const path = require('path');

const RULES = [
  ['embers', /^灰烬$/],
  ['compass', /罗盘|探针/],
  ['beacon', /信标|虚海请柬/],
  ['gear', /^传奇装备$|装备蓝图/],
  ['skills', /技能/],
  ['fate', /命运|宿命/],
  ['organs', /器官|^完美|渴瘾残肢/],
  ['memory', /记忆荧光|追忆|英雄追忆/],
  ['divinity', /神格|神骸|神威|之神$/],
  ['prism', /棱镜/],
  ['spices', /^香料$/],
  ['materials', /通用道具|燃料|元件|侵蚀材料|化石|缝线|魂钉|切割器具|拓印烙铁|之楔|高塔筹码|勇者之证|追随者|欲念原核|原初之核|王后烛芯|女王恩宠|梦语|画中雪原|雾都怪谈|黑潮敕令|迷城/],
];

const items = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'items_seed_en.json'), 'utf8')).items;
const out = {};
const count = {};
for (const it of items) {
  const type = it.type_cn || '';
  const rule = RULES.find(([, re]) => re.test(type));
  const cat = rule ? rule[0] : 'other';
  out[it.id] = cat;
  count[cat] = (count[cat] || 0) + 1;
}
fs.writeFileSync(path.join(__dirname, '..', 'server', 'item_cats.json'), JSON.stringify(out));
console.log('server/item_cats.json :', Object.keys(out).length, 'objets', count);
