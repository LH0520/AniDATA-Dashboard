//dash.js
// the Overview page, shows the Connect button, the totals, the latest reading and the knots table

const connectButton = document.getElementById("connectButton");
const statusText = document.getElementById("statusText");
const errorText = document.getElementById("errorText");

const refreshTime = 15;  // seconds between refreshes
let loading = false;     // stops it asking the server twice at once
let hasData = false;
let timer = null;        // so the timer only gets started once

connectButton.addEventListener("click", connect);

// if they already connected on another page, show the saved data straight away and keep refreshing
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

// loads the data and shows it, also starts the refresh timer
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
        // hide the button once it works, if the first try fails it stays so you can try again
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

    //start the timer even if the first try failed so it keeps retrying
    if (timer === null) {
        timer = setInterval(loadAPI, refreshTime * 1000);
    }
    loading = false;
    connectButton.disabled = false;
}

// counts every reading we have, not just the new ones
function showAPIdata(data) {
    const readings = data.readings;

    // knots has each knot name with how many readings it sent and its newest one
    // tags is the MAC addresses seen with no repeats
    const knots = {};
    const tags = [];
    let missing = 0;

    for (let i = 0; i < readings.length; i++) {
        const reading = readings[i];
        const name = show(reading.knotName);

        // readings are newest first so the first one for each knot is its latest
        if (knots[name] === undefined) {
            knots[name] = { readings: 0, lastReading: reading.createdAt };
        }
        knots[name].readings += 1;

        //skip junk readings with no MAC, the first one for each tag decides if its missing
        if (reading.macAddress && !tags.includes(reading.macAddress)) {
            tags.push(reading.macAddress);
            if (tagStatus(secondsAgo(reading)) === "Missing") {
                missing += 1;
            }
        }
    }

    const knotNames = Object.keys(knots).sort();
    document.getElementById("knotCount").textContent = knotNames.length;
    document.getElementById("tagCount").textContent = tags.length;
    const missingCount = document.getElementById("missingCount");
    missingCount.textContent = missing;
    // missing number goes red if there are any
    if (missing > 0) {
        missingCount.className = "statusMissing";
    } else {
        missingCount.className = "";
    }
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
        row.insertCell().textContent = perthTime(knots[name].lastReading);
    }
}

// shows the newest reading from the last 10 mins, if there isnt one it shows the most recent one we have
function showLatest(readings) {
    const latestTag = document.getElementById("latestTag");
    const latestDetails = document.getElementById("latestDetails");

    if (readings.length === 0) {
        latestTag.textContent = "No readings recorded yet";
        latestDetails.textContent = "";
        return;
    }

    const newReadings = onlyNewReadings(readings);
    let latest = readings[0];
    let label = "No readings in the last " + liveMinutes + " minutes - most recent recorded: ";
    if (newReadings.length > 0) {
        latest = newReadings[0];
        label = "New: ";
    }

    latestTag.textContent = label + show(latest.tagName);
    latestDetails.textContent = "RSSI " + show(latest.rssi) + " | " + show(latest.knotName) +
        " | " + perthTime(latest.createdAt);
}
