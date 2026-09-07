/**
 * Central tuning data for HOLLOW SHIFT.
 *
 * Everything a designer would want to rebalance lives here: room graph, AI
 * aggression tables, power economy, blackout/recovery numbers and the graphics
 * presets. No other module hard-codes a balance number.
 *
 * All characters, names and art in this project are original. The design goal
 * is mechanical fidelity to the classic "night watch" loop, not asset reuse.
 */

export type QualityPreset = 'low' | 'medium' | 'high' | 'ultra';

/* ------------------------------------------------------------------ rooms */

export const enum Room {
  Stage = 'STAGE',
  Dining = 'DINING',
  Backstage = 'BACKSTAGE',
  Cove = 'COVE',
  WestHall = 'WEST_HALL',
  WestCorner = 'WEST_CORNER',
  Supply = 'SUPPLY',
  EastHall = 'EAST_HALL',
  EastCorner = 'EAST_CORNER',
  Kitchen = 'KITCHEN',
  Restrooms = 'RESTROOMS',
  Office = 'OFFICE',
}

export interface CameraDef {
  id: string;
  label: string;
  room: Room;
  /** Kitchen has a dead lens - audio only. Keeps the map honest and tense. */
  audioOnly?: boolean;
  /** Position on the mini-map, 0..1 in both axes. */
  map: { x: number; y: number };
  /** Where the security camera sits in world space, and where it looks. */
  view: { pos: [number, number, number]; target: [number, number, number] };
}

export const CAMERAS: readonly CameraDef[] = [
  { id: 'CAM_01', label: 'Show Stage',    room: Room.Stage,      map: { x: 0.50, y: 0.08 }, view: { pos: [0, 2.9, -11.0],    target: [0, 1.4, -16.5] } },
  { id: 'CAM_02', label: 'Dining Hall',   room: Room.Dining,     map: { x: 0.50, y: 0.30 }, view: { pos: [0, 3.2, -2.5],     target: [0, 1.2, -12.0] } },
  { id: 'CAM_03', label: 'Backstage',     room: Room.Backstage,  map: { x: 0.14, y: 0.12 }, view: { pos: [-9.6, 2.4, -13.4], target: [-12.0, 1.2, -16.5] } },
  { id: 'CAM_04', label: "Crow's Nest",   room: Room.Cove,       map: { x: 0.13, y: 0.40 }, view: { pos: [-9.4, 2.5, -5.4],  target: [-12.5, 1.1, -8.5] } },
  { id: 'CAM_05', label: 'West Hall',     room: Room.WestHall,   map: { x: 0.28, y: 0.62 }, view: { pos: [-6.2, 2.4, -0.6],  target: [-6.2, 1.2, 6.5] } },
  { id: 'CAM_06', label: 'West Corner',   room: Room.WestCorner, map: { x: 0.33, y: 0.84 }, view: { pos: [-5.6, 2.3, 6.6],   target: [-3.4, 1.2, 8.6] } },
  { id: 'CAM_07', label: 'East Hall',     room: Room.EastHall,   map: { x: 0.72, y: 0.62 }, view: { pos: [6.2, 2.4, -0.6],   target: [6.2, 1.2, 6.5] } },
  { id: 'CAM_08', label: 'East Corner',   room: Room.EastCorner, map: { x: 0.67, y: 0.84 }, view: { pos: [5.6, 2.3, 6.6],    target: [3.4, 1.2, 8.6] } },
  { id: 'CAM_09', label: 'Supply Closet', room: Room.Supply,     map: { x: 0.10, y: 0.72 }, view: { pos: [-9.6, 2.2, 1.6],   target: [-12.0, 1.2, 4.5] } },
  { id: 'CAM_10', label: 'Kitchen',       room: Room.Kitchen,    audioOnly: true, map: { x: 0.89, y: 0.16 }, view: { pos: [9.6, 2.4, -10.6], target: [12.5, 1.2, -14.0] } },
  { id: 'CAM_11', label: 'Restrooms',     room: Room.Restrooms,  map: { x: 0.88, y: 0.44 }, view: { pos: [9.6, 2.4, -3.6],   target: [12.5, 1.2, -6.5] } },
] as const;

export const CAMERA_BY_ROOM: ReadonlyMap<Room, CameraDef> = new Map(
  CAMERAS.map((c) => [c.room, c] as const),
);

/* ----------------------------------------------------------- animatronics */

export type CharacterId = 'bear' | 'rabbit' | 'hen' | 'fox' | 'husk';

export interface CharacterDef {
  id: CharacterId;
  name: string;
  /** One-line in-fiction description used by the menu and the extras screen. */
  blurb: string;
  /** Seconds between movement opportunities. Distinct per character on purpose. */
  moveInterval: number;
  /** Which doorway this character attacks from. */
  side: 'left' | 'right' | 'none';
  /** Ordered path through the building; the last entry before Office is the doorway. */
  path: readonly Room[];
  /** Accent colour used for models, mini-map blips and UI. */
  color: number;
}

