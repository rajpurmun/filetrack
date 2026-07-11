/* mobile-scan.js — मोबाइल QR स्क्यान पृष्ठको Logic */

let msSettings = null;
let msScanner = null;
let msMode = "taken";
let msTorchOn = false;
let msRecent = [];
let msBusy = false; // डबल-स्क्यान रोक्न

document.addEventListener("DOMContentLoaded", async () => {
  msSettings = await DB.getSettings();
  if (msSettings) {
    document.getElementById("msOffice").textContent = msSettings.officeName;
    if (msSettings.officeLogo) document.getElementById("msLogo").src = msSettings.officeLogo;
  }
  document.getElementById("msBackendBadge").textContent =
    (typeof USE_FIREBASE !== "undefined" && USE_FIREBASE) ? "Firebase संग जडित" : "स्थानीय भण्डारण (Demo)";

  tickMsClock();
  setInterval(tickMsClock, 30000);

  document.querySelectorAll(".ms-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".ms-chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      msMode = chip.dataset.mode;
      applyModeUi();
    });
  });

  document.getElementById("btnRestart").addEventListener("click", restartScanner);
  document.getElementById("btnTorch").addEventListener("click", toggleTorch);
  document.getElementById("msManualBtn").addEventListener("click", () => {
    const id = document.getElementById("msManualId").value.trim();
    if (id) handleScanResult(id);
  });
  document.getElementById("msManualId").addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("msManualBtn").click();
  });

  document.getElementById("msReturnPhotoInput").addEventListener("change", handlePhotoMatch);

  startScanner();
});

function applyModeUi(){
  const qrWrap = document.getElementById("msQrWrap");
  const qrControls = document.getElementById("msQrControls");
  const photoBox = document.getElementById("msPhotoMatchBox");

  if (msMode === "photo-return") {
    qrWrap.classList.add("hidden");
    qrControls.classList.add("hidden");
    photoBox.classList.remove("hidden");
    if (msScanner) { msScanner.stop().then(() => msScanner.clear()).catch(() => {}); msScanner = null; }
    setFeedback("फ्रन्ट पेज फोटो खिच्नुहोस् — मिल्दो फाइल देखाइनेछ", "");
  } else {
    qrWrap.classList.remove("hidden");
    qrControls.classList.remove("hidden");
    photoBox.classList.add("hidden");
    document.getElementById("msCandidates").innerHTML = "";
    if (!msScanner) startScanner();
  }
}

