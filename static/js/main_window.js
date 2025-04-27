"use strict";

// --- Получение элементов DOM ---
const screenPSIM = document.getElementById("screenPSIM");
const screenIFC = document.getElementById("screenIFC");
const titleText = document.getElementById("titleText");
const btnToggleIFC = document.getElementById("btnToggleIFC");
const btnDarkMode = document.getElementById("btnDarkMode");
const btnHelp = document.getElementById("btnHelp");

// PSIM Screen Elements
const btnSelectFile1 = document.getElementById("btnSelectFile1");
const btnSelectFile2 = document.getElementById("btnSelectFile2");
const filePath1 = document.getElementById("filePath1");
const filePath2 = document.getElementById("filePath2");
const btnConvert = document.getElementById("btnConvert");

// IFC Screen Elements
const btnSelectIFC = document.getElementById("btnSelectIFC");
const btnSelectAttrib = document.getElementById("btnSelectAttrib");
const ifcList = document.getElementById("ifcList"); // Контейнер для списка IFC файлов
const attribPath = document.getElementById("attribPath");
const btnConvertIFC = document.getElementById("btnConvertIFC");

// Common Elements
const progressContainer = document.getElementById("progressContainer");
const progressBar = document.getElementById("progressBar");

// History Modal Elements
const btnHistory = document.getElementById("btnHistory");
const historyModalEl = document.getElementById("historyModal");
const historyModal = new bootstrap.Modal(historyModalEl);
const historyList = document.getElementById("historyList");
const historySearch = document.getElementById("historySearch");
const btnClearAll = document.getElementById("btnClearAll");

// --- Глобальные переменные состояния ---
let selectedIFCs = []; // Массив путей к выбранным IFC файлам
let selectedAttrib = ""; // Путь к файлу атрибутов
let selectedFile1 = ""; // Путь к первому файлу PSIM
let selectedFile2 = ""; // Путь ко второму файлу PSIM

// --- Вспомогательные функции ---

function setProgress(p) {
  progressBar.style.width = p + "%";
  progressBar.setAttribute("aria-valuenow", p);
  progressBar.textContent = p > 5 ? `${p}%` : ""; // Показываем текст только если прогресс заметен
}

function formatDateTime(isoString) {
  if (!isoString) return "N/A";
  try {
    const dateObj = new Date(isoString);
    const pad = (n) => String(n).padStart(2, "0");
    const d = pad(dateObj.getDate());
    const m = pad(dateObj.getMonth() + 1);
    const y = dateObj.getFullYear();
    const hh = pad(dateObj.getHours());
    const mm = pad(dateObj.getMinutes());
    const ss = pad(dateObj.getSeconds());
    return `${d}.${m}.${y} ${hh}:${mm}:${ss}`;
  } catch (e) {
    console.error("Error formatting date:", isoString, e);
    return "Invalid Date";
  }
}

// Функция для безопасного отображения текста (предотвращает XSS)
function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function highlightText(original, search) {
    if (!search || !original) return escapeHTML(original);
    // Экранируем спецсимволы в строке поиска для RegExp
    const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(escapedSearch, "gi");
    const highlighted = escapeHTML(original).replace(re, (match) => `<span class="highlight">${match}</span>`);
    return highlighted; // Возвращаем HTML, т.к. он будет вставлен через innerHTML
}


async function fetchJson(url, options = {}) {
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      // Попытаемся прочитать тело ошибки, если оно есть
      let errorData;
      try {
          errorData = await response.json();
      } catch {
          errorData = { message: response.statusText };
      }
      console.error("Fetch error:", response.status, errorData);
      throw new Error(errorData.message || `HTTP error ${response.status}`);
    }
    // Если статус 204 No Content, возвращаем null, а не пытаемся парсить JSON
    if (response.status === 204) {
        return null;
    }
    return response.json();
  } catch (error) {
    console.error("Network or fetch error:", error);
    // Перебрасываем ошибку для обработки выше
    throw error;
  }
}


// --- Функции Истории ---

// Функция для получения иконки и названия типа операции
function getHistoryEntryTypeDetails(entryType) {
    switch (entryType) {
        case "PSIM_TO_ACCE":
            return { icon: "bi-file-earmark-spreadsheet", label: "PSIM -> ACCE" };
        case "IFC_UPDATE":
            return { icon: "bi-box-seam", label: "IFC Update" };
        // Добавить сюда case для новых типов конвертеров
        default:
            return { icon: "bi-question-circle", label: entryType || "Неизвестно" };
    }
}

