# Installing FlashCards on iPhone

A complete step-by-step guide to hosting and installing this PWA on your iPhone.

---

## Overview

This app is a **Progressive Web App (PWA)**. It runs entirely in Safari and installs to your Home Screen — it looks and feels like a native app, but lives in your browser. All data is stored locally on your device.

---

## Step 1 — Host the Files

You need a web server to serve the files over HTTPS. There are three easy options:

### Option A: Free Hosting on GitHub Pages (recommended, free)

1. Create a free account at [github.com](https://github.com)
2. Create a new repository (e.g. `my-flashcards`)
3. Upload all files from this folder:
   - `index.html`
   - `style.css`
   - `app.js`
   - `manifest.json`
   - `service-worker.js`
   - `icons/icon-192.png`
   - `icons/icon-512.png`
4. In the repo settings, go to **Pages** → set source to `main` branch → **Save**
5. Your app will be live at: `https://YOUR_USERNAME.github.io/my-flashcards/`

Wait ~1 minute for the deployment to complete.

---

### Option B: Free Hosting on Netlify (drag-and-drop, no account needed)

1. Go to [netlify.com](https://netlify.com) and sign up (free)
2. Drag the entire `flashcard-pwa` folder onto the Netlify dashboard
3. Netlify will give you a URL like `https://flashy-unicorn-12345.netlify.app`
4. Done! Copy that URL and open it on your iPhone.

---

### Option C: Localhost with a Tunnel (for testing without cloud)

If you want to test locally from your iPhone on the same Wi-Fi:

```bash
# Install ngrok (free)
brew install ngrok/ngrok/ngrok   # macOS
# or download from https://ngrok.com/download

# Serve the app locally (from the project folder)
python3 -m http.server 8080

# In another terminal, expose it
ngrok http 8080
```

Copy the `https://...ngrok.io` URL and open it on your iPhone.

> ⚠️ **HTTPS is required** for Service Workers and PWA installation. `localhost` works for desktop only.

---

## Step 2 — Open in Safari on iPhone

1. **Open Safari** on your iPhone (not Chrome, not Firefox)
2. Type or paste your app URL in the address bar
3. Wait for the page to fully load
4. Make sure the card interface is visible

> ✅ The app must be loaded in **Safari** — PWA installation is a Safari-only feature on iOS.

---

## Step 3 — Add to Home Screen

1. Tap the **Share button** (the square with an arrow pointing up ↑) at the bottom of Safari
2. Scroll down in the Share Sheet and tap **"Add to Home Screen"**
3. Edit the name if you want (it shows "FlashCards" by default)
4. Tap **"Add"** in the top-right corner

The FlashCards icon will appear on your Home Screen.

---

## Step 4 — Run as Standalone App

1. Find the **FlashCards** icon on your Home Screen
2. Tap it to launch
3. The app will open **full-screen**, without any Safari UI — it looks and feels like a native app

You can now use FlashCards offline, add it to a Dock, and use it from the App Library.

---

## Step 5 — How Local Storage Works

All your flashcards are stored using **IndexedDB**, a browser database built into Safari.

Key facts:

- **No account required** — data lives only on your device
- **No internet needed** — the app works 100% offline after installation
- **Data survives app restarts** — your cards are saved permanently
- **Safari may delete data** if you have not opened the app for **7 days** and your device is low on storage (this is an iOS policy for PWAs)
- To prevent data loss: **export a JSON backup regularly**

---

## Step 6 — How to Backup Your Flashcards

### Export (save a backup)

1. Open the app
2. Tap the **☰ Menu** button (top-left)
3. Tap **Export JSON**
4. A `.json` file will download to your Files app
5. Save it to iCloud Drive, AirDrop it to your Mac, or email it to yourself

### Import (restore a backup)

1. Open the app
2. Tap the **☰ Menu** button
3. Tap **Import JSON**
4. Select your `.json` backup file
5. Cards will be added to your deck

> 💡 **Tip**: Export a backup before deleting the app or clearing Safari data.

---

## Troubleshooting

### "Add to Home Screen" is missing

- Make sure you're using **Safari**, not Chrome or Firefox
- Try refreshing the page and waiting for it to fully load
- Clear Safari cache: Settings → Safari → Clear History and Website Data → reload

### App doesn't work offline

- Open the app in Safari while online first — the Service Worker caches assets on first load
- Then close Safari completely (swipe up from app switcher)
- Enable Airplane Mode
- Launch from Home Screen — it should work offline

### Cards disappeared

This can happen if Safari cleared site data. To prevent it:
- Export JSON backups regularly (Menu → Export JSON)
- Go to: Settings → Safari → Advanced → Website Data → find your app URL → do NOT delete it

### Icons don't show on Home Screen

- Delete the Home Screen shortcut and re-add it
- Make sure `icons/icon-192.png` and `icons/icon-512.png` are uploaded to your server

### App looks wrong / not fullscreen

- Make sure the `manifest.json` is served from the same origin as `index.html`
- Check that `display: "standalone"` is in `manifest.json`
- Re-add to Home Screen after fixing

### Service Worker is stale (showing old version)

- Open the app in Safari
- Open the Developer Console (if on Mac via Web Inspector)
- Go to the Application tab → Service Workers → click "Update"
- Or hard reload: hold the refresh button in Safari → "Reload Without Content Blockers"

---

## iOS Limitations to Be Aware Of

| Limitation | Detail |
|------------|--------|
| Push notifications | Not supported for PWAs on iOS 16 and earlier |
| Background sync | Not available on iOS Safari |
| Storage quota | ~50 MB per PWA by default |
| Auto-clear | Safari may clear data if app unused for 7+ days |
| Install prompt | Must be done manually via Share Sheet (no automatic prompt on iOS) |

---

## Quick Summary

```
1. Upload files to GitHub Pages or Netlify (free)
2. Open the URL in Safari on iPhone
3. Share → Add to Home Screen
4. Launch from Home Screen
5. Backup via Menu → Export JSON
```

---

Made with ♥ — Fully offline, fully private.
