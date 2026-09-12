# bottle_blast_arena

A carnival-style browser game — pull back a catapult, fire at a pyramid of bottles, and knock them all down. Built as a fast, demo-ready arcade game with real physics, live sound, and a leaderboard.

## Features

- **Physics-based gameplay** — projectile and bottles are simulated with Matter.js, so knocking a bottle over actually looks and behaves like it toppled, not like a scripted animation.
- **Drag-to-aim catapult** — click-and-drag (or touch-and-drag on mobile) to set power and angle, with a live dotted trajectory preview and a power meter while you pull back.
- **Juicy feedback** — a cosmetic arm-snap animation on release, particle burst and screen shake on impact, and procedurally generated sound effects (launch twang, impact thud, win cheer) via the Web Audio API, so nothing depends on downloaded sound files.
- **Live reaction GIF** — after your 5 shots are up, the game fetches a Giphy GIF matching your performance (celebration for a high score, fail GIF for a low one).
- **Persistent leaderboard** — top 5 scores, stored server-side and shown on screen.

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | HTML5, CSS3, vanilla JavaScript, `<canvas>` |
| Physics | [Matter.js](https://brm.io/matter-js/) (CDN) |
| Sound | Web Audio API (built-in, no assets) |
| Backend | Python + Flask |
| Storage | SQLite (`sqlite3`, built into Python) |
| Third-party API | [Giphy API](https://developers.giphy.com/) (free tier) |

## Project structure

```
pitchpop/
├── app.py                 # Flask app: leaderboard routes + Giphy proxy
├── requirements.txt        # flask, python-dotenv, requests
├── .env                    # secrets — not committed
├── static/
│   ├── style.css
│   └── game.js             # canvas game: input, Matter.js world, HUD, sound
└── templates/
    └── index.html           # single-page game screen
```

## Setup

1. **Clone or open the project** (e.g. in Replit, or locally with `git clone`).
2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```
3. **Get a free Giphy API key:** sign up at [developers.giphy.com](https://developers.giphy.com/), create an app, and copy the key.
4. **Create a `.env` file** in the project root:
   ```
   GIPHY_API_KEY=your-free-giphy-key
   ```
5. **Run the app:**
   ```bash
   python app.py
   ```
6. Open the app in your browser (Replit will give you a webview URL automatically; locally it's usually `http://localhost:5000`).

## How to play

1. Click and drag back from the catapult's arm to aim — watch the trajectory preview and power meter.
2. Release to fire.
3. Knock down as many of the 6 bottles as you can within **5 shots**. Clearing all 6 in a single shot earns a combo bonus.
4. After your last shot, enter your name to submit your score to the leaderboard.

## API routes

| Route | Method | Description |
|---|---|---|
| `/` | GET | Serves the game page |
| `/api/reaction-gif?tier=high\|low` | GET | Returns `{ url }` — a Giphy GIF matching the given performance tier |
| `/api/score` | POST | Body `{ name, score }` — saves a score to the leaderboard |
| `/api/leaderboard` | GET | Returns the top 5 scores, highest first |

## Notes

- No login or accounts — the leaderboard just takes a name at submission time.
- No automated test suite; the game is meant to be manually playtested before a demo.
- The catapult's arm-snap is a cosmetic animation, decoupled from the actual projectile physics (a separate Matter.js body given a matching launch velocity) — this keeps the physics reliable while still looking like the arm is doing the throwing.

## Credits

- Physics by [Matter.js](https://brm.io/matter-js/)
- Reaction GIFs via the [Giphy API](https://developers.giphy.com/)
