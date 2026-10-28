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
    # "or ''" stops a missing advertisedAt from crashing the sort.
    table.sort(key=lambda row: row["advertisedAt"] or "", reverse=True)
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
