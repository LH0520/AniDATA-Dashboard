// dash.js - the Dashboard Overview page (dash.html).
// Shows the Connect button, the totals (knots, tags, missing tags, readings),
// the latest reading, and a table of knots. Refreshes every 15 seconds.

// Get the parts of the page we need to change, using their id from dash.html
const connectButton = document.getElementById("connectButton");
const statusText = document.getElementById("statusText");
const errorText = document.getElementById("errorText");

const refreshTime = 15;  // seconds between refreshes
let loading = false;     // true while waiting for the server, so we don't ask twice at once
let hasData = false;     // true once we have shown some data
let timer = null;        // the repeating timer, so it is only started once

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

// Runs when the Connect button is clicked
function connect() {
    setConnected();
    loadAPI();
}

// Loads the data from the server and shows it. Also starts the refresh timer.
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

    // Start the timer once, even if the first try failed, so it keeps retrying.
    // setInterval runs loadAPI again every refreshTime seconds (it uses milliseconds).
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
    let missing = 0;

    for (let i = 0; i < readings.length; i++) {
        const reading = readings[i];
        const name = show(reading.knotName);

        // The readings are newest first, so the first one for each knot is its latest
        if (knots[name] === undefined) {
            knots[name] = { readings: 0, lastReading: reading.advertisedAt };
        }
        knots[name].readings += 1;

        // Skip junk readings with no MAC address, the same as the Tags page.
        // The first reading for each tag is its newest, so that one decides if it's missing.
        if (reading.macAddress && !tags.includes(reading.macAddress)) {
            tags.push(reading.macAddress);
            if (tagStatus(secondsAgo(reading)) === "Missing") {
                missing += 1;
            }
        }
    }

    // Put the totals on the page. Object.keys gives a list of the knot names.
    const knotNames = Object.keys(knots).sort();
    document.getElementById("knotCount").textContent = knotNames.length;
    document.getElementById("tagCount").textContent = tags.length;
    const missingCount = document.getElementById("missingCount");
    missingCount.textContent = missing;
    // Show the missing number in red (a class in style.css) if there are any
    if (missing > 0) {
        missingCount.className = "statusMissing";
    } else {
        missingCount.className = "";
    }
    document.getElementById("readingCount").textContent = readings.length;

    showLatest(readings);

    // Empty the knot table, then add one row per knot
    const table = document.getElementById("knotTable");
    table.textContent = "";

    if (knotNames.length === 0) {
        const row = table.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 3;  // one cell stretched across all 3 columns
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

// Shows the newest reading from the last 10 minutes. If there isn't one,
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
    let label = "No readings in the last " + liveMinutes + " minutes - most recent recorded: ";
    if (newReadings.length > 0) {
        latest = newReadings[0];
        label = "New: ";
    }

    latestTag.textContent = label + show(latest.tagName);
    latestDetails.textContent = "RSSI " + show(latest.rssi) + " | " + show(latest.knotName) +
        " | " + shortTime(latest.advertisedAt);
}
