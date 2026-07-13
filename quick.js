/* quick.js — फास्ट-ट्र्याक (नपढेकाले पनि प्रयोग गर्न मिल्ने, १ मिनेटमा हुने) Logic */

const BRANCH_ICONS = ["🏢","💰","🤝","🏗️","💵","⚖️","📚","🌾","💧","🚧","🏥","🏫"];
const CATEGORY_ICONS = ["📄","👶","💰","⚖️","✉️","✅","📁","🏗️","🌾"];
const CARRIER_TYPES = [
  { key: "कर्मचारी", icon: "👔" },
  { key: "जनप्रतिनिधि", icon: "🎖️" },
  { key: "संघसंस्था", icon: "🏛️" },
  { key: "सेवाग्राही", icon: "🙋" }
];
const AVATAR_COLORS = ["#0b2f5c","#c8102e","#1e7a4c","#b8791a","#6a3fa0","#0d7a86"];

let Q = {
  settings: null,
  files: [],
  session: null,
  step: "login-pick",
  pinBuffer: "",
  pendingEmployee: null,
  draft: {},
  candidates: []
};

document.addEventListener("DOMContentLoaded", async () => {
  Q.settings = await DB.getSettings();
  if (!Q.settings.employees) Q.settings.employees = [];
  if (!Q.settings.carriers) Q.settings.carriers = [];
  Q.files = await DB.getFiles();

  document.getElementById("qOffice").textContent = Q.settings.officeName || "फाइल व्यवस्थापन प्रणाली";

  const raw = localStorage.getItem("fts_session");
  Q.session = raw ? JSON.parse(raw) : null;

  document.getElementById("qBack").addEventListener("click", goBack);
  document.getElementById("qLogoutBtn").addEventListener("click", doLogout);

  Q.step = Q.session ? "action" : "login-pick";
  render();
});

