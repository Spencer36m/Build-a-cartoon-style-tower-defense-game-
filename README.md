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

The `ios/` folder holds a ready-made Xcode project, and `.github/workflows/ios-testflight.yml` builds it on a cloud Mac and uploads it to TestFlight, so you don't need a Mac of your own. **[store/APP_STORE.md](store/APP_STORE.md)** walks through every step: the Apple Developer account, the API key, the GitHub secrets, installing it on your phone with TestFlight, and submitting it for review. The store text is in [store/listing.md](store/listing.md), the screenshots are in `store/screenshots/`, and the privacy policy is `privacy.html`.

If you do have a Mac with Xcode, you can also build it by hand:

```sh
npm install
npm run ios:sync    # copies the game into the iOS app
npm run ios:open    # opens the project in Xcode
```

Then choose your team under **Signing & Capabilities**, and use **Product → Archive → Distribute App**.

The app is landscape-only, hides the status bar, bundles its fonts, and declares that it uses no special encryption, so App Store Connect won't ask about export compliance.

## How to play

- **Build:** pick a tower from the Arsenal and tap an open tile. On touchscreens, tap once to preview the spot and its range, then tap the same tile again to build. Boats only go on water.
- **Start waves** when you're ready, or turn on **Auto**. Kills pay cash, clearing a wave pays a bonus, and calling a wave early pays a little extra.
- **Upgrade:** tap a tower to open its three upgrade paths and buy the next tier of any of them. Every upgrade changes how the tower looks and fights. You can also change what it targets (first, last, strongest or closest) or sell it.
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

The globe is alive: 20 **wonders** are scattered across the planet, including erupting volcanoes, wildfires, a valley of dinosaurs, raptor packs, pterosaurs, a red dragon, a kraken, a ghost ship, floating crystals, a portal in the sky, a stone circle of glowing runes, a floating island, the Elder Tree, a sun temple, a UFO and Ground Zero itself. Spin the globe and tap one to read its story; the game remembers how many you have found. Meteors streak past and some strike the planet, leaving burning craters, while a comet, an orbiting moon and the northern lights pass by.

### Zombies

| Zombie | What it does |
| --- | --- |
| Shambler | Slow and relentless. |
| Runner | Fast and fragile. |
| Conehead | Light armor. |
| Tunneler | Burrows under the first stretch of road. A submarine's sonar reveals it, and detection upgrades (Spotter, Thermal Scope, Ground Rods...) let towers hit it. |
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
| Q | Farm | Income: drops cash crates every wave | Upgrade | Clear 1-3 |

Locked towers can also be bought early in the store.

### Upgrades and the Armory

Like Bloons TD, every tower has **three upgrade paths with five tiers each**. A tower can take one path all the way to tier 5 and add up to two tiers of a second path (for example 5-2-0). The third path is then closed.

Some of the transformations:

| Tower | Path 1 | Path 2 | Path 3 |
| --- | --- | --- | --- |
| Machine Gunner | **Energy:** laser cannon → plasma beam → Doom Ray across the whole map | **Heavy:** rocket pods → rocket storm → walking Siege Mech | **Spread:** buckshot → gun bunker → Fortress firing at 8 zombies |
| Sniper | **Rifle:** anti-materiel rifle, critical hits → Railgun that pierces a whole line | **Action:** semi-auto → **Full Auto** → twin marksmen | **Intel:** scopes, Tunneler vision, bounties, income → Overwatch buffs every tower |
| Mortar Team | **Warhead:** cluster shells → thermobaric → Earthshaker stuns | **Crew:** twin tubes → four-tube Artillery Battery | **Fire Control:** flak (hits flyers) → map-wide Forward Observer → Long Tom |
| Cryo Cannon | **Chill:** flash freeze → brittle → Absolute Zero | **Payload:** frag canisters → Blizzard → Cryo Storm | **Systems:** coolant mist field → anti-air → Glacier |
| Gunboat | **Deck Guns:** destroyer → Battleship | **Trade:** cargo income up to $655 a wave | **Armament:** harpoons → AA missiles → cruise missiles |
| Flamethrower | **Fuel:** napalm → white phosphorus → Hellfire | **Nozzle:** firewall → Wildfire ground fire | **Heat:** plasma torch → meltdown → Sunfire beam |
| Tesla Coil | **Arc:** chains through 10, then 24 zombies → Thunderhead | **Charge:** stun coil → EMP pulse → Tesla Tower | **Field:** static field → Power Grid buffs towers → Storm Generator |
| Gunship | **Guns:** minigun pods → Apex Gunship | **Rockets:** Hellfire missiles → Death From Above | **Avionics:** night vision → supply runs → Medevac → Air Superiority |
| Submarine | **Torpedoes:** cruise missiles → Trident Barrage | **Warheads:** thermite → tungsten → Fleet Admiral buffs every boat | **Systems:** reactor → Fusion Heart |
| Fighter Jet | **Missiles:** cluster → Missile Swarm → Strike Package | **Airframe:** strafing → napalm → Carpet Bomber | **Wing:** wingman → AWACS → six-jet Air Wing |
| Farm | **Crops:** greenhouses → plantation → Breadbasket (+$600 a wave) | **Market:** farmers market → Bank interest → War Bonds | **Homestead:** well (lives) → shotgun farmhand → watchtower → Safe Haven |

Tiers 1 and 2 are always available. Tiers 3 to 5 are unlocked in the **Armory** on the main menu with that tower's **XP**. Towers earn XP from their kills, and every tower you used gets a bonus when you clear a level. Unlocking a tier costs 150, 600 or 2,000 XP; after that you buy it in battle with cash like any other upgrade.

