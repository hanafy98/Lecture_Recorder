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

Open the lecture in the app.

- **On your phone:** tap **Send to Claude** and pick **Claude** in the share menu. The lecture arrives in a new chat with instructions included. Press send, and Claude writes your notes.
- **On your laptop:** click **Copy for Claude**, open the **Claude app**, start a new chat, paste (Ctrl+V, or ⌘V on a Mac) and press Enter.
- **Very long lecture?** Use **Save as file** and attach the file to a Claude chat instead.

Use the Claude app rather than the website. The app is already signed in.

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
