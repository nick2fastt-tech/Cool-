# Building for Android

NovaVerse runs as static web files inside a Capacitor Android WebView. Because
the container ships the assets locally, the app works **offline** — but that
means the CDN import of Three.js used during development must be **vendored** for
the release build.

## 1. Prerequisites

- Node.js 18+
- Android Studio + Android SDK (Platform 33+)
- JDK 17

## 2. Vendor Three.js (offline requirement)

Development uses a CDN import map in `index.html`. For a packaged app, download
Three locally and repoint the import map:

```bash
mkdir -p vendor
# Copy the ESM build + addons from your installed package (npm i three) or a CDN:
cp node_modules/three/build/three.module.js vendor/three.module.js
cp -r node_modules/three/examples/jsm vendor/jsm
```

Then edit the import map in `index.html`:

```html
<script type="importmap">
{
  "imports": {
    "three": "./vendor/three.module.js",
    "three/addons/": "./vendor/jsm/"
  }
}
</script>
```

Nothing else in the source changes — every module imports the bare specifier
`three`.

## 3. Add Capacitor + the Android platform

```bash
npm install
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap add android
npx cap sync android      # copies web assets (webDir='.') into the app
```

`capacitor.config.json` is already provided (appId `com.novaverse.sandbox`,
appName `NovaVerse`).

## 4. Point the client at your multiplayer server

Multiplayer is optional. To bake in a server, set `Config.net.serverUrl` in
`src/core/Config.js` (use `wss://` for a TLS-terminated production server), or
launch with `?server=wss://your.host`.

## 5. Build & run

```bash
npx cap open android      # opens Android Studio
# Build > Build APK(s), or Run on a connected device.
```

## Performance checklist for mid-range devices

- The engine's **adaptive quality tuner** auto-scales pixel ratio + shadows to
  hold ~60 FPS; no action needed, but you can pin quality in Settings.
- Keep textures power-of-two and compressed (ETC2) if you add real art.
- Scenery uses `InstancedMesh`; keep that pattern when adding props.
- Networking is 20 Hz with interpolation — don't raise `sendRateHz` on mobile.
- Test with Android Studio's **Profiler** (CPU/GPU/Memory) on a real device.

## Deploying the server

The server is a standard Node app (`server/`). Run it behind a TLS reverse proxy
(nginx/Caddy) so the WebView can reach `wss://`. It exposes `/health` for
readiness probes and scales horizontally by sharding rooms across instances.
