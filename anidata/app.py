# app.py - the web server for the AniDATA dashboard.
# It sends the HTML pages to the browser, and has one API route (/api/data)
# that the pages' JavaScript calls to get the tag readings.
# Run it with:  python app.py   then open http://127.0.0.1:5000

from flask import Flask, jsonify, redirect, send_from_directory, abort

from data import get_data, build_tag_names_dict, build_sightings_list, build_table


# Create the Flask app.
# Flask serves the JS and CSS from the "static" folder at /static/ by default.
app = Flask(__name__)

# The only HTML pages the server is allowed to send
PAGES = ["dash.html", "explorer.html", "live.html", "tags.html"]


# Going to the plain address (e.g. http://127.0.0.1:5000/) sends you to the Overview page
@app.route("/")
def home():
    return redirect("/dash.html")


# Sends one of the HTML pages, e.g. /tags.html
@app.route("/<page>")
def show_page(page):
    # Only send pages in the list, so nobody can ask for app.py or other files
    if page not in PAGES:
        abort(404)
    return send_from_directory(app.root_path, page)


# The JavaScript on every page calls this to get the readings as JSON
@app.route("/api/data")
def api_data():
    # Step 1: download the raw items from the tracking API
    items, api_time = get_data()

    # get_data() prints the exact reason in this terminal if it fails.
    # 502 means "the server we rely on didn't give a good answer".
    if items is None:
        return jsonify({
            "error": "Could not get data from the tracking API. "
        }), 502

    # Step 2: turn the raw items into one tidy table of readings
    tag_names = build_tag_names_dict(items)
    sightings = build_sightings_list(items)
    table = build_table(tag_names, sightings)

    # Step 3: send it back to the browser as JSON
    return jsonify({
        "apiTime": api_time,
        "readingCount": len(table),
        "readings": table,
    })


# Only start the server when this file is run directly (not when it's imported)
if __name__ == "__main__":
    # debug=True restarts the server when the code changes and shows errors in the browser
    app.run(debug=True)
