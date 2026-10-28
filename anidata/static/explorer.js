const refreshTime = 5;

const knotBoxes = document.getElementById("knotBoxes");
const tagBoxes = document.getElementById("tagBoxes");
const filterFrom = document.getElementById("filterFrom");
const filterTo = document.getElementById("filterTo");
const explorerCount = document.getElementById("explorerCount");
const exportMessage = document.getElementById("exportMessage");

let loading = false;
let allReadings = [];
let shownReadings = [];

// The tick box lists from the last refresh, so they're only rebuilt when something changes
let lastKnotList = "";
let lastTagList = "";

// A "change" on any tick box inside the div bubbles up to the div, so one listener covers them all
knotBoxes.addEventListener("change", showExplorer);
tagBoxes.addEventListener("change", showExplorer);
filterFrom.addEventListener("change", showExplorer);
filterTo.addEventListener("change", showExplorer);
document.getElementById("clearButton").addEventListener("click", clearFilters);
document.getElementById("exportButton").addEventListener("click", exportCSV);

// Only load anything once the user has pressed Connect on the overview page
if (isConnected()) {
    const saved = getSavedData();
    if (saved !== null) {
        allReadings = saved.readings;
        fillFilters();
        showExplorer();
    }
    loadExplorer();
    setInterval(loadExplorer, refreshTime * 1000);
} else {
    explorerCount.textContent = "Not connected. Press Connect on the Dashboard Overview page first.";
}


async function loadExplorer() {
    if (loading) {
        return;
    }
    loading = true;

    try {
        const data = await getData();
        allReadings = data.readings;
        fillFilters();
        showExplorer();
    } catch (error) {
        explorerCount.textContent = "Could not refresh - showing older data. " + error.message;
    }

    loading = false;
}


// Fills the knot and tag tick boxes from every reading, with no repeats
function fillFilters() {
    const knotNames = [];
    const tagNames = {};  // MAC address -> tag name

    for (let i = 0; i < allReadings.length; i++) {
        const reading = allReadings[i];
        if (reading.knotName && !knotNames.includes(reading.knotName)) {
            knotNames.push(reading.knotName);
        }
        if (reading.macAddress && tagNames[reading.macAddress] === undefined) {
            tagNames[reading.macAddress] = show(reading.tagName);
        }
    }

    knotNames.sort();
    const macs = Object.keys(tagNames).sort();

    if (knotNames.join() !== lastKnotList) {
        lastKnotList = knotNames.join();
        // slice() makes a copy, so the values and labels are two separate lists
        fillBoxes(knotBoxes, knotNames.slice(), knotNames.slice());
    }

    if (macs.join() !== lastTagList) {
        lastTagList = macs.join();
        const labels = [];
        for (let i = 0; i < macs.length; i++) {
            labels.push(tagNames[macs[i]] + " (" + macs[i] + ")");
        }
        fillBoxes(tagBoxes, macs, labels);
    }
}


// The values of the ticked boxes inside a div
function getTicked(container) {
    const ticked = [];
    const boxes = container.querySelectorAll("input");
    for (let i = 0; i < boxes.length; i++) {
        if (boxes[i].checked) {
            ticked.push(boxes[i].value);
        }
    }
    return ticked;
}


// Replaces the tick boxes in a div but keeps the ones the user had ticked
function fillBoxes(container, values, labels) {
    const ticked = getTicked(container);

    // If a ticked one has dropped out of the data, keep it so the filter doesn't change by itself
    for (let i = 0; i < ticked.length; i++) {
        if (!values.includes(ticked[i])) {
            values.push(ticked[i]);
            labels.push(ticked[i]);
        }
    }

    container.textContent = "";
    for (let i = 0; i < values.length; i++) {
        const box = document.createElement("input");
        box.type = "checkbox";
        box.value = values[i];
        box.checked = ticked.includes(values[i]);

        // Putting the box inside the label means clicking the text ticks it too
        const label = document.createElement("label");
        label.append(box, " " + labels[i]);
        container.append(label, " ");
    }
}


