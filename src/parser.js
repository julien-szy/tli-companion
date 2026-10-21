// Transforme les lignes de UE_game.log en événements.
// La catégorie du log (GameLog:, TLLua:, TLNetGame:...) change selon les saisons,
// donc on ne s'appuie que sur le contenu après le préfixe.

const TS_RE = /^\[(\d{4})\.(\d{2})\.(\d{2})-(\d{2})\.(\d{2})\.(\d{2}):(\d{3})\]/;
const BAG_RE = /BagMgr@:(Modfy BagItem|InitBagData) PageId = (-?\d+) SlotId = (\d+) ConfigBaseId = (\d+) Num = (\d+)/;
const REMOVE_RE = /BagMgr@:RemoveBagItem PageId = (-?\d+) SlotId = (\d+)/;
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
       line.includes('SelectRoleNetMgr@_EnterLevelStep5'));
    if (!hasBag && !hasItem && !hasLevel && !hasXchg && !hasMisc) return;

    const ts = parseTs(line);
    if (ts) this.lastTs = ts;
    const t = this.lastTs;

    if (hasMisc) {
      // Connexion d'un personnage (premier lancement ou changement de perso) : son sac complet suit.
      if (line.includes('SelectRoleNetMgr@_EnterLevelStep5')) { this.onEvent({ type: 'roleLogin', ts: t }); return; }
      let m = MODIFIER_RE.exec(line);
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