// Функция для рендеринга списка файлов
function renderFileList(files, listTitle, filterText) {
    if (!files || !files.length) {
        return `<small class="text-muted">${escapeHTML(listTitle)}: нет</small>`;
    }
    // Ограничим показ, если файлов слишком много
    const maxVisible = 3;
    let fileHtml = files.slice(0, maxVisible).map(file => {
        const name = file.original_name || 'N/A';
        const errorMark = file.error ? ' <i class="bi bi-exclamation-triangle-fill text-danger" title="Ошибка копирования/отсутствует"></i>' : '';
        // Используем highlightText для безопасного выделения
        return `<pre class="text-break d-block mb-0">${highlightText(name, filterText)}${errorMark}</pre>`;
    }).join('');

    if (files.length > maxVisible) {
        fileHtml += `<small class="d-block text-muted">(+${files.length - maxVisible} еще)</small>`;
    }

    return `<strong>${escapeHTML(listTitle)}:</strong>${fileHtml}`;
}


// *** Основная функция рендеринга истории ***
async function renderHistory(filterText = "") {
  historyList.innerHTML = '<li class="list-group-item text-muted">Загрузка...</li>'; // Индикатор загрузки

  try {
    // Загружаем историю с сервера
    const history = await fetchJson('/get_history'); // GET запрос по умолчанию

    historyList.innerHTML = ''; // Очищаем перед рендерингом

    if (!Array.isArray(history)) {
         throw new Error("Получен неверный формат истории");
    }

    if (!history.length) {
      historyList.innerHTML = '<li class="list-group-item text-muted">История пуста</li>';
      return;
    }

    // Фильтрация на клиенте (можно перенести на сервер для больших историй)
    const filteredHistory = history.filter(entry => {
      const searchTerm = filterText.toLowerCase();
      if (!searchTerm) return true; // Если фильтра нет, показываем все

      // Проверка по дате/времени
      if (formatDateTime(entry.timestamp).toLowerCase().includes(searchTerm)) return true;
      // Проверка по типу
      if ((entry.entry_type || '').toLowerCase().includes(searchTerm)) return true;
      // Проверка по именам входных файлов
      if (entry.input_files && entry.input_files.some(f => (f.original_name || '').toLowerCase().includes(searchTerm))) return true;
      // Проверка по именам выходных файлов
      if (entry.output_files && entry.output_files.some(f => (f.original_name || '').toLowerCase().includes(searchTerm))) return true;
      // Проверка по сообщению об ошибке
      if (entry.status === 'error' && (entry.error_message || '').toLowerCase().includes(searchTerm)) return true;

      return false; // Не найдено совпадений
    });

    if (!filteredHistory.length) {
      historyList.innerHTML = '<li class="list-group-item text-muted">Нет записей, соответствующих фильтру</li>';
      return;
    }

    // Рендеринг отфильтрованных записей
    filteredHistory.forEach(entry => {
      const li = document.createElement("li");
      // Добавляем классы в зависимости от статуса
      li.className = `list-group-item history-item ${entry.status === 'error' ? 'list-group-item-danger' : ''}`;
      li.setAttribute('data-entry-id', entry.id); // Сохраняем ID для удаления

      const { icon: typeIcon, label: typeLabel } = getHistoryEntryTypeDetails(entry.entry_type);
      const dateString = formatDateTime(entry.timestamp);
      const dateHtml = highlightText(dateString, filterText); // Безопасное выделение

      const statusIcon = entry.status === 'success'
          ? '<i class="bi bi-check-circle-fill text-success ms-2" title="Успешно"></i>'
          : '<i class="bi bi-x-octagon-fill text-danger ms-2" title="Ошибка"></i>';

      const inputFilesHtml = renderFileList(entry.input_files, 'Входные файлы', filterText);
      const outputFilesHtml = renderFileList(entry.output_files, 'Выходные файлы', filterText);

      // Отображаем сообщение об ошибке, если есть
      const errorHtml = entry.status === 'error' && entry.error_message
          ? `<div class="mt-1"><small class="text-danger"><strong>Ошибка:</strong> ${highlightText(entry.error_message, filterText)}</small></div>`
          : '';

      li.innerHTML = `
        <div class="d-flex justify-content-between align-items-start mb-1">
          <div>
            <i class="bi ${typeIcon} me-2"></i>
            <strong class="me-2">${escapeHTML(typeLabel)}</strong>
            ${statusIcon}
          </div>
          <button class="btn btn-danger btn-sm history-delete-btn" data-entry-id="${entry.id}" title="Удалить запись">
             <i class="bi bi-trash"></i>
          </button>
        </div>
        <small class="text-muted d-block mb-2">${dateHtml}</small>
        <div class="mb-1">${inputFilesHtml}</div>
        <div class="mb-1">${outputFilesHtml}</div>
        ${errorHtml}`;

      // НЕ добавляем обработчик клика на сам элемент li для "восстановления"

      historyList.appendChild(li);
    });

    // Добавляем обработчик для кнопок удаления (используем делегирование)
    historyList.addEventListener('click', handleDeleteClick);

  } catch (err) {
    console.error("Ошибка при загрузке или рендеринге истории:", err);
    historyList.innerHTML = `<li class="list-group-item list-group-item-warning">Не удалось загрузить историю: ${escapeHTML(err.message || String(err))}</li>`;
    // Можно использовать Swal для более заметного сообщения
    // Swal.fire("Ошибка", `Не удалось загрузить историю: ${err.message || String(err)}`, "error");
  }
}

