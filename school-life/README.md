# School Life — Demo V1.00

A 3D first-person school game for phones (it also runs in any desktop browser).
Built with [three.js](https://threejs.org). Every texture is drawn in code, so the only
media file is your theme song.

![Main menu](screenshots/menu.jpg)

## What's in the demo

| Feature | Details |
| --- | --- |
| **Login** | Sign up with your Gmail + a new School Life password. Your account "locks in" to that Gmail (it can't be registered twice) and stays signed in. |
| **Welcome email** | The game emails you "I hope you enjoy this game!" with a list of what's in the demo (see [Turning on real emails](#turning-on-real-emails)). |
| **Main menu** | School-themed: the 3D school behind it, the **SCHOOL LIFE** title drops in letter by letter, the buttons are already there, and your theme music plays. |
| **Play** | Pick **6th, 7th, 8th or 9th grade**. Each grade has its own 8-class schedule. |
| **Character** | Locked for now. |
| **Settings** | Graphics: **MAX** (the other levels are locked). Dynamic resolution keeps it smooth, so there's no lag. Sign out is here too. |
| **8 classes** | Homeroom, Math, English, Algebra I, Photosynthesis, Library, Auditorium, Study Hall. School starts at **8:00 AM**; classes are **30 minutes** with a 1-minute break (the bell at **8:31** starts 2nd period), and **8th period is 45 minutes**, so school lets out at **12:22 PM**. |
| **Game clock** | Starts at 8:00 AM when you press Play and goes up **1 minute every 60 seconds**. If you're not in class **15 minutes** after the bell (8:15 for 1st period), you're **late**. After school, a new day starts at 8:00 AM. |
| **6 rooms** | 101 Math · 102 Auditorium (seats + stage) · 103 Algebra I · 104 Photosynthesis · 105 English · 106 Library (seats, comfy lounges and the Principal's Office — locked). |
| **2 floors** | The grand staircase in the lobby goes up to the 2nd floor, which is still under construction. |
| **Can't leave** | All exit doors are locked during the demo. |
| **People** | Everyone is male (5'9") or female (5'3") with brown hair, a white t-shirt, jeans and black shoes. 48 students and 6 teachers; students walk to their next class when the bell rings. |
| **Controls** | Grey joystick, drag to look, **Use** button, schedule icon (top right) with the time and your class. |

### Screenshots

| | |
| --- | --- |
| ![Title animation](screenshots/title-animation.jpg) | ![Create account](screenshots/signup.jpg) |
| ![Lobby](screenshots/lobby.jpg) | ![Hallway](screenshots/corridor.jpg) |
| ![Math class](screenshots/classroom.jpg) | ![Sitting in class](screenshots/sitting-in-class.jpg) |
| ![Auditorium](screenshots/auditorium.jpg) | ![Library](screenshots/library.jpg) |
| ![Photosynthesis lab](screenshots/science-lab.jpg) | ![2nd floor under construction](screenshots/second-floor.jpg) |
| ![Schedule](screenshots/schedule.jpg) | ![Passing period](screenshots/passing-period.jpg) |

### Two choices I made (easy to change)

1. **Room numbers:** your list had two rooms numbered 102, so the rooms are 101–106 in the
   order you listed them. Change the names/numbers in [`src/config.js`](src/config.js).
2. **School hours:** seven 30-minute classes plus a 45-minute 8th period end at **12:22 PM**
   (1st period 8:00-8:30, 2nd 8:31-9:01, ... 8th 11:37-12:22). Change `SCHEDULE` in
   [`src/config.js`](src/config.js) to adjust class length, breaks or the late time.

## How to play

| Phone | Desktop |
| --- | --- |
| Grey joystick (bottom left) = walk. Push it all the way to jog. | `W A S D` or arrow keys (`Shift` to jog) |
| Drag anywhere on the screen = look around | Click + drag the mouse |
| **USE** button = open doors, sit down / stand up, read signs, drink from the fountain, browse books, play the piano | `E` |
| Schedule icon (top right) = your full schedule + Main Menu | `Q` or `Tab` |

Get to your class's room before the late time (15 minutes after the bell) and grab a seat.
When a class ends, everyone heads to their next room, and the bell rings 1 minute later to
start the next class.

## Run it

```bash
cd school-life
npm install
npm run dev        # http://localhost:5173  (accounts are saved on the device)
```

### Full version with accounts + emails (Node server)

```bash
npm run build
npm start          # http://localhost:3000
```

`npm start` serves the game **and** the account API (`server/index.js`): passwords are hashed
with scrypt, accounts are stored in `server/data/accounts.json`, and the welcome email is sent
when someone signs up.

## Turning on real emails

Pick one:

**A. Your Gmail (with the Node server)**
1. Turn on 2-Step Verification for the Gmail account that should send the emails.
2. Create an **App Password** at <https://myaccount.google.com/apppasswords>.
3. Start the server with:
   ```bash
   GMAIL_USER=you@gmail.com GMAIL_APP_PASSWORD="abcd efgh ijkl mnop" npm start
   ```
   (Any SMTP server works too: `SMTP_URL=smtps://user:pass@smtp.example.com MAIL_FROM=you@example.com`.)

Without these settings the server still works; it just saves each email to `server/outbox/`
so you can open it and see what players would get.

**B. Static hosting (GitHub Pages, no server) with EmailJS**
1. Make a free account at <https://www.emailjs.com>, add your Gmail as an email service, and
   create a template whose **To Email** is `{{to_email}}`, subject `{{subject}}` and content
   `{{{message_html}}}`.
2. Put the three IDs in `EMAIL_CONFIG` in [`src/config.js`](src/config.js) and rebuild.

When neither is set up (e.g. on GitHub Pages), the game shows the welcome letter on screen
instead, so players still see it.

## Put it on your phone

* **One file:** [`release/School-Life-V1.00.html`](release/School-Life-V1.00.html) has the whole
  game inside it (code, fonts, icon and your theme song). Open it in a browser or send it to your
  phone. Accounts are saved on that device. Rebuild it with `npm run build:html`.
* **Same Wi-Fi:** run `npm run dev` and open the "Network" address it prints on your phone.
* **Online:** deploy the `dist/` folder anywhere (GitHub Pages, Netlify...) or run the Node
  server on a host with a persistent disk (Render, Railway, Fly.io, a VPS). Set `DATA_DIR` to a
  folder that survives restarts so accounts aren't lost.
* **GitHub Pages:** copy [`docs/deploy-pages.yml`](docs/deploy-pages.yml) to
  `.github/workflows/` in the repo, then in **Settings → Pages** choose **GitHub Actions** and
  run the workflow.
* **Install it like an app:** open the game in Chrome (Android) or Safari (iPhone) and choose
  **Add to Home Screen**. It opens full screen in landscape and works offline after the first
  visit.

## Tests

```bash
npm test                                  # schedule, password hashing, server + email
node tests/e2e/shots.cjs                  # menus walkthrough (needs `npm run dev` running)
node tests/e2e/play-shots.cjs             # in-game walkthrough
node tests/e2e/mechanics.cjs              # joystick, look, walls, doors, stairs, sitting (real touch input)
node tests/e2e/route-check.cjs            # students reach their seats after every bell
node tests/e2e/clock-check.cjs            # 8:00 start, +1 min per minute, late at 8:15, bell at 8:31, out at 12:22
```

The browser tests fail if the page logs any error or warning.

## Project layout

```
school-life/
  index.html, public/          app shell, theme music, icons, manifest, service worker
  src/config.js                rooms, schedules, heights, welcome email text
  src/main.js                  startup flow
  src/core/                    schedule (real clock), accounts, password hashing, audio
  src/ui/                      menus, HUD, icons, styles
  src/engine/                  renderer, procedural textures, materials, geometry batching, physics, sky
  src/world/                   floor plan, building, rooms, furniture, outdoors, doors, clocks
  src/game/                    player, input, interactions, students + teachers, play session
  server/                      Node server: static files + account API + welcome email
  tests/                       unit tests and browser walkthroughs
```

## Credits

* Theme music: "School Life" by Nick.
* [three.js](https://github.com/mrdoob/three.js) (MIT license).
* Fonts via [Fontsource](https://fontsource.org): Luckiest Guy, Fredoka, Patrick Hand (SIL Open Font License).
* [Nodemailer](https://nodemailer.com) (MIT-0 license) for the welcome email.
