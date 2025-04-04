"use strict";

const screenPSIM = document.getElementById("screenPSIM")
const screenIFC = document.getElementById("screenIFC")
const titleText = document.getElementById("titleText")
const btnToggleIFC = document.getElementById("btnToggleIFC")
const btnDarkMode = document.getElementById("btnDarkMode")

const btnSelectFile1 = document.getElementById("btnSelectFile1")
const btnSelectFile2 = document.getElementById("btnSelectFile2")
const filePath1 = document.getElementById("filePath1")
const filePath2 = document.getElementById("filePath2")

const btnConvert = document.getElementById("btnConvert")
const progressContainer = document.getElementById("progressContainer")
const progressBar = document.getElementById("progressBar")

const btnSelectIFC = document.getElementById("btnSelectIFC")
const ifcPath = document.getElementById("ifcPath")
const btnSelectAttrib = document.getElementById("btnSelectAttrib")
const attribPath = document.getElementById("attribPath")
const btnConvertIFC = document.getElementById("btnConvertIFC")

const btnHistory = document.getElementById("btnHistory")
const historyModal = new bootstrap.Modal(document.getElementById("historyModal"))
const historyList = document.getElementById("historyList")
const historySearch = document.getElementById("historySearch")
const btnClearAll = document.getElementById("btnClearAll")

const btnHelp = document.getElementById('btnHelp')

let selectedFile1 = ""
let selectedFile2 = ""
let selectedIFC = ""
let selectedAttrib = ""

function setProgress(p) {
  progressBar.style.width = p + "%"
  progressBar.setAttribute("aria-valuenow", p)
}

function formatDateTime(dateObj) {
  const pad = n => String(n).padStart(2, "0")
  const d = pad(dateObj.getDate())
  const m = pad(dateObj.getMonth() + 1)
  const y = dateObj.getFullYear()
  const hh = pad(dateObj.getHours())
  const mm = pad(dateObj.getMinutes())
  const ss = pad(dateObj.getSeconds())
  return `${d}.${m}.${y} ${hh}:${mm}:${ss}`
}

function highlightText(original, search) {
  if (!search) return original
  const re = new RegExp(search, "gi")
  return original.replace(re, match => `<span class="highlight">${match}</span>`)
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options)
  if (!response.ok) {
    throw new Error(`Fetch error: ${response.statusText}`)
  }
  return response.json()
}

function loadHistory() {
  if (!localStorage.getItem("conversionHistory")) {
    localStorage.setItem("conversionHistory", JSON.stringify([]))
  }
}

function addToHistory(file1, file2) {
  const history = JSON.parse(localStorage.getItem("conversionHistory")) || []
  history.unshift({
    time: new Date().toISOString(), file1, file2
  })
  localStorage.setItem("conversionHistory", JSON.stringify(history))
}

function removeFromHistory(f1, f2) {
  let history = JSON.parse(localStorage.getItem("conversionHistory")) || []
  history = history.filter(item => item.file1 !== f1 || item.file2 !== f2)
  localStorage.setItem("conversionHistory", JSON.stringify(history))
}

