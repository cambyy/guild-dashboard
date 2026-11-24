# Thrall Dressed · Guild Dashboard

Professions, levels, classes and achievements for the Thrall Dressed guild in WoW: Forever, read from the public Armory and refreshed every day.

## What's in here

| Path | What it does |
| --- | --- |
| `public/` | The website: `index.html`, `styles.css`, `app.js`, logo and fonts. |
| `api/data.js` | Serves the latest saved data to the page. |
| `api/refresh.js` | Reads every member's Armory page, saves the new data and records new achievements. |
| `lib/` | Helpers for reading the Armory and for storage. |
| `seed/` | Starting data (all history up to Nov 22, 2026) and the member list. |
| `vercel.json` | Runs the refresh daily at 05:55 UTC (9:55 PM Pacific). |

## Set it up (about 20 minutes, no coding)

1. **GitHub**: create a free account at [github.com](https://github.com), then click **New repository**, name it `guild-dashboard`, and create it. On the new repository page, click **uploading an existing file**, drag in **everything inside this folder** (not the folder itself), and click **Commit changes**.
2. **Vercel**: sign up free at [vercel.com](https://vercel.com) with **Continue with GitHub**.
3. **Import**: in Vercel click **Add New → Project**, pick `guild-dashboard`, leave the settings as they are and click **Deploy**. You'll get an address like `guild-dashboard-xxxx.vercel.app`. The page already works at this point, showing the bundled data.
4. **Storage**: open the project, go to the **Storage** tab, click **Create → Blob**, give it any name, and connect it to the project (all environments).
5. **Secret**: go to **Settings → Environment Variables** and add `CRON_SECRET` with a long random password (letters and numbers only). Save it somewhere; you'll use it once below.
6. **Redeploy**: go to **Deployments**, open the menu on the latest one, and choose **Redeploy** so the storage and secret take effect.
7. **First refresh**: visit `https://YOUR-ADDRESS/api/refresh?key=YOUR-CRON-SECRET` in your browser. After about 20 seconds you should see `"ok": true` and a list of characters read. Then open your dashboard and press **Refresh** in your browser.

That's it. From now on:

- **Daily refresh**: Vercel runs it automatically every night. On the free Hobby plan the exact time can drift within the hour.
- **Refresh button**: anyone can press it, but it only fetches new data if the last refresh was more than 30 minutes ago.
- **Changes go live automatically**: edit a file on GitHub and Vercel redeploys within a minute.

## Adding a new guild member

The refresh can't read the guild roster itself, so new members need to be added once:

1. Open `seed/members.json` on GitHub and click the pencil icon.
2. Add their Armory name: lowercase, words joined with a hyphen, as in their Armory link (e.g. `https://…/armory/character/arnu-ashvane` → `"arnu-ashvane"`).
3. Click **Commit changes**. Their data appears after the next refresh.

Members already in the saved data are always included. Characters whose Armory page doesn't load yet (usually very new, low-level ones) are skipped until it does.

## If something isn't working

Open `https://YOUR-ADDRESS/api/health` in a browser. It checks the setup and lists any problems in plain words:

- **`storageConnected: false`**: connect the Blob store under **Storage**, then redeploy.
- **`cronSecretSet: false`**: add `CRON_SECRET` under **Settings → Environment Variables**, then redeploy.
- **`armoryStatus` isn't 200**: Blizzard didn't return the character page to Vercel's servers (they may be blocking them).
- **`armoryParsed` isn't ok**: the page loaded but its layout may have changed.

For more detail, open the project in Vercel, go to **Logs**, press Refresh on the dashboard, and look for lines from `/api/refresh`.

## Notes

- **Achievements**: level milestones are 10/20/30/40/50/60 and profession milestones are 75/150/225/300. They're counted only for characters seen in two refreshes in a row, so a newly added member doesn't flood the list. The "new" chip counts milestones from the latest refresh.
- **If the Armory blocks the refresh** or changes its page layout, the refresh stops without changing anything, and the dashboard keeps showing the last good data. Check the refresh link from step 7 to see the error.
- **Private dashboard**: in Vercel, **Settings → Deployment Protection** can require a password.
- **Official API**: when Blizzard adds WoW: Forever to its official API, `lib/armory.js` is the only file that needs to change.

Fan-made; not affiliated with Blizzard Entertainment. Redaction 10 font by MCKL, SIL Open Font License.
