/* app.js — फाइल व्यवस्थापन प्रणाली को मुख्य Logic */

let STATE = {
  settings: null,
  files: []
};

const DEFAULT_SETTINGS = {
  officeName: "... गाउँपालिका गाउँ कार्यपालिकाको कार्यालय",
  officeAddress: "..., बागमती प्रदेश",
  officeLogo: "", // base64 भए override हुन्छ, नत्र नेपाल निशान देखिन्छ
  branches: ["प्रशासन शाखा","फाँट/लेखा शाखा","सामाजिक विकास शाखा","पूर्वाधार विकास शाखा","राजस्व शाखा","न्यायिक शाखा"],
  categories: ["सिफारिस","जन्म/मृत्यु दर्ता","बजेट तथा योजना","अदालत/मुद्दा सम्बन्धी","पत्राचार","निर्णय कार्यान्वयन","अन्य"]
};

/* ---------------- INIT ---------------- */
document.addEventListener("DOMContentLoaded", async () => {
  await loadState();
  bindNav();
  bindIssueForm();
  bindScan();
  bindRecords();
  bindSettings();
  renderAll();
  renderMobileLinkQr();
  tickClock();
  setInterval(tickClock, 30000);
});

async function loadState(){
  let settings = await DB.getSettings();
  if (!settings) {
    settings = DEFAULT_SETTINGS;
    await DB.saveSettings(settings);
  }
  STATE.settings = settings;
  STATE.files = await DB.getFiles();
}

function tickClock(){
  const { bs, ad } = nowStamp();
  document.getElementById("bsDateNow").textContent = bs;
  document.getElementById("adDateNow").textContent = ad;
}

/* ---------------- NAV ---------------- */
function bindNav(){
  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("view-" + btn.dataset.view).classList.add("active");
      if (btn.dataset.view === "records") renderRecordsTable();
      if (btn.dataset.view === "dashboard") renderDashboard();
      if (btn.dataset.view === "scan") renderMobileLinkQr();
    });
  });
}

/* ---------------- RENDER ALL ---------------- */
function renderAll(){
  renderBrandAndBadge();
  renderDashboard();
  populateBranchSelects();
  populateCategorySelects();
  renderSettingsLists();
  document.getElementById("f_office").value = STATE.settings.officeName;
}

function renderBrandAndBadge(){
  document.getElementById("officeNameLabel").textContent = STATE.settings.officeName;
  document.getElementById("qrOffice").textContent = STATE.settings.officeName;
  if (STATE.settings.officeLogo) {
    document.getElementById("officeLogoImg").src = STATE.settings.officeLogo;
  }
  document.getElementById("backendBadge").textContent =
    (typeof USE_FIREBASE !== "undefined" && USE_FIREBASE) ? "Firebase संग जडित" : "स्थानीय भण्डारण (Demo)";
}

/* ---------------- DASHBOARD ---------------- */
function renderDashboard(){
  const total = STATE.files.length;
  const taken = STATE.files.filter(f => f.status === "taken").length;
  const returned = STATE.files.filter(f => f.status === "returned").length;
  const overdue = STATE.files.filter(f => f.status === "taken" && f.dueDate && new Date(f.dueDate) < new Date()).length;

  const grid = document.getElementById("statGrid");
  grid.innerHTML = `
    <div class="stat-card"><div class="num">${toNepaliDigits(total)}</div><div class="lbl">कुल दर्ता फाइल</div></div>
    <div class="stat-card crimson"><div class="num">${toNepaliDigits(taken)}</div><div class="lbl">हाल बाहिर गएका (Taken)</div></div>
    <div class="stat-card ok"><div class="num">${toNepaliDigits(returned)}</div><div class="lbl">फिर्ता भएका</div></div>
    <div class="stat-card gold"><div class="num">${toNepaliDigits(overdue)}</div><div class="lbl">म्याद नाघेका</div></div>
  `;

  const tbody = document.querySelector("#recentTable tbody");
  tbody.innerHTML = "";
  STATE.files.slice(0, 8).forEach(f => {
    tbody.appendChild(rowEl(`
      <td class="mono">${f.fileId}</td>
      <td>${escapeHtml(f.title)}</td>
      <td>${escapeHtml(f.fromBranch)} → ${escapeHtml(f.toBranch)}</td>
      <td>${escapeHtml(f.carrierName)}</td>
      <td>${f.issuedBs}</td>
      <td>${statusPill(f.status)}</td>
    `));
  });
}

function statusPill(status){
  const map = { issued: ["status-issued","बुझाइएको"], taken: ["status-taken","लगेको"], returned: ["status-returned","फिर्ता"] };
  const [cls, label] = map[status] || ["status-issued", status];
  return `<span class="status-pill ${cls}">${label}</span>`;
}