### Store

You earn coins by clearing levels. First clears pay the most, and replays pay a little. Spend them on:

- **Towers:** unlock a tower before you reach its level.
- **Perks** (permanent): extra starting cash, extra lives, cheaper towers, better sell-back, more cash per kill.
- **Supplies** (one use): Airstrike, Cryo Bomb, Supply Drop, Field Repairs.

### Sound

Every sound is synthesized live with Web Audio, so the game ships no audio files. Weapons, upgrades, menus, the store and the Armory all have their own sounds, and every kind of zombie groans and dies differently (bones rattle, crows caw, wraiths wail, bloaters pop, bosses roar). Effects pan left or right with where they happen on the map.

The music follows the action: a menu theme, a calm arrangement between waves, drums once a wave is on, and a faster boss theme, in a different key for each world. Ambience follows the level's weather and time of day: rain, wind, crickets at night, owls in the cemetery, frogs in the bayou.

**Sound** in the top bar mutes everything; **Music** on the main menu and the pause screen turns off just the music. On iPhone, the ring/silent switch also mutes the game, as with most games.

### Story

The campaign is told in manga-style motion-comic cutscenes: inked panels with screentones, lettered speech balloons, sound effects, camera drift and page turns. Tap, click or press `Space` to move on, `Esc` or **Skip** to jump ahead.

- **Prologue, Starfall:** a green meteor lands in Hollow Creek, Kansas. Kessler-Vane Biotech's secret lab turns it into Project Lazarus, the dead get up, and Dr. Mara Okafor escapes with the Lazarus Core. In Chicago, Kessler-Vane's chairman Silas Vane decides to let the outbreak spread and sell the world a cure, and sends his people after Okafor. What is left of the army becomes Bastion Company, and you are its Commander.
- **Chapter 1, Harvest:** the farmland where it started. You meet Laila, the last of the Hollow Creek ranchers, who has held a farmhouse alone for forty days with her rifle and joins Bastion as its sharpshooter. Then a broken radio call from Okafor, and the fall of Elias Crane, the Harvester.
- **Chapter 2, The Restless:** Blackwood Cemetery, a rift torn in the sky and the Grave Lord.
- **Chapter 3, White Silence:** Station Seven on the Frostfall ice, and Lazarus Two.
- **Chapter 4, The Hive:** Black Bayou, the horde converging and the last stand, where Laila's one shot saves Okafor and opens the hive's heart.

Every sector is part of the story. The 200 sectors form 40 operations of five missions each, and each operation has a purpose: rescue the Miller family, refill the safehouse's water, trace Okafor's signal, beat Vane's cleaners to the crypt files, keep Lazarus Two frozen, cut the hive's feeding channels. When a mission starts, the character in charge radios in with the reason for it. During the fight the squad calls out new zombie types, bosses, the final wave and a failing line, and Silas Vane cuts in on stolen channels. A win or loss ends with a word from the cast, and the level briefing shows the operation, the objective and who gave the order.

Each world's intro plays when you first deploy there, and new chapters play after your first clear of sectors 25 and 50. Every mission briefing carries a line of intel from Major Voss. Replay any chapter you have unlocked from **Story** on the main menu. On a phone held upright, the camera follows one panel at a time so the lettering stays large.

### Controls

| Key | Action |
| --- | --- |
| `1`–`9`, `0`, `Q` | Pick a tower |
| `Shift` + click | Build several of the same tower |
| `Space` | Start or call the next wave |
| `,` `.` `/` | Upgrade path 1, 2 or 3 of the selected tower |
| `S` / `T` | Sell / change targeting of the selected tower |
| `F` | Game speed (1×, 2×, 3×) |
| `A` | Auto-start waves |
| `P` | Pause |
| `M` | Mute |
| `Esc` / right-click | Cancel |

## Files

- `index.html`, `style.css`: menus, HUD and the tactical interface
- `js/data.js`: worlds, zombies, towers, store items and difficulty
- `js/levels.js`: the level generator (roads, water, scenery, waves) for all 200 levels
- `js/art.js`: realistic top-down drawing of zombies, towers and effects
- `js/terrain.js`: the painted battlefields: lit ground with relief, worn dirt and cobbled roads with ruts and puddles, ponds with depth and shorelines, plank bridges, and detailed props (leafy trees, pines, barns, cabins with snow and icicles, cars, graves, crypts) plus the safehouse bunker
- `js/globe.js`: the floating globe on the world map, with its wonders, meteors and moon
- `js/menufx.js`: the animated main menu backdrop
- `js/wonders.js`: the painted landmarks on the globe
- `js/manga.js`, `js/scenes.js`: the manga art kit (screentones, speed lines, portraits) and every cutscene panel
- `js/story.js`: the story script and the cutscene player
- `js/missions.js`, `js/comms.js`: the 40 operations, the cast's radio lines, and the comms card that shows them in a mission
- `js/audio.js`: synthesized sound effects, music and ambience
- `js/game.js`: game engine, input, menus, store and saving
- `fonts/`: Barlow and Barlow Condensed (SIL Open Font License), bundled for offline play
- `manifest.webmanifest`, `sw.js`, `icons/`: installable web app and offline support
- `capacitor.config.json`, `package.json`, `scripts/build-web.mjs`, `ios/`: the iOS app
- `.github/workflows/ios-testflight.yml`, `store/`: cloud build to TestFlight, App Store guide, listing text and screenshots
- `privacy.html`: the privacy policy (the game collects no data)

Progress (coins, stars, unlocks, perks, tower XP, Armory unlocks, story chapters read and your current run) is saved on the device in `localStorage`.
