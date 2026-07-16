# Assets

NovaVerse is intentionally **asset-free**: all characters, scenery, UI icons
(emoji), faces, clouds, and labels are generated procedurally at runtime from
Three.js primitives and canvas textures. This keeps the project copyright-clean
and tiny to ship.

## Replacing procedural art with real assets

Drop real assets here and swap the relevant builder:

| Replace | Edit |
| --- | --- |
| Character model | `src/player/Avatar.js` (`_build`) — load a GLTF instead of boxes |
| Trees / rocks / mountains / water | `src/world/Environment.js` |
| Sky / clouds | `src/graphics/Sky.js` |
| Sound effects / music | add an `AudioManager` and load from `assets/audio/` |

Recommended formats for Android: **GLB/GLTF** (Draco-compressed) for models,
**ETC2 / KTX2** for textures, **OGG** for audio. Keep textures power-of-two.

No other code needs to change — every system references avatars/scenery through
their builder modules, not hard-coded asset paths.
