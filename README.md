# AniDATA Dashboard

A web dashboard for tracking animals with Bluetooth tags. MikroTik KNOT gateways pick up TG-BT5 tags and send the readings to AWS. This dashboard reads them through an API and shows them in the browser.

```
Tag -> KNOT -> AWS API -> Flask -> Browser
```

## Pages

- **Overview:** counts of knots, tags, missing tags and readings, plus the latest reading.
- **Tags:** every tag and knot in the latest data, with status, battery and signal.- **Live:** checks every second. Readings under 10 minutes old are picked up and stay on the page until Disconnect.
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

For the full setup steps, settings and troubleshooting, see [INSTALL.md](INSTALL.md).

To run the test for `data.py` (it doesn't need the internet), from the `anidata` folder:

```bash
pip install pytest
```

```bash
python -m pytest
```

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

- **Limited history:** the API returns 50 items, and they aren't always the newest 50. Each browser tab remembers up to 500 readings it has seen, and forgets them on Disconnect or when the tab closes.
- **Read only:** the dashboard only sends GET requests to the API.
- **Untrusted data:** anyone can post to the API, so the pages use `textContent` and never `innerHTML`.
- **Status:** a tag counts as Missing if its newest reading is more than 5 minutes old.
