#test_data.py
# checks data.py turns the raw API items into the right table, uses made up items so it doesnt need the internet
# run it from the anidata folder with python -m pytest

from data import build_tag_names_dict, build_sightings_list, build_table


def test_build_table():
    items = [
        # a tag item, this gives the tag its name
        {"id": "devicetag-1", "macAddress": "AA:AA", "name": "Cow 1"},
        # two readings of that tag, older one first
        {"id": "a1", "type": "advertisement", "macAddress": "AA:AA",
         "createdAt": "2026-11-02T01:00:00+00:00", "rssi": -60, "knotName": "Knot 1"},
        {"id": "a2", "type": "advertisement", "macAddress": "AA:AA",
         "createdAt": "2026-11-02T02:00:00+00:00", "rssi": -50, "knotName": "Knot 1"},
        # a tag with no name and no createdAt
        {"id": "a3", "type": "advertisement", "macAddress": "BB:BB"},
        # not a reading so it should get dropped
        {"id": "other", "type": "something else"},
    ]

    table = build_table(build_tag_names_dict(items), build_sightings_list(items))

    # only the 3 readings, newest first, and the missing createdAt goes last without crashing
    assert [row["id"] for row in table] == ["a2", "a1", "a3"]
    # names get matched by MAC or "Unknown tag" if there isnt one
    assert table[0]["tagName"] == "Cow 1"
    assert table[2]["tagName"] == "Unknown tag"
