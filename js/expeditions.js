'use strict';
// ============================================================
// Wonder expeditions: one hand-made battle at each wonder on the globe, against zombies that
// belong to that place and a boss that guards it. Beating one earns the wonder's power.
// They are built to be earned: find the wonder on the globe, then open it with a Wonder Key
// (one for every 15 campaign stars). Every expedition fights like the end of the Fallen City,
// with 20 waves, 10 lives, less cash and no store supplies.
// ============================================================
const EXPED = (() => {
  const STARS_PER_KEY = 15, LIVES = 10, DIFF = 6.5, RECHARGE = 5, MAX_CHARGE = 2;
  // host: the campaign world whose painting, music and sky an expedition borrows (its colours
  // are its own). mobs: [type, first wave]; old: campaign zombies that join them.
  const LIST = {
    cinder: {
      id: 'cinder', name: 'Mount Cinder', boss: 'cinderKing', host: 4, seed: 9101, paths: 1, water: 'lava', block: true, burns: true,
      blurb: 'Lava flows cross the valley under the volcano. Every few waves it erupts and the lava closes more ground, burning any zombie that wades through.',
      mobs: [['ashwalker', 1], ['magma', 3], ['ember', 99]], old: [['runner', 2], ['brute', 8], ['scorpion', 5]], rush: 'magma',
      power: { name: 'Eruption', short: 'Erupt', kind: 'zone', target: true, desc: 'Lava rains on a spot you tap for six seconds, burning everything there.' },
      times: ['dusk', 'night'], forecast: { clear: 1, embers: 4, heat: 1.6 },
      pal: { lo: '#1e1816', mid: '#2e2622', hi: '#4a3e36', patchA: '#5a2a18', patchB: '#14100e', dirt: '#3a2e28', tuft: ['#3a2e22', '#54442e', '#6a3a22'] },
      roadBase: '#7a6a5c', waterLook: { lava: true, deep: '#ffc040', shallow: '#c8300a', bank: 'rgba(16,10,8,0.92)', foam: 'rgba(40,20,12,0.85)' },
      decor: ['basalt', 'basalt', 'basalt', 'vent', 'vent', 'deadtree', 'skull', 'rock'],
      intro: ['okafor', 'Mount Cinder. The heat cooks the strain into something new. Do not let them cross the lava.'],
      enrage: ['voss', 'Its plates are cracking off! Less armour, but it is faster. Pour it on!'],
      win: ['okafor', 'The mountain is quiet. I can take samples of the Cinder King. That fire is ours now.'],
      chatter: { mid: [['moreno', 'It is like fighting inside an oven.'], ['laila', 'Lava is moving. Watch the ground.']], last: [['voss', 'Last wave. The mountain is waking up.']], hurt: [['voss', 'They are through! Plug the gap!']], lose: [['voss', 'Pull back before the lava takes us too.']], winAny: [['voss', 'Mount Cinder is ours.']] },
    },
    kraken: {
      id: 'kraken', name: 'The Deep One', boss: 'kraken', host: 0, seed: 9203, paths: 1, water: 'sea',
      blurb: 'A drowned coast, mostly water, crossed on long bridges. Tentacles rise out of the sea to drag down zombies, and boats too.',
      mobs: [['sailor', 1], ['crab', 3]], old: [['runner', 2], ['bloater', 7], ['carrion', 10]], rush: 'sailor',
      power: { name: "Kraken's Grasp", short: 'Grasp', kind: 'grasp', desc: 'Tentacles burst out of the ground and drag the six strongest zombies under. Bosses only lose a chunk of health.' },
      times: ['dusk', 'day', 'night'], forecast: { clear: 1.4, rain: 3, storm: 2.6, fog: 2 },
      pal: { lo: '#36442e', mid: '#4a5a3a', hi: '#6a7650', patchA: '#8a8264', patchB: '#2e3a28', dirt: '#5a5040', tuft: ['#3a4a2c', '#5a6a3e', '#7a8a52'] },
      roadBase: '#6a6250', waterLook: { deep: '#0e2a3a', shallow: '#2e6a7a', bank: 'rgba(40,38,30,0.7)', foam: 'rgba(230,245,250,0.75)' },
      decor: ['rock', 'rock', 'anchor', 'rowboat', 'palm', 'barrel', 'nets'],
      intro: ['laila', 'The Deep One. Something huge is moving under that water. Stay off the bridges.'],
      enrage: ['moreno', 'It is angry now! Those tentacles are everywhere!'],
      win: ['laila', 'It sank. We are keeping one of its tentacles... on our side.'],
      chatter: { mid: [['moreno', 'I hate the sea. I hate it so much.'], ['laila', 'Bubbles by the bridge. Something is down there.']], last: [['voss', 'Last wave. The tide is turning.']], hurt: [['voss', 'They are on the beach! Hold!']], lose: [['voss', 'Back to the boats. The sea wins this one.']], winAny: [['voss', 'The coast is ours.']] },
    },
    dragon: {
      id: 'dragon', name: 'The Red Dragon', boss: 'boneWyrm', host: 1, seed: 9307, paths: 2, water: 'lake',
      blurb: "The Red Dragon's mountain. It fights on your side, flying over now and then to burn the horde, while its undead rival marches on the hoard.",
      mobs: [['kobold', 1], ['cultist', 3]], old: [['skeleton', 1], ['bucket', 5], ['necro', 9]], rush: 'kobold',
      power: { name: "Dragon's Breath", short: 'Breath', kind: 'lane', art: 'dragon', target: true, desc: 'The Red Dragon swoops down the lane you tap and torches it end to end.' },
      times: ['dusk', 'night', 'dawn'], forecast: { clear: 1.6, embers: 3.4, storm: 1 },
      pal: { lo: '#2a1612', mid: '#3e2418', hi: '#5a3622', patchA: '#6a4a2a', patchB: '#22120e', dirt: '#4a3020', tuft: ['#4a2a1a', '#6a4426', '#8a5a30'] },
      roadBase: '#6a5a4a', waterLook: { deep: '#16242a', shallow: '#3a525a' },
      decor: ['bones', 'bones', 'hoard', 'deadtree', 'rock', 'rock', 'skull', 'tomb'],
      intro: ['voss', 'The Red Dragon is on our side today. Its rival is not. Hold the pass and let it burn them.'],
      enrage: ['laila', 'Green fire! It is breathing faster now!'],
      win: ['voss', 'The Bone Wyrm is dust. The Red Dragon bowed to us, Commander. It will answer if we call.'],
      chatter: { mid: [['moreno', 'Did that dragon just wave at me?'], ['laila', 'Wings overhead. Ours, I think.']], last: [['voss', 'Last wave. Here comes the wyrm.']], hurt: [['voss', 'They are at the hoard!']], lose: [['voss', 'Fall back down the mountain.']], winAny: [['voss', 'The pass is ours.']] },
    },
    dinos: {
      id: 'dinos', name: 'Dino Valley', boss: 'rexMortis', host: 3, seed: 9419, paths: 1, water: 'river',
      blurb: 'A lost valley where the old giants woke up. Living dinosaurs graze beside the road and trample any zombie that wanders near them.',
      mobs: [['compy', 1], ['ankylo', 6]], old: [['runner', 1], ['brute', 9], ['cone', 4]], rush: 'compy',
      power: { name: 'Stampede', short: 'Stampede', kind: 'herd', desc: 'A herd charges back down the road from the safehouse, flattening every zombie in its way.' },
      times: ['day', 'dawn', 'dusk'], forecast: { clear: 2.4, rain: 2.4, mist: 1.6, storm: 1.2 },
      pal: { lo: '#24401a', mid: '#3a6024', hi: '#5a8a34', patchA: '#6a7a2a', patchB: '#1e3416', dirt: '#5a4a2a', tuft: ['#2a4a1a', '#4a7a2a', '#6a9a3a'] },
      roadBase: '#7a6040', waterLook: { deep: '#1a3a2a', shallow: '#3a7a5a' },
      decor: ['fern', 'fern', 'fern', 'palm', 'palm', 'nest', 'bones', 'rock'],
      intro: ['okafor', 'Dino Valley. The living ones hate the dead. Build near them and let them help.'],
      enrage: ['moreno', 'It is calling its friends! Armoured ones!'],
      win: ['okafor', 'Rex Mortis is down. The herd is following us now. Remarkable.'],
      chatter: { mid: [['moreno', 'Big one on the left is eating a zombie. Good boy.'], ['laila', 'Small ones, fast. Watch the gaps.']], last: [['voss', 'Last wave. Something big is shaking the ground.']], hurt: [['voss', 'They are in the camp!']], lose: [['voss', 'Back to the chopper. This valley wins.']], winAny: [['voss', 'The valley is ours.']] },
    },
    ufo: {
      id: 'ufo', name: 'Visitors', boss: 'abductor', host: 0, seed: 9533, paths: 2, water: 'lake',
      blurb: 'Crop circles in the fields and lights in the sky. Scout saucers beam your towers up and take them away for a few seconds.',
      mobs: [['grey', 1], ['cow', 4]], old: [['walker', 1], ['runner', 2], ['cone', 5], ['carrion', 8]], rush: 'grey',
      power: { name: 'Tractor Beam', short: 'Beam', kind: 'lift', desc: 'Lifts the strongest zombie on the map clean off it. Bosses are held still and hurt instead.' },
      times: ['night', 'night', 'dusk'], forecast: { clear: 3, fog: 2, storm: 1.2 },
      pal: null, roadBase: null, waterLook: null,
      decor: ['crops', 'crops', 'hay', 'fence', 'oak', 'cow', 'cow', 'barn'],
      intro: ['moreno', 'Visitors. Lights in the sky, cows in the road. I did not sign up for this.'],
      enrage: ['laila', 'More of them! It is beaming twice as fast!'],
      win: ['moreno', 'The saucer is down. And we kept the beam. I want to beam everything now.'],
      chatter: { mid: [['moreno', 'Another cow went up. Poor cow.'], ['laila', 'Lights overhead. Watch your towers.']], last: [['voss', 'Last wave. The big one is coming down.']], hurt: [['voss', 'They are through the fence!']], lose: [['voss', 'Fall back. Leave the farm to them.']], winAny: [['voss', 'The farm is ours again.']] },
    },
    ashen: {
      id: 'ashen', name: 'The Ashen Peaks', boss: 'ashWyrm', host: 4, seed: 9601, paths: 2, water: 'lavalakes', block: true, burns: true,
      blurb: 'Twin craters send the horde down two roads. Every few waves the sky fills with ash and every tower sees less far.',
      mobs: [['emberimp', 1], ['shardback', 4]], old: [['runner', 2], ['scorpion', 6], ['brute', 10]], rush: 'emberimp',
      power: { name: 'Ash Cloud', short: 'Ash', kind: 'ash', target: true, desc: 'A blinding cloud of ash on a spot you tap: zombies in it stumble, slow right down and take extra damage.' },
      times: ['dusk', 'night'], forecast: { clear: 1, embers: 4, dust: 1.4 },
      pal: { lo: '#26221f', mid: '#3a3430', hi: '#5a524a', patchA: '#4a2a1c', patchB: '#1a1614', dirt: '#3e3630', tuft: ['#3a342c', '#544a3a', '#6a4a2e'] },
      roadBase: '#847a70', waterLook: { lava: true, deep: '#ffc040', shallow: '#c8300a', bank: 'rgba(16,10,8,0.92)', foam: 'rgba(40,20,12,0.85)' },
      decor: ['basalt', 'basalt', 'vent', 'rock', 'rock', 'skull', 'deadtree'],
      intro: ['okafor', 'The Ashen Peaks. Two roads down from the craters, and the ash will blind our towers.'],
      enrage: ['laila', 'It is tearing up the road! Shardbacks behind it!'],
      win: ['okafor', 'The Ash Wyrm is still. We can call the ash down on them now.'],
      chatter: { mid: [['moreno', 'I cannot see a thing in this ash.'], ['laila', 'Two roads. Split the guns.']], last: [['voss', 'Last wave. The ground is moving.']], hurt: [['voss', 'They are through the ash!']], lose: [['voss', 'Pull back down the mountain.']], winAny: [['voss', 'The peaks are ours.']] },
    },
    wildfire: {
      id: 'wildfire', name: 'The Burning Wastes', boss: 'wendigo', host: 4, seed: 9617, paths: 1, water: 'none',
      blurb: 'Dry grass that has burned since the first week. Fire spreads across it every wave, burning zombies and slowing any tower it reaches.',
      mobs: [['husk', 1], ['smokehound', 4]], old: [['runner', 1], ['scorpion', 5], ['mummy', 8]], rush: 'smokehound',
      power: { name: 'Firestorm', short: 'Firestorm', kind: 'zone', ring: true, target: true, desc: 'A ring of fire round a spot you tap that burns everything inside for six seconds.' },
      times: ['dusk', 'day', 'night'], forecast: { clear: 1, embers: 3.5, heat: 2 },
      pal: { lo: '#6a5a2a', mid: '#8a7a3a', hi: '#aa9a52', patchA: '#5a3a1a', patchB: '#7a6a30', dirt: '#6a5030', tuft: ['#8a7a3a', '#a89448', '#5a4a24'] },
      roadBase: '#8a6e4e', waterLook: null,
      decor: ['deadtree', 'deadtree', 'sagebrush', 'sagebrush', 'rock', 'skull', 'wreck'],
      intro: ['laila', 'The Burning Wastes. The fire goes wherever it likes. Keep the towers off the dry grass if you can.'],
      enrage: ['moreno', 'It is on fire and it is faster! Why is it faster?'],
      win: ['laila', 'The Wendigo burned out. The fire answers to us now.'],
      chatter: { mid: [['moreno', 'Everything here is on fire. Everything.'], ['laila', 'Smoke on the road. Hounds in it.']], last: [['voss', 'Last wave. Here it comes.']], hurt: [['voss', 'They are through the flames!']], lose: [['voss', 'Fall back before the fire takes us.']], winAny: [['voss', 'The wastes are ours.']] },
    },
    emberwood: {
      id: 'emberwood', name: 'Emberwood', boss: 'oak', host: 1, seed: 9631, paths: 1, water: 'river',
      blurb: 'A forest that never stopped smouldering. Smoke drifts over the road and hides zombies until they come close to a tower.',
      mobs: [['treant', 3], ['sprite', 1]], old: [['walker', 1], ['runner', 2], ['ghost', 6]], rush: 'sprite',
      power: { name: 'Smoke Screen', short: 'Smoke', kind: 'reverse', target: true, desc: 'Thick smoke on a spot you tap: zombies inside lose their way and walk back for five seconds.' },
      times: ['dusk', 'night', 'dawn'], forecast: { clear: 1, fog: 2.4, embers: 2.6 },
      pal: { lo: '#1e1a16', mid: '#2e2820', hi: '#46392a', patchA: '#3a2214', patchB: '#16120e', dirt: '#3a2e22', tuft: ['#2a2418', '#3e3222', '#5a3a1e'] },
      roadBase: '#6a5a48', waterLook: { deep: '#1a1e1a', shallow: '#3a4234' },
      decor: ['deadtree', 'deadtree', 'deadtree', 'log', 'rock', 'mushroom', 'bush'],
      intro: ['voss', 'Emberwood. You will not see them in the smoke until they are on top of a tower. Spread your guns along the road.'],
      enrage: ['laila', 'The trees are moving! Sprites everywhere!'],
      win: ['voss', 'The Oak is ash. And the smoke is on our side now.'],
      chatter: { mid: [['moreno', 'I hear them in the smoke.'], ['laila', 'Treant on the road. Big one.']], last: [['voss', 'Last wave. Something huge is walking.']], hurt: [['voss', 'They came out of the smoke!']], lose: [['voss', 'Back through the trees.']], winAny: [['voss', 'The wood is ours.']] },
    },
    raptors: {
      id: 'raptors', name: 'Raptor Plains', boss: 'packAlpha', host: 0, seed: 9643, paths: 2, water: 'lake',
      blurb: 'Open plains of tall grass. Zombies on the grassy stretches of road are hidden until they cross an open patch or pass close to a tower.',
      mobs: [['raptor', 1], ['rider', 6]], old: [['runner', 1], ['walker', 1], ['brute', 9]], rush: 'raptor',
      power: { name: 'Raptor Pack', short: 'Pack', kind: 'hunters', desc: 'A pack of wild raptors hunts the horde for fifteen seconds.' },
      times: ['day', 'dusk', 'dawn'], forecast: { clear: 3, dust: 2, storm: 1 },
      pal: { lo: '#5a5a24', mid: '#7a7a34', hi: '#9a9a48', patchA: '#8a7a3a', patchB: '#4a5a24', dirt: '#7a6440', tuft: ['#8a8a3a', '#a8a44a', '#6a6a2a'] },
      roadBase: '#8a7050', waterLook: null,
      decor: ['bush', 'bush', 'rock', 'oak', 'bones', 'hay'],
      intro: ['laila', 'Raptor Plains. The grass hides them. Watch the open patches.'],
      enrage: ['moreno', 'She is calling riders! Zombies riding raptors!'],
      win: ['laila', 'The Alpha is down. The pack follows us now.'],
      chatter: { mid: [['moreno', 'Something just moved in the grass.'], ['laila', 'Fast ones. Lead your shots.']], last: [['voss', 'Last wave. The Alpha is coming.']], hurt: [['voss', 'They are through the grass!']], lose: [['voss', 'Fall back to the trucks.']], winAny: [['voss', 'The plains are ours.']] },
    },
    pteros: {
      id: 'pteros', name: 'The Pterosaur Cliffs', boss: 'quetzal', host: 0, seed: 9659, paths: 1, water: 'sea',
      blurb: 'Sea cliffs where most of the horde flies in, and the rest climb the rocks to cut the corners of the road.',
      mobs: [['ptero', 2], ['cliffcrawler', 4]], old: [['walker', 1], ['carrion', 4], ['bats', 8]], rush: 'ptero',
      power: { name: 'Dive Bomb', short: 'Dive', kind: 'lane', art: 'ptero', target: true, desc: 'Pterosaurs dive down the lane you tap, striking everything on it.' },
      times: ['day', 'dusk'], forecast: { clear: 2, rain: 2, storm: 2, fog: 1 },
      pal: { lo: '#4a5044', mid: '#62685a', hi: '#82887a', patchA: '#6a6050', patchB: '#3a4038', dirt: '#5a5446', tuft: ['#4a5a3a', '#6a7a4a', '#8a8a6a'] },
      roadBase: '#8a8274', waterLook: { deep: '#123040', shallow: '#3a7080', bank: 'rgba(60,56,48,0.8)', foam: 'rgba(240,248,250,0.8)' },
      decor: ['rock', 'rock', 'rock', 'nest', 'bones', 'bush'],
      intro: ['moreno', 'Pterosaur Cliffs. Most of them fly. Build anti-air or lose.'],
      enrage: ['laila', 'It is snatching towers faster! Crawlers on the cliffs!'],
      win: ['moreno', 'The Wraith fell into the sea. The real pterosaurs dive for us now.'],
      chatter: { mid: [['moreno', 'Wings. So many wings.'], ['laila', 'Climbers on the rocks, cutting the corner.']], last: [['voss', 'Last wave. Look up.']], hurt: [['voss', 'They are over the wall!']], lose: [['voss', 'Back from the cliffs.']], winAny: [['voss', 'The cliffs are ours.']] },
    },
    starfall: {
      id: 'starfall', name: 'Starfall Crater', boss: 'starborn', host: 4, seed: 9673, paths: 1, water: 'none',
      blurb: 'Where the green meteor struck. Its crystal grows over more ground every wave, and zombies standing on it heal.',
      mobs: [['crystalhusk', 1], ['seed', 4]], old: [['walker', 1], ['runner', 2], ['frosty', 7]], rush: 'seed',
      power: { name: 'Meteor Strike', short: 'Meteor', kind: 'meteor', target: true, desc: 'One huge impact on a spot you tap, a moment after you call it.' },
      times: ['night', 'dusk'], forecast: { clear: 2.4, dust: 1.4, embers: 1.2 },
      pal: { lo: '#2a2e26', mid: '#3e4436', hi: '#5a604a', patchA: '#2a3a24', patchB: '#1e221c', dirt: '#4a4a3a', tuft: ['#3a4a2a', '#4a5a34', '#2a3a20'] },
      roadBase: '#7a7666', waterLook: null,
      decor: ['crystal', 'crystal', 'rock', 'rock', 'skull', 'wreck'],
      intro: ['okafor', 'Starfall Crater. That crystal heals them. Kill them before they reach it.'],
      enrage: ['okafor', 'It is splitting seeds everywhere! Crush them!'],
      win: ['okafor', 'The Starborn is broken. And the sky answers us now.'],
      chatter: { mid: [['moreno', 'The crystal is spreading. I hate this place.'], ['laila', 'They are healing on the green.']], last: [['voss', 'Last wave. The meteor is moving.']], hurt: [['voss', 'They are through the crater!']], lose: [['voss', 'Back from the crater.']], winAny: [['voss', 'The crater is ours.']] },
    },
    spires: {
      id: 'spires', name: 'The Crystal Spires', boss: 'prism', host: 1, seed: 9689, paths: 2, water: 'none',
      blurb: 'Floating crystals hum over the plain. Towers built beside a crystal fire faster, so build round them.',
      mobs: [['wisp', 1], ['golem', 5]], old: [['walker', 1], ['frosty', 3], ['bats', 7]], rush: 'wisp',
      power: { name: 'Crystal Field', short: 'Crystal', kind: 'slowall', desc: 'Every zombie on the map slows right down for six seconds.' },
      times: ['night', 'dusk', 'dawn'], forecast: { clear: 2, fog: 2, snow: 1 },
      pal: { lo: '#2a2838', mid: '#3e3a52', hi: '#5a546e', patchA: '#4a3a6a', patchB: '#22202e', dirt: '#4a465a', tuft: ['#4a4a6a', '#5a5a7a', '#3a3a5a'] },
      roadBase: '#7a7688', waterLook: null,
      decor: ['crystal', 'crystal', 'crystal', 'rock', 'rock', 'deadtree'],
      intro: ['okafor', 'The Crystal Spires. Build beside the crystals and your towers fire faster.'],
      enrage: ['laila', 'The beam is coming faster! Golems!'],
      win: ['okafor', 'The Colossus shattered. The crystals hum for us now.'],
      chatter: { mid: [['moreno', 'Pretty. Deadly, but pretty.'], ['laila', 'Wisps blinking forward. Watch them.']], last: [['voss', 'Last wave. The big crystal is moving.']], hurt: [['voss', 'They are through the spires!']], lose: [['voss', 'Back from the spires.']], winAny: [['voss', 'The spires are ours.']] },
    },
    rift: {
      id: 'rift', name: 'The Rift', boss: 'unmade', host: 1, seed: 9697, paths: 1, water: 'none',
      blurb: 'A tear in the sky. Portals open along the road and zombies jump from one to the next, skipping whole stretches of it.',
      mobs: [['voidwraith', 1], ['shadowhound', 6]], old: [['walker', 1], ['ghost', 2], ['necro', 8]], rush: 'shadowhound',
      power: { name: 'Rift Pull', short: 'Pull', kind: 'pull', target: true, desc: 'Every zombie round a spot you tap is pulled back toward the start of the road.' },
      times: ['night'], forecast: { clear: 1.4, fog: 3, storm: 1.4 },
      pal: { lo: '#1a1424', mid: '#2a2236', hi: '#3e344e', patchA: '#3a1a4a', patchB: '#120e1a', dirt: '#3a3046', tuft: ['#2a2238', '#3a2e4a', '#4a3a5a'] },
      roadBase: '#6a6078', waterLook: null,
      decor: ['deadtree', 'deadtree', 'rock', 'tomb', 'crystal'],
      intro: ['voss', 'The Rift. They come out of those portals further down the road. Cover the exits.'],
      enrage: ['moreno', 'It blinked! Hounds out of the dark!'],
      win: ['voss', 'The eye closed. We can bend the Rift ourselves now.'],
      chatter: { mid: [['moreno', 'I do not like the sky here.'], ['laila', 'Portal open. They are skipping ahead.']], last: [['voss', 'Last wave. The eye is open.']], hurt: [['voss', 'They came through a portal!']], lose: [['voss', 'Close the line. Fall back.']], winAny: [['voss', 'The Rift is quiet.']] },
    },
    stones: {
      id: 'stones', name: 'Circle of Runes', boss: 'warden', host: 0, seed: 9719, paths: 1, water: 'lake',
      blurb: 'Standing stones carved with glowing runes. A tower next to a runestone hits harder, and a zombie passing one grows stone skin.',
      mobs: [['thrall', 1], ['druid', 7]], old: [['walker', 1], ['runner', 2], ['bucket', 6]], rush: 'runner',
      power: { name: 'Rune Ward', short: 'Ward', kind: 'ward', desc: 'The next five zombies that reach your base cost no lives.' },
      times: ['dusk', 'night', 'dawn'], forecast: { clear: 1.6, fog: 3, rain: 1.6 },
      pal: { lo: '#2e3e2a', mid: '#425a38', hi: '#5e7650', patchA: '#5a5a3a', patchB: '#24321e', dirt: '#4a4634', tuft: ['#3a4e2a', '#56703a', '#6e844a'] },
      roadBase: '#7a7262', waterLook: null,
      decor: ['runestone', 'runestone', 'runestone', 'rock', 'bush', 'oak'],
      intro: ['okafor', 'The Circle of Runes. Build beside the stones. Keep the horde away from them.'],
      enrage: ['laila', 'The stones are shielding them! Druids!'],
      win: ['okafor', 'The Warden is just a stone again. The runes will guard our base.'],
      chatter: { mid: [['moreno', 'The stones are humming.'], ['laila', 'Druid on the road. Healing them.']], last: [['voss', 'Last wave. The circle is waking.']], hurt: [['voss', 'They are past the stones!']], lose: [['voss', 'Leave the circle.']], winAny: [['voss', 'The circle is ours.']] },
    },
    ghostship: {
      id: 'ghostship', name: 'The Ghost Ship', boss: 'blackwake', host: 3, seed: 9733, paths: 1, water: 'sea',
      blurb: 'A night of thick sea fog on a drowned shore. Ghosts fade out for a few seconds at a time, where no tower can hit them.',
      mobs: [['deckhand', 1], ['ghostpirate', 3]], old: [['skeleton', 1], ['ghost', 4], ['bloater', 8]], rush: 'deckhand',
      power: { name: 'Broadside', short: 'Cannon', kind: 'lane', art: 'cannon', target: true, desc: 'A volley of cannonballs down the lane you tap.' },
      times: ['night'], forecast: { fog: 4, mist: 2, rain: 1.4 },
      pal: { lo: '#3a3a2e', mid: '#4e4e3e', hi: '#6a6852', patchA: '#5a5440', patchB: '#2e2e24', dirt: '#5a5240', tuft: ['#3e4430', '#545a3e', '#6a6a4a'] },
      roadBase: '#7a7262', waterLook: { deep: '#0c1c24', shallow: '#2a4a52', foam: 'rgba(200,240,230,0.6)' },
      decor: ['rowboat', 'anchor', 'barrel', 'rock', 'rock', 'nets'],
      intro: ['laila', 'The Ghost Ship. They fade in and out of the fog. Keep firing; they always come back.'],
      enrage: ['moreno', 'Broadside! And more ghosts!'],
      win: ['laila', 'The captain sank with his ship. His cannons answer to us.'],
      chatter: { mid: [['moreno', 'I can hear a ship bell.'], ['laila', 'Ghosts fading. Wait for them.']], last: [['voss', 'Last wave. The captain is ashore.']], hurt: [['voss', 'They came out of the fog!']], lose: [['voss', 'Back from the shore.']], winAny: [['voss', 'The shore is ours.']] },
    },
    eldertree: {
      id: 'eldertree', name: 'The Elder Tree', boss: 'blight', host: 3, seed: 9749, paths: 2, water: 'river',
      blurb: 'You defend the Elder Tree itself. Its roots slow every zombie that comes near it, but a blight spreads over more ground each wave and slows any tower in it.',
      mobs: [['dryad', 1], ['puffer', 4]], old: [['walker', 1], ['imp', 2], ['medic', 8]], rush: 'dryad',
      power: { name: 'Elder Roots', short: 'Roots', kind: 'root', desc: 'Roots burst up all over the map and hold every zombie in place for four seconds.' },
      times: ['day', 'dawn', 'dusk'], forecast: { clear: 2, mist: 2.4, rain: 2 },
      pal: { lo: '#1e3a1a', mid: '#2e5426', hi: '#467436', patchA: '#3a5a24', patchB: '#183014', dirt: '#4a3e26', tuft: ['#2a4a1e', '#3e6a2a', '#5a8a36'] },
      roadBase: '#6a5a3e', waterLook: { deep: '#14301e', shallow: '#3a6a44' },
      decor: ['cypress', 'cypress', 'bush', 'fern', 'mushroom', 'mushroom'],
      intro: ['okafor', 'The Elder Tree. Nothing undead can touch its roots. Keep the blight off it.'],
      enrage: ['laila', 'The blight is spreading fast! Dryads in the leaves!'],
      win: ['okafor', 'The Blight withered. The tree will lend us its roots.'],
      chatter: { mid: [['moreno', 'The tree is creaking. I think it is angry.'], ['laila', 'Spores. Do not breathe.']], last: [['voss', 'Last wave. The Blight is coming for the tree.']], hurt: [['voss', 'They are at the roots!']], lose: [['voss', 'Back from the tree.']], winAny: [['voss', 'The tree stands.']] },
    },
    skyhold: {
      id: 'skyhold', name: 'Skyhold', boss: 'harbinger', host: 0, seed: 9767, paths: 1, water: 'sky', block: true,
      blurb: 'A floating island, open sky all round it. Zombies drop in by parachute partway down the road, not just at its start.',
      mobs: [['para', 1], ['gull', 4]], old: [['walker', 1], ['runner', 2], ['carrion', 6]], rush: 'gull',
      power: { name: 'Thunderstrike', short: 'Thunder', kind: 'strike', desc: 'Lightning hits the five strongest zombies on the map.' },
      times: ['day', 'dusk'], forecast: { clear: 2, storm: 2.6, rain: 2 },
      pal: { lo: '#3a5a2a', mid: '#4e743a', hi: '#6e924a', patchA: '#7a7a4a', patchB: '#2e4a22', dirt: '#6a5a3e', tuft: ['#3e5e2a', '#5a7e3a', '#7a9a4a'] },
      roadBase: '#8a7a5e', waterLook: { deep: '#c8e0f0', shallow: '#8ab8dc', bank: 'rgba(80,70,50,0.7)', foam: 'rgba(255,255,255,0.85)' },
      decor: ['oak', 'bush', 'rock', 'barrel', 'drums', 'hay'],
      intro: ['moreno', 'Skyhold. They are jumping out of planes. The whole road is the front line.'],
      enrage: ['laila', 'Lightning! And gulls, hundreds of gulls!'],
      win: ['moreno', 'The storm cleared. And we keep the lightning.'],
      chatter: { mid: [['moreno', 'Chutes! Look up!'], ['laila', 'They landed behind our line.']], last: [['voss', 'Last wave. Storm incoming.']], hurt: [['voss', 'They dropped right on us!']], lose: [['voss', 'Get to the airship.']], winAny: [['voss', 'The island is ours.']] },
    },
    temple: {
      id: 'temple', name: 'The Sun Temple', boss: 'sunPriest', host: 4, seed: 9781, paths: 1, water: 'lake',
      blurb: 'The temple beam sweeps across the map every few seconds and burns whatever it touches, yours or theirs.',
      mobs: [['scarabs', 1], ['suncultist', 3]], old: [['mummy', 1], ['runner', 2], ['scorpion', 6]], rush: 'scarabs',
      power: { name: 'Sunbeam', short: 'Sunbeam', kind: 'sweep', desc: 'A beam of sunlight runs back along the road from your base, burning everything it passes.' },
      times: ['day', 'dusk'], forecast: { clear: 3, heat: 3, sandstorm: 1 },
      pal: null, roadBase: '#b89a6a', waterLook: { deep: '#1a5a5a', shallow: '#5ab8a8' },
      decor: ['pillar', 'pillar', 'palm', 'palm', 'mesa', 'cactus'],
      intro: ['laila', 'The Sun Temple. That beam burns us as well as them. Time your towers.'],
      enrage: ['okafor', 'The beam is focusing! Cultists!'],
      win: ['laila', 'The Priest is down. The sun is on our side.'],
      chatter: { mid: [['moreno', 'It is so hot my gun is sweating.'], ['laila', 'Beam coming round. Heads down.']], last: [['voss', 'Last wave. The Priest walks.']], hurt: [['voss', 'They are past the pillars!']], lose: [['voss', 'Out of the sun. Fall back.']], winAny: [['voss', 'The temple is ours.']] },
    },
    moonwell: {
      id: 'moonwell', name: 'The Moonwell', boss: 'lunarAlpha', host: 1, seed: 9797, paths: 1, water: 'lake',
      blurb: 'The moon waxes wave by wave. Every fifth wave it is full, and the zombies heal and speed up under it.',
      mobs: [['werewolf', 1], ['moth', 3]], old: [['walker', 1], ['runner', 2], ['bats', 6]], rush: 'runner',
      power: { name: 'Moonwell', short: 'Well', kind: 'lives', desc: 'Restores ten lives.' },
      times: ['night'], forecast: { clear: 3, fog: 2, mist: 1.4 },
      pal: { lo: '#1e2638', mid: '#2a344c', hi: '#404c66', patchA: '#2a3a4a', patchB: '#161c2a', dirt: '#3a4050', tuft: ['#2a3a4a', '#3a4a5e', '#4a5a72'] },
      roadBase: '#6a7084', waterLook: { deep: '#2a4a8a', shallow: '#a8c8ff', foam: 'rgba(230,240,255,0.85)' },
      decor: ['deadtree', 'pine', 'rock', 'rock', 'mushroom', 'tomb'],
      intro: ['voss', 'The Moonwell. When the moon is full, they heal. Kill them between the full moons.'],
      enrage: ['moreno', 'It howled! The whole pack is coming!'],
      win: ['voss', 'The Alpha is down. The well will heal us instead.'],
      chatter: { mid: [['moreno', 'Is that a werewolf? A zombie werewolf?'], ['laila', 'Moths in the lights.']], last: [['voss', 'Last wave. Full moon.']], hurt: [['voss', 'They are at the well!']], lose: [['voss', 'Leave the well.']], winAny: [['voss', 'The well is ours.']] },
    },
    zero: {
      id: 'zero', name: 'Ground Zero', boss: 'subjectZero', host: 5, seed: 9811, paths: 2, water: 'none', waves: 30, bossWaves: [10, 20],
      blurb: 'Survival in the ruins of the HC-1 lab. Thirty waves, and Subject Zero comes back every ten of them, stronger each time.',
      mobs: [['subject', 1], ['hazmat', 4]], old: [['walker', 1], ['runner', 2], ['cone', 3], ['bucket', 7], ['brute', 11], ['swat', 16]], rush: 'subject',
      power: { name: 'Lazarus Pulse', short: 'Pulse', kind: 'pulse', desc: 'A wave of the cure hits every zombie on the map.' },
      times: ['night', 'dusk'], forecast: { clear: 2, acid: 2, fog: 2 },
      pal: null, roadBase: null, waterLook: null,
      decor: ['office', 'apartment', 'shop', 'drums', 'drums', 'barricade', 'dumpster', 'wreck', 'barrel', 'parking'],
      intro: ['okafor', 'Ground Zero. Where it began. Subject Zero is still in there. It keeps coming back.'],
      enrage: ['okafor', 'It is calling the hazmat team! Same as the first night!'],
      win: ['okafor', 'Thirty waves. It is over here. I can make the cure work as a weapon now.'],
      chatter: { mid: [['moreno', 'This is where it started. I want to leave.'], ['laila', 'Hazmat suits. Fire and frost will not touch them.']], last: [['voss', 'Last wave. Zero is coming.']], hurt: [['voss', 'They are in the lab!']], lose: [['voss', 'Seal the lab. Fall back.']], winAny: [['voss', 'Ground Zero is ours.']] },
    },
  };
  // in the order the design sheet lists them
  const ORDER = ['cinder', 'ashen', 'wildfire', 'emberwood', 'dinos', 'raptors', 'pteros', 'starfall', 'spires', 'rift', 'ufo', 'stones', 'temple', 'eldertree', 'moonwell', 'kraken', 'ghostship', 'skyhold', 'dragon', 'zero'];
  const ICONS = {
    cinder: '<svg viewBox="0 0 24 24"><path d="M3 21l6-11 3 4 2-3 7 10zM12 3c1 2 3 2 3 4s-2 3-3 3-3-1-3-3 2-2 3-4z"/></svg>',
    kraken: '<svg viewBox="0 0 24 24"><path d="M12 3a6 6 0 0 1 6 6c0 2-1 3-2 4l1 6c0 1-2 2-2 0l-1-5h-1v6h-2v-6H10l-1 5c0 2-2 1-2 0l1-6c-1-1-2-2-2-4a6 6 0 0 1 6-6z"/></svg>',
    dragon: '<svg viewBox="0 0 24 24"><path d="M2 12l7-3 3-6 2 6 8 1-6 3 2 8-6-5-5 4 1-6z"/></svg>',
    dinos: '<svg viewBox="0 0 24 24"><path d="M3 18c2-6 6-9 11-9 3 0 4-3 7-3l-1 4-3 1 1 3-2 1v4h-2v-3h-4v3H8v-3l-3 2z"/></svg>',
    ufo: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="10" rx="10" ry="3.5"/><path d="M8 9a4 4 0 0 1 8 0M8 14l-2 7M16 14l2 7M12 14v7"/></svg>',
    ashen: '<svg viewBox="0 0 24 24"><path d="M4 16a4 4 0 0 1 2-7 6 6 0 0 1 11-1 4.5 4.5 0 0 1 2 8.5zM7 19h2M11 20h2M15 19h2"/></svg>',
    wildfire: '<svg viewBox="0 0 24 24"><path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-4-1-6 1-9z"/></svg>',
    emberwood: '<svg viewBox="0 0 24 24"><path d="M3 15c2-2 4-1 6-3s4-3 6-1 3 0 6-2v4c-3 2-4 1-6 3s-4 2-6 1-4 0-6 2z"/></svg>',
    raptors: '<svg viewBox="0 0 24 24"><path d="M2 14l6-2 4-5 5-1 5 3-4 1-2 3 1 6h-2l-2-5-4 2-2 4H5l1-5z"/></svg>',
    pteros: '<svg viewBox="0 0 24 24"><path d="M1 9l9 3 2-3 2 3 9-3-7 6-4-1-4 1z"/></svg>',
    starfall: '<svg viewBox="0 0 24 24"><circle cx="15" cy="15" r="5"/><path d="M2 2l9 9-2 1 1 1M5 2l6 6M2 5l6 6"/></svg>',
    spires: '<svg viewBox="0 0 24 24"><path d="M12 2l4 7-4 13-4-13zM5 8l2 4-2 6-2-6zM19 8l2 4-2 6-2-6z"/></svg>',
    rift: '<svg viewBox="0 0 24 24"><path d="M12 2c3 3 4 6 3 10s-1 7 1 10c-3-2-6-5-6-10s0-7 2-10z"/></svg>',
    stones: '<svg viewBox="0 0 24 24"><path d="M4 21V9l3-3 3 3v12zM14 21V7l3-3 3 3v14zM6 12l2 2-2 2M16 10l2 2-2 2"/></svg>',
    temple: '<svg viewBox="0 0 24 24"><circle cx="12" cy="7" r="4"/><path d="M3 21h18l-2-4H5zM6 17l2-4h8l2 4"/></svg>',
    eldertree: '<svg viewBox="0 0 24 24"><path d="M12 2a7 7 0 0 1 7 7 5 5 0 0 1-5 5h-1v5l3 3H8l3-3v-5h-1a5 5 0 0 1-5-5 7 7 0 0 1 7-7z"/></svg>',
    moonwell: '<svg viewBox="0 0 24 24"><path d="M14 3a8 8 0 1 0 7 11 7 7 0 0 1-7-11z"/></svg>',
    ghostship: '<svg viewBox="0 0 24 24"><path d="M3 15h18l-3 5H6zM11 3v11H5zM13 5l6 9h-6z"/></svg>',
    skyhold: '<svg viewBox="0 0 24 24"><path d="M13 2L4 14h7l-2 8 10-12h-7z"/></svg>',
    zero: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2a10 10 0 0 1 9 6l-6 3M3 8a10 10 0 0 1 9-6l0 7M6 20a10 10 0 0 1-3-9l6 2M21 11a10 10 0 0 1-3 9l-4-5"/></svg>',
  };

  // ---------- progress ----------
  const st = () => { if (!meta.exp) meta.exp = { open: [], won: {}, charge: {}, tick: 0 }; return meta.exp; };
  const has = (id) => !!LIST[id];
  const dev = () => !!meta.dev;
  const isOpen = (id) => dev() || st().open.includes(id);
  const wonStars = (id) => st().won[id] | 0;
  function campaignStars() { let n = 0; for (const k of Object.keys(meta.stars)) n += meta.stars[k] | 0; return n; }
  const keysEarned = () => Math.floor(campaignStars() / STARS_PER_KEY);
  const keysLeft = () => Math.max(0, keysEarned() - st().open.length);
  const starsToKey = () => STARS_PER_KEY - (campaignStars() % STARS_PER_KEY);
  function unlock(id) {
    if (isOpen(id) || keysLeft() <= 0) return false;
    st().open.push(id); saveMeta();
    return true;
  }

  // ---------- the battlefield ----------
  function world(X) {
    const host = WORLDS[X.host];
    return {
      ...host, decor: X.decor, times: X.times, forecast: X.id,
      ...(X.pal ? { pal: X.pal } : {}), ...(X.roadBase ? { roadBase: X.roadBase } : {}), ...(X.waterLook ? { waterLook: X.waterLook } : {}),
    };
  }
  // a coastline: the sea along one side, with a channel cutting inland
  function seaMask(rng) {
    const m = new Uint8Array(COLS * ROWS), side = rng() < 0.5 ? 'bottom' : 'top', ph = rng() * TAU;
    for (let x = 0; x < COLS; x++) {
      const d = Math.round(3.4 + Math.sin(x * 0.45 + ph) * 1.3 + Math.sin(x * 1.1 + ph * 2) * 0.6);
      for (let k = 0; k < d; k++) m[(side === 'bottom' ? ROWS - 1 - k : k) * COLS + x] = 1;
    }
    const ch = makeWater(rng, 'river');
    for (let i = 0; i < m.length; i++) if (ch[i]) m[i] = 1;
    const lake = makeWater(rng, 'lake');
    for (let i = 0; i < m.length; i++) if (lake[i]) m[i] = 1;
    return m;
  }
  // a floating island: open sky round its edges, with the odd hole in the middle
  function skyMask(rng) {
    const m = new Uint8Array(COLS * ROWS), ph = rng() * TAU;
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const edge = Math.min(x, y, COLS - 1 - x, ROWS - 1 - y), w = 1.2 + Math.sin(x * 0.7 + y * 0.5 + ph) * 0.8;
      if (edge < w) m[y * COLS + x] = 1;
    }
    const hole = makeWater(rng, 'lake');
    for (let i = 0; i < m.length; i++) if (hole[i]) m[i] = 1;
    return m;
  }
  const LEVELS = new Map();
  function level(id) {
    if (LEVELS.has(id)) return LEVELS.get(id);
    const X = LIST[id];
    let attempt = 0, main = null, entry = null, rng;
    while (!main) {
      rng = mulberry32(X.seed + attempt * 7);
      entry = entryFor(rng, [0, 0, 1, 2, 3][Math.floor(rng() * 5)]);
      main = tryMainPath(rng, 40 - Math.floor(attempt / 4), 54 + Math.floor(attempt / 4), entry);
      attempt++;
    }
    const paths = [toWaypoints(entry.off, main)], pathTiles = [main];
    for (let k = 0; X.paths > 1 && k < 10 && paths.length < 2; k++) {
      const sec = trySecondPath(rng, main, [1, 2, 0, 3][Math.floor(rng() * 4)]);
      if (sec) { paths.push(toWaypoints(sec.off, sec.tiles)); pathTiles.push(sec.tiles); }
    }
    const onPath = new Uint8Array(COLS * ROWS);
    for (const tl of pathTiles) for (const [x, y] of tl) onPath[y * COLS + x] = 1;
    let water = new Uint8Array(COLS * ROWS);
    const both = (a, b) => { for (let i = 0; i < water.length; i++) water[i] = a[i] || b[i] ? 1 : 0; };
    if (X.water === 'sea') water = seaMask(rng);
    else if (X.water === 'lava') both(makeWater(rng, 'river'), makeWater(rng, 'river'));
    else if (X.water === 'lavalakes') both(makeWater(rng, 'lake'), makeWater(rng, 'lake'));
    else if (X.water === 'river') water = makeWater(rng, 'river');
    else if (X.water === 'lake') water = makeWater(rng, 'lake');
    else if (X.water === 'sky') water = skyMask(rng);
    const end = main[main.length - 1];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const x = end[0] + dx, y = end[1] + dy; if (x >= 0 && y >= 0 && x < COLS && y < ROWS) water[y * COLS + x] = 0; }
    // every map keeps enough dry ground to build on
    const limit = { sea: 0.42, sky: 0.4, lava: 0.2, lavalakes: 0.2 }[X.water] || 0.16;
    let wet = 0; for (let i = 0; i < water.length; i++) if (water[i] && !onPath[i]) wet++;
    if (wet > COLS * ROWS * limit) for (let i = 0; i < water.length; i++) if (water[i] && !onPath[i] && rng() < 1 - (COLS * ROWS * limit) / wet) water[i] = 0;
    const bridges = new Uint8Array(COLS * ROWS);
    for (let i = 0; i < water.length; i++) if (water[i] && onPath[i]) bridges[i] = 1;
    const decor = [];
    let tries = 0;
    const want = (X.host === 5 ? 22 : 14) + Math.floor(rng() * 6);
    while (decor.length < want && tries++ < 600) {
      const x = Math.floor(rng() * COLS), y = Math.floor(rng() * ROWS), k = y * COLS + x;
      if (onPath[k] || water[k] || decor.some((d) => d.c === x && d.r === y)) continue;
      if (Math.abs(x - end[0]) <= 1 && Math.abs(y - end[1]) <= 1) continue;
      const kind = X.decor[Math.floor(rng() * X.decor.length)];
      decor.push({ kind, c: x, r: y, x: x * TILE + TILE / 2 + (rng() - 0.5) * 10, y: y * TILE + TILE / 2 + (rng() - 0.5) * 10, s: 0.85 + rng() * 0.3, rot: rng() * TAU, seed: Math.floor(rng() * 1e6) });
    }
    const pool = [...X.mobs.filter(([, f]) => f < 99), ...X.old];
    const L = {
      index: -1, world: X.host, tier: 6, num: 99, id: 'EXP', name: X.name, exp: id, worldDef: world(X),
      waves: X.waves || 20, bossWaves: X.bossWaves || null, diff: DIFF, gold: Math.round((260 + DIFF * 55) * 0.95), boss: X.boss, rush: X.rush,
      paths, water, bridges, decor, pool, t: 1,
      look: { time: X.times[Math.floor(rng() * X.times.length)], weather: Object.keys(X.forecast)[0], tone: 0, seed: X.seed * 13 },
    };
    LEVELS.set(id, L);
    return L;
  }

  // ---------- one battle's state ----------
  let R = null; // the twist's moving parts for the expedition being played
  function begin(L, M) {
    const X = LIST[L.exp];
    R = fresh(L.exp);
    R.burns = !!X.burns;
    if (X.block) {
      // lava and open sky are impassable: nothing can be built on them, not even boats
      R.lava = L.water.slice();
      for (let i = 0; i < R.lava.length; i++) if (R.lava[i] && M.grid[i] === 3) M.grid[i] = 4;
      R.fresh = [];
      if (X.burns) paintLava(M);
    }
    const rng = mulberry32(L.look.seed + 11), N = COLS * ROWS, road = [];
    for (let i = 0; i < N; i++) if (M.grid[i] === 1) road.push(i);
    if (L.exp === 'raptors') {
      // stretches of road deep in tall grass
      R.hide = new Uint8Array(N);
      const seeds = shuffle(rng, road.slice()).slice(0, 5);
      for (const k of seeds) { const c = k % COLS, r = Math.floor(k / COLS); for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const x = c + dx, y = r + dy; if (x >= 0 && y >= 0 && x < COLS && y < ROWS && Math.abs(dx) + Math.abs(dy) <= 3 && M.grid[y * COLS + x] <= 1) R.hide[y * COLS + x] = 1; } }
    }
    if (L.exp === 'emberwood') for (let i = 0; i < 4; i++) R.smoke.push({ x: rng() * W, y: rng() * H, r: TILE * (1.6 + rng() * 0.8), vx: (rng() - 0.5) * 14, vy: (rng() - 0.5) * 10 });
    if (L.exp === 'wildfire') { R.fire = new Float32Array(N); R.burnt = new Uint8Array(N); R.spreadT = 1; }
    if (L.exp === 'starfall') {
      // the crater: crystal already covers the ground round the impact
      R.crystal = new Uint8Array(N);
      const k = road[Math.floor(road.length * 0.55)], c = k % COLS, r = Math.floor(k / COLS);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const x = c + dx, y = r + dy; if (x >= 0 && y >= 0 && x < COLS && y < ROWS && M.grid[y * COLS + x] <= 1) R.crystal[y * COLS + x] = 1; }
    }
    if (L.exp === 'eldertree') R.blight = new Uint8Array(N);
    if (L.exp === 'rift') {
      // two portals, each a jump a third of the way further down the main road
      const p = M.paths[0];
      for (const k of [0.2, 0.55]) R.portals.push({ a: p.total * k, b: p.total * (k + 0.12), route: p });
    }
    if (L.exp === 'stones' || L.exp === 'spires') R.stones = M.decor.filter((d) => d.kind === (L.exp === 'stones' ? 'runestone' : 'crystal')).map((d) => [d.c, d.r]);
    if (L.exp === 'temple') R.next = 10;
    if (L.exp === 'dinos') {
      const rng = mulberry32(L.look.seed + 3), spots = freeNearRoad(M, 2);
      for (let i = 0; i < 3 && spots.length; i++) {
        const [c, r] = spots.splice(Math.floor(rng() * spots.length), 1)[0];
        R.dinos.push({ x: c * TILE + TILE / 2, y: r * TILE + TILE / 2, tx: null, ty: null, ang: rng() * TAU, cd: 1 + i, wait: rng() * 3, kind: i === 1 ? 'long' : 'tri', step: 0, seed: i * 31 + 7 });
      }
    }
    R.next = { kraken: 8, dragon: 14, ufo: 12, temple: 10 }[L.exp] || 0;
    sayLineX(X.intro, 2.4);
  }
  function end() { R = null; }
  const fresh = (id) => ({ id, t: 0, lava: null, lavaCv: null, glowCv: null, bubbles: [], tentacles: [], flights: [], dinos: [], scouts: [], zones: [], herds: [], beams: [], hunters: [], smoke: [], portals: [], stones: [], meteors: [], erupted: 0, next: 10, ward: 0, ash: 0, sweep: null });
  const sayLineX = (line, delay) => { if (line && typeof Comms !== 'undefined') Comms.say(line[0], line[1], { tag: 'EXPEDITION', delay }); };
  function freeNearRoad(M, reach) {
    const out = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (M.grid[r * COLS + c] !== 0) continue;
      let near = false;
      for (let dy = -reach; dy <= reach && !near; dy++) for (let dx = -reach; dx <= reach; dx++) { const x = c + dx, y = r + dy; if (x >= 0 && y >= 0 && x < COLS && y < ROWS && M.grid[y * COLS + x] === 1) { near = true; break; } }
      if (near) out.push([c, r]);
    }
    return out;
  }
  const tileOf = (x, y) => { const c = Math.floor(x / TILE), r = Math.floor(y / TILE); return c < 0 || r < 0 || c >= COLS || r >= ROWS ? -1 : r * COLS + c; };
  const ground = () => S.enemies.filter((e) => !e.dead && !e.fly && !e.burrowed && onField(e));
  const scaleNow = () => hpScale(effWave(S.L, Math.max(1, S.wave)));

  // ---------- lava (Mount Cinder) ----------
  function paintLava(M) {
    // the newly flooded tiles are painted here; the first flows are part of the background
    const cv = R.lavaCv || document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d'); c.clearRect(0, 0, W, H);
    const rng = mulberry32(99);
    for (const k of R.fresh) {
      const x = (k % COLS) * TILE + TILE / 2, y = Math.floor(k / COLS) * TILE + TILE / 2;
      ellipse(c, x, y, TILE * 0.62, TILE * 0.6); c.fillStyle = 'rgba(16,10,8,0.9)'; c.fill();
      ellipse(c, x, y, TILE * 0.52, TILE * 0.5); c.fillStyle = radial(c, x, y, TILE * 0.55, '#ffc040', '#c8300a', 0, 0); c.fill();
      for (let i = 0; i < 4; i++) { ellipse(c, x + (rng() - 0.5) * TILE * 0.6, y + (rng() - 0.5) * TILE * 0.6, 4 + rng() * 5, 3 + rng() * 3, rng() * 3); c.fillStyle = 'rgba(40,20,14,0.55)'; c.fill(); }
    }
    R.lavaCv = cv;
    const g = R.glowCv || document.createElement('canvas'); g.width = W / 4; g.height = H / 4;
    const gc = g.getContext('2d'); gc.clearRect(0, 0, g.width, g.height); gc.scale(0.25, 0.25);
    for (let i = 0; i < R.lava.length; i++) if (R.lava[i]) { const x = (i % COLS) * TILE + TILE / 2, y = Math.floor(i / COLS) * TILE + TILE / 2; gc.fillStyle = radial(gc, x, y, TILE * 1.1, 'rgba(255,120,30,0.5)', 'rgba(255,90,20,0)', 0, 0); gc.fillRect(x - TILE * 1.1, y - TILE * 1.1, TILE * 2.2, TILE * 2.2); }
    R.glowCv = g;
  }
  function erupt() {
    const M = S.M, cand = [];
    for (let i = 0; i < R.lava.length; i++) {
      if (R.lava[i] || M.grid[i] !== 0 || S.towerAt.has(i)) continue;
      const c = i % COLS, r = Math.floor(i / COLS);
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const x = c + dx, y = r + dy; return x >= 0 && y >= 0 && x < COLS && y < ROWS && R.lava[y * COLS + x] && M.grid[y * COLS + x] !== 1; })) cand.push(i);
    }
    const n = Math.min(cand.length, 4);
    for (let k = 0; k < n; k++) { const i = cand.splice(Math.floor(Math.random() * cand.length), 1)[0]; R.lava[i] = 1; M.grid[i] = 4; R.fresh.push(i); }
    if (!n) return;
    paintLava(M);
    addShake(8); Sound.play('boom', W / 2);
    showBanner('Eruption', 'The lava has spread');
    for (let i = 0; i < 30; i++) S.fx.push({ kind: 'spark', x: rand(0, W), y: rand(0, H * 0.4), vx: rand(-40, 40), vy: rand(20, 90), r: rand(1, 2.5), color: '255,150,50', life: 1.2, max: 1.2 });
  }

  // ---------- update ----------
  function onWave(n) {
    if (!R) return;
    if (R.id === 'cinder' && n > 1 && n % 4 === 0) erupt();
    // ash falls on the peaks every fourth wave and blinds the towers for a while
    if (R.id === 'ashen' && n % 4 === 0) { R.ash = 24; refreshTowers(); showBanner('Ash fall', 'Every tower sees less far'); sayLineX(['moreno', 'Ash is coming down! I cannot see!'], 0.6); }
    if (R.id === 'wildfire') { const free = []; for (let i = 0; i < R.fire.length; i++) if (!R.burnt[i] && !R.fire[i] && S.M.grid[i] <= 1) free.push(i); for (let k = 0; k < 2 && free.length; k++) R.fire[free.splice(Math.floor(Math.random() * free.length), 1)[0]] = 10; }
    // crystal creeps over a few more tiles, and the blight over a few more
    if (R.id === 'starfall' && n > 1) spread(R.crystal, 3, (i) => S.M.grid[i] <= 1);
    if (R.id === 'eldertree' && n > 1) { spread(R.blight, 3, (i) => S.M.grid[i] === 0, true); refreshTowers(); }
    if (R.id === 'moonwell') {
      const full = n % 5 === 0;
      if (full) { showBanner('Full moon', 'They heal and run faster'); sayLineX(['laila', 'Full moon. Here they come.'], 0.6); }
      R.full = full;
    }
  }
  // grow a patch of tiles by up to n of their neighbours
  function spread(mask, n, ok, seedIfEmpty) {
    const cand = [];
    for (let i = 0; i < mask.length; i++) {
      if (mask[i] || !ok(i)) continue;
      const c = i % COLS, r = Math.floor(i / COLS);
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const x = c + dx, y = r + dy; return x >= 0 && y >= 0 && x < COLS && y < ROWS && mask[y * COLS + x]; })) cand.push(i);
    }
    if (!cand.length && seedIfEmpty) for (let i = 0; i < mask.length; i++) if (ok(i)) cand.push(i);
    for (let k = 0; k < n && cand.length; k++) mask[cand.splice(Math.floor(Math.random() * cand.length), 1)[0]] = 1;
  }
  const towerNear = (x, y, reach) => S.towers.some((t) => dist2(t.x, t.y, x, y) < (TILE * reach) ** 2);
  function update(dt) {
    if (!R) return;
    R.t += dt;
    const busy = S.enemies.length > 0;
    if (R.burns) {
      // zombies wading across a lava causeway catch fire
      for (const e of ground()) { const k = tileOf(e.x, e.y); if (k >= 0 && R.lava[k] && !ZOMBIES[e.type].noBurn) ignite(e, e.maxHp * 0.1, 1.6, null); }
      if (Math.random() < dt * 6) { const i = Math.floor(Math.random() * R.lava.length); if (R.lava[i]) R.bubbles.push({ x: (i % COLS + Math.random()) * TILE, y: (Math.floor(i / COLS) + Math.random()) * TILE, t: 0 }); }
      for (const b of R.bubbles) b.t += dt;
      R.bubbles = R.bubbles.filter((b) => b.t < 0.8);
    }
    if (R.id === 'kraken' && busy && (R.next -= dt) <= 0) {
      R.next = Math.max(5, 10 - S.wave * 0.2);
      const shore = [];
      for (const e of ground()) { const c = Math.floor(e.x / TILE), r = Math.floor(e.y / TILE); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [0, 0]]) { const x = c + dx, y = r + dy; if (x >= 0 && y >= 0 && x < COLS && y < ROWS && S.L.water[y * COLS + x] && S.M.grid[y * COLS + x] !== 1) shore.push([x, y, e]); } }
      if (shore.length) { const [x, y, e] = shore[Math.floor(Math.random() * shore.length)]; tentacle(x * TILE + TILE / 2, y * TILE + TILE / 2, e, false); }
    }
    if (R.id === 'dragon' && busy && (R.next -= dt) <= 0) {
      R.next = 20;
      const gs = ground();
      if (gs.length) { const e = gs[Math.floor(Math.random() * gs.length)]; flyover(e.x, e.y, false); sayLineX(['laila', 'Dragon overhead! Here comes the fire!'], 0); }
    }
    if (R.id === 'ufo' && busy && (R.next -= dt) <= 0) {
      R.next = Math.max(12, 18 - S.wave * 0.2);
      const free = S.towers.filter((t) => !(t.stun > 0));
      if (free.length) beamTower(free[Math.floor(Math.random() * free.length)], 3.5, true);
    }
    if (R.id === 'dinos') updateDinos(dt);
    if (R.id) twists(dt, busy);
    // what the powers left behind, in any battle
    for (const h of R.hunters) updateHunter(h, dt);
    R.hunters = R.hunters.filter((h) => h.t > 0);
    for (const m of R.meteors) {
      m.t -= dt;
      if (m.t <= 0 && !m.done) {
        m.done = true;
        for (const air of [false, true]) splashAt(m.x, m.y, m.r, air, (e) => damage(e, m.dmg, null, 1));
        explosion(m.x, m.y, m.r, true); addShake(12); Sound.play('boom', m.x);
        for (let i = 0; i < 20; i++) { const a = rand(0, TAU); S.fx.push({ kind: 'spark', x: m.x, y: m.y, vx: Math.cos(a) * 200, vy: Math.sin(a) * 200, r: rand(1.5, 3), color: '170,255,150', life: 0.7, max: 0.7 }); }
      }
    }
    R.meteors = R.meteors.filter((m) => !m.done);
    for (const tn of R.tentacles) {
      tn.t += dt;
      if (!tn.hit && tn.t > 0.55) {
        tn.hit = true;
        if (tn.target && !tn.target.dead) { if (tn.power) { tn.x = tn.target.x; tn.y = tn.target.y; } grab(tn.target, tn.power); }
        // a tentacle near the shore swats any boat in reach too
        if (!tn.power) for (const t of S.towers) if (TOWERS[t.type].place === 'water' && dist2(t.x, t.y, tn.x, tn.y) < (TILE * 1.3) ** 2) { t.stun = 2; t.stunKind = 'slam'; }
        Sound.play('splash', tn.x);
      }
    }
    R.tentacles = R.tentacles.filter((tn) => tn.t < 1.6);
    for (const f of R.flights) updateFlight(f, dt);
    R.flights = R.flights.filter((f) => f.k < 1);
    for (const s of R.scouts) s.t += dt;
    R.scouts = R.scouts.filter((s) => s.t < s.dur + 1.2);
    for (const z of R.zones) {
      z.t -= dt;
      for (const e of S.enemies) {
        if (e.dead || e.fly || dist2(e.x, e.y, z.x, z.y) > z.r * z.r) continue;
        // ash blinds and slows, smoke turns them round, lava and fire burn
        if (z.kind === 'ash') { e.fslowNext = Math.max(e.fslowNext, 0.6); e.brittleT = 0.3; e.brittle = 0.3 * z.k; }
        else if (z.kind === 'reverse') { if (!ZOMBIES[e.type].boss) e.d = Math.max(0, e.d - e.speed * 2 * dt); }
        else { damage(e, z.dps * dt, null, 0.5, true); if (!e.dead) ignite(e, z.dps * 0.25, 1.5, null); }
      }
      if (z.kind) continue;
      if (Math.random() < dt * 14) { const a = rand(0, TAU), d = Math.sqrt(Math.random()) * z.r; R.bubbles.push({ x: z.x + Math.cos(a) * d, y: z.y + Math.sin(a) * d, t: 0, rain: true }); }
      if (Math.random() < dt * 3) Sound.play('flame', z.x);
    }
    R.zones = R.zones.filter((z) => z.t > 0);
    for (const h of R.herds) updateHerd(h, dt);
    R.herds = R.herds.filter((h) => h.d > -60);
    for (const b of R.beams) b.t += dt;
    R.beams = R.beams.filter((b) => b.t < 1.4);
  }

  // the other fifteen wonders' ground and sky
  function twists(dt, busy) {
    const id = R.id;
    if (id === 'ashen' && R.ash > 0) {
      R.ash -= dt;
      if (Math.random() < dt * 40) S.fx.push({ kind: 'smoke', x: rand(0, W), y: rand(-10, H), vx: rand(-10, 10), vy: rand(10, 30), r: rand(2, 4), grow: 2, life: 2, max: 2, color: '150,145,140' });
      if (R.ash <= 0) refreshTowers();
    }
    // things hidden from towers: tall grass, drifting smoke, smoke off the fires
    if (id === 'raptors' || id === 'emberwood' || id === 'wildfire') {
      for (const s of R.smoke) { s.x += s.vx * dt; s.y += s.vy * dt; if (s.x < -s.r) s.x = W + s.r; if (s.x > W + s.r) s.x = -s.r; if (s.y < -s.r) s.y = H + s.r; if (s.y > H + s.r) s.y = -s.r; }
      for (const e of S.enemies) {
        if (e.dead) continue;
        const k = tileOf(e.x, e.y);
        let cover = false;
        if (id === 'raptors') cover = k >= 0 && R.hide[k];
        else if (id === 'emberwood') cover = R.smoke.some((s) => dist2(s.x, s.y, e.x, e.y) < s.r * s.r);
        else cover = e.type === 'smokehound' && k >= 0 && nearFire(k);
        e.hidden = cover && !towerNear(e.x, e.y, 1.6);
      }
    }
    if (id === 'wildfire') {
      // the grass fire spreads from tile to tile, burns out, and hurts anything standing in it
      R.spreadT -= dt;
      let changed = false;
      for (let i = 0; i < R.fire.length; i++) if (R.fire[i] > 0) { R.fire[i] -= dt; if (R.fire[i] <= 0) { R.fire[i] = 0; R.burnt[i] = 1; changed = true; } }
      if (R.spreadT <= 0) {
        R.spreadT = 1.3;
        const lit = [];
        for (let i = 0; i < R.fire.length; i++) if (R.fire[i] > 0) lit.push(i);
        for (const i of lit) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const x = i % COLS + dx, y = Math.floor(i / COLS) + dy, j = y * COLS + x;
          if (x >= 0 && y >= 0 && x < COLS && y < ROWS && !R.fire[j] && !R.burnt[j] && S.M.grid[j] <= 1 && Math.random() < 0.22) { R.fire[j] = 10; changed = true; }
        }
        // a burning husk lights the grass it runs through
        for (const e of S.enemies) if (!e.dead && ZOMBIES[e.type].ignites) { const k = tileOf(e.x, e.y); if (k >= 0 && !R.fire[k] && !R.burnt[k]) { R.fire[k] = 10; changed = true; } }
      }
      for (const e of ground()) { const k = tileOf(e.x, e.y); if (k >= 0 && R.fire[k] > 0) ignite(e, e.maxHp * 0.06, 1.2, null); }
      if (changed) refreshTowers();
      if (Math.random() < dt * 20) { const i = Math.floor(Math.random() * R.fire.length); if (R.fire[i] > 0) S.fx.push({ kind: 'fire', x: (i % COLS + Math.random()) * TILE, y: (Math.floor(i / COLS) + Math.random()) * TILE, vx: rand(-6, 6), vy: rand(-30, -14), r: rand(4, 7), life: 0.5, max: 0.5 }); }
    }
    if (id === 'starfall') for (const e of ground()) { const k = tileOf(e.x, e.y); if (k >= 0 && R.crystal[k] && e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.015 * dt); }
    if (id === 'rift') for (const e of ground()) {
      // a zombie that walks into a portal comes out further down the road
      const pd = e.pd ?? e.d; e.pd = e.d;
      for (const p of R.portals) if (e.route === p.route && pd < p.a && e.d >= p.a) {
        S.fx.push({ kind: 'ring', x: e.x, y: e.y, r: 18, life: 0.4, max: 0.4, color: '180,110,255' });
        e.d = p.b; e.pd = p.b; placeOnPath(e);
        S.fx.push({ kind: 'ring', x: e.x, y: e.y, r: 18, life: 0.4, max: 0.4, color: '180,110,255' });
        if (Math.random() < 0.3) Sound.play('summon', e.x);
      }
    }
    if (id === 'stones') for (const e of ground()) {
      // stone skin while passing a runestone
      e.armor0 = e.armor0 ?? e.armor;
      const c = Math.floor(e.x / TILE), r = Math.floor(e.y / TILE);
      e.armor = e.armor0 + (R.stones.some(([x, y]) => Math.abs(x - c) <= 1 && Math.abs(y - r) <= 1) ? 2 : 0);
    }
    if (id === 'temple') {
      // the temple's beam swings across the whole map, burning towers and zombies alike
      if (!R.sweep && busy && (R.next -= dt) <= 0) { R.next = 15; R.sweep = { t: 0, a0: rand(0, TAU), dir: Math.random() < 0.5 ? -1 : 1, hit: new Set() }; Sound.play('laser', W / 2, { pitch: 0.6 }); }
      if (R.sweep) {
        const sw = R.sweep; sw.t += dt;
        const a = sw.a0 + sw.dir * sw.t * 1.1, ox = W / 2, oy = H / 2, nx = -Math.sin(a), ny = Math.cos(a);
        sw.a = a;
        const onBeam = (x, y) => Math.abs((x - ox) * nx + (y - oy) * ny) < 16 && (x - ox) * Math.cos(a) + (y - oy) * Math.sin(a) > 0;
        for (const e of S.enemies) if (!e.dead && !sw.hit.has(e) && onField(e) && onBeam(e.x, e.y)) { sw.hit.add(e); if (!ZOMBIES[e.type].boss) damage(e, e.maxHp * 0.15, null, 1); if (!e.dead) ignite(e, e.maxHp * 0.05, 2, null); }
        for (const t of S.towers) if (!sw.hit.has(t) && onBeam(t.x, t.y)) { sw.hit.add(t); t.stun = 1.4; t.stunKind = 'scorch'; }
        if (sw.t > 2.8) R.sweep = null;
      }
    }
    if (id === 'moonwell' && R.full) for (const e of ground()) if (e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * (e.type === 'werewolf' ? 0.012 : 0.004) * dt);
    if (id === 'eldertree') {
      // the Elder Tree's roots slow anything that comes near it
      for (const e of ground()) if (dist2(e.x, e.y, S.M.end.x, S.M.end.y) < (TILE * 3) ** 2) e.fslowNext = Math.max(e.fslowNext, 0.35);
    }
    if (id === 'pteros' && busy && (R.next -= dt) <= 0) {
      // a wild pterosaur dives on a flying zombie now and then
      R.next = 6;
      const fl = S.enemies.filter((e) => !e.dead && e.fly && onField(e));
      if (fl.length) { const e = fl[Math.floor(Math.random() * fl.length)]; R.beams.push({ x0: e.x - 80, y0: e.y - 120, x1: e.x, y1: e.y, t: 0, swoop: true }); damage(e, e.maxHp * 0.7, null, 1); Sound.play('crow', e.x); }
    }
  }
  const nearFire = (k) => { const c = k % COLS, r = Math.floor(k / COLS); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const x = c + dx, y = r + dy; if (x >= 0 && y >= 0 && x < COLS && y < ROWS && R.fire[y * COLS + x] > 0) return true; } return false; };
  // allied raptors from the Raptor Pack: each runs down the nearest zombie and bites
  function updateHunter(h, dt) {
    h.t -= dt; h.cd -= dt; h.step += dt;
    if (!h.target || h.target.dead || !onField(h.target)) { const gs = ground(); h.target = gs.length ? gs.reduce((a, b) => (dist2(a.x, a.y, h.x, h.y) < dist2(b.x, b.y, h.x, h.y) ? a : b)) : null; }
    const e = h.target;
    if (!e) return;
    const dx = e.x - h.x, dy = e.y - h.y, l = Math.hypot(dx, dy);
    h.ang = Math.atan2(dy, dx);
    if (l > 14) { h.x += dx / l * Math.min(l, 190 * dt); h.y += dy / l * Math.min(l, 190 * dt); }
    else if (h.cd <= 0) { h.cd = 0.7; damage(e, ZOMBIES[e.type].boss ? e.maxHp * 0.008 * h.k : e.maxHp * 0.3 * h.k, null, 1); Sound.play('splat', e.x); }
  }

  // ---------- the twists' moving parts ----------
  function tentacle(x, y, target, power) { R.tentacles.push({ x, y, t: 0, target, power, hit: false, side: Math.random() < 0.5 ? -1 : 1 }); }
  function grab(e, power) {
    const def = ZOMBIES[e.type];
    if (def.boss) { damage(e, e.maxHp * (power ? 0.08 * power : 0.03), null, 1); return; }
    // dragged under: the twist takes most of a zombie's health, the power all of it
    if (power) kill(e, null); else damage(e, e.maxHp * 0.6, null, 1);
    for (let i = 0; i < 8; i++) S.fx.push({ kind: 'debris', x: e.x, y: e.y, vx: rand(-60, 60), vy: rand(-60, 60), r: rand(1.5, 3), color: '#cfe6ee', life: 0.5, max: 0.5 });
  }
  // the Red Dragon crosses the map along a line through (x, y), burning a band under it
  // something crosses the map along a line through (x, y), hitting a band under it: the Red
  // Dragon's fire, a dive of pterosaurs, or a ship's broadside of cannonballs
  function flyover(x, y, power, art = 'dragon', id = 'dragon') {
    const a = power ? 0 : rand(0, TAU), L = Math.hypot(W, H) * 0.75;
    const f = { ax: x - Math.cos(a) * L, ay: y - Math.sin(a) * L, bx: x + Math.cos(a) * L, by: y + Math.sin(a) * L, a, k: 0, power, hit: new Set(), dur: power ? 2.2 : 2.8, art, id, boomT: 0 };
    if (power) { f.ax = -120; f.bx = W + 120; f.ay = f.by = y; }
    R.flights.push(f);
    Sound.play(art === 'dragon' ? 'roar' : art === 'ptero' ? 'crow' : 'bomb', x);
  }
  function updateFlight(f, dt) {
    f.k += dt / f.dur;
    const x = lerp(f.ax, f.bx, f.k), y = lerp(f.ay, f.by, f.k);
    f.x = x; f.y = y;
    const band = (f.power ? 1.3 : 0.75) * TILE, sc = scaleNow(), k3 = f.power ? strength(f.id) : 1;
    for (const e of S.enemies) {
      if (e.dead || f.hit.has(e) || !onField(e)) continue;
      // only what is just behind the dragon's head gets the fire
      const dx = e.x - x, dy = e.y - y, along = dx * Math.cos(f.a) + dy * Math.sin(f.a), across = -dx * Math.sin(f.a) + dy * Math.cos(f.a);
      if (Math.abs(across) > band || along > 10 || along < -70) continue;
      f.hit.add(e);
      const def = ZOMBIES[e.type];
      const dmg = f.power ? 55 * sc * k3 : def.boss ? e.maxHp * 0.02 : e.maxHp * 0.22;
      damage(e, dmg, null, 0.8);
      if (!e.dead && !def.noBurn && f.art === 'dragon') ignite(e, (f.power ? 8 * sc * k3 : e.maxHp * 0.06), 3, null);
    }
    if (f.art === 'cannon') { f.boomT -= dt; if (f.boomT <= 0 && x > 0 && x < W) { f.boomT = 0.12; explosion(x, y + rand(-20, 20), 16, false, true); Sound.play('bomb', x); } }
    else if (f.art === 'dragon' && Math.random() < dt * 30) S.fx.push({ kind: 'fire', x: x - Math.cos(f.a) * 30 + rand(-8, 8), y: y - Math.sin(f.a) * 30 + rand(-8, 8), vx: rand(-20, 20), vy: rand(-20, 20), r: rand(5, 9), life: 0.5, max: 0.5 });
  }
  function beamTower(t, dur, scout) {
    t.stun = Math.max(t.stun || 0, dur); t.stunKind = 'beam';
    R.scouts.push({ x: t.x, y: t.y, t: 0, dur, tower: t, scout });
    floatText('Tower beamed up', t.x, t.y - 34, '#a8ffc8', 14);
    Sound.play('laser', t.x);
  }
  function updateDinos(dt) {
    const M = S.M;
    for (const d of R.dinos) {
      d.cd -= dt;
      if (d.tx == null || (d.wait -= dt) > 0 && Math.hypot(d.tx - d.x, d.ty - d.y) < 4) {
        if (d.wait <= 0) {
          const spots = freeNearRoad(M, 1).filter(([c, r]) => !S.towerAt.has(r * COLS + c) && Math.hypot(c * TILE + TILE / 2 - d.x, r * TILE + TILE / 2 - d.y) < TILE * 4);
          if (spots.length) { const [c, r] = spots[Math.floor(Math.random() * spots.length)]; d.tx = c * TILE + TILE / 2; d.ty = r * TILE + TILE / 2; }
          d.wait = rand(2, 5);
        }
      } else if (d.tx != null) {
        const dx = d.tx - d.x, dy = d.ty - d.y, l = Math.hypot(dx, dy);
        if (l > 2) { const sp = 18 * dt; d.x += dx / l * Math.min(sp, l); d.y += dy / l * Math.min(sp, l); d.ang = Math.atan2(dy, dx); d.step += dt; }
      }
      // anything undead that comes close gets stamped on
      if (d.cd <= 0) {
        const near = ground().filter((e) => dist2(e.x, e.y, d.x, d.y) < (TILE * 1.25) ** 2);
        if (near.length) {
          d.cd = 1.4;
          for (const e of near) { damage(e, ZOMBIES[e.type].boss ? e.maxHp * 0.01 : e.maxHp * 0.16, null, 1); if (!e.dead) stunZombie(e, 0.4); }
          S.fx.push({ kind: 'ring', x: d.x, y: d.y, r: TILE * 0.6, life: 0.4, max: 0.4, color: '200,180,120' });
          d.ang = Math.atan2(near[0].y - d.y, near[0].x - d.x);
          Sound.play('stomp', d.x); addShake(2);
        } else d.cd = 0.3;
      }
    }
  }
  // the stampede runs back along every road from the safehouse
  function updateHerd(h, dt) {
    h.d -= dt * 420;
    const sc = h.k;
    for (const e of S.enemies) {
      if (e.dead || e.fly || e.burrowed || h.hit.has(e) || e.route !== h.route) continue;
      if (Math.abs(e.d - h.d) > 26) continue;
      h.hit.add(e);
      const def = ZOMBIES[e.type];
      damage(e, def.boss ? e.maxHp * 0.05 * sc : e.maxHp * (h.sun ? 0.35 : 0.4) * sc, null, 1);
      if (!e.dead) { if (h.sun) ignite(e, e.maxHp * 0.05, 2, null); else stunZombie(e, 1.2); }
    }
    if (Math.random() < dt * 20) { const p = pointOn(h.route, clamp(h.d, 0, h.route.total)); S.fx.push({ kind: 'smoke', x: p.x + rand(-10, 10), y: p.y + rand(-10, 10), vx: rand(-10, 10), vy: rand(-10, 10), r: rand(5, 8), grow: 12, life: 0.7, max: 0.7, color: '150,120,80' }); }
  }

  // ---------- bosses ----------
  // each boss has its own attack, and enrages at half health
  function bossTick(e, dt, def) {
    if (!e.enraged && e.hp < e.maxHp * 0.5) enrage(e, def);
    if (e.type === 'cinderKing') {
      e.trailT = (e.trailT || 0) - dt;
      if (e.trailT <= 0) { e.trailT = 0.3; S.decals.push({ kind: 'scorch', x: e.x + rand(-6, 6), y: e.y + rand(-6, 6), r: e.r * 0.5, color: '#14120f', life: 6, max: 6, seed: Math.random() * 1000 }); }
    }
    // the Wendigo feeds on fire
    if (e.type === 'wendigo' && (e.burnT > 0 || (R && R.fire && R.fire[tileOf(e.x, e.y)] > 0))) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.01 * dt);
    const A = def.atk;
    if (!A) return;
    e.atkCd = (e.atkCd ?? 4) - dt;
    if (e.atkCd > 0) return;
    e.atkCd = e.enraged ? A.fast : A.every;
    const ang = Math.atan2(e.diry, e.dirx), knock = (list, kind, text, col) => { for (const t of list) { t.stun = A.dur; t.stunKind = kind; } if (list.length) floatText(text, e.x, e.y - e.r * 2, col, 16); };
    if (A.kind === 'slam') {
      const near = S.towers.filter((t) => dist2(t.x, t.y, e.x, e.y) < (TILE * 2.8) ** 2).sort((a, b) => dist2(a.x, a.y, e.x, e.y) - dist2(b.x, b.y, e.x, e.y)).slice(0, A.n || 2);
      knock(near, 'slam', 'Towers slammed', '#f0c8c8');
      for (const t of near) R.tentacles.push({ x: t.x, y: t.y, t: 0.3, target: null, power: 0, hit: true, side: 1 });
      if (near.length) { addShake(6); Sound.play('stomp', e.x); }
    } else if (A.kind === 'cone') {
      const hit = S.towers.filter((t) => { const dx = t.x - e.x, dy = t.y - e.y, d = Math.hypot(dx, dy); if (d > TILE * 3.4) return false; const da = Math.abs(((Math.atan2(dy, dx) - ang + Math.PI * 3) % TAU) - Math.PI); return da < 0.75; });
      knock(hit, 'scorch', 'Towers scorched', e.enraged ? '#a8ffb0' : '#ffb070');
      const col = e.enraged ? '120,255,140' : '255,140,50';
      for (let i = 0; i < 26; i++) { const a = ang + rand(-0.6, 0.6), sp = rand(120, 220); S.fx.push({ kind: 'smoke', x: e.x + Math.cos(ang) * e.r, y: e.y + Math.sin(ang) * e.r, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: rand(4, 7), grow: 20, life: 0.6, max: 0.6, color: col }); }
      Sound.play('flame', e.x); Sound.play('roar', e.x);
    } else if (A.kind === 'beam' || A.kind === 'snatch') {
      // the saucer's tractor beam, or the Quetzal Wraith's claws, carry off the best tower in reach
      const near = S.towers.filter((t) => !(t.stun > 0) && dist2(t.x, t.y, e.x, e.y) < (TILE * 4) ** 2);
      if (near.length) {
        const best = near.reduce((a, b) => (b.spent > a.spent ? b : a));
        if (A.kind === 'beam') { beamTower(best, A.dur, false); R.beams.push({ x0: e.x, y0: e.y, x1: best.x, y1: best.y, t: 0 }); }
        else { best.stun = A.dur; best.stunKind = 'snatch'; R.beams.push({ x0: e.x, y0: e.y, x1: best.x, y1: best.y, t: 0, swoop: true }); floatText('Tower snatched', best.x, best.y - 34, '#f0d8c8', 14); Sound.play('crow', best.x); }
      } else e.atkCd = 1;
    } else if (A.kind === 'line') {
      // a beam, or a broadside, down the line of towers ahead
      const nx = -Math.sin(ang), ny = Math.cos(ang);
      const hit = S.towers.filter((t) => { const dx = t.x - e.x, dy = t.y - e.y, along = dx * Math.cos(ang) + dy * Math.sin(ang); return along > -TILE && along < TILE * 6.5 && Math.abs(dx * nx + dy * ny) < TILE * 0.9; });
      const look = { prism: ['Towers shut down', '#e0c8ff', '210,170,255'], slam: ['Broadside!', '#f0e0c0', '255,210,150'], scorch: ['Towers melted', '#ffe08a', '255,220,110'] }[A.stun];
      knock(hit, A.stun, look[0], look[1]);
      R.beams.push({ x0: e.x, y0: e.y, x1: e.x + Math.cos(ang) * TILE * 6.5, y1: e.y + Math.sin(ang) * TILE * 6.5, t: 0, col: look[2] });
      if (A.stun === 'slam') for (let i = 0; i < 5; i++) { const k = (i + 1) / 5; explosion(e.x + Math.cos(ang) * TILE * 6 * k, e.y + Math.sin(ang) * TILE * 6 * k, 14, false, i > 0); }
      Sound.play(A.stun === 'slam' ? 'bomb' : 'laser', e.x);
    } else if (A.kind === 'bolt') {
      const near = shuffle(Math.random, S.towers.filter((t) => !(t.stun > 0) && dist2(t.x, t.y, e.x, e.y) < (TILE * 4.5) ** 2)).slice(0, A.n || 2);
      knock(near, 'bolt', 'Lightning strike', '#d8ecff');
      for (const t of near) R.beams.push({ x0: t.x + rand(-30, 30), y0: -20, x1: t.x, y1: t.y, t: 0, bolt: true });
      if (near.length) { Sound.play('thunder', e.x); addShake(5); } else e.atkCd = 1;
    } else if (A.kind === 'shield') {
      e.shieldT = A.dur;
      Sound.play('freeze', e.x);
      floatText('Shielded', e.x, e.y - e.r * 2, '#c8ffb0', 16);
    }
  }
  function enrage(e, def) {
    e.enraged = true;
    e.speed *= 1.25;
    if (e.type === 'cinderKing') e.armor = Math.floor(e.armor / 2);
    const call = def.enrageCall;
    if (call) for (let i = 0; i < call[1]; i++) spawnEnemy(call[0], e.wave, e.route, Math.max(0, e.d - 14 - i * 16));
    showBanner(`${def.name} is enraged`, 'Second phase');
    addShake(10); Sound.play('roar', e.x); Sound.play('boss');
    for (let i = 0; i < 24; i++) { const a = rand(0, TAU); S.fx.push({ kind: 'spark', x: e.x, y: e.y, vx: Math.cos(a) * 160, vy: Math.sin(a) * 160, r: rand(1.5, 3), color: '255,90,60', life: 0.6, max: 0.6 }); }
    if (R && LIST[R.id]) sayLineX(LIST[R.id].enrage, 0.4);
  }
  // what an expedition's ground does to a tower standing on it, or beside something on it
  function towerMod(t) {
    if (!R || !R.id) return null;
    const c = t.col, r = t.row, k = r * COLS + c, beside = () => R.stones.some(([x, y]) => Math.abs(x - c) <= 1 && Math.abs(y - r) <= 1);
    if (R.id === 'stones' && beside()) return { dmg: 1.3 };
    if (R.id === 'spires' && beside()) return { rate: 0.8 };
    if (R.id === 'ashen' && R.ash > 0) return { range: 0.75 };
    if (R.id === 'wildfire' && R.fire[k] > 0) return { rate: 1.6 };
    if (R.id === 'eldertree' && R.blight[k]) return { rate: 1.25 };
    return null;
  }
  // a zombie arriving under a full moon
  function onSpawn(z) {
    if (!R || R.id !== 'moonwell' || !R.full) return;
    z.boost = z.type === 'werewolf' ? 1.45 : 1.15;
  }
  function wardLeak() { if (!R || R.ward <= 0) return false; R.ward--; floatText('Rune Ward', S.M.end.x, S.M.end.y - 56, '#7ad8ff', 15); return true; }

  // ---------- wonder powers ----------
  const strength = (id) => (wonStars(id) >= 3 ? 1.5 : 1);
  const charges = (id) => (dev() ? 9 : st().charge[id] | 0);
  const owned = () => ORDER.filter((id) => dev() || wonStars(id) > 0);
  function cast(id) {
    if (S.state !== 'playing' || S.paused || charges(id) <= 0) { Sound.play('error'); return false; }
    const P = LIST[id].power;
    if (P.target) { S.power = S.power === 'w:' + id ? null : 'w:' + id; S.placing = null; S.selected = null; return true; }
    if (!fire(id, 0, 0)) { Sound.play('error'); return false; }
    spend(id);
    return true;
  }
  function castAt(id, x, y) {
    if (charges(id) <= 0) return;
    S.power = null;
    fire(id, x, y);
    spend(id);
  }
  function spend(id) { if (dev()) return; st().charge[id] = Math.max(0, charges(id) - 1); saveMeta(); }
  // a power works in any battle, campaign or expedition; R is set up on the fly if needed
  function need() { if (!R) { R = fresh(null); R.next = 1e9; } }
  function fire(id, x, y) {
    need();
    const P = LIST[id].power, k = strength(id), sc = scaleNow(), gs = ground();
    const say = (sub) => showBanner(P.name, sub);
    switch (P.kind) {
      case 'zone':
        // a pool of lava, or a ring of fire, that burns everything inside it
        R.zones.push({ x, y, r: TILE * (P.ring ? 1.9 : 1.5) * Math.sqrt(k), t: 6, dps: (P.ring ? 20 : 24) * sc * k, ring: !!P.ring });
        say(P.ring ? 'The ring is burning' : 'Lava rains down'); Sound.play('boom', x); addShake(6);
        break;
      case 'ash': case 'reverse':
        R.zones.push({ x, y, r: TILE * 2.2 * Math.sqrt(k), t: P.kind === 'ash' ? 8 : 5, kind: P.kind, k });
        say(P.kind === 'ash' ? 'They cannot see' : 'They have lost their way'); Sound.play('freezeall', x);
        break;
      case 'lane':
        flyover(x, y, true, P.art, id);
        say({ dragon: 'The Red Dragon answers', ptero: 'Pterosaurs diving', cannon: 'Fire!' }[P.art]);
        break;
      case 'grasp': {
        const list = gs.sort((a, b) => b.hp - a.hp).slice(0, Math.round(6 * k));
        if (!list.length) return false;
        // they burst up one after another, a tenth of a second apart
        list.forEach((e, i) => { tentacle(e.x, e.y, e, k); R.tentacles[R.tentacles.length - 1].t = -i * 0.1; });
        say('Dragged under');
        break;
      }
      case 'herd': case 'sweep':
        for (const route of S.M.paths) R.herds.push({ route, d: route.total + 40, hit: new Set(), k, sun: P.kind === 'sweep' });
        say(P.kind === 'herd' ? 'The herd charges' : 'The sun burns along the road'); Sound.play(P.kind === 'herd' ? 'brute' : 'laser', W / 2); addShake(P.kind === 'herd' ? 10 : 3);
        break;
      case 'lift': {
        const all = gs.sort((a, b) => b.hp - a.hp);
        const small = all.filter((e) => !ZOMBIES[e.type].boss).slice(0, Math.round(k * 1.4));
        const big = all.find((e) => ZOMBIES[e.type].boss);
        if (!small.length && !big) return false;
        for (const e of small) { R.beams.push({ x0: e.x, y0: -40, x1: e.x, y1: e.y, t: 0, lift: true }); kill(e, null); }
        if (!small.length && big) { stunZombie(big, 3); big.stunCd = 0; damage(big, big.maxHp * 0.1 * k, null, 1); R.beams.push({ x0: big.x, y0: -40, x1: big.x, y1: big.y, t: 0, lift: true }); }
        say(small.length ? 'Taken away' : 'Held still'); Sound.play('laser', W / 2);
        break;
      }
      case 'hunters':
        for (let i = 0; i < Math.round(5 * k); i++) { const a = (i / 5) * TAU; R.hunters.push({ x: S.M.end.x + Math.cos(a) * 30, y: S.M.end.y + Math.sin(a) * 30, ang: a, t: 15, cd: 0, step: 0, k, target: null }); }
        say('The pack hunts'); Sound.play('crow', W / 2);
        break;
      case 'meteor':
        R.meteors.push({ x, y, t: 0.9, r: TILE * 2.2 * Math.sqrt(k), dmg: 140 * sc * k });
        say('Incoming'); Sound.play('jet', x);
        break;
      case 'slowall':
        for (const e of S.enemies) { e.slowF = ZOMBIES[e.type].boss ? 0.4 : 0.65; e.slowT = 6 * k; }
        S.freezeFlash = 0.4; say('Everything slows'); Sound.play('freezeall');
        break;
      case 'pull': {
        const r2 = (TILE * 2.6 * Math.sqrt(k)) ** 2, hit = S.enemies.filter((e) => !e.dead && dist2(e.x, e.y, x, y) < r2);
        if (!hit.length) return false;
        for (const e of hit) { S.fx.push({ kind: 'ring', x: e.x, y: e.y, r: 16, life: 0.4, max: 0.4, color: '180,110,255' }); e.d = Math.max(0, e.d - (ZOMBIES[e.type].boss ? 120 : 320)); placeOnPath(e); stunZombie(e, 0.6); }
        say('Pulled back'); Sound.play('summon', x);
        break;
      }
      case 'ward':
        R.ward += Math.round(5 * k);
        say(`The next ${Math.round(5 * k)} cost no lives`); Sound.play('heal', S.M.end.x);
        break;
      case 'root':
        for (const e of S.enemies) if (!e.dead && !e.fly) { stunZombie(e, ZOMBIES[e.type].boss ? 1.5 : 4 * k); e.stunCd = 0; }
        for (let i = 0; i < 30; i++) S.fx.push({ kind: 'debris', x: rand(0, W), y: rand(0, H), vx: 0, vy: -30, r: rand(2, 4), color: '#5a3a1e', life: 0.8, max: 0.8 });
        say('Held fast'); Sound.play('stomp', W / 2); addShake(6);
        break;
      case 'lives':
        S.lives = Math.min(S.maxLives, S.lives + Math.round(10 * k));
        floatText(`+${Math.round(10 * k)} lives`, S.M.end.x, S.M.end.y - 40, '#a8c8ff', 20);
        say('The well heals you'); Sound.play('medkit');
        break;
      case 'strike': {
        const list = gs.concat(S.enemies.filter((e) => !e.dead && e.fly && onField(e))).sort((a, b) => b.hp - a.hp).slice(0, Math.round(5 * k));
        if (!list.length) return false;
        for (const e of list) { R.beams.push({ x0: e.x + rand(-30, 30), y0: -20, x1: e.x, y1: e.y, t: 0, bolt: true }); damage(e, ZOMBIES[e.type].boss ? e.maxHp * 0.06 * k : e.maxHp * 0.6 * k, null, 1); }
        say('Lightning'); Sound.play('thunder', W / 2); addShake(6);
        break;
      }
      case 'pulse':
        for (const e of S.enemies) if (!e.dead) damage(e, ZOMBIES[e.type].boss ? e.maxHp * 0.06 * k : e.maxHp * 0.35 * k, null, 1);
        S.fx.push({ kind: 'ring', x: S.M.end.x, y: S.M.end.y, r: W, life: 0.8, max: 0.8, color: '120,255,160' });
        say('The cure spreads'); Sound.play('freezeall');
        break;
    }
    return true;
  }
  // every few campaign wins, each won power gains a charge
  function campaignWin() {
    const s = st();
    if (!owned().length) return false;
    s.tick = (s.tick | 0) + 1;
    if (s.tick < RECHARGE) return false;
    s.tick = 0;
    let any = false;
    for (const id of owned()) if (charges(id) < MAX_CHARGE) { s.charge[id] = charges(id) + 1; any = true; }
    return any;
  }
  const winsToCharge = () => RECHARGE - (st().tick | 0);

  // ---------- finishing an expedition ----------
  function finish(won, stars) {
    const id = S.L.exp, s = st(), first = won && !wonStars(id);
    if (won) {
      s.won[id] = Math.max(wonStars(id), stars);
      s.charge[id] = Math.max(charges(id), 1);
    }
    return { first, coins: won ? Math.round((600 + stars * 150) * (first ? 1 : 0.35)) : Math.round(S.wave * 4) };
  }

  // ---------- drawing ----------
  function drawGround(c, t) {
    if (!R) return;
    if (R.lavaCv) c.drawImage(R.lavaCv, 0, 0, W, H);
    if (R.glowCv) { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.55 + Math.sin(t * 1.7) * 0.15; c.drawImage(R.glowCv, 0, 0, W, H); c.restore(); }
    for (const b of R.bubbles) {
      const k = b.t / 0.8;
      if (b.rain) { circle(c, b.x, b.y, 3 + k * 6); c.fillStyle = `rgba(255,${Math.round(180 - k * 100)},40,${0.8 * (1 - k)})`; c.fill(); continue; }
      circle(c, b.x, b.y, 1.5 + k * 3.5); c.strokeStyle = `rgba(255,220,120,${0.8 * (1 - k)})`; c.lineWidth = 1; c.stroke();
    }
    overlay(c, t);
    for (const z of R.zones) {
      c.save(); c.globalAlpha = Math.min(1, z.t) * 0.6;
      if (z.kind === 'ash') { c.fillStyle = radial(c, z.x, z.y, z.r, 'rgba(150,145,140,0.75)', 'rgba(110,105,100,0.1)', 0, 0); circle(c, z.x, z.y, z.r); c.fill(); }
      else if (z.kind === 'reverse') { c.fillStyle = radial(c, z.x, z.y, z.r, 'rgba(90,86,80,0.7)', 'rgba(60,56,50,0.1)', 0, 0); circle(c, z.x, z.y, z.r); c.fill(); c.strokeStyle = 'rgba(200,190,170,0.5)'; c.lineWidth = 2; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(z.x, z.y, z.r * (0.3 + i * 0.25), t * 2 + i, t * 2 + i + 2.4); c.stroke(); } }
      else if (z.ring) { c.strokeStyle = 'rgba(255,140,40,0.9)'; c.lineWidth = 10; circle(c, z.x, z.y, z.r); c.stroke(); c.fillStyle = 'rgba(255,120,40,0.18)'; c.fill(); if (Math.random() < 0.6) { const a = rand(0, TAU); S.fx.push({ kind: 'fire', x: z.x + Math.cos(a) * z.r, y: z.y + Math.sin(a) * z.r, vx: 0, vy: -25, r: rand(5, 8), life: 0.5, max: 0.5 }); } }
      else { c.fillStyle = radial(c, z.x, z.y, z.r, 'rgba(255,170,50,0.55)', 'rgba(200,40,10,0.05)', 0, 0); circle(c, z.x, z.y, z.r); c.fill(); }
      c.restore();
    }
    for (const p of R.portals) for (const [d, col] of [[p.a, '170,90,255'], [p.b, '220,170,255']]) {
      const q = pointOn(p.route, d);
      c.save(); c.translate(q.x, q.y); c.rotate(t * (d === p.a ? 2 : -2));
      c.fillStyle = radial(c, 0, 0, 26, `rgba(${col},0.75)`, `rgba(${col},0)`, 0, 0); circle(c, 0, 0, 26); c.fill();
      c.strokeStyle = `rgba(${col},0.9)`; c.lineWidth = 2; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(0, 0, 10 + i * 5, i * 2, i * 2 + 3.5); c.stroke(); }
      circle(c, 0, 0, 6); c.fillStyle = '#0a0612'; c.fill();
      c.restore();
    }
    if (R.id === 'stones') for (const [x, y] of R.stones) { const px = x * TILE + TILE / 2, py = y * TILE + TILE / 2; c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = radial(c, px, py, TILE * 1.4, `rgba(120,210,255,${0.16 + Math.sin(t * 2 + x) * 0.05})`, 'rgba(120,210,255,0)', 0, 0); circle(c, px, py, TILE * 1.4); c.fill(); c.restore(); }
    if (R.id === 'spires') for (const [x, y] of R.stones) { const px = x * TILE + TILE / 2, py = y * TILE + TILE / 2; c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = radial(c, px, py, TILE * 1.4, `rgba(200,160,255,${0.14 + Math.sin(t * 2 + y) * 0.05})`, 'rgba(200,160,255,0)', 0, 0); circle(c, px, py, TILE * 1.4); c.fill(); c.restore(); }
    for (const d of R.dinos) drawDino(c, d, t);
  }
  // the ground a twist changes as the battle goes on: tall grass, burning and burnt grass,
  // star-crystal and blight, redrawn into one layer only when it changes
  function overlay(c, t) {
    const sig = R.hide || R.fire || R.crystal || R.blight;
    if (!sig) return;
    const key = R.fire ? R.fire.reduce((n, v, i) => n + (v > 0 ? i + 1 : 0) + (R.burnt[i] ? 7 * i : 0), 0) : (R.crystal || R.blight || R.hide).reduce((n, v, i) => n + v * (i + 1), 0);
    if (!R.ovCv || R.ovKey !== key) {
      R.ovKey = key;
      const cv = R.ovCv || document.createElement('canvas'); cv.width = W; cv.height = H;
      const g = cv.getContext('2d'); g.clearRect(0, 0, W, H);
      const rng = mulberry32(42);
      for (let i = 0; i < COLS * ROWS; i++) {
        const x = (i % COLS) * TILE, y = Math.floor(i / COLS) * TILE;
        if (R.hide && R.hide[i]) {
          // tall grass, blades leaning in the wind
          circle(g, x + TILE / 2, y + TILE / 2, TILE * 0.68); g.fillStyle = 'rgba(110,120,40,0.3)'; g.fill();
          g.lineCap = 'round';
          for (let k = 0; k < 26; k++) { const bx = x + rng() * TILE, by = y + rng() * TILE, l = 8 + rng() * 9; g.strokeStyle = ['#8a8a3a', '#a8a44a', '#6a7a2a', '#c8b860'][k % 4]; g.lineWidth = 1.4; g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo(bx + 2, by - l * 0.6, bx + 4, by - l); g.stroke(); }
        }
        if (R.burnt && R.burnt[i]) { circle(g, x + TILE / 2, y + TILE / 2, TILE * 0.66); g.fillStyle = 'rgba(20,16,12,0.5)'; g.fill(); for (let k = 0; k < 4; k++) { ellipse(g, x + rng() * TILE, y + rng() * TILE, 3 + rng() * 5, 2 + rng() * 3, rng() * 3); g.fillStyle = 'rgba(120,110,100,0.4)'; g.fill(); } }
        if (R.fire && R.fire[i] > 0) { g.fillStyle = radial(g, x + TILE / 2, y + TILE / 2, TILE * 0.75, 'rgba(255,160,40,0.6)', 'rgba(200,60,10,0)', 0, 0); circle(g, x + TILE / 2, y + TILE / 2, TILE * 0.75); g.fill(); }
        if (R.crystal && R.crystal[i]) {
          circle(g, x + TILE / 2, y + TILE / 2, TILE * 0.66); g.fillStyle = 'rgba(60,140,70,0.3)'; g.fill();
          for (let k = 0; k < 5; k++) { const cx = x + 6 + rng() * (TILE - 12), cy = y + 6 + rng() * (TILE - 12), h = 6 + rng() * 8, a = rng() * TAU; g.beginPath(); g.moveTo(cx + Math.cos(a + 1.6) * 3, cy + Math.sin(a + 1.6) * 3); g.lineTo(cx + Math.cos(a) * h, cy + Math.sin(a) * h); g.lineTo(cx + Math.cos(a - 1.6) * 3, cy + Math.sin(a - 1.6) * 3); g.closePath(); g.fillStyle = linear(g, cx, cy, cx + Math.cos(a) * h, cy + Math.sin(a) * h, [[0, '#1a7a3a'], [1, '#c8ffb0']]); g.fill(); }
        }
        if (R.blight && R.blight[i]) {
          circle(g, x + TILE / 2, y + TILE / 2, TILE * 0.66); g.fillStyle = 'rgba(80,40,90,0.35)'; g.fill();
          for (let k = 0; k < 6; k++) { const cx = x + rng() * TILE, cy = y + rng() * TILE, rr2 = 2 + rng() * 4; circle(g, cx, cy, rr2); g.fillStyle = rng() < 0.5 ? '#9a6aaa' : '#d8b8e0'; g.fill(); }
        }
      }
      R.ovCv = cv;
    }
    c.drawImage(R.ovCv, 0, 0, W, H);
    if (R.crystal) { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.25 + Math.sin(t * 2) * 0.1; c.drawImage(R.ovCv, 0, 0, W, H); c.restore(); }
  }
  function drawAir(c, t, lights) {
    if (!R) return;
    for (const tn of R.tentacles) drawTentacle(c, tn);
    for (const h of R.herds) {
      for (let i = 0; i < 4; i++) {
        const dd = h.d + i * 22, p = pointOn(h.route, clamp(dd, 0, h.route.total));
        if (dd < -30 || dd > h.route.total + 30) continue;
        drawDino(c, { x: p.x + (i % 2 ? 9 : -9) * -p.dy, y: p.y + (i % 2 ? 9 : -9) * p.dx, ang: Math.atan2(-p.dy, -p.dx), step: t * 3 + i, kind: 'tri', seed: i }, t, 0.75);
      }
    }
    for (const s of R.scouts) drawScout(c, s, t, lights);
    for (const b of R.beams) {
      const k = b.t / 1.4;
      if (b.bolt) {
        // a jagged bolt of lightning from the sky
        c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = Math.max(0, 1 - k * 2.5);
        c.strokeStyle = 'rgba(220,235,255,0.95)'; c.lineWidth = 3; c.beginPath(); c.moveTo(b.x0, b.y0);
        for (let i = 1; i <= 8; i++) { const q = i / 8; c.lineTo(lerp(b.x0, b.x1, q) + (i < 8 ? rand(-12, 12) : 0), lerp(b.y0, b.y1, q)); }
        c.stroke(); c.restore();
        if (lights && k < 0.3) lights.push({ x: b.x1, y: b.y1, r: 70, color: '200,220,255', a: 0.8 });
        continue;
      }
      if (b.swoop) { drawPtero(c, lerp(b.x0, b.x1, Math.min(1, k * 2)), lerp(b.y0, b.y1, Math.min(1, k * 2)), Math.atan2(b.y1 - b.y0, b.x1 - b.x0), t); continue; }
      c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = (1 - k) * 0.8;
      const w = b.lift ? 16 : 10, col = b.col || '160,255,200';
      const g = c.createLinearGradient(b.x0, b.y0, b.x1, b.y1); g.addColorStop(0, `rgba(${col},0.9)`); g.addColorStop(1, `rgba(${col},0.2)`);
      c.strokeStyle = g; c.lineWidth = w; c.lineCap = 'round'; c.beginPath(); c.moveTo(b.x0, b.y0); c.lineTo(b.x1, b.y1); c.stroke();
      c.restore();
    }
    for (const f of R.flights) {
      if (f.x == null) continue;
      if (f.art === 'dragon') drawDragon(c, f.x, f.y, f.a, t, lights);
      else if (f.art === 'ptero') for (let i = 0; i < 3; i++) drawPtero(c, f.x - i * 40, f.y + (i - 1) * 26, f.a, t + i);
      else { c.save(); c.globalAlpha = 0.5; ellipse(c, f.x, f.y, 26, 8); c.fillStyle = 'rgba(40,30,20,0.4)'; c.fill(); c.restore(); }
    }
    for (const h of R.hunters) drawRaptorAlly(c, h, t);
    for (const m of R.meteors) {
      const k = 1 - m.t / 0.9, x = lerp(m.x + 260, m.x, k), y = lerp(m.y - 380, m.y, k);
      c.save(); c.globalCompositeOperation = 'lighter';
      c.strokeStyle = 'rgba(170,255,150,0.6)'; c.lineWidth = 10; c.lineCap = 'round'; c.beginPath(); c.moveTo(x + 60, y - 90); c.lineTo(x, y); c.stroke();
      c.fillStyle = radial(c, x, y, 22, 'rgba(230,255,200,1)', 'rgba(80,220,100,0)', 0, 0); circle(c, x, y, 22); c.fill();
      c.restore();
      c.save(); c.strokeStyle = `rgba(170,255,150,${0.3 + k * 0.5})`; c.lineWidth = 2; c.setLineDash([6, 5]); circle(c, m.x, m.y, m.r); c.stroke(); c.restore();
    }
    // the smoke drifting through Emberwood hides whatever is under it
    for (const s of R.smoke) { c.save(); c.globalAlpha = 0.55; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + t * 0.2, d = s.r * 0.45; c.fillStyle = radial(c, s.x + Math.cos(a) * d, s.y + Math.sin(a) * d, s.r * 0.7, 'rgba(70,64,58,0.55)', 'rgba(70,64,58,0)', 0, 0); circle(c, s.x + Math.cos(a) * d, s.y + Math.sin(a) * d, s.r * 0.7); c.fill(); } c.restore(); }
    // parachutes over the paratroopers still coming down
    for (const e of S.enemies) if (e.dropT > 0) {
      const k = e.dropT / 1.4, y = e.y - 14 - k * 70;
      c.save(); c.globalAlpha = Math.min(1, e.dropT * 3);
      c.strokeStyle = 'rgba(40,40,40,0.7)'; c.lineWidth = 0.8; for (const sx of [-14, 0, 14]) { c.beginPath(); c.moveTo(e.x, e.y - 6 - k * 60); c.lineTo(e.x + sx, y); c.stroke(); }
      c.beginPath(); c.arc(e.x, y, 16, Math.PI, 0); c.closePath(); c.fillStyle = linear(c, e.x - 16, y, e.x + 16, y, [[0, '#5a6a3a'], [0.5, '#8a9a5a'], [1, '#4a5a2a']]); c.fill();
      c.restore();
    }
    if (R.sweep) {
      const a = R.sweep.a, k = Math.min(1, R.sweep.t * 3) * Math.min(1, (2.8 - R.sweep.t) * 3);
      c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = k;
      c.translate(W / 2, H / 2); c.rotate(a);
      c.fillStyle = linear(c, 0, -20, 0, 20, [[0, 'rgba(255,220,120,0)'], [0.5, 'rgba(255,240,180,0.9)'], [1, 'rgba(255,220,120,0)']]); c.fillRect(0, -20, Math.hypot(W, H), 40);
      c.restore();
      c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = radial(c, W / 2, H / 2, 40, 'rgba(255,240,180,0.9)', 'rgba(255,200,80,0)', 0, 0); circle(c, W / 2, H / 2, 40); c.fill(); c.restore();
      if (lights) lights.push({ x: W / 2, y: H / 2, r: 140, color: '255,220,120', a: 0.6 * k });
    }
    if (R.id === 'moonwell') drawMoon(c, t);
    if (R.id === 'skyhold') for (let i = 0; i < 6; i++) { const x = ((i * 190 + t * 12) % (W + 240)) - 120, y = (i % 2 ? H - 26 : 18) + Math.sin(t * 0.3 + i) * 6; c.save(); c.globalAlpha = 0.55; for (let k = 0; k < 4; k++) { c.fillStyle = 'rgba(255,255,255,0.8)'; circle(c, x + k * 22, y + (k % 2) * 6, 18 + (k % 2) * 6); c.fill(); } c.restore(); }
  }
  // the moon over the Moonwell, waxing a little every wave and full every fifth
  function drawMoon(c, t) {
    const ph = ((S.wave - 1) % 5 + 5) % 5, x = W - 44, y = 40, r = 20;
    c.save();
    c.fillStyle = radial(c, x, y, r * 3, `rgba(200,215,255,${0.15 + ph * 0.06})`, 'rgba(200,215,255,0)', 0, 0); circle(c, x, y, r * 3); c.fill();
    circle(c, x, y, r); c.fillStyle = '#1a2032'; c.fill();
    c.save(); circle(c, x, y, r); c.clip();
    circle(c, x, y, r); c.fillStyle = radial(c, x - 5, y - 5, r * 1.3, '#f4f6ff', '#9aa4c8', 0, 0); c.fill();
    if (ph < 4) { c.fillStyle = '#1a2032'; circle(c, x - r * (0.4 + ph * 0.45), y, r); c.fill(); }
    c.restore();
    c.restore();
  }
  function drawPtero(c, x, y, a, t) {
    const flap = Math.sin(t * 9) * 0.3;
    c.save(); c.translate(x, y); c.rotate(a);
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(4, s * 3); c.lineTo(6, s * (24 + flap * 10)); c.lineTo(-12, s * 8); c.closePath(); c.fillStyle = '#5a4448'; c.fill(); }
    ellipse(c, 0, 0, 12, 4); c.fillStyle = '#7a6060'; c.fill();
    c.beginPath(); c.moveTo(10, -2); c.lineTo(26, 0); c.lineTo(10, 2); c.fillStyle = '#d8c8a8'; c.fill();
    c.restore();
  }
  function drawRaptorAlly(c, h, t) {
    const run = Math.sin(h.step * 14);
    c.save(); c.translate(h.x, h.y); c.rotate(h.ang);
    ellipse(c, 2, 3, 14, 6); c.fillStyle = 'rgba(0,0,0,0.3)'; c.fill();
    c.beginPath(); c.moveTo(-6, -3); c.quadraticCurveTo(-18, run * 4, -24, run * 5); c.quadraticCurveTo(-18, 3, -6, 3); c.fillStyle = '#6a5a3a'; c.fill();
    for (const s of [-1, 1]) { ellipse(c, s * run * 4, s * 6, 4, 2.5); c.fillStyle = '#4a3a24'; c.fill(); }
    ellipse(c, 0, 0, 10, 6); c.fillStyle = radial(c, -2, -2, 10, '#a8885a', '#5a4428', 0, 0); c.fill();
    for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-6 + i * 3, 0); c.lineTo(-8 + i * 3, -6); c.lineTo(-4 + i * 3, 0); c.fillStyle = i % 2 ? '#2a6a8a' : '#c84a2a'; c.fill(); }
    ellipse(c, 12, 0, 6, 3.5); c.fillStyle = '#9a7a4a'; c.fill();
    circle(c, 13, -1.5, 1); circle(c, 13, 1.5, 1); c.fillStyle = '#ffe060'; c.fill();
    c.restore();
  }
  function drawTentacle(c, tn) {
    const k = tn.t < 0.55 ? tn.t / 0.55 : tn.t > 1.1 ? Math.max(0, 1 - (tn.t - 1.1) / 0.5) : 1;
    if (k <= 0) return;
    c.save(); c.translate(tn.x, tn.y);
    // a ring of churned water, then the arm curling up out of it
    ellipse(c, 0, 4, 16 * k + 4, 8 * k + 3); c.fillStyle = 'rgba(220,240,250,0.35)'; c.fill();
    const segs = 9;
    for (let i = segs; i >= 0; i--) {
      const q = i / segs, a = -Math.PI / 2 + tn.side * Math.sin(q * 3 + tn.t * 6) * 0.6 * q, len = 44 * k;
      const x = Math.cos(a) * len * q * 0.5 + tn.side * Math.sin(q * 2.4) * 10 * k, y = -len * q + 4;
      const w = (9 - q * 6) * Math.max(0.3, k);
      ellipse(c, x, y, w, w); c.fillStyle = radial(c, x - w * 0.3, y - w * 0.3, w * 1.2, '#c8607a', '#4a1426', 0, 0); c.fill();
      if (i % 2 === 0 && i > 1) { ellipse(c, x + tn.side * w * 0.3, y, w * 0.32, w * 0.32); c.fillStyle = '#f0c8c8'; c.fill(); }
    }
    c.restore();
  }
  function drawDino(c, d, t, scale = 1) {
    const s = (d.kind === 'long' ? 1.25 : 1) * scale, step = Math.sin((d.step || 0) * 5);
    c.save(); c.translate(d.x, d.y); c.rotate(d.ang); c.scale(s, s);
    ellipse(c, 4, 6, 26, 14); c.fillStyle = 'rgba(0,0,0,0.3)'; c.fill();
    const sk = d.kind === 'long' ? '#7a8a6a' : '#8a7a5a';
    for (const [lx, side, ph] of [[9, -1, step], [9, 1, -step], [-9, -1, -step], [-9, 1, step]]) { ellipse(c, lx + ph * 3, side * 11, 5, 4); c.fillStyle = shade(sk, -0.3); c.fill(); }
    // tail
    c.beginPath(); c.moveTo(-14, -5); c.quadraticCurveTo(-30, Math.sin(t * 2 + d.seed) * 6, -38, Math.sin(t * 2 + d.seed + 1) * 9); c.quadraticCurveTo(-30, 4, -14, 5); c.fillStyle = shade(sk, -0.15); c.fill();
    ellipse(c, 0, 0, 18, 12); c.fillStyle = radial(c, -3, -4, 20, shade(sk, 0.25), shade(sk, -0.4), 0, 0); c.fill();
    c.strokeStyle = 'rgba(60,40,20,0.35)'; c.lineWidth = 1; for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(-10 + i * 4, -9); c.lineTo(-8 + i * 4, 9); c.stroke(); }
    if (d.kind === 'long') {
      // a long neck reaching out to browse
      c.beginPath(); c.moveTo(12, -4); c.quadraticCurveTo(28, Math.sin(t + d.seed) * 6, 40, Math.sin(t * 0.8 + d.seed) * 8); c.lineTo(40, Math.sin(t * 0.8 + d.seed) * 8 + 5); c.quadraticCurveTo(28, 6, 12, 4); c.fillStyle = shade(sk, 0.05); c.fill();
      ellipse(c, 42, Math.sin(t * 0.8 + d.seed) * 8 + 2.5, 5, 4); c.fillStyle = shade(sk, 0.1); c.fill();
    } else {
      // a triceratops: frill and three horns
      ellipse(c, 16, 0, 8, 13); c.fillStyle = radial(c, 14, -3, 12, '#c8784a', '#6a3a22', 0, 0); c.fill();
      for (let i = -3; i <= 3; i++) { circle(c, 12 + Math.cos(i * 0.4) * 2, Math.sin(i * 0.4) * 12, 1.4); c.fillStyle = '#e8d8b8'; c.fill(); }
      ellipse(c, 23, 0, 7, 5.5); c.fillStyle = shade(sk, 0.15); c.fill();
      c.fillStyle = '#efe6cc';
      for (const sy of [-1, 1]) { c.beginPath(); c.moveTo(22, sy * 3); c.lineTo(35, sy * 5); c.lineTo(23, sy * 1); c.fill(); }
      c.beginPath(); c.moveTo(28, -1); c.lineTo(34, 0); c.lineTo(28, 1); c.fill();
    }
    c.restore();
  }
  function drawScout(c, s, t, lights) {
    const k = s.t < 0.6 ? s.t / 0.6 : s.t > s.dur + 0.6 ? Math.max(0, 1 - (s.t - s.dur - 0.6) / 0.6) : 1;
    const y = s.y - 70 + (1 - k) * -120, x = s.x + (1 - k) * 160;
    if (s.t < s.dur) {
      c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.5 * k;
      c.beginPath(); c.moveTo(x - 8, y + 6); c.lineTo(x + 8, y + 6); c.lineTo(s.x + 24, s.y + 10); c.lineTo(s.x - 24, s.y + 10); c.closePath();
      c.fillStyle = linear(c, 0, y, 0, s.y, [[0, 'rgba(170,255,210,0.9)'], [1, 'rgba(170,255,210,0.15)']]); c.fill();
      c.restore();
      if (lights) lights.push({ x: s.x, y: s.y, r: 40, color: '160,255,200', a: 0.5 * k });
    }
    c.save(); c.translate(x, y); c.globalAlpha = k;
    ellipse(c, 0, 0, 22, 9); c.fillStyle = radial(c, -5, -4, 24, '#e8ecf0', '#4a505a', 0, 0); c.fill();
    ellipse(c, 0, -3, 9, 6); c.fillStyle = 'rgba(170,255,220,0.75)'; c.fill();
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + t * 3; circle(c, Math.cos(a) * 17, Math.sin(a) * 6.5, 1.6); c.fillStyle = (i + Math.floor(t * 6)) % 2 ? '#ffe060' : '#6af0a0'; c.fill(); }
    c.restore();
  }
  // the Red Dragon seen from above: wide wings beating, a long neck, flame ahead of it
  function drawDragon(c, x, y, a, t, lights) {
    const flap = Math.sin(t * 10) * 0.25;
    c.save(); c.translate(x + 30, y + 46); c.rotate(a); c.globalAlpha = 0.2; ellipse(c, 0, 0, 50, 30); c.fillStyle = '#000'; c.fill(); c.restore();
    c.save(); c.translate(x, y); c.rotate(a);
    for (const s of [-1, 1]) {
      c.save(); c.scale(1, 1 - flap * s * 0.3 - Math.abs(flap) * 0.4);
      c.beginPath(); c.moveTo(6, s * 6); c.lineTo(10, s * 40); c.lineTo(-4, s * 64); c.quadraticCurveTo(-14, s * 44, -20, s * 50); c.quadraticCurveTo(-18, s * 30, -28, s * 30); c.quadraticCurveTo(-16, s * 18, -14, s * 6); c.closePath();
      c.fillStyle = linear(c, 0, 0, 0, s * 60, [[0, '#a82a1a'], [1, '#5a120a']]); c.fill();
      c.strokeStyle = '#e8b040'; c.lineWidth = 2; c.beginPath(); c.moveTo(6, s * 6); c.lineTo(10, s * 40); c.lineTo(-4, s * 64); c.stroke();
      c.lineWidth = 1; c.strokeStyle = 'rgba(40,6,2,0.6)'; for (const [tx, ty] of [[-20, 50], [-28, 30]]) { c.beginPath(); c.moveTo(10, s * 40); c.lineTo(tx, s * ty); c.stroke(); }
      c.restore();
    }
    c.beginPath(); c.moveTo(-14, -6); c.quadraticCurveTo(-40, Math.sin(t * 4) * 8, -60, Math.sin(t * 4 + 1) * 12); c.quadraticCurveTo(-40, 6, -14, 6); c.fillStyle = '#8a2014'; c.fill();
    ellipse(c, 0, 0, 20, 10); c.fillStyle = radial(c, -4, -4, 22, '#e04a2a', '#6a140a', 0, 0); c.fill();
    for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(-14 + i * 6, 0); c.lineTo(-11 + i * 6, -4); c.lineTo(-8 + i * 6, 0); c.fillStyle = '#e8b040'; c.fill(); }
    c.beginPath(); c.moveTo(14, -4); c.quadraticCurveTo(24, 0, 28, 0); c.quadraticCurveTo(24, 0, 14, 4); c.fillStyle = '#b8301a'; c.fill();
    ellipse(c, 31, 0, 7, 5); c.fillStyle = '#c83a1e'; c.fill();
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(28, s * 3); c.lineTo(22, s * 8); c.lineTo(30, s * 4); c.fillStyle = '#efe0c0'; c.fill(); circle(c, 33, s * 2.2, 1); c.fillStyle = '#ffe060'; c.fill(); }
    // the fire pours out ahead and below
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = radial(c, 52, 0, 26, 'rgba(255,220,120,0.9)', 'rgba(255,90,20,0)', 0, 0); ellipse(c, 52, 0, 26, 12); c.fill();
    c.restore();
    if (lights) lights.push({ x: x + Math.cos(a) * 50, y: y + Math.sin(a) * 50, r: 90, color: '255,140,50', a: 0.7 });
  }
  // a tower knocked out by an expedition attack; false when the game should draw it itself
  function drawTowerStun(c, tw, x, y) {
    if (!(tw.stun > 0) || !tw.stunKind) return false;
    const k = tw.stunKind, t = performance.now() / 1000;
    c.save(); c.translate(x, y);
    if (k === 'lava') {
      ellipse(c, 0, 0, 21, 17); c.fillStyle = radial(c, -5, -5, 24, '#5a4a44', '#1a1210', 0, 0); c.fill();
      c.strokeStyle = `rgba(255,140,40,${0.6 + Math.sin(t * 5) * 0.2})`; c.lineWidth = 1.4;
      for (let i = 0; i < 5; i++) { const a = i * 1.3; c.beginPath(); c.moveTo(Math.cos(a) * 4, Math.sin(a) * 4); c.lineTo(Math.cos(a + 0.3) * 15, Math.sin(a + 0.3) * 12); c.stroke(); }
    } else if (k === 'beam') {
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = radial(c, 0, 0, 30, 'rgba(170,255,210,0.55)', 'rgba(170,255,210,0)', 0, 0); circle(c, 0, 0, 30); c.fill();
      c.strokeStyle = 'rgba(200,255,220,0.8)'; c.lineWidth = 1.2; for (let i = 0; i < 3; i++) { const r = ((t * 30 + i * 9) % 26); circle(c, 0, 0, r); c.stroke(); }
    } else if (k === 'scorch') {
      c.fillStyle = 'rgba(20,14,10,0.55)'; rr(c, -20, -20, 40, 40, 6); c.fill();
      for (let i = 0; i < 3; i++) S.fx.length < 400 && Math.random() < 0.08 && S.fx.push({ kind: 'fire', x: x + rand(-12, 12), y: y + rand(-12, 12), vx: 0, vy: -20, r: rand(3, 5), life: 0.4, max: 0.4 });
    } else if (k === 'slam') {
      c.strokeStyle = 'rgba(240,200,210,0.85)'; c.lineWidth = 2; for (let i = 0; i < 3; i++) { const a = t * 6 + i * TAU / 3; circle(c, Math.cos(a) * 14, -22 + Math.sin(a) * 4, 2); c.stroke(); }
      c.fillStyle = 'rgba(200,230,240,0.35)'; rr(c, -20, -20, 40, 40, 6); c.fill();
    } else if (k === 'roots' || k === 'stone') {
      // gripped by roots, or knocked out by the Warden's stomp
      c.strokeStyle = k === 'roots' ? '#4a3018' : '#8a8a84'; c.lineWidth = 3; c.lineCap = 'round';
      for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + 0.4; c.beginPath(); c.moveTo(Math.cos(a) * 22, Math.sin(a) * 22); c.quadraticCurveTo(Math.cos(a + 0.6) * 10, Math.sin(a + 0.6) * 10, Math.cos(a + 1) * 4, Math.sin(a + 1) * 4); c.stroke(); }
      if (k === 'stone') { c.fillStyle = 'rgba(140,140,132,0.4)'; rr(c, -20, -20, 40, 40, 6); c.fill(); }
    } else if (k === 'spores') {
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + t, d = 10 + Math.sin(t * 3 + i) * 5; circle(c, Math.cos(a) * d, Math.sin(a) * d, 4); c.fillStyle = 'rgba(200,150,240,0.55)'; c.fill(); }
    } else if (k === 'prism' || k === 'bolt') {
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = radial(c, 0, 0, 26, k === 'prism' ? 'rgba(220,180,255,0.5)' : 'rgba(200,225,255,0.5)', 'rgba(200,200,255,0)', 0, 0); circle(c, 0, 0, 26); c.fill();
      c.strokeStyle = k === 'prism' ? 'rgba(240,220,255,0.9)' : 'rgba(230,240,255,0.9)'; c.lineWidth = 1.4;
      for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + t * 4; c.beginPath(); c.moveTo(Math.cos(a) * 6, Math.sin(a) * 6); c.lineTo(Math.cos(a + 0.3) * 14, Math.sin(a + 0.3) * 14); c.lineTo(Math.cos(a) * 20, Math.sin(a) * 20); c.stroke(); }
    } else if (k === 'snatch') {
      // carried off: just a shadow and scattered feathers where it stood
      c.fillStyle = 'rgba(10,8,8,0.6)'; rr(c, -20, -20, 40, 40, 6); c.fill();
      for (let i = 0; i < 5; i++) { const a = i * 1.3 + t; ellipse(c, Math.cos(a) * 12, Math.sin(a) * 12, 4, 1.5, a); c.fillStyle = '#d8c8a8'; c.fill(); }
    } else if (k === 'roar' || k === 'tail') {
      c.strokeStyle = 'rgba(255,240,170,0.9)'; c.lineWidth = 1.4; for (let i = 0; i < 3; i++) { const a = t * 6 + i * TAU / 3; circle(c, Math.cos(a) * 14, -22 + Math.sin(a) * 4, 2); c.stroke(); }
    } else { c.restore(); return false; }
    c.restore();
    return true;
  }

  // ---------- ground paint and props ----------
  function paintGround(c, M) {
    const id = M.L.exp, rng = mulberry32(M.L.look.seed + 5);
    if (id === 'ufo') {
      // crop circles pressed into the open ground
      for (let n = 0; n < 3; n++) {
        let x = 0, y = 0, ok = false;
        for (let k = 0; k < 40 && !ok; k++) { x = rand(TILE * 2, W - TILE * 2); y = rand(TILE * 2, H - TILE * 2); const g = M.grid[Math.floor(y / TILE) * COLS + Math.floor(x / TILE)]; ok = g === 0; x += (rng() - 0.5); }
        if (!ok) continue;
        const R0 = 26 + rng() * 22;
        c.save(); c.translate(x, y); c.rotate(rng() * TAU);
        c.strokeStyle = 'rgba(230,220,150,0.55)'; c.lineWidth = 3;
        for (const [rx, a] of [[R0, 1], [R0 * 0.62, 0.8], [R0 * 0.25, 0.9]]) { circle(c, 0, 0, rx); c.globalAlpha = a; c.stroke(); }
        c.globalAlpha = 0.6; c.lineWidth = 2;
        for (let i = 0; i < 3; i++) { const a = i * TAU / 3; circle(c, Math.cos(a) * R0 * 1.25, Math.sin(a) * R0 * 1.25, R0 * 0.2); c.stroke(); c.beginPath(); c.moveTo(Math.cos(a) * R0, Math.sin(a) * R0); c.lineTo(Math.cos(a) * R0 * 1.05, Math.sin(a) * R0 * 1.05); c.stroke(); }
        c.restore();
      }
    }
    if (id === 'eldertree') {
      // the Elder Tree itself, standing over the safehouse it shelters
      const x = M.end.x - TILE * 0.9, y = M.end.y - TILE * 0.9;
      for (let i = 0; i < 9; i++) { const a = i / 9 * TAU + 0.3, l = TILE * (1.2 + rng() * 0.6); c.strokeStyle = '#3a2a18'; c.lineWidth = 6 - i * 0.3; c.lineCap = 'round'; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.cos(a + 0.4) * l * 0.5, y + Math.sin(a + 0.4) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke(); }
      for (let i = 0; i < 26; i++) { const a = rng() * TAU, dd = rng() * TILE * 1.2, r = TILE * (0.3 + rng() * 0.3); c.fillStyle = ['#1e4a1a', '#2e6a24', '#4a8a30', '#6aa840'][i % 4]; c.globalAlpha = 0.85; circle(c, x + Math.cos(a) * dd - 4, y + Math.sin(a) * dd - 6, r); c.fill(); }
      c.globalAlpha = 1;
      c.fillStyle = 'rgba(255,240,160,0.4)'; for (let i = 0; i < 14; i++) { circle(c, x + (rng() - 0.5) * TILE * 2, y + (rng() - 0.5) * TILE * 2, 1.4); c.fill(); }
    }
    if (id === 'starfall') {
      // the impact crater's scorched rim
      for (let i = 0; i < 3; i++) { const x = rng() * W, y = rng() * H, r = 30 + rng() * 40; c.strokeStyle = 'rgba(20,24,16,0.4)'; c.lineWidth = 8; circle(c, x, y, r); c.stroke(); c.fillStyle = 'rgba(10,14,8,0.25)'; c.fill(); }
    }
    if (id === 'cinder' || id === 'ashen') {
      // cooled flows of black rock and patches of ash
      for (let i = 0; i < 9; i++) { const x = rng() * W, y = rng() * H; ellipse(c, x, y, 20 + rng() * 30, 8 + rng() * 14, rng() * 3); c.fillStyle = 'rgba(10,8,6,0.3)'; c.fill(); }
    }
  }
  function decor(c, d, rng, M) {
    switch (d.kind) {
      case 'basalt': {
        for (let i = 0; i < 3; i++) {
          const x = (rng() - 0.5) * 16, y = (rng() - 0.5) * 12, r = 6 + rng() * 6;
          c.beginPath(); for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + rng() * 0.3; const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r * 0.8; k ? c.lineTo(px, py) : c.moveTo(px, py); } c.closePath();
          c.save(); c.translate(2, 3); c.fillStyle = 'rgba(0,0,0,0.45)'; c.fill(); c.restore();
          c.fillStyle = radial(c, x - r * 0.3, y - r * 0.3, r * 1.3, '#5a504a', '#16100e', 0, 0); c.fill();
          c.strokeStyle = 'rgba(255,120,40,0.75)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(x - r * 0.5, y); c.lineTo(x, y + r * 0.2); c.lineTo(x + r * 0.4, y - r * 0.3); c.stroke();
        }
        break;
      }
      case 'vent': {
        ellipse(c, 0, 0, 14, 11); c.fillStyle = radial(c, -3, -3, 16, '#6a5a3a', '#2a2018', 0, 0); c.fill();
        ellipse(c, 0, 0, 9, 7); c.fillStyle = '#d8c040'; c.fill();
        ellipse(c, 0, 0, 5, 4); c.fillStyle = radial(c, 0, 0, 5, '#ffb040', '#3a1a08', 0, 0); c.fill();
        if (M) M.smoke.push({ x: d.x, y: d.y });
        break;
      }
      case 'anchor': {
        c.rotate(d.rot);
        c.strokeStyle = '#4a3a30'; c.lineWidth = 3; c.lineCap = 'round';
        c.beginPath(); c.moveTo(0, -12); c.lineTo(0, 10); c.stroke();
        c.beginPath(); c.arc(0, 2, 10, 0.3, Math.PI - 0.3); c.stroke();
        c.beginPath(); c.moveTo(-6, -8); c.lineTo(6, -8); c.stroke();
        c.strokeStyle = '#6a5a4a'; c.lineWidth = 1.2; c.setLineDash([2, 2]); c.beginPath(); c.moveTo(0, -12); c.quadraticCurveTo(12, -20, 18, -10); c.stroke(); c.setLineDash([]);
        break;
      }
      case 'rowboat': {
        c.rotate(d.rot);
        ellipse(c, 2, 3, 15, 7); c.fillStyle = 'rgba(0,0,0,0.35)'; c.fill();
        c.beginPath(); c.moveTo(-15, 0); c.quadraticCurveTo(-10, -8, 8, -6); c.lineTo(15, 0); c.lineTo(8, 6); c.quadraticCurveTo(-10, 8, -15, 0); c.fillStyle = '#7a5a3a'; c.fill();
        c.strokeStyle = '#3a2a1a'; c.lineWidth = 1; c.stroke();
        c.fillStyle = '#5a4028'; c.fillRect(-4, -6, 2, 12); c.fillRect(4, -5, 2, 10);
        break;
      }
      case 'nets': {
        c.rotate(d.rot);
        c.strokeStyle = 'rgba(200,190,160,0.7)'; c.lineWidth = 0.6;
        for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(-14, i * 3); c.quadraticCurveTo(0, i * 3 + 3, 14, i * 3); c.stroke(); c.beginPath(); c.moveTo(i * 4, -10); c.lineTo(i * 4 + 2, 10); c.stroke(); }
        for (let i = 0; i < 4; i++) { circle(c, (rng() - 0.5) * 24, (rng() - 0.5) * 18, 1.6); c.fillStyle = '#d87a3a'; c.fill(); }
        break;
      }
      case 'bones': {
        c.rotate(d.rot);
        // the ribcage of something enormous
        c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 4; c.lineCap = 'round';
        const rib = (off) => { for (let i = 0; i < 5; i++) { const x = -12 + i * 6; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(x + off, off); c.quadraticCurveTo(x + 6 + off, s * 12 + off, x + off, s * 16 + off); c.stroke(); } } c.beginPath(); c.moveTo(-16 + off, off); c.lineTo(16 + off, off); c.stroke(); };
        rib(2); c.strokeStyle = '#e8e0cc'; c.lineWidth = 2.6; rib(0);
        break;
      }
      case 'hoard': {
        for (let i = 0; i < 30; i++) { const a = rng() * TAU, r = Math.sqrt(rng()) * 14; circle(c, Math.cos(a) * r, Math.sin(a) * r * 0.8, 2.4); c.fillStyle = radial(c, Math.cos(a) * r - 0.8, Math.sin(a) * r * 0.8 - 0.8, 3, '#fff0a0', '#a8781a', 0, 0); c.fill(); }
        for (let i = 0; i < 2; i++) { const x = (rng() - 0.5) * 16, y = (rng() - 0.5) * 10; ellipse(c, x, y, 4, 3.5); c.fillStyle = '#e8e0cc'; c.fill(); circle(c, x + 1, y - 1, 0.9); circle(c, x + 1, y + 1, 0.9); c.fillStyle = '#1a1410'; c.fill(); }
        break;
      }
      case 'fern': {
        for (let i = 0; i < 9; i++) {
          const a = i / 9 * TAU + rng() * 0.3, l = 12 + rng() * 6;
          c.save(); c.rotate(a);
          c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(l * 0.5, -4, l, 0); c.quadraticCurveTo(l * 0.5, 4, 0, 0);
          c.fillStyle = i % 2 ? '#3a6a24' : '#4e8430'; c.fill();
          c.strokeStyle = 'rgba(20,40,10,0.6)'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(0, 0); c.lineTo(l, 0); c.stroke();
          c.restore();
        }
        break;
      }
      case 'nest': {
        ellipse(c, 0, 0, 14, 11); c.fillStyle = radial(c, -3, -3, 16, '#8a6a3a', '#3a2a14', 0, 0); c.fill();
        ellipse(c, 0, 0, 9, 7); c.fillStyle = '#2a1e10'; c.fill();
        for (let i = 0; i < 3; i++) { const a = i * 2.1; ellipse(c, Math.cos(a) * 4, Math.sin(a) * 3, 3.4, 4.2, a); c.fillStyle = radial(c, Math.cos(a) * 4 - 1, Math.sin(a) * 3 - 1, 5, '#f8f0dc', '#b8a888', 0, 0); c.fill(); }
        break;
      }
      case 'runestone': {
        // a standing stone, lit on one face, its runes glowing
        c.save(); c.translate(3, 5); c.fillStyle = 'rgba(0,0,0,0.4)'; ellipse(c, 0, 0, 10, 6); c.fill(); c.restore();
        c.beginPath(); c.moveTo(-8, 6); c.lineTo(-7, -16); c.lineTo(-2, -22); c.lineTo(6, -19); c.lineTo(8, 6); c.closePath();
        c.fillStyle = linear(c, -8, 0, 8, 0, [[0, '#a8a8a0'], [0.5, '#7a7a74'], [1, '#4a4a46']]); c.fill();
        c.strokeStyle = '#7ad8ff'; c.lineWidth = 1.2; c.lineCap = 'round';
        for (let i = 0; i < 3; i++) { const y = -14 + i * 7; c.beginPath(); c.moveTo(-3, y); c.lineTo(0, y + 3); c.lineTo(3, y); if (i % 2) { c.moveTo(-3, y + 1.5); c.lineTo(3, y + 1.5); } c.stroke(); }
        break;
      }
      case 'crystal': {
        // a cluster of star-crystal, or a floating spire, or a shard of the Rift
        const col = M && M.L.exp === 'spires' ? ['#4a2a8a', '#e0c8ff'] : M && M.L.exp === 'rift' ? ['#3a1a5a', '#c890ff'] : ['#1a7a3a', '#c8ffb0'];
        c.save(); c.translate(3, 5); c.fillStyle = 'rgba(0,0,0,0.35)'; ellipse(c, 0, 0, 12, 6); c.fill(); c.restore();
        for (let i = 0; i < 5; i++) {
          const a = -Math.PI / 2 + (i - 2) * 0.4 + (rng() - 0.5) * 0.2, h = 14 + rng() * 12, bx = (i - 2) * 3;
          c.beginPath(); c.moveTo(bx - 4, 4); c.lineTo(bx + Math.cos(a) * h, 4 + Math.sin(a) * h); c.lineTo(bx + 4, 4); c.closePath();
          c.fillStyle = linear(c, bx, 4, bx + Math.cos(a) * h, 4 + Math.sin(a) * h, [[0, col[0]], [1, col[1]]]); c.fill();
          c.strokeStyle = 'rgba(255,255,255,0.4)'; c.lineWidth = 0.6; c.stroke();
        }
        break;
      }
      case 'pillar': {
        // a fallen or standing column of the temple, gold leaf flaking off it
        c.rotate(Math.floor(d.rot * 2) * Math.PI / 2);
        if (rng() < 0.5) {
          c.save(); c.translate(3, 4); c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(-16, -5, 32, 10); c.restore();
          c.fillStyle = linear(c, 0, -5, 0, 5, [[0, '#e8d4a0'], [1, '#9a8458']]); c.fillRect(-16, -5, 32, 10);
          c.strokeStyle = 'rgba(80,60,30,0.5)'; c.lineWidth = 0.6; for (let x = -12; x < 16; x += 6) { c.beginPath(); c.moveTo(x, -5); c.lineTo(x, 5); c.stroke(); }
        } else {
          c.save(); c.translate(3, 5); c.fillStyle = 'rgba(0,0,0,0.4)'; ellipse(c, 0, 0, 10, 7); c.fill(); c.restore();
          circle(c, 0, 0, 9); c.fillStyle = radial(c, -3, -3, 11, '#f4e4b8', '#9a8458', 0, 0); c.fill();
          circle(c, 0, 0, 6); c.strokeStyle = '#d8a83a'; c.lineWidth = 1.4; c.stroke();
        }
        break;
      }
      case 'cow': {
        c.rotate(d.rot);
        ellipse(c, 2, 3, 13, 8); c.fillStyle = 'rgba(0,0,0,0.3)'; c.fill();
        ellipse(c, 0, 0, 12, 7); c.fillStyle = '#f2ede2'; c.fill();
        for (let i = 0; i < 3; i++) { ellipse(c, (rng() - 0.5) * 14, (rng() - 0.5) * 8, 3 + rng() * 2, 2 + rng() * 2, rng() * 3); c.fillStyle = '#1e1c1a'; c.fill(); }
        ellipse(c, 13, 0, 4.5, 3.6); c.fillStyle = '#e8e2d6'; c.fill();
        ellipse(c, 16.5, 0, 2, 2.6); c.fillStyle = '#d8a8a0'; c.fill();
        break;
      }
    }
  }

  return {
    LIST, ORDER, ICONS, has, isOpen, unlock, wonStars, keysLeft, keysEarned, starsToKey, campaignStars, STARS_PER_KEY, LIVES,
    level, begin, end, onWave, update, bossTick, drawGround, drawAir, drawTowerStun, paintGround, decor,
    owned, charges, cast, castAt, strength, campaignWin, winsToCharge, finish, towerMod, onSpawn, wardLeak,
    chatter: (L) => LIST[L.exp] && LIST[L.exp].chatter,
    forecast: (id) => LIST[id] && LIST[id].forecast,
  };
})();