export const CHARACTERS: Record<CharacterId, CharacterDef> = {
  rabbit: {
    id: 'rabbit',
    name: 'Wex',
    blurb: 'The guitarist. Restless, quiet, and always on the west side.',
    moveInterval: 4.97,
    side: 'left',
    path: [Room.Stage, Room.Dining, Room.Backstage, Room.WestHall, Room.Supply, Room.WestCorner, Room.Office],
    color: 0x6f5bd8,
  },
  hen: {
    id: 'hen',
    name: 'June',
    blurb: 'Kitchen crew. You will hear her long before you see her.',
    moveInterval: 4.99,
    side: 'right',
    path: [Room.Stage, Room.Dining, Room.Restrooms, Room.Kitchen, Room.EastHall, Room.EastCorner, Room.Office],
    color: 0xd9b23a,
  },
  bear: {
    id: 'bear',
    name: 'Bramble',
    blurb: 'The headliner. He only moves when nobody is looking.',
    moveInterval: 3.02,
    side: 'right',
    path: [Room.Stage, Room.Dining, Room.Restrooms, Room.Kitchen, Room.EastHall, Room.EastCorner, Room.Office],
    color: 0x8a5a2b,
  },
  fox: {
    id: 'fox',
    name: 'Captain Sprocket',
    blurb: 'Out of order since the incident. He does not walk. He runs.',
    moveInterval: 5.01,
    side: 'left',
    path: [Room.Cove, Room.Cove, Room.Cove, Room.Cove, Room.WestHall, Room.Office],
    color: 0xb4402c,
  },
  husk: {
    id: 'husk',
    name: 'HUSK',
    blurb: 'An empty suit that should not be in the building.',
    moveInterval: 9.7,
    side: 'none',
    path: [Room.Office],
    color: 0xc8b45a,
  },
};

/* ----------------------------------------------------------------- nights */

export interface NightConfig {
  night: number;
  title: string;
  /** Difficulty word shown on the night-select card. */
  difficulty: string;
  /** Starting aggression (0-20 scale) per character. */
  ai: Record<Exclude<CharacterId, 'husk'>, number>;
  /**
   * Hours (1-5) at which each character's aggression rises by one step.
   * This is what makes 4 AM the hour everybody dreads.
   */
  escalation: Partial<Record<Exclude<CharacterId, 'husk'>, readonly number[]>>;
  /** Multiplies the base power drain. Later nights are stingier. */
  drainMultiplier: number;
  /** Chance per hour that HUSK schedules a rare apparition. 0 disables it. */
  huskChancePerHour: number;
  /** Tutorial prompts fire only on nights that ask for them. */
  tutorial?: boolean;
}

export const NIGHTS: readonly NightConfig[] = [
  {
    night: 1,
    title: 'First Shift',
    difficulty: 'Very Easy',
    ai: { rabbit: 1, hen: 0, bear: 0, fox: 0 },
    escalation: { rabbit: [3, 5] },
    drainMultiplier: 1.0,
    huskChancePerHour: 0,
    tutorial: true,
  },
  {
    night: 2,
    title: 'Settling In',
    difficulty: 'Easy',
    ai: { rabbit: 3, hen: 1, bear: 0, fox: 1 },
    escalation: { rabbit: [3], hen: [4], fox: [4] },
    drainMultiplier: 1.05,
    huskChancePerHour: 0,
  },
  {
    night: 3,
    title: 'Bad Wiring',
    difficulty: 'Medium',
    ai: { rabbit: 5, hen: 6, bear: 2, fox: 3 },
    escalation: { rabbit: [3], hen: [3], bear: [4], fox: [2, 5] },
    drainMultiplier: 1.1,
    huskChancePerHour: 0.01,
  },
  {
    night: 4,
    title: 'The Long Hour',
    difficulty: 'Hard',
    ai: { rabbit: 7, hen: 8, bear: 4, fox: 5 },
    escalation: { rabbit: [2, 4], hen: [3, 5], bear: [3, 5], fox: [3] },
    drainMultiplier: 1.14,
    huskChancePerHour: 0.02,
  },
  {
    night: 5,
    title: 'Understaffed',
    difficulty: 'Very Hard',
    ai: { rabbit: 7, hen: 8, bear: 4, fox: 6 },
    escalation: { rabbit: [2, 4], hen: [2, 4], bear: [2, 4], fox: [3, 5] },
    drainMultiplier: 1.08,
    huskChancePerHour: 0.03,
  },
  {
    night: 6,
    title: 'Overtime',
    difficulty: 'Extremely Hard',
    ai: { rabbit: 11, hen: 12, bear: 7, fox: 8 },
    escalation: { rabbit: [2, 4], hen: [2, 4], bear: [2, 3, 4], fox: [2, 4] },
    drainMultiplier: 1.05,
    huskChancePerHour: 0.06,
  },
] as const;

