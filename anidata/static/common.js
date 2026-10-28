function show(value) {
    if (value === null || value === undefined || value === "") {
        return "-";
    }
    return String(value);
}

// advertisedAt is Perth time with no timezone, e.g. "2026-10-19T18:19:04".
// Shows it as "2026-10-19 18:19"
function shortTime(text) {
    if (!text) {
        return "-";
    }
    return String(text).slice(0, 16).replace("T", " ");
}

// createdAt is UTC, e.g. "2026-10-19T10:24:17.732273+00:00".
// Changes it to Perth time and shows it the same way, e.g. "2026-10-19 18:24"
function perthTime(text) {
    const date = new Date(text);
    if (!text || isNaN(date.getTime())) {
        return "-";
    }
    const perth = new Date(date.getTime() + 8 * 60 * 60 * 1000);
    return perth.toISOString().slice(0, 16).replace("T", " ");
}

// The last byte (last 2 hex characters) of a tag's advertisement is its battery.
// e.g. "...4747000057" ends in 57, which is 87 in decimal, so 87%
function battery(advertisement) {
    const lastByte = String(advertisement || "").slice(-2);
    // Anyone can post to the API, so check it really is hex before converting it
    if (!/^[0-9a-fA-F]{2}$/.test(lastByte)) {
        return "-";
    }
    return parseInt(lastByte, 16) + "%";
}

function isConnected() {
    return sessionStorage.getItem("connected") === "yes";
}

function setConnected() {
    sessionStorage.setItem("connected", "yes");
}

async function getData() {
    const response = await fetch("/api/data").catch(function () {
        throw new Error("Could not reach the dashboard server");
    });
    const data = await response.json().catch(function () {
        throw new Error("The server sent a reply the page could not read.");
    });

    if (!response.ok) {
        throw new Error(data.error || "The server returned error " + response.status);
    }

    if (data.apiTime) {
        if (sessionStorage.getItem("connectedAt") === null) {
            sessionStorage.setItem("connectedAt", data.apiTime);
        }
        sessionStorage.setItem("apiTime", data.apiTime);
    }

    sessionStorage.setItem("savedData", JSON.stringify(data));
    return data;
}

function getSavedData() {
    const text = sessionStorage.getItem("savedData");
    if (text === null) {
        return null;
    }
    return JSON.parse(text);
}

function onlyNewReadings(readings) {
    const connectedText = sessionStorage.getItem("connectedAt");
    const apiText = sessionStorage.getItem("apiTime");
    if (connectedText === null || apiText === null) {
        return [];
    }

    const connectedAt = new Date(connectedText).getTime();
    const latestAllowed = new Date(apiText).getTime() + 60 * 1000;
    const newReadings = [];

    for (let i = 0; i < readings.length; i++) {
        const created = new Date(readings[i].createdAt).getTime();
        if (created >= connectedAt && created <= latestAllowed) {
            newReadings.push(readings[i]);
        }
    }
    return newReadings;
}


// Testing buttons at the top right of every page

// Disconnect: every page stops loading data and everything saved is forgotten
function disconnect() {
    sessionStorage.clear();
    location.reload();
}

// Clear: stays connected, but wipes the saved data and the connect time,
// so "new readings" start again from now
function clearSaved() {
    sessionStorage.removeItem("savedData");
    sessionStorage.removeItem("connectedAt");
    sessionStorage.removeItem("apiTime");
    location.reload();
}

document.getElementById("disconnectButton").addEventListener("click", disconnect);
document.getElementById("resetButton").addEventListener("click", clearSaved);