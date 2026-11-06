//explorer.js
// the Explorer page, filter the readings by knot, tag and date and download them as a CSV

const refreshTime = 5;  // seconds between refreshes

const knotBoxes = document.getElementById("knotBoxes");
const tagBoxes = document.getElementById("tagBoxes");
const filterFrom = document.getElementById("filterFrom");
const filterTo = document.getElementById("filterTo");
const explorerCount = document.getElementById("explorerCount");
const exportMessage = document.getElementById("exportMessage");

let loading = false;
let allReadings = [];    // every reading we have
let shownReadings = [];  // only the ones that match the filters

// the tick box lists from last time so they only get rebuilt when something changes
let lastKnotList = "";
let lastTagList = "";

// redraw whenever a filter changes, one listener on the div covers all the tick boxes inside it
knotBoxes.addEventListener("change", showExplorer);
tagBoxes.addEventListener("change", showExplorer);
filterFrom.addEventListener("change", showExplorer);
filterTo.addEventListener("change", showExplorer);
document.getElementById("clearButton").addEventListener("click", clearFilters);
document.getElementById("exportButton").addEventListener("click", exportCSV);

// only loads once they have pressed Connect on the overview page
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


// fills the knot and tag tick boxes with no repeats
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

    //join() turns the list into text so two lists can be compared
    if (knotNames.join() !== lastKnotList) {
        lastKnotList = knotNames.join();
        fillBoxes(knotBoxes, knotNames.slice(), knotNames.slice());
    }

    if (macs.join() !== lastTagList) {
        lastTagList = macs.join();
        // each tag shows as its name then its MAC
        const labels = [];
        for (let i = 0; i < macs.length; i++) {
            labels.push(tagNames[macs[i]] + " (" + macs[i] + ")");
        }
        fillBoxes(tagBoxes, macs, labels);
    }
}


// the values of the ticked boxes in a div
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


// remakes the tick boxes but keeps the ones that were ticked
function fillBoxes(container, values, labels) {
    const ticked = getTicked(container);

    // if a ticked one isnt in the data anymore keep it so the filter doesnt change by itself
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

        // box goes inside the label so clicking the text ticks it too
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


// shows the readings that match all the filters, nothing ticked in a list means that list doesnt filter
function showExplorer() {
    const knots = getTicked(knotBoxes);
    const tags = getTicked(tagBoxes);
    shownReadings = [];

    for (let i = 0; i < allReadings.length; i++) {
        const reading = allReadings[i];
        // uses the time AWS saved it because the KNOT's clock (advertisedAt) can be days out
        // dates like "2026-10-19" can be compared as text, the same format the date boxes use
        const day = perthTime(reading.createdAt).slice(0, 10);

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


// makes one value safe for a CSV cell
function csvCell(value) {
    if (value === null || value === undefined) {
        return "";
    }
    let text = String(value);

    // anyone can post to the API so text starting with = + - @ could run as a formula in Excel,
    // a ' in front stops that. numbers like RSSI -71 are left alone
    if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) {
        text = "'" + text;
    }

    //commas, quotes or new lines would break the columns so they get wrapped in quotes
    if (/[",\r\n]/.test(text)) {
        text = '"' + text.replace(/"/g, '""') + '"';
    }
    return text;
}


// downloads whatever is in the table as a CSV
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

    // makes the file in the browser then clicks a hidden link to download it
    const file = new Blob([lines.join("\r\n")], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(file);
    link.download = "readings.csv";
    link.click();

    exportMessage.textContent = "Exported " + shownReadings.length + " readings to readings.csv";
}
