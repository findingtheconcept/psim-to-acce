# utils.py
import os
import uuid
import json
import shutil
import logging
from datetime import datetime

# Настроим логирование для utils, если оно еще не настроено глобально
logger = logging.getLogger(__name__)

def get_app_folder():
    home = os.path.expanduser("~")
    # Используем точку в начале для скрытия папки (опционально, зависит от ОС)
    folder = os.path.join(home, ".psim_acce_converter")
    if not os.path.exists(folder):
        try:
            os.makedirs(folder, exist_ok=True)
        except OSError as e:
            logger.error(f"Не удалось создать папку приложения {folder}: {e}")
            # В случае ошибки можно использовать временную папку или текущую директорию
            # как запасной вариант, но это менее надежно для персистентности.
            # Здесь для примера возвращаем None или поднимаем исключение
            raise OSError(f"Не могу создать папку приложения: {folder}") from e
    return folder

def get_history_folder():
    app_folder = get_app_folder()
    folder = os.path.join(app_folder, "history")
    os.makedirs(folder, exist_ok=True) # Убедимся, что папка существует
    return folder

class HistoryManager:
    @staticmethod
    def _get_history_path():
        app_folder = get_app_folder()
        return os.path.join(app_folder, "history.json")

    @staticmethod
    def _save_history(history):
        history_path = HistoryManager._get_history_path()
        try:
            with open(history_path, 'w', encoding='utf-8') as f:
                json.dump(history, f, ensure_ascii=False, indent=2)
        except IOError as e:
            logger.error(f"Не удалось сохранить историю в {history_path}: {e}")
        except TypeError as e:
            logger.error(f"Ошибка сериализации истории в JSON: {e}")


    @staticmethod
    def add_entry(entry_type, status, input_file_paths, output_file_paths, metadata=None, error_message=None):
        entry_id = str(uuid.uuid4())
        timestamp = datetime.now().isoformat()
        history_base_folder = get_history_folder()
        entry_folder = os.path.join(history_base_folder, entry_id)
        input_folder = os.path.join(entry_folder, "input")
        output_folder = os.path.join(entry_folder, "output")

        try:
            os.makedirs(input_folder, exist_ok=True)
            os.makedirs(output_folder, exist_ok=True)
        except OSError as e:
            logger.error(f"Не удалось создать папки для записи истории {entry_id}: {e}")
            return None 

        processed_input_files = []
        for file_path in input_file_paths:
            if not file_path or not os.path.exists(file_path) or not os.path.isfile(file_path):
                logger.warning(f"Входной файл не найден или не является файлом: {file_path}")
                processed_input_files.append({
                     "original_name": os.path.basename(file_path) if file_path else "N/A",
                     "saved_path": None,
                     "error": "File not found or invalid"
                })
                continue

            original_name = os.path.basename(file_path)
            destination_path = os.path.join(input_folder, original_name)
            try:
                shutil.copy2(file_path, destination_path)
                processed_input_files.append({
                    "original_name": original_name,
                    "saved_path": destination_path
                })
            except Exception as e:
                logger.error(f"Не удалось скопировать входной файл {file_path} в {destination_path}: {e}")
                processed_input_files.append({
                    "original_name": original_name,
                    "saved_path": None,
                    "error": f"Failed to copy: {e}"
                })


        processed_output_files = []
        if status == "success":
            for file_path in output_file_paths:
                if not file_path or not os.path.exists(file_path) or not os.path.isfile(file_path):
                    logger.warning(f"Выходной файл не найден или не является файлом: {file_path}")
                    processed_output_files.append({
                        "original_name": os.path.basename(file_path) if file_path else "N/A",
                        "saved_path": None,
                        "error": "File not found or invalid after conversion"
                    })
                    continue

                original_name = os.path.basename(file_path)
                destination_path = os.path.join(output_folder, original_name)
                try:
                    shutil.copy2(file_path, destination_path)
                    processed_output_files.append({
                        "original_name": original_name,
                        "saved_path": destination_path
                    })
                except Exception as e:
                    logger.error(f"Не удалось скопировать выходной файл {file_path} в {destination_path}: {e}")
                    processed_output_files.append({
                        "original_name": original_name,
                        "saved_path": None,
                        "error": f"Failed to copy: {e}"
                    })

        entry = {
            "id": entry_id,
            "timestamp": timestamp,
            "entry_type": entry_type,
            "status": status,
            "error_message": error_message if status == "error" else None,
            "input_files": processed_input_files,
            "output_files": processed_output_files,
            "metadata": metadata or {}
        }

        history = HistoryManager.get_all_entries()
        history.append(entry)
        HistoryManager._save_history(history)

        logger.info(f"Добавлена запись в историю: ID={entry_id}, Type={entry_type}, Status={status}")
        return entry_id

    @staticmethod
    def get_all_entries():
        """Возвращает всю историю из JSON файла."""
        history_path = HistoryManager._get_history_path()
        if not os.path.exists(history_path):
            return []

        try:
            with open(history_path, 'r', encoding='utf-8') as f:
                history_data = json.load(f)
                if isinstance(history_data, list):
                    return history_data
                else:
                    logger.warning(f"Файл истории {history_path} не содержит JSON-массив. Возвращен пустой список.")
                    return []
        except json.JSONDecodeError as e:
            logger.error(f"Ошибка декодирования JSON из файла истории {history_path}: {e}. Возвращен пустой список.")
            return []
        except IOError as e:
            logger.error(f"Ошибка чтения файла истории {history_path}: {e}. Возвращен пустой список.")
            return []

    @staticmethod
    def get_entry_by_id(entry_id):
        """Возвращает одну запись истории по ее ID."""
        history = HistoryManager.get_all_entries()
        for entry in history:
            if entry.get("id") == entry_id:
                return entry
        return None 
    
    @staticmethod
    def delete_entry(entry_id):
        """Удаляет запись из истории и связанные с ней скопированные файлы."""
        history = HistoryManager.get_all_entries()
        entry_to_delete = None
        new_history = []
        for entry in history:
             if entry.get("id") == entry_id:
                 entry_to_delete = entry
             else:
                 new_history.append(entry)

        if entry_to_delete is None:
             logger.warning(f"Попытка удалить несуществующую запись истории: {entry_id}")
             return False

        HistoryManager._save_history(new_history)

        # Удаляем папку с файлами этой записи
        entry_folder = os.path.join(get_history_folder(), entry_id)
        if os.path.exists(entry_folder) and os.path.isdir(entry_folder):
            try:
                shutil.rmtree(entry_folder)
                logger.info(f"Удалена папка с файлами истории: {entry_folder}")
            except Exception as e:
                logger.error(f"Не удалось удалить папку истории {entry_folder}: {e}")
        else:
            logger.warning(f"Папка для удаляемой записи истории не найдена: {entry_folder}")

        logger.info(f"Удалена запись истории: ID={entry_id}")
        return True

    @staticmethod
    def clear_all_history():
        """Полностью очищает историю: удаляет JSON файл и все папки с копиями файлов."""
        history_path = HistoryManager._get_history_path()
        history_folder = get_history_folder()

        # Удаляем JSON файл
        if os.path.exists(history_path):
            try:
                os.remove(history_path)
                logger.info(f"Файл истории удален: {history_path}")
            except OSError as e:
                logger.error(f"Не удалось удалить файл истории {history_path}: {e}")

        # Удаляем папку history со всем содержимым
        if os.path.exists(history_folder) and os.path.isdir(history_folder):
            try:
                shutil.rmtree(history_folder)
                logger.info(f"Папка истории удалена: {history_folder}")
                os.makedirs(history_folder, exist_ok=True)
            except Exception as e:
                logger.error(f"Не удалось удалить папку истории {history_folder}: {e}")

        HistoryManager._save_history([])
        logger.info("Вся история очищена.")