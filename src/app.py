import platform
import subprocess

if platform.system() == 'Darwin':
    import objc

    if not hasattr(objc._objc, '__file__'):
        setattr(objc._objc, '__file__', '/usr/lib/libobjc.A.dylib')

import sys
import os
import logging
from threading import Thread
import json
import webview
from flask import Flask
from routes import bp as main_bp
from utils import get_app_folder

if hasattr(sys, '_MEIPASS'):
    base_path = sys._MEIPASS
else:
    base_path = os.path.abspath(".")

template_folder = os.path.join(base_path, 'assets')
static_folder = os.path.join(base_path, 'static')

app = Flask(__name__, template_folder=template_folder, static_folder=static_folder)
logging.basicConfig(level=logging.DEBUG, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


def get_theme_file_path():
    return os.path.join(get_app_folder(), "app_theme_config.json")


def read_theme():
    path = get_theme_file_path()
    if not os.path.exists(path):
        return ""
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data.get("theme", "")
    except:
        return ""


def write_theme(theme):
    path = get_theme_file_path()
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump({"theme": theme}, f, ensure_ascii=False, indent=2)
    except:
        pass


app.register_blueprint(main_bp)


class Bridge:
    def open_pdf_manual(self):
        pdf_path = os.path.join(base_path, 'static', 'manual', 'guide.pdf')
        if not os.path.exists(pdf_path):
            return "not_found"
        if sys.platform.startswith("darwin"):
            subprocess.Popen(["open", pdf_path])
        elif sys.platform.startswith("win"):
            os.startfile(pdf_path)
        else:
            subprocess.Popen(["xdg-open", pdf_path])
        return "ok"

    def select_save_file_ifc(self):
        if not window:
            return ""
        result = window.create_file_dialog(
            webview.SAVE_DIALOG,
            directory='.',
            save_filename='ifc_result.ifc'
        )
        return result if result else ""

    def select_source_file(self):
        if not window:
            return ""
        result = window.create_file_dialog(
            webview.OPEN_DIALOG, directory='', allow_multiple=False
        )
        if result and len(result) > 0:
            return result[0]
        return ""

    def select_source_files_ifc(self):
        if not window:
            return []
        result = window.create_file_dialog(
            webview.OPEN_DIALOG,
            directory='',
            allow_multiple=True
        )
        if result and len(result) > 0:
            return result
        return []

    def select_save_file_psim(self):
        if not window:
            return ""
        result = window.create_file_dialog(
            webview.SAVE_DIALOG, directory='.', save_filename='export_spreadsheet.xlsx'
        )
        if result and len(result) > 0:
            return result
        return ""

    def select_folder_ifc(self):
        if not window:
            return ""
        result = window.create_file_dialog(
            webview.FOLDER_DIALOG,  # Выбор папки
            directory='.'
        )
        if result and len(result) > 0:
            return result[0]
        return ""

    def get_theme(self):
        return read_theme()

    def set_theme(self, theme):
        write_theme(theme)
        return theme


def run_flask():
    logger.info("Running Flask back-end...")
    try:
        app.run(host='127.0.0.1', port=5000, debug=False, use_reloader=False)
    except Exception as e:
        logger.error(f"Error starting Flask back-end: {e}")


if __name__ == "__main__":
    thread = Thread(target=run_flask, daemon=True)
    thread.start()

    bridge = Bridge()

    window = webview.create_window(
        title='PSIM to ACCE',
        url='http://127.0.0.1:5000',
        width=900,
        height=600,
        resizable=False,
        js_api=bridge,
    )

    webview.start()
