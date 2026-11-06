//common.js
// Each HTML page loads this file first, then its own file (dash.js, tags.js, etc.),

// if no value is given, show a dash instead of "undefined" or "null"
function show(value) {
    if (value === null || value === undefined || value === "") {
        return "-";
    }
    return String(value);
}

// advertisedAt is Perth time with no timezone, e.g. "2026-10-19T18:19:04" so this makes it look cleaner like "2026-10-19 18:19"
function shortTime(text) {
    if (!text) {
        return "-";
    }
    return String(text).slice(0, 16).replace("T", " ");
}

// createdAt is UTC, e.g. "2026-10-19T10:24:17.732273+00:00". It's the time AWS saved the reading, this changes it to Perth time 
function perthTime(text) {
    const date = new Date(text);
    if (!text || isNaN(date.getTime())) {
        return "-";
    }
    const perth = new Date(date.getTime() + 8 * 60 * 60 * 1000);
    return perth.toISOString().slice(0, 19).replace("T", " ");
}

// The last byte (last 2 hex characters) of a tag's advertisement is its battery.
function battery(advertisement) {
    const lastByte = String(advertisement || "").slice(-2);
    // This regular expression means "exactly 2 characters, each 0-9 or a-f".
    if (!/^[0-9a-fA-F]{2}$/.test(lastByte)) {
        return "-";
    }
    return parseInt(lastByte, 16) + "%";
}

//any recorded battery below this percentage is considered low and will be highlighted in red
const lowBattery = 20;


//Connecting and loading data - it knows if the user has connected to the dashboard server before, and it saves the readings so they can be shown while new ones load.
function isConnected() {
    return sessionStorage.getItem("connected") === "yes";
}

function setConnected() {
    sessionStorage.setItem("connected", "yes");
}

//if anything goes wrong, the error is shown in a red box at the top of the pag
async function getData() {
    let response;
    try {
        response = await fetch("/api/data");
    } catch (error) {
        throw new Error("Could not reach the dashboard server");
    }
    let data;
    try {
        data = await response.json();  // turn the JSON text into a JavaScript object
    } catch (error) {
        throw new Error("The server sent a reply the page could not read.");
    }
    if (!response.ok) {
        throw new Error(data.error || "The server returned error " + response.status);
    }

    //Save the API's time so other functions can work out how old readings are
    if (data.apiTime) {
        sessionStorage.setItem("apiTime", data.apiTime);
    }

    keepSeenReadings(data);
    //sessionStorage can only hold text, so the object is turned into JSON text first
    sessionStorage.setItem("savedData", JSON.stringify(data));
    return data;
}
const maxSavedReadings = 500;

function keepSeenReadings(data) {
    const text = sessionStorage.getItem("savedData");
    if (text === null) {
        return;  // nothing saved yet, so nothing to add back
    }
    const ids = new Set();
    for (let i = 0; i < data.readings.length; i++) {
        ids.add(data.readings[i].id);
    }
    const oldReadings = JSON.parse(text).readings;
    for (let i = 0; i < oldReadings.length; i++) {
        if (oldReadings[i].id && !ids.has(oldReadings[i].id)) {
            data.readings.push(oldReadings[i]);
        }
    }
    sortNewestFirst(data.readings);
    // Only keep the newest ones so the saved data can't grow forever
    data.readings = data.readings.slice(0, maxSavedReadings);
}

function sortNewestFirst(readings) {
    readings.sort(function (a, b) {
        const first = a.createdAt || "";
        const second = b.createdAt || "";
        if (first === second) {
            return 0;
        }
        if (first < second) {
            return 1;
        }
        return -1;
    });
}
function getSavedData() {
    const text = sessionStorage.getItem("savedData");
    if (text === null) {
        return null;
    }
    return JSON.parse(text);
}


const liveMinutes = 10;

// Returns only the readings saved in the last 10 minutes
function onlyNewReadings(readings) {
    const apiText = sessionStorage.getItem("apiTime");
    if (apiText === null) {
        return [];
    }


    const apiTime = new Date(apiText).getTime();
    const earliestAllowed = apiTime - liveMinutes * 60 * 1000;
    const latestAllowed = apiTime + 60 * 1000;
    const newReadings = [];

    for (let i = 0; i < readings.length; i++) {
        const created = new Date(readings[i].createdAt).getTime();
        if (created >= earliestAllowed && created <= latestAllowed) {
            newReadings.push(readings[i]);
        }
    }
    return newReadings;
}


// A tag or knot counts as Active if it was heard from in the last 5 minutes
const activeMinutes = 5;

function secondsAgo(reading) {
    const apiText = sessionStorage.getItem("apiTime");
    if (apiText === null || !reading.createdAt) {
        return null;
    }
    const now = new Date(apiText).getTime();
    const created = new Date(reading.createdAt).getTime();
    if (isNaN(now) || isNaN(created)) {
        return null;
    }
    if (created > now + 60 * 1000) {
        return null;
    }
    return Math.max(0, Math.round((now - created) / 1000));
}

// Turns a number of seconds into text like "45 sec ago", "3 min ago" or "2 h ago"
function agoText(seconds) {
    if (seconds === null) {
        return "-";
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

// "Active" if heard from in the last 5 minutes, otherwise "Missing"
function tagStatus(seconds) {
    if (seconds === null) {
        return "-";
    }
    if (seconds <= activeMinutes * 60) {
        return "Active";
    }
    return "Missing";
}




// Disconnect: every page stops loading data and everything saved is forgotten this is only for testing 
function disconnect() {
    sessionStorage.clear();
    try {
        localStorage.removeItem("liveReadings");
    } catch (error) {
    }
    location.reload();
}
document.getElementById("disconnectButton").addEventListener("click", disconnect);
