/*
  bs-date.js
  --------------------------------------------------------
  हलुका Bikram Sambat (वि.सं.) मिति देखाउने helper।

  ⚠️ महत्त्वपूर्ण नोट (जरुरी पढ्नुहोस्):
  यहाँ प्रयोग गरिएको AD → BS रूपान्तरण औसत महिना लम्बाइमा आधारित
  approximate calculation हो — यो demo/UI मा मिति देखाउनका लागि ठीक छ,
  तर वास्तविक कार्यालयीन अभिलेख (production) मा प्रयोग गर्नुअघि
  ठ्याक्कै सही वि.सं. पात्रो डेटाका लागि राम्रो maintained भएको
  npm प्याकेज "nepali-date-converter" वा "bikram-sambat-js" राख्नुहोस्:

      npm install nepali-date-converter

  र यो फाइलको adToBs()/bsMonthName() लाई सोही लाइब्रेरीबाट replace गर्नुहोस्।
  --------------------------------------------------------
*/

const BS_MONTHS = [
  "बैशाख","जेठ","असार","श्रावण","भदौ","आश्विन",
  "कार्तिक","मंसिर","पुष","माघ","फाल्गुन","चैत"
];

const NP_DIGITS = ["०","१","२","३","४","५","६","७","८","९"];

function toNepaliDigits(numStr){
  return String(numStr).split("").map(ch => /[0-9]/.test(ch) ? NP_DIGITS[ch] : ch).join("");
}

// सन्दर्भ बिन्दु: 2000-01-01 BS ≈ 1943-04-14 AD (Baisakh 1, 2000 BS)
const BS_EPOCH_AD = new Date(Date.UTC(1943, 3, 14));
const BS_EPOCH_YEAR = 2000;
const AVG_MONTH_LEN = 30.44; // औसत, approximate

function adToBs(adDate){
  const diffDays = Math.floor((adDate.getTime() - BS_EPOCH_AD.getTime()) / 86400000);
  let bsYear = BS_EPOCH_YEAR + Math.floor(diffDays / 365.2425);
  let remDays = diffDays - Math.floor((bsYear - BS_EPOCH_YEAR) * 365.2425);
  if(remDays < 0){ bsYear -= 1; remDays += 365; }
  let monthIndex = Math.floor(remDays / AVG_MONTH_LEN);
  if(monthIndex > 11) monthIndex = 11;
  let day = Math.round(remDays - monthIndex * AVG_MONTH_LEN) + 1;
  if(day < 1) day = 1;
  if(day > 32) day = 32;
  return { year: bsYear, monthIndex, day };
}

function formatBsDate(date = new Date()){
  const { year, monthIndex, day } = adToBs(date);
  return `${toNepaliDigits(day)} ${BS_MONTHS[monthIndex]} ${toNepaliDigits(year)}`;
}

function formatAdDate(date = new Date()){
  return date.toLocaleDateString('en-CA'); // YYYY-MM-DD
}

function nowStamp(){
  const now = new Date();
  return {
    bs: formatBsDate(now),
    ad: formatAdDate(now),
    time: now.toLocaleTimeString('ne-NP', { hour: '2-digit', minute:'2-digit' })
  };
}
