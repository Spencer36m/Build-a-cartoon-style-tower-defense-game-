# Blob Bash

A cartoon-style tower defense game for the browser. Jelly blobs with googly eyes hop down a dirt path toward your castle. Build silly towers to bonk them before they get inside, and survive 30 waves.

No build step and no dependencies: just HTML, CSS and one JavaScript file drawing on a `<canvas>`. Sound effects are synthesized live with the Web Audio API.

## Play it

Open `index.html` in a browser. Or serve the folder:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

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

Touch works too: tap a tower card, then tap a tile.

## Files

- `index.html`: page layout, HUD, side panel and overlays
- `style.css`: the chunky, inked cartoon UI
- `game.js`: game data (maps, towers, enemies, waves), simulation, canvas rendering and sound

Best wave per map is saved in `localStorage`.
