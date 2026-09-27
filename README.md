# 🍅 Bbomodoro

A pixel tomato focus timer with a retro-game look.
Pick 1, 2, or 3 hours and the pale tomato **turns red one pixel at a time** until it is fully ripe when your time is up.

- **Lightweight**: Windows exe **2.4MB**, macOS app **about 1.8MB** compressed (it uses the OS's built-in webview, no Electron)
- **Windows and macOS**: one codebase ([Neutralinojs](https://neutralino.js.org))
- **Offline**: no network needed, and all data is stored on your own computer

## ⬇️ Download

| OS | File | Size |
|---|---|---|
| Windows 10/11 | [**Bbomodoro-Windows.exe**](https://github.com/gatsjy/bbomodoro/releases/latest/download/Bbomodoro-Windows.exe) | 2.4MB |
| macOS (Intel · Apple Silicon) | [**Bbomodoro-macOS.tar.gz**](https://github.com/gatsjy/bbomodoro/releases/latest/download/Bbomodoro-macOS.tar.gz) | 1.8MB |

All versions are on the [Releases](https://github.com/gatsjy/bbomodoro/releases) page. If you see a security warning on first launch, see [Running it](#running-it).

---

## Features

### 1. Choose 1, 2, or 3 hours
- Choose your goal with the `1H` / `2H` / `3H` buttons.
- While the timer runs (or is paused), the goal is **LOCKED** so it can't change by accident. Press RESET to change it.

### 2. Pixel tomato that ripens over time
- The tomato is made of **670 pixels**. Pixels turn from pale to red one by one **from the bottom up**, as if the tomato were ripening.
  - Examples: 1 hour ≈ one pixel every 5.4s, 3 hours ≈ one pixel every 16s
- Each newly colored pixel **flashes gold and white**.
- The status line shows the colored pixel count and the percentage (`342/670 PX 51%`).
- The tomato's expression changes with its state:

| State | Expression / effect |
|---|---|
| Waiting | Blinks now and then, "HI!" speech bubble |
| Focusing | Bounces up and down, blinks |
| Paused | Eyes closed, sleeping with 💤 ZZZ |
| Left the window in focus mode | Sad face + 💧 sweat drop, "COME BACK!" |
| Done | ^ ^ smiling eyes + 👑 crown + sparkles |
| Clicking the tomato | Hops and says something ("HEHE", "FOCUS!"...) |

### 3. Hourly checkpoints
- Small tomato slots appear at the top, one per goal hour (up to 3).
- Every hour, a slot **pops and gets a ✔ check**, with a sound effect and an OS notification.
- The progress bar is also divided into hour sections.

### 4. Completion animation (STAGE CLEAR!)
When the goal time is up:
1. The screen flashes white
2. The tomato does **3 victory hops**
3. A **STAGE CLEAR!** banner slides in and blinks
4. **Fireworks** burst all over the screen, and confetti falls
5. A **👑 crown** drops onto the tomato's head (it stays until you reset)
6. A victory tune plays and an OS notification appears

### 5. Goal setting
- Click the ✏️ box at the top (or press `G`) and enter **today's goal** (e.g. memorize 100 English words).
- When the timer finishes, the goal gets a **✔ and a strikethrough** and is saved to the record list.

### 6. Daily streak
- A day counts as attended once you **complete at least one hour of focus** that day.
- The top left shows 🔥 **N days in a row**. The first hour of the day plays a special streak sound and notification.
- If you haven't attended today yet, a red line blinks under the flame, but **the streak holds as long as yesterday was attended**.

### 7. Record screen (📅 calendar icon or `C`)
- **Current streak / best streak / total focus hours**
- **28-day stamp calendar**: the more hours focused that day, the deeper the red (1H → 2H → 3H+)
- **Completed goals list**: date, hours, goal, and how many times you left the window (**👑** if you never left)

### 8. Do-not-disturb (focus) mode 🌙
- Turn it on or off with the moon icon at the top (or `F`). **On by default.**
- While the timer runs:
  - The window switches to **fullscreen + always on top**, covering other windows
  - If you switch to another window, it counts as a **distraction**: the tomato sulks with a warning sound, and **after 5 seconds the window comes back to the front**
  - The distraction count is saved to the record
- It turns off automatically when you pause or finish, and you can get out right away with `ESC`.
- ⚠️ This does **not** automatically turn on the OS's own notification blocking (Windows "Focus assist" / macOS "Focus"). Toggling OS settings from an app without permission is intrusive, so it was left out. Turning that on as well gives you complete do-not-disturb.

### 9. Other features
- **📌 Always on top**: pin icon at the top right (or `P`); the timer stays in front even outside focus mode
- **🔈 Sound on/off**: speaker icon (or `M`); 8-bit square-wave sound effects
- **Keeps going after closing**: time is calculated from timestamps, so if you close and reopen the app, your progress carries on as if it never stopped
- **Safe reset**: press RESET once to see "OK?", and press again within 2 seconds to reset
- **Resizable window**: art pixels always scale by integer multiples, so the pixels stay crisp at any display scaling (125%, 150%, Retina)

### Keyboard shortcuts

| Key | Action |
|---|---|
| `Space` / `Enter` | Start / pause / again |
| `1` `2` `3` | Choose 1, 2, or 3 hours |
| `R` | Reset (press twice) |
| `G` | Enter a goal |
| `C` | Open / close the record screen |
| `F` | Focus mode on/off |
| `ESC` | Exit focus mode |
| `P` | Always on top |
| `M` | Sound on/off |

---

## Running it

### Windows
Double-click `release/Bbomodoro-Windows.exe`.
> If a "Windows protected your PC" (SmartScreen) prompt appears, click **More info → Run anyway**. (It shows up because the app isn't code-signed.)
> Windows 10/11 ships with WebView2, so there's nothing extra to install.

### macOS (Intel and Apple Silicon)
1. Double-click `release/Bbomodoro-macOS.tar.gz` to extract `Bbomodoro.app`
2. Move it to the Applications folder
3. On first launch, **right-click → Open** (it's unsigned, so it's blocked if you just double-click)
   - If it says the app is "damaged", run this once in Terminal:
     ```bash
     xattr -cr /Applications/Bbomodoro.app
     ```

---

## Development

```bash
npm install
```

```bash
npm run setup
```
(`setup` downloads the Neutralino runtime into `bin/` and `resources/js/neutralino.js`.)

| Command | Description |
|---|---|
| `npm start` | Run in development mode |
| `npm run build` | Generate `release/Bbomodoro-Windows.exe` and `release/Bbomodoro-macOS.tar.gz` |
| `npm run icon` | Regenerate the app icon (`resources/icons/appIcon.png`) from the sprite |

You can also build the macOS package from Windows (a tar.gz that keeps the execute permission).
You can also open `resources/index.html` directly in a browser (no notifications or always-on-top).

### Structure
```
resources/
  index.html        canvas + Korean overlays (goal box, record screen)
  js/sprite.js      tomato pixel sprite, expressions, ripening order (shared by the app and the icon generator)
  js/app.js         timer, rendering, 5x7 pixel font, sound, streak, focus mode
tools/
  make-icon.js      renders the sprite to PNG (no dependencies)
  package.js        builds the release artifacts
neutralino.config.json
```

### Data storage
All data is kept in the app's local storage (`localStorage`, key `bbomodoro.v1`).
- `days`: hours completed per date → basis for streak and calendar
- `log`: completed goals (up to 200)
- `goal`, `acc`, `startedAt`: current timer state