function rowEl(html){
  const tr = document.createElement("tr");
  tr.innerHTML = html;
  return tr;
}

/* ---------------- SELECT POPULATORS ---------------- */
function populateBranchSelects(){
  const opts = STATE.settings.branches.map(b => `<option value="${escapeHtml(b)}">${escapeHtml(b)}</option>`).join("");
  ["f_fromBranch","f_toBranch","filterBranch"].forEach(id => {
    const el = document.getElementById(id);
    const keepFirst = id === "filterBranch" ? el.querySelector("option") : null;
    el.innerHTML = (keepFirst ? keepFirst.outerHTML : "") + opts;
  });
}
function populateCategorySelects(){
  const opts = STATE.settings.categories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
  ["f_category","filterCategory"].forEach(id => {
    const el = document.getElementById(id);
    const keepFirst = id === "filterCategory" ? el.querySelector("option") : null;
    el.innerHTML = (keepFirst ? keepFirst.outerHTML : "") + opts;
  });
}

/* ---------------- ISSUE FORM ---------------- */
let pendingPhoto = null; // { thumb, hash } फाइल दर्ता हुनु अघि खिचिएको फ्रन्ट पेज फोटो

function bindIssueForm(){
  document.getElementById("f_frontPhoto").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) { pendingPhoto = null; return; }
    try {
      pendingPhoto = await processFrontPagePhoto(file);
      document.getElementById("frontPhotoImg").src = pendingPhoto.thumb;
      document.getElementById("frontPhotoPreview").classList.remove("hidden");
      showToast("फ्रन्ट पेज फोटो लिइयो — फिर्ता गर्दा यसैबाट पहिचान हुनेछ");
    } catch {
      pendingPhoto = null;
      showToast("फोटो प्रोसेस गर्न सकिएन, कृपया फेरि प्रयास गर्नुहोस्");
    }
  });

  document.getElementById("issueForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const { bs, ad } = nowStamp();
    const seq = STATE.files.length + 1;
    const bsYear = adToBs(new Date()).year;
    const fileId = `FTS-${bsYear}-${String(seq).padStart(4,"0")}`;

    const record = {
      fileId,
      title: val("f_title"),
      regNo: val("f_regno"),
      category: val("f_category"),
      fromBranch: val("f_fromBranch"),
      toBranch: val("f_toBranch"),
      carrierName: val("f_carrierName"),
      carrierType: val("f_carrierType"),
      carrierContact: val("f_carrierContact"),
      handedBy: val("f_handedBy"),
      dueDate: val("f_dueDate"),
      remark: val("f_remark"),
      status: "issued",
      issuedBs: bs,
      issuedAd: ad,
      takenAt: null,
      returnedAt: null,
      frontPhotoThumb: pendingPhoto ? pendingPhoto.thumb : null,
      frontPhotoHash: pendingPhoto ? pendingPhoto.hash : null,
      returnPhotoThumb: null,
      createdAt: Date.now()
    };

    if (!record.title || !record.fromBranch || !record.toBranch || !record.category || !record.carrierName) {
      showToast("कृपया * चिह्न भएका फिल्ड भर्नुहोस्");
      return;
    }

    await DB.addFile(record);
    STATE.files.unshift(record);
    renderQr(record);
    renderDashboard();
    pendingPhoto = null;
    showToast(`फाइल ${fileId} सफलतापूर्वक दर्ता भयो`);
  });

  document.getElementById("btnNewIssue").addEventListener("click", () => {
    document.getElementById("qrResultPanel").classList.add("hidden");
    document.getElementById("issueForm").reset();
    document.getElementById("f_office").value = STATE.settings.officeName;
    document.getElementById("frontPhotoPreview").classList.add("hidden");
    pendingPhoto = null;
  });

  document.getElementById("btnPrintQr").addEventListener("click", () => window.print());
}

function renderQr(record){
  const panel = document.getElementById("qrResultPanel");
  panel.classList.remove("hidden");
  panel.scrollIntoView({ behavior: "smooth", block: "start" });

  const meta = document.getElementById("qrMeta");
  meta.textContent =
`फाइल ID   : ${record.fileId}
शीर्षक     : ${record.title}
वर्ग       : ${record.category}
बाट → लाई : ${record.fromBranch} → ${record.toBranch}
बुझ्ने      : ${record.carrierName} (${record.carrierType})
मिति       : ${record.issuedBs}`;

  const canvas = document.getElementById("qrCanvas");
  const payload = JSON.stringify({ fileId: record.fileId, office: STATE.settings.officeName });
  if (window.QRCode) {
    QRCode.toCanvas(canvas, payload, { width: 220, margin: 1, color: { dark: "#0b2f5c" } });
  }
}