/* ---------------- HELPERS ---------------- */
function el(html){ const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }
function escapeQ(s){ return String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function colorFor(name){
  let h = 0; for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[h];
}
function avatarHtml(name, photo, size = 56){
  if (photo) return `<div class="q-avatar" style="width:${size}px;height:${size}px;"><img src="${photo}"></div>`;
  const initial = (name || "?").trim().charAt(0);
  return `<div class="q-avatar" style="width:${size}px;height:${size}px;background:${colorFor(name)};">${escapeQ(initial)}</div>`;
}
function vib(pattern){ if (navigator.vibrate) navigator.vibrate(pattern); }
function screen(){ return document.getElementById("qScreen"); }
function setTopbar({ back = false, logout = false } = {}){
  document.getElementById("qBack").classList.toggle("hidden", !back);
  document.getElementById("qLogoutBtn").classList.toggle("hidden", !logout);
}

/* ---------------- NAV STACK (simple back) ---------------- */
const STEP_BACK = {
  "issue-branch": "action", "issue-category": "issue-branch", "issue-photo": "issue-category",
  "issue-carrier": "issue-photo", "issue-carrier-type": "issue-carrier", "issue-confirm": "issue-carrier",
  "return-photo": "action", "return-candidates": "return-photo"
};
function goBack(){
  const prev = STEP_BACK[Q.step];
  if (prev) { Q.step = prev; render(); }
}
function doLogout(){
  Q.session = null;
  localStorage.removeItem("fts_session");
  Q.step = "login-pick";
  render();
}

/* ---------------- RENDER DISPATCH ---------------- */
function render(){
  const s = screen();
  s.innerHTML = "";
  const withBack = !!STEP_BACK[Q.step];
  setTopbar({ back: withBack, logout: !!Q.session && Q.step !== "login-pick" && Q.step !== "login-pin" });

  const map = {
    "login-pick": renderLoginPick,
    "login-pin": renderLoginPin,
    "action": renderAction,
    "issue-branch": renderIssueBranch,
    "issue-category": renderIssueCategory,
    "issue-photo": renderIssuePhoto,
    "issue-carrier": renderIssueCarrier,
    "issue-carrier-type": renderIssueCarrierType,
    "issue-confirm": renderIssueConfirm,
    "issue-success": renderIssueSuccess,
    "return-photo": renderReturnPhoto,
    "return-candidates": renderReturnCandidates,
    "return-success": renderReturnSuccess
  };
  (map[Q.step] || renderAction)();
}

/* ---------------- LOGIN ---------------- */
function renderLoginPick(){
  const s = screen();
  s.appendChild(el(`<div class="q-title">👋 तपाईं को हुनुहुन्छ?</div>`));
  s.appendChild(el(`<div class="q-sub">आफ्नो फोटो/नाममा थिच्नुहोस्</div>`));

  if (Q.settings.employees.length === 0) {
    s.appendChild(el(`
      <div class="q-photo-box">
        <div class="ic">⚠️</div>
        <div>अझै कुनै कर्मचारी थपिएको छैन। पूर्ण प्रणाली (index.html) को Settings बाट कर्मचारी थप्नुहोस्, वा अतिथिको रूपमा अगाडि बढ्नुहोस्।</div>
        <button class="q-footer-btn" id="qGuestBtn" style="margin-top:8px;">अतिथिको रूपमा अगाडि बढ्ने</button>
      </div>
    `));
    s.querySelector("#qGuestBtn").addEventListener("click", () => {
      Q.session = { name: "सेवा कार्यकर्ता", branch: (Q.settings.branches[0] || "प्रशासन शाखा") };
      localStorage.setItem("fts_session", JSON.stringify(Q.session));
      Q.step = "action"; render();
    });
    return;
  }

  const grid = el(`<div class="q-grid"></div>`);
  Q.settings.employees.forEach(emp => {
    const tile = el(`
      <div class="q-tile avatar-tile">
        ${avatarHtml(emp.name, emp.photo)}
        <div class="lb">${escapeQ(emp.name)}</div>
      </div>
    `);
    tile.addEventListener("click", () => {
      Q.pendingEmployee = emp;
      if (emp.pin) { Q.pinBuffer = ""; Q.step = "login-pin"; }
      else { Q.session = { name: emp.name, branch: emp.branch }; localStorage.setItem("fts_session", JSON.stringify(Q.session)); Q.step = "action"; }
      render();
    });
    grid.appendChild(tile);
  });
  s.appendChild(grid);
}

function renderLoginPin(){
  const s = screen();
  const emp = Q.pendingEmployee;
  s.appendChild(el(`<div class="q-title">🔒 ${escapeQ(emp.name)}</div>`));
  s.appendChild(el(`<div class="q-sub">आफ्नो ४ अंकको PIN थिच्नुहोस्</div>`));
  const dots = el(`<div class="q-pin-dots">${[0,1,2,3].map(i => `<div class="q-pin-dot ${i < Q.pinBuffer.length ? "filled" : ""}"></div>`).join("")}</div>`);
  s.appendChild(dots);

  const pad = el(`<div class="q-pinpad"></div>`);
  ["1","2","3","4","5","6","7","8","9","⌫","0","OK"].forEach(k => {
    const btn = el(`<button>${k}</button>`);
    btn.addEventListener("click", () => handlePinKey(k));
    pad.appendChild(btn);
  });
  s.appendChild(pad);

  const err = el(`<div class="q-sub" id="qPinErr" style="color:var(--crimson); font-weight:700;"></div>`);
  s.appendChild(err);
}

function handlePinKey(k){
  if (k === "⌫") { Q.pinBuffer = Q.pinBuffer.slice(0, -1); render(); return; }
  if (k === "OK") { tryPinSubmit(); return; }
  if (Q.pinBuffer.length < 4) Q.pinBuffer += k;
  render();
  if (Q.pinBuffer.length === 4) setTimeout(tryPinSubmit, 150);
}

function tryPinSubmit(){
  const emp = Q.pendingEmployee;
  if (Q.pinBuffer === emp.pin) {
    Q.session = { name: emp.name, branch: emp.branch };
    localStorage.setItem("fts_session", JSON.stringify(Q.session));
    vib(60);
    Q.step = "action"; render();
  } else {
    vib([50,50,50]);
    const errEl = document.getElementById("qPinErr");
    if (errEl) errEl.textContent = "❌ PIN मिलेन, फेरि प्रयास गर्नुहोस्";
    Q.pinBuffer = "";
    render();
  }
}

/* ---------------- ACTION ---------------- */
function renderAction(){
  const s = screen();
  s.appendChild(el(`<div class="q-title">नमस्ते, ${escapeQ(Q.session.name)} 👋</div>`));
  s.appendChild(el(`<div class="q-sub">${escapeQ(Q.session.branch)}</div>`));
  const wrap = el(`<div class="q-big-actions"></div>`);
  const issueBtn = el(`<button class="q-big-btn issue"><span class="ic">📤</span> फाइल बुझाउने</button>`);
  const returnBtn = el(`<button class="q-big-btn retn"><span class="ic">📥</span> फाइल फिर्ता</button>`);
  issueBtn.addEventListener("click", () => { Q.draft = {}; Q.step = "issue-branch"; render(); });
  returnBtn.addEventListener("click", () => { Q.step = "return-photo"; render(); });
  wrap.appendChild(issueBtn); wrap.appendChild(returnBtn);
  s.appendChild(wrap);
}

/* ---------------- ISSUE: BRANCH ---------------- */
function renderIssueBranch(){
  const s = screen();
  s.appendChild(el(`<div class="q-title">🏢 कुन शाखालाई बुझाउने?</div>`));
  s.appendChild(el(`<div class="q-sub">पठाउने: ${escapeQ(Q.session.branch)}</div>`));
  const grid = el(`<div class="q-grid"></div>`);
  Q.settings.branches.forEach((b, i) => {
    const tile = el(`<div class="q-tile"><span class="ic">${BRANCH_ICONS[i % BRANCH_ICONS.length]}</span><span class="lb">${escapeQ(b)}</span></div>`);
    tile.addEventListener("click", () => { Q.draft.toBranch = b; Q.step = "issue-category"; render(); });
    grid.appendChild(tile);
  });
  s.appendChild(grid);
}

/* ---------------- ISSUE: CATEGORY ---------------- */
function renderIssueCategory(){
  const s = screen();
  s.appendChild(el(`<div class="q-title">📁 फाइलको वर्ग?</div>`));
  const grid = el(`<div class="q-grid"></div>`);
  Q.settings.categories.forEach((c, i) => {
    const tile = el(`<div class="q-tile"><span class="ic">${CATEGORY_ICONS[i % CATEGORY_ICONS.length]}</span><span class="lb">${escapeQ(c)}</span></div>`);
    tile.addEventListener("click", () => { Q.draft.category = c; Q.step = "issue-photo"; render(); });
    grid.appendChild(tile);
  });
  s.appendChild(grid);
}

/* ---------------- ISSUE: PHOTO ---------------- */
function renderIssuePhoto(){
  const s = screen();
  s.appendChild(el(`<div class="q-title">📷 फ्रन्ट पेज फोटो</div>`));
  s.appendChild(el(`<div class="q-sub">फिर्ता हुँदा स्वतः चिन्नका लागि खिच्नुहोस्</div>`));

  const box = el(`
    <div class="q-photo-box">
      <div class="ic" id="qPhotoIcon">📸</div>
      <div id="qPhotoStatus">फोटो खिच्न यहाँ थिच्नुहोस्</div>
      <input type="file" id="qPhotoInput" accept="image/*" capture="environment">
    </div>
  `);
  const input = box.querySelector("#qPhotoInput");
  box.addEventListener("click", (e) => { if (e.target !== input) input.click(); });
  s.appendChild(box);

  const skip = el(`<button class="q-ghost-btn">फोटो नखिचीकन अगाडि बढ्ने</button>`);
  skip.addEventListener("click", () => { Q.draft.photo = null; Q.step = "issue-carrier"; render(); });
  s.appendChild(skip);

  input.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    document.getElementById("qPhotoIcon").textContent = "⏳";
    document.getElementById("qPhotoStatus").textContent = "प्रोसेस हुँदैछ...";
    try {
      Q.draft.photo = await processFrontPagePhoto(file);
      vib(40);
      Q.step = "issue-carrier"; render();
    } catch {
      document.getElementById("qPhotoIcon").textContent = "❌";
      document.getElementById("qPhotoStatus").textContent = "फोटो प्रोसेस भएन, फेरि थिच्नुहोस्";
    }
  });
}

