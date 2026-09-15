// T10 World - shared emote table. Kept in its own module so the command
// registry files can all reference it without importing each other.
import { STATES } from '../human/animator.js';

export const EMOTES = [
  { id: 'wave', name: 'wave', state: STATES.WAVE },
  { id: 'dance', name: 'dance', state: STATES.DANCE },
  { id: 'sit', name: 'sit down', state: STATES.SIT },
  { id: 'stand', name: 'stand up', state: STATES.IDLE },
  { id: 'sleep', name: 'lie down', state: STATES.LIE },
  { id: 'crouch', name: 'crouch', state: STATES.CROUCH },
  { id: 'phone', name: 'check your phone', state: STATES.PHONE },
  { id: 'eat', name: 'eat', state: STATES.EAT },
  { id: 'exercise', name: 'do push ups', state: STATES.EXERCISE },
  { id: 'swim', name: 'swim', state: STATES.SWIM },
  { id: 'climb', name: 'climb', state: STATES.CLIMB },
  { id: 'carry', name: 'carry something', state: STATES.CARRY },
  { id: 'idle', name: 'relax', state: STATES.IDLE },
  { id: 'talk', name: 'talk', state: STATES.TALK },
  { id: 'jump', name: 'jump', state: STATES.JUMP },
];
