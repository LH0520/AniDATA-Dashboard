#app.py
# the web server, it sends the pages to the browser and has /api/data which the pages call to get the readings
# run it with python app.py then open http://127.0.0.1:5000

import time

from flask import Flask, jsonify, redirect, send_from_directory, abort

from data import get_data, build_tag_names_dict, build_sightings_list, build_table


# Flask serves the JS and CSS from the static folder at /static/
app = Flask(__name__)

# the only pages the server is allowed to send
PAGES = ["dash.html", "explorer.html", "live.html", "tags.html"]


# the plain address goes to the Overview page
@app.route("/")
def home():
    return redirect("/dash.html")


@app.route("/<page>")
def show_page(page):
    # only pages in the list so nobody can ask for app.py or other files
    if page not in PAGES:
        abort(404)
    return send_from_directory(app.root_path, page)


# every Live page asks every second and each download from AWS takes about half a second,
# so the last answer gets reused for 2 seconds and lots of people only cause one download
CACHE_SECONDS = 2
last_answer = None
last_answer_time = 0


@app.route("/api/data")
def api_data():
    # global lets this function change the two variables above
    global last_answer, last_answer_time
    if last_answer is not None and time.time() - last_answer_time < CACHE_SECONDS:
        return jsonify(last_answer)

    items, api_time = get_data()

    # get_data() prints the reason in the terminal if it fails, 502 means the API didnt give a good answer
    if items is None:
        return jsonify({
            "error": "Could not get data from the tracking API. "
        }), 502

    #turn the raw items into one table of readings
    tag_names = build_tag_names_dict(items)
    sightings = build_sightings_list(items)
    table = build_table(tag_names, sightings)

    # errors dont get remembered so the next request tries AWS again
    last_answer = {
        "apiTime": api_time,
        "readings": table,
    }
    last_answer_time = time.time()
    return jsonify(last_answer)


# only starts the server when this file is run directly
if __name__ == "__main__":
    # debug=True restarts the server when the code changes
    app.run(debug=True)
