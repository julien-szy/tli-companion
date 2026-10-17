# Post Reddit — r/TorchlightInfinite

**Flair suggéré :** Tool / Resource (ou Discussion si le flair n'existe pas)

**Images à joindre (dans cet ordre), depuis `server/public/img/` :**
1. `home.png` (accueil de l'app)
2. `overlay.png` (widget en jeu)
3. `session.png` (fiche de session de farm)
4. `meta.png` (méta / tier list)

---

## Titre

I made TLI Companion – a free live profit overlay + farm session tracker + class meta (per server & global) for Torchlight: Infinite

## Texte

Hey everyone,

I've been farming a lot this season and got tired of juggling spreadsheets, price sites and leaderboard sites, so I built a small Windows app that puts it all in one place: **TLI Companion**. It's free, no ads, no account needed.

**What it does right now**

- **Live profit overlay** – a small widget that stays on top of the game: FE/hour, profit of the current map, every drop with its value, minus the beacons/compasses you used. It collapses to a thin bar.
- **Farm sessions** – hit Start / Stop and you get a full strategy sheet: maps played, Void Chart zones, active Netherrealm talents, consumables per map, best drops, FE/h (real time and in-map time). You can share it on the website if you want.
- **Class meta, per server or worldwide** – tier list of all 28 classes, and for each class what the top players use: skills with their supports, legendaries, core talents, talent trees, pactspirits. You can open the full profile of any top player.
- **"My class" on the home screen** – a carousel with the top 10 of your class and how they play it.
- **Prices** – picked up automatically when you search an item at the auction house, shared anonymously between users, plus a community price base for the rest.
- English and French.

**How it works / is it safe?**

The app only reads files the game writes on your PC: the game log (you need *Settings → Other → Enable Log*) and the local Hero Ranking cache. No injection, no memory reading, no automation – it works the same way as the other community trackers. Your account info and passwords are never read or sent.

**What gets shared (only if you choose)**

- Farm sessions you click "Share" on
- Prices you see at the auction house (anonymous)
- The Hero Ranking you browse in game, so the meta builds itself across servers (it's public data in game; profiles hidden in game are never shown). You can turn this off in Settings.

Note: the meta is currently empty on purpose – the Season 16 Hero Ranking seems to return empty data from the game servers right now ("No corresponding data!"), at least on America. As soon as the ranking loads for anyone running the app, the meta fills itself (only up-to-date rankings are accepted).

**Coming soon**

- A real build planner that works like the game (in-game build codes, talent trees, skill energy, pactspirits) instead of item lists
- An AI advisor that knows your class, bag, farm rate and the meta: "what should I upgrade first with 2,000 FE?"
- Accounts (Discord login) to keep your sessions and builds across PCs

**Download:** https://tlicompanion.com (Windows 10/11)

Windows SmartScreen may warn you on first launch because the app isn't signed with a paid certificate yet: *More info → Run anyway*. The installer is only published on tlicompanion.com.

**Credits:** item data and icons from tlidb.com, community price base from TITrack, and tliherorank.com (great site) helped cross-check the class/talent names. Not affiliated with XD.

It's an early version, so I'd really love feedback: bugs, what's confusing, what you'd want next. If you like it and want to help with the server costs, there's a Buy Me a Coffee link on the site, but it's completely optional.

Thanks, and good luck with your drops!
