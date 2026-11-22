# Padhai

A free, open-source study companion for Indian students. Built with ❤️ by Ayush Mishra.

## Use the app

[Open the live app](https://padhai-gamma.vercel.app)

1. Register with your name, course or exam, email, and password. Verify the six-digit email code. Verified email registration or sign-in is required to access the app.
2. Confirm your display name when you first open your account on a browser. Sign-in and that confirmation carry over to later visits in the same browser.
3. Open **My exam plan**. Start with GATE CS, select another template, upload your syllabus PDF for AI extraction, fetch an official syllabus, or write your own outline. Review an import before adding it or replacing your current topics.
4. Set daily, weekly, monthly, and yearly study-time targets. Start a subject timer or log time studied away from the app.
5. Keep tasks in **My planner** and sessions in **Study calendar**. Add an event to Google Calendar, or import the `.ics` export into a calendar app for reminders. Calendar exports are copies; later edits do not synchronize automatically.
6. Create notebooks in **My notes**, attach files, and use **Save note** for an immediate cloud sync. **Download PDF** exports the title and text. **Share note** creates a link that a signed-in Padhai user can open to import a copy into Inbox. Shared copies contain the title and text.
7. Read the daily shloka and chaupai in **A little wisdom**. Pick your language for an explanation, and follow the link to the original.
8. Use **Ask AI** for explanations and suggestions. Tasks and sessions are added only when you review and accept them.

## Privacy and recovery

- Your workspace is saved locally and encrypted with AES-GCM before cloud saving. Attachments are encrypted separately.
- A random private study key controls access and encryption. Keep a copy from Settings. Anyone with this key can open your workspace.
- Email registration stores a salted scrypt password hash. Your study key is separately encrypted in the browser using PBKDF2 and your password. Login restores this encrypted key so the same workspace opens on another device.
- Login uses revocable, HttpOnly, SameSite cookies that last 30 days. OTPs expire in ten minutes. Password-reset links are single use and expire after 15 minutes. Both are hashed in storage and rate limited.
- With `PADHAI_RECOVERY_SECRET` configured, registration and successful password sign-in store a separate encrypted copy of the study key for email recovery. A verified reset link lets the server rewrap the same study key under the new password and revoke old sessions. An older account without this recovery copy needs its original private study backup key. Keep a secure backup of the server recovery secret.
- A personal Gemini key is encrypted before saving. **A saved personal key always takes priority. A failed personal key never falls back to the app owner's key.** The key is decrypted only to send an AI request over HTTPS to the app's server, which forwards it to Google without saving it in plaintext.
- Gemini receives content submitted for AI features. The assistant includes the exam, subject names, targets, and seven-day study totals. PDF analysis sends the selected PDF. Wisdom explanations use public verse text and the selected language. Google free-tier data terms apply.
- Room membership, names, chat, intentions, the shared clock, and call setup use the authenticated Padhai API. Connection messages expire after 45 seconds. Camera, microphone, and screen sharing use encrypted WebRTC. Peers may learn each other’s network addresses. Each browser tab uses a separate call identity. Recent chat is stored on the server for up to 24 hours or 100 messages.
- Workspace JSON backups contain note text and attachment references. Download important attachments separately. Shared note copies use a separate encryption key in the URL fragment. The full link gives a signed-in recipient access to the shared title and text.
- Simultaneous edits on two devices trigger a choice in Settings instead of silently overwriting one device's changes.

## Free-tier limits

- No payments or paid feature tiers are implemented. Vercel, Neon, Gmail, and Gemini have their own availability and free-tier quotas; indefinite unlimited service cannot be guaranteed by this project.
- Attachments: 20 MB per file, 50 MB per workspace, 250 MB raw attachment data per instance. Larger files upload as encrypted chunks. Add external file links when storage is full.
- Syllabus AI upload: PDF up to 2 MB. A larger syllabus can be pasted as an editable outline; the original file can be kept in Notes.
- Shared AI: eight requests per workspace per UTC day and 100 across the instance. Personal keys: up to 100 app requests per workspace per day, subject to Google's own quota. Core study features remain available when AI is unavailable.
- English and core Hindi labels are bundled. All 22 scheduled Indian languages are selectable. The interface translation button translates missing labels with Gemini and saves them on the device. Wisdom can explain a selected passage in any supported language using Gemini.
- Install the PWA after an online visit for offline personal study tools. AI, file transfers, cloud saving, email, and rooms need connectivity. Browser timer notifications require the browser/app to remain running. Use an external calendar for reminders while it is closed.
- Media connections depend on browser support and network policies. Camera, microphone, and screen sharing require explicit permission. Low-data mode disables outgoing media.

## Run locally

Install Git and either Node.js 22.18+ in the 22.x series or Node.js 24+. Open a terminal and download the project. [Git downloads](https://git-scm.com/downloads) · [Node.js downloads](https://nodejs.org/en/download)

```sh
git clone https://github.com/Ayush1974/padhai.git
cd padhai
npm ci
```

Copy [`.env.example`](.env.example) to `.env` in the project folder.

**Windows PowerShell**

```powershell
Copy-Item .env.example .env
```

**macOS or Linux**

```sh
cp .env.example .env
```

Open `.env` in your editor. Set `SMTP_USER` to a Gmail address you control and `SMTP_PASS` to its Google App Password to enable registration and password-reset email. Set `GEMINI_API_KEY` if you want a shared AI key for your copy. Individual users can add their own key in Settings. [Google App Password help](https://support.google.com/accounts/answer/185833)

```sh
npm run dev
```

Open [http://127.0.0.1:4173](http://127.0.0.1:4173). Padhai creates its local SQLite database in `data/` automatically. Git ignores your `.env` and local database.

### Run the checks

```sh
npm test
npm run build
```

For browser tests, install Microsoft Edge and stop `npm run dev`. Run the Vite frontend in one terminal.

```sh
npm exec vite -- --host 127.0.0.1 --port 4173 --strictPort
```

Run `npm run test:e2e` in a second terminal. The suite starts its own local API and simulates email delivery.

## Deploy on Vercel

1. Fork this repository and import your fork as a Vite project.
2. Add a free Neon PostgreSQL integration and connect `DATABASE_URL` to the project.
3. Set the environment variables in the following table in Vercel.

| Variable         | Purpose                                                                 |
| ---------------- | ----------------------------------------------------------------------- |
| `DATABASE_URL`   | Permanent PostgreSQL storage; required on Vercel.                       |
| `GEMINI_API_KEY` | Optional shared Gemini allowance. Users may save a personal key.        |
| `GEMINI_MODEL`   | Optional model override; defaults to `gemini-3.1-flash-lite`.           |
| `SMTP_PASS`      | Gmail App Password for OTP delivery. Never use a normal Gmail password. |
| `SMTP_USER`      | Gmail sender address you control.                                      |
| `PADHAI_RECOVERY_SECRET` | A stable 32-byte random key encoded as 64 hex characters for email account recovery. |
| `PADHAI_PUBLIC_URL` | Origin used in reset emails. Set this for a fork or a custom domain. |
| `CRON_SECRET` | Vercel's server-only secret for the daily Wisdom preparation job. |
| `TURN_URLS`, `TURN_USERNAME`, `TURN_CREDENTIAL` | Optional relay settings for browsers that cannot make a direct connection. Use comma-separated TURN URLs from your provider. Signed-in participants receive the client credentials when joining a call. |

4. Deploy. `vercel.json` configures the serverless API and security headers. `/api/health` confirms storage connectivity.

For an independently hosted server, run `npm run build` and `npm start` behind HTTPS. The default API port is 4881. Set `PADHAI_PUBLIC_URL` to the URL users open so password-reset links return to your deployment. PostgreSQL is recommended for production. SQLite needs a persistent local disk.

## Code map

- `src/pages/`: one component for each main study module.
- `src/components/`: shared dialogs, onboarding, authentication, AI, files, timer, and room UI.
- `src/hooks/`: timer, cloud synchronization, ambient audio, and peer-to-peer room connections.
- `src/lib/`: typed study rules, validation, encryption, account recovery, file transfers, calendar exports, and AI requests.
- `server/`: authenticated storage API, email OTP accounts, Gemini requests, database adapters, official syllabus extraction.
- `api/`: Vercel function entry point.
- `public/`: installable app assets and service worker. Private API routes are never cached offline.

## Sources

Official syllabus import is restricted to supported exam authority domains. Imported material stays editable in your own copy. Verify the year and linked official document.

Daily Wisdom reads the original passage metadata from [Heritage IIT Kanpur](https://heritage.iitk.ac.in/) and links the exact reference. The Vercel cron fetches the next day's passages during the evening. A new India calendar date selects the new passages from midnight IST. Gemini generates the explanations and study reflections.

- [Google Gemini documentation](https://aistudio.google.com/docs/get-started)
- [Google Calendar import help](https://support.google.com/calendar/answer/37118)
- [Nodemailer Gmail setup](https://nodemailer.com/usage/using-gmail/)
- [Google App Password help](https://support.google.com/accounts/answer/185833)

## License

MIT. See LICENSE. The supplied Padhai brand assets are included with the app. Library photographs are sourced from Unsplash; the included images and external resource sites retain their respective terms.
