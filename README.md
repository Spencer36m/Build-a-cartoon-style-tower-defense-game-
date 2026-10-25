# Zombie Bash

A zombie tower defense game inspired by the Bloons TD series. Hold the road across **200 levels in four worlds** with soldiers, artillery, aircraft and boats. Pick your world from a spinning globe, spend coins in the store, and stop every zombie before it reaches your base.

The game is plain HTML, CSS and JavaScript drawing on a `<canvas>`, with no build step needed to play it in a browser. It also ships as an iPhone/iPad app through [Capacitor](https://capacitorjs.com).

## Play it

Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

### On your phone (no App Store needed)

Host the folder on GitHub Pages (**Settings → Pages → Deploy from a branch → / (root)**), open the link on your phone and add it to your home screen:

- **iPhone (Safari):** tap **Share**, then **Add to Home Screen**.
- **Android (Chrome):** tap **Install Zombie Bash** on the main menu, or use the browser menu.

It then runs full screen and works offline. Progress saves between waves, so if your phone closes the game, tap **Continue** on the main menu.

## Publish it on the App Store

The `ios/` folder holds a ready-made Xcode project. Apple only lets you build and submit from your own account, so these steps need to happen on your side:

1. **Join the Apple Developer Program** at [developer.apple.com/programs](https://developer.apple.com/programs/) ($99 per year).
2. **Get a Mac with Xcode** (free from the Mac App Store). If you don't have a Mac, a cloud build service such as Codemagic or Ionic Appflow can build and upload it for you.
3. On the Mac, clone this repository and run:
   ```sh
   npm install
   npm run ios:sync    # copies the game into the iOS app
   npm run ios:open    # opens the project in Xcode
   ```
4. In Xcode, select the **App** target, open **Signing & Capabilities** and choose your team. If Xcode says the bundle ID is taken, change `com.spencer36m.zombiebash` to something unique (also update `appId` in `capacitor.config.json`).
5. Plug in your iPhone and press **Run** to try it on the device.
6. To submit, choose **Product → Archive**, then **Distribute App → App Store Connect**.
7. In [App Store Connect](https://appstoreconnect.apple.com), create the app listing: name, description, screenshots (landscape iPhone and iPad), an age rating and a privacy policy URL. The game collects no data, so the privacy questionnaire is short. Then submit it for review.

The app is landscape-only, hides the status bar, bundles its fonts, and declares that it uses no special encryption, so App Store Connect won't ask about export compliance. Whenever you change the game, run `npm run ios:sync` again before archiving.

## How to play

- **Build:** pick a tower from the Arsenal and tap an open tile. On touchscreens, tap once to preview the spot and its range, then tap the same tile again to build. Boats only go on water.
- **Start waves** when you're ready, or turn on **Auto**. Kills pay cash, clearing a wave pays a bonus, and calling a wave early pays a little extra.
- **Upgrade** a tower three times, from its first rank to its named top upgrade. You can also change what it targets (first, last, strongest or closest) or sell it.
- **Lives:** every zombie that reaches the base costs lives. Finish with 17 or more lives for 3 stars, 8 or more for 2, or any at all for 1.
- **Supplies** (bottom left of the battlefield) are one-use: Airstrike, Cryo Bomb, Supply Drop and Field Repairs.

### Worlds

Each world has 50 levels. Every level has its own road layout, scenery, time of day and weather. Some have rivers and lakes with bridges, and some have two entrances. Every 10th level brings an elite Juggernaut, and level 50 is the world boss. Beating a level unlocks the next, and clearing level 50 unlocks the next world.

| World | New zombies | Boss |
| --- | --- | --- |
| Hollow Creek Farmland | Shambler, Runner, Conehead, Tunneler, Carrion Crow | The Harvester |
| Blackwood Cemetery | Skeleton, Riot Zombie, Wraith, Necromancer, Bat Swarm | Grave Lord |
| Frostfall Tundra | Frostbite, Brute, Plague Doctor | Abomination |
| Black Bayou | Bloater, Crawler | Behemoth |

Zombies from earlier worlds keep coming back in later ones.

### Zombies

| Zombie | What it does |
| --- | --- |
| Shambler | Slow and relentless. |
| Runner | Fast and fragile. |
| Conehead | Light armor. |
| Tunneler | Burrows under the first stretch of road. Only a submarine's sonar reveals it. |
| Carrion Crow, Bat Swarm | **Flying.** They cut across the road's corners and can only be hit by anti-air towers. |
| Skeleton | Comes in crowds. |
| Riot Zombie | Heavy armor. Snipers, Tesla Coils and submarines punch through it. |
| Wraith | Can't be slowed. |
| Necromancer | Raises skeletons. |
| Brute | Huge. Costs 3 lives if it gets in. |
| Frostbite | Frozen solid, so cryo does nothing. |
| Plague Doctor | Heals nearby zombies. |
| Bloater | Bursts into three Crawlers. |
| Crawler | Small and quick. |
| Juggernaut | Armored elite on every 10th level. |
| The Harvester / Grave Lord / Abomination / Behemoth | World bosses: they call in Runners, raise skeleton armies, freeze your towers, or burst into Bloaters. |

### Towers

| Key | Tower | Type | Hits flyers | Unlocks |
| --- | --- | --- | --- | --- |
| 1 | Machine Gunner | Rapid fire | Yes | Start |
| 2 | Sniper | Long range, armor-piercing | Yes | Start |
| 3 | Mortar Team | Splash | No | Start |
| 4 | Cryo Cannon | Slows | No | Clear 1-2 |
| 5 | Gunboat | Water only | Yes | Clear 1-4 |
| 6 | Flamethrower | Burns, ignores armor | No | Clear 1-7 |
| 7 | Tesla Coil | Chain lightning, ignores armor | Yes | Clear 1-12 |
| 8 | Gunship | Flying helicopter that chases the lead zombie | Yes | Clear 1-18 |
| 9 | Submarine | Water only, homing missiles, sonar | Yes | Clear 1-30 |
| 0 | Fighter Jet | Flying, circles its airstrip firing missiles | Yes | Clear 1-40 |

Locked towers can also be bought early in the store.

### Store

You earn coins by clearing levels. First clears pay the most, and replays pay a little. Spend them on:

- **Towers:** unlock a tower before you reach its level.
- **Upgrades** (permanent): extra starting cash, extra lives, cheaper towers, better sell-back, more cash per kill.
- **Supplies** (one use): Airstrike, Cryo Bomb, Supply Drop, Field Repairs.

### Controls

| Key | Action |
| --- | --- |
| `1`–`9`, `0` | Pick a tower |
| `Shift` + click | Build several of the same tower |
| `Space` | Start or call the next wave |
| `U` / `S` / `T` | Upgrade / sell / change targeting of the selected tower |
| `F` | Game speed (1×, 2×, 3×) |
| `A` | Auto-start waves |
| `P` | Pause |
| `M` | Mute |
| `Esc` / right-click | Cancel |

## Files

- `index.html`, `style.css`: menus, HUD and the tactical interface
- `js/data.js`: worlds, zombies, towers, store items and difficulty
- `js/levels.js`: the level generator (roads, water, scenery, waves) for all 200 levels
- `js/art.js`: realistic top-down drawing of terrain, zombies, towers and effects
- `js/globe.js`: the floating globe on the world map
- `js/game.js`: game engine, input, menus, store and saving
- `fonts/`: Barlow and Barlow Condensed (SIL Open Font License), bundled for offline play
- `manifest.webmanifest`, `sw.js`, `icons/`: installable web app and offline support
- `capacitor.config.json`, `package.json`, `scripts/build-web.mjs`, `ios/`: the iOS app

Progress (coins, stars, unlocks, upgrades and your current run) is saved on the device in `localStorage`.