/* ---------------- SCAN ---------------- */
function renderMobileLinkQr(){
  const canvas = document.getElementById("mobileLinkQr");
  if (!canvas || !window.QRCode) return;
  const url = new URL("scan.html", window.location.href).href;
  QRCode.toCanvas(canvas, url, { width: 120, margin: 1, color: { dark: "#0b2f5c" } });
}

let scanMode = "taken";
let scannerInstance = null;

function bindScan(){
  document.querySelectorAll(".scan-mode-toggle .chip").forEach(chip => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".scan-mode-toggle .chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      scanMode = chip.dataset.mode;
    });
  });

  document.getElementById("btnManualScan").addEventListener("click", async () => {
    const id = val("manualFileId").trim();
    if (!id) return;
    await processScan(id);
  });

  // Camera scan starts once the view is shown, to avoid asking for camera permission on load
  document.querySelector('[data-view="scan"]').addEventListener("click", startScannerOnce);
}

function startScannerOnce(){
  if (scannerInstance || !window.Html5Qrcode) return;
  try {
    scannerInstance = new Html5Qrcode("qr-reader");
    scannerInstance.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: 220 },
      (decodedText) => {
        try {
          const data = JSON.parse(decodedText);
          processScan(data.fileId);
        } catch {
          processScan(decodedText);
        }
      },
      () => {}
    ).catch(() => {
      // क्यामेरा उपलब्ध छैन वा अनुमति छैन — म्यानुअल इनपुट प्रयोग गर्न सकिन्छ
    });
  } catch (e) { /* no-op */ }
}

async function processScan(fileId){
  const file = STATE.files.find(f => f.fileId === fileId);
  const feedback = document.getElementById("scanFeedback");
  if (!file) {
    feedback.className = "scan-feedback err";
    feedback.textContent = `फाइल ID "${fileId}" फेला परेन।`;
    return;
  }
  const { bs, ad } = nowStamp();
  if (scanMode === "taken") {
    if (file.status !== "issued") {
      feedback.className = "scan-feedback err";
      feedback.textContent = `यो फाइल पहिले नै "${file.status}" स्थितिमा छ।`;
      return;
    }
    await DB.updateFile(fileId, { status: "taken", takenAt: `${bs} | ${ad}` });
    file.status = "taken"; file.takenAt = `${bs} | ${ad}`;
    feedback.className = "scan-feedback ok";
    feedback.textContent = `✔ फाइल "${file.title}" ${file.carrierName} ले लग्नुभयो। (${bs})`;
  } else {
    if (file.status !== "taken") {
      feedback.className = "scan-feedback err";
      feedback.textContent = `यो फाइल "लगेको" स्थितिमा छैन, फिर्ता गर्न मिल्दैन।`;
      return;
    }
    await DB.updateFile(fileId, { status: "returned", returnedAt: `${bs} | ${ad}` });
    file.status = "returned"; file.returnedAt = `${bs} | ${ad}`;
    feedback.className = "scan-feedback ok";
    feedback.textContent = `✔ फाइल "${file.title}" फिर्ता भयो। (${bs})`;
  }
  renderDashboard();
  renderRecordsTable();
}

/* ---------------- RECORDS ---------------- */
function bindRecords(){
  ["filterBranch","filterCategory","filterStatus","filterSearch"].forEach(id => {
    document.getElementById(id).addEventListener("input", renderRecordsTable);
  });
  document.getElementById("btnExportCsv").addEventListener("click", exportCsv);
}

function renderRecordsTable(){
  const branch = val("filterBranch");
  const category = val("filterCategory");
  const status = val("filterStatus");
  const search = val("filterSearch").toLowerCase();

  const rows = STATE.files.filter(f => {
    if (branch && f.fromBranch !== branch && f.toBranch !== branch) return false;
    if (category && f.category !== category) return false;
    if (status && f.status !== status) return false;
    if (search && !(`${f.title} ${f.carrierName} ${f.fileId}`.toLowerCase().includes(search))) return false;
    return true;
  });

  const tbody = document.querySelector("#recordsTable tbody");
  tbody.innerHTML = "";
  rows.forEach(f => {
    tbody.appendChild(rowEl(`
      <td class="mono">${f.fileId}</td>
      <td>${escapeHtml(f.title)}</td>
      <td>${escapeHtml(f.category)}</td>
      <td>${escapeHtml(f.fromBranch)} → ${escapeHtml(f.toBranch)}</td>
      <td>${escapeHtml(f.carrierName)}</td>
      <td>${escapeHtml(f.carrierType)}</td>
      <td>${escapeHtml(f.handedBy || "-")}</td>
      <td>${f.issuedBs}</td>
      <td>${f.takenAt || "-"}</td>
      <td>${f.returnedAt || "-"}</td>
      <td>${statusPill(f.status)}</td>
    `));
  });
}

