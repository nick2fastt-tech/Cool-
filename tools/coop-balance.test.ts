import { describe, expect, it } from 'vitest';
import { CrewAI } from '../src/mp/crewAI';
import { MatchSim } from '../src/mp/matchSim';

/**
 * Co-op difficulty sweep.
 *
 * A crew of three AI teammates plus one idle guard, played out on fixed seeds
 * at several aggression settings. It exists because the default lobby setting
 * was once lethal enough to end a match in sixty seconds and nothing caught
 * it: the browser tests all ran with aggression forced to 1.
 *
 * The bots double as the measuring instrument here. They are not as good as a
 * competent human, so treat these numbers as a floor, not a target.
 */

const SEEDS = [7, 42, 99, 777];
const STEP = 1 / 30;

interface Result {
  survivedSeconds: number;
  firstCasualty: number;
  botsDown: number;
  humanAlive: boolean;
  restoredPower: boolean;
}

function playMatch(aiLevel: number, seed: number, options: { startPower?: number } = {}): Result {
  const sim = new MatchSim({
    seed,
    difficulty: 'standard',
    aiLevel,
    ...(options.startPower !== undefined ? { startPower: options.startPower } : {}),
    players: [{ id: 'human0', name: 'GUARD' }],
  });
  const ids = ['bot-0', 'bot-1', 'bot-2'];
  ids.forEach((id, i) => sim.addPlayer(id, `CREW${i}`, true));
  let random = seed;
  const crew = new CrewAI(sim, ids, () => {
    random = (random * 1103515245 + 12345) & 0x7fffffff;
    return random / 0x7fffffff;
  });

  let firstCasualty = -1;
  let restoredPower = false;
  let sawBlackout = false;
  for (let t = 0; t < 30 * 400 && !sim.finished; t++) {
    crew.step(STEP);
    sim.step(STEP);
    if (sim.blackout) sawBlackout = true;
    if (sawBlackout && !sim.blackout) restoredPower = true;
    if (firstCasualty < 0 && [...sim.players.values()].some((p) => p.isBot && p.status !== 'alive')) {
      firstCasualty = t / 30;
    }
  }
  return {
    survivedSeconds: sim.elapsed,
    firstCasualty,
    botsDown: [...sim.players.values()].filter((p) => p.isBot && p.status !== 'alive').length,
    humanAlive: sim.players.get('human0')!.status === 'alive',
    restoredPower,
  };
}

function average(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

describe('co-op difficulty', () => {
  const at = (aiLevel: number) => SEEDS.map((seed) => playMatch(aiLevel, seed));

  it('prints the curve', () => {
    const rows = [6, 10, 14, 20].map((aiLevel) => {
      const runs = at(aiLevel);
      return `aggression ${String(aiLevel).padStart(2)}  match ${average(runs.map((r) => r.survivedSeconds)).toFixed(0).padStart(3)}s` +
        `  first casualty ${average(runs.map((r) => (r.firstCasualty < 0 ? 400 : r.firstCasualty))).toFixed(0).padStart(3)}s` +
        `  crew down ${average(runs.map((r) => r.botsDown)).toFixed(1)}/3` +
        `  guard survived ${runs.filter((r) => r.humanAlive).length}/${runs.length}`;
    });
    console.log('\n' + rows.join('\n'));
    expect(rows).toHaveLength(4);
  }, 180000);

  it('a gentle lobby is actually playable', () => {
    const runs = at(6);
    // Nobody should be hunted down in the first minute at the low end.
    expect(Math.min(...runs.map((r) => (r.firstCasualty < 0 ? 400 : r.firstCasualty)))).toBeGreaterThan(60);
    // And the shift should mostly run its length.
    expect(average(runs.map((r) => r.survivedSeconds))).toBeGreaterThan(240);
  }, 120000);

  it('the default lobby is tense rather than instant', () => {
    const runs = at(10);
    // The regression this exists to prevent: the default setting once ended
    // matches in about sixty seconds, with the first guard caught at twelve.
    expect(Math.min(...runs.map((r) => (r.firstCasualty < 0 ? 400 : r.firstCasualty)))).toBeGreaterThan(45);
    expect(average(runs.map((r) => r.survivedSeconds))).toBeGreaterThan(150);
  }, 120000);

  it('the top of the dial is meaningfully worse than the bottom', () => {
    const gentle = average(at(6).map((r) => r.survivedSeconds));
    const nasty = average(at(20).map((r) => r.survivedSeconds));
    expect(nasty).toBeLessThan(gentle * 0.8);
  }, 180000);

  it('an AI crew can restore the grid when the lights go out', () => {
    // Straight into a blackout, with nobody but the crew to fix it.
    const runs = SEEDS.map((seed) => playMatch(1, seed, { startPower: 1 }));
    expect(runs.filter((r) => r.restoredPower).length).toBeGreaterThanOrEqual(3);
  }, 120000);
});
