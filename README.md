# Blob Bash

A cartoon-style tower defense game for the browser. Jelly blobs with googly eyes hop down a dirt path toward your castle. Build silly towers to bonk them before they get inside, and survive 30 waves.

No build step and no dependencies: just HTML, CSS and one JavaScript file drawing on a `<canvas>`. Sound effects are synthesized live with the Web Audio API.

## Play it

Open `index.html` in a browser. Or serve the folder:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Play it on your phone

Blob Bash is an installable web app. Once it's hosted (see below), open the link on your phone and add it to your home screen. It then launches full screen like a regular app and works offline.

- **iPhone (Safari):** tap **Share**, then **Add to Home Screen**.
- **Android (Chrome):** tap **Install Blob Bash** on the title screen, or open the menu and choose **Install app** / **Add to Home screen**.

Hold the phone sideways for the best view. The game saves itself between waves, so if your phone closes it, tap **Continue** on the title screen. Updates arrive automatically the next time you open the game.

On a touchscreen, the first tap on a tile previews the tower and its range, and a second tap on the same tile builds it.

### Hosting on GitHub Pages

1. In the repository on GitHub, open **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**, choose the branch that holds the game and the `/ (root)` folder, then **Save**.
3. After a minute the game is live at `https://<your-username>.github.io/<repository-name>/`.

## How to play

1. Pick a map: **Sunny Meadow** (easy), **Biscuit Canyon** (medium) or **Frosty Peaks** (hard).
2. Choose a tower from the panel and click a grass tile to build it. You can't build on the path, trees, cacti or rocks.
3. Press **Start wave**. Each blob you bonk earns gold, and clearing a wave pays a bonus. Calling the next wave early pays a little extra.
4. Click a tower to see its stats, change its targeting, upgrade it (up to level 4) or sell it for 70% of what you spent.
5. A blob that reaches the castle costs lives. If you run out, the castle falls. Beat wave 30 to win, then keep going in endless mode.

### Towers

| Tower | Cost | What it does |
| --- | --- | --- |
| Pebble Pal | 50 | Cheap, fast single-target shots. Twin barrels at level 4. |
| Boom Buddy | 90 | Lobs bombs that splash damage over a crowd. |
| Frost Puff | 80 | Snowballs slow every blob in a small area. |
| Zap Coil | 130 | Chain lightning that hops between blobs and ignores armor. |
| Hoot Sniper | 150 | Very long range and big hits that punch through armor. Targets the strongest blob by default. |

### Blobs

| Blob | Notes |
| --- | --- |
| Blob | The basic hopper. |
| Zippy | Small and fast. |
| Chonk | Slow, tanky and wears an armored helmet. |
| Splitter | Pops into two Minis when bonked. |
| Ghosty | Floats along and can't be slowed. |
| King Blob | A crowned boss on every 10th wave. Costs 10 lives if it gets in. |

### Controls

| Key | Action |
| --- | --- |
| `1`–`5` | Pick a tower to build |
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
- `game.js`: game data (maps, towers, enemies, waves), simulation, canvas rendering, sound and save/resume
- `manifest.webmanifest`, `sw.js`, `icons/`: what makes it installable and playable offline

Your current run (saved between waves) and best wave per map are kept in `localStorage` on your device.