function renderHistory(filterText = "") {
  historyList.innerHTML = ""
  const history = JSON.parse(localStorage.getItem("conversionHistory")) || []
  if (!history.length) {
    historyList.innerHTML = '<li class="list-group-item text-muted">История пуста</li>'
    return
  }
  const filtered = history.filter(entry => {
    const dateString = formatDateTime(new Date(entry.time))
    return (dateString.includes(filterText) || entry.file1.includes(filterText) || entry.file2.includes(filterText))
  })
  if (!filtered.length) {
    historyList.innerHTML = '<li class="list-group-item text-muted">Нет совпадений</li>'
    return
  }
  filtered.forEach(entry => {
    const li = document.createElement("li")
    li.className = "list-group-item history-item"
    const dateObj = new Date(entry.time)
    const dateString = formatDateTime(dateObj)
    const dateHtml = highlightText(dateString, filterText)
    const file1Html = highlightText(entry.file1, filterText)
    const file2Html = highlightText(entry.file2, filterText)
    li.innerHTML = `
      <div class="d-flex justify-content-between align-items-center">
        <small class="text-muted">${dateHtml}</small>
        <button class="btn btn-danger btn-sm">Удалить</button>
      </div>
      <div>
        <strong>File1:</strong> <pre class="text-break">${file1Html}</pre>
        <strong>File2:</strong> <pre class="text-break">${file2Html}</pre>
        <span class="text-secondary" style="font-size: 0.8rem;">(Нажмите, чтобы восстановить)</span>
      </div>`
    li.addEventListener("click", evt => {
      if (evt.target.tagName.toLowerCase() === "button") return
      selectedFile1 = entry.file1
      selectedFile2 = entry.file2
      filePath1.textContent = entry.file1
      filePath2.textContent = entry.file2
      filePath1.style.display = "block"
      filePath2.style.display = "block"
      historyModal.hide()
    })
    li.querySelector("button").addEventListener("click", async () => {
      const confirmRes = await Swal.fire({
        title: "Удалить запись?",
        text: "Это действие необратимо",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Да",
        cancelButtonText: "Отмена"
      })
      if (!confirmRes.isConfirmed) return
      try {
        const data = await fetchJson("/delete_history_item", {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({file1: entry.file1, file2: entry.file2})
        })
        if (data.status === "ok") {
          removeFromHistory(entry.file1, entry.file2)
          renderHistory(filterText)
        } else {
          Swal.fire("Ошибка", data.message, "error")
        }
      } catch (err) {
        Swal.fire("Ошибка сети", String(err), "error")
      }
    })
    historyList.appendChild(li)
  })
}

function showScreenPSIM() {
  screenPSIM.classList.add("active")
  screenIFC.classList.remove("active")
  titleText.textContent = "Конвертер PSIM (Excel) в ACCE"
  btnToggleIFC.textContent = "Перейти к IFC"
  btnToggleIFC.classList.remove("btn-danger")
  btnToggleIFC.classList.add("btn-warning")
}

function showScreenIFC() {
  screenPSIM.classList.remove("active")
  screenIFC.classList.add("active")
  titleText.textContent = "Работа с 3D-моделями (IFC)"
  btnToggleIFC.textContent = "Вернуться к PSIM"
  btnToggleIFC.classList.remove("btn-warning")
  btnToggleIFC.classList.add("btn-danger")
}

function showToastPSIM(title, body, success = true) {
  const toastEl = document.getElementById("toastPSIM")
  const toastTitle = document.getElementById("toastPSIMTitle")
  const toastBody = document.getElementById("toastPSIMBody")
  const toastTime = document.getElementById("toastPSIMTime")
  toastTitle.textContent = title
  toastBody.textContent = body
  toastTime.textContent = new Date().toLocaleTimeString()
  toastEl.classList.remove("text-bg-danger", "text-bg-success")
  toastEl.classList.add(success ? "text-bg-success" : "text-bg-danger")
  const bsToast = bootstrap.Toast.getOrCreateInstance(toastEl)
  bsToast.show()
}

function showToastIFC(title, body, success = true) {
  const toastEl = document.getElementById("toastIFC")
  const toastTitle = document.getElementById("toastIFCTitle")
  const toastBody = document.getElementById("toastIFCBody")
  const toastTime = document.getElementById("toastIFCTime")
  toastTitle.textContent = title
  toastBody.textContent = body
  toastTime.textContent = new Date().toLocaleTimeString()
  toastEl.classList.remove("text-bg-danger", "text-bg-success")
  toastEl.classList.add(success ? "text-bg-success" : "text-bg-danger")
  const bsToast = bootstrap.Toast.getOrCreateInstance(toastEl)
  bsToast.show()
}

