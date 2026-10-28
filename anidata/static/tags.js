const refreshTime = 15;

const deviceCount = document.getElementById("deviceCount");

let loading = false;
let hasData = false;

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


// Shows every tag and knot in all the readings, not just the new ones
function showTags(readings) {
    // tags holds the newest reading for each MAC address, so each tag is only listed once.
    // knots holds one entry per knot name: how many readings it sent and its newest one.
    const tags = {};
    const knots = {};

    for (let i = 0; i < readings.length; i++) {
        const reading = readings[i];
        const mac = show(reading.macAddress);
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

    // Status and Ago are left as "-" for now, to be done later
    const tagTable = document.getElementById("tagTable");
    tagTable.textContent = "";
    for (let i = 0; i < macs.length; i++) {
        const latest = tags[macs[i]];
        const row = tagTable.insertRow();
        row.insertCell().textContent = show(latest.tagName);
        row.insertCell().textContent = macs[i];
        row.insertCell().textContent = "-";
        row.insertCell().textContent = shortTime(latest.advertisedAt);
        row.insertCell().textContent = "-";
        row.insertCell().textContent = show(latest.rssi);
        row.insertCell().textContent = battery(latest.advertisement);
        row.insertCell().textContent = show(latest.knotName);
    }

    const knotTable = document.getElementById("deviceKnotTable");
    knotTable.textContent = "";
    for (let i = 0; i < knotNames.length; i++) {
        const knot = knots[knotNames[i]];
        const row = knotTable.insertRow();
        row.insertCell().textContent = knotNames[i];
        row.insertCell().textContent = "-";
        row.insertCell().textContent = knot.readings;
        row.insertCell().textContent = shortTime(knot.latest.advertisedAt);
        row.insertCell().textContent = "-";
        row.insertCell().textContent = show(knot.latest.tagName);
    }
}
