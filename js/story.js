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
          text: [{ k: 'loc', x: 30, y: 30, w: 330, t: 'Hollow Creek, Kansas. Eleven months ago.' }, { k: 'sfx', x: 330, y: 215, t: 'SHHRRRAAAA', size: 44, rot: -0.36, col: 'green', grow: 1 }] },
        { at: [[652, 14], [986, 14], [986, 300], [622, 300]], art: 'impact', fx: 'slam', snd: 'impact', cam: [1.15, 1.02],
          text: [{ k: 'sfx', x: 690, y: 240, t: 'KRA-KOOM!', size: 66, rot: -0.12, col: 'paper' }] },
        { at: R(14, 312, 986, 548), art: 'crystalCrater', cam: [1, 1.1, 0, -0.03],
          text: [{ k: 'cap', x: 36, y: 332, w: 280, t: 'Something came down with it.' }, { k: 'cap', x: 700, y: 480, w: 270, t: 'Something that wanted to live.' }] },
      ] },
      { panels: [
        { at: [[14, 14], [550, 14], [520, 548], [14, 548]], art: 'labTank', cam: [1.1, 1, 0, 0.03],
          text: [{ k: 'cap', x: 30, y: 30, w: 290, t: 'Kessler-Vane Biotech buried a research lab under the cornfields.' }, { k: 'cap', x: 30, y: 490, w: 300, t: 'They called it Project Lazarus.' }] },
        { at: [[562, 14], [986, 14], [986, 270], [548, 270]], art: 'portrait', o: { who: 'okafor', mood: 'grim', glasses: '#52e07c', bg: 'lab', x: 0.68 }, cam: [1, 1.08, 0, 0.02],
          text: [{ k: 'say', who: 'Dr. Mara Okafor', x: 562, y: 40, w: 160, t: "It doesn't just repair dead tissue.", tail: [805, 165] }] },
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
          text: [{ k: 'shout', who: 'Dr. Okafor', x: 250, y: 44, w: 200, t: 'If they get out, we lose everything!', tail: [210, 230] }, { k: 'say', x: 340, y: 420, w: 200, t: "I'm taking the core.", tail: [240, 330] }] },
        { at: [[652, 14], [986, 14], [986, 270], [638, 270]], art: 'infectionMap', cam: [1.12, 1],
          text: [{ k: 'cap', x: 664, y: 26, w: 300, t: 'Seventy-two hours later, Hollow Creek was gone.' }] },
        { at: [[637, 282], [986, 282], [986, 548], [622, 548]], art: 'burningCity', snd: 'boom', cam: [1, 1.1, 0, 0.02],
          text: [{ k: 'cap', x: 650, y: 296, w: 300, t: 'In two weeks, so were most of the cities.' }, { k: 'cap', x: 660, y: 484, w: 310, t: 'The infected follow the roads. They always find the living.' }] },
      ] },
      { music: 'tension', panels: [
        { at: R(14, 14, 986, 300), art: 'office', cam: [1.08, 1, 0.03, 0],
          text: [{ k: 'loc', x: 30, y: 30, w: 330, t: 'Kessler-Vane Tower, Chicago. That same night.' }, { k: 'say', who: 'Silas Vane', x: 640, y: 150, w: 220, t: 'Contain the story. Not the dead.', tail: [520, 200] }] },
        { at: [[14, 312], [600, 312], [580, 548], [14, 548]], art: 'vaneClose', cam: [1.12, 1],
          text: [{ k: 'say', x: 34, y: 330, w: 220, t: 'Let it spread. A world this sick will pay anything for a cure.', tail: [330, 400] }] },
        { at: [[612, 312], [986, 312], [986, 548], [592, 548]], art: 'portrait', o: { who: 'okafor', mood: 'grim', bg: 'ink', tint: 'red', x: 0.74, y: 0.46 }, cam: [1.1, 1],
          text: [{ k: 'say', x: 606, y: 326, w: 150, t: 'And find Dr. Okafor. She has something of mine.', tail: [600, 300] }, { k: 'loc', x: 620, y: 504, w: 200, t: 'Target: Okafor, M.' }] },
      ] },
      { panels: [
        { at: [[14, 14], [986, 14], [986, 230], [14, 250]], art: 'convoy', cam: [1.1, 1, -0.03, 0],
          text: [{ k: 'cap', x: 30, y: 30, w: 330, t: 'What was left of the army regrouped as Bastion Company.' }] },
        { at: [[14, 262], [420, 254], [420, 548], [14, 548]], art: 'portrait', o: { who: 'voss', mood: 'grim', bg: 'night', glow: 'amber', x: 0.4 }, cam: [1.08, 1],
          text: [{ k: 'say', who: 'Major Elena Voss', x: 236, y: 286, w: 140, t: 'Commander. You have the field.', tail: [205, 410] }] },
        { at: [[432, 253], [986, 242], [986, 548], [432, 548]], art: 'briefing', cam: [1.12, 1, 0.03, 0],
          text: [{ k: 'say', x: 474, y: 264, w: 240, t: 'Dr. Mara Okafor escaped Ground Zero with the Lazarus Core.', tail: [425, 330] }, { k: 'say', x: 470, y: 470, w: 220, t: "If anyone can reverse this, it's her.", tail: [425, 500] }] },
      ] },
      { panels: [
        { at: [[14, 14], [560, 14], [540, 548], [14, 548]], art: 'portrait', o: { who: 'moreno', mood: 'smile', bg: 'lines', sandbags: true, turn: 0.2 }, cam: [1.08, 1],
          text: [{ k: 'radio', who: 'Voss', x: 30, y: 30, w: 230, t: 'We hold the roads. We keep the safehouses breathing. And we find her before Kessler-Vane does.', tail: [14, 300] },
            { k: 'say', who: 'Sgt. Dax Moreno', x: 330, y: 392, w: 180, t: "Then let's go to work.", tail: [318, 360] }] },
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
        { at: [[652, 14], [986, 14], [986, 276], [643, 276]], art: 'portrait', o: { who: 'voss', mood: 'calm', bg: 'tone', x: 0.8 }, cam: [1.06, 1],
          text: [{ k: 'radio', who: 'Voss', x: 656, y: 30, w: 140, t: 'Survivors are holding a farmhouse at the end of this road.', tail: [885, 160] }] },
        { at: [[642, 288], [986, 288], [986, 548], [632, 548]], art: 'portrait', o: { who: 'moreno', mood: 'smile', bg: 'speed', x: 0.8, turn: -0.2 }, cam: [1.08, 1],
          text: [{ k: 'say', who: 'Moreno', x: 646, y: 304, w: 140, t: "Slow, loud and hungry. Light 'em up before they reach the fence.", tail: [880, 430] }] },
      ] },
      { music: 'tension', panels: [
        { at: R(14, 14, 986, 250), art: 'scope', snd: 'sniper', fx: 'slam', cam: [1.12, 1],
          text: [{ k: 'sfx', x: 640, y: 70, t: 'BLAM!', size: 74, rot: -0.1, col: 'amber' }] },
        { at: [[14, 262], [480, 262], [460, 548], [14, 548]], art: 'sniperRoof', cam: [1.1, 1, -0.03, 0],
          text: [{ k: 'cap', x: 30, y: 276, w: 260, t: 'Somebody had been holding the farmhouse.' }] },
        { at: [[492, 262], [986, 262], [986, 548], [472, 548]], art: 'portrait', o: { who: 'laila', mood: 'smile', hat: true, bg: 'lines', x: 0.68, y: 0.5 }, fx: 'shake', cam: [1.1, 1],
          text: [{ k: 'say', who: 'Laila', x: 492, y: 280, w: 150, t: "Took y'all long enough.", tail: [770, 420] }, { k: 'say', x: 492, y: 450, w: 190, t: "Forty days I've held this place alone. Try to keep up.", tail: [760, 455] }] },
      ] },
      { panels: [
        { at: R(14, 14, 400, 548), art: 'portrait', o: { who: 'moreno', mood: 'smile', bg: 'speed', x: 0.55, turn: 0.2 }, cam: [1.08, 1],
          text: [{ k: 'say', who: 'Moreno', x: 30, y: 40, w: 170, t: 'Who taught you to shoot like that?', tail: [190, 190] }] },
        { at: R(412, 14, 986, 330), art: 'tattoo', cam: [1.12, 1, -0.03, 0],
          text: [{ k: 'say', who: 'Laila', x: 430, y: 30, w: 110, t: 'My daddy.', tail: [560, 140] }, { k: 'say', x: 720, y: 236, w: 220, t: 'The dead taught me the rest.', tail: [986, 300] }] },
        { at: R(412, 342, 986, 548), art: 'convoy', cam: [1.08, 1, 0.03, 0],
          text: [{ k: 'cap', x: 428, y: 356, w: 330, t: 'Laila. Last of the Hollow Creek ranchers, and the best shot Bastion Company would ever have.' }, { k: 'radio', who: 'Voss', x: 640, y: 466, w: 250, t: 'Welcome to Bastion, Laila. Stay close to the Commander.', tail: [986, 470] }] },
      ] },
    ],
  },
  'w0-mid': {
    title: 'A Voice in the Static', kicker: 'Chapter 1', world: 0,
    pages: [{ panels: [
      { at: [[14, 14], [620, 14], [590, 548], [14, 548]], art: 'radio', snd: 'static', cam: [1.12, 1],
        text: [{ k: 'radio', who: 'Unknown signal', x: 30, y: 30, w: 250, t: '...Bastion... this is Okafor... do you read...', tail: [180, 190] }, { k: 'radio', x: 300, y: 400, w: 260, t: '...Blackwood... the buried are moving... hurry...', tail: [250, 300] }, { k: 'sfx', x: 400, y: 210, t: 'KSSHHH', size: 40, rot: 0.1, col: 'green' }] },
      { at: [[632, 14], [986, 14], [986, 548], [602, 548]], art: 'portrait', o: { who: 'voss', mood: 'shout', bg: 'lines', x: 0.55 }, fx: 'shake', cam: [1.1, 1],
        text: [{ k: 'shout', who: 'Voss', x: 650, y: 30, w: 170, t: "That's her. She's alive!", tail: [790, 170] }, { k: 'say', x: 712, y: 410, w: 200, t: 'Hold this valley, Commander. Then we go get her.', tail: [800, 330] }] },
    ] }, { panels: [
      { at: [[14, 14], [560, 14], [540, 548], [14, 548]], art: 'portrait', o: { who: 'laila', mood: 'grim', bg: 'night', x: 0.42 }, cam: [1.08, 1],
        text: [{ k: 'say', who: 'Laila', x: 290, y: 40, w: 220, t: 'Okafor... she came out to our ranch before it all went bad.', tail: [260, 200] }, { k: 'say', x: 226, y: 410, w: 180, t: 'She was asking about the meteor. About Mr. Crane.', tail: [240, 370] }] },
      { at: [[572, 14], [986, 14], [986, 548], [552, 548]], art: 'meteorSky', cam: [1, 1.1, 0, -0.03], snd: 'missile',
        text: [{ k: 'cap', x: 600, y: 480, w: 360, t: 'Laila watched it fall from her porch that night. So did Elias Crane.' }] },
    ] }],
  },
  'w0-outro': {
    title: 'The First to Turn', kicker: 'Chapter 1', world: 0,
    pages: [{ panels: [
      { at: R(14, 14, 986, 330), art: 'bossFall', o: { kind: 'harvester', spot: 'amber' }, fx: 'slam', snd: 'stomp', cam: [1.12, 1.02],
        text: [{ k: 'sfx', x: 640, y: 70, t: 'THOOOM', size: 70, rot: 0.08, col: 'amber', grow: 1 }, { k: 'cap', x: 30, y: 30, w: 300, t: 'Elias Crane. The farmer who found the meteor. The first to turn.' }] },
      { at: R(14, 342, 560, 548), art: 'badge', cam: [1.1, 1],
        text: [{ k: 'say', who: 'Moreno', x: 24, y: 352, w: 200, t: "He was on Kessler-Vane's payroll.", tail: [14, 450] }, { k: 'say', who: 'Laila', x: 300, y: 446, w: 230, t: 'Mr. Crane fixed our fence every spring. He was kind, once.', tail: [560, 530] }] },
      { at: R(572, 342, 986, 548), art: 'worldMap', o: { upto: 1 }, cam: [1.12, 1, -0.05, 0],
        text: [{ k: 'radio', who: 'Voss', x: 690, y: 440, w: 200, t: "Okafor's signal came from Blackwood. Wheels up, Commander.", tail: [986, 420] }] },
    ] }, { music: 'tension', panels: [
      { at: [[14, 14], [500, 14], [480, 548], [14, 548]], art: 'radio', o: { ch: 'KV SECURE  ·  ENCRYPTED', red: true }, snd: 'static', cam: [1.1, 1],
        text: [{ k: 'radio', who: 'Kessler-Vane', x: 30, y: 30, w: 250, t: 'Asset Crane is down. Bastion is moving on Blackwood.', tail: [180, 200] }, { k: 'say', who: 'Moreno', x: 250, y: 420, w: 200, t: "Hold up. Somebody's on our channel.", tail: [230, 370] }] },
      { at: [[512, 14], [986, 14], [986, 548], [492, 548]], art: 'office', cam: [1.12, 1.02, 0, 0.04],
        text: [{ k: 'say', who: 'Silas Vane', x: 530, y: 40, w: 200, t: 'Let them run.', tail: [700, 220] }, { k: 'say', x: 650, y: 430, w: 200, t: "They'll lead us straight to her.", tail: [740, 330] }] },
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
          text: [{ k: 'sfx', x: 640, y: 90, t: 'KRAK!', size: 60, rot: -0.15, col: 'purple' }, { k: 'cap', x: 640, y: 240, w: 260, t: 'The strain is waking bodies a century old.' }] },
        { at: R(14, 312, 986, 548), art: 'riftSky', snd: 'thunder', cam: [1, 1.1, 0, 0.03],
          text: [{ k: 'radio', who: 'Okafor', x: 260, y: 322, w: 280, t: 'The crystal is tearing open the sky.', tail: [280, 316] }, { k: 'radio', x: 720, y: 470, w: 240, t: 'Keep them away from it. Please.', tail: [986, 530] }] },
      ] },
      { music: 'tension', panels: [
        { at: R(14, 14, 986, 300), art: 'cleaners', snd: 'static', cam: [1.1, 1, 0.02, 0],
          text: [{ k: 'cap', x: 30, y: 30, w: 300, t: 'Somebody had reached the crypt first.' }] },
        { at: [[14, 312], [480, 312], [470, 548], [14, 548]], art: 'portrait', o: { who: 'laila', mood: 'grim', hat: true, bg: 'night', x: 0.4, y: 0.52 }, cam: [1.08, 1],
          text: [{ k: 'say', who: 'Laila', x: 270, y: 330, w: 160, t: "Those ain't army.", tail: [240, 440] }] },
        { at: [[492, 312], [986, 312], [986, 548], [482, 548]], art: 'portrait', o: { who: 'moreno', mood: 'grim', bg: 'lines', x: 0.78 }, cam: [1.08, 1],
          text: [{ k: 'say', who: 'Moreno', x: 500, y: 330, w: 190, t: "Kessler-Vane cleaners. They're hunting the doc too.", tail: [810, 445] }] },
      ] },
    ],
  },
  'w1-mid': {
    title: 'North', kicker: 'Chapter 2', world: 1,
    pages: [{ panels: [
      { at: [[14, 14], [560, 14], [560, 548], [14, 548]], art: 'radio', o: { ch: 'CH 07  ·  OKAFOR, M.' }, snd: 'static', cam: [1.1, 1],
        text: [{ k: 'radio', who: 'Okafor', x: 30, y: 30, w: 260, t: "Vane's cleaners are in the crypt. I can't stay.", tail: [170, 200] }, { k: 'radio', x: 232, y: 396, w: 236, t: "I'm heading north. Station Seven. The cold slows the strain.", tail: [260, 330] }] },
      { at: R(572, 14, 986, 548), art: 'portrait', o: { who: 'moreno', mood: 'tired', bg: 'storm', x: 0.56, y: 0.47, zoom: 0.85 }, cam: [1.08, 1],
        text: [{ k: 'say', who: 'Moreno', x: 596, y: 36, w: 140, t: 'North. Great.', tail: [742, 188] }, { k: 'say', x: 818, y: 112, w: 110, t: 'I hate the cold.', tail: [852, 200] }, { k: 'say', who: 'Laila', x: 618, y: 392, w: 170, t: "Quit whining. I'll keep you warm with gunfire.", tail: [572, 470] }] },
    ] }],
  },
  'w1-outro': {
    title: 'The Rift Closes', kicker: 'Chapter 2', world: 1,
    pages: [{ panels: [
      { at: [[14, 14], [640, 14], [620, 548], [14, 548]], art: 'bossFall', o: { kind: 'grave', spot: 'purple' }, fx: 'slam', snd: 'stomp', cam: [1.12, 1.02],
        text: [{ k: 'sfx', x: 360, y: 60, t: 'KRRAAASH', size: 60, rot: 0.1, col: 'purple', grow: 1 }, { k: 'cap', x: 30, y: 470, w: 300, t: 'The Grave Lord fell, and the rift above Blackwood sealed shut.' }] },
      { at: [[652, 14], [986, 14], [986, 276], [643, 276]], art: 'worldMap', o: { upto: 2 }, cam: [1.12, 1, 0.05, -0.02],
        text: [{ k: 'cap', x: 664, y: 26, w: 230, t: 'Okafor was already gone.' }] },
      { at: [[642, 288], [986, 288], [986, 548], [632, 548]], art: 'portrait', o: { who: 'voss', mood: 'calm', bg: 'night', x: 0.78, turn: 0.2 }, cam: [1.08, 1],
        text: [{ k: 'say', who: 'Voss', x: 646, y: 304, w: 140, t: "She's gone north. Pack for the cold.", tail: [875, 425] }] },
    ] }, { panels: [
      { at: [[14, 14], [640, 14], [620, 548], [14, 548]], art: 'cleaners', cam: [1.1, 1, -0.02, 0],
        text: [{ k: 'cap', x: 30, y: 30, w: 300, t: 'The cleaners were gone too. So were the crypt files.' }] },
      { at: [[652, 14], [986, 14], [986, 548], [632, 548]], art: 'portrait', o: { who: 'laila', mood: 'grim', bg: 'storm', x: 0.56 }, cam: [1.08, 1],
        text: [{ k: 'say', who: 'Laila', x: 660, y: 40, w: 170, t: "They know where she's headed.", tail: [790, 190] }, { k: 'say', x: 730, y: 430, w: 190, t: "Then we'd better get there first.", tail: [820, 360] }] },
    ] }],
  },

  'w2-intro': {
    title: 'White Silence', kicker: 'Chapter 3', world: 2,
    pages: [
      { panels: [{ at: FULL, art: 'chapter', o: { world: 2, kicker: 'CHAPTER 3', title: 'WHITE SILENCE', place: 'FROSTFALL TUNDRA  ·  STATION 7', spot: 'ice' }, cam: [1.08, 1] }] },
      { panels: [
        { at: [[14, 14], [986, 14], [986, 240], [14, 256]], art: 'snowstorm', cam: [1.1, 1, 0.03, 0],
          text: [{ k: 'loc', x: 30, y: 30, w: 300, t: 'Frostfall Tundra. Station Seven.' }] },
        { at: [[14, 268], [420, 261], [420, 548], [14, 548]], art: 'portrait', o: { who: 'okafor', mood: 'tired', parka: true, bg: 'storm', x: 0.42, y: 0.38 }, cam: [1.08, 1],
          text: [{ k: 'say', who: 'Dr. Okafor', x: 236, y: 286, w: 170, t: 'You came. Good.', tail: [210, 380] }, { k: 'say', x: 196, y: 452, w: 190, t: 'Then you need to see what they built up here.', tail: [200, 400] }] },
        { at: [[432, 261], [986, 252], [986, 548], [432, 548]], art: 'frozenGiant', snd: 'freeze', cam: [1, 1.1, 0, 0.03],
          text: [{ k: 'say', x: 450, y: 276, w: 200, t: 'Their soldier. Lazarus, version two.', tail: [520, 470] }, { k: 'cap', x: 820, y: 276, w: 150, t: "It's waking up." }] },
      ] },
      { music: 'tension', panels: [
        { at: R(14, 14, 986, 250), art: 'radio', o: { ch: 'STATION 7 PA  ·  OVERRIDE', red: true }, snd: 'static', cam: [1.1, 1],
          text: [{ k: 'radio', who: 'Silas Vane', x: 330, y: 40, w: 380, t: 'Hello, Mara. You always were sentimental.', tail: [230, 150] }] },
        { at: [[14, 262], [480, 262], [460, 548], [14, 548]], art: 'portrait', o: { who: 'okafor', mood: 'shout', parka: true, bg: 'lines', x: 0.42 }, fx: 'shake', cam: [1.1, 1],
          text: [{ k: 'shout', who: 'Okafor', x: 264, y: 280, w: 180, t: "He's waking it up from the tower!", tail: [215, 395] }] },
        { at: [[492, 262], [986, 262], [986, 548], [472, 548]], art: 'frozenGiant', snd: 'freeze', fx: 'slam', cam: [1.5, 1.35, 0, -0.22],
          text: [{ k: 'sfx', x: 520, y: 300, t: 'KRRRK', size: 54, rot: -0.12, col: 'ice' }, { k: 'radio', who: 'Silas Vane', x: 620, y: 430, w: 230, t: 'Lazarus Two. Bring me the core.', tail: [986, 510] }] },
      ] },
    ],
  },
  'w2-mid': {
    title: 'The Source', kicker: 'Chapter 3', world: 2,
    pages: [{ panels: [
      { at: [[14, 14], [600, 14], [580, 548], [14, 548]], art: 'console', cam: [1.1, 1],
        text: [{ k: 'say', who: 'Okafor', x: 30, y: 196, w: 220, t: 'I built the core, Commander. I owe the world a way back.', tail: [200, 470] }, { k: 'say', x: 280, y: 366, w: 250, t: 'The cure needs a sample from the source. From the hive itself.', tail: [300, 500] }] },
      { at: [[612, 14], [986, 14], [986, 548], [592, 548]], art: 'worldMap', o: { upto: 3 }, cam: [1.25, 1.05, 0.06, 0.12],
        text: [{ k: 'say', x: 630, y: 30, w: 220, t: "It's in the bayou. Every road leads there.", tail: [600, 120] }] },
    ] }],
  },
  'w2-outro': {
    title: 'Thaw', kicker: 'Chapter 3', world: 2,
    pages: [{ panels: [
      { at: [[14, 14], [620, 14], [600, 548], [14, 548]], art: 'frozenGiant', o: { broken: true }, fx: 'slam', snd: 'shatter', cam: [1.15, 1.02],
        text: [{ k: 'sfx', x: 60, y: 130, t: 'SHHKRAAAK', size: 56, rot: -0.2, col: 'ice', grow: 1 }, { k: 'cap', x: 30, y: 480, w: 280, t: 'Lazarus Two came apart like river ice.' }] },
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
          text: [{ k: 'radio', who: 'Voss', x: 30, y: 258, w: 230, t: 'That thing is the hive.', tail: [14, 300] }, { k: 'radio', x: 370, y: 470, w: 210, t: 'Every infected on the planet answers to it.', tail: [620, 520] }] },
        { at: [[652, 242], [986, 242], [986, 548], [632, 548]], art: 'trio', cam: [1.1, 1],
          text: [{ k: 'say', who: 'Okafor', x: 662, y: 254, w: 190, t: 'Bring it down. The core does the rest.', tail: [790, 400] }, { k: 'say', who: 'Moreno', x: 856, y: 330, w: 90, t: 'Last stand.', tail: [900, 420] }, { k: 'say', who: 'Laila', x: 664, y: 470, w: 200, t: "Then let's make it count.", tail: [760, 440] }] },
      ] },
    ],
  },
  'w3-mid': {
    title: 'Converging', kicker: 'Chapter 4', world: 3,
    pages: [{ music: 'tension', panels: [
      { at: R(14, 14, 986, 320), art: 'horde', snd: 'groan', cam: [1, 1.12, 0, 0.05],
        text: [{ k: 'radio', who: 'Voss', x: 30, y: 30, w: 360, t: 'The horde is converging, Commander. All of it.', tail: [14, 120] }, { k: 'radio', who: 'Silas Vane', x: 550, y: 200, w: 320, t: "I'm sending the hive's call. Every one of them is coming for you.", tail: [986, 300] }] },
      { at: R(14, 332, 500, 548), art: 'portrait', o: { who: 'moreno', mood: 'smile', bg: 'fire', x: 0.32, turn: 0.25 }, cam: [1.08, 1],
        text: [{ k: 'say', who: 'Moreno', x: 280, y: 360, w: 190, t: 'Good. Saves us the walk.', tail: [230, 430] }] },
      { at: R(512, 332, 986, 548), art: 'portrait', o: { who: 'okafor', mood: 'grim', bg: 'lab', glasses: '#52e07c', x: 0.7 }, cam: [1.08, 1],
        text: [{ k: 'say', who: 'Okafor', x: 526, y: 350, w: 200, t: 'Hold them a little longer. The core is almost ready.', tail: [790, 430] }] },
    ] }],
  },
  'w3-outro': {
    title: 'One Shot', kicker: 'Chapter 4', world: 3,
    pages: [
      { music: 'boss', panels: [
        { at: R(14, 14, 986, 290), art: 'tendril', fx: 'shake', snd: 'roar', cam: [1.12, 1],
          text: [{ k: 'cap', x: 30, y: 30, w: 300, t: 'Okafor ran for the heart. The hive saw her coming.' }, { k: 'radio', who: 'Voss', x: 612, y: 150, w: 320, t: "Laila! She's not going to make it!", tail: [986, 240] }] },
        { at: [[14, 302], [520, 302], [500, 548], [14, 548]], art: 'portrait', o: { who: 'laila', mood: 'grim', hat: true, bg: 'lines', x: 0.4, y: 0.52, zoom: 1.15 }, cam: [1.12, 1],
          text: [{ k: 'say', who: 'Laila', x: 330, y: 330, w: 160, t: "I've got her.", tail: [260, 450] }] },
        { at: [[532, 302], [986, 302], [986, 548], [512, 548]], art: 'tattoo', o: { spot: 'green' }, cam: [1.15, 1.02],
          text: [{ k: 'cap', x: 740, y: 500, w: 230, t: 'One breath. One shot.' }] },
      ] },
      { music: 'boss', panels: [
        { at: [[14, 14], [470, 14], [440, 548], [14, 548]], art: 'scope', o: { target: 'hive' }, fx: 'slam', snd: 'sniper', cam: [1.2, 1.02],
          text: [{ k: 'sfx', x: 60, y: 420, t: 'BLAM!', size: 80, rot: -0.12, col: 'green' }] },
        { at: [[482, 14], [986, 14], [986, 548], [452, 548]], art: 'explosion', o: { spot: 'green' }, fx: 'flash', snd: 'boom', cam: [1.15, 1.02],
          text: [{ k: 'sfx', x: 520, y: 100, t: 'KRA-THOOOM!', size: 60, rot: -0.08, col: 'green', grow: 1 }, { k: 'cap', x: 500, y: 470, w: 330, t: "The shot split the hive's eye wide open." }] },
      ] },
      { panels: [
        { at: R(14, 14, 500, 548), art: 'injection', snd: 'pulse', cam: [1.1, 1],
          text: [{ k: 'cap', x: 30, y: 30, w: 260, t: 'Okafor drove the Lazarus Core into its heart.' }] },
        { at: R(512, 14, 986, 548), art: 'sunrise', cam: [1, 1.08, 0, -0.02],
          text: [{ k: 'cap', x: 528, y: 30, w: 300, t: 'One by one, the dead lay down again.' }] },
      ] },
      { panels: [
        { at: [[14, 14], [330, 14], [320, 548], [14, 548]], art: 'portrait', o: { who: 'voss', mood: 'calm', bg: 'tone', glow: 'amber', x: 0.5 }, cam: [1.08, 1],
          text: [{ k: 'say', who: 'Voss', x: 30, y: 36, w: 160, t: "Commander. It's over.", tail: [150, 170] }] },
        { at: [[342, 14], [656, 14], [646, 548], [332, 548]], art: 'portrait', o: { who: 'laila', mood: 'smile', hat: true, bg: 'tone', glow: 'amber', x: 0.5, y: 0.52 }, cam: [1.08, 1],
          text: [{ k: 'say', who: 'Laila', x: 356, y: 400, w: 200, t: 'Told you I could keep up, Commander.', tail: [480, 360] }] },
        { at: [[668, 14], [986, 14], [986, 548], [658, 548]], art: 'meteorSky', o: { many: true }, snd: 'missile', cam: [1, 1.1, 0, -0.03],
          text: [{ k: 'say', who: 'Moreno', x: 700, y: 440, w: 220, t: 'Doc... what is that?', tail: [760, 380] }] },
      ] },
      { music: 'tension', panels: [
        { at: [[14, 14], [480, 14], [460, 548], [14, 548]], art: 'portrait', o: { who: 'okafor', mood: 'grim', bg: 'night', glasses: '#52e07c', x: 0.45 }, cam: [1.1, 1],
          text: [{ k: 'say', who: 'Okafor', x: 260, y: 40, w: 170, t: "Those aren't meteors.", tail: [230, 170] }, { k: 'say', x: 250, y: 450, w: 170, t: "They're seeds.", tail: [220, 400] }] },
        { at: [[492, 14], [986, 14], [986, 548], [472, 548]], art: 'vaneClose', o: { spot: 'red' }, fx: 'flash', snd: 'impact', cam: [1.15, 1.02],
          text: [{ k: 'say', who: 'Silas Vane', x: 520, y: 440, w: 200, t: 'Phase two begins.', tail: [760, 380] }] },
      ] },
      { panels: [{ at: FULL, art: 'titleCard', o: { title: 'HOLD THE LINE', sub: 'TO BE CONTINUED', spot: 'green' }, fx: 'flash', snd: 'impact', cam: [1.06, 1] }] },
    ],
  },
  // ---------------------------------------------------------------- the city
  'w5-intro': {
    title: 'Skyline', kicker: 'Chapter 5', world: 5,
    pages: [
      { panels: [{ at: FULL, art: 'chapter', o: { world: 5, kicker: 'CHAPTER 5', title: 'SKYLINE', place: 'THE FALLEN CITY', spot: 'purple' }, cam: [1.08, 1] }] },
      { music: 'tension', panels: [
        { at: R(14, 14, 986, 300), art: 'burningCity', cam: [1.1, 1, -0.03, 0],
          text: [{ k: 'loc', x: 30, y: 30, w: 330, t: 'The city. Kessler-Vane Tower still has its lights on.' }, { k: 'cap', x: 640, y: 236, w: 320, t: 'The seeds were falling on every city on Earth.' }] },
        { at: [[14, 312], [500, 312], [480, 548], [14, 548]], art: 'portrait', o: { who: 'okafor', mood: 'grim', glasses: '#52e07c', bg: 'lab', x: 0.7 }, cam: [1.08, 1],
          text: [{ k: 'say', who: 'Okafor', x: 30, y: 330, w: 200, t: 'Vane is calling them home. All of them, to his tower.', tail: [300, 420] }] },
        { at: [[512, 312], [986, 312], [986, 548], [492, 548]], art: 'portrait', o: { who: 'laila', mood: 'smile', hat: true, bg: 'fire', x: 0.32, y: 0.52 }, cam: [1.08, 1],
          text: [{ k: 'say', who: 'Laila', x: 760, y: 340, w: 200, t: 'Then we go knock on his door.', tail: [700, 430] }] },
      ] },
      { panels: [
        { at: [[14, 14], [480, 14], [460, 548], [14, 548]], art: 'portrait', o: { who: 'voss', mood: 'calm', bg: 'tone', glow: 'amber', x: 0.45 }, cam: [1.08, 1],
          text: [{ k: 'say', who: 'Voss', x: 260, y: 40, w: 170, t: 'Every block between us and that tower is his.', tail: [230, 170] }] },
        { at: [[492, 14], [986, 14], [986, 548], [472, 548]], art: 'vaneClose', o: { spot: 'red' }, cam: [1.12, 1],
          text: [{ k: 'radio', who: 'Silas Vane', x: 510, y: 452, w: 190, t: "Come on up, Commander. I'll leave the lights on.", tail: [760, 380] }] },
      ] },
    ],
  },
  'w5-mid': {
    title: 'Street by Street', kicker: 'Chapter 5', world: 5,
    pages: [{ music: 'tension', panels: [
      { at: R(14, 14, 986, 320), art: 'horde', snd: 'groan', cam: [1, 1.12, 0, 0.05],
        text: [{ k: 'radio', who: 'Voss', x: 30, y: 30, w: 340, t: 'Office workers, riot cops, his drones. The whole city came out for us.', tail: [14, 120] }, { k: 'radio', who: 'Silas Vane', x: 600, y: 200, w: 300, t: 'Every employee answers to me. Even now.', tail: [986, 280] }] },
      { at: R(14, 332, 500, 548), art: 'portrait', o: { who: 'moreno', mood: 'smile', bg: 'fire', x: 0.32, turn: 0.25 }, cam: [1.08, 1],
        text: [{ k: 'say', who: 'Moreno', x: 250, y: 350, w: 190, t: 'And this is why I never took an office job.', tail: [220, 430] }] },
      { at: R(512, 332, 986, 548), art: 'portrait', o: { who: 'okafor', mood: 'grim', bg: 'lab', glasses: '#52e07c', x: 0.7 }, cam: [1.08, 1],
        text: [{ k: 'say', who: 'Okafor', x: 540, y: 350, w: 190, t: 'The signal is coming from inside him. He took a seed himself.', tail: [790, 430] }] },
    ] }],
  },
  'w5-outro': {
    title: 'The Chairman', kicker: 'Chapter 5', world: 5,
    pages: [
      { music: 'boss', panels: [
        { at: R(14, 14, 986, 330), art: 'chairmanRise', fx: 'shake', snd: 'roar', cam: [1.1, 1, 0, 0.03],
          text: [{ k: 'radio', who: 'Voss', x: 640, y: 250, w: 300, t: 'That... is Vane?', tail: [986, 300] }] },
        { at: [[14, 342], [520, 342], [500, 548], [14, 548]], art: 'portrait', o: { who: 'laila', mood: 'grim', hat: true, bg: 'lines', x: 0.4, y: 0.52, zoom: 1.15 }, cam: [1.12, 1],
          text: [{ k: 'say', who: 'Laila', x: 330, y: 360, w: 160, t: 'He still has a heart. Aim for it.', tail: [260, 450] }] },
        { at: [[532, 342], [986, 342], [986, 548], [512, 548]], art: 'explosion', o: { spot: 'purple' }, fx: 'flash', snd: 'boom', cam: [1.15, 1.02],
          text: [{ k: 'sfx', x: 570, y: 380, t: 'KRA-THOOOM!', size: 54, rot: -0.08, col: 'paper', grow: 1 }] },
      ] },
      { panels: [
        { at: R(14, 14, 500, 548), art: 'injection', snd: 'pulse', cam: [1.1, 1],
          text: [{ k: 'cap', x: 30, y: 30, w: 260, t: 'Okafor gave the last of the cure to the man who made the plague.' }] },
        { at: R(512, 14, 986, 548), art: 'sunrise', cam: [1, 1.08, 0, -0.02],
          text: [{ k: 'cap', x: 528, y: 30, w: 300, t: 'At dawn the tower went dark, and the city lay down to sleep.' }] },
      ] },
      { panels: [
        { at: [[14, 14], [480, 14], [460, 548], [14, 548]], art: 'portrait', o: { who: 'voss', mood: 'calm', bg: 'tone', glow: 'amber', x: 0.45 }, cam: [1.08, 1],
          text: [{ k: 'say', who: 'Voss', x: 260, y: 40, w: 170, t: 'Commander. Now it really is over.', tail: [230, 170] }] },
        { at: [[492, 14], [986, 14], [986, 548], [472, 548]], art: 'portrait', o: { who: 'laila', mood: 'smile', hat: true, bg: 'tone', glow: 'amber', x: 0.5, y: 0.52 }, cam: [1.08, 1],
          text: [{ k: 'say', who: 'Laila', x: 520, y: 420, w: 200, t: "Let's go home. Whatever's left of it.", tail: [700, 360] }] },
      ] },
      { panels: [{ at: FULL, art: 'titleCard', o: { title: 'HOLD THE LINE', sub: 'THE END', spot: 'amber' }, fx: 'flash', snd: 'impact', cam: [1.06, 1] }] },
    ],
  },
  // ---------------------------------------------------------------- the desert expansion
  'w4-intro': {
    title: 'Phase Two', kicker: 'Side story', world: 4,
    pages: [
      { panels: [{ at: FULL, art: 'chapter', o: { world: 4, kicker: 'SIDE STORY', title: 'PHASE TWO', place: 'RED MESA WASTELAND', spot: 'orange' }, cam: [1.08, 1] }] },
      { music: 'tension', panels: [
        { at: R(14, 14, 986, 300), art: 'desertBase', cam: [1.1, 1, -0.03, 0],
          text: [{ k: 'loc', x: 30, y: 30, w: 330, t: 'Red Mesa, New Mexico. Three weeks after the bayou.' }, { k: 'cap', x: 30, y: 236, w: 300, t: 'One of the seeds came down on an old airbase.' }] },
        { at: [[14, 312], [500, 312], [480, 548], [14, 548]], art: 'portrait', o: { who: 'okafor', mood: 'grim', glasses: '#52e07c', bg: 'lab', x: 0.7 }, cam: [1.08, 1],
          text: [{ k: 'say', who: 'Okafor', x: 30, y: 330, w: 200, t: 'In this heat it grows fast. Faster than the hive ever did.', tail: [300, 420] }] },
        { at: [[512, 312], [986, 312], [986, 548], [492, 548]], art: 'portrait', o: { who: 'laila', mood: 'smile', hat: true, bg: 'fire', x: 0.32, y: 0.52 }, cam: [1.08, 1],
          text: [{ k: 'say', who: 'Laila', x: 760, y: 340, w: 200, t: 'Then we pull it up by the roots.', tail: [700, 430] }] },
      ] },
      { panels: [
        { at: [[14, 14], [480, 14], [460, 548], [14, 548]], art: 'portrait', o: { who: 'voss', mood: 'calm', bg: 'tone', glow: 'amber', x: 0.45 }, cam: [1.08, 1],
          text: [{ k: 'say', who: 'Voss', x: 260, y: 40, w: 170, t: 'We take the base back. Mount up.', tail: [230, 170] }] },
        { at: [[492, 14], [986, 14], [986, 548], [472, 548]], art: 'vaneClose', o: { spot: 'red' }, cam: [1.12, 1],
          text: [{ k: 'radio', who: 'Silas Vane', x: 510, y: 452, w: 190, t: 'Kessler-Vane owns that desert. And all that grows in it.', tail: [760, 380] }] },
      ] },
    ],
  },
  'w4-mid': {
    title: 'Site Zero', kicker: 'Side story', world: 4,
    pages: [{ music: 'tension', panels: [
      { at: R(14, 14, 986, 320), art: 'horde', snd: 'groan', cam: [1, 1.12, 0, 0.05],
        text: [{ k: 'radio', who: 'Voss', x: 30, y: 30, w: 340, t: 'They are crawling up out of the sand, Commander. Thousands.', tail: [14, 120] }, { k: 'radio', who: 'Silas Vane', x: 600, y: 200, w: 300, t: 'My little garden is blooming.', tail: [986, 280] }] },
      { at: R(14, 332, 500, 548), art: 'portrait', o: { who: 'moreno', mood: 'smile', bg: 'fire', x: 0.32, turn: 0.25 }, cam: [1.08, 1],
        text: [{ k: 'say', who: 'Moreno', x: 250, y: 350, w: 190, t: 'Sand in my boots. Sand in my gun. Sand in my coffee.', tail: [220, 430] }] },
      { at: R(512, 332, 986, 548), art: 'portrait', o: { who: 'okafor', mood: 'grim', bg: 'lab', glasses: '#52e07c', x: 0.7 }, cam: [1.08, 1],
        text: [{ k: 'say', who: 'Okafor', x: 540, y: 350, w: 190, t: 'The seed is pulling the sand together. Something big is forming.', tail: [790, 430] }] },
    ] }],
  },
  'w4-outro': {
    title: 'Sandstorm', kicker: 'Side story', world: 4,
    pages: [
      { music: 'boss', panels: [
        { at: R(14, 14, 986, 330), art: 'colossusRise', fx: 'shake', snd: 'roar', cam: [1.1, 1, 0, 0.03],
          text: [{ k: 'radio', who: 'Voss', x: 640, y: 30, w: 300, t: "There's your something big!", tail: [986, 110] }] },
        { at: [[14, 342], [520, 342], [500, 548], [14, 548]], art: 'portrait', o: { who: 'laila', mood: 'grim', hat: true, bg: 'lines', x: 0.4, y: 0.52, zoom: 1.15 }, cam: [1.12, 1],
          text: [{ k: 'say', who: 'Laila', x: 330, y: 360, w: 160, t: 'Aim for the glowing cracks.', tail: [260, 450] }] },
        { at: [[532, 342], [986, 342], [986, 548], [512, 548]], art: 'explosion', o: { spot: 'orange' }, fx: 'flash', snd: 'boom', cam: [1.15, 1.02],
          text: [{ k: 'sfx', x: 570, y: 380, t: 'KRA-THOOOM!', size: 54, rot: -0.08, col: 'paper', grow: 1 }] },
      ] },
      { panels: [
        { at: R(14, 14, 500, 548), art: 'sunrise', cam: [1, 1.08, 0, -0.02],
          text: [{ k: 'cap', x: 30, y: 30, w: 280, t: 'The Colossus fell apart into a hill of red sand.' }] },
        { at: R(512, 14, 986, 548), art: 'injection', snd: 'pulse', cam: [1.1, 1],
          text: [{ k: 'cap', x: 528, y: 30, w: 300, t: 'Okafor killed the seed where it lay.' }] },
      ] },
      { music: 'tension', panels: [
        { at: [[14, 14], [480, 14], [460, 548], [14, 548]], art: 'portrait', o: { who: 'voss', mood: 'calm', bg: 'tone', glow: 'amber', x: 0.45 }, cam: [1.08, 1],
          text: [{ k: 'say', who: 'Voss', x: 260, y: 40, w: 170, t: "It's done. The seed is gone.", tail: [230, 170] }] },
        { at: [[492, 14], [986, 14], [986, 548], [472, 548]], art: 'vaneClose', o: { spot: 'red' }, cam: [1.12, 1],
          text: [{ k: 'radio', who: 'Silas Vane', x: 520, y: 440, w: 200, t: 'One seed, Commander. There were thousands.', tail: [760, 380] }] },
      ] },
      { panels: [{ at: FULL, art: 'titleCard', o: { title: 'HOLD THE LINE', sub: 'THE HUNT GOES ON', spot: 'orange' }, fx: 'flash', snd: 'impact', cam: [1.06, 1] }] },
    ],
  },
};
})();
const STORY_ORDER = ['prologue', 'w0-intro', 'w0-mid', 'w0-outro', 'w1-intro', 'w1-mid', 'w1-outro', 'w2-intro', 'w2-mid', 'w2-outro', 'w3-intro', 'w3-mid', 'w3-outro', 'w5-intro', 'w5-mid', 'w5-outro', 'w4-intro', 'w4-mid', 'w4-outro'];

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
  // On a phone held upright the whole page would be tiny, so the camera follows one panel at a
  // time instead (a "guided view"), gliding between panels as they appear.
  let guided = false, scr = { W: 1, H: 1, top: 52, bot: 18 };
  function panelBox(p) { const [x, y, w, h] = bbox(p.at); return { x, y, w, h }; }
  function zoomFor(p) {
    if (!guided || !p) return 1;
    const b = panelBox(p), availW = scr.W * dpr - 20 * dpr, availH = (scr.H - scr.top - scr.bot - 30) * dpr;
    return Math.max(1, Math.min(availW / (b.w * view.s), availH / (b.h * view.s), 3.2));
  }
  function camFor(p) {
    const W = scr.W * dpr, H = scr.H * dpr;
    if (!guided || !p) return { z: 1, ox: 0, oy: 0 };
    const b = panelBox(p), z = zoomFor(p), px = X(b.x + b.w / 2), py = Y(b.y + b.h / 2), cy = (scr.top + (scr.H - scr.top - scr.bot) / 2) * dpr;
    return { z, ox: W / 2 - px * z, oy: cy - py * z };
  }
  function fit() {
    dpr = Math.min(2.5, window.devicePixelRatio || 1);
    const W = window.innerWidth, H = window.innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const top = 52, bot = 18, s = Math.min((W - 24) / PW, (H - top - bot) / PH);
    // upright phones, and sideways ones where a whole page would be too small to read, follow panels
    guided = H > W * 1.05 || s < 0.6;
    scr = { W, H, top: 52, bot: guided ? 30 : 18 };
    view = { s: s * dpr, x: (W - PW * s) / 2 * dpr, y: (top + (H - top - bot - PH * s) / 2) * dpr };
    if (st) st.cam = null;
    if (st) for (const pg of st.pages) { pg.art = null; for (const p of pg.panels) for (const t of p.text) t.lay = null; }
  }
  const X = (x) => view.x + x * view.s, Y = (y) => view.y + y * view.s;

  // ---------- panel art ----------
  function bbox(pts) { const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]); const x0 = Math.min(...xs), y0 = Math.min(...ys); return [x0, y0, Math.max(...xs) - x0, Math.max(...ys) - y0]; }
  function renderPage(pg) {
    if (pg.art) return;
    pg.art = pg.panels.map((p) => {
      // panels the guided view zooms into are painted at that zoom so they stay sharp
      const [bx, by, bw, bh] = bbox(p.at), zf = Math.min(2.4, zoomFor(p)), w = Math.max(8, Math.round(bw * view.s * zf)), h = Math.max(8, Math.round(bh * view.s * zf));
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d'); g.fillStyle = PAPER; g.fillRect(0, 0, w, h);
      const faces = MANGA.recordFaces(() => { try { SCENES[p.art].base(g, w, h, p.o || {}); } catch (e) { console.error(e); } });
      if (!p._faces) p._faces = facesIn(p, faces, w, h);
      return { c, bx, by, bw, bh, dw: w / zf, dh: h / zf };
    });
    // lettering is laid out once the faces are known, so it can keep off them
    settle(pg.panels.flatMap((p) => p.text), pg.panels);
  }
  // Faces noted while a panel's art was drawn, turned into sheet units. The panel's camera drifts
  // and zooms as it is read, so each face covers everywhere it goes, clipped to the panel.
  function facesIn(p, raw, w, h) {
    const [bx, by, bw, bh] = bbox(p.at), [z0, z1, px = 0, py = 0] = p.cam || [1.06, 1];
    return raw.map((f) => {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const k of [0, 1]) {
        const z = lerp(z0, z1, k);
        for (const [u, v] of [[f.x0, f.y0], [f.x1, f.y1]]) {
          const sx = bx + bw / 2 + px * bw * k + z * ((u / w) * bw - bw / 2), sy = by + bh / 2 + py * bh * k + z * ((v / h) * bh - bh / 2);
          x0 = Math.min(x0, sx); y0 = Math.min(y0, sy); x1 = Math.max(x1, sx); y1 = Math.max(y1, sy);
        }
      }
      x0 = Math.max(x0, bx); y0 = Math.max(y0, by); x1 = Math.min(x1, bx + bw); y1 = Math.min(y1, by + bh);
      return x1 - x0 > 4 && y1 - y0 > 4 ? { x0, y0, x1, y1 } : null;
    }).filter(Boolean);
  }
  // the same, for a panel that has not been painted (the layout audit)
  function facesOf(p) {
    if (p._faces) return p._faces;
    const [, , bw, bh] = bbox(p.at), w = Math.round(bw * 1.5), h = Math.round(bh * 1.5), c = document.createElement('canvas');
    c.width = w; c.height = h;
    const raw = MANGA.recordFaces(() => { try { SCENES[p.art].base(c.getContext('2d'), w, h, p.o || {}); } catch (e) { /* drawn without faces */ } });
    return (p._faces = facesIn(p, raw, w, h));
  }

  // ---------- lettering ----------
  const FS = { say: 21, shout: 23, radio: 20, cap: 19, loc: 17 };
  // the text block at its authored size, before any enlarging for small screens
  function nominal(t) {
    if (t.nom && t.nom.s === view.s) return t.nom;
    const fs = (t.fs || FS[t.k] || 20) * view.s, wt = t.k === 'shout' ? 800 : 700;
    ctx.font = `${wt} ${fs}px "Barlow Condensed", "Arial Narrow", sans-serif`;
    const words = t.t.toUpperCase().split(' '), lines = []; let line = '';
    for (const wd of words) { const tryL = line ? `${line} ${wd}` : wd; if (ctx.measureText(tryL).width > t.w * view.s && line) { lines.push(line); line = wd; } else line = tryL; }
    if (line) lines.push(line);
    const tw = Math.max(...lines.map((l) => ctx.measureText(l).width)), th = lines.length * fs * 1.12, pad = fs * 0.55;
    const oval = t.k !== 'cap' && t.k !== 'loc';
    const w = oval ? (tw / 2 * 1.36 + pad * 0.9) * 2 : tw + pad * 2, h = oval ? (th / 2 * 1.36 + pad * 0.75) * 2 : th + pad * 1.4;
    t.nom = { s: view.s, w: w / view.s, h: h / view.s };
    return t.nom;
  }
  function layout(t) {
    if (t.lay) return t.lay;
    const minPx = 12.5 * dpr / (guided ? zoomFor(t._p) : 1), fs = Math.max((t.fs || FS[t.k] || 20) * view.s, minPx), grow = fs / ((t.fs || FS[t.k] || 20) * view.s);
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
  // where a caption or balloon sits on the page, in device pixels, after it is kept on the page
  function boxOf(t) {
    const L = layout(t), pad = L.fs * 0.55;
    const N = nominal(t);
    if (t.k === 'cap' || t.k === 'loc') {
      // a caption grows away from the corner of the page it sits nearest
      const w = L.tw + pad * 2, h = L.th + pad * 1.4;
      const ax = t.x + N.w / 2 > PW / 2 ? X(t.x + N.w) - w : X(t.x), ay = t.y + N.h / 2 > PH / 2 ? Y(t.y + N.h) - h : Y(t.y);
      const o = t.off || [0, 0];
      return { L, pad, x: clamp(ax + o[0], X(8), X(PW - 8) - w), y: clamp(ay + o[1], Y(8), Y(PH - 8) - h), w, h };
    }
    // the smallest oval round a text block has semi-axes √2 times its half-width and half-height
    const rx = L.tw / 2 * 1.36 + pad * 0.9, ry = L.th / 2 * 1.36 + pad * 0.75;
    // balloons grow out from their authored centre
    const o = t.off || [0, 0];
    const cx = clamp(X(t.x + N.w / 2) + o[0], X(10) + rx, X(PW - 10) - rx), cy = clamp(Y(t.y + N.h / 2) + o[1], Y(10) + ry, Y(PH - 10) - ry);
    return { L, pad, rx, ry, cx, cy, x: cx - rx, y: cy - ry, w: rx * 2, h: ry * 2 };
  }
  // The last word on layout: once every caption and balloon on a page has its size for this
  // screen, any two that touch are nudged apart (sound effects stay put), so lettering never
  // overlaps whatever the screen. Tails keep pointing at their speakers.
  // a sound effect is laid out letter by letter exactly as drawSfx sets it (growing, slanted,
  // outlined), so each letter gets its own box in device pixels
  function sfxBoxes(t) {
    const size = (t.size || 56) * view.s, rot = t.rot || 0, n = t.t.length, ca = Math.cos(rot), sa = Math.sin(rot), out = [];
    let x = 0;
    for (let i = 0; i < n; i++) {
      const k = t.grow ? 0.75 + 0.5 * (i / Math.max(1, n - 1)) : 1;
      ctx.font = `800 ${size * k}px "Barlow Condensed", sans-serif`;
      const w = ctx.measureText(t.t[i]).width, hh = size * k * 0.62 + size * k * 0.15, x0 = x - size * k * 0.12, x1 = x + w + size * k * 0.12;
      const pts = [[x0, -hh], [x1, -hh], [x1, hh], [x0, hh]].map(([px, py]) => { const sx = px - 0.18 * py; return [X(t.x) + sx * ca - py * sa, Y(t.y) + sx * sa + py * ca]; });
      const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
      out.push({ x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) });
      x += w * 0.94;
    }
    return out;
  }
  function settle(texts, panels = []) {
    for (const t of texts) t.off = null;
    const items = texts.flatMap((t) => {
      if (t.k === 'sfx') return sfxBoxes(t).map((b) => ({ t, fixed: true, ...b }));
      const B = boxOf(t), oval = t.k !== 'cap' && t.k !== 'loc', m = oval ? 0.02 : 0, tag = t.who ? layout(t).fs * 0.75 : 0;
      return [{ t, x: B.x + B.w * m, y: B.y + B.h * m - tag, w: B.w * (1 - 2 * m), h: B.h * (1 - 2 * m) + tag, ox: 0, oy: 0 }];
    });
    // faces in the art stay put and the lettering moves off them, like sound effects
    for (const p of panels) for (const f of p._faces || []) items.push({ t: { _p: p }, fixed: true, face: true, x: X(f.x0), y: Y(f.y0), w: (f.x1 - f.x0) * view.s, h: (f.y1 - f.y0) * view.s });
    const gap = 5 * dpr;
    // in the guided view each panel fills the screen, so its lettering must stay on its panel
    for (const it of items) {
      const b0 = guided && it.t._p ? panelBox(it.t._p) : null, b = b0 ? { x: b0.x - 10, y: b0.y - 10, w: b0.w + 20, h: b0.h + 20 } : { x: 0, y: 0, w: PW, h: PH };
      it.lo = [X(b.x + 6), Y(b.y + 6)]; it.hi = [Math.max(X(b.x + 6) + it.w, X(b.x + b.w - 6)), Math.max(Y(b.y + 6) + it.h, Y(b.y + b.h - 6))];
    }
    const shift = (it, dx, dy) => {
      const nx = clamp(it.x + dx, it.lo[0], it.hi[0] - it.w), ny = clamp(it.y + dy, it.lo[1], it.hi[1] - it.h);
      const mx = nx - it.x, my = ny - it.y; it.x = nx; it.y = ny; it.ox += mx; it.oy += my;
      return Math.abs(mx) + Math.abs(my) > 0.5;
    };
    for (let pass = 0; pass < 60; pass++) {
      let moved = false;
      for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
        const a = items[i], b = items[j];
        if (guided && a.t._p !== b.t._p) continue;
        const px = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) + gap, py = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) + gap;
        if (px <= 0 || py <= 0) continue;
        // the later one moves; if it is pinned against the page edge the earlier one gives way
        const order = b.fixed ? [a, b] : [b, a];
        for (const [mv, other] of [order, [order[1], order[0]]]) {
          if (mv.fixed) continue;
          const dy = Math.sign(mv.y + mv.h / 2 - (other.y + other.h / 2)) || 1, dx = Math.sign(mv.x + mv.w / 2 - (other.x + other.w / 2)) || 1;
          const tryV = () => shift(mv, 0, dy * py) || shift(mv, 0, -dy * py), tryH = () => shift(mv, dx * px, 0) || shift(mv, -dx * px, 0);
          if (py <= px * 1.4 ? tryV() || tryH() : tryH() || tryV()) { moved = true; break; }
        }
      }
      if (!moved) break;
    }
    for (const it of items) if (!it.fixed) it.t.off = [it.ox, it.oy];
  }
  // a tail whose tip would sit inside its own balloon is lengthened along the same heading
  function tailOf(t, B) {
    if (!t.tail) return null;
    let tx = X(t.tail[0]), ty = Y(t.tail[1]);
    const dx = (tx - B.cx) / B.rx, dy = (ty - B.cy) / B.ry, q = Math.hypot(dx, dy);
    if (q < 1.45) { const k = 1.55 / Math.max(0.2, q); tx = B.cx + dx * k * B.rx; ty = B.cy + dy * k * B.ry; }
    // a speaker off the panel is shown by a tail that reaches the page edge, never past it
    return [clamp(tx, X(2), X(PW - 2)), clamp(ty, Y(2), Y(PH - 2))];
  }
  function drawText(t, el, forced) {
    const vis = forced ? 1e9 : Math.floor(el * CPS);
    if (t.k === 'sfx') return drawSfx(t, el, forced);
    const B = boxOf(t), L = B.L, s = view.s, pad = B.pad;
    const pop = forced ? 1 : easeBack(clamp(el / 0.16, 0, 1));
    const bx = B.x, by = B.y;
    ctx.save(); ctx.globalAlpha = clamp(el / 0.1, 0, 1);
    if (t.k === 'cap' || t.k === 'loc') {
      const w = B.w, h = B.h;
      ctx.translate(bx + w / 2, by + h / 2); ctx.scale(0.92 + 0.08 * pop, 0.92 + 0.08 * pop); ctx.translate(-w / 2, -h / 2);
      ctx.fillStyle = INK; ctx.fillRect(s * 4, s * 4, w, h);
      ctx.fillStyle = t.k === 'loc' ? INK : PAPER; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = t.k === 'loc' ? PAPER : INK; ctx.lineWidth = Math.max(1, s * 2); ctx.strokeRect(0, 0, w, h);
      if (t.k === 'loc') { ctx.fillStyle = SPOT[st.spot] || SPOT.red; ctx.fillRect(0, 0, s * 5, h); }
      typeLines(L, pad + (t.k === 'loc' ? s * 4 : 0), pad * 0.7, t.k === 'loc' ? PAPER : INK, vis, 'left');
    } else {
      const { rx, ry, cx, cy } = B;
      const tail = tailOf(t, B);
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
      const [bx, by, bw, bh] = [X(a.bx), Y(a.by), a.dw, a.dh];
      const from = p.from || (i === 0 ? 'up' : i % 2 ? 'right' : 'left');
      const d = (1 - e) * 26 * s, dx = from === 'left' ? -d : from === 'right' ? d : 0, dy = from === 'up' ? -d : from === 'down' ? d : 0;
      const slam = p.fx === 'slam' ? 1 + 0.22 * (1 - e) : 1;
      ctx.save(); ctx.globalAlpha = alpha * e * (guided && pi === st.pi && i !== st.bi ? 0.28 : 1);
      ctx.translate(bx + bw / 2 + dx, by + bh / 2 + dy); ctx.scale(slam, slam); ctx.translate(-bx - bw / 2, -by - bh / 2);
      ctx.save();
      ctx.beginPath(); pts.forEach((q, j) => (j ? ctx.lineTo(...q) : ctx.moveTo(...q))); ctx.closePath(); ctx.clip();
      const [z0, z1, px = 0, py = 0] = p.cam || [1.06, 1], k = smooth(clamp(el / 9, 0, 1)), z = lerp(z0, z1, k);
      ctx.translate(bx + bw / 2 + px * bw * k, by + bh / 2 + py * bh * k); ctx.scale(z, z); ctx.translate(-bw / 2, -bh / 2);
      ctx.drawImage(a.c, 0, 0, bw, bh);
      const sc = SCENES[p.art];
      if (sc.anim) try { sc.anim(ctx, bw, bh, el, p.o || {}); } catch (err) { console.error(err); }
      ctx.restore();
      ctx.beginPath(); pts.forEach((q, j) => (j ? ctx.lineTo(...q) : ctx.moveTo(...q))); ctx.closePath();
      ctx.lineJoin = 'miter'; ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1.5, 3.4 * s); ctx.stroke();
      ctx.restore();
    });
    // lettering sits on top of the panels and may cross the gutters
    pg.panels.forEach((p, i) => {
      if (p.t0 == null) return;
      // the guided view letters only the panel being read
      if (guided && pi === st.pi && i !== st.bi) return;
      for (const t of p.text) { const el = T - t.at; if (el >= 0 || p.forced) drawText(t, p.forced ? 99 : el, p.forced); }
    });
    ctx.restore();
  }
  function frame() {
    if (!st) return;
    raf = requestAnimationFrame(frame);
    const T = now(), W = cv.width, H = cv.height, s = view.s, dtF = Math.min(0.1, T - (st.lastT || T)); st.lastT = T;
    // shake decays
    const sh = Math.max(0, st.shakeUntil - T);
    st.shake = { x: (Math.random() - 0.5) * sh * 60 * s, y: (Math.random() - 0.5) * sh * 60 * s };
    // backdrop
    const g = ctx.createRadialGradient(W / 2, H * 0.45, 0, W / 2, H / 2, Math.hypot(W, H) * 0.6);
    g.addColorStop(0, '#24262b'); g.addColorStop(1, '#08090b');
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // ease the guided-view camera toward the panel being read
    const want = camFor(st.pages[st.pi].panels[st.bi]);
    if (!st.cam) st.cam = { ...want };
    const ce = 1 - Math.exp(-dtF * 7); st.cam.z = lerp(st.cam.z, want.z, ce); st.cam.ox = lerp(st.cam.ox, want.ox, ce); st.cam.oy = lerp(st.cam.oy, want.oy, ce);
    ctx.setTransform(st.cam.z, 0, 0, st.cam.z, st.cam.ox, st.cam.oy);
    if (st.turn) {
      const k = clamp((T - st.turn.t0) / 0.55, 0, 1), e = smooth(k), dir = st.turn.dir;
      drawPage(st.turn.from, -dir * e * W * 0.9, 1 - e * 0.6, -dir * e * 0.06);
      drawPage(st.pi, dir * (1 - e) * W * 0.9, 0.4 + e * 0.6, dir * (1 - e) * 0.06);
      if (k >= 1) { st.turn = null; startBeat(0); }
    } else drawPage(st.pi, 0, 1, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // page tick marks
    const n = st.pages.length;
    if (n > 1) for (let i = 0; i < n; i++) { ctx.fillStyle = i === st.pi ? PAPER : 'rgba(242,238,228,0.3)'; const w = 18 * dpr, x = W / 2 + (i - (n - 1) / 2) * (w + 6 * dpr) - w / 2; ctx.fillRect(x, H - 10 * dpr, w, 3 * dpr); }
    // waiting cue
    if (!st.turn && !st.ending && beatDone()) {
      // a paper tab with an arrow nudging right, hanging off the page corner
      const r = Math.max(13 * dpr, 17 * s), cm = st.cam || { z: 1, ox: 0, oy: 0 };
      const x = guided ? W - r * 1.6 + Math.sin(T * 5) * r * 0.12 : X(PW) - r * 0.4 + Math.sin(T * 5) * r * 0.12, y = guided ? H - r * 2.2 : Y(PH) - r * 0.4;
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
    if (i === 0 && st.pi + 1 < st.pages.length) setTimeout(() => { const next = st && st.pages[st.pi + 1]; if (next) renderPage(next); }, 350);
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
    const pages = ch.pages.map((pg) => ({ ...pg, art: null, panels: pg.panels.map((p) => { const q = { ...p }; q.text = (p.text || []).map((t) => ({ ...t, _p: q })); return q; }) }));
    st = { id, ch, done, pages, pi: 0, bi: 0, turn: null, ending: 0, shake: { x: 0, y: 0 }, shakeUntil: 0, flashUntil: 0, lastType: 0, spot: ['amber', 'purple', 'ice', 'green', 'orange', 'purple'][ch.world] || 'red' };
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

  // Lays out every page at a given screen size and reports lettering that leaves the page,
  // collides with other lettering, spills out of its balloon or has a tail that goes nowhere.
  function audit(vw, vh, pr = 1, o = {}) {
    const keep = { cv, ctx, dpr, view, guided, scr }, issues = [];
    cv = document.createElement('canvas'); ctx = cv.getContext('2d'); dpr = pr;
    const top = 52, bot = 18, sc = Math.min((vw - 24) / PW, (vh - top - bot) / PH);
    view = { s: sc * dpr, x: 0, y: 0 }; guided = vh > vw * 1.05 || sc < 0.6; scr = { W: vw, H: vh, top: 52, bot: guided ? 30 : 18 };
    const U = (v) => v / view.s;
    for (const id of STORY_ORDER) STORY[id].pages.forEach((pg, pi) => {
      const boxes = [], copies = pg.panels.map((p) => (p.text || []).map((t0) => ({ ...t0, _p: p })));
      for (const p of pg.panels) facesOf(p);
      settle(copies.flat(), o.noFaces ? [] : pg.panels);
      const faces = pg.panels.flatMap((p, bi) => p._faces.map((f) => ({ ...f, bi })));
      pg.panels.forEach((p, bi) => (p.text || []).forEach((t0, ti) => {
        const t = copies[bi][ti], where = `${id} p${pi + 1} panel ${bi + 1} "${t.t.slice(0, 28)}"`;
        if (t.k === 'sfx') {
          const bs = sfxBoxes(t).map((b) => ({ where, src: t, x: U(b.x), y: U(b.y), w: U(b.w), h: U(b.h) }));
          boxes.push(...bs);
          if (bs.some((b) => b.x < -6 || b.x + b.w > PW + 6 || b.y < -6 || b.y + b.h > PH + 6)) issues.push(`${where}: sound effect runs off the page`);
          return;
        }
        const B = boxOf(t), bx = U(B.x), by = U(B.y), bw = U(B.w), bh = U(B.h);
        const N = nominal(t), mv = Math.hypot(bx + bw / 2 - (t.x + N.w / 2), by + bh / 2 - (t.y + N.h / 2)) - Math.max(0, Math.hypot(bw - N.w, bh - N.h) / 2);
        if (mv > (guided ? 90 : 30)) issues.push(`${where}: ${t.k === 'cap' || t.k === 'loc' ? 'caption' : 'balloon'} pushed ${Math.round(mv)} units to stay on the page`);
        if (t.k === 'cap' || t.k === 'loc') { /* corner-anchored */ }
        else {
          // every line's corners must sit inside the oval
          const L = B.L;
          L.lines.forEach((ln, i) => { ctx.font = L.font; const lw = ctx.measureText(ln).width, y0 = B.cy - L.th / 2 + i * L.lh, y1 = y0 + L.fs * 0.9; for (const [px, py] of [[B.cx - lw / 2, y0], [B.cx + lw / 2, y0], [B.cx - lw / 2, y1], [B.cx + lw / 2, y1]]) { const q = ((px - B.cx) / B.rx) ** 2 + ((py - B.cy) / B.ry) ** 2; if (q > 1.02) { issues.push(`${where}: text pokes out of the balloon (line ${i + 1})`); return; } } });
          if (t.tail) { const [tx, ty] = tailOf(t, B), q = ((tx - B.cx) / B.rx) ** 2 + ((ty - B.cy) / B.ry) ** 2; if (q < 1.3) issues.push(`${where}: tail is hidden inside its balloon`); if (tx < X(0) - 2 || tx > X(PW) + 2 || ty < Y(0) - 2 || ty > Y(PH) + 2) issues.push(`${where}: tail points off the page`); }
          if (t.who) { ctx.font = `700 ${L.fs * 0.62}px "Barlow Condensed", sans-serif`; boxes.push({ where: where + ' (name tag)', x: U(B.cx - B.rx * 0.72), y: U(B.cy - B.ry - L.fs * 0.9 * 0.55), w: U(ctx.measureText(t.who.toUpperCase()).width + L.fs * 0.6), h: U(L.fs * 0.9), tag: 1 }); }
        }
        boxes.push({ where, x: bx, y: by, w: bw, h: bh, oval: t.k !== 'cap' && t.k !== 'loc' });
        for (const f of faces) {
          if (guided && f.bi !== bi) continue;
          const ox = Math.min(bx + bw, f.x1) - Math.max(bx, f.x0), oy = Math.min(by + bh, f.y1) - Math.max(by, f.y0);
          if (ox > 2 && oy > 2) issues.push(`${where}: covers a face (${Math.round((100 * ox * oy) / ((f.x1 - f.x0) * (f.y1 - f.y0)))}% of it)`);
        }
      }));
      // shapes, not boxes: ovals are tested as ovals, with a little breathing room round each
      const inside = (o, x, y, pad) => o.oval ? (((x - o.x - o.w / 2) / (o.w / 2 + pad)) ** 2 + ((y - o.y - o.h / 2) / (o.h / 2 + pad)) ** 2 <= 1) : (x >= o.x - pad && x <= o.x + o.w + pad && y >= o.y - pad && y <= o.y + o.h + pad);
      const samples = (o) => { const pts = []; for (let i = 0; i < 40; i++) { const q = i / 40 * TAU; if (o.oval) pts.push([o.x + o.w / 2 + Math.cos(q) * o.w / 2, o.y + o.h / 2 + Math.sin(q) * o.h / 2]); } if (!o.oval) for (let i = 0; i <= 8; i++) pts.push([o.x + o.w * i / 8, o.y], [o.x + o.w * i / 8, o.y + o.h], [o.x, o.y + o.h * i / 8], [o.x + o.w, o.y + o.h * i / 8]); return pts; };
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j];
        if (a.src && a.src === b.src) continue;
        if ((a.tag && b.where.startsWith(a.where.replace(' (name tag)', ''))) || (b.tag && a.where.startsWith(b.where.replace(' (name tag)', '')))) continue;
        if (guided && a.where.split(' "')[0] !== b.where.split(' "')[0]) continue;
        if (samples(a).some(([x, y]) => inside(b, x, y, 3)) || samples(b).some(([x, y]) => inside(a, x, y, 3))) issues.push(`${a.where} overlaps ${b.where}`);
      }
    });
    ({ cv, ctx, dpr, view, guided, scr } = keep);
    return issues;
  }

  return {
    init, play: start, skip, advance, audit,
    get active() { return !!st; },
    get pos() { return st && { page: st.pi, beat: st.bi, pages: st.pages.length, beats: st.pages[st.pi].panels.length, done: beatDone(), turning: !!st.turn }; },
    seen: (id) => !!seen[id],
    has: (id) => !!STORY[id],
    chapters: () => STORY_ORDER.map((id) => ({ id, title: STORY[id].title, kicker: STORY[id].kicker, world: STORY[id].world, seen: !!seen[id] })),
    // first-time play: run the chapter only if it has not been seen
    once(id, then) { if (STORY[id] && !seen[id]) start(id, then); else if (then) then(); },
  };
})();
