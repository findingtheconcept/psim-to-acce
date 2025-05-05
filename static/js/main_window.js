"use strict";

/********************************************************************
 *  Переменные DOM
 *******************************************************************/
const screenPSIM = document.getElementById("screenPSIM");
const screenIFC = document.getElementById("screenIFC");
const screenTransfer = document.getElementById("screenIFCTransfer");

const titleText = document.getElementById("titleText");

// Глобальные кнопки (верхняя панель)
const btnDarkMode = document.getElementById("btnDarkMode");
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
 *  Состояние приложения
 *******************************************************************/
let selectedFile1 = "";
let selectedFile2 = "";

let selectedIFCs = [];   // для обновления атрибутами
let selectedAttrib = "";

let selectedOldIFC = "";   // для переноса атрибутов
let selectedNewIFC = "";

/********************************************************************
 *  Навигация между экранами
 *******************************************************************/
function activateNavButton(activeBtn) {
  [btnNavPSIM, btnNavIFCUpd, btnNavIFCTrn].forEach(b => {
    b.classList.toggle("active", b === activeBtn);
  });
}

function showScreen(node, title) {
  [screenPSIM, screenIFC, screenTransfer].forEach(s => s.classList.remove("active"));
  node.classList.add("active");
  titleText.textContent = title;
}

btnNavPSIM.addEventListener("click", () => {
  showScreen(screenPSIM, "Конвертер PSIM → ACCE");
  activateNavButton(btnNavPSIM);
});

btnNavIFCUpd.addEventListener("click", () => {
  showScreen(screenIFC, "Обновление IFC из Excel");
  activateNavButton(btnNavIFCUpd);
});

btnNavIFCTrn.addEventListener("click", () => {
  showScreen(screenTransfer, "Перенос данных между IFC");
  activateNavButton(btnNavIFCTrn);
});

/********************************************************************
 *  Утилиты
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
  // Определяем активный экран (PSIM, IFC или IFCTransfer)
  const screen = screenPSIM.classList.contains("active") ? "PSIM" : (screenIFC.classList.contains("active") ? "IFC" : "IFCTransfer");
  const toastEl = document.getElementById(`toast${screen}`);
  const toastTitle = document.getElementById(`toast${screen}Title`);
  const toastBody = document.getElementById(`toast${screen}Body`);
  const toastTime = document.getElementById(`toast${screen}Time`);

  if (!toastEl || !toastTitle || !toastBody || !toastTime) {
    // Фолбэк на SweetAlert2, если тостов нет
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

/********************************************************************
 *  Обработчики верхних кнопок
 *******************************************************************/
btnDarkMode.addEventListener("click", async () => {
  const root = document.getElementById("appRoot");
  const isDark = root.classList.toggle("dark-mode");
  try {
    await pywebview.api.set_theme(isDark ? "dark" : "light");
  } catch {
  }
});

btnHelp.addEventListener("click", async () => {
  try {
    const res = await pywebview.api.open_pdf_manual();
    if (res === "not_found") Swal.fire("Ошибка", "Файл руководства не найден.", "error");
  } catch (e) {
    console.error(e);
    Swal.fire("Ошибка", String(e), "error");
  }
});

/********************************************************************
 *  ---  ДАЛЬШЕ ИДУТ ОБРАБОТЧИКИ КОНКРЕТНЫХ ЭКРАНОВ
 *  (PSIM, IFC-update, IFC-transfer)
 *******************************************************************/
// --- 1. PSIM → ACCE ------------------------------------------------
btnSelectFile1.addEventListener("click", selectFile1);
btnSelectFile2.addEventListener("click", selectFile2);
btnConvert.addEventListener("click", convertPSIM);

async function selectFile1() {
  const p = await pywebview.api.select_source_file();
  if (p) {
    selectedFile1 = p;
    filePath1.textContent = p;
    filePath1.style.display = "block";
  }
}

async function selectFile2() {
  const p = await pywebview.api.select_source_file();
  if (p) {
    selectedFile2 = p;
    filePath2.textContent = p;
    filePath2.style.display = "block";
  }
}

async function convertPSIM() {
  if (shakeIfEmpty(selectedFile1, "psimCard1") | shakeIfEmpty(selectedFile2, "psimCard2")) {
    showToast("Ошибка", "Выберите оба входных файла", false);
    return;
  }
  const out = await pywebview.api.select_save_file_psim();
  if (!out) return;

  progressContainer.style.display = "block";
  setProgress(20);

  try {
    const res = await fetchJson("/convert", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({inputFile: selectedFile1, secondFile: selectedFile2, outputFile: out})
    });
    setProgress(100);
    showToast(res.status === "success" ? "Успех" : "Ошибка", res.message, res.status === "success");
  } catch (e) {
    console.error(e);
    showToast("Ошибка", String(e), false);
  } finally {
    setTimeout(() => {
      progressContainer.style.display = "none";
      setProgress(0);
    }, 600);
  }
}

// --- 2. IFC ⇄ Excel ---------------------------------------------
btnSelectIFC.addEventListener("click", selectIFCs);
btnSelectAttrib.addEventListener("click", selectAttrib);
btnConvertIFC.addEventListener("click", convertIFC);

