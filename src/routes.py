import logging
import os
import shutil
import json
from datetime import datetime
from flask import Blueprint, request, jsonify, render_template
from converter import convert_psim_to_asse
from ifc_converter import convert_excel_to_ifc
from utils import HistoryManager

# TODO: from ifc_transfer import transfer_properties_between_ifc

logger = logging.getLogger(__name__)

bp = Blueprint('main', __name__)


@bp.route('/')
def index():
    """Отображает главную страницу."""
    return render_template('main_window.html')


@bp.route('/convert', methods=['POST'])
def convert_route():
    """Обрабатывает запрос на конвертацию PSIM -> ACCE."""
    data = request.json
    psim_file = data.get('inputFile')
    second_file = data.get('secondFile')
    output_file_path = data.get('outputFile')  # Путь, КУДА сохранить результат

    if not all([psim_file, second_file, output_file_path]):
        logger.error("Ошибка запроса /convert: Отсутствуют необходимые параметры.")
        return jsonify({"status": "error", "message": "Отсутствуют входные или выходной пути."}), 400

    if os.path.isdir(output_file_path):
        output_filename = "export_spreadsheet.xlsx"  # Имя файла по умолчанию
        output_file_path = os.path.join(output_file_path, output_filename)
        logger.info(f"Путь вывода был папкой, сформирован полный путь: {output_file_path}")

    input_paths = [f for f in [psim_file, second_file] if f]

    try:
        logger.info(f"Начало конвертации PSIM: {input_paths} -> {output_file_path}")

        convert_psim_to_asse(psim_file, second_file, output_file_path)

        logger.info(f"Конвертация PSIM успешно завершена.")

        HistoryManager.add_entry(
            entry_type="PSIM_TO_ACCE",
            status="success",
            input_file_paths=input_paths,
            output_file_paths=[output_file_path],
            metadata={"comment": "PSIM to ACCE conversion successful"},
            error_message=None
        )
        return jsonify({"status": "success", "message": "Конвертирование PSIM -> ACCE завершено успешно!"})

    except Exception as e:
        error_msg = f"Ошибка во время конвертации PSIM: {e}"
        logger.exception(error_msg)

        HistoryManager.add_entry(
            entry_type="PSIM_TO_ACCE",
            status="error",
            input_file_paths=input_paths,
            output_file_paths=[],
            metadata={},
            error_message=str(e)
        )
        return jsonify({"status": "error", "message": error_msg}), 500


@bp.route('/convert_ifc', methods=['POST'])
def convert_ifc_route():
    """Обрабатывает запрос на обновление свойств IFC из Excel."""
    data = request.json
    ifc_file_paths = data.get('ifcFiles', [])
    excel_file_path = data.get('attribFile')
    output_file_path = data.get('outputFile')

    if not ifc_file_paths or not excel_file_path or not output_file_path:
        logger.error("Ошибка запроса /convert_ifc: Отсутствуют необходимые параметры.")
        return jsonify({"status": "error", "message": "Не указаны IFC файлы, файл атрибутов или путь вывода."}), 400

    output_folder_path = output_file_path
    if not os.path.isdir(output_folder_path):
        logger.error(f"Ошибка запроса /convert_ifc: Путь вывода '{output_folder_path}' не является папкой.")
        return jsonify({"status": "error", "message": f"Путь вывода '{output_folder_path}' должен быть папкой."}), 400

    all_input_paths = ifc_file_paths + [excel_file_path]
    processed_output_paths = []
    errors_occurred = []

    logger.info(
        f"Начало обработки IFC: {len(ifc_file_paths)} файлов, атрибуты из {excel_file_path} -> папка {output_folder_path}")

    for ifc_file in ifc_file_paths:
        base_name = os.path.basename(ifc_file)
        name, ext = os.path.splitext(base_name)
        current_output_path = os.path.join(output_folder_path, f"{name}_updated{ext}")

        try:
            logger.info(f"Обработка {ifc_file} -> {current_output_path}")
            convert_excel_to_ifc(ifc_file, excel_file_path, current_output_path)
            processed_output_paths.append(current_output_path)
            logger.info(f"Файл {ifc_file} успешно обработан.")

        except Exception as e:
            error_msg = f"Ошибка при обработке файла {ifc_file}: {e}"
            logger.exception(error_msg)
            errors_occurred.append(error_msg)

    final_status = "error" if errors_occurred else "success"
    final_message = f"Обработка IFC завершена. Успешно: {len(processed_output_paths)}, Ошибок: {len(errors_occurred)}."
    if errors_occurred:
        final_message += f" Первая ошибка: {errors_occurred[0]}"

    history_error_message = "; ".join(errors_occurred) if errors_occurred else None

    HistoryManager.add_entry(
        entry_type="IFC_UPDATE",
        status=final_status,
        input_file_paths=all_input_paths,
        output_file_paths=processed_output_paths,
        metadata={
            "ifc_files_in_batch": len(ifc_file_paths),
            "successful_ifc_updates": len(processed_output_paths),
            "attribute_source": excel_file_path,
            "output_destination_folder": output_folder_path
        },
        error_message=history_error_message
    )

    if final_status == "success":
        return jsonify({"status": "success", "message": final_message})
    else:
        return jsonify({"status": "error", "message": final_message}), 500


