# Lecture Recorder

An installable web app for your phone and laptop. It records the lecture, transcribes it live, and keeps your jottings on the same clock. Afterwards you send the file to Lecture Companion in Claude to get your notes.


## Install it

- **Android phone (Chrome):** open the address, tap ⋮ → **Install app** (or *Add to Home screen*).
- **Laptop (Chrome or Edge):** open the address and click the install icon at the right of the address bar, or the app's own **Install** button.
- **iPhone (Safari):** tap Share → **Add to Home Screen**. Audio recording and jottings work. Live transcript on iPhone is unreliable, so transcribe the audio afterwards.

## In class

1. Tap **Record a lecture**, type the title, then press **Start**. Allow the microphone the first time.
2. Type jottings into the bar at the bottom, or tap a marker: *Important*, *Exam hint*, *Lost me here*, *Reading*. Anything typed in the box gets attached to the marker you tap.
3. Press **Finish** at the end. Everything saves on the device every few seconds. If the app closes by accident, the lecture shows as *Interrupted*; open it and tap **Continue recording**.

**Keep the app open with the screen on.** Phones stop web apps from recording when the screen locks. The app asks the screen to stay awake, but turn the brightness down and keep the phone plugged in for a 1.5-hour class. A laptop is the most reliable choice.

## Get your notes

Open the lecture in the app and press **Notes in Companion**.

1. Lecture Companion opens with a **Paste your lecture** box. The Recorder has already copied your lecture.
2. Paste it: **Ctrl+V** on a laptop (⌘V on a Mac), or tap the box and choose **Paste** on a phone.
3. Companion saves the lecture and starts writing your notes straight away.

**One-time setup:** Companion runs on claude.ai, so sign in to claude.ai in the browser that opens (Chrome, Edge or Safari). You stay signed in after that. The first time it writes notes, it asks for permission; allow it.

**Prefer a chat?** Use **Send to Claude** (phone) or **Copy for Claude** (laptop) to paste the lecture into a new chat in the Claude app instead.

## Good to know

- Live transcript uses your browser's speech service (Google, in Chrome). It needs internet. Sit close to the lecturer for the best results.
- Some Android phones can't record audio and transcribe live at the same time. If the app warns you about this, the audio keeps recording and you can transcribe it later.
- Audio downloads as `.webm` (or `.m4a` on iPhone). About 1.5 hours takes roughly 20 MB.
- Check your department's policy on recording lectures.

## Files

| File | Purpose |
|---|---|
| `index.html` | App screens |
| `app.js` | Recording, transcription, jottings, saving |
| `style.css` | Look and layout (follows light/dark mode) |
| `sw.js` | Lets the app open offline |
| `manifest.webmanifest`, `icons/` | Makes it installable |
