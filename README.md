# Lecture Recorder

An installable web app for your phone and laptop. It records the lecture, transcribes it live, and keeps your jottings on the same clock. Afterwards you send the file to Lecture Companion in Claude to get your notes.

## Put it online (one time, about 10 minutes, free)

The microphone only works when the app is opened from an `https://` address, so it needs hosting. GitHub Pages is free and permanent.

1. Sign in at github.com. Create a new **public** repository called `lecture-recorder`.
2. On the new repository's page, click **uploading an existing file**. Drag in everything from this folder, including the `icons` folder, and click **Commit changes**.
3. Go to **Settings → Pages**. Under *Branch*, choose `main` and `/ (root)`, then click **Save**.
4. After a minute or two, the app is live at `https://YOUR-USERNAME.github.io/lecture-recorder/`.

Your lectures are never uploaded to GitHub. Only the app's own code lives there; every recording stays on the device that made it.

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

On the lecture's page, tap **Send file**:
- **On a phone**, the share sheet opens. Pick the Claude app, or save the file and drop it into Lecture Companion's Transcript tab.
- **On a laptop**, the file downloads. Drop it into the Transcript tab.

You can also use **Copy text** and paste it into the Transcript tab. Then press **Write my notes** in Lecture Companion.

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