@bp.route('/transfer_ifc', methods=['POST'])
def transfer_ifc_route():
    """
    Копирует пользовательские свойства/атрибуты из old_ifc в new_ifc
    и сохраняет результат в output_file.
    """
    data = request.json or {}
    old_ifc = data.get('oldIfcFile')
    new_ifc = data.get('newIfcFile')
    output = data.get('outputFile')

    if not all([old_ifc, new_ifc, output]):
        return jsonify({"status": "error", "message": "Не заполнены все поля."}), 400

    try:
        # transfer_properties_between_ifc(old_ifc, new_ifc, output)

        HistoryManager.add_entry(
            entry_type="IFC_TRANSFER",
            status="success",
            input_file_paths=[old_ifc, new_ifc],
            output_file_paths=[output],
            metadata={},
            error_message=None
        )
        return jsonify({"status": "success", "message": "Перенос данных завершён!"})
    except Exception as e:
        logger.exception("Ошибка transfer_ifc")
        HistoryManager.add_entry(
            entry_type="IFC_TRANSFER",
            status="error",
            input_file_paths=[old_ifc, new_ifc],
            output_file_paths=[],
            metadata={},
            error_message=str(e)
        )
        return jsonify({"status": "error", "message": str(e)}), 500


@bp.route('/get_history', methods=['GET'])
def get_history():
    """Возвращает всю историю конвертаций."""
    try:
        history = HistoryManager.get_all_entries()
        history.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
        return jsonify(history)
    except Exception as e:
        logger.exception("Ошибка при получении истории.")
        return jsonify({"status": "error", "message": "Не удалось загрузить историю."}), 500


@bp.route('/get_history_entry/<entry_id>', methods=['GET'])
def get_history_entry(entry_id):
    """Возвращает детали одной записи истории по ее ID."""
    if not entry_id:
        return jsonify({"status": "error", "message": "ID записи не указан."}), 400
    try:
        entry = HistoryManager.get_entry_by_id(entry_id)
        if entry:
            return jsonify(entry)
        else:
            logger.warning(f"Запись истории с ID {entry_id} не найдена.")
            return jsonify({"status": "error", "message": "Запись не найдена."}), 404
    except Exception as e:
        logger.exception(f"Ошибка при получении записи истории {entry_id}.")
        return jsonify({"status": "error", "message": "Ошибка на сервере при получении записи."}), 500


@bp.route('/delete_history_item/<entry_id>', methods=['DELETE'])
def delete_history_item(entry_id):
    """Удаляет одну запись из истории по ID."""
    if not entry_id:
        return jsonify({"status": "error", "message": "ID записи не указан."}), 400
    try:
        deleted = HistoryManager.delete_entry(entry_id)
        if deleted:
            return jsonify({"status": "success", "message": f"Запись {entry_id} удалена."})
        else:
            logger.warning(f"Попытка удалить запись {entry_id}, но она не найдена.")
            return jsonify({"status": "error", "message": "Запись не найдена."}), 404
    except Exception as e:
        logger.exception(f"Ошибка при удалении записи истории {entry_id}.")
        return jsonify({"status": "error", "message": "Ошибка на сервере при удалении записи."}), 500


@bp.route('/clear_all_history', methods=['DELETE'])
def clear_all_history_route():
    """Очищает всю историю конвертаций."""
    try:
        HistoryManager.clear_all_history()
        return jsonify({"status": "success", "message": "История полностью очищена."})
    except Exception as e:
        logger.exception("Ошибка при полной очистке истории.")
        return jsonify({"status": "error", "message": "Ошибка на сервере при очистке истории."}), 500
