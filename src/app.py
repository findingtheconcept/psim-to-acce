import sys
import os
import logging
from threading import Thread

import requests
from flask import Flask, render_template, request
import webview

if hasattr(sys, '_MEIPASS'):
    base_path = sys._MEIPASS
else:
    base_path = os.path.abspath(".")

template_folder = os.path.join(base_path, 'assets')
static_folder = os.path.join(base_path, 'static')

app = Flask(__name__, template_folder=template_folder, static_folder=static_folder)

logging.basicConfig(level=logging.DEBUG, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

def on_closed():
    logger.info("Window closed. Stopping Flask server...")
    try:
        os.environ.pop('HTTP_PROXY', None)
        os.environ.pop('HTTPS_PROXY', None)
        proxies = {"http": None, "https": None}

        requests.get("http://127.0.0.1:5000/shutdown", proxies=proxies, timeout=3)
    except Exception as e:
        logger.error(f"Error during server shutdown: {e}")

@app.route('/')
def index():
    return render_template('main_window.html')

@app.route('/shutdown', methods=['GET'])
def shutdown_route():
    logger.info("Shutdown request received.")
    shutdown_func = request.environ.get('werkzeug.server.shutdown')
    if shutdown_func is None:
        raise RuntimeError('Not running with the Werkzeug Server')
    shutdown_func()
    return "Server shutting down..."

def run_flask():
    logger.info("Running Flask back-end...")
    try:
        app.run(host='127.0.0.1', port=5000, debug=False, use_reloader=False)
    except Exception as e:
        logger.error(f"Error caught during starting Flask back-end: {e}")

if __name__ == "__main__":
    thread = Thread(target=run_flask)
    thread.daemon = True
    thread.start()

    window = webview.create_window(
        'PSIM to ASSE',
        'http://127.0.0.1:5000',
        width=1200,
        height=500
    )
    window.events.closed += on_closed
    webview.start()
