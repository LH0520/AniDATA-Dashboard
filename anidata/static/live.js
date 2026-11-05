// live.js - the Live Monitoring page (live.html).
// Checks for new readings every second and adds them to a table, newest at the top.
// Each row shows the time, the animal (tag), the knot, the signal strength and the battery.

const refreshTime = 1;  // seconds between refreshes
// Saved rows stop growing here so the browser's storage can't fill up
const maxLiveRows = 5000;
// Each tag keeps the same dot colour
const dotColours = ["#c93d8a", "#2f6fdb", "#12877a", "#e0861a", "#7a4fc4", "#b5522b"];

// Get the parts of the page we need, using their id from live.html
const liveStatus = document.getElementById("liveStatus");
const connectionPill = document.getElementById("connectionPill");

let loading = false;     // true while waiting for the server
let hasData = false;     // true once we have shown some data
let paused = false;      // true while the Pause button is on
// Up here because the code just below can draw the table as soon as the page loads
let liveReadings = loadLiveReadings();
let tableDrawn = false;  // true once the table has been drawn at least once

const pauseButton = document.getElementById("pauseButton");
pauseButton.addEventListener("click", togglePause);

// Only load anything once the user has pressed Connect on the overview page
if (isConnected()) {
    pauseButton.hidden = false;
    connectionPill.hidden = false;
    setStatus("Loading...", "Connecting");
    // Show the saved data straight away, then get new data
    const saved = getSavedData();
    if (saved !== null) {
        showLive(saved.readings);
        hasData = true;
    }
    loadLive();
    setInterval(loadLive, refreshTime * 1000);
} else {
    liveStatus.textContent = "Not connected. Press Connect on the Overview page first.";
}


// Sets the status text and the pill at the top right.
// The pill only goes green, and the dot only shows, when it really is connected.
function setStatus(text, pillText) {
    const connected = pillText === "Connected";
    liveStatus.textContent = text;
    connectionPill.textContent = pillText;
    // The classes are styled in style.css
    if (connected) {
        liveStatus.className = "connected";
        connectionPill.className = "";
    } else {
        liveStatus.className = "";
        connectionPill.className = "pillOff";
    }
}


// Gets new data from the server and adds any new readings to the table
async function loadLive() {
    if (loading || paused) {
        return;
    }
    loading = true;

    try {
        const data = await getData();
        // Pause might have been pressed while this was loading
        if (!paused) {
            showLive(data.readings);
            hasData = true;
            setStatus("Connected, updating every second", "Connected");
        }
    } catch (error) {
        if (paused) {
            // Stay on "Paused". The next refresh after Resume will show any problem.
        } else if (hasData) {
            setStatus("Could not refresh - showing older data. " + error.message, "Connection lost");
        } else {
            setStatus("Could not load data. " + error.message, "Connection lost");
        }
    }

    loading = false;
}


// Pause stops the table changing so you can read it. Resume loads straight away.
function togglePause() {
    paused = !paused;  // flips true to false, or false to true
    if (paused) {
        pauseButton.textContent = "Resume";
        setStatus("Paused", "Paused");
    } else {
        pauseButton.textContent = "Pause";
        loadLive();
    }
}


// Rows are saved in this browser so they stay after a refresh or closing it.
// Disconnect clears them.
function loadLiveReadings() {
    try {
        // "|| []" gives an empty list if nothing has been saved yet
        return JSON.parse(localStorage.getItem("liveReadings")) || [];
    } catch (error) {
        return [];
    }
}

