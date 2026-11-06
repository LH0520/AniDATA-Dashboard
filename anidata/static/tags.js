//tags.js
// the Tags page, one row per tag and per knot showing if its Active or Missing, plus a search box

const refreshTime = 15;  // seconds between refreshes

const deviceCount = document.getElementById("deviceCount");
const searchBox = document.getElementById("searchBox");

let loading = false;
let hasData = false;
// keeps the last readings so the search box can redraw without reloading
let lastReadings = [];

//runs every time a letter is typed in the search box
searchBox.addEventListener("input", function () {
    showTags(lastReadings);
});

// only loads once they have pressed Connect on the overview page
if (isConnected()) {
    const saved = getSavedData();
    if (saved !== null) {
        showTags(saved.readings);
        hasData = true;
    }
    loadTags();
    setInterval(loadTags, refreshTime * 1000);
} else {
    deviceCount.textContent = "Not connected. Press Connect on the Dashboard Overview page first.";
}


async function loadTags() {
    if (loading) {
        return;
    }
    loading = true;

    try {
        const data = await getData();
        showTags(data.readings);
        hasData = true;
    } catch (error) {
        if (hasData) {
            deviceCount.textContent = "Could not refresh - showing older data. " + error.message;
        } else {
            deviceCount.textContent = "Could not load data. " + error.message;
        }
    }

    loading = false;
}


// the status cell, green for Active and red for Missing (classes are in style.css)
function addStatusCell(row, seconds) {
    const cell = row.insertCell();
    const status = tagStatus(seconds);
    cell.textContent = status;
    if (status === "Active") {
        cell.className = "statusActive";
    } else if (status === "Missing") {
        cell.className = "statusMissing";
    }
}

// true if the search box is empty or any of the texts have what was typed, ignores capitals
function matchesSearch(texts) {
    const search = searchBox.value.trim().toLowerCase();
    if (search === "") {
        return true;
    }
    for (let i = 0; i < texts.length; i++) {
        if (String(texts[i] || "").toLowerCase().includes(search)) {
            return true;
        }
    }
    return false;
}


// shows every tag and knot in all the readings not just the new ones
function showTags(readings) {
    lastReadings = readings;

    // tags has the newest reading for each MAC so each tag only shows once
    // knots has each knot name with how many readings it sent and its newest one
    const tags = {};
    const knots = {};

    for (let i = 0; i < readings.length; i++) {
        const reading = readings[i];
        //skip junk readings with no MAC
        if (!reading.macAddress) {
            continue;
        }
        const mac = reading.macAddress;
        const knotName = show(reading.knotName);

        // readings are newest first so the first one for each tag or knot is its latest
        if (tags[mac] === undefined) {
            tags[mac] = reading;
        }

        if (knots[knotName] === undefined) {
            knots[knotName] = { readings: 0, latest: reading };
        }
        knots[knotName].readings += 1;
    }

    const macs = Object.keys(tags).sort();
    const knotNames = Object.keys(knots).sort();

    deviceCount.textContent = macs.length + " tags and " + knotNames.length + " knots recorded. Updated " +
        new Date().toLocaleTimeString("en-AU");

    // tags table, one row per tag that matches the search
    const tagTable = document.getElementById("tagTable");
    tagTable.textContent = "";
    for (let i = 0; i < macs.length; i++) {
        const latest = tags[macs[i]];
        if (!matchesSearch([latest.tagName, macs[i], latest.knotName])) {
            continue;
        }
        const seconds = secondsAgo(latest);
        const row = tagTable.insertRow();
        row.insertCell().textContent = show(latest.tagName);
        row.insertCell().textContent = macs[i];
        addStatusCell(row, seconds);
        row.insertCell().textContent = perthTime(latest.createdAt);
        row.insertCell().textContent = agoText(seconds);
        row.insertCell().textContent = show(latest.rssi);
        const batteryCell = row.insertCell();
        batteryCell.textContent = battery(latest.advertisement);
        // parseInt("87%") gives 87, "-" gives NaN which is never under the limit
        if (parseInt(batteryCell.textContent) < lowBattery) {
            batteryCell.className = "statusMissing";
        }
        row.insertCell().textContent = show(latest.knotName);
    }
    if (tagTable.rows.length === 0) {
        const cell = tagTable.insertRow().insertCell();
        cell.colSpan = 8;
        cell.textContent = "No tags match.";
    }

    //knots table, same idea
    const knotTable = document.getElementById("deviceKnotTable");
    knotTable.textContent = "";
    for (let i = 0; i < knotNames.length; i++) {
        const knot = knots[knotNames[i]];
        if (!matchesSearch([knotNames[i], knot.latest.tagName])) {
            continue;
        }
        const seconds = secondsAgo(knot.latest);
        const row = knotTable.insertRow();
        row.insertCell().textContent = knotNames[i];
        addStatusCell(row, seconds);
        row.insertCell().textContent = knot.readings;
        row.insertCell().textContent = perthTime(knot.latest.createdAt);
        row.insertCell().textContent = agoText(seconds);
        row.insertCell().textContent = show(knot.latest.tagName);
    }
    if (knotTable.rows.length === 0) {
        const cell = knotTable.insertRow().insertCell();
        cell.colSpan = 6;
        cell.textContent = "No knots match.";
    }
}
