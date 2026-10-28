const refreshTime = 5;
const rowsToShow = 20;

const liveStatus = document.getElementById("liveStatus");

let loading = false;
let hasData = false;

// Only load anything once the user has pressed Connect on the overview page
if (isConnected()) {
    const saved = getSavedData();
    if (saved !== null) {
        showLive(saved.readings);
        hasData = true;
        liveStatus.textContent = "Updates every " + refreshTime + " seconds. Loading...";
    }
    loadLive();
    setInterval(loadLive, refreshTime * 1000);
} else {
    liveStatus.textContent = "Not connected. Press Connect on the Dashboard Overview page first.";
}


async function loadLive() {
    if (loading) {
        return;
    }
    loading = true;

    try {
        const data = await getData();
        showLive(data.readings);
        hasData = true;
        liveStatus.textContent = "Updates every " + refreshTime + " seconds. Last updated " +
            new Date().toLocaleTimeString("en-AU");
    } catch (error) {
        if (hasData) {
            liveStatus.textContent = "Could not refresh - showing older data. " + error.message;
        } else {
            liveStatus.textContent = "Could not load data. " + error.message;
        }
    }

    loading = false;
}


// How long ago a reading was seen.
// advertisedAt has no timezone so this assumes it is Perth time (+08:00)
function timeAgo(text) {
    if (!text) {
        return "-";
    }
    const date = new Date(text + "+08:00");
    if (isNaN(date.getTime())) {
        return "-";
    }

    let seconds = Math.round((new Date() - date) / 1000);
    if (seconds < 0) {
        seconds = 0;
    }
    if (seconds < 60) {
        return seconds + " sec ago";
    }
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
        return minutes + " min ago";
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
        return hours + " h ago";
    }
    return Math.floor(hours / 24) + " d ago";
}


function showLive(allReadings) {
    // Drop anything from before the user pressed Connect
    const readings = onlyNewReadings(allReadings);

    const table = document.getElementById("liveTable");
    table.textContent = "";

    if (readings.length === 0) {
        document.getElementById("liveTag").textContent = "No new readings yet";
        document.getElementById("liveDetails").textContent = "";

        const row = table.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 5;
        cell.textContent = "No readings since you connected.";
        return;
    }

    // the readings are newest first, so the first one is the latest
    const latest = readings[0];
    document.getElementById("liveTag").textContent = show(latest.tagName);
    document.getElementById("liveDetails").textContent =
        "RSSI " + show(latest.rssi) + " | " + show(latest.knotName) + " | " + shortTime(latest.advertisedAt);

    for (let i = 0; i < readings.length && i < rowsToShow; i++) {
        const reading = readings[i];
        const row = table.insertRow();
        row.insertCell().textContent = shortTime(reading.advertisedAt);
        row.insertCell().textContent = timeAgo(reading.advertisedAt);
        row.insertCell().textContent = show(reading.tagName);
        row.insertCell().textContent = show(reading.knotName);
        row.insertCell().textContent = show(reading.rssi);
    }
}