async function selectIFCs() {
  const paths = await pywebview.api.select_source_files_ifc();
  paths?.forEach(p => {
    if (p && !selectedIFCs.includes(p)) {
      selectedIFCs.push(p);
      addIFCItemToUI(p);
    }
  });
}

function addIFCItemToUI(p) {
  const li = document.createElement("li");
  li.className = "list-group-item text-break p-1";
  li.textContent = p;
  ifcList.appendChild(li);
}

async function selectAttrib() {
  const p = await pywebview.api.select_source_file();
  if (p) {
    selectedAttrib = p;
    attribPath.textContent = p;
    attribPath.style.display = "block";
  }
}

async function convertIFC() {
  if (shakeIfEmpty(selectedIFCs, "ifcCard1") | shakeIfEmpty(selectedAttrib, "ifcCard2")) {
    showToast("Ошибка", "Выберите IFC и XLSX", false);
    return;
  }
  const outDir = await pywebview.api.select_folder_ifc();
  if (!outDir) return;
  progressContainer.style.display = "block";
  setProgress(20);
  try {
    const res = await fetchJson("/convert_ifc", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ifcFiles: selectedIFCs, attribFile: selectedAttrib, outputFile: outDir})
    });
    setProgress(100);
    showToast(res.status === "success" ? "Успех" : "Ошибка", res.message, res.status === "success");
  } catch (e) {
    console.error(e);
    showToast("Ошибка", String(e), false);
  } finally {
    setTimeout(() => {
      progressContainer.style.display = "none";
      setProgress(0);
    }, 600);
  }
}

// --- 3. IFC ⇄ IFC -------------------------------------------------
btnSelectOldIFC.addEventListener("click", async () => selectSingleIFC("old"));
btnSelectNewIFC.addEventListener("click", async () => selectSingleIFC("new"));
btnConvertIFCTrans.addEventListener("click", transferIFC);

async function selectSingleIFC(which) {
  const p = await pywebview.api.select_source_file();
  if (!p) return;
  if (which === "old") {
    selectedOldIFC = p;
    transferOldPath.textContent = p;
    transferOldPath.style.display = "block";
  } else {
    selectedNewIFC = p;
    transferNewPath.textContent = p;
    transferNewPath.style.display = "block";
  }
}

async function transferIFC() {
  if (shakeIfEmpty(selectedOldIFC, "ifcOldCard") | shakeIfEmpty(selectedNewIFC, "ifcNewCard")) {
    showToast("Ошибка", "Выберите обе модели", false);
    return;
  }
  const out = await pywebview.api.select_save_file_ifc();
  if (!out) return;
  progressContainer.style.display = "block";
  setProgress(15);
  try {
    const res = await fetchJson("/transfer_ifc", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({oldIfcFile: selectedOldIFC, newIfcFile: selectedNewIFC, outputFile: out})
    });
    setProgress(100);
    showToast(res.status === "success" ? "Успех" : "Ошибка", res.message, res.status === "success");
  } catch (e) {
    console.error(e);
    showToast("Ошибка", String(e), false);
  } finally {
    setTimeout(() => {
      progressContainer.style.display = "none";
      setProgress(0);
    }, 600);
  }
}

/********************************************************************
 *  История (минимально: только открытие/поиск/очистка)
 *******************************************************************/
btnHistory.addEventListener("click", () => {
  historySearch.value = "";
  renderHistory();
  historyModal.show();
});

historySearch.addEventListener("input", () => renderHistory(historySearch.value));

btnClearAll.addEventListener("click", async () => {
  const c = await Swal.fire({
    title: "Очистить всю историю?",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#d33",
    confirmButtonText: "Да"
  });
  if (!c.isConfirmed) return;
  await fetchJson("/clear_all_history", {method: "DELETE"});
  renderHistory();
  showToast("Успех", "История очищена", true);
});

async function renderHistory(filter = "") {
  historyList.innerHTML = "<li class='list-group-item text-muted'>Загрузка…</li>";
  try {
    const data = await fetchJson("/get_history");
    const list = Array.isArray(data) ? data : [];
    historyList.innerHTML = list.length ? "" : "<li class='list-group-item text-muted'>История пуста</li>";
    list.forEach(e => {
      const li = document.createElement("li");
      li.className = "list-group-item history-item";
      li.textContent = `${e.entry_type} — ${new Date(e.timestamp).toLocaleString()}`;
      historyList.appendChild(li);
    });
  } catch (e) {
    console.error(e);
    historyList.innerHTML = "<li class='list-group-item list-group-item-danger'>Ошибка загрузки истории</li>";
  }
}

/********************************************************************
 *  Инициализация
 *******************************************************************/
async function waitForPywebview() {
  while (typeof pywebview === "undefined" || !pywebview.api) await new Promise(r => setTimeout(r, 50));
}

(async function init() {
  await waitForPywebview();
  try {
    if (await pywebview.api.get_theme() === "dark") document.getElementById("appRoot").classList.add("dark-mode");
  } catch {
  }
  showScreen(screenPSIM, "Конвертер PSIM → ACCE");
})();