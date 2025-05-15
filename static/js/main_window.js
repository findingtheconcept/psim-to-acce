"use strict";

/********************************************************************
 * Переменные DOM
 *******************************************************************/
const screenPSIM = document.getElementById("screenPSIM");
const screenIFC = document.getElementById("screenIFC");
const screenTransfer = document.getElementById("screenIFCTransfer");

// Элементы управления темой
const darkModeSwitch = document.getElementById('darkModeSwitch');
const darkModeIcon = document.getElementById('darkModeIcon');

// Глобальные кнопки (верхняя панель)
const btnHelp = document.getElementById("btnHelp");
const btnHistory = document.getElementById("btnHistory");

const btnNavPSIM = document.getElementById("btnNavPSIM");
const btnNavIFCUpd = document.getElementById("btnNavIFCUpd");
const btnNavIFCTrn = document.getElementById("btnNavIFCTrn");

// PSIM → ACCE
const btnSelectFile1 = document.getElementById("btnSelectFile1");
const btnSelectFile2 = document.getElementById("btnSelectFile2");
const btnConvert = document.getElementById("btnConvert");
const filePath1 = document.getElementById("filePath1");
const filePath2 = document.getElementById("filePath2");

// IFC ⇄ Excel
const btnSelectIFC = document.getElementById("btnSelectIFC");
const btnSelectAttrib = document.getElementById("btnSelectAttrib");
const btnConvertIFC = document.getElementById("btnConvertIFC");
const ifcList = document.getElementById("ifcList");
const attribPath = document.getElementById("attribPath");

// IFC ⇄ IFC (transfer)
const btnSelectOldIFC = document.getElementById("btnSelectOldIFC");
const btnSelectNewIFC = document.getElementById("btnSelectNewIFC");
const btnConvertIFCTrans = document.getElementById("btnConvertIFCTransfer");
const transferOldPath = document.getElementById("transferOldPath");
const transferNewPath = document.getElementById("transferNewPath");

// История и прогресс
const historyModalEl = document.getElementById("historyModal");
const historyModal = new bootstrap.Modal(historyModalEl);
const historyList = document.getElementById("historyList");
const historySearch = document.getElementById("historySearch");
const btnClearAll = document.getElementById("btnClearAll");

const progressContainer = document.getElementById("progressContainer");
const progressBar = document.getElementById("progressBar");

/********************************************************************
 * Состояние приложения
 *******************************************************************/
let selectedFile1 = "";
let selectedFile2 = "";
let selectedIFCs = [];
let selectedAttrib = "";
let selectedOldIFC = "";
let selectedNewIFC = "";

async function fetchJson(url, options = {}) {
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      let errorData;
      try { errorData = await response.json(); } catch { errorData = { message: response.statusText }; }
      console.error("Fetch error:", response.status, errorData);
      throw new Error(errorData.message || `HTTP error ${response.status}`);
    }
    if (response.status === 204) return null;
    try { return await response.json(); } catch (e) { console.warn("Empty/invalid JSON from", url); return null; }
  } catch (error) { console.error("Network or fetch error:", error); throw error; }
}

/********************************************************************
 * Навигация и тема
 *******************************************************************/
function updateDarkModeIcon(isDark) {
    if (darkModeIcon) {
        if (isDark) {
            darkModeIcon.classList.remove('bi-sun-fill');
            darkModeIcon.classList.add('bi-moon-stars-fill');
        } else {
            darkModeIcon.classList.remove('bi-moon-stars-fill');
            darkModeIcon.classList.add('bi-sun-fill');
        }
    }
}

const navButtonStyles = {
    [btnNavPSIM.id]: { active: 'btn-light', inactive: 'btn-outline-secondary' },
    [btnNavIFCUpd.id]: { active: 'btn-warning', inactive: 'btn-outline-secondary' },
    [btnNavIFCTrn.id]: { active: 'btn-info', inactive: 'btn-outline-secondary' }
};

function activateNavButton(activeBtn) {
  [btnNavPSIM, btnNavIFCUpd, btnNavIFCTrn].forEach(b => {
    const styles = navButtonStyles[b.id];
    b.classList.remove(
        'btn-light', 'btn-warning', 'btn-info',
        'btn-outline-secondary', 'btn-outline-light', 'btn-outline-warning', 'btn-outline-info',
        'active'
    );

    if (b === activeBtn) {
      b.classList.add(styles.active, 'active');
    } else {
      b.classList.add(styles.active);
    }
  });
}

