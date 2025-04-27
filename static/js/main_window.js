"use strict";

const screenPSIM = document.getElementById("screenPSIM");
const screenIFC = document.getElementById("screenIFC");
const titleText = document.getElementById("titleText");
const btnToggleIFC = document.getElementById("btnToggleIFC");
const btnDarkMode = document.getElementById("btnDarkMode");
const btnHelp = document.getElementById("btnHelp");

const btnSelectFile1 = document.getElementById("btnSelectFile1");
const btnSelectFile2 = document.getElementById("btnSelectFile2");
const filePath1 = document.getElementById("filePath1");
const filePath2 = document.getElementById("filePath2");
const btnConvert = document.getElementById("btnConvert");

const btnSelectIFC = document.getElementById("btnSelectIFC");
const btnSelectAttrib = document.getElementById("btnSelectAttrib");
const ifcList = document.getElementById("ifcList"); // Контейнер для списка IFC файлов
const attribPath = document.getElementById("attribPath");
const btnConvertIFC = document.getElementById("btnConvertIFC");

const progressContainer = document.getElementById("progressContainer");
const progressBar = document.getElementById("progressBar");

const btnHistory = document.getElementById("btnHistory");
const historyModalEl = document.getElementById("historyModal");
const historyModal = new bootstrap.Modal(historyModalEl);
const historyList = document.getElementById("historyList");
const historySearch = document.getElementById("historySearch");
const btnClearAll = document.getElementById("btnClearAll");

let selectedIFCs = []; // Массив путей к выбранным IFC файлам
let selectedAttrib = ""; // Путь к файлу атрибутов
let selectedFile1 = ""; // Путь к первому файлу PSIM
let selectedFile2 = ""; // Путь ко второму файлу PSIM


function setProgress(p) {
  progressBar.style.width = p + "%";
  progressBar.setAttribute("aria-valuenow", p);
  progressBar.textContent = p > 5 ? `${p}%` : ""; 
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

function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function highlightText(original, search) {
    if (!search || !original) return escapeHTML(original);
    const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(escapedSearch, "gi");
    const highlighted = escapeHTML(original).replace(re, (match) => `<span class="highlight">${match}</span>`);
    return highlighted; 
}


async function fetchJson(url, options = {}) {
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      let errorData;
      try {
          errorData = await response.json();
      } catch {
          errorData = { message: response.statusText };
      }
      console.error("Fetch error:", response.status, errorData);
      throw new Error(errorData.message || `HTTP error ${response.status}`);
    }
    if (response.status === 204) {
        return null;
    }
    return response.json();
  } catch (error) {
    console.error("Network or fetch error:", error);
    throw error;
  }
}


// --- Функции Истории ---

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

function renderFileList(files, listTitle, filterText) {
    if (!files || !files.length) {
        return `<small class="text-muted">${escapeHTML(listTitle)}: нет</small>`;
    }
    const maxVisible = 3;
    let fileHtml = files.slice(0, maxVisible).map(file => {
        const name = file.original_name || 'N/A';
        const errorMark = file.error ? ' <i class="bi bi-exclamation-triangle-fill text-danger" title="Ошибка копирования/отсутствует"></i>' : '';
        return `<pre class="text-break d-block mb-0">${highlightText(name, filterText)}${errorMark}</pre>`;
    }).join('');

    if (files.length > maxVisible) {
        fileHtml += `<small class="d-block text-muted">(+${files.length - maxVisible} еще)</small>`;
    }

    return `<strong>${escapeHTML(listTitle)}:</strong>${fileHtml}`;
}


async function renderHistory(filterText = "") {
  historyList.innerHTML = '<li class="list-group-item text-muted">Загрузка...</li>';

  try {
    const history = await fetchJson('/get_history');

    historyList.innerHTML = '';

    if (!Array.isArray(history)) {
         throw new Error("Получен неверный формат истории");
    }

    if (!history.length) {
      historyList.innerHTML = '<li class="list-group-item text-muted">История пуста</li>';
      return;
    }

    const filteredHistory = history.filter(entry => {
      const searchTerm = filterText.toLowerCase();
      if (!searchTerm) return true;

      if (formatDateTime(entry.timestamp).toLowerCase().includes(searchTerm)) return true;

      if ((entry.entry_type || '').toLowerCase().includes(searchTerm)) return true;
 
      if (entry.input_files && entry.input_files.some(f => (f.original_name || '').toLowerCase().includes(searchTerm))) return true;

      if (entry.output_files && entry.output_files.some(f => (f.original_name || '').toLowerCase().includes(searchTerm))) return true;

      if (entry.status === 'error' && (entry.error_message || '').toLowerCase().includes(searchTerm)) return true;

      return false;

    });

    if (!filteredHistory.length) {
      historyList.innerHTML = '<li class="list-group-item text-muted">Нет записей, соответствующих фильтру</li>';
      return;
    }


    filteredHistory.forEach(entry => {
      const li = document.createElement("li");
  
      li.className = `list-group-item history-item ${entry.status === 'error' ? 'list-group-item-danger' : ''}`;
      li.setAttribute('data-entry-id', entry.id);

      const { icon: typeIcon, label: typeLabel } = getHistoryEntryTypeDetails(entry.entry_type);
      const dateString = formatDateTime(entry.timestamp);
      const dateHtml = highlightText(dateString, filterText);

      const statusIcon = entry.status === 'success'
          ? '<i class="bi bi-check-circle-fill text-success ms-2" title="Успешно"></i>'
          : '<i class="bi bi-x-octagon-fill text-danger ms-2" title="Ошибка"></i>';

      const inputFilesHtml = renderFileList(entry.input_files, 'Входные файлы', filterText);
      const outputFilesHtml = renderFileList(entry.output_files, 'Выходные файлы', filterText);

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

      historyList.appendChild(li);
    });

    historyList.addEventListener('click', handleDeleteClick);
    historyList.addEventListener('click', handleRestoreClick);

  } catch (err) {
    console.error("Ошибка при загрузке или рендеринге истории:", err);
    historyList.innerHTML = `<li class="list-group-item list-group-item-warning">Не удалось загрузить историю: ${escapeHTML(err.message || String(err))}</li>`;
  }
}


