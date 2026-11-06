#data.py
# gets the readings from the API and tidies them up. the API gives a mixed list of items,
# some are tags (which have a name) and some are advertisements (one sighting of a tag by a knot)
# run it on its own with python data.py to print the table in the terminal

import requests
from email.utils import parsedate_to_datetime

API_URL = "https://hgmmq7y8xe.execute-api.ap-southeast-2.amazonaws.com/items"


def get_data():
    """Gets the items from the API and the API's time.
    Returns (items, api_time), or (None, None) if anything goes wrong."""
    try:
        response = requests.get(API_URL, timeout=10)  # timeout so it cant hang forever
        response.raise_for_status()  # error for bad responses like 404 or 500
        data = response.json()
    except requests.exceptions.ConnectionError as e:
        # this has to be before RequestException because ConnectionError is a type of it
        print(f"Connection error: {e}")
        return None, None
    except requests.exceptions.RequestException as e:
        print(f"Error fetching data: {e}")
        return None, None
    except ValueError as e:
        # response.json() gives a ValueError if the reply isnt proper JSON
        print(f"Error parsing JSON: {e}")
        return None, None

    #we expect something like {"items": [ ... ]}
    if not isinstance(data, dict) or "items" not in data:
        print("The API response has no 'items' list")
        return None, None

    return data["items"], get_api_time(response)


def get_api_time(response):
    """The time from the API's Date header, e.g. "Wed, 28 Oct 2026 08:42:51 GMT".
    It's internet time so it's right even if this computer's clock is wrong.
    Gives text like "2026-10-28T08:42:51+00:00", or None if it's missing."""
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
    """Looks up a tag's name from its MAC address, e.g. {"DC:2C:6E:16:17:B6": "Tag 1"}.
    Tag items have an id starting with "devicetag-"."""
    tag_names = {}
    for item in items:
        # .get() gives a default instead of crashing if the key isnt there
        if str(item.get("id", "")).startswith("devicetag-"):
            mac = item.get("macAddress")
            if mac:
                tag_names[mac] = item.get("name", "Unnamed tag")
    return tag_names


def build_sightings_list(items):
    """Only keeps the advertisements (each one is one reading of a tag)."""
    sightings = []
    for item in items:
        if item.get("type") == "advertisement":
            sightings.append(item)
    return sightings


def get_created_at(row):
    """For sorting. "or ''" stops a missing createdAt from crashing the sort."""
    return row["createdAt"] or ""


def build_table(tag_names, sightings):
    """Joins each sighting with its tag's name, one dictionary per reading, newest first."""
    table = []
    for sighting in sightings:
        mac = sighting.get("macAddress")
        table.append({
            "id": sighting.get("id"),
            "macAddress": mac,
            "tagName": tag_names.get(mac, "Unknown tag"),
            "advertisedAt": sighting.get("advertisedAt"),
            "createdAt": sighting.get("createdAt"),
            "rssi": sighting.get("rssi"),  # signal strength e.g. -71
            "knotName": sighting.get("knotName"),  # the gateway that heard the tag
            "advertisement": sighting.get("advertisement"),  # raw hex from the tag
        })

    # sorts by createdAt because the KNOT's clock (advertisedAt) can be wrong
    table.sort(key=get_created_at, reverse=True)
    return table


def print_table(table):
    """Prints the table as neat columns."""
    # each column is (heading, key, width)
    columns = [
        ("Seen at", "advertisedAt", 21),
        ("Tag", "tagName", 20),
        ("MAC address", "macAddress", 19),
        ("RSSI", "rssi", 6),
        ("Gateway", "knotName", 24),
    ]

    # ljust pads the text with spaces so the columns line up
    heading = ""
    for title, key, width in columns:
        heading += title.ljust(width)
    print(heading)
    print("-" * len(heading))

    for row in table:
        line = ""
        for title, key, width in columns:
            value = row[key]
            if value is None:
                value = ""
            line += str(value).ljust(width)
        print(line)

    print(f"\n{len(table)} readings")


# only runs when this file is run directly so you can test it without the server
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
