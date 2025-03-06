import logging
import os

from flask import Blueprint, request, jsonify, render_template
from converter import convert_psim_to_asse

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
        return jsonify({"status": "success", "message": "Conversion complete!"})
    except Exception as e:
        logging.error(f"Error during conversion: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500
