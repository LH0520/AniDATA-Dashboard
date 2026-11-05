// common.js - functions shared by every page.
// Each HTML page loads this file first, then its own file (dash.js, tags.js, etc.),
// so anything defined here can be used on every page.


// ---------- Formatting values for display ----------

// Turns a value into text for a table cell. Missing values show as "-".
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
    // Keep the first 16 characters (date and hours:minutes) and swap the T for a space
    return String(text).slice(0, 16).replace("T", " ");
}

// createdAt is UTC, e.g. "2026-10-19T10:24:17.732273+00:00".
// Changes it to Perth time and shows it the same way, e.g. "2026-10-19 18:24"
function perthTime(text) {
    const date = new Date(text);
    // getTime() gives NaN ("not a number") if the text wasn't a real date
    if (!text || isNaN(date.getTime())) {
        return "-";
    }
    // Perth is 8 hours ahead of UTC. getTime() is in milliseconds, so 8 hours = 8 * 60 * 60 * 1000.
    const perth = new Date(date.getTime() + 8 * 60 * 60 * 1000);
    return perth.toISOString().slice(0, 16).replace("T", " ");
}

// The last byte (last 2 hex characters) of a tag's advertisement is its battery.
// e.g. "...4747000057" ends in 57, which is 87 in decimal, so 87%
function battery(advertisement) {
    const lastByte = String(advertisement || "").slice(-2);
    // Anyone can post to the API, so check it really is hex before converting it.
    // This regular expression means "exactly 2 characters, each 0-9 or a-f".
    if (!/^[0-9a-fA-F]{2}$/.test(lastByte)) {
        return "-";
    }
    // parseInt(text, 16) reads the text as a base 16 (hex) number
    return parseInt(lastByte, 16) + "%";
}

// A battery under this percent gets highlighted
const lowBattery = 20;


// ---------- Connecting and loading data ----------

// sessionStorage keeps values while this browser tab is open, so every page
// knows whether the user has pressed Connect on the Overview page.
function isConnected() {
    return sessionStorage.getItem("connected") === "yes";
}

function setConnected() {
    sessionStorage.setItem("connected", "yes");
}

// Asks our Flask server (app.py) for the readings and returns them.
// "async" means it can wait (with "await") for the server to answer without freezing the page.
// If anything goes wrong it throws an Error, which each page catches and shows to the user.
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

    // response.ok is false for error codes like 404 or 502
    if (!response.ok) {
        throw new Error(data.error || "The server returned error " + response.status);
    }

    // Save the API's time so other functions can work out how old readings are
    if (data.apiTime) {
        sessionStorage.setItem("apiTime", data.apiTime);
    }

    keepSeenReadings(data);
    // sessionStorage can only hold text, so the object is turned into JSON text first
    sessionStorage.setItem("savedData", JSON.stringify(data));
    return addNicknames(data);
}

// The API only returns 50 items and they aren't the newest 50, so a new reading can
// push out one from a minute ago. Adding back what we've already seen stops rows disappearing.
const maxSavedReadings = 500;

function keepSeenReadings(data) {
    const text = sessionStorage.getItem("savedData");
    if (text === null) {
        return;  // nothing saved yet, so nothing to add back
    }

    // Make a note of every id we just got, so we can tell which old readings are missing.
    // The object is used like a Python dictionary: ids["abc"] = true
    const ids = {};
    for (let i = 0; i < data.readings.length; i++) {
        ids[data.readings[i].id] = true;
    }

    // Add back any old reading that isn't in the new data
    const oldReadings = JSON.parse(text).readings;
    for (let i = 0; i < oldReadings.length; i++) {
        if (oldReadings[i].id && ids[oldReadings[i].id] !== true) {
            data.readings.push(oldReadings[i]);
        }
    }

    sortNewestFirst(data.readings);
    // Only keep the newest ones so the saved data can't grow forever
    data.readings = data.readings.slice(0, maxSavedReadings);
}

// The same order as the server. createdAt is text, so "|| ''" covers a missing one.
// sort() calls this function to compare two readings: returning 1 puts b first,
// -1 puts a first, and 0 means they're equal.
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

// The data from the last time getData() worked, or null if there isn't any yet.
// Used so a page can show something straight away while new data loads.
function getSavedData() {
    const text = sessionStorage.getItem("savedData");
    if (text === null) {
        return null;
    }
    return addNicknames(JSON.parse(text));
}


// ---------- Nicknames ----------

// Nicknames are saved in this browser (localStorage), so they stay after closing it,
// but another computer won't have them. They look like {"DC:2C:6E:16:17:B6": "Cow 12"}

function getNicknames() {
    try {
        // "|| {}" gives an empty object if nothing has been saved yet
        return JSON.parse(localStorage.getItem("nicknames")) || {};
    } catch (error) {
        // localStorage can be blocked (e.g. private browsing), so just carry on without nicknames
        return {};
    }
}

// Saves a nickname for one tag. An empty nickname removes it.
// Returns true if it saved, or false if the browser blocked it.
function setNickname(mac, nickname) {
    const nicknames = getNicknames();
    nickname = nickname.trim().slice(0, 30);  // remove spaces at the ends, max 30 characters
    if (nickname === "") {
        delete nicknames[mac];
    } else {
        nicknames[mac] = nickname;
    }
    try {
        localStorage.setItem("nicknames", JSON.stringify(nicknames));
        return true;
    } catch (error) {
        return false;
    }
}

// Every page shows tagName, so swap the nickname in there.
// originalName keeps the name from the API.
function addNicknames(data) {
    const nicknames = getNicknames();
    for (let i = 0; i < data.readings.length; i++) {
        const reading = data.readings[i];
        reading.originalName = reading.tagName;
        if (nicknames[reading.macAddress]) {
            reading.tagName = nicknames[reading.macAddress];
        }
    }
    return data;
}


// ---------- Working out how old a reading is ----------

// Live readings are ones from the last 10 minutes (by the API's internet time)
const liveMinutes = 10;

// Returns only the readings saved in the last 10 minutes
function onlyNewReadings(readings) {
    const apiText = sessionStorage.getItem("apiTime");
    if (apiText === null) {
        return [];
    }

    // All the times are in milliseconds
    const apiTime = new Date(apiText).getTime();
    const earliestAllowed = apiTime - liveMinutes * 60 * 1000;
    // Allow 1 minute into the future, because clocks can be slightly different
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

// How many seconds ago a reading was saved, using the API's internet time.
// createdAt and apiTime are both UTC, so this doesn't depend on this computer's clock.
// Returns null if we can't tell.
function secondsAgo(reading) {
    const apiText = sessionStorage.getItem("apiTime");
    // new Date(null) would be the year 1970, so check for a missing time first
    if (apiText === null || !reading.createdAt) {
        return null;
    }
    const now = new Date(apiText).getTime();
    const created = new Date(reading.createdAt).getTime();
    if (isNaN(now) || isNaN(created)) {
        return null;
    }
    // More than 60 seconds in the future is bad data, so we don't know its age
    if (created > now + 60 * 1000) {
        return null;
    }
    // A reading up to 60 seconds ahead (clocks differ slightly) counts as just now,
    // which is why Math.max stops it going below 0
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


// ---------- Testing buttons at the top right of every page ----------

// Disconnect: every page stops loading data and everything saved is forgotten
function disconnect() {
    sessionStorage.clear();
    try {
        localStorage.removeItem("liveReadings");
    } catch (error) {
        // localStorage can be blocked. There's nothing saved to clear then.
    }
    location.reload();  // reload the page so it starts again as "not connected"
}

document.getElementById("disconnectButton").addEventListener("click", disconnect);
