/* T10 WORLD — places
 * Districts, landmark features, the point-of-interest registry and the
 * subway / bus networks. Pure data + light generation; no rendering here.
 *
 * World axes:  +X = east, -Z = north (uptown), +Z = south (downtown), +Y = up.
 * Manhattan avenues run north-south every 130m, streets east-west every 80m.
 */
(function (global) {
  'use strict';
  var T10 = global.T10;
  var M = T10.M;

  var P = T10.Places = {};

  P.AVE = 130;      // avenue spacing (x)
  P.ST = 80;        // street spacing (z)
  P.AVE_HALF = 13;  // avenue: 26m kerb to kerb (roadway + 5m sidewalks)
  P.ST_HALF = 9;    // cross street: 18m kerb to kerb
  P.AVE_MIN = -4; P.AVE_MAX = 4;
  P.ST_MIN = -31; P.ST_MAX = 19;

  /* ------------------------------------------------------------- landmass */
  /* Returns a landmass id, or null for water. */
  P.landAt = function (x, z) {
    // Manhattan — narrows toward the Battery and above Harlem
    if (z > -2560 && z < 1520) {
      var w = 565;
      if (z > 1150) w = 565 - (z - 1150) * 1.05;
      if (z < -2150) w = 565 - (-2150 - z) * 0.55;
      if (z > 780) w = Math.min(w, 520 + (1000 - z) * 0.06);
      if (x > -w && x < w) return 'manhattan';
    }
    // Roosevelt Island
    if (x > 620 && x < 700 && z > -980 && z < -420) return 'roosevelt';
    // Brooklyn (incl. the Coney Island spur to the south)
    if (x > 770 && x < 2150 && z > 280 && z < 2080) return 'brooklyn';
    if (x > 820 && x < 1700 && z >= 2080 && z < 2260) return 'coney';
    // Queens
    if (x > 770 && x < 2500 && z > -1500 && z <= 280) return 'queens';
    // The Bronx
    if (x > -520 && x < 1100 && z > -3500 && z <= -2560) return 'bronx';
    // Staten Island
    if (x > -2150 && x < -1000 && z > 1450 && z < 2500) return 'statenisland';
    // Liberty Island
    if (x > -980 && x < -830 && z > 1400 && z < 1550) return 'liberty';
    // Governors Island
    if (x > -520 && x < -330 && z > 1620 && z < 1760) return 'governors';
    // New Jersey shoreline (visual edge of the world)
    if (x < -1250 && x > -2600 && z > -1600 && z < 1400) return 'jersey';
    return null;
  };

  P.isWater = function (x, z) { return P.landAt(x, z) === null; };

  /* ------------------------------------------------------------ districts */
  /* type: 'core' dense, 'mid', 'low', 'park', 'industrial', 'beach', 'airport' */
  P.districts = [
    { id: 'washheights', name: 'Washington Heights', land: 'manhattan', z: [-2560, -2200], x: [-600, 600], type: 'mid', h: [22, 42], pal: 0 },
    { id: 'harlem', name: 'Harlem', land: 'manhattan', z: [-2200, -1460], x: [-600, 600], type: 'mid', h: [18, 44], pal: 1 },
    { id: 'uws', name: 'Upper West Side', land: 'manhattan', z: [-1460, -700], x: [-600, -140], type: 'mid', h: [30, 70], pal: 2 },
    { id: 'centralpark', name: 'Central Park', land: 'manhattan', z: [-1460, -700], x: [-140, 140], type: 'park', h: [0, 0], pal: 3 },
    { id: 'ues', name: 'Upper East Side', land: 'manhattan', z: [-1460, -700], x: [140, 600], type: 'mid', h: [30, 74], pal: 2 },
    { id: 'midtownw', name: 'Hell\'s Kitchen', land: 'manhattan', z: [-700, -520], x: [-600, -180], type: 'mid', h: [24, 60], pal: 1 },
    { id: 'midtown', name: 'Midtown', land: 'manhattan', z: [-700, -180], x: [-600, 600], type: 'core', h: [60, 210], pal: 4 },
    { id: 'chelsea', name: 'Chelsea', land: 'manhattan', z: [-180, 60], x: [-600, -120], type: 'mid', h: [22, 60], pal: 2 },
    { id: 'flatiron', name: 'Flatiron District', land: 'manhattan', z: [-180, 60], x: [-120, 600], type: 'mid', h: [34, 90], pal: 5 },
    { id: 'village', name: 'Greenwich Village', land: 'manhattan', z: [60, 430], x: [-600, 120], type: 'low', h: [14, 34], pal: 6 },
    { id: 'les', name: 'Lower East Side', land: 'manhattan', z: [60, 620], x: [120, 600], type: 'low', h: [16, 38], pal: 1 },
    { id: 'soho', name: 'SoHo', land: 'manhattan', z: [430, 620], x: [-600, 120], type: 'low', h: [18, 32], pal: 6 },
    { id: 'littleitaly', name: 'Little Italy', land: 'manhattan', z: [620, 700], x: [-200, 200], type: 'low', h: [14, 28], pal: 7 },
    { id: 'chinatown', name: 'Chinatown', land: 'manhattan', z: [620, 860], x: [-600, 600], type: 'low', h: [14, 32], pal: 8 },
    { id: 'tribeca', name: 'Tribeca', land: 'manhattan', z: [700, 900], x: [-600, -200], type: 'mid', h: [24, 56], pal: 6 },
    { id: 'fidi', name: 'Financial District', land: 'manhattan', z: [860, 1240], x: [-600, 600], type: 'core', h: [70, 240], pal: 9 },
    { id: 'battery', name: 'Battery Park', land: 'manhattan', z: [1240, 1520], x: [-600, 600], type: 'park', h: [0, 0], pal: 3 },
    { id: 'brooklyn', name: 'Brooklyn', land: 'brooklyn', z: [280, 2080], x: [770, 2150], type: 'low', h: [12, 40], pal: 10 },
    { id: 'dumbo', name: 'DUMBO', land: 'brooklyn', z: [780, 1120], x: [770, 1000], type: 'mid', h: [20, 58], pal: 6 },
    { id: 'coney', name: 'Coney Island', land: 'coney', z: [2080, 2260], x: [820, 1700], type: 'beach', h: [8, 22], pal: 11 },
    { id: 'queens', name: 'Queens', land: 'queens', z: [-1500, 280], x: [770, 2500], type: 'low', h: [12, 44], pal: 10 },
    { id: 'lic', name: 'Long Island City', land: 'queens', z: [-900, -450], x: [770, 1050], type: 'mid', h: [30, 90], pal: 4 },
    { id: 'bronx', name: 'The Bronx', land: 'bronx', z: [-3500, -2560], x: [-520, 1100], type: 'low', h: [14, 40], pal: 1 },
    { id: 'statenisland', name: 'Staten Island', land: 'statenisland', z: [1450, 2500], x: [-2150, -1000], type: 'low', h: [10, 26], pal: 10 },
    { id: 'roosevelt', name: 'Roosevelt Island', land: 'roosevelt', z: [-980, -420], x: [620, 700], type: 'low', h: [16, 40], pal: 2 },
    { id: 'liberty', name: 'Liberty Island', land: 'liberty', z: [1400, 1550], x: [-980, -830], type: 'park', h: [0, 0], pal: 3 },
    { id: 'governors', name: 'Governors Island', land: 'governors', z: [1620, 1760], x: [-520, -330], type: 'park', h: [0, 0], pal: 3 },
    { id: 'jersey', name: 'New Jersey Waterfront', land: 'jersey', z: [-1600, 1400], x: [-2600, -1250], type: 'mid', h: [18, 70], pal: 2 }
  ];

  /* Palettes are stored a touch desaturated; this pushes them back toward the
     material colour so brick reads as brick under a bright midday sun. */
  function richer(pal) {
    return pal.map(function (c) {
      var m = (c[0] + c[1] + c[2]) / 3;
      return [
        Math.max(0, Math.min(1, m + (c[0] - m) * 1.45)),
        Math.max(0, Math.min(1, m + (c[1] - m) * 1.45)),
        Math.max(0, Math.min(1, m + (c[2] - m) * 1.45))
      ];
    });
  }

  P.palettes = [
    [[0.52, 0.46, 0.42], [0.44, 0.40, 0.38], [0.58, 0.52, 0.46]],   // 0 stone
    [[0.55, 0.32, 0.26], [0.47, 0.29, 0.24], [0.60, 0.38, 0.30]],   // 1 brick
    [[0.60, 0.56, 0.50], [0.52, 0.50, 0.47], [0.66, 0.62, 0.56]],   // 2 prewar limestone
    [[0.26, 0.44, 0.22], [0.30, 0.50, 0.24], [0.22, 0.38, 0.20]],   // 3 park
    [[0.32, 0.35, 0.40], [0.26, 0.30, 0.36], [0.40, 0.44, 0.50]],   // 4 midtown glass/steel
    [[0.48, 0.42, 0.38], [0.40, 0.36, 0.34], [0.55, 0.48, 0.42]],   // 5 flatiron
    [[0.46, 0.36, 0.30], [0.52, 0.42, 0.34], [0.40, 0.33, 0.29]],   // 6 cast iron
    [[0.58, 0.40, 0.32], [0.50, 0.36, 0.30], [0.62, 0.46, 0.34]],   // 7 little italy
    [[0.50, 0.34, 0.30], [0.44, 0.34, 0.32], [0.56, 0.40, 0.32]],   // 8 chinatown
    [[0.28, 0.31, 0.36], [0.34, 0.37, 0.42], [0.24, 0.27, 0.32]],   // 9 fidi
    [[0.50, 0.38, 0.32], [0.44, 0.38, 0.34], [0.56, 0.46, 0.38]],   // 10 outer borough
    [[0.62, 0.56, 0.46], [0.68, 0.62, 0.50], [0.56, 0.50, 0.44]]    // 11 boardwalk
  ].map(richer);

  P.districtAt = function (x, z) {
    var land = P.landAt(x, z);
    if (!land) return null;
    for (var i = 0; i < P.districts.length; i++) {
      var d = P.districts[i];
      if (d.land !== land) continue;
      if (x >= d.x[0] && x < d.x[1] && z >= d.z[0] && z < d.z[1]) return d;
    }
    // fall back to the borough-wide entry
    for (var j = 0; j < P.districts.length; j++) if (P.districts[j].land === land) return P.districts[j];
    return null;
  };

  /* --------------------------------------------------------------- features
   * Hand-placed landmarks. `kind` drives the geometry builder in world.js.
   */
  P.features = [
    { id: 'empire', kind: 'tower_tiered', name: 'Empire State Building', x: -130, z: -195, w: 78, d: 62, h: 330, color: [0.55, 0.52, 0.47] },
    { id: 'chrysler', kind: 'tower_spire', name: 'Chrysler Building', x: 200, z: -350, w: 52, d: 52, h: 280, color: [0.48, 0.48, 0.52] },
    { id: 'onewtc', kind: 'tower_taper', name: 'One World Trade Center', x: -300, z: 1000, w: 62, d: 62, h: 400, color: [0.40, 0.48, 0.56] },
    { id: 'rock', kind: 'tower_slab', name: 'Rockefeller Center', x: -60, z: -560, w: 96, d: 54, h: 240, color: [0.52, 0.48, 0.44] },
    { id: 'msg', kind: 'arena', name: 'Madison Square Garden', x: -300, z: -330, w: 120, d: 96, h: 42, color: [0.42, 0.42, 0.46] },
    { id: 'grandcentral', kind: 'terminal', name: 'Grand Central Terminal', x: 170, z: -430, w: 130, d: 84, h: 40, color: [0.60, 0.56, 0.48] },
    { id: 'pennstation', kind: 'terminal', name: 'Penn Station', x: -300, z: -250, w: 120, d: 70, h: 26, color: [0.46, 0.46, 0.50] },
    { id: 'timessq', kind: 'plaza_neon', name: 'Times Square', x: -30, z: -470, w: 130, d: 170, h: 0 },
    { id: 'bryant', kind: 'park_small', name: 'Bryant Park', x: -60, z: -420, w: 110, d: 66, h: 0 },
    { id: 'unionsq', kind: 'park_small', name: 'Union Square', x: -20, z: 55, w: 100, d: 70, h: 0 },
    { id: 'madisonsq', kind: 'park_small', name: 'Madison Square Park', x: -20, z: -120, w: 100, d: 70, h: 0 },
    { id: 'washsq', kind: 'park_arch', name: 'Washington Square Park', x: -140, z: 300, w: 116, d: 90, h: 0 },
    { id: 'flatironbld', kind: 'flatiron', name: 'Flatiron Building', x: -60, z: -35, w: 46, d: 62, h: 92, color: [0.50, 0.42, 0.36] },
    { id: 'statue', kind: 'statue', name: 'Statue of Liberty', x: -905, z: 1470, w: 30, d: 30, h: 92, color: [0.42, 0.66, 0.58] },
    { id: 'met', kind: 'museum', name: 'Metropolitan Museum of Art', x: 150, z: -1120, w: 130, d: 80, h: 34, color: [0.62, 0.58, 0.50] },
    { id: 'amnh', kind: 'museum', name: 'American Museum of Natural History', x: -175, z: -1180, w: 120, d: 76, h: 32, color: [0.56, 0.44, 0.38] },
    { id: 'moma', kind: 'museum', name: 'Museum of Modern Art', x: -70, z: -640, w: 70, d: 48, h: 44, color: [0.34, 0.36, 0.40] },
    { id: 'nypl', kind: 'civic', name: 'New York Public Library', x: 40, z: -420, w: 80, d: 52, h: 26, color: [0.64, 0.60, 0.52] },
    { id: 'cityhall', kind: 'civic', name: 'City Hall', x: -140, z: 880, w: 72, d: 48, h: 28, color: [0.66, 0.63, 0.56] },
    { id: 'stockexch', kind: 'civic', name: 'New York Stock Exchange', x: -60, z: 1010, w: 60, d: 44, h: 34, color: [0.62, 0.58, 0.50] },
    { id: 'yankee', kind: 'stadium', name: 'Yankee Stadium', x: 60, z: -2900, w: 190, d: 170, h: 44, color: [0.60, 0.58, 0.54] },
    { id: 'ferris', kind: 'ferris', name: 'Coney Island Wonder Wheel', x: 1100, z: 2140, w: 20, d: 20, h: 62, color: [0.85, 0.35, 0.30] },
    { id: 'jfk', kind: 'airport', name: 'JFK International Airport', x: 2150, z: 1150, w: 420, d: 300, h: 24, color: [0.52, 0.54, 0.58] },
    { id: 'lga', kind: 'airport', name: 'LaGuardia Airport', x: 1750, z: -1180, w: 300, d: 200, h: 22, color: [0.52, 0.54, 0.58] },
    { id: 'barclays', kind: 'arena', name: 'Barclays Center', x: 1080, z: 900, w: 120, d: 100, h: 38, color: [0.38, 0.30, 0.26] },
    { id: 'prospect', kind: 'park_big', name: 'Prospect Park', x: 1180, z: 1320, w: 330, d: 400, h: 0 },
    { id: 'flushing', kind: 'park_big', name: 'Flushing Meadows Park', x: 1900, z: -420, w: 300, d: 340, h: 0 },
    { id: 'highline', kind: 'elevated_park', name: 'The High Line', x: -430, z: -120, w: 22, d: 420, h: 9 },
    { id: 'pier17', kind: 'pier', name: 'South Street Seaport', x: 470, z: 960, w: 70, d: 120, h: 12, color: [0.48, 0.42, 0.36] },
    { id: 'chelseapiers', kind: 'pier', name: 'Chelsea Piers', x: -600, z: -60, w: 70, d: 160, h: 12, color: [0.46, 0.46, 0.48] }
  ];

  /* Bridges & tunnels: deck spans between two banks, with ramps. */
  P.bridges = [
    { id: 'brooklynbr', name: 'Brooklyn Bridge', x0: 480, z0: 1020, x1: 900, z1: 1080, deck: 26, towers: true, cables: true, w: 26 },
    { id: 'manhattanbr', name: 'Manhattan Bridge', x0: 480, z0: 880, x1: 900, z1: 930, deck: 30, towers: true, cables: true, w: 24 },
    { id: 'williamsburgbr', name: 'Williamsburg Bridge', x0: 500, z0: 520, x1: 920, z1: 520, deck: 28, towers: true, cables: true, w: 24 },
    { id: 'queensborobr', name: 'Queensboro Bridge', x0: 500, z0: -640, x1: 940, z1: -640, deck: 30, towers: true, cables: false, w: 24 },
    { id: 'gwb', name: 'George Washington Bridge', x0: -560, z0: -2320, x1: -1300, z1: -2320, deck: 40, towers: true, cables: true, w: 26 },
    { id: 'verrazzano', name: 'Verrazzano-Narrows Bridge', x0: -1000, z0: 1900, x1: -300, z1: 1900, deck: 44, towers: true, cables: true, w: 26 }
  ];

  /* ---------------------------------------------------------------- subway */
  /* Stations are placed on the street grid; every station is enterable. */
  P.subwayLines = [
    {
      id: '1', name: '1 · Broadway–7 Av Local', color: [0.85, 0.20, 0.18], stations: [
        ['168 St', -130, -2280], ['125 St', -130, -1780], ['96 St', -130, -1380], ['72 St', -130, -1060],
        ['Columbus Circle', -130, -740], ['Times Sq–42 St', -130, -460], ['34 St–Penn', -130, -300],
        ['14 St', -130, 20], ['Christopher St', -260, 300], ['Canal St', -260, 620], ['Chambers St', -260, 860],
        ['South Ferry', -130, 1300]
      ]
    },
    {
      id: 'A', name: 'A · 8 Av Express', color: [0.10, 0.35, 0.85], stations: [
        ['Inwood', -260, -2460], ['145 St', -260, -1940], ['125 St', -260, -1780], ['59 St–Columbus', -260, -740],
        ['42 St–Port Authority', -260, -460], ['34 St–Penn', -260, -300], ['14 St', -260, 20],
        ['W 4 St', -260, 300], ['Canal St', -260, 620], ['Fulton St', -130, 940], ['High St–Brooklyn', 900, 1060],
        ['Jay St', 1030, 1140], ['Broadway Junction', 1420, 1060], ['JFK–Howard Beach', 1940, 1140]
      ]
    },
    {
      id: '4', name: '4 · Lexington Av Express', color: [0.10, 0.55, 0.25], stations: [
        ['Woodlawn', 320, -3260], ['161 St–Yankee Stadium', 60, -2820], ['125 St', 130, -1780],
        ['86 St', 130, -1220], ['59 St', 130, -740], ['Grand Central–42 St', 130, -460],
        ['14 St–Union Sq', 130, 60], ['Brooklyn Bridge–City Hall', 0, 880], ['Wall St', 0, 1020],
        ['Borough Hall', 1030, 1060], ['Atlantic Av–Barclays', 1160, 900]
      ]
    },
    {
      id: 'L', name: 'L · 14 St–Canarsie', color: [0.55, 0.55, 0.58], stations: [
        ['8 Av–14 St', -390, 20], ['6 Av–14 St', -130, 20], ['Union Sq–14 St', 130, 20],
        ['1 Av', 390, 20], ['Bedford Av', 900, 460], ['Lorimer St', 1160, 540], ['Myrtle–Wyckoff', 1550, 780]
      ]
    },
    {
      id: '7', name: '7 · Flushing Local', color: [0.65, 0.25, 0.70], stations: [
        ['34 St–Hudson Yards', -520, -300], ['Times Sq–42 St', -130, -460], ['5 Av–Bryant Pk', 0, -460],
        ['Grand Central–42 St', 130, -460], ['Court Sq', 900, -620], ['Queensboro Plaza', 1030, -700],
        ['Jackson Hts', 1420, -860], ['Mets–Willets Point', 1810, -540], ['Flushing–Main St', 2070, -460]
      ]
    },
    {
      id: 'N', name: 'N · Broadway Express', color: [0.92, 0.70, 0.15], stations: [
        ['Astoria', 1160, -1140], ['Queensboro Plaza', 1030, -700], ['Lexington Av–59 St', 260, -740],
        ['Times Sq–42 St', -130, -460], ['Herald Sq–34 St', -130, -300], ['Union Sq–14 St', 130, 60],
        ['Canal St', 0, 620], ['DeKalb Av', 1030, 940], ['Coney Island–Stillwell Av', 1030, 2140]
      ]
    }
  ];

  /* Bus routes are lists of waypoints; buses drive them and stop at each. */
  P.busRoutes = [
    { id: 'M15', name: 'M15 · 1st/2nd Av', color: [0.30, 0.55, 0.85], pts: [[390, -1380], [390, -700], [390, -180], [390, 300], [390, 860], [260, 1240]] },
    { id: 'M42', name: 'M42 · 42nd St Crosstown', color: [0.85, 0.55, 0.25], pts: [[-520, -460], [-260, -460], [0, -460], [260, -460], [520, -460]] },
    { id: 'M5', name: 'M5 · 5th Av', color: [0.45, 0.70, 0.35], pts: [[0, -1380], [0, -700], [0, -180], [0, 300], [0, 780]] },
    { id: 'B62', name: 'B62 · Brooklyn–Queens', color: [0.70, 0.35, 0.65], pts: [[900, 1060], [900, 620], [900, 300], [1030, -140], [1030, -620]] },
    { id: 'Bx1', name: 'Bx1 · Grand Concourse', color: [0.85, 0.30, 0.30], pts: [[60, -3260], [60, -2900], [60, -2660], [-130, -2280], [-130, -1780]] }
  ];

  /* -------------------------------------------------------- POI generation */
  var NAMES = {
    restaurant: ['Nonna\'s Table', 'Blue Fig', 'Amsterdam Grill', 'Katzman\'s Deli', 'Golden Palace', 'Il Vicolo',
      'Harlem Smoke', 'The Corner Bistro', 'Rossi & Sons', 'Sakura Room', 'Little Havana', 'Brick Oven 9'],
    coffee: ['Third Rail Coffee', 'Ninth Street Espresso', 'Morning Ritual', 'Bean & Bridge', 'Uptown Roasters',
      'Cortado Club', 'The Daily Grind', 'Perk Ave'],
    grocery: ['Gristedes Market', 'Fresh Corner', 'Union Market', 'Bodega Del Sol', 'Whole Block Foods', 'Prime Grocer'],
    convenience: ['24/7 Deli', 'Corner Bodega', 'Quick Stop', 'Nite Owl Deli', 'Lucky Star Deli'],
    clothing: ['Hudson Threads', 'Canal Street Fits', 'Fifth & Fine', 'Denim Republic', 'Loft 27', 'Brooklyn Basics'],
    gym: ['Iron District Gym', 'Chelsea Strength', 'Pulse Fitness', 'The Yard', 'Uptown Athletic'],
    cinema: ['Regal Row Cinemas', 'The Paramount', 'Angelika Screens', 'Kings Theatre'],
    bowling: ['Bowlmor Lanes', 'Strike City', 'Brooklyn Bowl'],
    arcade: ['Barcade', 'Pixel Palace', 'Chinatown Fair Arcade'],
    hotel: ['The Wexford', 'Hotel Corinthia', 'The Standard Row', 'Empire Suites'],
    bar: ['The Dead Poet', 'Gramercy Tap', 'Rooftop 24', 'Bowery Electric'],
    office: ['Meridian Tower Offices', 'Harbor Capital', 'Kessler & Roe', 'Northline Media', 'Vantage Systems'],
    library: ['Jefferson Market Library', 'Mid-Manhattan Branch', 'Brooklyn Central Library', 'Bronx Reading Room'],
    school: ['P.S. 41', 'Stuyvesant High School', 'Bronx Science', 'Brooklyn Tech'],
    college: ['Hudson University', 'City College', 'Empire Institute of Art'],
    hospital: ['Bellevue Hospital', 'Mount Zion Medical', 'St. Vincent\'s', 'Kings County Hospital'],
    police: ['9th Precinct', '13th Precinct', '84th Precinct', 'Midtown South Precinct'],
    fire: ['Ladder 8', 'Engine 55', 'Squad 41'],
    museum: ['Museum of the City', 'Tenement Museum', 'Transit Museum'],
    gas: ['BP Station', 'Sunoco', 'Gulf Fuel'],
    bank: ['First Metropolitan Bank', 'Hudson Savings', 'Empire Trust'],
    laundry: ['Spin Cycle Laundromat', 'Soap Box Wash'],
    barber: ['Astor Place Barbers', 'Sharp Line Cuts'],
    pharmacy: ['Duane Pharmacy', 'Rite Care Drugs'],
    pizza: ['Joe\'s Slice', '99¢ Fresh Pizza', 'Grimaldi\'s Corner']
  };

  P.CATEGORY = {
    restaurant: { label: 'Restaurant', icon: '🍽️', enterable: true, interior: 'restaurant', open: [11 * 60, 23 * 60] },
    pizza: { label: 'Pizza', icon: '🍕', enterable: true, interior: 'restaurant', open: [10 * 60, 26 * 60] },
    coffee: { label: 'Coffee Shop', icon: '☕', enterable: true, interior: 'coffee', open: [6 * 60, 20 * 60] },
    grocery: { label: 'Grocery Store', icon: '🛒', enterable: true, interior: 'store', open: [7 * 60, 22 * 60] },
    convenience: { label: 'Convenience Store', icon: '🏪', enterable: true, interior: 'store', open: [0, 1440] },
    clothing: { label: 'Clothing Store', icon: '👕', enterable: true, interior: 'store', open: [10 * 60, 21 * 60] },
    gym: { label: 'Gym', icon: '🏋️', enterable: true, interior: 'gym', open: [5 * 60, 23 * 60] },
    cinema: { label: 'Movie Theater', icon: '🎬', enterable: true, interior: 'cinema', open: [12 * 60, 25 * 60] },
    bowling: { label: 'Bowling Alley', icon: '🎳', enterable: true, interior: 'bowling', open: [12 * 60, 25 * 60] },
    arcade: { label: 'Arcade', icon: '🕹️', enterable: true, interior: 'arcade', open: [11 * 60, 24 * 60] },
    hotel: { label: 'Hotel', icon: '🛎️', enterable: true, interior: 'hotel', open: [0, 1440] },
    bar: { label: 'Bar', icon: '🍸', enterable: true, interior: 'bar', open: [16 * 60, 28 * 60] },
    office: { label: 'Office Building', icon: '🏢', enterable: true, interior: 'office', open: [7 * 60, 21 * 60] },
    library: { label: 'Library', icon: '📚', enterable: true, interior: 'library', open: [9 * 60, 20 * 60] },
    school: { label: 'School', icon: '🏫', enterable: true, interior: 'school', open: [7 * 60, 17 * 60] },
    college: { label: 'College', icon: '🎓', enterable: true, interior: 'school', open: [8 * 60, 22 * 60] },
    hospital: { label: 'Hospital', icon: '🏥', enterable: true, interior: 'hospital', open: [0, 1440] },
    police: { label: 'Police Station', icon: '🚓', enterable: true, interior: 'police', open: [0, 1440] },
    fire: { label: 'Fire Station', icon: '🚒', enterable: true, interior: 'fire', open: [0, 1440] },
    museum: { label: 'Museum', icon: '🖼️', enterable: true, interior: 'museum', open: [10 * 60, 18 * 60] },
    gas: { label: 'Gas Station', icon: '⛽', enterable: false, open: [0, 1440] },
    bank: { label: 'Bank / ATM', icon: '🏧', enterable: true, interior: 'bank', open: [9 * 60, 17 * 60] },
    laundry: { label: 'Laundromat', icon: '🧺', enterable: true, interior: 'store', open: [7 * 60, 22 * 60] },
    barber: { label: 'Barber', icon: '💈', enterable: true, interior: 'store', open: [9 * 60, 19 * 60] },
    pharmacy: { label: 'Pharmacy', icon: '💊', enterable: true, interior: 'store', open: [8 * 60, 22 * 60] },
    apartment: { label: 'Apartment Building', icon: '🏠', enterable: true, interior: 'apartment', open: [0, 1440] },
    subway: { label: 'Subway Station', icon: '🚇', enterable: true, interior: 'subway', open: [0, 1440] },
    busstop: { label: 'Bus Stop', icon: '🚌', enterable: false, open: [0, 1440] },
    taxistand: { label: 'Taxi Stand', icon: '🚕', enterable: false, open: [0, 1440] },
    park: { label: 'Park', icon: '🌳', enterable: false, open: [0, 1440] },
    basketball: { label: 'Basketball Court', icon: '🏀', enterable: false, open: [0, 1440] },
    soccer: { label: 'Soccer Field', icon: '⚽', enterable: false, open: [0, 1440] },
    landmark: { label: 'Landmark', icon: '📍', enterable: false, open: [0, 1440] },
    airport: { label: 'Airport', icon: '✈️', enterable: true, interior: 'airport', open: [0, 1440] },
    stadium: { label: 'Stadium', icon: '🏟️', enterable: false, open: [0, 1440] },
    pier: { label: 'Waterfront', icon: '⚓', enterable: false, open: [0, 1440] },
    home: { label: 'Home', icon: '🛏️', enterable: true, interior: 'apartment', open: [0, 1440] }
  };

  P.pois = [];
  P.byId = {};

  function addPOI(o) {
    if (P.byId[o.id]) return P.byId[o.id];
    var cat = P.CATEGORY[o.cat] || P.CATEGORY.landmark;
    o.label = cat.label;
    o.icon = o.icon || cat.icon;
    o.enterable = o.enterable !== undefined ? o.enterable : cat.enterable;
    o.interior = o.interior || cat.interior || null;
    o.open = o.open || cat.open;
    P.pois.push(o); P.byId[o.id] = o;
    return o;
  }
  P.addPOI = addPOI;

  P.isOpen = function (poi, minutes) {
    if (!poi.open) return true;
    var o = poi.open[0], c = poi.open[1];
    var m = ((minutes % 1440) + 1440) % 1440;
    if (c > 1440) return (m >= o) || (m <= (c - 1440));
    return m >= o && m <= c;
  };

  /* Snap a position onto the block face beside the nearest street, so that
     storefronts stand against a building and their door opens onto the
     sidewalk instead of floating in the middle of a roadway.
     `face` is the direction the entrance looks toward (+1 = south, -1 = north). */
  P.snapToSidewalk = function (x, z) {
    var j = Math.round(z / P.ST);
    var north = z < j * P.ST;
    var fz = j * P.ST + (north ? -(P.ST_HALF - 0.7) : (P.ST_HALF - 0.7));
    var ai = Math.round(x / P.AVE);
    var dx = x - ai * P.AVE;
    var clear = P.AVE_HALF + 9;               // stay clear of the intersection
    if (Math.abs(dx) < clear) x = ai * P.AVE + (dx >= 0 ? clear : -clear);
    return { x: x, z: fz, face: north ? 1 : -1 };
  };

  P.init = function () {
    if (P.pois.length) return;
    var rnd = T10.rng(20250908);

    // Player's home — Greenwich Village walk-up
    var homeSpot = P.snapToSidewalk(-195, 220);
    addPOI({
      id: 'apt_home', cat: 'home', name: 'Your Apartment', x: homeSpot.x, z: homeSpot.z, face: homeSpot.face,
      district: 'Greenwich Village', interior: 'apartment_home', icon: '🛏️'
    });

    // Named landmarks from features
    for (var i = 0; i < P.features.length; i++) {
      var f = P.features[i];
      var cat = 'landmark';
      if (f.kind === 'museum') cat = 'museum';
      else if (f.kind === 'airport') cat = 'airport';
      else if (f.kind === 'stadium' || f.kind === 'arena') cat = 'stadium';
      else if (f.kind === 'park_big' || f.kind === 'park_small' || f.kind === 'park_arch') cat = 'park';
      else if (f.kind === 'pier') cat = 'pier';
      var d = P.districtAt(f.x, f.z);
      addPOI({
        id: f.id, cat: cat, name: f.name, x: f.x, z: f.z,
        district: d ? d.name : '', feature: f.kind,
        enterable: (cat === 'museum' || cat === 'airport'),
        interior: cat === 'museum' ? 'museum' : (cat === 'airport' ? 'airport' : null)
      });
    }
    addPOI({ id: 'centralpark_poi', cat: 'park', name: 'Central Park', x: 0, z: -1080, district: 'Central Park' });
    addPOI({ id: 'fifthave', cat: 'landmark', name: 'Fifth Avenue', x: 0, z: -700, district: 'Midtown' });
    addPOI({ id: 'broadway', cat: 'landmark', name: 'Broadway', x: -130, z: -560, district: 'Midtown' });
    addPOI({ id: 'wallst', cat: 'landmark', name: 'Wall Street', x: 0, z: 1020, district: 'Financial District' });
    addPOI({ id: 'hudsonwf', cat: 'pier', name: 'Hudson River Waterfront', x: -600, z: -300, district: 'Chelsea' });
    addPOI({ id: 'eastwf', cat: 'pier', name: 'East River Waterfront', x: 560, z: 300, district: 'Lower East Side' });
    // stand at mid-span, clear of the towers
    addPOI({ id: 'brooklynbr_poi', cat: 'landmark', name: 'Brooklyn Bridge', x: 690, z: 1050, district: 'East River' });
    addPOI({ id: 'manhattanbr_poi', cat: 'landmark', name: 'Manhattan Bridge', x: 690, z: 905, district: 'East River' });
    for (var bi = 0; bi < P.bridges.length; bi++) {
      var br = P.bridges[bi];
      if (P.byId[br.id + '_poi']) continue;
      addPOI({ id: br.id + '_poi', cat: 'landmark', name: br.name, x: (br.x0 + br.x1) / 2, z: (br.z0 + br.z1) / 2, district: '' });
    }

    // Subway stations
    for (var li = 0; li < P.subwayLines.length; li++) {
      var line = P.subwayLines[li];
      for (var si = 0; si < line.stations.length; si++) {
        var st = line.stations[si];
        var sid = 'sub_' + (st[0] + '_' + st[1] + '_' + st[2]).replace(/[^A-Za-z0-9]+/g, '_').toLowerCase();
        var existing = P.byId[sid];
        if (existing) { if (existing.lines.indexOf(line.id) < 0) existing.lines.push(line.id); continue; }
        var dd = P.districtAt(st[1], st[2]);
        var ssp = P.snapToSidewalk(st[1] + 26, st[2]);
        addPOI({
          id: sid, cat: 'subway', name: st[0] + ' Station', short: st[0],
          x: ssp.x, z: ssp.z, face: ssp.face,
          district: dd ? dd.name : '', lines: [line.id], interior: 'subway'
        });
      }
    }

    // Bus stops
    for (var ri = 0; ri < P.busRoutes.length; ri++) {
      var rt = P.busRoutes[ri];
      for (var pi = 0; pi < rt.pts.length; pi++) {
        var bp = rt.pts[pi];
        var bid = 'bus_' + rt.id + '_' + pi;
        var bd = P.districtAt(bp[0], bp[1]);
        var bsp = P.snapToSidewalk(bp[0] + 18, bp[1] + 6);
        addPOI({ id: bid, cat: 'busstop', name: rt.id + ' Bus Stop', x: bsp.x, z: bsp.z, face: bsp.face,
          district: bd ? bd.name : '', route: rt.id });
      }
    }

    // Businesses: seeded per district so the mix feels right for the neighborhood
    var mixes = {
      core: ['office', 'coffee', 'restaurant', 'hotel', 'bank', 'clothing', 'pharmacy', 'office', 'restaurant', 'bar'],
      mid: ['restaurant', 'coffee', 'grocery', 'clothing', 'gym', 'apartment', 'bank', 'pizza', 'convenience', 'laundry'],
      low: ['pizza', 'coffee', 'convenience', 'restaurant', 'bar', 'apartment', 'barber', 'laundry', 'grocery', 'arcade'],
      industrial: ['convenience', 'gas', 'office'],
      beach: ['pizza', 'arcade', 'convenience', 'bar'],
      park: [],
      airport: []
    };
    var counts = { core: 26, mid: 22, low: 20, beach: 10, industrial: 6, park: 0, airport: 0 };

    for (var di = 0; di < P.districts.length; di++) {
      var dist = P.districts[di];
      var mix = mixes[dist.type] || mixes.mid;
      if (!mix.length) continue;
      var n = counts[dist.type] || 14;
      if (dist.id === 'jersey') n = 6;
      for (var q = 0; q < n; q++) {
        var px = rnd.range(dist.x[0] + 30, dist.x[1] - 30);
        var pz = rnd.range(dist.z[0] + 30, dist.z[1] - 30);
        if (P.landAt(px, pz) !== dist.land) continue;
        var cat2 = rnd.pick(mix);
        var pool = NAMES[cat2] || ['Corner Shop'];
        var nm = pool[rnd.int(0, pool.length - 1)];
        var id = cat2 + '_' + dist.id + '_' + q;
        var sn = P.snapToSidewalk(px, pz);
        if (P.landAt(sn.x, sn.z) !== dist.land) continue;
        addPOI({
          id: id, cat: cat2, name: nm, x: sn.x, z: sn.z, face: sn.face, district: dist.name,
          seed: rnd.int(1, 99999), quality: rnd.int(1, 3)
        });
      }
    }

    // Guarantee coverage of every category people will ask for
    var mustHave = {
      hospital: [[-330, -180], [1300, 780], [1550, -700], [300, -2740]],
      police: [[190, 250], [-70, -180], [1160, 700], [1420, -540]],
      fire: [[-390, 60], [320, -860], [1030, 1220]],
      library: [[40, -420], [-260, 300], [1290, 940], [190, -2660]],
      school: [[-460, 380], [260, -1220], [1160, 460], [1680, -300]],
      college: [[-260, 220], [-390, -1300], [1290, 620]],
      cinema: [[-260, -460], [190, -940], [1160, 1060]],
      bowling: [[-330, 140], [1290, 1140]],
      arcade: [[-70, 700], [1100, 2140]],
      gym: [[-390, -60], [260, -1060], [1030, 780], [-195, 140]],
      gas: [[-520, 460], [1420, 220], [1810, -940], [-1680, 1860]],
      hotel: [[-70, -380], [130, -620], [-330, 940]],
      grocery: [[-260, 140], [320, -1060], [1030, 620]],
      museum: [[-70, -640]],
      basketball: [[-70, -1000], [1160, 1240], [450, 380], [190, -2700]],
      soccer: [[70, -1240], [1880, -420], [1290, 1400]],
      taxistand: [[-130, -460], [130, -430], [-300, -300], [-130, 1300], [1030, 900]],
      park: [[-20, 55], [-140, 300], [-60, -420], [-20, -120], [1180, 1320], [-905, 1470]]
    };
    var mustNames = {
      hospital: ['Bellevue Hospital', 'Kings County Hospital', 'Elmhurst General', 'Bronx Care Center'],
      police: ['9th Precinct', 'Midtown South Precinct', '84th Precinct', '110th Precinct'],
      fire: ['Ladder 8 Firehouse', 'Engine 55 Firehouse', 'Squad 41 Firehouse'],
      library: ['New York Public Library', 'Jefferson Market Library', 'Brooklyn Central Library', 'Bronx Reading Room'],
      school: ['P.S. 41', 'Stuyvesant High School', 'Brooklyn Tech', 'Newtown High School'],
      college: ['Hudson University', 'Columbia Heights College', 'City Tech'],
      cinema: ['Regal Times Square', 'Lincoln Screens', 'Kings Theatre'],
      bowling: ['Bowlmor Lanes', 'Brooklyn Bowl'],
      arcade: ['Chinatown Fair Arcade', 'Coney Pixel Palace'],
      gym: ['Chelsea Strength', 'Uptown Athletic', 'The Yard Brooklyn', 'Village Fitness'],
      gas: ['Hudson Gulf Station', 'Queens Sunoco', 'Astoria BP', 'Island Fuel'],
      hotel: ['The Wexford Hotel', 'Hotel Corinthia', 'Seaport Suites'],
      grocery: ['Union Market', 'Gristedes Uptown', 'Fresh Corner Brooklyn'],
      museum: ['Museum of Modern Art'],
      basketball: ['Central Park Courts', 'Prospect Park Courts', 'LES Cage Courts', 'Bronx Playground Courts'],
      soccer: ['Great Lawn Pitch', 'Flushing Meadows Pitch', 'Prospect Park Pitch'],
      taxistand: ['Times Sq Taxi Stand', 'Grand Central Taxi Stand', 'Penn Station Taxi Stand', 'Battery Taxi Stand', 'Barclays Taxi Stand'],
      park: ['Union Square', 'Washington Square Park', 'Bryant Park', 'Madison Square Park', 'Prospect Park', 'Liberty Island']
    };
    for (var cat3 in mustHave) {
      var spots = mustHave[cat3];
      for (var s2 = 0; s2 < spots.length; s2++) {
        var sp = spots[s2];
        var d2 = P.districtAt(sp[0], sp[1]);
        var nm2 = (mustNames[cat3] && mustNames[cat3][s2]) || (P.CATEGORY[cat3].label);
        var pid = cat3 + '_key_' + s2;
        if (P.byId[pid]) continue;
        var openAir = ['basketball', 'soccer', 'gas', 'park', 'taxistand'].indexOf(cat3) >= 0;
        var loc = openAir ? { x: sp[0], z: sp[1], face: -1 } : P.snapToSidewalk(sp[0], sp[1]);
        addPOI({ id: pid, cat: cat3, name: nm2, x: loc.x, z: loc.z, face: loc.face,
          district: d2 ? d2.name : '', key: true, seed: 1000 + s2, openAir: openAir });
      }
    }

    P.pois.sort(function (a, b) { return a.name.localeCompare(b.name); });
  };

  /* --------------------------------------------------------------- queries */
  P.nearest = function (cat, x, z, filter) {
    var best = null, bd = Infinity;
    for (var i = 0; i < P.pois.length; i++) {
      var p = P.pois[i];
      if (cat && p.cat !== cat) continue;
      if (filter && !filter(p)) continue;
      var d = M.dist2(x, z, p.x, p.z);
      if (d < bd) { bd = d; best = p; }
    }
    return best ? { poi: best, dist: Math.sqrt(bd) } : null;
  };

  P.nearestAny = function (x, z, radius, filter) {
    var best = null, bd = radius * radius;
    for (var i = 0; i < P.pois.length; i++) {
      var p = P.pois[i];
      if (filter && !filter(p)) continue;
      var d = M.dist2(x, z, p.x, p.z);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  };

  P.within = function (x, z, radius, filter) {
    var out = [], r2 = radius * radius;
    for (var i = 0; i < P.pois.length; i++) {
      var p = P.pois[i];
      if (filter && !filter(p)) continue;
      if (M.dist2(x, z, p.x, p.z) <= r2) out.push(p);
    }
    return out;
  };

  /* Fuzzy text search used by the map and the T10 command parser. */
  var STOP = { the: 1, a: 1, an: 1, of: 1, in: 1, at: 1, to: 1, on: 1, my: 1, me: 1, and: 1, for: 1, some: 1, near: 1, that: 1, this: 1 };
  P.search = function (q) {
    q = (q || '').toLowerCase().trim().replace(/^(the|a|an)\s+/, '');
    if (!q) return [];
    var words = q.split(/\s+/);
    var scored = [];
    for (var i = 0; i < P.pois.length; i++) {
      var p = P.pois[i];
      var hay = (p.name + ' ' + (p.district || '') + ' ' + p.label + ' ' + p.cat).toLowerCase();
      var score = 0;
      if (hay.indexOf(q) >= 0) score += 10;
      if (p.name.toLowerCase() === q) score += 25;
      if (p.name.toLowerCase().indexOf(q) === 0) score += 8;
      for (var w = 0; w < words.length; w++) {
        if (words[w].length < 3 || STOP[words[w]]) continue;
        if (hay.indexOf(words[w]) >= 0) score += 3;
      }
      // prefer the shorter, more exact name when scores are otherwise equal
      score -= Math.min(2, p.name.length / 40);
      if (score > 0) scored.push({ poi: p, score: score });
    }
    scored.sort(function (a, b) { return b.score - a.score; });
    return scored.slice(0, 12).map(function (s) { return s.poi; });
  };

  P.categoryFromWords = function (q) {
    q = (q || '').toLowerCase();
    var map = {
      restaurant: ['restaurant', 'food', 'eat', 'dinner', 'lunch', 'diner', 'place to eat'],
      pizza: ['pizza', 'slice'],
      coffee: ['coffee', 'cafe', 'espresso', 'latte'],
      grocery: ['grocery', 'groceries', 'supermarket', 'market'],
      convenience: ['bodega', 'convenience', 'deli'],
      clothing: ['clothing', 'clothes', 'shop', 'shopping', 'store', 'outfit store'],
      gym: ['gym', 'workout', 'fitness', 'weights'],
      cinema: ['movie', 'movies', 'cinema', 'theater', 'theatre', 'film'],
      bowling: ['bowling', 'bowl', 'lanes'],
      arcade: ['arcade', 'games'],
      hotel: ['hotel', 'motel'],
      bar: ['bar', 'pub', 'drinks', 'cocktail'],
      library: ['library', 'books'],
      hospital: ['hospital', 'doctor', 'emergency', 'clinic'],
      police: ['police', 'precinct', 'cops'],
      fire: ['fire station', 'firehouse', 'firefighters'],
      museum: ['museum', 'gallery', 'art'],
      bank: ['atm', 'bank', 'cash machine'],
      subway: ['subway', 'train', 'metro', 'station'],
      busstop: ['bus', 'bus stop'],
      taxistand: ['taxi', 'cab', 'taxi stand'],
      park: ['park', 'green', 'grass'],
      basketball: ['basketball', 'hoops', 'court'],
      soccer: ['soccer', 'football pitch', 'field'],
      school: ['school'],
      college: ['college', 'university', 'campus'],
      gas: ['gas', 'gas station', 'fuel'],
      pharmacy: ['pharmacy', 'drugstore'],
      office: ['office'],
      airport: ['airport', 'flight', 'terminal'],
      home: ['home', 'apartment', 'my place', 'my apartment']
    };
    var best = null, bestLen = 0;
    for (var c in map) {
      var kws = map[c];
      for (var i = 0; i < kws.length; i++) {
        if (q.indexOf(kws[i]) >= 0 && kws[i].length > bestLen) { best = c; bestLen = kws[i].length; }
      }
    }
    return best;
  };

})(typeof window !== 'undefined' ? window : globalThis);
