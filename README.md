# Digital Hisab — GitHub Codespaces + Supabase + Vercel (Full Method)

এই ভার্সনে ডেটা আর শুধু একটা ফোনে থাকে না — **Supabase** (ফ্রি cloud database)
ব্যবহার করে সব ডিভাইসে (ফোন, ল্যাপটপ, ট্যাব) sync হয়। Login করলে যেকোনো
ডিভাইস থেকে একই হিসাব দেখা/যোগ করা যাবে।

নিচে সম্পূর্ণ ধাপ — GitHub Codespace খোলা থেকে শুরু করে Supabase সেটআপ,
কোডে বসানো এবং শেষে Vercel-এ Publish করা পর্যন্ত।

---

## ধাপ ১ — GitHub Codespace তৈরি করুন

Codespace মানে ব্রাউজারেই একটা পূর্ণাঙ্গ VS Code + Terminal, নিজের কম্পিউটারে
কিছু Install করা লাগে না।

1. আপনার GitHub repository-তে যান (যেখানে এই কোড আছে বা এখনো আপলোড করেননি
   হলে আগে repo তৈরি করে এই ফোল্ডারের সব ফাইল আপলোড করুন)।
2. উপরে সবুজ **"Code"** বাটনে ক্লিক করুন।
3. **"Codespaces"** ট্যাবে যান → **"Create codespace on main"** চাপুন।
4. কিছুক্ষণ পর ব্রাউজারেই VS Code খুলে যাবে, বাম পাশে ফাইল লিস্ট এবং নিচে
   একটা Terminal থাকবে — এখানেই সব এডিট ও কমান্ড চালাবেন।

---

## ধাপ ২ — Supabase প্রজেক্ট তৈরি করুন

1. https://supabase.com এ যান → **Sign up / Sign in** (GitHub দিয়েই করা যায়)।
2. **"New Project"** চাপুন। একটা নাম দিন (যেমন: `digital-hisab`), একটা
   Database Password সেট করুন (মনে রাখবেন, পরে লাগবে না তবু সংরক্ষণ করুন),
   এবং কাছের একটা Region বেছে (যেমন Singapore) **"Create new project"**
   চাপুন। তৈরি হতে ১-২ মিনিট লাগবে।

### টেবিল তৈরি করুন (SQL চালিয়ে)

3. বাম মেনু থেকে **"SQL Editor"** → **"New query"** এ যান।
4. এই repo-র `supabase/schema.sql` ফাইলটা Codespace-এ খুলুন, পুরো কনটেন্ট
   Copy করুন, Supabase-এর SQL Editor-এ Paste করে **"Run"** চাপুন।
   এটি `categories` ও `transactions` টেবিল এবং নিরাপত্তার জন্য Row Level
   Security (RLS) পলিসি তৈরি করবে — অর্থাৎ প্রতিটি ইউজার শুধু নিজের ডেটাই
   দেখতে/বদলাতে পারবে, অন্য কারও ডেটা দেখা যাবে না।

### API Key সংগ্রহ করুন

5. বাম মেনু থেকে **"Project Settings" → "API"** তে যান।
6. দুইটা মান কপি করুন:
   - **Project URL** (যেমন: `https://abcxyz.supabase.co`)
   - **anon public** key (একটা লম্বা টোকেন)

### Email Confirmation সেটিং (গুরুত্বপূর্ণ)

7. **"Authentication" → "Providers" → "Email"** এ গিয়ে দেখুন
   **"Confirm email"** টগল অন আছে কিনা।
   - **অন থাকলে:** Sign up করার পর ইউজারকে Email-এ পাঠানো লিংকে ক্লিক করে
     confirm করতে হবে, তারপর লগইন করা যাবে। (Production-এর জন্য ভালো)
   - **টেস্ট করার সুবিধার জন্য অফ করতে চাইলে:** টগলটা অফ করে Save করুন —
     তাহলে Sign up করার সাথে সাথেই লগইন হয়ে যাবে, কোনো email confirm লাগবে
     না।

---

## ধাপ ৩ — কোডে Supabase-এর তথ্য বসান

Codespace-এর ফাইল লিস্ট থেকে **`js/supabaseConfig.js`** খুলুন এবং দুইটা
মান বদলে দিন:

```js
window.SUPABASE_CONFIG = {
  url: 'https://আপনার-প্রজেক্ট.supabase.co',
  anonKey: 'আপনার-anon-public-key'
};
```

Save করুন (Ctrl+S / Cmd+S)।

---

