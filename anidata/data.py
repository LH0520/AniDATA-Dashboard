# data.py - gets the readings from the tracking API and tidies them up.
# The API returns a mixed list of "items". Some are tags (which have a name),
# and some are "advertisements" (one sighting of a tag by a knot/gateway).
# The functions below join these together into one table of readings.
# Run this file on its own (python data.py) to print the table in the terminal.

import requests
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime

# The web address of the tracking API
API_URL = "https://hgmmq7y8xe.execute-api.ap-southeast-2.amazonaws.com/items"

AWST = timezone(timedelta(hours=8))  # Define the timezone for Australia Western Standard Time (AWST)
# Add function for user to select later


def get_data():
    """Get the items from the API, and the API's own time.
    Returns (items, api_time), or (None, None) if anything goes wrong."""
    try:
        response = requests.get(API_URL, timeout=10)  # timeout so it can't hang forever
        response.raise_for_status()  # Raise an error for bad responses (4xx and 5xx)
        data = response.json()  # Turn the JSON text into a Python dictionary
    except requests.exceptions.ConnectionError as e:
        # This has to come BEFORE RequestException, because ConnectionError is a
        # type of RequestException and would never be reached otherwise.
        print(f"Connection error: {e}")
        return None, None
    except requests.exceptions.RequestException as e:
        print(f"Error fetching data: {e}")
        return None, None
    except ValueError as e:
        # response.json() raises a ValueError if the reply isn't valid JSON
        print(f"Error parsing JSON: {e}")
        return None, None

    # This check has to be outside the try/except, after the data has been loaded.
    # We expect something like {"items": [ ... ]}
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
        # parsedate_to_datetime reads the header text, isoformat() writes it in the standard format
        return parsedate_to_datetime(date_text).isoformat()
    except (TypeError, ValueError):
        print(f"Could not read the Date header: {date_text}")
        return None


def build_tag_names_dict(items):
    """Make a dictionary that looks up a tag's name from its MAC address,
    e.g. {"DC:2C:6E:16:17:B6": "Tag 1"}. Tag items have an id starting with "devicetag-"."""
    tag_names = {}
    for item in items:
        # .get() gives a default instead of crashing if the key is missing
        if str(item.get("id", "")).startswith("devicetag-"):
            mac = item.get("macAddress")
            if mac:
                tag_names[mac] = item.get("name", "Unnamed tag")
    return tag_names


def build_sightings_list(items):
    """Keep only the advertisement items (each one is a single reading of a tag)."""
    sightings = []
    for item in items:
        if item.get("type") == "advertisement":
            sightings.append(item)
    return sightings


def get_created_at(row):
    """Used to sort the table. "or ''" stops a missing createdAt (None) from crashing the sort."""
    return row["createdAt"] or ""


def build_table(tag_names, sightings):
    """Join each sighting with its tag's name, giving one dictionary per reading.
    The table is sorted newest first."""
    table = []
    for sighting in sightings:
        mac = sighting.get("macAddress")
        table.append({
            "id": sighting.get("id"),
            "macAddress": mac,
            # Look the name up from the dictionary built earlier
            "tagName": tag_names.get(mac, "Unknown tag"),
            "advertisedAt": sighting.get("advertisedAt"),
            "createdAt": sighting.get("createdAt"),
            "rssi": sighting.get("rssi"),  # signal strength, e.g. -71
            "knotName": sighting.get("knotName"),  # the gateway that heard the tag
            "advertisement": sighting.get("advertisement"),  # raw hex data from the tag
        })

    # Sort AFTER the loop has finished (newest first).
    # Uses createdAt because the KNOT's clock (advertisedAt) can be wrong.
    table.sort(key=get_created_at, reverse=True)
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

    # Heading line, then a line of dashes under it.
    # ljust(width) pads the text with spaces so every column lines up.
    heading = ""
    for title, key, width in columns:
        heading += title.ljust(width)
    print(heading)
    print("-" * len(heading))

    # One line per reading. A missing value (None) prints as blank.
    for row in table:
        line = ""
        for title, key, width in columns:
            value = row[key]
            if value is None:
                value = ""
            line += str(value).ljust(width)
        print(line)

    print(f"\n{len(table)} readings")


# Only runs when this file is run directly, so you can test it without the web server
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
