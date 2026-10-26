// Transforme les lignes de UE_game.log en événements.
// La catégorie du log (GameLog:, TLLua:, TLNetGame:...) change selon les saisons,
// donc on ne s'appuie que sur le contenu après le préfixe.

const TS_RE = /^\[(\d{4})\.(\d{2})\.(\d{2})-(\d{2})\.(\d{2})\.(\d{2}):(\d{3})\]/;
const BAG_RE = /BagMgr@:(Modfy BagItem|InitBagData) PageId = (-?\d+) SlotId = (\d+) ConfigBaseId = (\d+) Num = (\d+)/;
const REMOVE_RE = /BagMgr@:RemoveBagItem PageId = (-?\d+) SlotId = (\d+)/;
// Équipement porté (page -1) : objet mis ou retiré d'un emplacement, et le légendaire (GoldId) que le jeu
// annonce juste avant pour cette base. Le jeu ne renvoie pas tout l'équipement à la connexion.
const EQUIP_RE = /BagMgr@:(AddEquipItem|RemoveEquipItem) PageId = -1 SlotId = (\d+) ConfigBaseId = (\d+)/;
const SETEQ_RE = /AttributeMgr:SetPlayerEquipment\(BaseId=(\d+), GoldId=(\d+), (\d+)\)/;
const PROTO_RE = /ItemChange@ ProtoName=(\w+) (start|end)/;
const LEVELPATH_RE = /LevelMgr@:LevelPath, Model = (\S+?)\.umap/;
const ENTER_RE = /LevelMgr:_EnterLevelSuccess\(\)\s*(\d+)/;
const XCHG_START_RE = /Socket (Send|Recv)Message STT----XchgSearchPrice----SynId = (\d+)/;
const SOCKET_END_RE = /Socket (Send|Recv)Message End/;
const UNIT_FIRST_RE = /\+unitPrices\+1 \[([-\d.eE+]+)\]/;
const UNIT_NEXT_RE = /^\|\s+\|\s+\|\s+\+\d+ \[([-\d.eE+]+)\]/;

const MODIFIER_RE = /AddMapModifier\((\d+)\) success/;
const HERO_RE = /PreLoadHeroId = (\d+)/;
const NODE_RE = /GetCardDataByMapOrder AreaId = (\d+) MapOrder (\d+)/;
// Onglet Stats : expérience (valeur brute dans le niveau, puis le niveau), mort (écran d'échec), compétence
// qui a tué, et DPS / défense du perso calculés par le jeu (« actuel -> avec l'objet comparé »).
const EXP_RE = /ExpMgr@UpdateExp Percent:(\d+) (\d+)/;
const KILLER_RE = /GetDeathDesc\s+Id == \d+ Args == KilledSkill:(\d+)/;
const POWER_RE = /AttributeMgr:Log\(BaseId=\d+, GoldId=\d+\) (DPS|DEF): ([\d.]+) ->/;
// Fiche du perso (onglet Attributs en jeu) : « Attri.Id  Attack DPS  10100 » puis « [1] = 41670070.9, [2] = … ».
const ATTR_NAME_RE = /RoleAttrMgr@Attri\.Id\s+(.+?)\s+(\d+)\s*$/;
const ATTR_VAL_RE = /RoleAttrMgr@\[1\] = ([-\d.eE+]+)(?:, \[2\] = ([-\d.eE+]+))?/;
// Compétences équipées (page -6) : sort actif N dans l'emplacement N (1 à 5) et ses soutiens en N01 à N05 ;
// passifs en 1001, 1007, 1013, 1019 et leurs soutiens dans les 5 emplacements suivants.
// « Reset PageId=-6 » (connexion) puis « Update » ; « Add » / « Delete » quand on change un soutien.
const SKILL_SLOT_RE = /ItemChange@ (Update|Add|Delete) Id=(\d+)_[0-9a-f-]+(?: BagNum=\d+)? in PageId=-6 SlotId=(\d+)/;
// Équipement porté (page -1) : quelle pièce (identifiant unique) est dans quel emplacement.
const GEAR_SLOT_RE = /ItemChange@ (Update|Add|Delete) Id=(\d+_[0-9a-f-]+)(?: BagNum=\d+)? in PageId=-1 SlotId=(\d+)/;
// Bloc « GetPlayerData » reçu à la connexion : chaque pièce portée (et l'onglet équipement du sac) avec ses affixes.
const GEAR_SECTIONS = new Set(['BaseAttrAffix', 'FixedBaseAffix', 'Prefix', 'Suffix', 'ChipAffix', 'extAffix', 'EnchantAffixs', 'BaseAffix']);

