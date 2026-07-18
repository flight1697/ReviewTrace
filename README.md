# ReviewTrace

ReviewTrace turns App Store reviews into evidence-linked product findings, PRD requirements, version plans, and QA test cases.

This first slice scaffolds the runnable web application:

- Next.js web UI in `apps/web`
- FastAPI backend in `apps/api`
- A health-check API
- A fixture workflow API that returns traceable reviews, findings, requirements, and test cases
- Test commands for both sides

## Requirements

- Node.js 24 or newer
- npm 11 or newer
- Python 3.14 via the Windows `py` launcher

## Install

```powershell
npm install
py -m pip install -r apps/api/requirements.txt
```

## Run locally

```powershell
npm run dev
```

The web app starts on http://localhost:3000 and the API starts on http://localhost:8000.

Click **Start analysis** to run the fixture workflow against the local API.

## Test

```powershell
npm run test
```

## Environment

Copy `.env.example` to `.env.local` for local frontend settings. Keep API keys out of git.