function exportCsv(){
  const headers = ["FileID","Title","Category","FromBranch","ToBranch","CarrierName","CarrierType","HandedBy","IssuedBS","TakenAt","ReturnedAt","Status"];
  const lines = [headers.join(",")];
  STATE.files.forEach(f => {
    lines.push([f.fileId,f.title,f.category,f.fromBranch,f.toBranch,f.carrierName,f.carrierType,f.handedBy||"",f.issuedBs,f.takenAt||"",f.returnedAt||"",f.status]
      .map(v => `"${String(v).replace(/"/g,'""')}"`).join(","));
  });
  downloadBlob(lines.join("\n"), "file-records.csv", "text/csv");
}

/* ---------------- SETTINGS ---------------- */
function bindSettings(){
  document.getElementById("s_officeName").value = STATE.settings.officeName;
  document.getElementById("s_officeAddress").value = STATE.settings.officeAddress;

  document.getElementById("btnSaveOffice").addEventListener("click", async () => {
    STATE.settings.officeName = val("s_officeName") || STATE.settings.officeName;
    STATE.settings.officeAddress = val("s_officeAddress") || STATE.settings.officeAddress;
    const fileInput = document.getElementById("s_officeLogo");
    if (fileInput.files[0]) {
      STATE.settings.officeLogo = await fileToBase64(fileInput.files[0]);
    }
    await DB.saveSettings(STATE.settings);
    renderBrandAndBadge();
    document.getElementById("f_office").value = STATE.settings.officeName;
    showToast("कार्यालय विवरण सुरक्षित भयो");
  });

  document.getElementById("btnAddBranch").addEventListener("click", async () => {
    const v = val("newBranchInput").trim();
    if (!v) return;
    STATE.settings.branches.push(v);
    await DB.saveSettings(STATE.settings);
    document.getElementById("newBranchInput").value = "";
    renderSettingsLists(); populateBranchSelects();
  });

  document.getElementById("btnAddCategory").addEventListener("click", async () => {
    const v = val("newCategoryInput").trim();
    if (!v) return;
    STATE.settings.categories.push(v);
    await DB.saveSettings(STATE.settings);
    document.getElementById("newCategoryInput").value = "";
    renderSettingsLists(); populateCategorySelects();
  });

  document.getElementById("btnBackupJson").addEventListener("click", () => {
    downloadBlob(JSON.stringify({ settings: STATE.settings, files: STATE.files }, null, 2), "fts-backup.json", "application/json");
  });

  document.getElementById("s_restoreFile").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    try {
      const data = JSON.parse(text);
      await DB.replaceAll(data);
      STATE.settings = data.settings; STATE.files = data.files;
      renderAll(); renderRecordsTable();
      showToast("ब्याकअप सफलतापूर्वक फर्काइयो");
    } catch {
      showToast("फाइल पढ्न सकिएन — मान्य JSON होइन");
    }
  });
}

function renderSettingsLists(){
  const bList = document.getElementById("branchList");
  bList.innerHTML = "";
  STATE.settings.branches.forEach((b, i) => {
    const li = document.createElement("li");
    li.innerHTML = `<span>${escapeHtml(b)}</span><button data-i="${i}">✕</button>`;
    li.querySelector("button").addEventListener("click", async () => {
      STATE.settings.branches.splice(i,1);
      await DB.saveSettings(STATE.settings);
      renderSettingsLists(); populateBranchSelects();
    });
    bList.appendChild(li);
  });

  const cList = document.getElementById("categoryList");
  cList.innerHTML = "";
  STATE.settings.categories.forEach((c, i) => {
    const li = document.createElement("li");
    li.innerHTML = `<span>${escapeHtml(c)}</span><button data-i="${i}">✕</button>`;
    li.querySelector("button").addEventListener("click", async () => {
      STATE.settings.categories.splice(i,1);
      await DB.saveSettings(STATE.settings);
      renderSettingsLists(); populateCategorySelects();
    });
    cList.appendChild(li);
  });
}

/* ---------------- UTIL ---------------- */
function val(id){ return document.getElementById(id).value; }
function escapeHtml(s){ return String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function showToast(msg){
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2600);
}
function downloadBlob(content, filename, type){
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
function fileToBase64(file){
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
