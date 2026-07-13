/*
  image-match.js
  --------------------------------------------------------
  फाइलको "फ्रन्ट पेज फोटो" बाट फिर्ता हुँदा स्वतः चिन्ने सुविधाका लागि।
  QR प्रिन्ट नगरी पनि काम चलोस् भनेर हरेक फोटोको एउटा हलुका
  "visual fingerprint" (dHash) बनाइन्छ। फिर्ता गर्दा लिइएको नयाँ
  फोटोको hash सँग "लगेको" स्थितिमा रहेका फाइलहरूको hash तुलना गरेर
  सबैभन्दा मिल्दो १-३ वटा देखाइन्छ — अन्तिम पुष्टि सधैं मान्छेले नै गर्ने
  (गलत फाइल फिर्ता नलागोस् भनेर)।
--------------------------------------------------------
*/

function loadImageFromFile(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// फोटोलाई सानो (thumbnail) dataURL मा बदल्ने — भण्डारण हल्का राख्न
function imageToThumbDataUrl(img, maxWidth = 260){
  const scale = Math.min(1, maxWidth / img.width);
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  canvas.getContext("2d").drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.7);
}

// dHash (difference hash) — 9x8 grayscale ग्रिडमा छिमेकी पिक्सेल तुलना गरेर 64-bit फिंगरप्रिन्ट
function computeDHash(img){
  const w = 9, h = 8;
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  const gray = [];
  for (let i = 0; i < w * h; i++) {
    const r = data[i*4], g = data[i*4+1], b = data[i*4+2];
    gray.push(0.299*r + 0.587*g + 0.114*b);
  }
  let hash = "";
  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w - 1; col++) {
      hash += gray[row*w + col] > gray[row*w + col + 1] ? "1" : "0";
    }
  }
  return hash; // लम्बाइ ६४
}

function hammingDistance(a, b){
  if (!a || !b || a.length !== b.length) return 64;
  let d = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
  return d;
}

// एउटा File (input[type=file] बाट) लाई { thumb, hash } मा बदल्ने helper
async function processFrontPagePhoto(file){
  const img = await loadImageFromFile(file);
  return {
    thumb: imageToThumbDataUrl(img, 260),
    hash: computeDHash(img)
  };
}

// मिलानको % (०-६४ दूरीलाई प्रतिशतमा, ० दूरी = १००%)
function similarityPercent(distance){
  return Math.max(0, Math.round((1 - distance / 64) * 100));
}