// Обработчик клика на кнопку удаления (делегированный)
async function handleDeleteClick(event) {
    const deleteButton = event.target.closest('.history-delete-btn');
    if (!deleteButton) return; // Клик был не по кнопке удаления

    const entryId = deleteButton.dataset.entryId;
    if (!entryId) return;

    const confirmRes = await Swal.fire({
        title: "Удалить запись?",
        text: "Связанные файлы также будут удалены.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Да, удалить",
        cancelButtonText: "Отмена",
        confirmButtonColor: "#d33", // Красный цвет для кнопки удаления
    });

    if (!confirmRes.isConfirmed) return;

    try {
        // Отправляем DELETE запрос
        await fetchJson(`/delete_history_item/${entryId}`, { method: "DELETE" });
        // Перерисовываем историю после успешного удаления
        renderHistory(historySearch.value); // Используем текущее значение фильтра
        showToast("Успех", "Запись истории удалена", true); // Используем общий тост
    } catch (err) {
        console.error(`Ошибка удаления записи ${entryId}:`, err);
        Swal.fire("Ошибка", `Не удалось удалить запись: ${err.message || String(err)}`, "error");
    }
}


// Обработчик кнопки "Очистить всё"
btnClearAll.addEventListener("click", async () => {
  const confirmRes = await Swal.fire({
    title: "Очистить всю историю?",
    text: "Это действие необратимо, все записи и файлы будут удалены!",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Да, очистить всё",
    cancelButtonText: "Отмена",
    confirmButtonColor: "#d33",
  });

  if (!confirmRes.isConfirmed) return;

  try {
    // Отправляем DELETE запрос
    await fetchJson("/clear_all_history", { method: "DELETE" });
    // Просто перерисовываем пустую историю
    renderHistory();
    showToast("Успех", "История успешно очищена", true); // Используем общий тост
  } catch (err) {
    console.error("Ошибка очистки истории:", err);
    Swal.fire("Ошибка", `Не удалось очистить историю: ${err.message || String(err)}`, "error");
  }
});


// --- Управление UI и Конвертацией ---

function showScreenPSIM() {
  screenPSIM.classList.add("active");
  screenIFC.classList.remove("active");
  titleText.textContent = "Конвертер PSIM (Excel) в ACCE";
  btnToggleIFC.textContent = "Перейти к IFC";
  btnToggleIFC.classList.remove("btn-danger");
  btnToggleIFC.classList.add("btn-warning");
}

function showScreenIFC() {
  screenPSIM.classList.remove("active");
  screenIFC.classList.add("active");
  titleText.textContent = "Работа с 3D-моделями (IFC)";
  btnToggleIFC.textContent = "Вернуться к PSIM";
  btnToggleIFC.classList.remove("btn-warning");
  btnToggleIFC.classList.add("btn-danger");
}