// A reading is only picked up if it's under 10 minutes old when we first see it.
// After that it stays. Returns true if any were added.
function addLiveReadings(allReadings) {
    // Make a note of the ids already in the table, so the same reading isn't added twice.
    // The object is used like a Python dictionary: ids["abc"] = true
    const ids = {};
    for (let i = 0; i < liveReadings.length; i++) {
        ids[liveReadings[i].id] = true;
    }

    const readings = onlyNewReadings(allReadings);
    let added = false;
    for (let i = 0; i < readings.length; i++) {
        if (readings[i].id && ids[readings[i].id] !== true) {
            ids[readings[i].id] = true;
            // Make a copy of the reading, so changing it below doesn't change the original
            const reading = JSON.parse(JSON.stringify(readings[i]));
            // Save the API's name, so a nickname changed later still shows on this row
            reading.tagName = reading.originalName;
            liveReadings.push(reading);
            added = true;
        }
    }

    if (added) {
        sortNewestFirst(liveReadings);
        liveReadings = liveReadings.slice(0, maxLiveRows);
        try {
            localStorage.setItem("liveReadings", JSON.stringify(liveReadings));
        } catch (error) {
            // Storage can be blocked or full. The rows still show until the page closes.
        }
    }
    return added;
}


// Adds any new readings, then redraws the live table
function showLive(allReadings) {
    const added = addLiveReadings(allReadings);
    // Nothing on a row changes once it's there, so only redraw when there's something new
    if (tableDrawn && !added) {
        return;
    }
    tableDrawn = true;

    // Empty the table before adding the rows again
    const table = document.getElementById("liveTable");
    table.textContent = "";

    if (liveReadings.length === 0) {
        const row = table.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 5;  // one cell stretched across all 5 columns
        cell.textContent = "No live readings yet. Readings under " + liveMinutes + " minutes old will show here.";
        return;
    }

    // Work on a copy, because addNicknames changes the names
    const readings = addNicknames({ readings: JSON.parse(JSON.stringify(liveReadings)) }).readings;

    for (let i = 0; i < readings.length; i++) {
        const reading = readings[i];
        const row = table.insertRow();
        // the readings are newest first, so the first row is the latest
        if (i === 0) {
            row.className = "newest";
        }

        const timeCell = row.insertCell();
        timeCell.className = "timeCell";
        // "2026-10-19T18:19:04" shows as "18:19:04"
        timeCell.textContent = show(String(reading.advertisedAt || "").slice(11, 19));

        addAnimalCell(row, reading);
        row.insertCell().textContent = show(reading.knotName);
        addSignalCell(row, reading.rssi);

        const batteryCell = row.insertCell();
        batteryCell.textContent = battery(reading.advertisement);
        batteryCell.className = "batteryCell";
        // parseInt("87%") is 87. "-" gives NaN, which is never under the limit.
        if (parseInt(batteryCell.textContent) < lowBattery) {
            batteryCell.className = "batteryCell statusMissing";
        }
    }
}


// Adds the Animal cell: a coloured dot followed by the tag's name
function addAnimalCell(row, reading) {
    const cell = row.insertCell();
    cell.className = "animalCell";

    // Add up the letters of the MAC to pick a colour, so a nickname doesn't change it.
    // charCodeAt gives each character's number, and % (remainder) keeps it inside the list.
    const mac = String(reading.macAddress || "");
    let total = 0;
    for (let i = 0; i < mac.length; i++) {
        total += mac.charCodeAt(i);
    }
    const dot = document.createElement("span");
    dot.className = "animalDot";
    dot.style.backgroundColor = dotColours[total % dotColours.length];

    cell.appendChild(dot);
    cell.appendChild(document.createTextNode(show(reading.tagName)));
}


// Four bars, like a phone's signal. -50 dBm is strong and -90 dBm is weak.
function addSignalCell(row, rssi) {
    const cell = row.insertCell();
    cell.className = "signalCell";

    const signal = parseFloat(rssi);
    if (isNaN(signal)) {
        cell.textContent = "-";
        return;
    }

    // Work out how many of the 4 bars to light up
    let barsOn = 1;
    if (signal >= -55) {
        barsOn = 4;
    } else if (signal >= -65) {
        barsOn = 3;
    } else if (signal >= -75) {
        barsOn = 2;
    }

    // Make 4 small spans. The ones with class "on" are coloured in style.css.
    const bars = document.createElement("span");
    bars.className = "signalBars";
    for (let i = 0; i < 4; i++) {
        const bar = document.createElement("span");
        if (i < barsOn) {
            bar.className = "on";
        }
        bars.appendChild(bar);
    }

    cell.appendChild(bars);
    cell.appendChild(document.createTextNode(signal + " dBm"));
}
