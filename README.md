# FlashCards PWA

A beautiful, offline-capable flashcard app for learning words and translations. Built as a Progressive Web App — installable on iPhone via Safari.

## Features

- **Swipe gestures**: Swipe left/right for next/previous card, swipe up to reveal translation, swipe down to hide
- **Tap to flip**: Tap the card to flip between word and translation
- **Known / Unknown tracking**: Mark cards as known or still learning
- **Progress stats**: Visual progress bar and stats breakdown
- **Shuffle mode**: Randomize card order
- **Bulk import**: Paste multiple cards at once using `word, translation` format
- **Import / Export JSON**: Back up and restore your deck
- **Dark mode**: Automatic dark/light mode based on system preference
- **100% offline**: Uses IndexedDB for local storage — no backend, no cloud

## Gesture Reference

| Gesture | Action |
|---------|--------|
| Swipe left | Next card |
| Swipe right | Previous card |
| Swipe up | Reveal translation |
| Swipe down | Hide translation |
| Tap | Flip card |

## Keyboard Shortcuts (Desktop)

| Key | Action |
|-----|--------|
| `→` or `↓` | Next card |
| `←` or `↑` | Previous card |
| `Space` | Flip card |
| `K` | Toggle known |

## Bulk Import Format

One card per line, separated by a tab or comma:

```
hello, hola
cat, gato
thank you	gracias
good morning, buenos días
```

## Project Structure

```
flashcard-pwa/
├── index.html          # App shell
├── style.css           # All styles (dark/light mode)
├── app.js              # App logic, DB, gestures
├── manifest.json       # PWA manifest
├── service-worker.js   # Offline caching
├── icons/
│   ├── icon-192.png
│   └── icon-512.png
├── INSTALL_IPHONE.md   # iPhone installation guide
└── README.md
```

## Local Development

```bash
# Serve locally (Python)
python3 -m http.server 8080

# Then open: http://localhost:8080
```

> **Important**: Service workers require HTTPS or localhost. For iPhone testing, use a local tunnel (see INSTALL_IPHONE.md).
