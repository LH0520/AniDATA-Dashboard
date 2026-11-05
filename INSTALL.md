# Installation Manual

How to set up and run the AniDATA Dashboard on your own computer.

## System requirements

- **Operating system:** Windows 10 or later, macOS 12 or later, or Linux
- **Python:** 3.10 or later
- **Browser:** a current version of Chrome, Edge, Firefox or Safari, with storage allowed (no private browsing)
- **Internet connection:** the server downloads the readings from the tracking API on AWS

## Hardware setup

The dashboard only reads from the tracking API, so the tags and KNOTs must already be sending readings to AWS.

1. Connect the MikroTik KNOT to the network with an Ethernet cable. A PoE port powers it through the same cable.
2. Make sure the KNOT can reach the internet.
3. Switch on the TG-BT5 tags and place them within range of the KNOT.

## Software installation

1. Install Python 3 from [python.org](https://www.python.org/downloads/). On Windows, tick **Add Python to PATH**.
2. Download or clone this repository, then open a terminal in the `anidata` folder.
3. Create a virtual environment:

   ```bash
   python3 -m venv .venv
   ```

4. Turn it on. On macOS or Linux:

   ```bash
   source .venv/bin/activate
   ```

   On Windows: `.venv\Scripts\activate`

5. Install the packages (Flask and requests):

   ```bash
   pip install -r requirements.txt
   ```

6. Start the server:

   ```bash
   python app.py
   ```

7. Open http://127.0.0.1:5000 and press **Connect to API** on the Overview page.

To stop the server, press **Ctrl + C** in the terminal.

## Configuration

The settings are in the code. Restart the server after changing a Python file, and refresh the browser after changing a JavaScript file.

| Setting | File | Default | What it controls |
|---|---|---|---|
| `API_URL` | `data.py` | AWS API Gateway address | Where the readings come from |
| `refreshTime` | `dash.js`, `tags.js` | 15 seconds | How often the Overview and Tags pages refresh |
| `refreshTime` | `explorer.js` | 5 seconds | How often the Explorer page refreshes |
| `refreshTime` | `live.js` | 1 second | How often the Live page checks for new readings |
| `activeMinutes` | `common.js` | 5 minutes | How recently a tag or knot must be heard to count as Active |
| `liveMinutes` | `common.js` | 10 minutes | How new a reading must be to show on the Live page |
| `lowBattery` | `common.js` | 20% | Batteries below this show in red |

If port 5000 is already in use, start the server on another port and open http://127.0.0.1:5001 instead:

```bash
flask --app app run --port 5001
```

## Troubleshooting

| Problem | Solution |
|---|---|
| `python` or `pip` is not recognised | Reinstall Python and tick **Add Python to PATH** |
| `No module named 'flask'` | Turn on the virtual environment and install the packages (steps 4 and 5) |
| The browser can't open 127.0.0.1:5000 | Check the server is running. On a Mac, AirPlay Receiver can use port 5000, so use another port |
| "Could not reach the dashboard server" | The server has stopped. Start it again with `python app.py` |
| "Could not get data from the tracking API" | Check the internet connection. The terminal shows the exact error |
| A page says "Not connected" | Go to the Overview page and press **Connect to API** |
| The Live page stays empty | No readings in the last 10 minutes. Check the tags and KNOT are on, or look in the Explorer page |
| Every tag shows as Missing | No readings in the last 5 minutes. Check the KNOT is powered and online |
