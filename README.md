# Zombie Bash

A cartoon zombie tower defense game for the browser. Googly-eyed zombies shuffle down the road toward your safehouse, hungry for brains. Build silly towers to bonk them before they get inside, and fight your way through four worlds of levels.

No build step and no dependencies: just HTML, CSS and one JavaScript file drawing on a `<canvas>`. Sound effects are synthesized live with the Web Audio API.

## Play it

Open `index.html` in a browser. Or serve the folder:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Play it on your phone

Zombie Bash is an installable web app. Once it's hosted (see below), open the link on your phone and add it to your home screen. It then launches full screen like a regular app and works offline.

- **iPhone (Safari):** tap **Share**, then **Add to Home Screen**.
- **Android (Chrome):** tap **Install Zombie Bash** on the title screen, or open the menu and choose **Install app** / **Add to Home screen**.

Hold the phone sideways for the best view. The game saves itself between waves, so if your phone closes it, tap **Continue** on the title screen. Updates arrive automatically the next time you open the game.

On a touchscreen, the first tap on a tile previews the tower and its range, and a second tap on the same tile builds it.

### Hosting on GitHub Pages

1. In the repository on GitHub, open **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**, choose the branch that holds the game and the `/ (root)` folder, then **Save**.
3. After a minute the game is live at `https://<your-username>.github.io/<repository-name>/`.

## Worlds and levels

There are 12 levels across 4 worlds. Beating a level unlocks the next one, and each world brings new zombies. The third level of every world ends with a boss. Later levels have two zombie entrances.

You start every level with 20 brains. Finish with 17 or more for 3 stars, 8 or more for 2 stars, or any at all for 1 star. Your stars are saved on your device.

| World | Levels | New zombies | Boss |
| --- | --- | --- | --- |
| Pumpkin Patch | Farm Road, Corn Maze, Harvest Moon | Shambler, Sprinter, Conehead, Digger | Pumpkin King |
| Moonlit Graveyard | Crypt Lane, Twin Graves, Mausoleum | Rattler, Buckethead, Ghoulie, Necromancer | Grave Lord |
| Frozen Tundra | Snowy Pass, Icy Crossroads, Yeti Peak | Frostbite, Brute, Doc Rot | Zombie Yeti |
| Toxic Swamp | Sludge Creek, Bog Junction, Toxic Core | Bloater, Gnawling | Mega Bloater |

### Zombies

| Zombie | Trick |
| --- | --- |
| Shambler | The basic walker. |
| Sprinter | Fast and fragile. |
| Conehead | A traffic cone soaks up small hits. |
| Digger | Tunnels under the first part of the path, where towers can't hit it. |
| Rattler | A bony little skeleton that comes in crowds. |
| Buckethead | Heavy armor. Zap Coils and snipers punch through it. |
| Ghoulie | Floats along and can't be slowed. |
| Necromancer | Raises Rattlers from the ground every few seconds. |
| Frostbite | Already frozen solid, so frost does nothing. |
| Brute | Huge and tough. Eats 3 brains if it gets in. |
| Doc Rot | Heals nearby zombies. Take it out first. |
| Bloater | Bursts into 3 Gnawlings when it pops. |
| Gnawling | Tiny, quick and always hungry. |

| Boss | Trick |
| --- | --- |
| Pumpkin King | Calls Sprinters to run ahead. |
| Grave Lord | Raises an army of Rattlers as it walks. |
| Zombie Yeti | Stomps the ground and freezes nearby towers for a moment. |
| Mega Bloater | Leaks Gnawlings, then bursts into 3 Bloaters. |

Tap or hover any zombie in the wave preview to see its trick. A zombie marked **New** is appearing for the first time.

### Towers

| Tower | Cost | What it does |
| --- | --- | --- |
| Pebble Pal | 50 | Cheap, fast single-target shots. Twin barrels at level 4. |
| Boom Buddy | 90 | Lobs bombs that splash damage over a crowd. |
| Frost Puff | 80 | Snowballs slow every zombie in a small area. |
| Torch Tot | 110 | Short-range flames that set crowds on fire. Burning ignores armor. |
| Zap Coil | 130 | Chain lightning that hops between zombies and ignores armor. |
| Hoot Sniper | 150 | Very long range and big hits that punch through armor. Targets the strongest zombie by default. |

Click a tower to see its stats, change its targeting (first, last, strongest, closest), upgrade it up to level 4, or sell it for 70% of what you spent. Clearing a wave pays a bonus, and calling the next wave early pays a little extra.

### Controls

| Key | Action |
| --- | --- |
| `1`–`6` | Pick a tower to build |
| `Shift` + click | Build several of the same tower |
| `Space` | Start or call the next wave |
| `U` / `S` / `T` | Upgrade / sell / change targeting of the selected tower |
| `F` | Cycle game speed (1×, 2×, 3×) |
| `A` | Toggle auto-start for waves |
| `P` | Pause |
| `M` | Mute |
| `Esc` / right-click | Cancel building or deselect |

Touch works too: tap a tower card, then tap a tile twice.

## Files

- `index.html`: page layout, HUD, side panel and overlays
- `style.css`: the chunky, inked cartoon UI
- `game.js`: game data (worlds, levels, zombies, towers, waves), simulation, canvas rendering, sound and save/resume
- `manifest.webmanifest`, `sw.js`, `icons/`: what makes it installable and playable offline

Your stars, your current run (saved between waves) and your settings are kept in `localStorage` on your device.