const FE_ID = 100300;

// « <p>+2</p>% additional <e id=507>Drop Quantity</e> » -> « +2% additional Drop Quantity »
function cleanDesc(s) {
  return s.replace(/<\/?p>/g, '').replace(/<e id=\d+>/g, '').replace(/<\/e>/g, '').trim();
}

function parseTs(line) {
  const m = TS_RE.exec(line);
  if (!m) return null;
  // Les horodatages du log sont en UTC.
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6], +m[7]);
}

const CONSUM_RE = /ConsumMgr:ResreshConsumData (\w+) Value (-?\d+)/;

class LogParser {
  constructor(onEvent) {
    this.onEvent = onEvent;
    this.lastTs = Date.now();
    this.block = null;          // bloc multi-ligne XchgSearchPrice en cours
    this.pendingSearch = new Map(); // SynId -> ConfigBaseId recherché
  }

  feed(line) {
    if (this.gpd) { this._feedGpd(line); return; }
    if (line.includes('RecvMessage STT----GetPlayerData')) {
      const ts = parseTs(line);
      this.gpd = { ts: ts || this.lastTs, items: [], cur: null, sec: null, dyn: null };
      return;
    }
    if (this.block) {
      this._feedBlock(line);
      return;
    }
    if (this.affix) {
      if (this._feedAffix(line)) return;
    }
    // Pré-filtre rapide : la très grande majorité des lignes n'intéresse pas.
    const hasBag = line.includes('BagMgr@:');
    const hasItem = !hasBag && line.includes('ItemChange@ ProtoName');
    const hasLevel = !hasBag && !hasItem && line.includes('LevelMgr');
    const hasXchg = !hasBag && !hasItem && !hasLevel && line.includes('XchgSearchPrice');
    const hasMisc = !hasBag && !hasItem && !hasLevel && !hasXchg &&
      (line.includes('AddMapModifier(') || line.includes('PreLoadHeroId') ||
       line.includes('GetCardDataByMapOrder') || line.endsWith('[Game] AffixInfos') || line.includes('ResreshConsumData') ||
       line.includes('SelectRoleNetMgr@_EnterLevelStep5') || line.includes('SetPlayerEquipment(BaseId=') ||
       line.includes('ExpMgr@UpdateExp') || line.includes('Open FightFailureView') || line.includes('KilledSkill:') || line.includes('AttributeMgr:Log(') ||
       line.includes('RoleAttrMgr@') || line.includes('PageId=-6') || line.includes('PageId=-1'));
    if (!hasBag && !hasItem && !hasLevel && !hasXchg && !hasMisc) return;

    const ts = parseTs(line);
    if (ts) this.lastTs = ts;
    const t = this.lastTs;

    if (hasMisc) {
      // Connexion d'un personnage (premier lancement ou changement de perso) : son sac complet suit.
      if (line.includes('SelectRoleNetMgr@_EnterLevelStep5')) { this.onEvent({ type: 'roleLogin', ts: t }); return; }
      const eq = SETEQ_RE.exec(line);
      if (eq) { this.onEvent({ type: 'equipHint', ts: t, base: +eq[1], gold: +eq[2] }); return; }
      if (line.includes('Open FightFailureView')) { this.onEvent({ type: 'death', ts: t }); return; }
      if (line.includes('RoleAttrMgr@')) {
        const n = ATTR_NAME_RE.exec(line);
        if (n) { this.attrName = { name: n[1], id: +n[2] }; return; }
        const v = ATTR_VAL_RE.exec(line);
        if (v && this.attrName) {
          this.onEvent({ type: 'attr', ts: t, id: this.attrName.id, name: this.attrName.name, v: v[2] != null ? [+v[1], +v[2]] : [+v[1]] });
          this.attrName = null;
        }
        return;
      }
      if (line.includes('ItemChange@') && line.includes('PageId=-1')) {
        if (/ItemChange@ Reset PageId=-1(?!\d)/.test(line)) { this.onEvent({ type: 'gearReset', ts: t }); return; } // pas -10, -11…
        const g = GEAR_SLOT_RE.exec(line);
        if (g) this.onEvent({ type: 'gearSlot', ts: t, op: g[1] === 'Delete' ? 'del' : 'set', uid: g[2], slot: +g[3] });
        return;
      }
      if (line.includes('PageId=-6')) {
        if (line.includes('ItemChange@ Reset PageId=-6')) { this.onEvent({ type: 'skillReset', ts: t }); return; }
        const k = SKILL_SLOT_RE.exec(line);
        if (k) this.onEvent({ type: 'skillSlot', ts: t, op: k[1] === 'Delete' ? 'del' : 'set', id: +k[2], slot: +k[3] });
        return;
      }
      let m = EXP_RE.exec(line);
      if (m) { this.onEvent({ type: 'exp', ts: t, xp: +m[1], level: +m[2] }); return; }
      m = KILLER_RE.exec(line);
      if (m) { this.onEvent({ type: 'deathKiller', ts: t, skill: +m[1] }); return; }
      m = POWER_RE.exec(line);
      if (m) { this.onEvent({ type: 'power', ts: t, stat: m[1], value: +m[2] }); return; }
      m = MODIFIER_RE.exec(line);
      if (m) { this.onEvent({ type: 'mapModifier', ts: t, id: +m[1] }); return; }
      m = HERO_RE.exec(line);
      if (m) { this.onEvent({ type: 'hero', ts: t, heroId: +m[1] }); return; }
      m = NODE_RE.exec(line);
      if (m) { this.onEvent({ type: 'voidNode', ts: t, areaId: +m[1], mapOrder: +m[2] }); return; }
      // Compteurs du jeu (ex. Coin_828 = compteur Tartarus « x/48 »).
      m = CONSUM_RE.exec(line);
      if (m) { this.onEvent({ type: 'consum', ts: t, key: m[1], value: +m[2] }); return; }
      // Bloc « AffixInfos » : descriptions des modificateurs de la carte (tronqué à 30 entrées).
      this.affix = { started: false, lines: [] };
      return;
    }

    if (hasBag) {
      const eq = EQUIP_RE.exec(line);
      if (eq) { this.onEvent({ type: eq[1] === 'AddEquipItem' ? 'equip' : 'unequip', ts: t, slot: +eq[2], base: +eq[3] }); return; }
      let m = BAG_RE.exec(line);
      if (m) {
        const page = +m[2];
        if (page < 0) return; // équipement porté
        this.onEvent({
          type: m[1] === 'InitBagData' ? 'bagInit' : 'bagModify',
          ts: t, page, slot: +m[3], id: +m[4], num: +m[5],
        });
        return;
      }
      m = REMOVE_RE.exec(line);
      if (m && +m[1] >= 0) this.onEvent({ type: 'bagRemove', ts: t, page: +m[1], slot: +m[2] });
      return;
    }
    if (hasItem) {
      const m = PROTO_RE.exec(line);
      if (m) this.onEvent({ type: m[2] === 'start' ? 'protoStart' : 'protoEnd', ts: t, proto: m[1] });
      return;
    }
    if (hasLevel) {
      let m = LEVELPATH_RE.exec(line);
      if (m) { this.onEvent({ type: 'levelPath', ts: t, path: m[1] }); return; }
      m = ENTER_RE.exec(line);
      if (m) this.onEvent({ type: 'enterLevel', ts: t, levelId: +m[1] });
      return;
    }
    if (hasXchg) {
      const m = XCHG_START_RE.exec(line);
      if (m) this.block = { kind: m[1], synId: m[2], lines: [], ts: t };
    }
  }