/* ---------------- ISSUE: CARRIER ---------------- */
function renderIssueCarrier(){
  const s = screen();
  s.appendChild(el(`<div class="q-title">🙋 कसले लैजान्दै हुनुहुन्छ?</div>`));

  const recent = [...Q.settings.carriers].sort((a,b) => (b.lastUsed||0) - (a.lastUsed||0)).slice(0, 6);
  if (recent.length) {
    s.appendChild(el(`<div class="q-sub">पहिले आउनुभएका मध्ये छान्नुहोस्</div>`));
    const grid = el(`<div class="q-grid"></div>`);
    recent.forEach(c => {
      const tile = el(`<div class="q-tile avatar-tile">${avatarHtml(c.name, null)}<div class="lb">${escapeQ(c.name)}</div></div>`);
      tile.addEventListener("click", () => {
        Q.draft.carrierName = c.name; Q.draft.carrierType = c.type; Q.draft.carrierContact = c.contact || "";
        c.lastUsed = Date.now();
        Q.step = "issue-confirm"; render();
      });
      grid.appendChild(tile);
    });
    s.appendChild(grid);
  }

  s.appendChild(el(`<div class="q-sub" style="margin-top:6px;">वा नयाँ व्यक्तिको नाम बोल्नुहोस्/लेख्नुहोस्</div>`));

  const canSpeak = ("webkitSpeechRecognition" in window) || ("SpeechRecognition" in window);
  if (canSpeak) {
    const voiceBtn = el(`<button class="q-voice-btn"><span>🎤</span> बोलेर नाम भन्नुहोस्</button>`);
    voiceBtn.addEventListener("click", () => startVoiceCapture(voiceBtn));
    s.appendChild(voiceBtn);
  }

  const textRow = el(`
    <div class="q-text-fallback">
      <input type="text" id="qCarrierManual" placeholder="नाम टाइप गर्नुहोस्...">
      <button id="qCarrierManualGo">👍</button>
    </div>
  `);
  s.appendChild(textRow);
  document.getElementById("qCarrierManualGo").addEventListener("click", () => {
    const name = document.getElementById("qCarrierManual").value.trim();
    if (!name) return;
    Q.draft.carrierName = name;
    const match = Q.settings.carriers.find(c => c.name.trim().toLowerCase() === name.toLowerCase());
    if (match) { Q.draft.carrierType = match.type; Q.draft.carrierContact = match.contact || ""; match.lastUsed = Date.now(); Q.step = "issue-confirm"; }
    else { Q.step = "issue-carrier-type"; }
    render();
  });
}

