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

// A battery under this percent gets highlighted
const lowBattery = 20;

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
        sessionStorage.setItem("apiTime", data.apiTime);
    }

    keepSeenReadings(data);
    sessionStorage.setItem("savedData", JSON.stringify(data));
    return addNicknames(data);
}

// The API only returns 50 items and they aren't the newest 50, so a new reading can
// push out one from a minute ago. Adding back what we've already seen stops rows disappearing.
const maxSavedReadings = 500;

function keepSeenReadings(data) {
    const text = sessionStorage.getItem("savedData");
    if (text === null) {
        return;
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
    data.readings = data.readings.slice(0, maxSavedReadings);
}

// The same order as the server. createdAt is text, so "or ''" covers a missing one.
function sortNewestFirst(readings) {
    readings.sort(function (a, b) {
        const first = a.createdAt || "";
        const second = b.createdAt || "";
        if (first === second) {
            return 0;
        }
        return first < second ? 1 : -1;
    });
}

function getSavedData() {
    const text = sessionStorage.getItem("savedData");
    if (text === null) {
        return null;
    }
    return addNicknames(JSON.parse(text));
}


// Nicknames are saved in this browser (localStorage), so they stay after closing it,
// but another computer won't have them. They look like {"DC:2C:6E:16:17:B6": "Cow 12"}

function getNicknames() {
    try {
        return JSON.parse(localStorage.getItem("nicknames")) || {};
    } catch (error) {
        // localStorage can be blocked (e.g. private browsing), so just carry on without nicknames
        return {};
    }
}

// An empty nickname removes it
function setNickname(mac, nickname) {
    const nicknames = getNicknames();
    nickname = nickname.trim().slice(0, 30);
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

// Live readings are ones from the last 10 minutes (by the API's internet time)
const liveMinutes = 10;

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

// How many seconds ago a reading was saved, using the API's internet time.
// createdAt and apiTime are both UTC, so this doesn't depend on this computer's clock.
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
    // A reading up to 60 seconds ahead (clocks differ slightly) counts as just now
    return Math.max(0, Math.round((now - created) / 1000));
}

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

function tagStatus(seconds) {
    if (seconds === null) {
        return "-";
    }
    if (seconds <= activeMinutes * 60) {
        return "Active";
    }
    return "Missing";
}


// Testing buttons at the top right of every page

// Disconnect: every page stops loading data and everything saved is forgotten
function disconnect() {
    sessionStorage.clear();
    try {
        localStorage.removeItem("liveReadings");
    } catch (error) {
        // localStorage can be blocked. There's nothing saved to clear then.
    }
    location.reload();
}

document.getElementById("disconnectButton").addEventListener("click", disconnect);