function showScreen(node) {
  [screenPSIM, screenIFC, screenTransfer].forEach(s => s.classList.remove("active"));
  node.classList.add("active");
}

darkModeSwitch.addEventListener('change', async () => {
    const isDark = darkModeSwitch.checked;
    document.body.classList.toggle("dark-mode", isDark);
    updateDarkModeIcon(isDark);
    try {
        await pywebview.api.set_theme(isDark ? "dark" : "light");
    } catch (e) {
        console.error("Error setting theme via pywebview:", e);
    }
});

btnNavPSIM.addEventListener("click", () => {
  showScreen(screenPSIM);
  activateNavButton(btnNavPSIM);
});

btnNavIFCUpd.addEventListener("click", () => {
  showScreen(screenIFC);
  activateNavButton(btnNavIFCUpd);
});

btnNavIFCTrn.addEventListener("click", () => {
  showScreen(screenTransfer);
  activateNavButton(btnNavIFCTrn);
});


/********************************************************************
 * Утилиты (без изменений с предыдущего шага)
 *******************************************************************/
function setProgress(p) {
  progressBar.style.width = p + "%";
  progressBar.setAttribute("aria-valuenow", p);
  progressBar.textContent = p > 5 ? `${p}%` : "";
}

function shakeIfEmpty(value, cardId) {
  const empty = Array.isArray(value) ? !value.length : !value;
  if (empty) {
    const el = document.getElementById(cardId);
    if (el) {
      el.classList.add("shake");
      setTimeout(() => el.classList.remove("shake"), 400);
    }
  }
  return empty;
}

function showToast(title, body, success = true, duration = 5000) {
  const screen = screenPSIM.classList.contains("active") ? "PSIM" : (screenIFC.classList.contains("active") ? "IFC" : "IFCTransfer");
  const toastEl = document.getElementById(`toast${screen}`);
  const toastTitle = document.getElementById(`toast${screen}Title`);
  const toastBody = document.getElementById(`toast${screen}Body`);
  const toastTime = document.getElementById(`toast${screen}Time`);

  if (!toastEl || !toastTitle || !toastBody || !toastTime) {
    Swal.fire({
      toast: true,
      position: "bottom-end",
      icon: success ? "success" : "error",
      title: body,
      timer: duration,
      showConfirmButton: false
    });
    return;
  }

  toastTitle.textContent = title;
  toastBody.textContent = body;
  toastTime.textContent = new Date().toLocaleTimeString();

  toastEl.classList.remove("text-bg-danger", "text-bg-success");
  toastEl.classList.add(success ? "text-bg-success" : "text-bg-danger");

  bootstrap.Toast.getOrCreateInstance(toastEl, {delay: duration}).show();
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
  } catch (e) { console.error("Error formatting date:", isoString, e); return "Invalid Date"; }
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
    return escapeHTML(original).replace(re, (match) => `<span class="highlight">${match}</span>`);
}

/********************************************************************
 * Обработчики верхних кнопок (Справка, История)
 *******************************************************************/
btnHelp.addEventListener("click", async () => {
  try {
    const res = await pywebview.api.open_pdf_manual();
    if (res === "not_found") Swal.fire("Ошибка", "Файл руководства не найден.", "error");
  } catch (e) { console.error(e); Swal.fire("Ошибка", String(e), "error"); }
});

btnHistory.addEventListener("click", () => {
  historySearch.value = "";
  renderHistory();
  historyModal.show();
});

/********************************************************************
 * Обработчики экранов (PSIM, IFC-update, IFC-transfer) - без изменений
 *******************************************************************/
// --- 1. PSIM → ACCE ------------------------------------------------
btnSelectFile1.addEventListener("click", selectFile1);
btnSelectFile2.addEventListener("click", selectFile2);
btnConvert.addEventListener("click", convertPSIM);