async function handleDeleteClick(event) {
    const deleteButton = event.target.closest('.history-delete-btn');
    if (!deleteButton) return;

    const entryId = deleteButton.dataset.entryId;
    if (!entryId) return;

    const confirmRes = await Swal.fire({
        title: "Удалить запись?",
        text: "Связанные файлы также будут удалены.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Да, удалить",
        cancelButtonText: "Отмена",
        confirmButtonColor: "#d33", 
    });

    if (!confirmRes.isConfirmed) return;

    try {
        await fetchJson(`/delete_history_item/${entryId}`, { method: "DELETE" });
        renderHistory(historySearch.value);
        showToast("Успех", "Запись истории удалена", true);
    } catch (err) {
        console.error(`Ошибка удаления записи ${entryId}:`, err);
        Swal.fire("Ошибка", `Не удалось удалить запись: ${err.message || String(err)}`, "error");
    }
}

async function handleRestoreClick(event) {
  const historyItem = event.target.closest('.history-item');
  if (!historyItem || event.target.closest('.history-delete-btn')) {
      return;
  }

  const entryId = historyItem.dataset.entryId;
  if (!entryId) return;

  console.log("Restoring history entry:", entryId);

  try {
      const entryDetails = await fetchJson(`/get_history_entry/${entryId}`);

      if (!entryDetails || !entryDetails.entry_type || !entryDetails.input_files) {
          throw new Error("Неполные данные записи из истории.");
      }

      const hasValidPaths = entryDetails.input_files.every(file => file.saved_path && !file.error);
      if (!hasValidPaths) {
           Swal.fire("Ошибка восстановления", "Некоторые входные файлы для этой записи отсутствуют в архиве истории.", "warning");
           return;
      }

      if (entryDetails.entry_type === "PSIM_TO_ACCE") {
          if (entryDetails.input_files.length >= 2) {
              const file1 = entryDetails.input_files[0];
              const file2 = entryDetails.input_files[1];

              selectedFile1 = file1.saved_path; 
              selectedFile2 = file2.saved_path;

              filePath1.textContent = file1.original_name;
              filePath2.textContent = file2.original_name;
              filePath1.style.display = "block";
              filePath2.style.display = "block";

              showScreenPSIM(); 
              historyModal.hide(); 
              showToast("Успех", "Файлы из истории загружены в PSIM конвертер.", true);
          } else {
              throw new Error("Недостаточно входных файлов в записи PSIM_TO_ACCE.");
          }
      } else if (entryDetails.entry_type === "IFC_UPDATE") {
          const restoredIFCs = [];
          let restoredAttrib = null;

          entryDetails.input_files.forEach(file => {
              if (file.original_name.toLowerCase().endsWith('.ifc')) {
                  restoredIFCs.push({ path: file.saved_path, name: file.original_name });
              } else if (file.original_name.toLowerCase().endsWith('.xlsx')) {
                  restoredAttrib = { path: file.saved_path, name: file.original_name };
              }
          });

          if (restoredIFCs.length > 0 && restoredAttrib) {
              selectedIFCs = restoredIFCs.map(f => f.path); 
              selectedAttrib = restoredAttrib.path;       

              clearIFCListUI();
              restoredIFCs.forEach(ifc => addIFCItemToUI(ifc.name)); 

              attribPath.textContent = restoredAttrib.name; 
              attribPath.style.display = "block";

              showScreenIFC();
              historyModal.hide();
              showToast("Успех", "Файлы из истории загружены в IFC конвертер.", true);
          } else {
               throw new Error("Не найдены IFC файлы или файл атрибутов в записи IFC_UPDATE.");
          }
      } else {
          showToast("Информация", `Тип записи '${entryDetails.entry_type}' пока не поддерживает восстановление.`, false);
      }

  } catch (err) {
      console.error(`Ошибка восстановления записи ${entryId}:`, err);
      Swal.fire("Ошибка", `Не удалось восстановить файлы из истории: ${err.message || String(err)}`, "error");
  }
}

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
    await fetchJson("/clear_all_history", { method: "DELETE" });
    renderHistory();
    showToast("Успех", "История успешно очищена", true);
  } catch (err) {
    console.error("Ошибка очистки истории:", err);
    Swal.fire("Ошибка", `Не удалось очистить историю: ${err.message || String(err)}`, "error");
  }
});


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

