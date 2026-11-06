//live.js
// the Live page, checks every second and adds new readings to the table with the newest at the top

const refreshTime = 1;  // seconds between refreshes
// stops the saved rows growing forever so the browser storage doesnt fill up
const maxLiveRows = 5000;
// colours for the dots, each tag keeps the same one
const dotColours = ["#c93d8a", "#2f6fdb", "#12877a", "#e0861a", "#7a4fc4", "#b5522b"];

const liveStatus = document.getElementById("liveStatus");
const connectionPill = document.getElementById("connectionPill");

let loading = false;
let hasData = false;
let paused = false;
// these have to be up here because the code below can draw the table as soon as the page loads
let liveReadings = loadLiveReadings();
let tableDrawn = false;

const pauseButton = document.getElementById("pauseButton");
pauseButton.addEventListener("click", togglePause);

// only loads once they have pressed Connect on the overview page
if (isConnected()) {
    pauseButton.hidden = false;
    connectionPill.hidden = false;
    setStatus("Loading...", "Connecting");
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


// sets the status text and the pill, it only goes green when its actually connected
function setStatus(text, pillText) {
    const connected = pillText === "Connected";
    liveStatus.textContent = text;
    connectionPill.textContent = pillText;
    if (connected) {
        liveStatus.className = "connected";
        connectionPill.className = "";
    } else {
        liveStatus.className = "";
        connectionPill.className = "pillOff";
    }
}


async function loadLive() {
    if (loading || paused) {
        return;
    }
    loading = true;

    try {
        const data = await getData();
        //pause might have been pressed while it was loading
        if (!paused) {
            showLive(data.readings);
            hasData = true;
            setStatus("Connected, updating every second", "Connected");
        }
    } catch (error) {
        if (paused) {
            // stays on Paused, any problem shows after Resume
        } else if (hasData) {
            setStatus("Could not refresh - showing older data. " + error.message, "Connection lost");
        } else {
            setStatus("Could not load data. " + error.message, "Connection lost");
        }
    }

    loading = false;
}


// pause stops the table changing so you can read it, resume loads straight away
function togglePause() {
    paused = !paused;
    if (paused) {
        pauseButton.textContent = "Resume";
        setStatus("Paused", "Paused");
    } else {
        pauseButton.textContent = "Pause";
        loadLive();
    }
}


// the rows are saved in the browser so they stay after a refresh, Disconnect clears them
function loadLiveReadings() {
    try {
        return JSON.parse(localStorage.getItem("liveReadings")) || [];
    } catch (error) {
        return [];
    }
}

// a reading only gets picked up if its under 10 mins old when we first see it, then it stays
// returns true if any got added
function addLiveReadings(allReadings) {
    // the ids already in the table so the same reading doesnt get added twice
    // a Set is like a Python set, an object would break on an id like "__proto__"
    const ids = new Set();
    for (let i = 0; i < liveReadings.length; i++) {
        ids.add(liveReadings[i].id);
    }
    let added = false;

    //if Live is open in another tab it might have saved rows this one doesnt have, add those first
    const saved = loadLiveReadings();
    for (let i = 0; i < saved.length; i++) {
        if (saved[i].id && !ids.has(saved[i].id)) {
            ids.add(saved[i].id);
            liveReadings.push(saved[i]);
            added = true;
        }
    }

    const readings = onlyNewReadings(allReadings);
    for (let i = 0; i < readings.length; i++) {
        if (readings[i].id && !ids.has(readings[i].id)) {
            ids.add(readings[i].id);
            liveReadings.push(readings[i]);
            added = true;
        }
    }

    if (added) {
        sortNewestFirst(liveReadings);
        liveReadings = liveReadings.slice(0, maxLiveRows);
        try {
            localStorage.setItem("liveReadings", JSON.stringify(liveReadings));
        } catch (error) {
            // storage might be blocked or full, the rows still show until the page closes
        }
    }
    return added;
}


function showLive(allReadings) {
    const added = addLiveReadings(allReadings);
    // rows dont change once theyre there so only redraw when theres something new
    if (tableDrawn && !added) {
        return;
    }
    tableDrawn = true;

    const table = document.getElementById("liveTable");
    table.textContent = "";

    if (liveReadings.length === 0) {
        const row = table.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 5;
        cell.textContent = "No live readings yet. Readings under " + liveMinutes + " minutes old will show here.";
        return;
    }

    for (let i = 0; i < liveReadings.length; i++) {
        const reading = liveReadings[i];
        const row = table.insertRow();
        // newest first so the first row is the latest
        if (i === 0) {
            row.className = "newest";
        }

        const timeCell = row.insertCell();
        timeCell.className = "timeCell";
        // the time AWS saved it, "2026-10-19 18:19:04" shows as "18:19:04"
        timeCell.textContent = show(perthTime(reading.createdAt).slice(11));

        addAnimalCell(row, reading);
        row.insertCell().textContent = show(reading.knotName);
        addSignalCell(row, reading.rssi);

        const batteryCell = row.insertCell();
        batteryCell.textContent = battery(reading.advertisement);
        batteryCell.className = "batteryCell";
        if (parseInt(batteryCell.textContent) < lowBattery) {
            batteryCell.className = "batteryCell statusMissing";
        }
    }
}


// the coloured dot then the tag's name
function addAnimalCell(row, reading) {
    const cell = row.insertCell();
    cell.className = "animalCell";

    // adds up the letters of the MAC to pick a colour so each tag always gets the same one
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


// 4 bars like a phone's signal, -50 dBm is strong and -90 dBm is weak
function addSignalCell(row, rssi) {
    const cell = row.insertCell();
    cell.className = "signalCell";

    const signal = parseFloat(rssi);
    if (isNaN(signal)) {
        cell.textContent = "-";
        return;
    }

    let barsOn = 1;
    if (signal >= -55) {
        barsOn = 4;
    } else if (signal >= -65) {
        barsOn = 3;
    } else if (signal >= -75) {
        barsOn = 2;
    }

    // 4 small spans, the ones with "on" get coloured in style.css
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
