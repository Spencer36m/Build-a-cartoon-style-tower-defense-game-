'use strict';
// ============================================================
// Story: the campaign's motion-comic cutscenes. Each chapter is a run of manga pages; each page
// reveals its panels one tap at a time, with lettered balloons typed out, sound effects,
// slow camera drift inside the panels and a page turn between pages.
// ============================================================

// ---------- the script ----------
// Pages are laid out on a 1000 × 562 sheet. A panel is a polygon (at), a scene from SCENES with
// options (o), and lettering (text): cap and loc captions, say and shout balloons, radio
// transmissions and sfx onomatopoeia. Balloon positions and tails are in sheet units too.
const STORY = (() => {
const R = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const FULL = R(14, 14, 986, 548);
return {
  prologue: {
    title: 'Starfall', kicker: 'Prologue', world: 0,
    pages: [
      { panels: [
        { at: [[14, 14], [640, 14], [610, 300], [14, 300]], art: 'meteorSky', cam: [1.12, 1, -0.04, 0.02], snd: 'missile',
          text: [{ k: 'loc', x: 30, y: 30, w: 330, t: 'Hollow Creek, Kansas. Eleven months ago.' }, { k: 'sfx', x: 300, y: 120, t: 'SHHRRRAAAA', size: 46, rot: -0.36, col: 'green', grow: 1 }] },
        { at: [[652, 14], [986, 14], [986, 300], [622, 300]], art: 'impact', fx: 'slam', snd: 'impact', cam: [1.15, 1.02],
          text: [{ k: 'sfx', x: 690, y: 240, t: 'KRA-KOOM!', size: 66, rot: -0.12, col: 'paper' }] },
        { at: R(14, 312, 986, 548), art: 'crystalCrater', cam: [1, 1.1, 0, -0.03],
          text: [{ k: 'cap', x: 36, y: 332, w: 280, t: 'Something came down with it.' }, { k: 'cap', x: 700, y: 480, w: 270, t: 'Something that wanted to live.' }] },
      ] },
      { panels: [
        { at: [[14, 14], [550, 14], [520, 548], [14, 548]], art: 'labTank', cam: [1.1, 1, 0, 0.03],
          text: [{ k: 'cap', x: 30, y: 30, w: 290, t: 'Kessler-Vane Biotech buried a research lab under the cornfields.' }, { k: 'cap', x: 30, y: 490, w: 300, t: 'They called it Project Lazarus.' }] },
        { at: [[562, 14], [986, 14], [986, 270], [548, 270]], art: 'portrait', o: { who: 'okafor', mood: 'grim', glasses: '#52e07c', bg: 'lab', x: 0.68 }, cam: [1, 1.08, 0, 0.02],
          text: [{ k: 'say', who: 'Dr. Mara Okafor', x: 580, y: 46, w: 190, t: "It doesn't just repair dead tissue.", tail: [800, 150] }] },
        { at: [[547, 282], [986, 282], [986, 548], [532, 548]], art: 'monitor', cam: [1.06, 1],
          text: [{ k: 'say', x: 560, y: 300, w: 200, t: 'It rewrites it. Cell by cell.', tail: [545, 380] }, { k: 'cap', x: 740, y: 500, w: 230, t: 'They wanted to end death.' }] },
      ] },
      { music: 'tension', panels: [
        { at: [[14, 14], [470, 14], [450, 330], [14, 330]], art: 'alarm', snd: 'alarm', cam: [1.12, 1],
          text: [{ k: 'loc', x: 30, y: 30, w: 290, t: 'Site HC-1, Level 2. Day 212.' }, { k: 'sfx', x: 200, y: 260, t: 'WHOOP WHOOP', size: 40, rot: -0.1, col: 'red' }] },
        { at: [[482, 14], [986, 14], [986, 330], [462, 330]], art: 'handGlass', fx: 'slam', snd: 'shatter', cam: [1.18, 1.02],
          text: [{ k: 'sfx', x: 700, y: 60, t: 'KRSSSH!', size: 60, rot: 0.14, col: 'paper', grow: 1 }] },
        { at: R(14, 342, 986, 548), art: 'eyeExtreme', cam: [1, 1.14],
          text: [{ k: 'cap', x: 36, y: 362, w: 250, t: 'The subjects in Bay Four stopped being dead.' }, { k: 'cap', x: 720, y: 490, w: 250, t: 'They started being hungry.' }] },
      ] },
      { music: 'tension', panels: [
        { at: [[14, 14], [640, 14], [610, 548], [14, 548]], art: 'okaforRun', snd: 'groan', cam: [1.1, 1, 0.03, 0],
          text: [{ k: 'shout', who: 'Dr. Okafor', x: 300, y: 40, w: 220, t: 'If they get out, we lose everything!', tail: [210, 230] }, { k: 'say', x: 340, y: 420, w: 200, t: "I'm taking the core.", tail: [240, 330] }] },
        { at: [[652, 14], [986, 14], [986, 270], [638, 270]], art: 'infectionMap', cam: [1.12, 1],
          text: [{ k: 'cap', x: 664, y: 26, w: 300, t: 'Seventy-two hours later, Hollow Creek was gone.' }] },
        { at: [[637, 282], [986, 282], [986, 548], [622, 548]], art: 'burningCity', snd: 'boom', cam: [1, 1.1, 0, 0.02],
          text: [{ k: 'cap', x: 650, y: 296, w: 300, t: 'In two weeks, so were most of the cities.' }, { k: 'cap', x: 660, y: 484, w: 310, t: 'The infected follow the roads. They always find the living.' }] },
      ] },
      { panels: [
        { at: [[14, 14], [986, 14], [986, 230], [14, 250]], art: 'convoy', cam: [1.1, 1, -0.03, 0],
          text: [{ k: 'cap', x: 30, y: 30, w: 330, t: 'What was left of the army regrouped as Bastion Company.' }] },
        { at: [[14, 262], [420, 254], [420, 548], [14, 548]], art: 'portrait', o: { who: 'voss', mood: 'grim', bg: 'night', glow: 'amber', x: 0.4 }, cam: [1.08, 1],
          text: [{ k: 'say', who: 'Major Elena Voss', x: 236, y: 286, w: 170, t: 'Commander. You have the field.', tail: [190, 400] }] },
        { at: [[432, 253], [986, 242], [986, 548], [432, 548]], art: 'briefing', cam: [1.12, 1, 0.03, 0],
          text: [{ k: 'say', x: 446, y: 268, w: 260, t: 'Dr. Mara Okafor escaped Ground Zero with the Lazarus Core.', tail: [425, 330] }, { k: 'say', x: 470, y: 470, w: 220, t: "If anyone can reverse this, it's her.", tail: [425, 500] }] },
      ] },
      { panels: [
        { at: [[14, 14], [560, 14], [540, 548], [14, 548]], art: 'portrait', o: { who: 'moreno', mood: 'smile', bg: 'lines', sandbags: true, turn: 0.2 }, cam: [1.08, 1],
          text: [{ k: 'radio', who: 'Voss', x: 30, y: 30, w: 230, t: 'We hold the roads. We keep the safehouses breathing. We find her.', tail: [14, 120] },
            { k: 'say', who: 'Sgt. Dax Moreno', x: 330, y: 300, w: 180, t: "Then let's go to work.", tail: [300, 240] }] },
        { at: [[572, 14], [986, 14], [986, 548], [552, 548]], art: 'horde', snd: 'groan', cam: [1, 1.12, 0, 0.04],
          text: [{ k: 'cap', x: 600, y: 484, w: 360, t: 'Every road. Every safehouse. Every night.' }] },
      ] },
      { panels: [{ at: FULL, art: 'titleCard', o: { title: 'ZOMBIE BASH', sub: 'HOLD THE LINE' }, fx: 'flash', snd: 'impact', cam: [1.06, 1] }] },
    ],
  },

  'w0-intro': {
    title: 'Harvest', kicker: 'Chapter 1', world: 0,
    pages: [
      { panels: [{ at: FULL, art: 'chapter', o: { world: 0, kicker: 'CHAPTER 1', title: 'HARVEST', place: 'HOLLOW CREEK FARMLAND', spot: 'amber' }, cam: [1.08, 1] }] },
      { panels: [
        { at: [[14, 14], [640, 14], [620, 548], [14, 548]], art: 'farmRoad', cam: [1, 1.1, 0, -0.02], snd: 'groan',
          text: [{ k: 'loc', x: 30, y: 30, w: 300, t: 'Hollow Creek. Where it started.' }] },
        { at: [[652, 14], [986, 14], [986, 276], [643, 276]], art: 'portrait', o: { who: 'voss', mood: 'calm', bg: 'tone', x: 0.62 }, cam: [1.06, 1],
          text: [{ k: 'radio', who: 'Voss', x: 662, y: 26, w: 180, t: 'Survivors are holding a farmhouse at the end of this road.', tail: [800, 120] }] },
        { at: [[642, 288], [986, 288], [986, 548], [632, 548]], art: 'portrait', o: { who: 'moreno', mood: 'smile', bg: 'speed', x: 0.62, turn: -0.2 }, cam: [1.08, 1],
          text: [{ k: 'say', who: 'Moreno', x: 650, y: 300, w: 170, t: "Slow, loud and hungry. Light 'em up before they reach the fence.", tail: [800, 400] }] },
      ] },
    ],
  },
  'w0-mid': {
    title: 'A Voice in the Static', kicker: 'Chapter 1', world: 0,
    pages: [{ panels: [
      { at: [[14, 14], [620, 14], [590, 548], [14, 548]], art: 'radio', snd: 'static', cam: [1.12, 1],
        text: [{ k: 'radio', who: 'Unknown signal', x: 30, y: 30, w: 250, t: '...Bastion... this is Okafor... do you read...', tail: [180, 190] }, { k: 'radio', x: 300, y: 400, w: 260, t: '...Blackwood... the buried are moving... hurry...', tail: [250, 300] }, { k: 'sfx', x: 360, y: 90, t: 'KSSHHH', size: 40, rot: 0.1, col: 'green' }] },
      { at: [[632, 14], [986, 14], [986, 548], [602, 548]], art: 'portrait', o: { who: 'voss', mood: 'shout', bg: 'lines', x: 0.55 }, fx: 'shake', cam: [1.1, 1],
        text: [{ k: 'shout', who: 'Voss', x: 650, y: 30, w: 170, t: "That's her. She's alive!", tail: [790, 170] }, { k: 'say', x: 760, y: 420, w: 200, t: 'Hold this valley, Commander. Then we go get her.', tail: [800, 330] }] },
    ] }],
  },
  'w0-outro': {
    title: 'The First to Turn', kicker: 'Chapter 1', world: 0,
    pages: [{ panels: [
      { at: R(14, 14, 986, 330), art: 'bossFall', o: { kind: 'harvester', spot: 'amber' }, fx: 'slam', snd: 'stomp', cam: [1.12, 1.02],
        text: [{ k: 'sfx', x: 640, y: 70, t: 'THOOOM', size: 70, rot: 0.08, col: 'amber', grow: 1 }, { k: 'cap', x: 30, y: 30, w: 300, t: 'Elias Crane. The farmer who found the meteor. The first to turn.' }] },
      { at: R(14, 342, 560, 548), art: 'badge', cam: [1.1, 1],
        text: [{ k: 'say', who: 'Moreno', x: 30, y: 356, w: 210, t: "Doc was right. He was on Kessler-Vane's payroll.", tail: [14, 460] }] },
      { at: R(572, 342, 986, 548), art: 'worldMap', o: { upto: 1 }, cam: [1.12, 1, -0.05, 0],
        text: [{ k: 'radio', who: 'Voss', x: 760, y: 450, w: 210, t: "Okafor's signal came from Blackwood. Wheels up, Commander.", tail: [986, 420] }] },
    ] }],
  },

  'w1-intro': {
    title: 'The Restless', kicker: 'Chapter 2', world: 1,
    pages: [
      { panels: [{ at: FULL, art: 'chapter', o: { world: 1, kicker: 'CHAPTER 2', title: 'THE RESTLESS', place: 'BLACKWOOD CEMETERY', spot: 'purple' }, cam: [1.08, 1] }] },
      { panels: [
        { at: [[14, 14], [600, 14], [580, 300], [14, 300]], art: 'cemeteryGates', snd: 'crow', cam: [1.12, 1],
          text: [{ k: 'cap', x: 30, y: 30, w: 300, t: 'Blackwood. Forty thousand graves, and not one of them quiet.' }] },
        { at: [[612, 14], [986, 14], [986, 300], [592, 300]], art: 'skeletonHand', fx: 'slam', snd: 'dig', cam: [1.15, 1.02],
          text: [{ k: 'sfx', x: 640, y: 50, t: 'KRAK!', size: 64, rot: -0.15, col: 'purple' }, { k: 'cap', x: 640, y: 240, w: 260, t: 'The strain is waking bodies a century old.' }] },
        { at: R(14, 312, 986, 548), art: 'riftSky', snd: 'thunder', cam: [1, 1.1, 0, 0.03],
          text: [{ k: 'radio', who: 'Okafor', x: 610, y: 330, w: 260, t: 'The crystal is tearing the sky open over the chapel.', tail: [986, 380] }, { k: 'radio', x: 690, y: 470, w: 240, t: 'Keep them away from it. Please.', tail: [986, 500] }] },
      ] },
    ],
  },
  'w1-mid': {
    title: 'North', kicker: 'Chapter 2', world: 1,
    pages: [{ panels: [
      { at: [[14, 14], [560, 14], [560, 548], [14, 548]], art: 'radio', o: { ch: 'CH 07  ·  OKAFOR, M.' }, snd: 'static', cam: [1.1, 1],
        text: [{ k: 'radio', who: 'Okafor', x: 30, y: 30, w: 260, t: "I'm heading north. Frostfall. Station Seven.", tail: [170, 200] }, { k: 'radio', x: 280, y: 400, w: 260, t: 'The cold slows the strain. I can finish the work there.', tail: [260, 330] }] },
      { at: R(572, 14, 986, 548), art: 'portrait', o: { who: 'moreno', mood: 'tired', bg: 'storm', x: 0.5 }, cam: [1.08, 1],
        text: [{ k: 'say', who: 'Moreno', x: 600, y: 36, w: 140, t: 'North. Great.', tail: [740, 160] }, { k: 'say', x: 800, y: 420, w: 150, t: 'I hate the cold.', tail: [820, 340] }] },
    ] }],
  },
  'w1-outro': {
    title: 'The Rift Closes', kicker: 'Chapter 2', world: 1,
    pages: [{ panels: [
      { at: [[14, 14], [640, 14], [620, 548], [14, 548]], art: 'bossFall', o: { kind: 'grave', spot: 'purple' }, fx: 'slam', snd: 'stomp', cam: [1.12, 1.02],
        text: [{ k: 'sfx', x: 360, y: 60, t: 'KRRAAASH', size: 60, rot: 0.1, col: 'purple', grow: 1 }, { k: 'cap', x: 30, y: 470, w: 300, t: 'The Grave Lord fell, and the rift above Blackwood sealed shut.' }] },
      { at: [[652, 14], [986, 14], [986, 276], [643, 276]], art: 'worldMap', o: { upto: 2 }, cam: [1.12, 1, 0.05, -0.02],
        text: [{ k: 'cap', x: 664, y: 26, w: 230, t: 'Okafor was already gone.' }] },
      { at: [[642, 288], [986, 288], [986, 548], [632, 548]], art: 'portrait', o: { who: 'voss', mood: 'calm', bg: 'night', x: 0.6, turn: 0.2 }, cam: [1.08, 1],
        text: [{ k: 'say', who: 'Voss', x: 650, y: 300, w: 160, t: "She's gone north. Pack for the cold.", tail: [790, 390] }] },
    ] }],
  },

  'w2-intro': {
    title: 'White Silence', kicker: 'Chapter 3', world: 2,
    pages: [
      { panels: [{ at: FULL, art: 'chapter', o: { world: 2, kicker: 'CHAPTER 3', title: 'WHITE SILENCE', place: 'FROSTFALL TUNDRA  ·  STATION 7', spot: 'ice' }, cam: [1.08, 1] }] },
      { panels: [
        { at: [[14, 14], [986, 14], [986, 240], [14, 256]], art: 'snowstorm', cam: [1.1, 1, 0.03, 0],
          text: [{ k: 'loc', x: 30, y: 30, w: 300, t: 'Frostfall Tundra. Station Seven.' }] },
        { at: [[14, 268], [420, 261], [420, 548], [14, 548]], art: 'portrait', o: { who: 'okafor', mood: 'tired', parka: true, bg: 'storm', x: 0.42 }, cam: [1.08, 1],
          text: [{ k: 'say', who: 'Dr. Okafor', x: 236, y: 286, w: 170, t: 'You came. Good.', tail: [210, 380] }, { k: 'say', x: 230, y: 470, w: 180, t: 'Then you need to see what they built up here.', tail: [200, 440] }] },
        { at: [[432, 261], [986, 252], [986, 548], [432, 548]], art: 'frozenGiant', snd: 'freeze', cam: [1, 1.1, 0, 0.03],
          text: [{ k: 'say', x: 450, y: 276, w: 200, t: 'Their soldier. Lazarus, version two.', tail: [520, 470] }, { k: 'cap', x: 820, y: 276, w: 150, t: "It's waking up." }] },
      ] },
    ],
  },
  'w2-mid': {
    title: 'The Source', kicker: 'Chapter 3', world: 2,
    pages: [{ panels: [
      { at: [[14, 14], [600, 14], [580, 548], [14, 548]], art: 'console', cam: [1.1, 1],
        text: [{ k: 'say', who: 'Okafor', x: 300, y: 330, w: 250, t: 'The cure needs a sample from the source. From the hive itself.', tail: [330, 470] }] },
      { at: [[612, 14], [986, 14], [986, 548], [592, 548]], art: 'worldMap', o: { upto: 3 }, cam: [1.25, 1.05, 0.06, 0.12],
        text: [{ k: 'say', x: 630, y: 30, w: 220, t: "It's in the bayou. Every road leads there.", tail: [600, 120] }] },
    ] }],
  },
  'w2-outro': {
    title: 'Thaw', kicker: 'Chapter 3', world: 2,
    pages: [{ panels: [
      { at: [[14, 14], [620, 14], [600, 548], [14, 548]], art: 'frozenGiant', o: { broken: true }, fx: 'slam', snd: 'shatter', cam: [1.15, 1.02],
        text: [{ k: 'sfx', x: 60, y: 80, t: 'SHHKRAAAK', size: 58, rot: -0.2, col: 'ice', grow: 1 }, { k: 'cap', x: 30, y: 480, w: 280, t: 'Lazarus Two came apart like river ice.' }] },
      { at: [[632, 14], [986, 14], [986, 548], [612, 548]], art: 'vial', snd: 'heal', cam: [1.1, 1],
        text: [{ k: 'say', who: 'Okafor', x: 650, y: 40, w: 170, t: 'The core is stable.', tail: [800, 180] }, { k: 'say', x: 780, y: 440, w: 180, t: 'Now we need the hive.', tail: [820, 380] }] },
    ] }],
  },

  'w3-intro': {
    title: 'The Hive', kicker: 'Chapter 4', world: 3,
    pages: [
      { panels: [{ at: FULL, art: 'chapter', o: { world: 3, kicker: 'CHAPTER 4', title: 'THE HIVE', place: 'BLACK BAYOU', spot: 'green' }, cam: [1.08, 1] }] },
      { music: 'tension', panels: [
        { at: R(14, 14, 986, 230), art: 'swamp', cam: [1.1, 1, -0.03, 0],
          text: [{ k: 'loc', x: 30, y: 30, w: 300, t: 'Black Bayou. Every road ends here.' }] },
        { at: [[14, 242], [640, 242], [620, 548], [14, 548]], art: 'behemothRise', fx: 'shake', snd: 'roar', cam: [1, 1.1, 0, 0.04],
          text: [{ k: 'radio', who: 'Voss', x: 30, y: 258, w: 230, t: 'That thing is the hive.', tail: [14, 300] }, { k: 'radio', x: 400, y: 470, w: 210, t: 'Every infected on the planet answers to it.', tail: [620, 520] }] },
        { at: [[652, 242], [986, 242], [986, 548], [632, 548]], art: 'trio', cam: [1.1, 1],
          text: [{ k: 'say', who: 'Okafor', x: 660, y: 256, w: 170, t: 'Bring it down, and the core does the rest.', tail: [810, 400] }, { k: 'say', who: 'Moreno', x: 840, y: 470, w: 130, t: 'Last stand, then.', tail: [880, 410] }] },
      ] },
    ],
  },
  'w3-mid': {
    title: 'Converging', kicker: 'Chapter 4', world: 3,
    pages: [{ music: 'tension', panels: [
      { at: R(14, 14, 986, 320), art: 'horde', snd: 'groan', cam: [1, 1.12, 0, 0.05],
        text: [{ k: 'radio', who: 'Voss', x: 30, y: 30, w: 300, t: 'Commander, the horde is converging on you. All of it.', tail: [14, 120] }] },
      { at: R(14, 332, 500, 548), art: 'portrait', o: { who: 'moreno', mood: 'smile', bg: 'fire', x: 0.32, turn: 0.25 }, cam: [1.08, 1],
        text: [{ k: 'say', who: 'Moreno', x: 280, y: 360, w: 190, t: 'Good. Saves us the walk.', tail: [230, 430] }] },
      { at: R(512, 332, 986, 548), art: 'portrait', o: { who: 'okafor', mood: 'grim', bg: 'lab', glasses: '#52e07c', x: 0.7 }, cam: [1.08, 1],
        text: [{ k: 'say', who: 'Okafor', x: 526, y: 350, w: 200, t: 'Hold them a little longer. The core is almost ready.', tail: [790, 430] }] },
    ] }],
  },
  'w3-outro': {
    title: 'Dawn', kicker: 'Chapter 4', world: 3,
    pages: [
      { music: 'boss', panels: [
        { at: R(14, 14, 986, 300), art: 'explosion', o: { spot: 'green' }, fx: 'slam', snd: 'boom', cam: [1.15, 1.02],
          text: [{ k: 'sfx', x: 520, y: 60, t: 'KRA-THOOOM!', size: 76, rot: -0.08, col: 'green', grow: 1 }] },
        { at: R(14, 312, 500, 548), art: 'injection', snd: 'pulse', cam: [1.1, 1],
          text: [{ k: 'cap', x: 30, y: 326, w: 260, t: "Okafor drove the Lazarus Core into the hive's heart." }] },
        { at: R(512, 312, 986, 548), art: 'sunrise', cam: [1, 1.08, 0, -0.02],
          text: [{ k: 'cap', x: 528, y: 326, w: 280, t: 'One by one, the dead lay down again.' }] },
      ] },
      { panels: [
        { at: [[14, 14], [400, 14], [380, 548], [14, 548]], art: 'portrait', o: { who: 'voss', mood: 'calm', bg: 'tone', glow: 'amber', x: 0.45 }, cam: [1.08, 1],
          text: [{ k: 'say', who: 'Voss', x: 200, y: 36, w: 170, t: "Commander. It's over.", tail: [210, 150] }] },
        { at: [[412, 14], [986, 14], [986, 548], [392, 548]], art: 'meteorSky', o: { many: true }, snd: 'missile', cam: [1, 1.1, 0, -0.03],
          text: [{ k: 'say', who: 'Moreno', x: 720, y: 440, w: 220, t: 'Doc... what is that?', tail: [560, 380] }] },
      ] },
      { panels: [{ at: FULL, art: 'titleCard', o: { title: 'HOLD THE LINE', sub: 'TO BE CONTINUED', spot: 'green' }, fx: 'flash', snd: 'impact', cam: [1.06, 1] }] },
    ],
  },
};
})();
const STORY_ORDER = ['prologue', 'w0-intro', 'w0-mid', 'w0-outro', 'w1-intro', 'w1-mid', 'w1-outro', 'w2-intro', 'w2-mid', 'w2-outro', 'w3-intro', 'w3-mid', 'w3-outro'];