function startVoiceCapture(btn){
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const rec = new Recognition();
  rec.lang = "ne-NP";
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  btn.classList.add("listening");
  btn.innerHTML = `<span>🔴</span> सुन्दैछु...`;
  rec.onresult = (ev) => {
    const name = ev.results[0][0].transcript.trim();
    Q.draft.carrierName = name;
    const match = Q.settings.carriers.find(c => c.name.trim().toLowerCase() === name.toLowerCase());
    if (match) { Q.draft.carrierType = match.type; Q.draft.carrierContact = match.contact || ""; match.lastUsed = Date.now(); Q.step = "issue-confirm"; }
    else { Q.step = "issue-carrier-type"; }
    render();
  };
  rec.onerror = () => { btn.classList.remove("listening"); btn.innerHTML = `<span>🎤</span> फेरि प्रयास गर्नुहोस्`; };
  rec.onend = () => { btn.classList.remove("listening"); };
  rec.start();
}

/* ---------------- ISSUE: CARRIER TYPE (नयाँ व्यक्तिका लागि मात्र) ---------------- */
function renderIssueCarrierType(){
  const s = screen();
  s.appendChild(el(`<div class="q-title">👤 ${escapeQ(Q.draft.carrierName)}</div>`));
  s.appendChild(el(`<div class="q-sub">यो व्यक्ति को हो?</div>`));
  const grid = el(`<div class="q-grid"></div>`);
  CARRIER_TYPES.forEach(t => {
    const tile = el(`<div class="q-tile"><span class="ic">${t.icon}</span><span class="lb">${escapeQ(t.key)}</span></div>`);
    tile.addEventListener("click", () => { Q.draft.carrierType = t.key; Q.step = "issue-confirm"; render(); });
    grid.appendChild(tile);
  });
  s.appendChild(grid);
}