function shakeIfEmpty(file, cardId) {
  if (!file) {
    const el = document.getElementById(cardId)
    el.classList.add("shake")
    setTimeout(() => el.classList.remove("shake"), 400)
  }
}

async function storeFiles(file1, file2) {
  try {
    const data = await fetchJson("/store_history", {
      method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({file1, file2})
    })
    if (data.status === "ok") {
      addToHistory(data.file1, data.file2)
    } else {
      showToastPSIM("Ошибка", "Не удалось сохранить файлы: " + data.message, false)
    }
  } catch (e) {
    showToastPSIM("Ошибка", "Ошибка при сохранении в историю: " + e, false)
  }
}

btnToggleIFC.addEventListener("click", () => {
  if (screenPSIM.classList.contains("active")) {
    showScreenIFC()
  } else {
    showScreenPSIM()
  }
})

btnDarkMode.addEventListener("click", async () => {
  const root = document.getElementById("appRoot")
  const isDarkNow = root.classList.toggle("dark-mode")
  const newTheme = isDarkNow ? "dark" : "light"
  try {
    await pywebview.api.set_theme(newTheme)
  } catch {
  }
})

btnHistory.addEventListener("click", () => {
  historySearch.value = ""
  renderHistory()
  historyModal.show()
})

btnClearAll.addEventListener("click", async () => {
  const confirmRes = await Swal.fire({
    title: "Очистить всю историю?",
    text: "Это действие необратимо",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Да",
    cancelButtonText: "Отмена"
  })
  if (!confirmRes.isConfirmed) return
  try {
    const data = await fetchJson("/clear_all_history", {method: "POST"})
    if (data.status === "ok") {
      localStorage.setItem("conversionHistory", JSON.stringify([]))
      renderHistory()
    } else {
      Swal.fire("Ошибка очистки", data.message, "error")
    }
  } catch (err) {
    Swal.fire("Ошибка сети", String(err), "error")
  }
})

historySearch.addEventListener("input", () => {
  renderHistory(historySearch.value)
})

btnSelectFile1.addEventListener("click", async () => {
  filePath1.textContent = ""
  filePath1.style.display = "none"
  try {
    const path = await pywebview.api.select_source_file()
    if (path) {
      selectedFile1 = path
      filePath1.textContent = path
      filePath1.style.display = "block"
    } else {
      selectedFile1 = ""
    }
  } catch {
    showToastPSIM("Ошибка", "Ошибка при выборе файла #1", false)
  }
})

btnSelectFile2.addEventListener("click", async () => {
  filePath2.textContent = ""
  filePath2.style.display = "none"
  try {
    const path = await pywebview.api.select_source_file()
    if (path) {
      selectedFile2 = path
      filePath2.textContent = path
      filePath2.style.display = "block"
    } else {
      selectedFile2 = ""
    }
  } catch {
    showToastPSIM("Ошибка", "Ошибка при выборе файла #2", false)
  }
})

btnConvert.addEventListener("click", async () => {
  if (!selectedFile1 || !selectedFile2) {
    shakeIfEmpty(selectedFile1, "psimCard1")
    shakeIfEmpty(selectedFile2, "psimCard2")
    showToastPSIM("Ошибка", "Необходимо выбрать оба файла", false)
    return
  }
  let outputPath = ""
  try {
    outputPath = await pywebview.api.select_save_file_psim()
  } catch {
    showToastPSIM("Ошибка", "Ошибка при выборе пути сохранения", false)
    return
  }
  if (!outputPath) {
    showToastPSIM("Ошибка", "Путь для сохранения не выбран", false)
    return
  }
  progressContainer.style.display = "block"
  setProgress(10)
  const payload = {inputFile: selectedFile1, secondFile: selectedFile2, outputFile: outputPath}
  setProgress(50)
  try {
    const result = await fetchJson("/convert", {
      method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(payload)
    })
    setProgress(100)
    progressContainer.style.display = "none"
    if (result.status === "success") {
      showToastPSIM("Успех", result.message || "Успешно завершено!", true)
      storeFiles(selectedFile1, selectedFile2)
    } else {
      showToastPSIM("Ошибка", result.message || "Произошла ошибка при конвертации", false)
    }
  } catch {
    progressContainer.style.display = "none"
    showToastPSIM("Ошибка", "Произошла ошибка. Обратитесь к разработчику.", false)
  }
})