  // Retourne true si la ligne a été consommée par le bloc AffixInfos.
  _feedAffix(line) {
    const a = this.affix;
    const isLogLine = line.startsWith('[');
    if (!a.started) {
      // La ligne qui suit « AffixInfos » est un en-tête vide horodaté.
      if (isLogLine && line.endsWith('[Game] ')) { a.started = true; return true; }
      this.affix = null;
      return false;
    }
    if (!isLogLine) {
      a.lines.push(line);
      if (a.lines.length > 3000) this.affix = null;
      return true;
    }
    this.affix = null;
    let desc = null;
    for (const l of a.lines) {
      const d = /\+Description \[(.*)\]\s*$/.exec(l);
      if (d) { desc = d[1]; continue; }
      const id = /\+Id \[(\d+)\]/.exec(l);
      if (id && desc != null) {
        if (!/^\w+\|description\|/.test(desc)) { // clés non traduites du jeu
          this.onEvent({ type: 'affixDesc', ts: this.lastTs, id: +id[1], desc: cleanDesc(desc) });
        }
        desc = null;
      }
    }
    return false; // la ligne courante est une ligne normale, à traiter ensuite
  }

  // Lignes du bloc GetPlayerData : on n'en garde que les objets d'équipement (page -1 = porté, 100 = onglet
  // équipement du sac), avec leurs affixes et leurs valeurs. Le reste du bloc est ignoré.
  _feedGpd(line) {
    const g = this.gpd;
    if (line.includes('----Socket RecvMessage End----')) {
      this.gpd = null;
      if (g.items.length) this.onEvent({ type: 'gearDump', ts: g.ts, items: g.items });
      return;
    }
    let m = /\+\d+\+Index \[(\d+)\]/.exec(line);
    if (m) { g.cur = { slot: +m[1], affixes: [] }; g.sec = null; g.dyn = null; return; }
    const c = g.cur;
    if (!c) return;
    m = /\+PageId \[(-?\d+)\]/.exec(line);
    if (m) {
      const page = +m[1];
      if ((page === -1 || page === 100) && c.uid && c.affixes.length) g.items.push({ ...c, page });
      g.cur = null;
      return;
    }
    if (g.dyn) {
      const d2 = /^[|\s]*\+2 \[([-\d.eE+]+)\]\s*$/.exec(line);
      if (d2) { g.dyn.args.push(+d2[1]); return; }
      g.dyn = null;
    }
    m = /\+DynArgs\+1 \[([-\d.eE+]+)\]/.exec(line);
    if (m) { const a = c.affixes[c.affixes.length - 1]; if (a && g.sec) { a.args = [+m[1]]; g.dyn = a; } return; }
    m = /\+([A-Za-z]+)\+1\+Id \[(\d+)\]/.exec(line);
    if (m) {
      g.sec = GEAR_SECTIONS.has(m[1]) ? m[1] : null;
      if (g.sec) c.affixes.push({ sec: g.sec, id: +m[2], args: [] });
      return;
    }
    m = /^[|\s]*\+\d+\+Id \[(\d+)\]\s*$/.exec(line);
    if (m && g.sec) { c.affixes.push({ sec: g.sec, id: +m[1], args: [] }); return; }
    if (/\+[A-Za-z]+\+1\+/.test(line)) { g.sec = null; return; } // autre liste (emplacements de craft…)
    m = /\+Id \[(\d+)_([0-9a-f-]+)\]/.exec(line);
    if (m) { c.uid = m[1] + '_' + m[2]; c.base = +m[1]; return; }
    m = /\+UniqueItmId \[(\d+)\]/.exec(line);
    if (m) { if (+m[1]) c.unique = +m[1]; return; }
    m = /\+Level \[(\d+)\]/.exec(line);
    if (m && !c.level) { c.level = +m[1]; return; }
    if (line.includes('+Corrode [true]')) c.corroded = true;
  }

