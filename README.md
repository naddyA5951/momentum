# Momentum

Futuristic daily planner, focus timer, task manager, and learning dashboard. The client uses React + Vite, Tailwind, React Three Fiber, Lucide; the API uses Express and a persistent SQLite database.

## Install and run

Prerequisite: Node.js 20+.

```bash
npm run install:all
npm run dev
```

Open `http://localhost:5173`. The Express API runs on `http://localhost:4000`; Vite proxies `/api` requests there. The SQLite database is automatically created at `server/data/momentum.db` and persists across restarts.

## Deploy publicly with GitHub + Render

This repository includes `render.yaml`, which provisions a Render web service and managed PostgreSQL database. To deploy it:

1. Create an empty GitHub repository and push this project to its `main` branch.
2. In Render, choose **New → Blueprint**, connect the GitHub repository, then approve the `momentum` service and `momentum-db` database. The build command explicitly includes development dependencies because Vite is required to compile the frontend.
3. When the deployment becomes healthy, open the generated `onrender.com` URL. Add a custom domain in the service's **Settings → Custom Domains** section.

In production, Express serves the compiled React application and switches automatically to Render PostgreSQL via `DATABASE_URL`. SQLite remains the local-development default. Do not store private user data publicly until authentication and per-user data access controls have been added.

## Direct Android APK (no Play Store)

The repository includes a Capacitor Android wrapper and a GitHub Actions workflow. It packages the hosted Momentum app as an installable Android APK; data and sign-in remain on the deployed Render service.

1. In GitHub, open the repository's **Actions** tab and select **Build Momentum Android APK**.
2. Click **Run workflow**, keep **Publish the APK** enabled, and run it.
3. When it completes, open the new item under **Releases** and download `Momentum.apk` on your Android phone.
4. Open the download. Android may ask you to allow installs from the browser or Files app; allow it only for that one install, then install Momentum.

This debug APK is suitable for direct personal distribution. Publishing to Google Play later requires a signed release AAB/APK and an Android signing key.

## Public address

Momentum is live at `https://momentum-p1f2.onrender.com`. For a shorter branded address, purchase a domain (for example `momentumbyNaveed.com`) from a registrar, then add it under **Render → momentum → Settings → Custom Domains**. Render will show the DNS record to add at the domain registrar.

To create a production client bundle, run:

```bash
npm --prefix client run build
```

## Architecture

- `client/src/components/CoreCanvas.jsx`: reactive wireframe 3D core; it accelerates while focus is active.
- `client/src/hooks/useNotifications.js`: browser notification permission and Web Audio chime.
- `client/src/main.jsx`: dashboard composition, timer state, automatic saving, planner, tasks, learning tracker.
- `server/src.js`: Express REST API and schema initialization.

## API

`GET/POST /api/tasks`, `PATCH/DELETE /api/tasks/:id` manage tasks. Equivalent CRUD routes exist for `/api/blocks` and `/api/sessions`. `GET/PATCH /api/learning` reads and updates learning totals. All POST/PATCH calls use JSON.

## Database schema

SQLite tables are initialized in `server/src.js`: `tasks` (title, priority, tags, estimate, status), `schedule_blocks` (title, category, start/end times, color), `focus_sessions` (duration and kind), and singleton `learning_metrics` (minutes, streak, milestones, last studied date).
# momentum