btnSelectIFC.addEventListener("click", async () => {
  ifcPath.textContent = ""
  ifcPath.style.display = "none"
  try {
    const path = await pywebview.api.select_source_file()
    if (path) {
      selectedIFC = path
      ifcPath.textContent = path
      ifcPath.style.display = "block"
    } else {
      selectedIFC = ""
    }
  } catch {
    showToastIFC("Ошибка", "Ошибка при выборе IFC", false)
  }
})

btnSelectAttrib.addEventListener("click", async () => {
  attribPath.textContent = ""
  attribPath.style.display = "none"
  try {
    const path = await pywebview.api.select_source_file()
    if (path) {
      selectedAttrib = path
      attribPath.textContent = path
      attribPath.style.display = "block"
    } else {
      selectedAttrib = ""
    }
  } catch {
    showToastIFC("Ошибка", "Ошибка при выборе файла атрибутов", false)
  }
})

btnConvertIFC.addEventListener("click", async () => {
  if (!selectedIFC || !selectedAttrib) {
    shakeIfEmpty(selectedIFC, "ifcCard1")
    shakeIfEmpty(selectedAttrib, "ifcCard2")
    showToastIFC("Ошибка", "Нужно выбрать IFC и атрибуты", false)
    return
  }
  let outputPath = ""
  try {
    outputPath = await pywebview.api.select_save_file_ifc()
  } catch {
    showToastIFC("Ошибка", "Ошибка при выборе пути сохранения", false)
    return
  }
  if (!outputPath) {
    showToastIFC("Ошибка", "Путь для сохранения не выбран", false)
    return
  }
  progressContainer.style.display = "block"
  setProgress(10)
  const payload = {ifcFile: selectedIFC, attribFile: selectedAttrib, outputFile: outputPath}
  setProgress(50)
  try {
    const result = await fetchJson("/convert_ifc", {
      method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(payload)
    })
    setProgress(100)
    progressContainer.style.display = "none"
    if (result.status === "success") {
      showToastIFC("Успех", result.message || "Успешно завершено!", true)
    } else {
      showToastIFC("Ошибка", result.message || "Произошла ошибка при конвертации", false)
    }
  } catch {
    progressContainer.style.display = "none"
    showToastIFC("Ошибка", "Произошла ошибка. Обратитесь к разработчику.", false)
  }
})

window.selectFile = (type, path) => {
  if (type === "psim1") {
    selectedFile1 = path
  } else if (type === "psim2") {
    selectedFile2 = path
  } else if (type === "ifc") {
    selectedIFC = path
  } else if (type === "attrib") {
    selectedAttrib = path
  }
}

document.addEventListener("keydown", e => {
  if (e.ctrlKey && e.key.toLowerCase() === "h") {
    e.preventDefault()
    btnHistory.click()
  }
  if (e.key === "Escape") {
    historyModal.hide()
  }
})

document.addEventListener("DOMContentLoaded", async () => {
  loadHistory()
  const theme = await pywebview.api.get_theme()
  if (theme === "dark") {
    document.getElementById("appRoot").classList.add("dark-mode")
  }
  showScreenPSIM()
})


btnHelp.addEventListener("click", async () => {
  try {
    const result = await pywebview.api.open_pdf_manual()
    if (result === "not_found") {
      Swal.fire("Ошибка", "PDF не найден. Проверьте сборку приложения.", "error")
    }
  } catch (err) {
    Swal.fire("Ошибка", String(err), "error")
  }
})