/* ---------------- ISSUE: CONFIRM ---------------- */
function renderIssueConfirm(){
  const s = screen();
  s.appendChild(el(`<div class="q-title">✅ यही ठीक छ?</div>`));
  s.appendChild(el(`
    <div class="q-photo-box" style="text-align:left; align-items:flex-start;">
      <div>🏢 <b>${escapeQ(Q.session.branch)}</b> → <b>${escapeQ(Q.draft.toBranch)}</b></div>
      <div>📁 वर्ग: <b>${escapeQ(Q.draft.category)}</b></div>
      <div>🙋 बुझ्ने: <b>${escapeQ(Q.draft.carrierName)}</b> (${escapeQ(Q.draft.carrierType)})</div>
      <div>📷 फोटो: <b>${Q.draft.photo ? "खिचिएको छ ✅" : "छैन"}</b></div>
      <div>⏰ फिर्ता म्याद: <b>२४ घण्टा भित्र</b></div>
    </div>
  `));
  const confirmBtn = el(`<button class="q-big-btn issue"><span class="ic">✅</span> पेश गर्ने</button>`);
  confirmBtn.addEventListener("click", submitIssue);
  s.appendChild(confirmBtn);
}

async function submitIssue(){
  const { bs, ad } = nowStamp();
  const seq = Q.files.length + 1;
  const bsYear = adToBs(new Date()).year;
  const fileId = `FTS-${bsYear}-${String(seq).padStart(4,"0")}`;
  const due = new Date(Date.now() + 24*60*60*1000);

  const record = {
    fileId,
    title: `${Q.draft.category} फाइल (फास्ट-ट्र्याक)`,
    regNo: "",
    category: Q.draft.category,
    fromBranch: Q.session.branch,
    toBranch: Q.draft.toBranch,
    carrierName: Q.draft.carrierName,
    carrierType: Q.draft.carrierType || "सेवाग्राही",
    carrierContact: Q.draft.carrierContact || "",
    handedBy: Q.session.name,
    dueDate: due.toISOString().slice(0,16),
    remark: "फास्ट-ट्र्याक मार्फत दर्ता भएको",
    status: "issued",
    issuedBs: bs, issuedAd: ad,
    takenAt: null, returnedAt: null,
    frontPhotoThumb: Q.draft.photo ? Q.draft.photo.thumb : null,
    frontPhotoHash: Q.draft.photo ? Q.draft.photo.hash : null,
    returnPhotoThumb: null,
    createdAt: Date.now()
  };

  await DB.addFile(record);
  Q.files.unshift(record);

  const exists = Q.settings.carriers.some(c => c.name.trim().toLowerCase() === record.carrierName.trim().toLowerCase());
  if (!exists) {
    Q.settings.carriers.push({ name: record.carrierName, type: record.carrierType, contact: record.carrierContact, defaultBranch: record.toBranch, lastUsed: Date.now() });
  }
  await DB.saveSettings(Q.settings);

  Q.lastFileId = fileId;
  vib([40,60,40]);
  Q.step = "issue-success";
  render();
}

function renderIssueSuccess(){
  const s = screen();
  s.appendChild(el(`
    <div class="q-success">
      <div class="check">✓</div>
      <h2>फाइल सफलतापूर्वक दर्ता भयो</h2>
      <p>${escapeQ(Q.lastFileId)}</p>
    </div>
  `));
  const canvasWrap = el(`<canvas id="qSuccessQr"></canvas>`);
  s.appendChild(canvasWrap);
  if (window.QRCode) {
    QRCode.toCanvas(canvasWrap, JSON.stringify({ fileId: Q.lastFileId, office: Q.settings.officeName }), { width: 170, margin: 1, color: { dark: "#0b2f5c" } });
  }
  const again = el(`<button class="q-footer-btn">➕ अर्को फाइल बुझाउने</button>`);
  again.addEventListener("click", () => { Q.step = "action"; render(); });
  s.appendChild(again);
}

