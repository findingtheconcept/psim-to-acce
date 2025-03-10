import logging
import os
import shutil
from flask import Blueprint, request, jsonify, render_template
from converter import convert_psim_to_asse
from utils import get_app_folder

bp = Blueprint('main', __name__)

@bp.route('/')
def index():
    return render_template('main_window.html')

@bp.route('/convert', methods=['POST'])
def convert_route():
    data = request.json
    psim_file = data.get('inputFile')
    second_file = data.get('secondFile')
    output_file = data.get('outputFile')
    logging.info(f"Convert from {psim_file} and {second_file} => {output_file}")
    if os.path.isdir(output_file):
        output_file = os.path.join(output_file, "export_spreadsheet.xlsx")
    try:
        convert_psim_to_asse(psim_file, second_file, output_file)
        return jsonify({"status": "success", "message": "Конвертирование завершено успешно!"})
    except Exception as e:
        logging.error(f"Error during conversion: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@bp.route('/store_history', methods=['POST'])
def store_history():
    data = request.json
    orig_file1 = data.get('file1')
    orig_file2 = data.get('file2')
    folder = get_app_folder()
    base1 = os.path.basename(orig_file1)
    base2 = os.path.basename(orig_file2)
    new_file1 = os.path.join(folder, f"file1_{int(os.path.getmtime(orig_file1))}_{base1}")
    new_file2 = os.path.join(folder, f"file2_{int(os.path.getmtime(orig_file2))}_{base2}")
    try:
        shutil.copy2(orig_file1, new_file1)
        shutil.copy2(orig_file2, new_file2)
        return jsonify({"status": "ok", "file1": new_file1, "file2": new_file2})
    except Exception as e:
        logging.error(f"Error copying files: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@bp.route('/delete_history_item', methods=['POST'])
def delete_history_item():
    data = request.json
    path1 = data.get('file1')
    path2 = data.get('file2')
    try:
        if path1 and os.path.exists(path1) and path1.startswith(get_app_folder()):
            os.remove(path1)
        if path2 and os.path.exists(path2) and path2.startswith(get_app_folder()):
            os.remove(path2)
        return jsonify({"status": "ok"})
    except Exception as e:
        logging.error(f"Error removing files: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@bp.route('/clear_all_history', methods=['POST'])
def clear_all_history():
    folder = get_app_folder()
    try:
        for f in os.listdir(folder):
            path = os.path.join(folder, f)
            if os.path.isfile(path):
                os.remove(path)
        return jsonify({"status": "ok"})
    except Exception as e:
        logging.error(f"Error clearing folder: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500
