# What's Cookin' — personal edition (Android)

Your kitchen from your receipts, with a quick check at the store door.
This edition runs entirely on your phone. Receipt reading uses your own Anthropic API key.

## 1. Put it on GitHub Pages (about 5 minutes)

1. On github.com, click **New repository**. Name it `whats-cookin`. Choose **Public** (free GitHub Pages needs a public repo; nothing private is in these files). Click **Create repository**.
2. On the new repo page, click **uploading an existing file**.
3. Unzip `whats-cookin-android.zip` on your computer, then drag **everything inside the folder** (index.html, shim.js, sw.js, manifest.webmanifest, the icons folder, README.md) into the upload box. Upload the files, not the zip itself.
4. Click **Commit changes**.
5. Go to **Settings → Pages**. Under **Build and deployment**, set Source to **Deploy from a branch**, Branch to **main** and folder **/ (root)**. Click **Save**.
6. Wait a minute or two. The page shows your address: `https://YOUR-USERNAME.github.io/whats-cookin/`

Tip: `.nojekyll` is a hidden file. If your computer hides it, that's fine; the app works without it.

## 2. Install it on your Android phone

1. Open your address in **Chrome** on the phone.
2. Tap the **⋮** menu → **Install app** (or **Add to Home screen**).
3. Open it from the home screen. It runs full screen, like any app.
4. Long-press the icon for **I'm shopping**, which goes straight into the store-door check. You can drag that onto your home screen as its own icon.

## 3. Turn on receipt reading

1. Go to **console.anthropic.com** → sign in → **Settings → API keys** → **Create key**. Copy it.
2. In **Billing**, add a little credit (a receipt costs about 1–3 cents) and **set a monthly spend limit** (for example, $5).
3. In the app: person icon → **Receipt reading** → paste the key → **Save**. It checks the key right away.

Your key is saved only on your phone and sent only to Anthropic. It is never in these files or on GitHub.
Anyone who uses your unlocked phone could use it, so keep the spend limit on.

## 4. Bring your kitchen over from the Claude version (optional)

1. In the Claude version: person icon → More → **Back up kitchen**. Get the file onto your phone (email it to yourself, or Google Drive).
2. In this app: start a kitchen, then person icon → More → **Restore from a backup** → pick the file.

## Good to know

- **Your data lives only on this phone.** Clearing Chrome's site data or uninstalling deletes it. Use **Back up kitchen** now and then.
- **No sharing.** This edition is just for you; there's no joining someone else's kitchen.
- **Works offline.** Opens and runs without signal; receipt reading needs a connection.
- **Updating.** When you get a new zip, upload the new files to the repo the same way (replace the old ones). The app picks up the update the next time it opens with a connection.

## Files

| File | What it is |
|---|---|
| `index.html` | The app |
| `shim.js` | Runs the app on your phone: on-device storage, Claude via your key, downloads |
| `sw.js` | Lets the app open offline and pick up updates |
| `manifest.webmanifest` | App name, icons and the I'm shopping shortcut |
| `icons/` | App icons |
