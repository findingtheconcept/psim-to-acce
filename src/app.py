import objc

if not hasattr(objc._objc, '__file__'):
    import ctypes
    setattr(objc._objc, '__file__', '/usr/lib/libobjc.A.dylib')

import sys
import os
import logging
from threading import Thread
import json
import webview
from webview.dom import DOMEventHandler
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


def get_theme_file_path():
    return os.path.join(os.path.expanduser("~"), "app_theme_config.json")


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
    def select_source_file(self):
        if not window:
            return ""
        result = window.create_file_dialog(webview.OPEN_DIALOG, directory='', allow_multiple=False)
        if result and len(result) > 0:
            return result[0]
        return ""

    def select_save_file(self):
        if not window:
            return ""
        result = window.create_file_dialog(webview.SAVE_DIALOG, directory='.', save_filename='export_spreadsheet.xlsx')
        if result and len(result) > 0:
            return result
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


def bind_drag_and_drop():
    def on_drag_enter(e):
        t = e['target'].get('id')
        if t in ('psimCard1', 'psimCard2', 'ifcCard1', 'ifcCard2'):
            window.evaluate_js(f'document.getElementById("{t}").classList.add("dragover")')

    def on_drag_over(e):
        e.prevent_default()

    def on_drag_leave(e):
        t = e['target'].get('id')
        if t in ('psimCard1', 'psimCard2', 'ifcCard1', 'ifcCard2'):
            window.evaluate_js(f'document.getElementById("{t}").classList.remove("dragover")')

    def on_drop(e):
        e.prevent_default()
        fs = e['dataTransfer']['files']
        if not fs:
            return
        t = e['target'].get('id')
        window.evaluate_js(f'document.getElementById("{t}").classList.remove("dragover")')
        path = fs[0].get('pywebviewFullPath', '')
        if t == 'psimCard1':
            window.evaluate_js(
                f'document.getElementById("filePath1").textContent="{path}";'
                f'document.getElementById("filePath1").style.display="block";'
                f'window.selectFile("psim1","{path}");'
            )
        elif t == 'psimCard2':
            window.evaluate_js(
                f'document.getElementById("filePath2").textContent="{path}";'
                f'document.getElementById("filePath2").style.display="block";'
                f'window.selectFile("psim2","{path}");'
            )
        elif t == 'ifcCard1':
            window.evaluate_js(
                f'document.getElementById("ifcPath").textContent="{path}";'
                f'document.getElementById("ifcPath").style.display="block";'
                f'window.selectFile("ifc","{path}");'
            )
        elif t == 'ifcCard2':
            window.evaluate_js(
                f'document.getElementById("attribPath").textContent="{path}";'
                f'document.getElementById("attribPath").style.display="block";'
                f'window.selectFile("attrib","{path}");'
            )

    doc = window.dom.document
    doc.events.dragenter += DOMEventHandler(on_drag_enter, True, True)
    doc.events.dragover += DOMEventHandler(on_drag_over, True, True)
    doc.events.dragleave += DOMEventHandler(on_drag_leave, True, True)
    doc.events.drop += DOMEventHandler(on_drop, True, True)


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
        js_api=bridge
    )

    webview.start(bind_drag_and_drop, window)
