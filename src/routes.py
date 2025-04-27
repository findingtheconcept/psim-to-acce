# routes.py
import logging
import os
import shutil
import json
from datetime import datetime
from flask import Blueprint, request, jsonify, render_template
from converter import convert_psim_to_asse # Ваша функция конвертации PSIM
from ifc_converter import convert_excel_to_ifc # Ваша функция конвертации IFC
from utils import HistoryManager # Импортируем обновленный HistoryManager

# Настроим логирование для routes
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
    output_file_path = data.get('outputFile') # Путь, КУДА сохранить результат

    # Проверяем наличие обязательных параметров
    if not all([psim_file, second_file, output_file_path]):
        logger.error("Ошибка запроса /convert: Отсутствуют необходимые параметры.")
        return jsonify({"status": "error", "message": "Отсутствуют входные или выходной пути."}), 400

    # Если указана папка, формируем полное имя файла
    if os.path.isdir(output_file_path):
        output_filename = "export_spreadsheet.xlsx" # Имя файла по умолчанию
        output_file_path = os.path.join(output_file_path, output_filename)
        logger.info(f"Путь вывода был папкой, сформирован полный путь: {output_file_path}")

    # Собираем пути входных файлов для истории
    input_paths = [f for f in [psim_file, second_file] if f] # Отфильтруем None/пустые строки, если вдруг придут

    try:
        logger.info(f"Начало конвертации PSIM: {input_paths} -> {output_file_path}")
        # === Вызов вашей функции конвертации ===
        convert_psim_to_asse(psim_file, second_file, output_file_path)
        # =====================================
        logger.info(f"Конвертация PSIM успешно завершена.")

        # Добавляем запись в историю при УСПЕХЕ
        HistoryManager.add_entry(
            entry_type="PSIM_TO_ACCE",
            status="success",
            input_file_paths=input_paths,
            output_file_paths=[output_file_path], # Список из одного элемента
            metadata={"comment": "PSIM to ACCE conversion successful"},
            error_message=None
        )
        return jsonify({"status": "success", "message": "Конвертирование PSIM -> ACCE завершено успешно!"})

    except Exception as e:
        error_msg = f"Ошибка во время конвертации PSIM: {e}"
        logger.exception(error_msg) # Используем exception для вывода traceback

        # Добавляем запись в историю при ОШИБКЕ
        HistoryManager.add_entry(
            entry_type="PSIM_TO_ACCE",
            status="error",
            input_file_paths=input_paths, # Сохраняем входные пути (best effort)
            output_file_paths=[],        # Выходных файлов нет
            metadata={},
            error_message=str(e) # Сохраняем текст ошибки
        )
        return jsonify({"status": "error", "message": error_msg}), 500