// Общая функция для показа Toast уведомлений
function showToast(title, body, success = true, duration = 5000) {
    // Определяем, какой экран активен, чтобы показать Toast там
    const activeScreenId = screenPSIM.classList.contains('active') ? 'PSIM' : 'IFC';
    const toastId = `toast${activeScreenId}`;
    const toastTitleId = `toast${activeScreenId}Title`;
    const toastBodyId = `toast${activeScreenId}Body`;
    const toastTimeId = `toast${activeScreenId}Time`;

    const toastEl = document.getElementById(toastId);
    const toastTitle = document.getElementById(toastTitleId);
    const toastBody = document.getElementById(toastBodyId);
    const toastTime = document.getElementById(toastTimeId);

    if (!toastEl || !toastTitle || !toastBody || !toastTime) {
        console.error(`Toast elements for ${activeScreenId} not found!`);
        // Как запасной вариант, используем SweetAlert
        Swal.fire({
            toast: true,
            position: 'bottom-end',
            icon: success ? 'success' : 'error',
            title: body, // В тосте Swal лучше кратко
            showConfirmButton: false,
            timer: duration,
            timerProgressBar: true
        });
        return;
    }

    toastTitle.textContent = title;
    toastBody.textContent = body;
    toastTime.textContent = new Date().toLocaleTimeString();
    toastEl.classList.remove("text-bg-danger", "text-bg-success");
    toastEl.classList.add(success ? "text-bg-success" : "text-bg-danger");

    // Показываем Toast
    const bsToast = bootstrap.Toast.getOrCreateInstance(toastEl, { delay: duration });
    bsToast.show();
}


// "Встряхивание" карточки, если поле не заполнено
function shakeIfEmpty(value, cardId) {
  let isEmpty = false;
  if (Array.isArray(value)) {
    isEmpty = !value.length;
  } else {
    isEmpty = !value;
  }

  if (isEmpty) {
    const el = document.getElementById(cardId);
    if (el) {
      el.classList.add("shake");
      // Убираем класс после завершения анимации
      setTimeout(() => el.classList.remove("shake"), 400);
    }
    return true; // Возвращаем true, если было пусто
  }
  return false; // Возвращаем false, если не было пусто
}

// --- Обработчики событий кнопок ---

btnToggleIFC.addEventListener("click", () => {
  if (screenPSIM.classList.contains("active")) {
    showScreenIFC();
  } else {
    showScreenPSIM();
  }
});

btnDarkMode.addEventListener("click", async () => {
  const root = document.getElementById("appRoot");
  const isDarkNow = root.classList.toggle("dark-mode");
  const newTheme = isDarkNow ? "dark" : "light";
  try {
    await pywebview.api.set_theme(newTheme);
  } catch (e) {
    console.warn("pywebview.api.set_theme not available?", e);
  }
});

btnHelp.addEventListener("click", async () => {
  try {
    const result = await pywebview.api.open_pdf_manual();
    if (result === "not_found") {
      Swal.fire("Ошибка", "Файл руководства (guide.pdf) не найден.", "error");
    }
  } catch (err) {
     console.error("Error opening help:", err);
     Swal.fire("Ошибка", `Не удалось открыть руководство: ${String(err)}`, "error");
  }
});

btnHistory.addEventListener("click", () => {
  historySearch.value = ''; // Сбрасываем поиск при открытии
  renderHistory(); // Загружаем и отображаем историю
  historyModal.show();
});

// Обработчик ввода в поле поиска истории
historySearch.addEventListener("input", () => {
  renderHistory(historySearch.value); // Перерисовываем с учетом фильтра
});

// --- PSIM Screen Logic ---

btnSelectFile1.addEventListener("click", async () => {
  filePath1.textContent = "";
  filePath1.style.display = "none";
  try {
    const path = await pywebview.api.select_source_file();
    if (path) {
      selectedFile1 = path;
      filePath1.textContent = path;
      filePath1.style.display = "block";
    } else {
      selectedFile1 = ""; // Сбрасываем, если пользователь отменил выбор
    }
  } catch(err) {
      console.error("Error selecting file 1:", err);
      showToast("Ошибка", "Не удалось выбрать файл #1", false);
  }
});

