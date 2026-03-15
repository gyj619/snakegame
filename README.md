## Classic Snake Mini-Game

A lightweight implementation of the classic Snake loop (movement, growth, food spawning, scoring, restart) built with vanilla HTML/CSS/JS and deterministic core logic.

### Development

1. Install dependencies (none are required, but this writes `package-lock.json`):
   ```bash
   npm install
   ```
2. Start the local dev server:
   ```bash
   npm run dev
   ```
3. Visit [http://localhost:5173](http://localhost:5173) to play. Keyboard (Arrow/WASD) and on-screen buttons (narrow screens) both work. Use the pause/resume button or the space bar to toggle pause, and the restart button (or Enter key) for a fresh run.

### Online Leaderboard Setup

The leaderboard is implemented as a static-site client talking directly to Supabase via REST. GitHub Pages can host the UI, but you still need a shared database for cross-player scores.

1. Create a Supabase project.
2. In the Supabase SQL editor, run:

```sql
create table if not exists public.snake_scores (
  player_name text primary key,
  score integer not null default 0 check (score >= 0),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.snake_scores enable row level security;

create policy "Public read snake scores"
on public.snake_scores
for select
using (true);

create policy "Public insert snake scores"
on public.snake_scores
for insert
with check (true);

create policy "Public update snake scores"
on public.snake_scores
for update
using (true)
with check (true);
```

3. Open `src/leaderboard/config.js`.
4. Fill in:

```js
supabaseUrl: 'https://YOUR_PROJECT.supabase.co',
supabaseAnonKey: 'YOUR_SUPABASE_ANON_KEY',
```

5. Redeploy the site to GitHub Pages.

The game stores one best score per player name. The leaderboard refreshes automatically every 5 seconds.

### Tests

```bash
npm test
```

This runs deterministic checks for movement, growth, collisions, food placement, and restart behavior in `tests/gameLogic.test.js`.

### Deploy to GitHub Pages

This repo includes a GitHub Actions workflow at `.github/workflows/deploy-pages.yml` that publishes the static site to GitHub Pages.

1. Push this repo to GitHub.
2. In the GitHub repo, open `Settings -> Pages`.
3. Set `Source` to `GitHub Actions`.
4. Push to the `main` branch, or run the `Deploy to GitHub Pages` workflow manually from the `Actions` tab.
5. After deployment, open the Pages URL shown in the workflow run or in `Settings -> Pages`.

Because the game is a static site, GitHub Pages serves `index.html` and `src/` directly. The local dev server in `scripts/dev-server.mjs` is not used in production.

### Manual Verification Checklist

- **Controls**: Confirm Arrow keys/WASD and mobile buttons steer the snake correctly, and inputs are ignored after game-over.
- **Pause/Resume**: Ensure the Pause button (or space bar) halts movement, Resume restarts the timer, and the UI reflects the current state.
- **Restart**: Use the Restart button or overlay button to reset score, snake length, and hide the game-over overlay.
- **Boundaries/Self-Collision**: Drive the snake into a wall and into its own body to verify the loop stops, the overlay shows the final score, and you can restart afterwards.
- **Player Name Prompt**: Confirm the first visit requires a name before the game starts, and `Change name` updates the active player identity.
- **Leaderboard Sync**: After a game ends, verify the score is written to Supabase, the leaderboard refreshes automatically, and lower scores do not overwrite a player's previous best.