@bp.route('/convert_ifc', methods=['POST'])
def convert_ifc_route():
    """Обрабатывает запрос на обновление свойств IFC из Excel."""
    data = request.json
    ifc_file_paths = data.get('ifcFiles', [])  # Список путей к IFC файлам
    excel_file_path = data.get('attribFile')    # Путь к Excel файлу атрибутов
    output_file_path = data.get('outputFile')   # Путь, КУДА сохранить РЕЗУЛЬТАТ (один файл?)
                                               # ВАЖНО: Текущий ifc_converter.py перезаписывает выходной файл для каждого входного.
                                               # Нужно уточнить, ожидается ли один объединенный файл или несколько?
                                               # Пока предполагаем, что output_file_path - это ПАПКА или ШАБЛОН имени.
                                               # Если это один файл, то логика должна быть иной (объединение или ошибка).
                                               # --- Предположим, что output_file_path - это папка назначения ---

    if not ifc_file_paths or not excel_file_path or not output_file_path:
         logger.error("Ошибка запроса /convert_ifc: Отсутствуют необходимые параметры.")
         return jsonify({"status": "error", "message": "Не указаны IFC файлы, файл атрибутов или путь вывода."}), 400

    # Проверяем, является ли путь вывода папкой
    output_folder_path = output_file_path
    if not os.path.isdir(output_folder_path):
        # Если это не папка, возможно, это ошибка или нужно создать папку?
        # Для безопасности вернем ошибку, если это не папка.
        logger.error(f"Ошибка запроса /convert_ifc: Путь вывода '{output_folder_path}' не является папкой.")
        return jsonify({"status": "error", "message": f"Путь вывода '{output_folder_path}' должен быть папкой."}), 400


    all_input_paths = ifc_file_paths + [excel_file_path] # Все входные для истории
    processed_output_paths = [] # Собираем пути к реально созданным выходным файлам
    errors_occurred = [] # Собираем ошибки для каждого файла

    logger.info(f"Начало обработки IFC: {len(ifc_file_paths)} файлов, атрибуты из {excel_file_path} -> папка {output_folder_path}")

    # Обрабатываем каждый IFC файл
    for ifc_file in ifc_file_paths:
        # Формируем имя выходного файла (например, добавляя суффикс)
        base_name = os.path.basename(ifc_file)
        name, ext = os.path.splitext(base_name)
        current_output_path = os.path.join(output_folder_path, f"{name}_updated{ext}")

        try:
            logger.info(f"Обработка {ifc_file} -> {current_output_path}")
            # === Вызов вашей функции конвертации ===
            convert_excel_to_ifc(ifc_file, excel_file_path, current_output_path)
            # =====================================
            processed_output_paths.append(current_output_path) # Добавляем успешный результат
            logger.info(f"Файл {ifc_file} успешно обработан.")

        except Exception as e:
            error_msg = f"Ошибка при обработке файла {ifc_file}: {e}"
            logger.exception(error_msg) # Логируем с traceback
            errors_occurred.append(error_msg)
            # Прерывать ли обработку остальных файлов - зависит от требований.
            # continue # Продолжаем обработку следующих файлов

    # Определяем общий статус и сообщение по результатам обработки всех файлов
    final_status = "error" if errors_occurred else "success"
    final_message = f"Обработка IFC завершена. Успешно: {len(processed_output_paths)}, Ошибок: {len(errors_occurred)}."
    if errors_occurred:
        # Добавляем первое сообщение об ошибке к общему сообщению
        final_message += f" Первая ошибка: {errors_occurred[0]}"

    # Формируем сообщение об ошибке для записи в историю (если были ошибки)
    history_error_message = "; ".join(errors_occurred) if errors_occurred else None

    # Добавляем ОДНУ запись в историю по итогам всей операции
    HistoryManager.add_entry(
        entry_type="IFC_UPDATE",
        status=final_status,
        input_file_paths=all_input_paths,
        output_file_paths=processed_output_paths, # Только успешно созданные
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
        # Возвращаем 500 Internal Server Error, если были ошибки в процессе
        return jsonify({"status": "error", "message": final_message}), 500


# --- Маршруты для управления историей ---

@bp.route('/get_history', methods=['GET'])
def get_history():
    """Возвращает всю историю конвертаций."""
    try:
        history = HistoryManager.get_all_entries()
        # Можно добавить сортировку по timestamp перед отправкой
        history.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
        return jsonify(history)
    except Exception as e:
        logger.exception("Ошибка при получении истории.")
        return jsonify({"status": "error", "message": "Не удалось загрузить историю."}), 500

@bp.route('/delete_history_item/<entry_id>', methods=['DELETE']) # Используем DELETE
def delete_history_item(entry_id):
    """Удаляет одну запись из истории по ID."""
    if not entry_id:
         return jsonify({"status": "error", "message": "ID записи не указан."}), 400
    try:
        deleted = HistoryManager.delete_entry(entry_id)
        if deleted:
            return jsonify({"status": "success", "message": f"Запись {entry_id} удалена."})
        else:
            # Это может произойти, если запись уже была удалена или ID неверный
            logger.warning(f"Попытка удалить запись {entry_id}, но она не найдена.")
            return jsonify({"status": "error", "message": "Запись не найдена."}), 404
    except Exception as e:
        logger.exception(f"Ошибка при удалении записи истории {entry_id}.")
        return jsonify({"status": "error", "message": "Ошибка на сервере при удалении записи."}), 500

# Используем метод DELETE для очистки всей коллекции
@bp.route('/clear_all_history', methods=['DELETE'])
def clear_all_history_route():
    """Очищает всю историю конвертаций."""
    try:
        HistoryManager.clear_all_history()
        return jsonify({"status": "success", "message": "История полностью очищена."})
    except Exception as e:
        logger.exception("Ошибка при полной очистке истории.")
        return jsonify({"status": "error", "message": "Ошибка на сервере при очистке истории."}), 500

# --- Удаленный маршрут ---
# Маршрут /store_history БОЛЬШЕ НЕ НУЖЕН, так как добавление происходит
# внутри /convert и /convert_ifc после выполнения операции.
# Убедитесь, что вы удалили вызовы fetch('/store_history', ...) из вашего frontend кода (main_window.js)