async function selectFile1() {
  const p = await pywebview.api.select_source_file();
  if (p) { selectedFile1 = p; filePath1.textContent = p; filePath1.style.display = "block"; }
}
async function selectFile2() {
  const p = await pywebview.api.select_source_file();
  if (p) { selectedFile2 = p; filePath2.textContent = p; filePath2.style.display = "block"; }
}
async function convertPSIM() {
  if (shakeIfEmpty(selectedFile1, "psimCard1") | shakeIfEmpty(selectedFile2, "psimCard2")) {
    showToast("Ошибка", "Выберите оба входных файла", false); return;
  }
  const out = await pywebview.api.select_save_file_psim();
  if (!out) { showToast("Отмена", "Путь для сохранения не выбран.", false); return; }
  progressContainer.style.display = "block"; setProgress(20);
  try {
    const res = await fetchJson("/convert", {
      method: "POST", headers: {"Content-Type": "application/json"},
      body: JSON.stringify({inputFile: selectedFile1, secondFile: selectedFile2, outputFile: out})
    });
    setProgress(100); showToast(res.status === "success" ? "Успех" : "Ошибка", res.message, res.status === "success");
  } catch (e) { console.error(e); showToast("Ошибка", String(e), false);
  } finally { setTimeout(() => { progressContainer.style.display = "none"; setProgress(0); }, 600); }
}

// --- 2. IFC ⇄ Excel ---------------------------------------------
btnSelectIFC.addEventListener("click", selectIFCs);
btnSelectAttrib.addEventListener("click", selectAttribFile); // Renamed to avoid conflict
btnConvertIFC.addEventListener("click", convertIFC);

async function selectIFCs() {
  try {
      const paths = await pywebview.api.select_source_files_ifc();
      if (paths && paths.length) {
          paths.forEach(p => { if (p && !selectedIFCs.includes(p)) { selectedIFCs.push(p); addIFCItemToUI(p); } });
      }
  } catch (err) { console.error("Error selecting IFC files:", err); showToast("Ошибка", "Не удалось выбрать IFC файлы.", false); }
}
function addIFCItemToUI(p) {
  const li = document.createElement("li"); li.className = "list-group-item text-break p-1"; li.textContent = p; ifcList.appendChild(li);
}
function clearIFCListUI() { ifcList.innerHTML = ''; }
async function selectAttribFile() { // Renamed
  try {
      const p = await pywebview.api.select_source_file();
      if (p) { selectedAttrib = p; attribPath.textContent = p; attribPath.style.display = "block"; }
      else { selectedAttrib = ""; attribPath.textContent = ""; attribPath.style.display = "none"; }
  } catch (err) { console.error("Error selecting attribute file:", err); showToast("Ошибка", "Не удалось выбрать файл атрибутов.", false); }
}
async function convertIFC() {
  if (shakeIfEmpty(selectedIFCs, "ifcCard1") | shakeIfEmpty(selectedAttrib, "ifcCard2")) {
    showToast("Ошибка", "Выберите IFC и XLSX", false); return;
  }
  const outDir = await pywebview.api.select_folder_ifc();
  if (!outDir) { showToast("Отмена", "Папка для сохранения не выбрана.", false); return; }
  progressContainer.style.display = "block"; setProgress(20);
  try {
    const res = await fetchJson("/convert_ifc", {
      method: "POST", headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ifcFiles: selectedIFCs, attribFile: selectedAttrib, outputFile: outDir})
    });
    setProgress(100); showToast(res.status === "success" ? "Успех" : "Ошибка", res.message, res.status === "success");
  } catch (e) { console.error(e); showToast("Ошибка", String(e), false);
  } finally { setTimeout(() => { progressContainer.style.display = "none"; setProgress(0); }, 600); }
}

// --- 3. IFC ⇄ IFC -------------------------------------------------
btnSelectOldIFC.addEventListener("click", async () => selectSingleIFC("old"));
btnSelectNewIFC.addEventListener("click", async () => selectSingleIFC("new"));
btnConvertIFCTrans.addEventListener("click", transferIFC);

