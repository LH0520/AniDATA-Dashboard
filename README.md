# AniDATA Dashboard

A web dashboard for tracking animals with Bluetooth tags. MikroTik KNOT gateways pick up TG-BT5 tags and send the readings to AWS. This dashboard reads them through an API and shows them in the browser.

```
Tag -> KNOT -> AWS API -> Flask -> Browser
```

## Pages

- **Overview:** counts of knots, tags, missing tags and readings, plus the latest reading.
- **Tags:** every tag and knot in the latest data, with status, battery and signal. You can also give a tag a nickname here.
- **Live:** real readings from the last 5 minutes, updated every second.
- **Explorer:** filter readings by knot, tag or date, and export them to CSV.

## Running it

You need Python 3. From the `anidata` folder:

```bash
pip install -r requirements.txt
```

```bash
python app.py
```

Then open http://127.0.0.1:5000 and press **Connect to API** on the Overview page.

## Files

All the code is in the `anidata` folder.

| File | What it does |
|---|---|
| `app.py` | Flask routes for the pages and `/api/data` |
| `data.py` | Gets the API data and cleans it up |
| `dash.html`, `tags.html`, `live.html`, `explorer.html` | The four pages |
| `static/common.js` | Functions shared by all the pages |
| `static/dash.js`, `tags.js`, `live.js`, `explorer.js` | The code for each page |
| `static/style.css` | The styling |

## Good to know

- **Sample data:** `FAKE_READINGS` in `data.py` adds 10 hard-coded readings to Overview, Tags and Explorer. They never show on Live.
- **Limited history:** the API returns about 50 items, so older readings aren't available.
- **Read only:** the dashboard only sends GET requests to the API.
- **Untrusted data:** anyone can post to the API, so the pages use `textContent` and never `innerHTML`.
- **Nicknames:** these are saved in the browser, so they don't carry over to another computer.
- **Status:** a tag counts as Missing if its newest reading is more than 5 minutes old.

## Hosting

Hosted on Render, which deploys from `main`:

- **Root directory:** `anidata`
- **Build command:** `pip install -r requirements.txt`
- **Start command:** `gunicorn app:app`
