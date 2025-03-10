import logging
import os
import sys
from threading import Thread

import webview
from flask import Flask
from routes import bp as main_bp

if hasattr(sys, '_MEIPASS'):
    base_path = sys._MEIPASS
else:
    base_path = os.path.abspath(".")

template_folder = os.path.join(base_path, 'assets')
static_folder = os.path.join(base_path, 'static')

app = Flask(__name__, template_folder=template_folder, static_folder=static_folder)

logging.basicConfig(level=logging.DEBUG, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

app.register_blueprint(main_bp)


class Bridge:
    def __init__(self):
        self.window = None

    def select_source_file(self):
        if not self.window:
            return ""
        result = self.window.create_file_dialog(
            webview.OPEN_DIALOG,
            directory='',
            allow_multiple=False,
            save_filename=''
        )
        if result and len(result) > 0:
            return result[0]
        return ""

    def select_save_file(self):
        if not self.window:
            return ""
        result = self.window.create_file_dialog(
            webview.SAVE_DIALOG,
            '.',
            False,
            'export_spreadsheet.xlsx'
        )
        if result and len(result) > 0:
            return result
        return ""


def run_flask():
    logger.info("Running Flask back-end...")
    try:
        app.run(host='127.0.0.1', port=5000, debug=False, use_reloader=False)
    except Exception as e:
        logger.error(f"Error caught during starting Flask back-end: {e}")


if __name__ == "__main__":
    thread = Thread(target=run_flask, daemon=True)
    thread.start()

    bridge = Bridge()

    window = webview.create_window(
        'PSIM to ACCE',
        'http://127.0.0.1:5000',
        width=800,
        height=500,
        resizable=True,
        js_api=bridge,
    )

    bridge.window = window
    webview.start(storage_path=os.path.join(base_path, "webview_data"))