async function selectSingleIFC(which) {
  const p = await pywebview.api.select_source_file();
  if (!p) return;
  if (which === "old") { selectedOldIFC = p; transferOldPath.textContent = p; transferOldPath.style.display = "block"; }
  else { selectedNewIFC = p; transferNewPath.textContent = p; transferNewPath.style.display = "block"; }
}
async function transferIFC() {
  if (shakeIfEmpty(selectedOldIFC, "ifcOldCard") | shakeIfEmpty(selectedNewIFC, "ifcNewCard")) {
    showToast("Ошибка", "Выберите обе модели", false); return;
  }
  const out = await pywebview.api.select_save_file_ifc();
  if (!out) { showToast("Отмена", "Путь для сохранения не выбран.", false); return; }
  progressContainer.style.display = "block"; setProgress(15);
  try {
    const res = await fetchJson("/transfer_ifc", {
      method: "POST", headers: {"Content-Type": "application/json"},
      body: JSON.stringify({oldIfcFile: selectedOldIFC, newIfcFile: selectedNewIFC, outputFile: out})
    });
    setProgress(100); showToast(res.status === "success" ? "Успех" : "Ошибка", res.message, res.status === "success");
  } catch (e) { console.error(e); showToast("Ошибка", String(e), false);
  } finally { setTimeout(() => { progressContainer.style.display = "none"; setProgress(0); }, 600); }
}

/********************************************************************
 * История (без изменений с предыдущего шага)
 *******************************************************************/
historySearch.addEventListener("input", () => renderHistory(historySearch.value));
btnClearAll.addEventListener("click", async () => {
  const confirmRes = await Swal.fire({
    title: "Очистить всю историю?", text: "Это действие необратимо, все записи и файлы будут удалены!",
    icon: "warning", showCancelButton: true, confirmButtonText: "Да, очистить всё",
    cancelButtonText: "Отмена", confirmButtonColor: "#d33",
  });
  if (!confirmRes.isConfirmed) return;
  try {
    await fetchJson("/clear_all_history", { method: "DELETE" });
    renderHistory(historySearch.value); showToast("Успех", "История успешно очищена", true);
  } catch (err) { console.error("Ошибка очистки истории:", err); Swal.fire("Ошибка", `Не удалось очистить историю: ${err.message || String(err)}`, "error"); }
});

function getHistoryEntryTypeDetails(entryType) {
    switch (entryType) {
        case "PSIM_TO_ACCE": return { icon: "bi-file-earmark-spreadsheet", label: "PSIM → ACCE" };
        case "IFC_UPDATE": return { icon: "bi-file-earmark-plus", label: "Excel → IFC" };
        case "IFC_TRANSFER": return { icon: "bi-file-earmark-arrow-up", label: "IFC → IFC" };
        default: return { icon: "bi-question-circle", label: entryType || "Неизвестно" };
    }
}

function renderFileList(files, listTitle, filterText) {
    if (!files || !files.length) return `<small class="text-muted">${escapeHTML(listTitle)}: нет</small>`;
    const maxVisible = 3;
    let fileHtml = files.slice(0, maxVisible).map(file => {
        const name = file.original_name || 'N/A';
        const errorMark = file.error ? ' <i class="bi bi-exclamation-triangle-fill text-danger" title="Ошибка копирования/отсутствует"></i>' : '';
        return `<pre class="text-break d-block mb-0">${highlightText(name, filterText)}${errorMark}</pre>`;
    }).join('');
    if (files.length > maxVisible) fileHtml += `<small class="d-block text-muted">(+${files.length - maxVisible} еще)</small>`;
    return `<strong>${escapeHTML(listTitle)}:</strong>${fileHtml}`;
}