  _feedBlock(line) {
    const b = this.block;
    if (SOCKET_END_RE.test(line)) {
      this.block = null;
      if (b.kind === 'Send') this._onSearchSent(b);
      else this._onSearchResult(b);
      return;
    }
    b.lines.push(line);
    if (b.lines.length > 2000) this.block = null; // garde-fou si la fin n'arrive jamais
  }

  _onSearchSent(b) {
    for (const l of b.lines) {
      const m = /\+refer \[(\d+)\]/.exec(l);
      if (m && +m[1] !== 0) {
        this.pendingSearch.set(b.synId, +m[1]);
        if (this.pendingSearch.size > 200) {
          this.pendingSearch.delete(this.pendingSearch.keys().next().value);
        }
        return;
      }
    }
  }

  _onSearchResult(b) {
    const id = this.pendingSearch.get(b.synId);
    if (!id) return;
    this.pendingSearch.delete(b.synId);
    const prices = [];
    let currency = FE_ID;
    let inUnits = false;
    for (const l of b.lines) {
      const first = UNIT_FIRST_RE.exec(l);
      if (first) { prices.push(+first[1]); inUnits = true; continue; }
      if (inUnits) {
        const n = UNIT_NEXT_RE.exec(l);
        if (n) { prices.push(+n[1]); continue; }
        inUnits = false;
      }
      const c = /\+currency \[(\d+)\]/.exec(l);
      if (c) currency = +c[1];
    }
    if (prices.length && currency === FE_ID) {
      this.onEvent({ type: 'price', ts: b.ts, id, prices });
    }
  }
}

module.exports = { LogParser, parseTs, FE_ID };
