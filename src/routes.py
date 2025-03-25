import logging
import os
import shutil
import json
from datetime import datetime
from flask import Blueprint, request, jsonify, render_template
from converter import convert_psim_to_asse
from ifc_converter import convert_excel_to_ifc
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
 
@bp.route('/convert_ifc', methods=['POST'])
def convert_ifc_route():
    data = request.json
    ifc_file = data.get('ifcFile')
    excel_file = data.get('attribFile')
    output_file = data.get('outputFile')
    logging.info(f"Convert from {ifc_file} and {excel_file} => {output_file}")
    if os.path.isdir(output_file):
        output_file = os.path.join(output_file, "ifc_added.ifc")
    try:
        convert_excel_to_ifc(ifc_file, excel_file, output_file)
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
    
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    base1 = os.path.basename(orig_file1)
    base2 = os.path.basename(orig_file2)
    
    new_file1 = os.path.join(folder, f"file1_{timestamp}_{base1}")
    new_file2 = os.path.join(folder, f"file2_{timestamp}_{base2}")
    
    try:
        shutil.copy2(orig_file1, new_file1)
        shutil.copy2(orig_file2, new_file2)

        history_entry = {
            "time": datetime.now().isoformat(),
            "file1": new_file1,
            "file2": new_file2,
            "uuid": timestamp 
        }
        
        history_path = os.path.join(folder, 'history.json')
        history = []
        if os.path.exists(history_path):
            with open(history_path, 'r', encoding='utf-8') as f:
                history = json.load(f)
        
        history.insert(0, history_entry)
        
        with open(history_path, 'w', encoding='utf-8') as f:
            json.dump(history, f, indent=2)

        return jsonify({"status": "ok", "file1": new_file1, "file2": new_file2})
    
    except Exception as e:
        logging.error(f"Error storing history: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@bp.route('/clear_all_history', methods=['POST'])
def clear_all_history():
    try:
        folder = get_app_folder()
        for f in os.listdir(folder):
            path = os.path.join(folder, f)
            if os.path.isfile(path):
                os.remove(path)
        
        history_path = os.path.join(folder, 'history.json')
        if os.path.exists(history_path):
            os.remove(history_path)
        
        return jsonify({"status": "ok"})
    
    except Exception as e:
        logging.error(f"Error clearing history: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@bp.route('/get_history', methods=['GET'])
def get_history():
    history_path = os.path.join(get_app_folder(), 'history.json')
    try:
        if os.path.exists(history_path):
            with open(history_path, 'r', encoding='utf-8') as f:
                return jsonify(json.load(f))
        return jsonify([])
    except Exception as e:
        logging.error(f"Error reading history: {e}")
        return jsonify([])
    
@bp.route('/delete_history_item', methods=['POST'])
def delete_history_item():
    data = request.json
    file1 = data.get('file1')
    file2 = data.get('file2')
    
    try:
        if os.path.exists(file1):
            os.remove(file1)
        if os.path.exists(file2):
            os.remove(file2)
        
        history_path = os.path.join(get_app_folder(), 'history.json')
        if os.path.exists(history_path):
            with open(history_path, 'r', encoding='utf-8') as f:
                history = json.load(f)
            
            new_history = [entry for entry in history 
                         if not (entry['file1'] == file1 and entry['file2'] == file2)]
            
            with open(history_path, 'w', encoding='utf-8') as f:
                json.dump(new_history, f, indent=2)
        
        return jsonify({"status": "ok"})
    
    except Exception as e:
        logging.error(f"Error deleting history item: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500