/* ---------------- RETURN ---------------- */
function renderReturnPhoto(){
  const s = screen();
  s.appendChild(el(`<div class="q-title">📷 फ्रन्ट पेज फोटो खिच्नुहोस्</div>`));
  s.appendChild(el(`<div class="q-sub">फिर्ता हुने फाइलको फ्रन्ट पेज फेरि खिच्नुहोस्</div>`));
  const box = el(`
    <div class="q-photo-box">
      <div class="ic" id="qRPhotoIcon">📸</div>
      <div id="qRPhotoStatus">फोटो खिच्न यहाँ थिच्नुहोस्</div>
      <input type="file" id="qReturnPhotoInput" accept="image/*" capture="environment">
    </div>
  `);
  const input = box.querySelector("#qReturnPhotoInput");
  box.addEventListener("click", (e) => { if (e.target !== input) input.click(); });
  s.appendChild(box);

  input.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    document.getElementById("qRPhotoIcon").textContent = "⏳";
    document.getElementById("qRPhotoStatus").textContent = "मिलान गर्दैछ...";
    let processed;
    try { processed = await processFrontPagePhoto(file); }
    catch {
      document.getElementById("qRPhotoIcon").textContent = "❌";
      document.getElementById("qRPhotoStatus").textContent = "फोटो प्रोसेस भएन, फेरि थिच्नुहोस्";
      return;
    }

    const taken = (await DB.getFilesByStatus("taken")).filter(f => f.frontPhotoHash);
    if (taken.length === 0) {
      document.getElementById("qRPhotoIcon").textContent = "🤷";
      document.getElementById("qRPhotoStatus").textContent = "तुलना गर्न मिल्ने फाइल फेला परेन";
      return;
    }
    Q.candidates = taken
      .map(f => ({ file: f, distance: hammingDistance(processed.hash, f.frontPhotoHash) }))
      .sort((a,b) => a.distance - b.distance)
      .slice(0, 3);
    Q.returnPhotoThumb = processed.thumb;
    vib(40);
    Q.step = "return-candidates"; render();
  });
}

function renderReturnCandidates(){
  const s = screen();
  s.appendChild(el(`<div class="q-title">🔎 यो फाइल हो?</div>`));
  s.appendChild(el(`<div class="q-sub">सही फाइलमा थिच्नुहोस्</div>`));
  Q.candidates.forEach((c, i) => {
    const pct = similarityPercent(c.distance);
    const card = el(`
      <div class="q-cand-card">
        <img src="${c.file.frontPhotoThumb}">
        <div class="info">
          <div class="t">${escapeQ(c.file.carrierName)}</div>
          <div class="m">मिलान ${pct}%</div>
        </div>
      </div>
    `);
    card.addEventListener("click", () => confirmReturn(c.file));
    s.appendChild(card);
  });
}

async function confirmReturn(file){
  const { bs, ad } = nowStamp();
  await DB.updateFile(file.fileId, { status: "returned", returnedAt: `${bs} | ${ad}`, returnPhotoThumb: Q.returnPhotoThumb, returnScannedBy: Q.session.name });
  vib([40,60,40]);
  Q.lastReturnedTitle = file.carrierName;
  Q.step = "return-success"; render();
}

function renderReturnSuccess(){
  const s = screen();
  s.appendChild(el(`
    <div class="q-success">
      <div class="check">✓</div>
      <h2>फाइल फिर्ता भयो</h2>
      <p>${escapeQ(Q.lastReturnedTitle)}</p>
    </div>
  `));
  const again = el(`<button class="q-footer-btn">➕ अर्को फाइल</button>`);
  again.addEventListener("click", () => { Q.step = "action"; render(); });
  s.appendChild(again);
}
