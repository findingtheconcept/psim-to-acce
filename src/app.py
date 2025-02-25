import logging
import os
from threading import Thread

import webview
from flask import Flask, render_template

template_folder = os.path.join(os.getcwd(), 'assets')

app = Flask(__name__, template_folder=template_folder)

logging.basicConfig(level=logging.DEBUG, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

app.config['DEBUG'] = True
app.config['SERVER_NAME'] = '127.0.0.1:5000'

@app.route('/')
def index():
    return render_template('main_window.html')

def run_flask():
    try:
        logger.info("Running Flask back-end...")
        app.run(debug=True, use_reloader=False)
    except Exception as e:
        logger.error(f"Error caught during starting Flask back-end: {e}")

if __name__ == "__main__":
    thread = Thread(target=run_flask)
    thread.start()

    webview.create_window('Конвертер PSIM (Excel) в ASSE', 'http://127.0.0.1:5000')
    webview.start()
