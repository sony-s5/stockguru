# StockGuru — Deploy Guide (Beginner Friendly)

## ✅ What You're Building
- 12-step AI stock analyzer
- Stock database (browse + save)
- User login / signup
- Portfolio tracker
- PDF download

---

## STEP 1 — Install Required Tools (One Time Only)

### 1a. Install Node.js
Go to https://nodejs.org → Download "LTS" version → Install

### 1b. Install VS Code (code editor)
Go to https://code.visualstudio.com → Download → Install

### 1c. Install Git
Go to https://git-scm.com → Download → Install

---

## STEP 2 — Setup Supabase (Free Database + Auth)

1. Go to https://supabase.com → "Start your project" → Sign up free
2. "New Project" → Name: stockguru → Set a password → Create
3. Wait ~2 minutes for project to be ready
4. Go to **SQL Editor** (left sidebar) → Paste contents of `supabase_schema.sql` → Click "Run"
5. Go to **Settings → API** → Copy:
   - `Project URL` → paste in `.env.local` as `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → paste as `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## STEP 3 — Get Anthropic API Key (for AI analysis)

1. Go to https://console.anthropic.com → Sign up → Go to API Keys
2. Create new key → Copy it
3. Paste in `.env.local` as `ANTHROPIC_API_KEY`

---

## STEP 4 — Run the Project Locally

Open VS Code → Open Terminal (Ctrl + `) → Run:

```bash
# Go into the project folder
cd stockguru

# Install all packages (one time)
npm install

# Start the app
npm run dev
```

Open browser → go to http://localhost:3000 → Website ready! 🎉

---

## STEP 5 — Deploy to Vercel (Free Hosting)

### 5a. Push code to GitHub
1. Go to https://github.com → Sign up → "New repository" → Name: stockguru → Create
2. In VS Code terminal:
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/stockguru.git
git push -u origin main
```

### 5b. Deploy on Vercel
1. Go to https://vercel.com → Sign up with GitHub
2. "New Project" → Import your `stockguru` repo
3. **IMPORTANT: Add Environment Variables** (Settings → Environment Variables):
   - `NEXT_PUBLIC_SUPABASE_URL` = your supabase url
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your supabase key
   - `ANTHROPIC_API_KEY` = your anthropic key
4. Click Deploy → Wait 2 minutes → Your site is live! 🚀

---

## STEP 6 — Add Custom Domain (Optional, ~₹800/year)

1. Go to https://namecheap.com → Search "stockguru.in" or your preferred name
2. Buy domain
3. In Vercel → Your project → Settings → Domains → Add domain
4. Follow Vercel's DNS instructions (copy nameservers to Namecheap)
5. Wait 10-30 min → Done!

---

## STEP 7 — Admin: Add Stocks to Database

### Option A: Via Analyze page (AI auto-generate)
1. Go to yoursite.com/analyze
2. Type any stock name → Analyze
3. Click "Save to Database" → Done!

### Option B: Manually via Supabase
1. Supabase → Table Editor → stocks → Insert row
2. Fill in name, ticker, sector, analysis (JSON)

---

## 🔒 Security Checklist
- [ ] Never commit `.env.local` to GitHub (already in .gitignore)
- [ ] Set your admin user ID in supabase_schema.sql before running
- [ ] Enable email confirmation in Supabase → Auth → Settings

---

## 💰 Cost Summary
| Service | Cost |
|---------|------|
| Vercel hosting | FREE |
| Supabase (up to 50k rows) | FREE |
| Anthropic API | ~₹1-2 per analysis |
| Domain (.in) | ~₹800/year |
| **Total** | **~₹800/year** |

---

## ❓ Common Issues

**"Module not found" error** → Run `npm install` again

**"Invalid API key"** → Check `.env.local` file — no spaces around `=`

**Supabase connection error** → Check URL and key are correct in `.env.local`

**White screen** → Open browser console (F12) → See error message → Ask Claude!

---

## 📞 Need Help?
Ask Claude.ai — paste the error message and say "StockGuru website lo ee error vastundi, fix cheyyi"