## ধাপ ৪ — লোকালি টেস্ট করুন (Codespace-এর ভেতরেই)

Codespace-এর Terminal-এ লিখুন:

```bash
python3 -m http.server 8080
```

নিচে একটা পপ-আপ/নোটিফিকেশনে **"Open in Browser"** আসবে, অথবা "PORTS" ট্যাব
থেকে 8080 পোর্টের পাশে গ্লোব আইকনে ক্লিক করুন। এতে ব্রাউজারে অ্যাপটা খুলবে —
এখানে Sign up করে টেস্ট করে দেখুন সব ঠিকমতো কাজ করছে কিনা।

---

## ধাপ ৫ — GitHub-এ Push করুন

Codespace-এর Terminal-এ:

```bash
git add .
git commit -m "Add Supabase cloud sync"
git push
```

(Codespace আপনার GitHub একাউন্টেই লগইন করা থাকে বলে আলাদা করে password
লাগবে না।)

---

## ধাপ ৬ — Vercel-এ Publish করুন

1. https://vercel.com এ যান, GitHub দিয়ে Sign in করুন।
2. **"Add New..." → "Project"** চাপুন।
3. আপনার GitHub repository (যেমন `Digital-Hisab`) খুঁজে **"Import"** করুন।
4. Framework Preset "Other" রেখেই দিন, Build Command এবং Output
   Directory **ফাঁকা রাখুন** — এটা plain static ফাইল, কোনো build লাগে না।
5. **"Deploy"** চাপুন। ১ মিনিটের মধ্যে একটা লাইভ লিংক পাবেন
   (যেমন: `digital-hisab.vercel.app`)।

> ⚠️ যেহেতু `js/supabaseConfig.js`-এ URL/key কোডেই বসানো আছে (env variable
> না), Vercel-এ আলাদা কোনো Environment Variable সেট করার দরকার নেই — শুধু
> ধাপ ৩-এ ফাইলটা ঠিকভাবে বসিয়ে GitHub-এ push করলেই Vercel সেটা নিয়ে নেবে।

---

## ধাপ ৭ — লাইভ সাইটে টেস্ট করুন

1. Vercel-এর দেওয়া লিংকে যান।
2. **"নতুন একাউন্ট তৈরি করুন"** দিয়ে Sign up করুন।
3. Email confirmation অন থাকলে ইনবক্স চেক করে লিংকে ক্লিক করুন, তারপর লগইন
   করুন।
4. Category তৈরি করে এন্ট্রি যোগ করুন — এবার অন্য যেকোনো ডিভাইস/ব্রাউজার
   থেকে একই Email/Password দিয়ে লগইন করলে একই ডেটা দেখতে পাবেন।
5. ফোনে খুলে উপরের **"📲 Install"** বাটন চেপে হোমস্ক্রিনে বসিয়ে নিন।

---

## যা বদলেছে আগের (offline IndexedDB) ভার্সন থেকে

| বিষয় | আগে | এখন |
|---|---|---|
| ডেটা সংরক্ষণ | ফোনের IndexedDB (শুধু একটা ডিভাইস) | Supabase Cloud (সব ডিভাইসে sync) |
| Login | দরকার ছিল না | Email/Password (Supabase Auth) |
| ইন্টারনেট | সম্পূর্ণ অফলাইন | ডেটা পড়তে/লিখতে ইন্টারনেট লাগবে |
| Backup/Restore | ✅ আছে | ✅ এখনো আছে (Profile পেজ থেকে JSON export/import) |

**নোট:** সম্পূর্ণ অফলাইন ব্যবহার এখন আর সম্ভব না, কারণ Supabase একটা cloud
সার্ভিস। অ্যাপের UI (shell) service worker দিয়ে ক্যাশ হয়ে থাকে বলে খুলবে,
কিন্তু নতুন এন্ট্রি সংরক্ষণ বা ডেটা লোড করতে ইন্টারনেট সংযোগ লাগবে।

## ফাইল গঠন (নতুন সংযোজন)

```
digital-hisab-pwa/
├── supabase/
│   └── schema.sql        # Supabase-এ একবার চালানোর SQL (টেবিল + RLS)
├── js/
│   ├── supabaseConfig.js  # আপনার Project URL + anon key এখানে বসবে
│   ├── db.js               # Supabase client দিয়ে সব ডেটা CRUD
│   ├── charts.js
│   └── app.js               # + Login/Signup/Logout লজিক যোগ হয়েছে
└── index.html                # + Auth screen যোগ হয়েছে
```