export const MAX_NIGHT = NIGHTS.length;

/* ------------------------------------------------------------ time & power */

export const TIME = {
  /** Real seconds per in-game hour. 60 -> a six-minute shift, right for mobile. */
  secondsPerHour: 60,
  /** "Classic" pacing option in Settings. */
  classicSecondsPerHour: 89,
  hoursPerNight: 6,
} as const;

export const POWER = {
  start: 100,
  /**
   * Percent drained per second at usage 1 (idle, monitor down, everything off).
   * At 0.095 %/s a six-minute shift costs ~34% idle, ~68% at a steady two bars
   * and slightly more than the whole grid at three - so "one system at a time"
   * is comfortable, "two systems always" is a real gamble, and camping every
   * defence at once is guaranteed to black you out before 6 AM.
   */
  drainPerUsagePerSecond: 0.095,
  /** Systems that each add one usage bar. Usage is 1 + count(active). */
  maxUsage: 5,
  /** Slamming a door costs a small one-off amount - discourages door spamming. */
  doorToggleCost: 0.12,
  /** Each blocked hit on a closed door costs the player a little power. */
  doorImpactCost: 0.9,
} as const;

/**
 * BLACKOUT AND POWER RECOVERY
 * --------------------------------------------------------------------------
 * Hitting 0% is not an instant loss and it is not a free reset either.
 *
 *  1. Everything electrical dies: doors spring open, hall lights and the
 *     monitor go dark. One battery-backed LED under the desk stays on.
 *  2. Bramble arrives in the left doorway and starts his music box. The tune
 *     runs for `tuneSeconds` (randomised). When it ends, so do you.
 *  3. Under the desk is a hand-crank breaker. Holding the crank builds charge;
 *     let go and the charge bleeds away. Cranking is LOUD - it shortens the
 *     tune and pulls the fox out of the Crow's Nest.
 *  4. Fill the charge bar and the breaker trips back in: you get a small
 *     reserve back and your doors return.
 *  5. Every blackout in the same night is harder than the last and gives back
 *     less. Recovery buys minutes, never the night.
 *
 * There is deliberately no flashlight anywhere in single player. Light always
 * costs power.
 */
export const BLACKOUT = {
  tuneSeconds: { min: 9, max: 22 },
  /** Each second of cranking removes this much from the tune timer. */
  tunePenaltyPerCrankSecond: 0.35,
  /**
   * Charge needed to trip the breaker: base * growth^(blackout index).
   * 95 / 142 / 214 / 321 / 481 - at 42 charge per second that is 2.3s, 3.4s,
   * 5.1s, 7.6s, 11.5s of continuous cranking against a 9-22s music box. The
   * first restore is a relief, the third is frantic, and the fifth is a
   * lottery ticket. Recovery is never a renewable resource.
   */
  crankTargetBase: 95,
  crankTargetGrowth: 1.5,
  /** Charge gained per second of holding the crank. */
  crankRatePerSecond: 42,
  /** Charge lost per second when not cranking. */
  crankDecayPerSecond: 16,
  /** Power handed back on a successful restore, per blackout index. */
  restorePower: [22, 14, 9, 6, 4],
  /** Cranking noise radius bonus applied to fox aggression. */
  foxNoiseBonus: 3,
} as const;

/* --------------------------------------------------------------- graphics */

export interface QualitySettings {
  pixelRatioCap: number;
  antialias: boolean;
  shadows: boolean;
  shadowMapSize: number;
  /** Extra decorative point lights beyond the two required ones. */
  extraLights: number;
  fog: boolean;
  particles: number;
  /** Camera-feed static resolution divisor; higher = cheaper. */
  staticDivisor: number;
  /** Menu scene runs its full animation set only above this tier. */
  richMenu: boolean;
}

export const QUALITY: Record<QualityPreset, QualitySettings> = {
  low:    { pixelRatioCap: 1.0, antialias: false, shadows: false, shadowMapSize: 0,    extraLights: 0, fog: false, particles: 0,   staticDivisor: 6, richMenu: false },
  medium: { pixelRatioCap: 1.5, antialias: false, shadows: false, shadowMapSize: 0,    extraLights: 2, fog: true,  particles: 40,  staticDivisor: 4, richMenu: true },
  high:   { pixelRatioCap: 2.0, antialias: true,  shadows: true,  shadowMapSize: 1024, extraLights: 4, fog: true,  particles: 90,  staticDivisor: 3, richMenu: true },
  ultra:  { pixelRatioCap: 2.5, antialias: true,  shadows: true,  shadowMapSize: 2048, extraLights: 6, fog: true,  particles: 160, staticDivisor: 2, richMenu: true },
};

export const QUALITY_ORDER: readonly QualityPreset[] = ['low', 'medium', 'high', 'ultra'];

/* ------------------------------------------------------------------- misc */

export const VENUE_NAME = "Bramble Bear's Pizza Depot";
