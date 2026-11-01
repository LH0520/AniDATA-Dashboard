const refreshTime = 15;

const deviceCount = document.getElementById("deviceCount");
const searchBox = document.getElementById("searchBox");
const nicknameTag = document.getElementById("nicknameTag");
const nicknameText = document.getElementById("nicknameText");
const nicknameButton = document.getElementById("nicknameButton");
const nicknameMessage = document.getElementById("nicknameMessage");

let loading = false;
let hasData = false;
// The last readings we got, so the search box can redraw the tables without reloading
let lastReadings = [];

searchBox.addEventListener("input", function () {
    showTags(lastReadings);
});
nicknameTag.addEventListener("change", fillNicknameBox);
nicknameButton.addEventListener("click", saveNickname);

// Only load anything once the user has pressed Connect on the overview page
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


// Adds the Status cell, coloured by the class in style.css
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

// True if the search box is empty, or any of the texts contain what was typed
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


// Shows every tag and knot in all the readings, not just the new ones
function showTags(readings) {
    lastReadings = readings;

    // tags holds the newest reading for each MAC address, so each tag is only listed once.
    // knots holds one entry per knot name: how many readings it sent and its newest one.
    const tags = {};
    const knots = {};

    for (let i = 0; i < readings.length; i++) {
        const reading = readings[i];
        // Skip junk readings with no MAC address
        if (!reading.macAddress) {
            continue;
        }
        const mac = reading.macAddress;
        const knotName = show(reading.knotName);

        // The readings are newest first, so the first one for each tag or knot is its latest
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

    fillNicknameList(macs, tags);

    const tagTable = document.getElementById("tagTable");
    tagTable.textContent = "";
    for (let i = 0; i < macs.length; i++) {
        const latest = tags[macs[i]];
        if (!matchesSearch([latest.tagName, latest.originalName, macs[i], latest.knotName])) {
            continue;
        }
        const seconds = secondsAgo(latest);
        const row = tagTable.insertRow();
        row.insertCell().textContent = show(latest.tagName);
        row.insertCell().textContent = macs[i];
        addStatusCell(row, seconds);
        row.insertCell().textContent = shortTime(latest.advertisedAt);
        row.insertCell().textContent = agoText(seconds);
        row.insertCell().textContent = show(latest.rssi);
        const batteryCell = row.insertCell();
        batteryCell.textContent = battery(latest.advertisement);
        // parseInt("87%") is 87. "-" gives NaN, which is never under the limit.
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
        row.insertCell().textContent = shortTime(knot.latest.advertisedAt);
        row.insertCell().textContent = agoText(seconds);
        row.insertCell().textContent = show(knot.latest.tagName);
    }
    if (knotTable.rows.length === 0) {
        const cell = knotTable.insertRow().insertCell();
        cell.colSpan = 6;
        cell.textContent = "No knots match.";
    }
}


// Nicknames

// Fills the Tag drop-down, keeping whichever tag was picked
function fillNicknameList(macs, tags) {
    const picked = nicknameTag.value;
    nicknameTag.textContent = "";

    for (let i = 0; i < macs.length; i++) {
        const option = document.createElement("option");
        option.value = macs[i];
        option.textContent = show(tags[macs[i]].tagName) + " (" + macs[i] + ")";
        nicknameTag.appendChild(option);
    }

    if (macs.includes(picked)) {
        nicknameTag.value = picked;
    } else {
        fillNicknameBox();
    }
}

// Puts the picked tag's current nickname in the text box (empty if it has none)
function fillNicknameBox() {
    nicknameText.value = "";
    for (let i = 0; i < lastReadings.length; i++) {
        const reading = lastReadings[i];
        if (reading.macAddress === nicknameTag.value) {
            if (reading.tagName !== reading.originalName) {
                nicknameText.value = reading.tagName;
            }
            return;
        }
    }
}

function saveNickname() {
    if (nicknameTag.value === "") {
        nicknameMessage.textContent = "There are no tags to nickname yet.";
        return;
    }

    if (setNickname(nicknameTag.value, nicknameText.value)) {
        nicknameMessage.textContent = "Saved.";
    } else {
        nicknameMessage.textContent = "Could not save - this browser is blocking storage.";
    }

    // Redraw from the saved data so the new name shows straight away
    const saved = getSavedData();
    if (saved !== null) {
        showTags(saved.readings);
    }
}