async function renderHistory(filterText = "") {
  historyList.innerHTML = '<li class="list-group-item text-muted">Загрузка...</li>';
  try {
    const history = await fetchJson('/get_history');
    historyList.innerHTML = '';
    if (!Array.isArray(history)) throw new Error("Получен неверный формат истории");
    if (!history.length) { historyList.innerHTML = '<li class="list-group-item text-muted">История пуста</li>'; return; }

    const filteredHistory = history.filter(entry => {
      const searchTerm = filterText.toLowerCase();
      if (!searchTerm) return true;
      if (formatDateTime(entry.timestamp).toLowerCase().includes(searchTerm)) return true;
      const { label: typeLabel } = getHistoryEntryTypeDetails(entry.entry_type);
      if (typeLabel.toLowerCase().includes(searchTerm)) return true;
      if (entry.input_files && entry.input_files.some(f => (f.original_name || '').toLowerCase().includes(searchTerm))) return true;
      if (entry.output_files && entry.output_files.some(f => (f.original_name || '').toLowerCase().includes(searchTerm))) return true;
      if (entry.status === 'error' && (entry.error_message || '').toLowerCase().includes(searchTerm)) return true;
      return false;
    });

    if (!filteredHistory.length) { historyList.innerHTML = '<li class="list-group-item text-muted">Нет записей, соответствующих фильтру</li>'; return; }
    filteredHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    filteredHistory.forEach(entry => {
      const li = document.createElement("li");
      li.className = `list-group-item history-item ${entry.status === 'error' ? 'list-group-item-danger' : ''}`;
      li.setAttribute('data-entry-id', entry.id);
      const { icon: typeIcon, label: typeLabel } = getHistoryEntryTypeDetails(entry.entry_type);
      const dateHtml = highlightText(formatDateTime(entry.timestamp), filterText);
      const statusIcon = entry.status === 'success' ? '<i class="bi bi-check-circle-fill text-success ms-2" title="Успешно"></i>' : '<i class="bi bi-x-octagon-fill text-danger ms-2" title="Ошибка"></i>';
      const inputFilesHtml = renderFileList(entry.input_files, 'Входные файлы', filterText);
      const outputFilesHtml = renderFileList(entry.output_files, 'Выходные файлы', filterText);
      const errorHtml = entry.status === 'error' && entry.error_message ? `<div class="mt-1"><small class="text-danger"><strong>Ошибка:</strong> ${highlightText(entry.error_message, filterText)}</small></div>` : '';
      li.innerHTML = `
        <div class="d-flex justify-content-between align-items-start mb-1">
          <div><i class="bi ${typeIcon} me-2"></i><strong class="me-2">${escapeHTML(typeLabel)}</strong>${statusIcon}</div>
          <button class="btn btn-danger btn-sm history-delete-btn" data-entry-id="${entry.id}" title="Удалить запись"><i class="bi bi-trash"></i></button>
        </div>
        <small class="text-muted d-block mb-2">${dateHtml}</small>
        <div class="mb-1">${inputFilesHtml}</div><div class="mb-1">${outputFilesHtml}</div>${errorHtml}
        ${entry.input_files && entry.input_files.some(f => f.saved_path && !f.error) ? '<span class="text-secondary" style="font-size: 0.8rem;">(Нажмите, чтобы восстановить)</span>' : '<span class="text-warning" style="font-size: 0.8rem;">(Нет файлов для восстановления)</span>'}`;
      historyList.appendChild(li);
    });
    historyList.removeEventListener('click', handleDeleteClick); historyList.removeEventListener('click', handleRestoreClick);
    historyList.addEventListener('click', handleDeleteClick); historyList.addEventListener('click', handleRestoreClick);
  } catch (err) { console.error("Ошибка при загрузке или рендеринге истории:", err); historyList.innerHTML = `<li class="list-group-item list-group-item-warning">Не удалось загрузить историю: ${escapeHTML(err.message || String(err))}</li>`; }
}

async function handleDeleteClick(event) {
    const deleteButton = event.target.closest('.history-delete-btn');
    if (!deleteButton) return;
    const entryId = deleteButton.dataset.entryId; if (!entryId) return;
    const confirmRes = await Swal.fire({
        title: "Удалить запись?", text: "Связанные файлы также будут удалены из архива.", icon: "warning",
        showCancelButton: true, confirmButtonText: "Да, удалить", cancelButtonText: "Отмена", confirmButtonColor: "#d33",
    });
    if (!confirmRes.isConfirmed) return;
    try {
        await fetchJson(`/delete_history_item/${entryId}`, { method: "DELETE" });
        renderHistory(historySearch.value); showToast("Успех", "Запись истории удалена", true);
    } catch (err) { console.error(`Ошибка удаления записи ${entryId}:`, err); Swal.fire("Ошибка", `Не удалось удалить запись: ${err.message || String(err)}`, "error"); }
}

