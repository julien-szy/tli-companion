# TLI Companion

A free Windows companion app for **Torchlight: Infinite**: live profit tracking with an in-game widget, farm sessions and strategies, class meta per server, and community prices.

**Download:** https://tlicompanion.com · **License:** source-available, all rights reserved ([details](LICENSE))

English and French.

## Is it safe?

The whole app is in this repository so you can read exactly what it does. In short:

- It only **reads** files the game writes on your PC:
  - the game log, `UE_game.log`, after you turn on *Settings → Other → Enable Log* (see [`src/logwatcher.js`](src/logwatcher.js) and [`src/parser.js`](src/parser.js));
  - the local **Hero Ranking** cache, for the class meta (see [`src/meta.js`](src/meta.js)).
- It does **not** inject into the game, read its memory, send inputs, automate anything or modify any game file.
- It never reads your game account, password or login token. From the game's `UserData` file it only reads the last server name and the character id, to know which server's ranking is open. The character id is never sent anywhere.
- What leaves your PC, and only to `tlicompanion.com` (server code in [`server/`](server)):
  - auction house prices you look up, anonymously;
  - the public Hero Ranking you browse, so the meta builds itself (profiles hidden in game stay hidden), which you can turn off in Settings;
  - farm sessions you choose to publish (the app asks each time you start a session).
- Updates come only from `tlicompanion.com` (electron-updater). The SHA-256 of each installer is shown on the download page.

## Features

- **Live profit and widget:** FE/hour, profit of the current map, drops with their value, map costs. It stays on top of the game, can be resized, made opaque or collapsed to a bar.
- **Farm sessions:** start/stop to get a strategy sheet with maps, Timemark, Void Chart nodes, modifiers, compasses and consumables per map, best drops, efficiency (time in maps vs. between maps vs. AFK). Sessions can be shared on the website, where strategies are ranked by profit at current prices.
- **Alerts:** low stock of beacons, compasses and probes (10, 5, last one), and the Tartarus counter (36 to enter, 48 full), each with its own sound or your own file.
- **Class meta:** tier list and what the top players of each class use, per server and worldwide, from the in-game Hero Ranking.
- **Prices:** your own auction house checks, then prices shared by TLI Companion players, then the [TITrack](https://github.com/astockman99/TITrack) community base (mirrored by our server). Items with no known name are ignored, and a "Prices to check" list shows what to look up.

## Build from source

You can build and run the app yourself to check how it works (personal use only, see the license). Requirements: Windows, Node.js 22+.

```bash
npm install
npm start           # run the app from source
npm run dist        # build the installer and the portable version into dist/
```

Useful options while developing: `TLI_USERDATA=<folder>` uses a separate data folder (to run next to an installed copy), and `TLI_SHOT=<folder>` saves control screenshots.

## Project layout

| Path | What it is |
|---|---|
| `src/main.js` | Electron main process: windows, log watching, IPC, updates |
| `src/parser.js`, `src/logwatcher.js` | Find and read `UE_game.log` |
| `src/tracker.js`, `src/report.js` | Bag, maps, profit, farm sessions |
| `src/prices.js` | Item names and price sources |
| `src/meta.js` | Hero Ranking cache → class meta |
| `src/ui/` | Main window (`dashboard.html`) and in-game widget (`overlay.html`) |
| `data/` | Item base, class list, game names, patch notes, alert sounds |
| `server/` | Website and API for tlicompanion.com (Node.js + SQLite, no dependencies) |
| `scripts/` | Release preparation, beta builds, sound generation |

## License

The code is published for **transparency**, not as open source: you can read it, review it and run it on your own PC, but you may not copy, reuse, redistribute or sell it (or a modified version) without written permission. Bug reports and suggestions are welcome. See [LICENSE](LICENSE).

## Credits

- Item data and icons: [tlidb.com](https://tlidb.com) (icons are not included in this repository).
- Community price base: [TITrack](https://github.com/astockman99/TITrack).
- Class and talent names cross-checked with [tliherorank.com](https://tliherorank.com).

TLI Companion is a fan-made tool, not affiliated with XD Inc. Torchlight: Infinite and its assets belong to XD Inc.

If the app helps you, you can [buy me a coffee](https://buymeacoffee.com/snoopiisz). It's optional and helps pay for the server.
