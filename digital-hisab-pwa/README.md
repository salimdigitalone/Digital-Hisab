# Digital Hisab — Progressive Web App (100% Offline)

সম্পূর্ণ নতুন করে তৈরি — কোনো backend, Google Sheets, বা login লাগে না। পুরো
অ্যাপটা ফোনের ব্রাউজারে **Install** করা যায় এবং **ইন্টারনেট ছাড়াই** কাজ করে।
সব ডেটা ফোনের নিজস্ব storage-এ (IndexedDB) থাকে।

## ফিচার

- 🏠 Dashboard — আয়/ব্যয়/ব্যালেন্স, savings rate, মাসিক bar chart, ক্যাটাগরি doughnut chart
- ➕ Main → Sub → Child ক্যাটাগরি সহ Transaction এন্ট্রি
- 📋 ফিল্টার-সহ বিস্তারিত রিপোর্ট (তারিখ, টাইপ, ক্যাটাগরি, payment, সার্চ)
- 📅 মাসিক ক্লোজিং রিপোর্ট + Print
- ⚙️ Category তৈরি/disable ও hierarchy tree view
- 💾 Backup (JSON export) / Restore — ফোন পরিবর্তন করলে বা reinstall করলে ডেটা ফেরত আনতে
- 📲 "Install App" বাটন — হোমস্ক্রিনে আইকন যোগ হয়, দেখতে সত্যিকারের অ্যাপের মতো লাগে
- 🔌 Service worker দিয়ে সম্পূর্ণ অফলাইন সাপোর্ট (Chart.js-এর মতো কোনো বাহ্যিক CDN ব্যবহার
  করা হয়নি — নিজস্ব হালকা canvas chart কোড দিয়ে চার্ট আঁকা হয়েছে, তাই ইন্টারনেট না থাকলেও
  চার্ট ভাঙে না)

## লোকালি টেস্ট করা

ব্রাউজার সরাসরি `file://` থেকে service worker চালাতে দেয় না, তাই একটা সাধারণ
স্ট্যাটিক সার্ভার লাগবে:

```bash
cd digital-hisab-pwa
python3 -m http.server 8080
# ব্রাউজারে খুলুন: http://localhost:8080
```

## Vercel-এ Deploy করা (বিনামূল্যে, সবচেয়ে সহজ)

এটা pure static ফাইল (HTML/CSS/JS) — কোনো build step বা backend লাগবে না।

```bash
cd digital-hisab-pwa
git init
git add .
git commit -m "Digital Hisab PWA - offline first"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

তারপর vercel.com → **Add New Project** → এই repo import করুন → Framework
"Other" রেখেই **Deploy** চাপুন। Build command/output directory ফাঁকা রাখলেই
চলবে, কারণ এটা static ফাইল।

> বিকল্প: GitHub Pages, Netlify, Cloudflare Pages — যেকোনো static hosting-এই
> কাজ করবে, কারণ এটাতে কোনো server-side কোড নেই।

## ফোনে Install করা

1. Deploy করা লিংকে ফোনের Chrome/Safari দিয়ে ঢুকুন।
2. উপরে ডানদিকে **"📲 Install"** বাটন দেখাবে (অথবা ব্রাউজারের মেনু থেকে
   "Add to Home Screen" চাপুন)।
3. Install হয়ে গেলে হোমস্ক্রিন থেকে সরাসরি খুলবে, পুরো স্ক্রিন জুড়ে, ব্রাউজারের
   address bar ছাড়া — সত্যিকারের অ্যাপের মতো।

## গুরুত্বপূর্ণ সীমাবদ্ধতা (Design ট্রেড-অফ)

যেহেতু কোনো backend/server নেই:

- **ডেটা শুধু একটা ডিভাইস/ব্রাউজারে থাকে।** দুই ফোনে বা কম্পিউটার+ফোনে একসাথে
  sync হবে না। পরিবার/অফিসে একসাথে ব্যবহার করতে চাইলে (একাধিক ইউজার, রোল,
  সবার ডেটা এক জায়গায়) আগের Google Sheets + Vercel backend ভার্সনটা লাগবে।
- ব্রাউজারের "Clear browsing data / Site data" চাপলে ডেটা মুছে যেতে পারে —
  তাই **নিয়মিত Profile পেজ থেকে Backup (JSON) export করে রাখা জরুরি**।
- চাইলে ভবিষ্যতে এই একই ফ্রন্টএন্ডের সাথে একটা sync backend (Firebase,
  Supabase, বা আগের Google Sheets API) যোগ করে multi-device sync চালু করা
  সম্ভব — `js/db.js`-এর ফাংশনগুলো একই রেখে ভেতরের implementation বদলালেই হবে।

## ফাইল গঠন

```
digital-hisab-pwa/
├── index.html          # মূল UI (Dashboard, Entry, Reports, Monthly, Categories, Profile)
├── manifest.json        # PWA manifest (নাম, আইকন, থিম কালার)
├── service-worker.js    # অফলাইন ক্যাশিং
├── css/style.css
├── js/
│   ├── db.js            # IndexedDB — সব ডেটা CRUD
│   ├── charts.js        # নিজস্ব canvas bar/doughnut chart (কোনো CDN লাগে না)
│   └── app.js            # UI লজিক, নেভিগেশন, ইভেন্ট হ্যান্ডলিং
└── icons/
    ├── icon-192.png
    ├── icon-512.png
    └── icon-maskable-512.png
```