function clearFilters() {
    const boxes = document.querySelectorAll("#knotBoxes input, #tagBoxes input");
    for (let i = 0; i < boxes.length; i++) {
        boxes[i].checked = false;
    }
    filterFrom.value = "";
    filterTo.value = "";
    showExplorer();
}


// Shows the readings that match all the filters.
// No boxes ticked in a list means that list doesn't filter anything.
function showExplorer() {
    const knots = getTicked(knotBoxes);
    const tags = getTicked(tagBoxes);
    shownReadings = [];

    for (let i = 0; i < allReadings.length; i++) {
        const reading = allReadings[i];
        // advertisedAt starts with the date, e.g. "2026-10-19", the same format the date boxes use
        const day = String(reading.advertisedAt || "").slice(0, 10);

        if (knots.length > 0 && !knots.includes(reading.knotName)) {
            continue;
        }
        if (tags.length > 0 && !tags.includes(reading.macAddress)) {
            continue;
        }
        if (filterFrom.value !== "" && day < filterFrom.value) {
            continue;
        }
        if (filterTo.value !== "" && day > filterTo.value) {
            continue;
        }
        shownReadings.push(reading);
    }

    explorerCount.textContent = "Showing " + shownReadings.length + " of " + allReadings.length +
        " readings. Updated " + new Date().toLocaleTimeString("en-AU");

    const table = document.getElementById("explorerTable");
    table.textContent = "";

    if (shownReadings.length === 0) {
        const row = table.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 8;
        cell.textContent = "No readings match these filters.";
        return;
    }

    for (let i = 0; i < shownReadings.length; i++) {
        const reading = shownReadings[i];
        const row = table.insertRow();
        row.insertCell().textContent = shortTime(reading.advertisedAt);
        row.insertCell().textContent = show(reading.tagName);
        row.insertCell().textContent = show(reading.macAddress);
        row.insertCell().textContent = show(reading.rssi);
        row.insertCell().textContent = show(reading.knotName);
        row.insertCell().textContent = perthTime(reading.createdAt);
        row.insertCell().textContent = show(reading.advertisement);
        row.insertCell().textContent = show(reading.id);
    }
}


// Makes one value safe to put in a CSV cell
function csvCell(value) {
    if (value === null || value === undefined) {
        return "";
    }
    let text = String(value);

    // Anyone can post to the API, so text starting with = + - @ could run as a
    // formula in Excel. A ' in front stops that. Numbers like RSSI -71 are left alone.
    if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) {
        text = "'" + text;
    }

    // Commas, quotes or new lines would break the columns, so wrap those in quotes
    if (/[",\r\n]/.test(text)) {
        text = '"' + text.replace(/"/g, '""') + '"';
    }
    return text;
}


// Downloads the readings currently in the table as a CSV file,
// with the times in the same "2026-10-19 18:24" format as the table
function exportCSV() {
    if (shownReadings.length === 0) {
        exportMessage.textContent = "Nothing to export - no readings match these filters.";
        return;
    }

    const lines = ["Seen at,Tag,MAC address,RSSI,Knot,Recorded at,Advertisement,ID"];

    for (let i = 0; i < shownReadings.length; i++) {
        const reading = shownReadings[i];
        const values = [
            shortTime(reading.advertisedAt),
            reading.tagName,
            reading.macAddress,
            reading.rssi,
            reading.knotName,
            perthTime(reading.createdAt),
            reading.advertisement,
            reading.id,
        ];

        const cells = [];
        for (let j = 0; j < values.length; j++) {
            cells.push(csvCell(values[j]));
        }
        lines.push(cells.join(","));
    }

    const file = new Blob([lines.join("\r\n")], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(file);
    link.download = "readings.csv";
    link.click();

    exportMessage.textContent = "Exported " + shownReadings.length + " readings to readings.csv";
}
