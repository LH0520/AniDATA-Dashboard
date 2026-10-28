from flask import Flask, jsonify, redirect, send_from_directory, abort

from data import get_data, build_tag_names_dict, build_sightings_list, build_table


# Flask serves the JS and CSS from the "static" folder at /static/ by default
app = Flask(__name__)

PAGES = ["dash.html","explorer.html","live.html","tags.html"]

@app.route("/")
def home():
    return redirect("/dash.html")

@app.route("/<page>")
def show_page(page):
    if page not in PAGES:
        abort(404)
    return send_from_directory(app.root_path, page)

@app.route("/api/data")
def api_data():
    items, api_time = get_data()

    # get_data() prints the exact reason in this terminal if it fails
    if items is None:
        return jsonify({
            "error": "Could not get data from the tracking API. "
        }), 502

    tag_names = build_tag_names_dict(items)
    sightings = build_sightings_list(items)
    table = build_table(tag_names, sightings)

    return jsonify({
        "apiTime": api_time,
        "readingCount": len(table),
        "readings": table,
    })


if __name__ == "__main__":
    app.run(debug=True)