function showToast(title, body, success = true, duration = 5000) {
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
        Swal.fire({
            toast: true,
            position: 'bottom-end',
            icon: success ? 'success' : 'error',
            title: body,
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

    const bsToast = bootstrap.Toast.getOrCreateInstance(toastEl, { delay: duration });
    bsToast.show();
}


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
      setTimeout(() => el.classList.remove("shake"), 400);
    }
    return true; 
  }
  return false;
}


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
  historySearch.value = '';
  renderHistory();
  historyModal.show();
});

historySearch.addEventListener("input", () => {
  renderHistory(historySearch.value);
});


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
      selectedFile1 = ""; 
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
  const file1Empty = shakeIfEmpty(selectedFile1, "psimCard1");
  const file2Empty = shakeIfEmpty(selectedFile2, "psimCard2");
  if (file1Empty || file2Empty) {
    showToast("Ошибка", "Необходимо выбрать оба входных файла.", false);
    return;
  }

  let outputPath = "";
  try {
    outputPath = await pywebview.api.select_save_file_psim(); 
     if (!outputPath) {
        showToast("Отмена", "Путь для сохранения не выбран.", false);
        return;
     }
  } catch (e) {
    console.error("Error selecting save path:", e);
    showToast("Ошибка", "Не удалось выбрать путь сохранения.", false);
    return;
  }


  progressContainer.style.display = "block";
  setProgress(10);

  const payload = {
    inputFile: selectedFile1,
    secondFile: selectedFile2,
    outputFile: outputPath,
  };

  setProgress(30);

  try {
    const result = await fetchJson("/convert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setProgress(100);

    if (result.status === "success") {
      showToast("Успех", result.message || "Конвертация PSIM -> ACCE завершена!", true);
    } else {
      showToast("Ошибка конвертации", result.message || "Произошла ошибка на сервере.", false);
    }
  } catch (err) {
    console.error("Conversion request failed:", err);
    showToast("Ошибка сети", `Не удалось выполнить конвертацию: ${err.message || String(err)}`, false);
  } finally {
     setTimeout(() => {
        progressContainer.style.display = "none";
        setProgress(0);
     }, 500);
  }
});




function addIFCItemToUI(path) {
  if (!path) return;
  const li = document.createElement("li");
  li.className = "list-group-item text-break p-1";
  li.textContent = path;
  ifcList.appendChild(li);
}


function clearIFCListUI() {
    ifcList.innerHTML = '';
}

btnSelectIFC.addEventListener("click", async () => {
  try {
    const paths = await pywebview.api.select_source_files_ifc();
    if (paths && paths.length) {

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

  const ifcEmpty = shakeIfEmpty(selectedIFCs, "ifcCard1");
  const attribEmpty = shakeIfEmpty(selectedAttrib, "ifcCard2");
  if (ifcEmpty || attribEmpty) {
    showToast("Ошибка", "Нужно выбрать хотя бы один IFC файл и файл атрибутов.", false);
    return;
  }


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
    ifcFiles: selectedIFCs,       
    attribFile: selectedAttrib,
    outputFile: outputFolder,     
  };

  setProgress(30);

  try {
    const result = await fetchJson("/convert_ifc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setProgress(100);

    if (result.status === "success") {
      showToast("Успех", result.message || "Обработка IFC завершена!", true);
    } else {

      showToast("Ошибка обработки IFC", result.message || "Произошла ошибка на сервере.", false);

      
    }
  } catch (err) {
    console.error("IFC Conversion request failed:", err);
    showToast("Ошибка сети", `Не удалось обработать IFC файлы: ${err.message || String(err)}`, false);
  } finally {
     setTimeout(() => {
        progressContainer.style.display = "none";
        setProgress(0);
     }, 500);
  }
});



window.addIFCFile = (path) => {
  if (path && !selectedIFCs.includes(path)) {
    selectedIFCs.push(path);
    addIFCItemToUI(path);
  }
};


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


document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.key.toLowerCase() === "h") {
    e.preventDefault();
    btnHistory.click();
  }
  if (e.key === "Escape" && historyModalEl.classList.contains('show')) {
    historyModal.hide();
  }
});


async function waitForPywebview() {
  while (typeof pywebview === "undefined" || !pywebview.api) {
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}


async function initApp() {
  await waitForPywebview();

  try {
    const theme = await pywebview.api.get_theme();
    if (theme === "dark") {
      document.getElementById("appRoot").classList.add("dark-mode");
    }
  } catch(e) {
      console.warn("Could not get theme from pywebview", e);
  }

  showScreenPSIM();
}

document.addEventListener("DOMContentLoaded", initApp);