async function handlePhotoMatch(e){
  const file = e.target.files[0];
  if (!file) return;
  setFeedback("फोटो जाँच गर्दै...", "");
  const candidatesBox = document.getElementById("msCandidates");
  candidatesBox.innerHTML = "";

  let processed;
  try {
    processed = await processFrontPagePhoto(file);
  } catch {
    setFeedback("फोटो प्रोसेस गर्न सकिएन, फेरि प्रयास गर्नुहोस्।", "err");
    return;
  }

  const takenFiles = (await DB.getFilesByStatus("taken")).filter(f => f.frontPhotoHash);
  if (takenFiles.length === 0) {
    setFeedback("तुलना गर्न मिल्ने फ्रन्ट पेज फोटो भएको कुनै 'लगेको' फाइल फेला परेन।", "err");
    return;
  }

  const ranked = takenFiles
    .map(f => ({ file: f, distance: hammingDistance(processed.hash, f.frontPhotoHash) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 3);

  setFeedback(`${ranked.length} वटा सम्भावित मिलान फेला पर्‍यो — सही फाइल छान्नुहोस्`, "");

  ranked.forEach((r, i) => {
    const pct = similarityPercent(r.distance);
    const card = document.createElement("div");
    card.className = "ms-candidate" + (i === 0 ? " best" : "");
    card.innerHTML = `
      <img src="${r.file.frontPhotoThumb}" alt="">
      <div class="ms-candidate-info">
        <div class="ct">${escapeMs(r.file.title)}</div>
        <div class="cs">${escapeMs(r.file.fileId)} · ${escapeMs(r.file.carrierName)}</div>
        <div class="cm">मिलान: ${pct}%</div>
      </div>
      <button data-id="${r.file.fileId}">फिर्ता गर्ने</button>
    `;
    card.querySelector("button").addEventListener("click", () => confirmPhotoReturn(r.file.fileId, processed.thumb));
    candidatesBox.appendChild(card);
  });
}

async function confirmPhotoReturn(fileId, returnPhotoThumb){
  const file = await DB.getFileById(fileId);
  if (!file || file.status !== "taken") {
    setFeedback("यो फाइल हाल 'लगेको' स्थितिमा छैन।", "err");
    return;
  }
  const { bs, ad } = nowStamp();
  await DB.updateFile(fileId, { status: "returned", returnedAt: `${bs} | ${ad}`, returnPhotoThumb });
  if (navigator.vibrate) navigator.vibrate([40, 60, 40]);
  setFeedback(`✅ "${file.title}" फोटो-मिलानबाट फिर्ता भयो। (${bs})`, "ok");
  pushRecent(file, "फिर्ता (फोटो)");
  document.getElementById("msCandidates").innerHTML = "";
  document.getElementById("msReturnPhotoInput").value = "";
}

function tickMsClock(){
  const { bs } = nowStamp();
  document.getElementById("msDate").textContent = bs;
}

function startScanner(){
  if (!window.Html5Qrcode) {
    setFeedback("क्यामेरा लाइब्रेरी लोड हुन सकेन — इन्टरनेट जडान जाँच्नुहोस्।", "err");
    return;
  }
  msScanner = new Html5Qrcode("qr-reader");
  msScanner.start(
    { facingMode: "environment" },
    { fps: 10, qrbox: { width: 230, height: 230 } },
    (decodedText) => {
      try {
        const data = JSON.parse(decodedText);
        handleScanResult(data.fileId);
      } catch {
        handleScanResult(decodedText);
      }
    },
    () => {}
  ).then(() => {
    setFeedback("QR कोडलाई फ्रेम भित्र राख्नुहोस्", "");
  }).catch(() => {
    setFeedback("क्यामेरा खोल्न सकिएन — अनुमति दिनुहोस् वा तल फाइल ID म्यानुअल हाल्नुहोस्।", "err");
  });
}

function restartScanner(){
  if (!msScanner) return startScanner();
  msScanner.stop().then(() => msScanner.clear()).finally(() => {
    startScanner();
  });
}

async function toggleTorch(){
  if (!msScanner) return;
  try {
    msTorchOn = !msTorchOn;
    await msScanner.applyVideoConstraints({ advanced: [{ torch: msTorchOn }] });
    document.getElementById("btnTorch").textContent = msTorchOn ? "🔦 टर्च (ON)" : "🔦 टर्च";
  } catch {
    setFeedback("यो यन्त्र/ब्राउजरमा टर्च उपलब्ध छैन।", "err");
    msTorchOn = false;
  }
}

async function handleScanResult(fileId){
  if (msBusy) return;
  msBusy = true;
  setTimeout(() => (msBusy = false), 1200); // पुनरावृत्ति स्क्यान रोक्ने छोटो cooldown

  if (navigator.vibrate) navigator.vibrate(60);

  const file = await DB.getFileById(fileId);
  if (!file) {
    setFeedback(`❌ फाइल ID "${fileId}" फेला परेन।`, "err");
    return;
  }

  const { bs, ad } = nowStamp();

  if (msMode === "taken") {
    if (file.status !== "issued") {
      setFeedback(`⚠️ यो फाइल पहिले नै "${statusLabel(file.status)}" स्थितिमा छ।`, "err");
      return;
    }
    await DB.updateFile(fileId, { status: "taken", takenAt: `${bs} | ${ad}` });
    setFeedback(`✅ "${file.title}" — ${file.carrierName} ले लग्नुभयो। (${bs})`, "ok");
    pushRecent(file, "लगेको");
  } else {
    if (file.status !== "taken") {
      setFeedback(`⚠️ यो फाइल "लगेको" स्थितिमा छैन, फिर्ता गर्न मिल्दैन।`, "err");
      return;
    }
    await DB.updateFile(fileId, { status: "returned", returnedAt: `${bs} | ${ad}` });
    setFeedback(`✅ "${file.title}" फिर्ता भयो। (${bs})`, "ok");
    pushRecent(file, "फिर्ता");
  }

  document.getElementById("msManualId").value = "";
}

function statusLabel(status){
  return { issued: "बुझाइएको", taken: "लगेको", returned: "फिर्ता भएको" }[status] || status;
}

function setFeedback(msg, cls){
  const el = document.getElementById("msFeedback");
  el.textContent = msg;
  el.className = "ms-feedback" + (cls ? " " + cls : "");
}

function pushRecent(file, action){
  msRecent.unshift({ id: file.fileId, title: file.title, action, time: nowStamp().bs });
  msRecent = msRecent.slice(0, 6);
  const ul = document.getElementById("msRecentList");
  ul.innerHTML = "";
  msRecent.forEach(r => {
    const li = document.createElement("li");
    li.innerHTML = `<span class="rid">${r.id}</span><span>${escapeMs(r.title)} — ${r.action}</span>`;
    ul.appendChild(li);
  });
}

function escapeMs(s){
  return String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
