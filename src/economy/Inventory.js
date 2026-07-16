/**
 * Inventory.js
 * ------------
 * Owned cosmetic items + equipped loadout, backed by the shop catalogue. Items
 * are pure data (id, category, name, price, and the avatar fields they apply).
 * Equipping an item writes the relevant fields into GameState.avatar so the
 * change persists and reflects on the live character.
 */

import { GameState } from '../core/GameState.js';
import { bus } from '../core/EventBus.js';

/**
 * The shop / cosmetic catalogue. Categories map onto avatar slots.
 * `apply` is the avatar patch produced when the item is equipped.
 */
export const CATALOGUE = [
  // Faces
  { id: 'face_smile', cat: 'face', name: 'Smile', price: 0, apply: { face: 'smile' } },
  { id: 'face_cool', cat: 'face', name: 'Cool', price: 0, apply: { face: 'cool' } },
  { id: 'face_neutral', cat: 'face', name: 'Neutral', price: 50, apply: { face: 'neutral' } },
  // Hair colours
  { id: 'hair_black', cat: 'hair', name: 'Black Hair', price: 0, apply: { hair: 0x2b1d0e } },
  { id: 'hair_blonde', cat: 'hair', name: 'Blonde Hair', price: 120, apply: { hair: 0xe6c200 } },
  { id: 'hair_pink', cat: 'hair', name: 'Pink Hair', price: 200, apply: { hair: 0xff5da2 } },
  // Shirts
  { id: 'shirt_blue', cat: 'shirt', name: 'Blue Tee', price: 0, apply: { shirt: 0x3a86ff } },
  { id: 'shirt_red', cat: 'shirt', name: 'Red Tee', price: 80, apply: { shirt: 0xe63946 } },
  { id: 'shirt_gold', cat: 'shirt', name: 'Gold Tee', price: 350, apply: { shirt: 0xffd60a } },
  // Pants
  { id: 'pants_dark', cat: 'pants', name: 'Dark Jeans', price: 0, apply: { pants: 0x22223b } },
  { id: 'pants_khaki', cat: 'pants', name: 'Khaki', price: 80, apply: { pants: 0xb08968 } },
  // Hats
  { id: 'hat_cap', cat: 'hat', name: 'Baseball Cap', price: 150, apply: { hat: { type: 'cap', color: 0xff006e } } },
  { id: 'hat_top', cat: 'hat', name: 'Top Hat', price: 400, apply: { hat: { type: 'top', color: 0x111111 } } },
  { id: 'hat_none', cat: 'hat', name: 'No Hat', price: 0, apply: { hat: null } },
  // Back accessories
  { id: 'back_wings', cat: 'back', name: 'Angel Wings', price: 800, apply: { back: { type: 'wings', color: 0xffffff } } },
  { id: 'back_pack', cat: 'back', name: 'Backpack', price: 120, apply: { back: { type: 'pack', color: 0x8d5524 } } },
  { id: 'back_none', cat: 'back', name: 'Nothing', price: 0, apply: { back: null } },
];

const byId = new Map(CATALOGUE.map((i) => [i.id, i]));

export const Inventory = {
  catalogue() {
    return CATALOGUE;
  },
  item(id) {
    return byId.get(id);
  },
  owns(id) {
    const item = byId.get(id);
    // Free items are always "owned".
    return item?.price === 0 || GameState.get('inventory').owned.includes(id);
  },

  /** Grant ownership (after a purchase or reward). */
  grant(id) {
    if (this.owns(id)) return;
    const inv = GameState.get('inventory');
    GameState.patch('inventory', { owned: [...inv.owned, id] });
    bus.emit('inventory:changed');
  },

  /** Equip an owned item; applies its avatar patch. Returns {ok}. */
  equip(id) {
    const item = byId.get(id);
    if (!item) return { ok: false, reason: 'Unknown item' };
    if (!this.owns(id)) return { ok: false, reason: 'Not owned' };

    const inv = GameState.get('inventory');
    GameState.patch('inventory', { equipped: { ...inv.equipped, [item.cat]: id } });
    GameState.patch('avatar', item.apply);
    bus.emit('avatar:changed', GameState.get('avatar'));
    return { ok: true };
  },

  equippedId(cat) {
    return GameState.get('inventory').equipped[cat] || null;
  },
};
