import requests
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime

API_URL = "https://hgmmq7y8xe.execute-api.ap-southeast-2.amazonaws.com/items"

AWST = timezone(timedelta(hours=8))  # Define the timezone for Australia Western Standard Time (AWST)
# Add function for user to select later


def get_data():
    """Get the items from the API, and the API's own time.
    Returns (items, api_time), or (None, None) if anything goes wrong."""
    try:
        response = requests.get(API_URL, timeout=10)  # timeout so it can't hang forever
        response.raise_for_status()  # Raise an error for bad responses (4xx and 5xx)
        data = response.json()
    except requests.exceptions.ConnectionError as e:
        # This has to come BEFORE RequestException, because ConnectionError is a
        # type of RequestException and would never be reached otherwise.
        print(f"Connection error: {e}")
        return None, None
    except requests.exceptions.RequestException as e:
        print(f"Error fetching data: {e}")
        return None, None
    except ValueError as e:
        print(f"Error parsing JSON: {e}")
        return None, None

    # This check has to be outside the try/except, after the data has been loaded
    if not isinstance(data, dict) or "items" not in data:
        print("The API response has no 'items' list")
        return None, None

    return data["items"], get_api_time(response)


def get_api_time(response):
    """The time from the API's Date header, e.g. "Wed, 28 Oct 2026 08:42:51 GMT".
    This is internet time, so it's right even if this computer's clock is wrong.
    Returned as text like "2026-10-28T08:42:51+00:00", or None if it's missing."""
    date_text = response.headers.get("Date")
    if not date_text:
        print("The API response has no Date header")
        return None
    try:
        return parsedate_to_datetime(date_text).isoformat()
    except (TypeError, ValueError):
        print(f"Could not read the Date header: {date_text}")
        return None


def build_tag_names_dict(items):
    tag_names = {}
    for item in items:
        if str(item.get("id", "")).startswith("devicetag-"):
            mac = item.get("macAddress")
            if mac:
                tag_names[mac] = item.get("name", "Unnamed tag")
    return tag_names


def build_sightings_list(items):
    sightings = []
    for item in items:
        if item.get("type") == "advertisement":
            sightings.append(item)
    return sightings


def build_table(tag_names, sightings):
    table = []
    for sighting in sightings:
        mac = sighting.get("macAddress")
        table.append({
            "id": sighting.get("id"),
            "macAddress": mac,
            "tagName": tag_names.get(mac, "Unknown tag"),
            "advertisedAt": sighting.get("advertisedAt"),
            "createdAt": sighting.get("createdAt"),
            "rssi": sighting.get("rssi"),
            "knotName": sighting.get("knotName"),
            "advertisement": sighting.get("advertisement"),
        })

    # Sort AFTER the loop has finished (newest first).
    # Uses createdAt because the KNOT's clock (advertisedAt) can be wrong.
    # "or ''" stops a missing createdAt from crashing the sort.
    table.sort(key=lambda row: row["createdAt"] or "", reverse=True)
    return table


# FAKE DATA for showing the pages when the KNOT isn't sending.
# Each one is (minutes ago, tag name, MAC, knot, RSSI, advertisement).
# The last 2 characters of the advertisement are the battery in hex, e.g. 12 is 18%.
# To remove the fake data, delete this list and add_fake_readings, and its line in app.py.
FAKE_READINGS = [
    (1, "Pig 1", "00:00:00:00:00:01", "Knot 2", -83, "4747000012"),
    (1, "Sheep 6", "00:00:00:00:00:02", "Knot 1", -50, "4747000064"),
    (2, "Sheep 3", "00:00:00:00:00:03", "Knot 2", -58, "474700005F"),
    (2, "Pig 1", "00:00:00:00:00:01", "Knot 3", -74, "4747000012"),
    (3, "Cow 2", "00:00:00:00:00:04", "Knot 2", -61, "4747000058"),
    (3, "Sheep 6", "00:00:00:00:00:02", "Knot 1", -52, "4747000064"),
    (4, "Sheep 3", "00:00:00:00:00:03", "Knot 3", -66, "474700005F"),
    (30, "Cow 2", "00:00:00:00:00:04", "Knot 1", -70, "4747000058"),
    (95, "Goat 4", "00:00:00:00:00:05", "Knot 3", -88, "474700000F"),
    (180, "Goat 4", "00:00:00:00:00:05", "Knot 1", -79, "4747000010"),
]


def add_fake_readings(table, api_time):
    """Add FAKE_READINGS to the table. Their times count back from now, so they never go stale.
    "fake" tells the Live page to leave them out."""
    now = datetime.fromisoformat(api_time) if api_time else datetime.now(timezone.utc)

    for i, (minutes, tag, mac, knot, rssi, advertisement) in enumerate(FAKE_READINGS):
        seen = now - timedelta(minutes=minutes)
        table.append({
            "id": f"fake-{i + 1}",
            "macAddress": mac,
            "tagName": tag,
            "advertisedAt": seen.astimezone(AWST).strftime("%Y-%m-%dT%H:%M:%S"),
            "createdAt": seen.isoformat(),
            "rssi": rssi,
            "knotName": knot,
            "advertisement": advertisement,
            "fake": True,
        })

    # The pages expect newest first
    table.sort(key=lambda row: row["createdAt"] or "", reverse=True)
    return table


def print_table(table):
    """Print the table as neat columns instead of raw dictionaries."""
    # Each column is (heading, key in the row, width). Change these to add or remove columns.
    columns = [
        ("Seen at", "advertisedAt", 21),
        ("Tag", "tagName", 20),
        ("MAC address", "macAddress", 19),
        ("RSSI", "rssi", 6),
        ("Gateway", "knotName", 24),
    ]

    # Heading line, then a line of dashes under it
    heading = ""
    for title, key, width in columns:
        heading += f"{title:<{width}}"
    print(heading)
    print("-" * len(heading))

    # One line per reading. A missing value (None) prints as blank.
    for row in table:
        line = ""
        for title, key, width in columns:
            value = row[key]
            if value is None:
                value = ""
            line += f"{str(value):<{width}}"
        print(line)

    print(f"\n{len(table)} readings")


if __name__ == "__main__":
    items, api_time = get_data()
    if items is None:
        print("No data retrieved from the API.")
    else:
        print(f"API time: {api_time}\n")
        tag_names = build_tag_names_dict(items)
        sightings = build_sightings_list(items)
        table = build_table(tag_names, sightings)
        print_table(table)
