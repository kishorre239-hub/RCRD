# Geonixa Loom App (`apps/loom-app`)

The dedicated Loom screen recording, video collaboration, timeline editing, and WebRTC meetings product in the Geonixa Monorepo.

## 1. Scope & Features
- **Loom Screen Recorder (`/record`):** Full screen, browser tab, webcam overlay, microphone audio, countdown timer, pause/resume, and real-time chunk streaming.
- **Video Watch & Editor (`/video/[id]`):** Interactive timeline player with frame-level trimming, cuts, transcription notes, comments, and speed controls.
- **Personal Video Library (`/library`):** Recorded video list, folders, tag management, and search.
- **Team Workspace Videos (`/company-videos`):** Shared team video repository.
- **WebRTC Meeting Rooms (`/meetings`, `/meetings/room/[roomId]`):** Real-time collaborative video conferencing with chat, notes, and attendance.
- **Tokenized Video Sharing (`/s/[token]`):** Secure, publicly viewable video share links without requiring LMS login.
- **Device Preferences (`/settings`):** Hardware microphone and camera selectors, hotkeys, and defaults.
- **Workspace Administration (`/workspace/create`, `/workspace/join`, `/api/invite`):** Team creation and invitation email dispatch via Nodemailer.

## 2. Local Development

```bash
# Install dependencies (from monorepo root or app directory)
npm install

# Run Loom dev server on port 3001
npm run dev -- -p 3001
# Or from root:
npm run dev:loom
```

Navigate to [http://localhost:3001](http://localhost:3001).

## 3. Environment Configuration (`.env.local`)

```env
# Next.js Serverless API Route Handlers (internal /api route handlers)
NEXT_PUBLIC_API_URL=/api

# Base URL of sibling LMS application (for course navigation & cross-links)
NEXT_PUBLIC_LMS_URL=http://localhost:3002

# Serverless Workspace Invites (Nodemailer Gmail SMTP)
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-app-password
```

## 4. Vercel Deployment Configuration

When deploying this project independently to **Vercel**:
1. **Framework Preset:** `Next.js`
2. **Root Directory:** `apps/loom-app`
3. **Build Command:** `next build`
4. **Output Directory:** `.next`
5. **Environment Variables:** Set `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_LMS_URL` in the Vercel Project Settings.
