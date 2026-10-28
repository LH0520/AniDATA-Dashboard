const connectButton = document.getElementById("connectButton");
const statusText = document.getElementById("statusText");
const errorText = document.getElementById("errorText");

const refreshTime = 15;
let loading = false;
let hasData = false;
let timer = null;

connectButton.addEventListener("click", connect);

// If the user already connected on another page, show the saved data
// straight away and keep refreshing
if (isConnected()) {
    connectButton.hidden = true;
    const saved = getSavedData();
    if (saved !== null) {
        showAPIdata(saved);
        hasData = true;
        statusText.textContent = "Connected - Refreshing every " + refreshTime + " seconds";
    }
    loadAPI();
}

function connect() {
    setConnected();
    loadAPI();
}

async function loadAPI() {
    if (loading) {
        return;
    }
    loading = true;
    connectButton.disabled = true;
    if (hasData === false) {
        statusText.textContent = "Connecting...";
    }
    errorText.textContent = "";

    try {
        const data = await getData();
        showAPIdata(data);
        hasData = true;
        // Hide the button once it has worked. If the first try fails it stays, so the user can try again.
        connectButton.hidden = true;
        statusText.textContent = "Connected - Refreshing every " + refreshTime + " seconds";
    } catch (error) {
        errorText.textContent = error.message;
        if (hasData) {
            statusText.textContent = "Connection failed - showing older data";
        } else {
            statusText.textContent = "Connection failed";
        }
    }

    // Start the timer once, even if the first try failed, so it keeps retrying
    if (timer === null) {
        timer = setInterval(loadAPI, refreshTime * 1000);
    }
    loading = false;
    connectButton.disabled = false;
}

// The overview counts every reading the API has, not just the new ones
function showAPIdata(data) {
    const readings = data.readings;

    // knots holds one entry per knot name: how many readings it sent and the newest one.
    // tags is a list of the MAC addresses seen, with no repeats.
    const knots = {};
    const tags = [];

    for (let i = 0; i < readings.length; i++) {
        const reading = readings[i];
        const name = show(reading.knotName);

        // The readings are newest first, so the first one for each knot is its latest
        if (knots[name] === undefined) {
            knots[name] = { readings: 0, lastReading: reading.advertisedAt };
        }
        knots[name].readings += 1;

        if (!tags.includes(reading.macAddress)) {
            tags.push(reading.macAddress);
        }
    }

    const knotNames = Object.keys(knots).sort();
    document.getElementById("knotCount").textContent = knotNames.length;
    document.getElementById("tagCount").textContent = tags.length;
    document.getElementById("readingCount").textContent = readings.length;

    showLatest(readings);

    const table = document.getElementById("knotTable");
    table.textContent = "";

    if (knotNames.length === 0) {
        const row = table.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 3;
        cell.textContent = "No readings recorded yet.";
        return;
    }

    for (let i = 0; i < knotNames.length; i++) {
        const name = knotNames[i];
        const row = table.insertRow();
        row.insertCell().textContent = name;
        row.insertCell().textContent = knots[name].readings;
        row.insertCell().textContent = shortTime(knots[name].lastReading);
    }
}

// Shows the newest reading since Connect. If there isn't one yet,
// shows the most recent reading in all the data instead.
function showLatest(readings) {
    const latestTag = document.getElementById("latestTag");
    const latestDetails = document.getElementById("latestDetails");

    if (readings.length === 0) {
        latestTag.textContent = "No readings recorded yet";
        latestDetails.textContent = "";
        return;
    }

    // Both lists are newest first, so [0] is the latest
    const newReadings = onlyNewReadings(readings);
    let latest = readings[0];
    let label = "No new readings since you connected - most recent recorded: ";
    if (newReadings.length > 0) {
        latest = newReadings[0];
        label = "New: ";
    }

    latestTag.textContent = label + show(latest.tagName);
    latestDetails.textContent = "RSSI " + show(latest.rssi) + " | " + show(latest.knotName) +
        " | " + shortTime(latest.advertisedAt);
}
