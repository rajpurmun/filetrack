/*
  firebase-config.js
  --------------------------------------------------------
  यहाँ आफ्नो Firebase Project को config राख्नुहोस्।
  Firebase Console > Project Settings > General > Your apps > SDK setup
  बाट यो config पाइन्छ।

  Firestore प्रयोग गर्नुअघि:
  1) Firebase Console मा नयाँ प्रोजेक्ट बनाउनुहोस्
  2) Firestore Database (Native mode) सुरु गर्नुहोस्
  3) तलको firebaseConfig भर्नुहोस्
  4) USE_FIREBASE = true गर्नुहोस्
  5) Firestore Rules मा auth अनुसार पहुँच सीमित गर्नुहोस् (README हेर्नुहोस्)
--------------------------------------------------------
*/

const USE_FIREBASE = false; // ⬅️ Firebase तयार भएपछि true गर्नुहोस्

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

let db = null;
if (USE_FIREBASE && typeof firebase !== "undefined") {
  firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
}

/*
  ============================================================
  DB — एउटै API, पछाडि localStorage वा Firestore जुनसुकै चलोस्।
  app.js ले यहीबाट डेटा पढ्ने/लेख्ने गर्छ, त्यसैले Firebase
  जोड्दा app.js मा केही बदल्नु पर्दैन।
  ============================================================
*/
const DB = {
  async getSettings(){
    if (USE_FIREBASE) {
      const doc = await db.collection("meta").doc("settings").get();
      return doc.exists ? doc.data() : null;
    }
    const raw = localStorage.getItem("fts_settings");
    return raw ? JSON.parse(raw) : null;
  },

  async saveSettings(settings){
    if (USE_FIREBASE) {
      await db.collection("meta").doc("settings").set(settings, { merge: true });
      return;
    }
    localStorage.setItem("fts_settings", JSON.stringify(settings));
  },

  async getFiles(){
    if (USE_FIREBASE) {
      const snap = await db.collection("files").orderBy("createdAt", "desc").get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
    const raw = localStorage.getItem("fts_files");
    return raw ? JSON.parse(raw) : [];
  },

  async addFile(fileRecord){
    if (USE_FIREBASE) {
      const ref = await db.collection("files").add(fileRecord);
      return ref.id;
    }
    const files = await this.getFiles();
    files.unshift(fileRecord);
    localStorage.setItem("fts_files", JSON.stringify(files));
    return fileRecord.fileId;
  },

  async getFilesByStatus(status){
    if (USE_FIREBASE) {
      const snap = await db.collection("files").where("status", "==", status).get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
    const files = await this.getFiles();
    return files.filter(f => f.status === status);
  },

  async getFileById(fileId){
    if (USE_FIREBASE) {
      const snap = await db.collection("files").where("fileId", "==", fileId).limit(1).get();
      return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
    }
    const files = await this.getFiles();
    return files.find(f => f.fileId === fileId) || null;
  },

  async updateFile(fileId, patch){
    if (USE_FIREBASE) {
      const snap = await db.collection("files").where("fileId", "==", fileId).limit(1).get();
      if (!snap.empty) {
        await snap.docs[0].ref.update(patch);
        return true;
      }
      return false;
    }
    const files = await this.getFiles();
    const idx = files.findIndex(f => f.fileId === fileId);
    if (idx === -1) return false;
    files[idx] = { ...files[idx], ...patch };
    localStorage.setItem("fts_files", JSON.stringify(files));
    return true;
  },

  async replaceAll(data){
    if (USE_FIREBASE) {
      console.warn("Firestore मोडमा bulk restore यहाँबाट हुँदैन — Firebase console/CLI प्रयोग गर्नुहोस्।");
      return;
    }
    localStorage.setItem("fts_settings", JSON.stringify(data.settings));
    localStorage.setItem("fts_files", JSON.stringify(data.files));
  }
};
