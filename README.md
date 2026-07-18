# NextStep MVP Products

AI-powered academic companion for high school students.

## Quick Start

### Prerequisites
- Node.js 18+
- Expo Go app on your phone

### 1. Start the backend
```bash
cd backend
npm install
npm run dev
```
Server runs at http://localhost:3001

### 2. Seed student data (first time only)
```bash
cd backend
npm run db:seed          # seeds test user
npm run seed:students    # seeds 4000 SLHS students (~10 min)
```

After adding StudentProfile, run the migration:
```bash
cd backend
npx prisma migrate dev --name add_student_profile
```

### 3. Mobile app has moved
The Expo / React Native mobile app now lives in its own repo:
https://github.com/Pilotsoma/Futurely-mobile (full history preserved via `git subtree
split` on 2026-07-17). Clone it separately and follow its README to run it against this
repo's backend.

### 4. Start the web app
```bash
# From project root
npm install
npm run dev
```
Web app: http://localhost:3000

### 5. Start the college probability model server (only needed for the College Help probability feature)
```bash
cd model_server
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```
This is a **separate Python process** from the Node backend — both need to be running
in dev for college probability predictions to work. See
[College Admission Probability](#college-admission-probability) below for the full
picture (data, training, retraining, deployment).

## Demo Credentials
- Test account: `test@nextstep.com` / `nextstep123`
- Any SLHS student: `{studentId}@slhs.edu` / `nextstep123`
- List top students: `cd backend && npm run demo:students`

## Features
- **Grade Viewer** — Report Card, Transcript, Class Schedule, Contact Teachers
- **GPA Simulator** — What-if grade changes, real-time recalculation
- **Smart Planner** — Assignments by priority + Calendar view
- **NextStep AI Chat** — Stub (add Anthropic API key to activate)
- **College Help** — Roadmap, GPA Planner, Colleges with ML-backed admission probability (Reach/Target/Safety)
- **Settings** — Student profile, academic info, preferences

## College Admission Probability

A statistical estimate of a student's admission chances at a given college, shown on
the College Help screen (web and mobile) as a Reach / Target / Safety label. **This is
a planning estimate, not an official admissions prediction** — that disclaimer is shown
in the UI wherever a probability appears, and should stay that way.

### How it works
- `data/colleges.csv` — reference data (name, avg SAT, avg ACT, avg GPA, acceptance
  rate) for ~190 well-known four-year US colleges. Figures are **approximate**,
  hand-compiled from public knowledge, not a live data feed — periodically verify
  against each school's Common Data Set (CDS) or official admissions page. `avg_act`
  values were derived from the official SAT-ACT concordance table where independent
  ACT data wasn't separately confirmed, so treat it as directionally correct rather
  than precise. Schools omitted entirely means the data wasn't confident enough to
  include, not that they were forgotten.
- The app **never reads the CSV at runtime** — it's seeded once into a Postgres
  `College` table (via Prisma) and the backend queries that table. Reseed after
  editing the CSV:
  ```bash
  cd backend
  npm run seed:colleges
  ```
- `model/train_model.py` trains a `LogisticRegression` model. There is no real
  student-level admit/deny outcome data available to this project, so the script
  **simulates** ~200 synthetic applicants per college (SAT/ACT/GPA drawn from normal
  distributions centered on that college's averages) and derives a synthetic
  admitted/rejected label from a logistic function of how far above/below average
  each simulated applicant is — calibrated so an average applicant's simulated admit
  rate roughly matches the college's real acceptance rate. This approximates
  realistic admissions behavior (better relative stats raise probability, more
  selective schools have a lower baseline) but the model has never seen a real
  admissions decision. Retrain after editing `data/colleges.csv`:
  ```bash
  cd model
  pip install -r requirements.txt
  python train_model.py     # prints test accuracy/AUC, writes college_probability_model.joblib
  ```
- `model_server/` is a standalone FastAPI service (`POST /predict`, `GET /health`)
  that loads the trained model and serves predictions over HTTP. The Node backend
  calls it (`backend/src/services/collegeProbability.ts`) rather than reimplementing
  the model's math in JS — see step 5 in Quick Start to run it locally.
- The Node backend exposes `GET /colleges/catalog` (search) and `POST /colleges/predict`
  (auth-guarded, COPPA-gated, writes a compliance audit log entry per FERPA
  requirements) — see `backend/src/routes/colleges.ts` and `collegeCatalog.ts`.

### Deployment note
Vercel (where the Node backend + web app deploy) cannot host a Python process
alongside its serverless functions. `model_server/` must be deployed as its own
service (e.g. Railway, Fly.io, Cloud Run, or a small VM), reachable from the Node
backend over the network, with `MODEL_SERVER_URL` pointed at that deployment. This
is an open infrastructure item, not yet provisioned.

## Adding Real AI
When you have an Anthropic API key:
1. Add `ANTHROPIC_API_KEY=your_key` to `backend/.env`
2. Replace the stub in `backend/src/routes/ai.ts` with the Anthropic SDK call
3. No other changes needed

## Tech Stack
| Layer | Tech |
|-------|------|
| Mobile | React Native (Expo Go) |
| Web | Next.js 15 |
| Backend | Express.js + TypeScript |
| Database | PostgreSQL (Neon) via Prisma |
| Auth | JWT |
| AI | Rule-based stub (Anthropic API drop-in ready) |
| College Probability | scikit-learn model + FastAPI microservice (Python) |

## Project Structure
```
ns1-master/
├── backend/          Express API + Prisma + PostgreSQL (Neon)
│   ├── prisma/       Schema, migrations, seed scripts
│   ├── scripts/      Demo student listing
│   └── src/          Routes, middleware, lib
├── app/              Next.js web app
│   ├── (app)/        Authenticated pages (dashboard, grades, planner, ai, settings)
│   └── login/        Login page
├── lib/              Shared web API client
├── data/             Reference datasets (e.g. colleges.csv)
├── model/            College probability model training (train_model.py)
└── model_server/     FastAPI microservice serving the trained model
```

The mobile app (Expo/React Native) is a separate repo:
https://github.com/Pilotsoma/Futurely-mobile