async function handleRestoreClick(event) {
  const historyItem = event.target.closest('.history-item');
  if (!historyItem || event.target.closest('.history-delete-btn')) return;
  const entryId = historyItem.dataset.entryId; if (!entryId) return;
  try {
      const entryDetails = await fetchJson(`/get_history_entry/${entryId}`);
      if (!entryDetails || !entryDetails.entry_type || !entryDetails.input_files) throw new Error("Неполные данные записи из истории.");
      const hasRestorableFiles = entryDetails.input_files.some(file => file.saved_path && !file.error);
      if (!hasRestorableFiles) { showToast("Информация", "Для этой записи нет файлов, доступных для восстановления.", false); return; }

      if (entryDetails.entry_type === "PSIM_TO_ACCE") {
          const psimFiles = entryDetails.input_files.filter(file => file.saved_path && !file.error);
          if (psimFiles.length >= 2) {
              selectedFile1 = psimFiles[0].saved_path; selectedFile2 = psimFiles[1].saved_path;
              filePath1.textContent = psimFiles[0].original_name; filePath2.textContent = psimFiles[1].original_name;
              filePath1.style.display = "block"; filePath2.style.display = "block";
              showScreen(screenPSIM); activateNavButton(btnNavPSIM); historyModal.hide();
              showToast("Успех", "Файлы из истории загружены в PSIM конвертер.", true);
          } else { showToast("Информация", "Недостаточно входных файлов для PSIM → ACCE.", false); }
      } else if (entryDetails.entry_type === "IFC_UPDATE") {
          const restoredIFCs = entryDetails.input_files.filter(f => f.saved_path && !f.error && f.original_name.toLowerCase().endsWith('.ifc'));
          const restoredAttrib = entryDetails.input_files.find(f => f.saved_path && !f.error && f.original_name.toLowerCase().endsWith('.xlsx'));
          if (restoredIFCs.length > 0 && restoredAttrib) {
              selectedIFCs = restoredIFCs.map(f => f.saved_path); selectedAttrib = restoredAttrib.saved_path;
              clearIFCListUI(); restoredIFCs.forEach(ifc => addIFCItemToUI(ifc.original_name));
              attribPath.textContent = restoredAttrib.original_name; attribPath.style.display = "block";
              showScreen(screenIFC); activateNavButton(btnNavIFCUpd); historyModal.hide();
              showToast("Успех", "Файлы из истории загружены в Excel → IFC.", true);
          } else { showToast("Информация", "Не найдены IFC или XLSX для Excel → IFC.", false); }
      } else if (entryDetails.entry_type === "IFC_TRANSFER") {
           const oldIFC = entryDetails.input_files.find(f => f.saved_path && !f.error && f.original_name.includes("старая") && f.original_name.toLowerCase().endsWith('.ifc'));
           const newIFC = entryDetails.input_files.find(f => f.saved_path && !f.error && f.original_name.includes("новая") && f.original_name.toLowerCase().endsWith('.ifc'));
           if (oldIFC && newIFC) {
               selectedOldIFC = oldIFC.saved_path; selectedNewIFC = newIFC.saved_path;
               transferOldPath.textContent = oldIFC.original_name; transferNewPath.textContent = newIFC.original_name;
               transferOldPath.style.display = "block"; transferNewPath.style.display = "block";
               showScreen(screenTransfer); activateNavButton(btnNavIFCTrn); historyModal.hide();
               showToast("Успех", "Файлы из истории загружены в IFC → IFC.", true);
           } else { showToast("Информация", "Не найдены обе IFC модели для IFC → IFC.", false); }
      } else { showToast("Информация", `Тип '${getHistoryEntryTypeDetails(entryDetails.entry_type).label}' не поддерживает восстановление.`, false); }
  } catch (err) { console.error(`Ошибка восстановления ${entryId}:`, err); Swal.fire("Ошибка", `Не удалось восстановить: ${err.message || String(err)}`, "error"); }
}

/********************************************************************
 * Инициализация
 *******************************************************************/
async function waitForPywebview() {
  while (typeof pywebview === "undefined" || !pywebview.api) await new Promise(r => setTimeout(r, 50));
}

(async function init() {
  await waitForPywebview();
  try {
    const initialTheme = await pywebview.api.get_theme();
    const isInitialDark = initialTheme === "dark";
    
    document.body.classList.toggle("dark-mode", isInitialDark);
    if(darkModeSwitch) darkModeSwitch.checked = isInitialDark;
    updateDarkModeIcon(isInitialDark);
    
    renderHistory();
  } catch(e) {
      console.error("Error during initialization:", e);
      // Fallback for theme if pywebview fails
      document.body.classList.remove("dark-mode");
      if(darkModeSwitch) darkModeSwitch.checked = false;
      updateDarkModeIcon(false);
  }
  showScreen(screenPSIM);
  activateNavButton(btnNavPSIM);
})();