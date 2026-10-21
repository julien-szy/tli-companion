// Base SQLite (module intégré à Node 22+, aucune dépendance à compiler).
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

function openDb(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(path.join(dataDir, 'tli.db'));
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      token_hash  TEXT NOT NULL UNIQUE,
      created_at  INTEGER NOT NULL,
      banned      INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS reports (
      id            TEXT PRIMARY KEY,
      user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      hero_id       INTEGER,
      hero_name     TEXT,
      title         TEXT,
      main_map      TEXT,
      profit        REAL NOT NULL,
      per_hour_real REAL NOT NULL,
      per_hour_map  REAL NOT NULL,
      runs          INTEGER NOT NULL,
      real_ms       INTEGER NOT NULL,
      started_at    INTEGER NOT NULL,
      created_at    INTEGER NOT NULL,
      likes         INTEGER NOT NULL DEFAULT 0,
      json          TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS reports_hero ON reports(hero_id);
    CREATE INDEX IF NOT EXISTS reports_map ON reports(main_map);
    CREATE INDEX IF NOT EXISTS reports_created ON reports(created_at);

    -- Statistiques de farm ANONYMES : aucun pseudo, aucun compte. « contributor » est l'empreinte (sha256)
    -- d'un identifiant aléatoire de l'installation, utilisée seulement pour compter les joueurs distincts.
    CREATE TABLE IF NOT EXISTS farm_stats (
      id            TEXT PRIMARY KEY,
      contributor   TEXT NOT NULL,
      created_at    INTEGER NOT NULL,
      hero_id       INTEGER,
      main_map      TEXT,
      region        TEXT,
      timemark      INTEGER,
      strategy_tag  TEXT,
      server_region TEXT,
      season        INTEGER,
      runs          INTEGER NOT NULL,
      real_ms       INTEGER NOT NULL,
      map_ms        INTEGER NOT NULL,
      afk_ms        INTEGER NOT NULL,
      profit        REAL NOT NULL,
      per_hour      REAL NOT NULL,
      consumables   TEXT,
      json          TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS farm_stats_group ON farm_stats(region, timemark, strategy_tag);
    CREATE INDEX IF NOT EXISTS farm_stats_created ON farm_stats(created_at);

    -- Avis des joueurs (bug, idée, question) : texte brut uniquement, aucune pièce jointe, aucune IP.
    CREATE TABLE IF NOT EXISTS feedback (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at INTEGER NOT NULL,
      type       TEXT NOT NULL,
      message    TEXT NOT NULL,
      contact    TEXT,
      version    TEXT,
      source     TEXT NOT NULL,
      lang       TEXT
    );
    CREATE INDEX IF NOT EXISTS feedback_created ON feedback(created_at);


    CREATE TABLE IF NOT EXISTS builds (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      hero_key    TEXT,
      title       TEXT NOT NULL,
      steps       INTEGER NOT NULL,
      likes       INTEGER NOT NULL DEFAULT 0,
      created_at  INTEGER NOT NULL,
      updated_at  INTEGER NOT NULL,
      json        TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS builds_hero ON builds(hero_key);

    -- Méta : dernier instantané agrégé du Hero Ranking par serveur / saison / classement.
    CREATE TABLE IF NOT EXISTS meta_snapshots (
      server      TEXT NOT NULL,
      season      INTEGER NOT NULL,
      mode        INTEGER NOT NULL,
      captured_at INTEGER NOT NULL,
      received_at INTEGER NOT NULL,
      uploader    TEXT NOT NULL,
      uploads     INTEGER NOT NULL DEFAULT 1,
      json        TEXT NOT NULL,
      PRIMARY KEY (server, season, mode)
    );

    -- Joueurs du classement (pseudo sauf profil masqué en jeu, build) par serveur / saison / classement.
    CREATE TABLE IF NOT EXISTS meta_players (
      server  TEXT NOT NULL,
      season  INTEGER NOT NULL,
      mode    INTEGER NOT NULL,
      rank    INTEGER NOT NULL,
      hero_id INTEGER NOT NULL,
      name    TEXT,
      level   INTEGER NOT NULL,
      dps     REAL NOT NULL,
      build   TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS meta_players_key ON meta_players(season, mode, hero_id, dps);
    CREATE INDEX IF NOT EXISTS meta_players_srv ON meta_players(server, season, mode, hero_id, rank);

    -- Noms et icônes des objets cités dans la méta (pour l'affichage sur le site).
    CREATE TABLE IF NOT EXISTS item_names (
      id   INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      img  TEXT
    );

    -- Correspondance numéro de héros du jeu -> classe/trait, apprise des joueurs (un vote par joueur).
    CREATE TABLE IF NOT EXISTS hero_map_votes (
      hero_id  INTEGER NOT NULL,
      voter    TEXT NOT NULL,
      hero_key TEXT NOT NULL,
      ts       INTEGER NOT NULL,
      PRIMARY KEY (hero_id, voter)
    );

    CREATE TABLE IF NOT EXISTS likes (
      user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      report_id TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
      PRIMARY KEY (user_id, report_id)
    );

    -- Historique des prix vus à l'hôtel des ventes (courbe de prix), gardé 120 jours.
    CREATE TABLE IF NOT EXISTS price_hist (
      item_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      price   REAL NOT NULL,
      ts      INTEGER NOT NULL,
      PRIMARY KEY (item_id, user_id, ts)
    );
    CREATE INDEX IF NOT EXISTS price_hist_item ON price_hist(item_id, ts);

    -- Dernier prix observé à l'hôtel des ventes, par joueur et par objet.
    CREATE TABLE IF NOT EXISTS price_obs (
      user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      item_id  INTEGER NOT NULL,
      price    REAL NOT NULL,
      ts       INTEGER NOT NULL,
      PRIMARY KEY (user_id, item_id)
    );
    CREATE INDEX IF NOT EXISTS price_obs_item ON price_obs(item_id, ts);

    -- Noms de héros proposés par les joueurs (le jeu ne donne qu'un numéro).
    CREATE TABLE IF NOT EXISTS hero_names (
      hero_id INTEGER NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name    TEXT NOT NULL,
      PRIMARY KEY (hero_id, user_id)
    );
  `);
  // Colonnes ajoutées (filtres des stratégies) : ajoutées si absentes.
  const cols = new Set(db.prepare('PRAGMA table_info(reports)').all().map((c) => c.name));
  for (const [c, type] of [['region', 'TEXT'], ['timemark', 'INTEGER'], ['strategy_tag', 'TEXT'], ['server_region', 'TEXT'], ['season', 'INTEGER'], ['consumables', 'TEXT']]) {
    if (!cols.has(c)) db.exec(`ALTER TABLE reports ADD COLUMN ${c} ${type}`);
  }
  db.exec('CREATE INDEX IF NOT EXISTS reports_region ON reports(region, timemark)');
  return db;
}

module.exports = { openDb };