btnSelectFile2.addEventListener("click", async () => {
  filePath2.textContent = "";
  filePath2.style.display = "none";
  try {
    const path = await pywebview.api.select_source_file();
    if (path) {
      selectedFile2 = path;
      filePath2.textContent = path;
      filePath2.style.display = "block";
    } else {
      selectedFile2 = "";
    }
  } catch(err) {
      console.error("Error selecting file 2:", err);
      showToast("Ошибка", "Не удалось выбрать файл #2", false);
  }
});

btnConvert.addEventListener("click", async () => {
  // Проверяем, выбраны ли оба файла
  const file1Empty = shakeIfEmpty(selectedFile1, "psimCard1");
  const file2Empty = shakeIfEmpty(selectedFile2, "psimCard2");
  if (file1Empty || file2Empty) {
    showToast("Ошибка", "Необходимо выбрать оба входных файла.", false);
    return;
  }

  // Запрашиваем путь для сохранения
  let outputPath = "";
  try {
    outputPath = await pywebview.api.select_save_file_psim(); // Используем специфичный метод, если он есть
     if (!outputPath) {
        showToast("Отмена", "Путь для сохранения не выбран.", false);
        return;
     }
  } catch (e) {
    console.error("Error selecting save path:", e);
    showToast("Ошибка", "Не удалось выбрать путь сохранения.", false);
    return;
  }


  // Показываем прогресс и отправляем запрос
  progressContainer.style.display = "block";
  setProgress(10);

  const payload = {
    inputFile: selectedFile1,
    secondFile: selectedFile2,
    outputFile: outputPath,
  };

  setProgress(30); // Небольшой прогресс перед отправкой

  try {
      // Отправляем запрос на сервер
    const result = await fetchJson("/convert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setProgress(100);

    if (result.status === "success") {
      showToast("Успех", result.message || "Конвертация PSIM -> ACCE завершена!", true);
      // *** Удален вызов storeFiles() - история сохраняется на бэкенде ***
    } else {
      // Ошибка пришла от бэкенда
      showToast("Ошибка конвертации", result.message || "Произошла ошибка на сервере.", false);
    }
  } catch (err) {
    // Сетевая ошибка или ошибка fetch
    console.error("Conversion request failed:", err);
    showToast("Ошибка сети", `Не удалось выполнить конвертацию: ${err.message || String(err)}`, false);
  } finally {
    // Скрываем прогресс в любом случае
     setTimeout(() => { // Небольшая задержка, чтобы увидеть 100%
        progressContainer.style.display = "none";
        setProgress(0); // Сброс прогресс-бара
     }, 500);
  }
});


// --- IFC Screen Logic ---

// Добавляет путь к IFC файлу в UI-список
function addIFCItemToUI(path) {
  if (!path) return;
  const li = document.createElement("li");
  li.className = "list-group-item text-break p-1"; // Компактный вид
  li.textContent = path;
  // Добавить кнопку удаления для элемента списка? (опционально)
  ifcList.appendChild(li);
}

// Очистка списка выбранных IFC файлов в UI
function clearIFCListUI() {
    ifcList.innerHTML = '';
}

btnSelectIFC.addEventListener("click", async () => {
  try {
    const paths = await pywebview.api.select_source_files_ifc(); // Ожидаем массив путей
    if (paths && paths.length) {
      // Добавляем только новые уникальные пути
      paths.forEach(p => {
          if (p && !selectedIFCs.includes(p)) {
              selectedIFCs.push(p);
              addIFCItemToUI(p);
          }
      });
    }
  } catch (err) {
      console.error("Error selecting IFC files:", err);
      showToast("Ошибка", "Не удалось выбрать IFC файлы.", false);
  }
});

btnSelectAttrib.addEventListener("click", async () => {
  attribPath.textContent = "";
  attribPath.style.display = "none";
  try {
    const path = await pywebview.api.select_source_file();
    if (path) {
      selectedAttrib = path;
      attribPath.textContent = path;
      attribPath.style.display = "block";
    } else {
      selectedAttrib = "";
    }
  } catch (err) {
      console.error("Error selecting attribute file:", err);
      showToast("Ошибка", "Не удалось выбрать файл атрибутов.", false);
  }
});

btnConvertIFC.addEventListener("click", async () => {
  // Проверки на заполненность
  const ifcEmpty = shakeIfEmpty(selectedIFCs, "ifcCard1");
  const attribEmpty = shakeIfEmpty(selectedAttrib, "ifcCard2");
  if (ifcEmpty || attribEmpty) {
    showToast("Ошибка", "Нужно выбрать хотя бы один IFC файл и файл атрибутов.", false);
    return;
  }

  // Запрашиваем папку для сохранения
  let outputFolder = "";
  try {
    outputFolder = await pywebview.api.select_folder_ifc();
    if (!outputFolder) {
      showToast("Отмена", "Папка для сохранения не выбрана.", false);
      return;
    }
  } catch (e) {
    console.error("Error selecting output folder:", e);
    showToast("Ошибка", "Не удалось выбрать папку сохранения.", false);
    return;
  }

  progressContainer.style.display = "block";
  setProgress(10);

  const payload = {
    ifcFiles: selectedIFCs,       // Отправляем массив путей
    attribFile: selectedAttrib,
    outputFile: outputFolder,     // Отправляем путь к ПАПКЕ
  };

  setProgress(30);

  try {
    // Отправляем один запрос для всех файлов
    const result = await fetchJson("/convert_ifc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setProgress(100);

    if (result.status === "success") {
      showToast("Успех", result.message || "Обработка IFC завершена!", true);
    } else {
      // Бэкенд должен вернуть сообщение об общей ошибке или о первой ошибке
      showToast("Ошибка обработки IFC", result.message || "Произошла ошибка на сервере.", false);
       // Можно использовать Swal для более детального отображения ошибок, если они приходят списком
       // Swal.fire('Ошибка', result.message, 'error');
    }
  } catch (err) {
    console.error("IFC Conversion request failed:", err);
    showToast("Ошибка сети", `Не удалось обработать IFC файлы: ${err.message || String(err)}`, false);
  } finally {
     setTimeout(() => {
        progressContainer.style.display = "none";
        setProgress(0);
     }, 500);
     // Очищаем список выбранных файлов после попытки конвертации? (опционально)
     // selectedIFCs = [];
     // clearIFCListUI();
     // selectedAttrib = "";
     // attribPath.textContent = "";
     // attribPath.style.display = "none";
  }
});


// --- Глобальные функции API и Drag & Drop ---

// Вызывается из Python при перетаскивании IFC файла
window.addIFCFile = (path) => {
  if (path && !selectedIFCs.includes(path)) {
    selectedIFCs.push(path);
    addIFCItemToUI(path);
  }
};

// Вызывается из Python при перетаскивании PSIM или Attrib файла
window.selectFile = (type, path) => {
  if (!path) return;
  if (type === "psim1") {
    selectedFile1 = path;
    filePath1.textContent = path;
    filePath1.style.display = "block";
  } else if (type === "psim2") {
    selectedFile2 = path;
    filePath2.textContent = path;
    filePath2.style.display = "block";
  } else if (type === "attrib") {
    selectedAttrib = path;
    attribPath.textContent = path;
    attribPath.style.display = "block";
  }
};

// --- Горячие клавиши и инициализация ---

document.addEventListener("keydown", (e) => {
  // Ctrl+H для истории
  if (e.ctrlKey && e.key.toLowerCase() === "h") {
    e.preventDefault();
    btnHistory.click(); // Открываем модальное окно
  }
  // Escape для закрытия модального окна истории
  if (e.key === "Escape" && historyModalEl.classList.contains('show')) {
    historyModal.hide();
  }
});

// Ожидание инициализации pywebview API
async function waitForPywebview() {
  while (typeof pywebview === "undefined" || !pywebview.api) {
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}

// Инициализация приложения
async function initApp() {
  await waitForPywebview(); // Ждем, пока API Python будет доступно

  // Загружаем тему
  try {
    const theme = await pywebview.api.get_theme();
    if (theme === "dark") {
      document.getElementById("appRoot").classList.add("dark-mode");
    }
  } catch(e) {
      console.warn("Could not get theme from pywebview", e);
  }

  // *** Удалена начальная загрузка истории из localStorage ***
  // Начальное отображение истории при загрузке не требуется,
  // она загрузится при первом открытии модального окна.
  // Если нужно показывать сразу, раскомментировать:
  // renderHistory();

  showScreenPSIM(); // Показываем первый экран по умолчанию
}

// Запускаем инициализацию после загрузки DOM
document.addEventListener("DOMContentLoaded", initApp);