// ---------- the player ----------
const Story = (() => {
  const PW = 1000, PH = 562, KEY = 'zbash.story', CPS = 52;
  const M = MANGA, { INK, PAPER, SPOT } = M;
  let seen = {};
  try { seen = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { seen = {}; }
  const saveSeen = () => { try { localStorage.setItem(KEY, JSON.stringify(seen)); } catch { /* storage off */ } };

  let cv = null, ctx = null, raf = 0, dpr = 1, view = { x: 0, y: 0, s: 1 }, st = null;
  const $ = (q) => document.querySelector(q);
  const now = () => performance.now() / 1000;
  const easeOut = (t) => 1 - (1 - t) ** 3;
  const easeBack = (t) => 1 + 2.4 * (t - 1) ** 3 + 1.4 * (t - 1) ** 2;
  const smooth = (t) => t * t * (3 - 2 * t);
  const sfxCol = (c) => (c === 'paper' ? PAPER : SPOT[c] || PAPER);
  const play = (name, o) => { if (typeof Sound !== 'undefined') Sound.play(name, null, o); };

  // ---------- layout ----------
  function fit() {
    dpr = Math.min(2.5, window.devicePixelRatio || 1);
    const W = window.innerWidth, H = window.innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const top = 52, bot = 18, s = Math.min((W - 24) / PW, (H - top - bot) / PH);
    view = { s: s * dpr, x: (W - PW * s) / 2 * dpr, y: (top + (H - top - bot - PH * s) / 2) * dpr };
    if (st) for (const pg of st.pages) { pg.art = null; for (const p of pg.panels) for (const t of p.text) t.lay = null; }
  }
  const X = (x) => view.x + x * view.s, Y = (y) => view.y + y * view.s;

  // ---------- panel art ----------
  function bbox(pts) { const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]); const x0 = Math.min(...xs), y0 = Math.min(...ys); return [x0, y0, Math.max(...xs) - x0, Math.max(...ys) - y0]; }
  function renderPage(pg) {
    if (pg.art) return;
    pg.art = pg.panels.map((p) => {
      const [bx, by, bw, bh] = bbox(p.at), w = Math.max(8, Math.round(bw * view.s)), h = Math.max(8, Math.round(bh * view.s));
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d'); g.fillStyle = PAPER; g.fillRect(0, 0, w, h);
      try { SCENES[p.art].base(g, w, h, p.o || {}); } catch (e) { console.error(e); }
      return { c, bx, by, bw, bh };
    });
  }

  // ---------- lettering ----------
  const FS = { say: 21, shout: 23, radio: 20, cap: 19, loc: 17 };
  function layout(t) {
    if (t.lay) return t.lay;
    const minPx = 12.5 * dpr, fs = Math.max((t.fs || FS[t.k] || 20) * view.s, minPx), grow = fs / ((t.fs || FS[t.k] || 20) * view.s);
    const wt = t.k === 'loc' ? 700 : t.k === 'cap' ? 600 : 700;
    const font = `${t.k === 'shout' ? 800 : wt} ${fs}px "Barlow Condensed", "Arial Narrow", sans-serif`;
    ctx.font = font;
    const maxW = t.w * view.s * grow, words = t.t.toUpperCase().split(' '), lines = [];
    let line = '';
    for (const wd of words) { const tryL = line ? `${line} ${wd}` : wd; if (ctx.measureText(tryL).width > maxW && line) { lines.push(line); line = wd; } else line = tryL; }
    if (line) lines.push(line);
    const lh = fs * 1.12, tw = Math.max(...lines.map((l) => ctx.measureText(l).width)), th = lines.length * lh;
    t.lay = { font, fs, lh, lines, tw, th, n: lines.reduce((a, l) => a + l.length, 0) };
    return t.lay;
  }
  function textDur(t) { return t.k === 'sfx' ? 0.25 : t.t.length / CPS + 0.1; }

  // a speech balloon: an oval with a curved tail, inked then filled so the seam disappears
  function balloonPath(k, cx, cy, rx, ry, tail, seed) {
    ctx.beginPath();
    if (k === 'shout') {
      const n = 22, rng = mulberry32(seed);
      for (let i = 0; i <= n; i++) { const a = i / n * TAU, r = i % 2 ? 1 : 1.16 + rng() * 0.1; const px = cx + Math.cos(a) * rx * r, py = cy + Math.sin(a) * ry * r; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      ctx.closePath();
    } else if (k === 'radio') {
      const n = 46;
      for (let i = 0; i <= n; i++) { const a = i / n * TAU, r = i % 2 ? 1 : 1.05; const px = cx + Math.cos(a) * rx * r, py = cy + Math.sin(a) * ry * r; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      ctx.closePath();
    } else { ctx.moveTo(cx + rx, cy); ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU); }
    if (tail) {
      const [tx, ty] = tail, a = Math.atan2(ty - cy, tx - cx), spread = k === 'radio' ? 0.1 : 0.22;
      const b1 = [cx + Math.cos(a - spread) * rx * 0.85, cy + Math.sin(a - spread) * ry * 0.85], b2 = [cx + Math.cos(a + spread) * rx * 0.85, cy + Math.sin(a + spread) * ry * 0.85];
      ctx.moveTo(...b1);
      if (k === 'radio') {
        // a lightning-bolt tail for transmissions
        const mx = lerp(b1[0], tx, 0.45), my = lerp(b1[1], ty, 0.45), nx = -Math.sin(a) * ry * 0.35, ny = Math.cos(a) * ry * 0.35;
        ctx.lineTo(mx + nx, my + ny); ctx.lineTo(mx - nx * 0.2, my - ny * 0.2); ctx.lineTo(tx, ty); ctx.lineTo(mx - nx * 0.6, my - ny * 0.6); ctx.lineTo(mx + nx * 0.4, my + ny * 0.4); ctx.lineTo(...b2);
      } else {
        const bend = 0.18, mx = (b1[0] + b2[0]) / 2, my = (b1[1] + b2[1]) / 2, ox = -(ty - my) * bend, oy = (tx - mx) * bend;
        ctx.quadraticCurveTo((b1[0] + tx) / 2 + ox, (b1[1] + ty) / 2 + oy, tx, ty);
        ctx.quadraticCurveTo((b2[0] + tx) / 2 + ox, (b2[1] + ty) / 2 + oy, ...b2);
      }
      ctx.closePath();
    }
  }
  function drawText(t, el, forced) {
    const vis = forced ? 1e9 : Math.floor(el * CPS);
    if (t.k === 'sfx') return drawSfx(t, el, forced);
    const L = layout(t), s = view.s, pad = L.fs * 0.55;
    const pop = forced ? 1 : easeBack(clamp(el / 0.16, 0, 1));
    let bx = X(t.x), by = Y(t.y);
    ctx.save(); ctx.globalAlpha = clamp(el / 0.1, 0, 1);
    if (t.k === 'cap' || t.k === 'loc') {
      const w = L.tw + pad * 2, h = L.th + pad * 1.4;
      // captions enlarged for small screens are kept on the page
      bx = clamp(bx, X(8), X(PW - 8) - w); by = clamp(by, Y(8), Y(PH - 8) - h);
      ctx.translate(bx + w / 2, by + h / 2); ctx.scale(0.92 + 0.08 * pop, 0.92 + 0.08 * pop); ctx.translate(-w / 2, -h / 2);
      ctx.fillStyle = INK; ctx.fillRect(s * 4, s * 4, w, h);
      ctx.fillStyle = t.k === 'loc' ? INK : PAPER; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = t.k === 'loc' ? PAPER : INK; ctx.lineWidth = Math.max(1, s * 2); ctx.strokeRect(0, 0, w, h);
      if (t.k === 'loc') { ctx.fillStyle = SPOT[st.spot] || SPOT.red; ctx.fillRect(0, 0, s * 5, h); }
      typeLines(L, pad + (t.k === 'loc' ? s * 4 : 0), pad * 0.7, t.k === 'loc' ? PAPER : INK, vis, 'left');
    } else {
      const rx = L.tw / 2 + pad * 1.5, ry = L.th / 2 + pad * 1.15, cx = clamp(bx + rx, X(10) + rx, X(PW - 10) - rx), cy = clamp(by + ry, Y(10) + ry, Y(PH - 10) - ry);
      const tail = t.tail ? [X(t.tail[0]), Y(t.tail[1])] : null;
      ctx.translate(cx, cy); ctx.scale(pop, pop); ctx.translate(-cx, -cy);
      const lw = Math.max(1.2, s * 2.4);
      balloonPath(t.k, cx, cy, rx, ry, tail, t.t.length); ctx.lineWidth = lw * 2; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.stroke();
      balloonPath(t.k, cx, cy, rx, ry, tail, t.t.length); ctx.fillStyle = t.k === 'radio' ? '#e9f2ea' : PAPER; ctx.fill();
      if (t.k === 'radio') { ctx.save(); balloonPath(t.k, cx, cy, rx, ry, null, 0); ctx.clip(); ctx.fillStyle = 'rgba(16,16,16,0.06)'; for (let y = cy - ry; y < cy + ry; y += 4 * dpr) ctx.fillRect(cx - rx * 1.1, y, rx * 2.2, 1.2 * dpr); ctx.restore(); }
      typeLines(L, cx - L.tw / 2, cy - L.th / 2, INK, vis, 'center', L.tw);
      if (t.who) {
        ctx.font = `700 ${L.fs * 0.62}px "Barlow Condensed", sans-serif`;
        const label = t.who.toUpperCase(), lw2 = ctx.measureText(label).width + L.fs * 0.6, lh2 = L.fs * 0.9, lx = cx - rx * 0.72, ly = cy - ry - lh2 * 0.55;
        ctx.fillStyle = INK; ctx.fillRect(lx, ly, lw2, lh2);
        ctx.fillStyle = SPOT[st.spot] || PAPER; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(label, lx + L.fs * 0.3, ly + lh2 / 2 + 0.5);
      }
    }
    ctx.restore();
  }
  function typeLines(L, x0, y0, col, vis, align, width = 0) {
    ctx.font = L.font; ctx.fillStyle = col; ctx.textBaseline = 'top'; ctx.textAlign = align;
    let left = vis;
    L.lines.forEach((ln, i) => {
      if (left <= 0) return;
      const s = ln.slice(0, left); left -= ln.length;
      const y = y0 + i * L.lh + L.fs * 0.06;
      if (align === 'center') {
        // keep partly typed lines anchored where the full line will sit
        const full = ctx.measureText(ln).width; ctx.textAlign = 'left'; ctx.fillText(s, x0 + (width - full) / 2, y); ctx.textAlign = align;
      } else ctx.fillText(s, x0, y);
    });
  }
  // big onomatopoeia: hand-set letters with a white outer edge, jittered and growing
  function drawSfx(t, el, forced) {
    const s = view.s, size = (t.size || 56) * s, rng = mulberry32(t.t.length * 31 + (t.x | 0));
    const pop = forced ? 1 : clamp(el / 0.18, 0, 1), sc = forced ? 1 : 1.7 - 0.7 * easeOut(pop);
    const quake = forced ? 0 : Math.max(0, 0.4 - el) * size * 0.06;
    ctx.save(); ctx.globalAlpha = clamp(el / 0.06, 0, 1);
    ctx.translate(X(t.x) + (Math.random() - 0.5) * quake, Y(t.y) + (Math.random() - 0.5) * quake); ctx.rotate(t.rot || 0); ctx.scale(sc, sc); ctx.transform(1, 0, -0.18, 1, 0, 0);
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.lineJoin = 'round';
    let x = 0;
    const letters = [...t.t].map((ch, i) => { const k = t.grow ? 0.75 + 0.5 * (i / Math.max(1, t.t.length - 1)) : 1; const f = `800 ${size * k}px "Barlow Condensed", sans-serif`; ctx.font = f; const w = ctx.measureText(ch).width; const L = { ch, f, x, k, r: (rng() - 0.5) * 0.16, dy: (rng() - 0.5) * size * 0.1 }; x += w * 0.94; return L; });
    for (const pass of [0, 1, 2]) for (const L of letters) {
      ctx.save(); ctx.translate(L.x, L.dy); ctx.rotate(L.r); ctx.font = L.f;
      if (pass === 0) { ctx.strokeStyle = PAPER; ctx.lineWidth = size * L.k * 0.3; ctx.strokeText(L.ch, 0, 0); }
      else if (pass === 1) { ctx.strokeStyle = INK; ctx.lineWidth = size * L.k * 0.16; ctx.strokeText(L.ch, 0, 0); }
      else { ctx.fillStyle = sfxCol(t.col); ctx.fillText(L.ch, 0, 0); }
      ctx.restore();
    }
    ctx.restore();
  }

  // ---------- drawing ----------
  function drawPage(pi, offX, alpha, rot) {
    const pg = st.pages[pi], s = view.s, T = now();
    renderPage(pg);
    ctx.save(); ctx.globalAlpha = alpha;
    const cx = X(PW / 2), cy = Y(PH / 2);
    ctx.translate(cx + offX + st.shake.x, cy + st.shake.y); ctx.rotate(rot); ctx.translate(-cx, -cy);
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(X(0) + 8 * s, Y(0) + 10 * s, PW * s, PH * s);
    ctx.fillStyle = PAPER; ctx.fillRect(X(0), Y(0), PW * s, PH * s);
    pg.panels.forEach((p, i) => {
      if (p.t0 == null) return;
      const a = pg.art[i], el = T - p.t0, e = easeOut(clamp(el / 0.45, 0, 1));
      if (e <= 0) return;
      const pts = p.at.map(([x, y]) => [X(x), Y(y)]);
      const [bx, by, bw, bh] = [X(a.bx), Y(a.by), a.c.width, a.c.height];
      const from = p.from || (i === 0 ? 'up' : i % 2 ? 'right' : 'left');
      const d = (1 - e) * 26 * s, dx = from === 'left' ? -d : from === 'right' ? d : 0, dy = from === 'up' ? -d : from === 'down' ? d : 0;
      const slam = p.fx === 'slam' ? 1 + 0.22 * (1 - e) : 1;
      ctx.save(); ctx.globalAlpha = alpha * e;
      ctx.translate(bx + bw / 2 + dx, by + bh / 2 + dy); ctx.scale(slam, slam); ctx.translate(-bx - bw / 2, -by - bh / 2);
      ctx.save();
      ctx.beginPath(); pts.forEach((q, j) => (j ? ctx.lineTo(...q) : ctx.moveTo(...q))); ctx.closePath(); ctx.clip();
      const [z0, z1, px = 0, py = 0] = p.cam || [1.06, 1], k = smooth(clamp(el / 9, 0, 1)), z = lerp(z0, z1, k);
      ctx.translate(bx + bw / 2 + px * bw * k, by + bh / 2 + py * bh * k); ctx.scale(z, z); ctx.translate(-bw / 2, -bh / 2);
      ctx.drawImage(a.c, 0, 0);
      const sc = SCENES[p.art];
      if (sc.anim) try { sc.anim(ctx, bw, bh, el, p.o || {}); } catch (err) { console.error(err); }
      ctx.restore();
      ctx.beginPath(); pts.forEach((q, j) => (j ? ctx.lineTo(...q) : ctx.moveTo(...q))); ctx.closePath();
      ctx.lineJoin = 'miter'; ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1.5, 3.4 * s); ctx.stroke();
      ctx.restore();
    });
    // lettering sits on top of the panels and may cross the gutters
    pg.panels.forEach((p) => {
      if (p.t0 == null) return;
      for (const t of p.text) { const el = T - t.at; if (el >= 0 || p.forced) drawText(t, p.forced ? 99 : el, p.forced); }
    });
    ctx.restore();
  }
  function frame() {
    if (!st) return;
    raf = requestAnimationFrame(frame);
    const T = now(), W = cv.width, H = cv.height, s = view.s;
    // shake decays
    const sh = Math.max(0, st.shakeUntil - T);
    st.shake = { x: (Math.random() - 0.5) * sh * 60 * s, y: (Math.random() - 0.5) * sh * 60 * s };
    // backdrop
    const g = ctx.createRadialGradient(W / 2, H * 0.45, 0, W / 2, H / 2, Math.hypot(W, H) * 0.6);
    g.addColorStop(0, '#24262b'); g.addColorStop(1, '#08090b');
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (st.turn) {
      const k = clamp((T - st.turn.t0) / 0.55, 0, 1), e = smooth(k), dir = st.turn.dir;
      drawPage(st.turn.from, -dir * e * W * 0.9, 1 - e * 0.6, -dir * e * 0.06);
      drawPage(st.pi, dir * (1 - e) * W * 0.9, 0.4 + e * 0.6, dir * (1 - e) * 0.06);
      if (k >= 1) { st.turn = null; startBeat(0); }
    } else drawPage(st.pi, 0, 1, 0);
    // page tick marks
    const n = st.pages.length;
    if (n > 1) for (let i = 0; i < n; i++) { ctx.fillStyle = i === st.pi ? PAPER : 'rgba(242,238,228,0.3)'; const w = 18 * dpr, x = W / 2 + (i - (n - 1) / 2) * (w + 6 * dpr) - w / 2; ctx.fillRect(x, H - 10 * dpr, w, 3 * dpr); }
    // waiting cue
    if (!st.turn && !st.ending && beatDone()) {
      // a paper tab with an arrow nudging right, hanging off the page corner
      const r = Math.max(13 * dpr, 17 * s), x = X(PW) - r * 0.4 + Math.sin(T * 5) * r * 0.12, y = Y(PH) - r * 0.4;
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.arc(x + 3 * dpr, y + 4 * dpr, r, 0, TAU); ctx.fill();
      ctx.fillStyle = SPOT[st.spot] || PAPER; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = Math.max(2, 3 * s); ctx.stroke();
      ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(x - r * 0.28, y - r * 0.42); ctx.lineTo(x + r * 0.46, y); ctx.lineTo(x - r * 0.28, y + r * 0.42); ctx.closePath(); ctx.fill();
    }
    const fl = Math.max(0, st.flashUntil - T);
    if (fl > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(1, fl * 2.6)})`; ctx.fillRect(0, 0, W, H); }
    if (st.ending) { const k = clamp((T - st.ending) / 0.45, 0, 1); ctx.fillStyle = `rgba(8,9,11,${k})`; ctx.fillRect(0, 0, W, H); if (k >= 1) { finish(); return; } }
    // typing clicks
    if (!st.turn) {
      const p = st.pages[st.pi].panels[st.bi];
      if (p && !p.forced) for (const t of p.text) { const el = T - t.at; if (t.k !== 'sfx' && el > 0 && el < t.t.length / CPS && T - st.lastType > 0.07) { play('type'); st.lastType = T; } if (t.k === 'sfx' && el >= 0 && !t.popped) { t.popped = true; } }
    }
  }

  // ---------- flow ----------
  function startBeat(i) {
    const pg = st.pages[st.pi], p = pg.panels[i], T = now();
    st.bi = i; p.t0 = T; p.forced = false;
    let at = T + (p.fx === 'slam' ? 0.25 : 0.4);
    for (const t of p.text) { t.at = at; t.popped = false; at += textDur(t) + 0.22; }
    p.end = at;
    if (p.snd) setTimeout(() => st && play(p.snd), p.fx === 'slam' ? 60 : 180);
    if (p.fx === 'slam' || p.fx === 'shake') st.shakeUntil = T + (p.fx === 'slam' ? 0.45 : 0.6);
    if (p.fx === 'flash') st.flashUntil = T + 0.38;
    if (pg.music && typeof Sound !== 'undefined') Sound.setScene(pg.music, st.ch.world);
    const sr = $('#story-sr'); if (sr) sr.textContent = p.text.filter((t) => t.k !== 'sfx').map((t) => (t.who ? `${t.who}: ` : '') + t.t).join(' ');
    if (i === 0 && st.pi + 1 < st.pages.length) setTimeout(() => st && renderPage(st.pages[st.pi + 1]), 350);
  }
  function beatDone() { const p = st.pages[st.pi].panels[st.bi]; return !p || p.forced || now() >= p.end; }
  function advance() {
    if (!st || st.turn || st.ending) return;
    const pg = st.pages[st.pi], p = pg.panels[st.bi];
    if (p && !beatDone()) { p.forced = true; return; }
    if (st.bi + 1 < pg.panels.length) return startBeat(st.bi + 1);
    if (st.pi + 1 < st.pages.length) { st.turn = { from: st.pi, t0: now(), dir: 1 }; st.pi++; resetPage(st.pages[st.pi]); play('page'); return; }
    st.ending = now();
  }
  function resetPage(pg) { for (const p of pg.panels) { p.t0 = null; p.forced = false; for (const t of p.text) { t.at = 1e12; t.lay = null; } } }
  function finish() {
    if (!st) return;
    const { id, done } = st;
    seen[id] = 1; saveSeen();
    cancelAnimationFrame(raf); st = null;
    $('#story-screen').hidden = true;
    window.removeEventListener('resize', fit);
    if (done) done();
  }
  function skip() { if (st && !st.ending) { st.ending = now() - 0.25; play('click'); } }

  function start(id, done) {
    const ch = STORY[id];
    if (!ch) { if (done) done(); return; }
    cv = cv || $('#story-cv'); ctx = cv.getContext('2d');
    const pages = ch.pages.map((pg) => ({ ...pg, art: null, panels: pg.panels.map((p) => ({ ...p, text: (p.text || []).map((t) => ({ ...t })) })) }));
    st = { id, ch, done, pages, pi: 0, bi: 0, turn: null, ending: 0, shake: { x: 0, y: 0 }, shakeUntil: 0, flashUntil: 0, lastType: 0, spot: ['amber', 'purple', 'ice', 'green'][ch.world] || 'red' };
    if (id === 'prologue') st.spot = 'green';
    $('#story-screen').hidden = false;
    $('#story-tag').innerHTML = `<b>${ch.kicker}</b> ${ch.title}`;
    fit(); window.addEventListener('resize', fit);
    resetPage(pages[0]);
    if (typeof Sound !== 'undefined') { Sound.stopAmbience(); Sound.setScene('story', ch.world); }
    // fonts must be ready before the first balloon is measured
    const go = () => { if (!st) return; renderPage(pages[0]); startBeat(0); cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); };
    if (document.fonts && document.fonts.load) Promise.all([document.fonts.load('700 20px "Barlow Condensed"'), document.fonts.load('800 20px "Barlow Condensed"')]).then(go, go); else go();
  }

  function init() {
    cv = $('#story-cv'); if (!cv) return;
    cv.addEventListener('pointerdown', (e) => { if (e.button === 0 || e.pointerType !== 'mouse') advance(); });
    $('#story-skip').addEventListener('click', (e) => { e.stopPropagation(); skip(); });
    window.addEventListener('keydown', (e) => {
      if (!st) return;
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') { e.preventDefault(); e.stopImmediatePropagation(); advance(); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); skip(); }
    }, true);
  }

  return {
    init, play: start, skip, advance,
    get active() { return !!st; },
    get pos() { return st && { page: st.pi, beat: st.bi, pages: st.pages.length, beats: st.pages[st.pi].panels.length, done: beatDone(), turning: !!st.turn }; },
    seen: (id) => !!seen[id],
    has: (id) => !!STORY[id],
    chapters: () => STORY_ORDER.map((id) => ({ id, title: STORY[id].title, kicker: STORY[id].kicker, world: STORY[id].world, seen: !!seen[id] })),
    // first-time play: run the chapter only if it has not been seen
    once(id, then) { if (STORY[id] && !seen[id]) start(id, then); else if (then) then(); },
  };
})();

// ---------- mission intel ----------
// Major Voss briefs each sector: special lines on the story beats, a boss warning, otherwise a rotation.
const STORY_INTEL = [
  { 1: 'First contact. Keep them off the farm road and the survivors stay breathing.', 25: 'That transmission came from somewhere near here. Hold the valley and we can trace it.', 50: "Crane's place. Whatever is left of him is waiting at the end of the road.",
    boss: 'Something big is moving through the corn. Concentrate your fire.',
    lines: ['The corn hides them until the last second. Cover the bends.', 'Survivors spotted near the silos. Buy them time.', 'Fuel is short. Make every shot count.', 'They are drawn to the noise of the guns. Use that.', 'The farm roads meet here. Expect company from more than one side.', 'Moreno says the fast ones come at dusk. Do not let them slip by.', 'Kessler-Vane trucks used this road before the outbreak. Find out why.', 'Hold here and the next town gets another night.'] },
  { 1: 'Blackwood. Stay on the paths. The ground here is not solid.', 25: "Okafor's last transmission came from the chapel tower. Keep it standing.", 50: 'The Grave Lord holds the old crypt. End it, and the rift should close.',
    boss: 'The crypt doors are open. Whatever came out of them is heading your way.',
    lines: ['The fog hides the crawlers. Watch the low ground.', 'Every grave you pass is a grave that might open.', 'The rift pulses when they mass. Hit them before it does.', 'Bats in the bell tower. Something spooked them.', 'Mausoleum doors have been forced from the inside.', 'The dead here are older and slower, but there are so many more of them.', 'Keep the lanterns lit. They hate the light.', 'Okafor marked this crossing on her map. Hold it.'] },
  { 1: 'Station Seven is close. The cold slows them, but not enough.', 25: 'Okafor needs more time at the console. Hold the perimeter.', 50: 'The ice around Lazarus Two is cracking. Be ready when it walks.',
    boss: 'Thermal scopes show something huge in the whiteout. Get ready.',
    lines: ['Whiteout incoming. Trust your sight lines, not your eyes.', 'The frozen ones thaw as they walk. They speed up the closer they get.', 'Generators are failing. Keep the heaters on and the guns warm.', 'Something under the ice is moving with them.', 'Kessler-Vane cargo crates on the road. Do not let them reach the lab.', 'The cold keeps the strain sluggish. Use the time.', 'The supply drop is delayed by the storm. Spend wisely.', "Station Seven's antenna is our only link home. Defend it."] },
  { 1: 'Black Bayou. Every infected on the planet is heading here.', 25: 'The horde is converging. This is the line.', 50: 'The hive is awake. Okafor goes in with the core on your signal. Hold the line.',
    boss: 'The water is boiling. Something is coming up out of the bayou.',
    lines: ['The water carries them faster than the roads. Watch the channels.', 'Bloaters in the reeds. Pop them early.', "The hive's pulse is getting louder. They are answering it.", 'Spores in the air. Masks on.', 'The shacks hide nests. Burn them out.', 'Every road ends here. So does this.', "Okafor's core is charging. Buy her minutes.", 'They are not attacking anymore. They are protecting it.'] },
];
function storyIntel(L) {
  const I = STORY_INTEL[L.world] || STORY_INTEL[0], n = L.num;
  if (I[n]) return I[n];
  if (L.boss) return I.boss;
  return I.lines[(n * 7 + L.world * 3) % I.lines.length];
}
