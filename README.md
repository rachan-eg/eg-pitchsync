<p align="center">
  <img src="https://img.shields.io/badge/React-19.2-61DAFB?style=for-the-badge&logo=react&logoColor=white" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/FastAPI-0.115-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/Python-3.11-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker" />
</p>

<h1 align="center">🚀 Pitch-Sync Engine</h1>

<p align="center">
  <strong>AI-Powered Startup Pitch Incubator Platform</strong>
</p>

<p align="center">
  Build compelling startup pitches through guided phases with real-time AI evaluation powered by Claude 3.5 Sonnet and stunning visual generation via FLUX.2 Pro.
</p>

<p align="center">
  <a href="#-features">Features</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-architecture">Architecture</a> •
  <a href="#-screenshots">Screenshots</a> •
  <a href="#-api-reference">API</a> •
  <a href="#-tech-stack">Tech Stack</a>
</p>

---

## ✨ Features

<table>
<tr>
<td width="50%">

### 🎯 AI-Driven Evaluation
Two-agent system with **Red Team critique** and **Lead Partner judgment** using Claude 3.5 Sonnet on AWS Bedrock.

### 🏆 Dynamic Scoring (1000 pts)
Real-time scoring with time bonuses, retry penalties, efficiency metrics, and tier classifications (S/A/B/C).

### 🎨 Visual Asset Generation
Generate stunning pitch visuals with **FLUX.2 Pro** in cinematic 21:9 aspect ratio.

</td>
<td width="50%">

### 🎤 Smart Speech-to-Text
Neural VAD, auto-punctuation, brand dictionary, and voice feedback for hands-free operation. [Learn more](docs/STT_OPTIMIZATIONS.md)

### 💾 Session Persistence
SQLite database preserves progress across server restarts. Resume where you left off.

### 📊 Live Leaderboard
Track team rankings in real-time. Compete with others on the same instance.

### 🎭 Presentation Mode
Fullscreen mode for presenting your pitch with generated visuals and score summary.

</td>
</tr>
</table>

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         PITCH-SYNC ENGINE                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │   Frontend   │───▶│    Nginx     │───▶│     Backend      │  │
│  │  React 19    │    │   (Proxy)    │    │    FastAPI       │  │
│  │  TypeScript  │    │              │    │    Python 3.11   │  │
│  └──────────────┘    └──────────────┘    └────────┬─────────┘  │
│                                                    │            │
│                              ┌─────────────────────┼────────┐   │
│                              │                     │        │   │
│                              ▼                     ▼        │   │
│                    ┌──────────────┐      ┌──────────────┐   │   │
│                    │   Claude AI  │      │   FLUX.2     │   │   │
│                    │   (Bedrock)  │      │  (Azure AI)  │   │   │
│                    │  Evaluation  │      │  Image Gen   │   │   │
│                    └──────────────┘      └──────────────┘   │   │
│                                                             │   │
│                    ┌──────────────────────────────────────┐ │   │
│                    │              SQLite                  │ │   │
│                    │     Sessions • Teams • Scores        │ │   │
│                    └──────────────────────────────────────┘ │   │
│                                                             │   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Using Docker (Recommended)

```bash
# 1. Clone the repository
git clone <repository-url>
cd pitch-sync-engine

# 2. Configure environment
cp .env.example .env
# Edit .env with your API credentials (see below)

# 3. Launch the application
docker compose up --build

# 4. Open in browser
# → http://localhost
```

### Local Development

<details>
<summary><strong>Backend Setup</strong></summary>

```bash
# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r backend/requirements.txt

# Run development server
python -m uvicorn backend.main:app --port 8000 --reload
```

</details>

<details>
<summary><strong>Frontend Setup</strong></summary>

```bash
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev
```

</details>

---

## 🔑 Environment Variables

| Variable | Required | Description |
|----------|:--------:|-------------|
| `AWS_ACCESS_KEY_ID` | ✅ | AWS Bedrock credentials |
| `AWS_SECRET_ACCESS_KEY` | ✅ | AWS Bedrock credentials |
| `AWS_SESSION_TOKEN` | ⚪ | For temporary credentials |
| `AWS_REGION` | ⚪ | Default: `eu-central-1` |
| `FLUX_API_KEY` | ✅ | Azure AI Studio API key |
| `DEBUG` | ⚪ | Enable debug mode |
| `TEST_MODE` | ⚪ | Skip credential validation |
| `CORS_ORIGINS` | ⚪ | Comma-separated origins |

> 💡 **Tip**: Set `TEST_MODE=true` during development to bypass API credential validation.

---

## 📸 Screenshots

<p align="center">
  <i>Screenshots coming soon! Run the app locally to see it in action.</i>
</p>

<!-- Uncomment when you have screenshots
<p align="center">
  <img src="docs/screenshots/mission-select.png" width="45%" alt="Mission Select" />
  <img src="docs/screenshots/war-room.png" width="45%" alt="War Room" />
</p>
<p align="center">
  <img src="docs/screenshots/prompt-curation.png" width="45%" alt="Prompt Curation" />
  <img src="docs/screenshots/final-reveal.png" width="45%" alt="Final Reveal" />
</p>
-->

---

## 📖 API Reference

<details>
<summary><strong>Session Management</strong></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/init` | Initialize or resume session |
| `GET` | `/api/check-session/{team_id}` | Check for existing session |
| `POST` | `/api/start-phase` | Begin a phase |
| `POST` | `/api/submit-phase` | Submit phase answers |

</details>

<details>
<summary><strong>Synthesis & Generation</strong></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/prepare-synthesis` | Generate prompt draft |
| `POST` | `/api/curate-prompt` | Refine prompt with feedback |
| `POST` | `/api/generate-image` | Generate final image |

</details>

<details>
<summary><strong>Leaderboard & Data</strong></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/leaderboard` | Get team rankings |
| `GET` | `/api/usecases` | Get available missions & themes |

</details>

> 📚 **Full API Docs**: Available at `/docs` when running the backend (Swagger UI)

---

## 🧮 Scoring System

<table>
<tr>
<td>

### Score Calculation
```
Phase Score = AI Quality - Penalties + Bonuses

• AI Quality: Score × Weight × 1000
• Retry Penalty: -50 per retry
• Time Penalty: -150 max for overtime
• Hint Penalty: -50 per hint
• Efficiency Bonus: +5% optimal tokens
```

</td>
<td>

### Tier Thresholds

| Tier | Score Range | Badge |
|:----:|:-----------:|:-----:|
| **S** | 900-1000 | 🏆 |
| **A** | 800-899 | ⭐ |
| **B** | 700-799 | 🎯 |
| **C** | 500-699 | 📈 |
| **D** | 0-499 | 🌱 |

</td>
</tr>
</table>

---

## 📁 Project Structure

```
pitch-sync-engine/
├── 📂 backend/              # FastAPI Python backend
│   ├── api/routes/          # REST endpoints
│   ├── services/            # Business logic & AI
│   ├── models/              # Pydantic models
│   ├── database/            # SQLite persistence
│   └── tests/               # pytest suite
├── 📂 frontend/             # React 19 + TypeScript
│   ├── src/components/      # UI components
│   ├── src/pages/           # Route pages
│   └── src/utils/           # Shared utilities
├── 📂 .github/workflows/    # CI/CD pipelines
├── 📄 docker-compose.yml    # Container orchestration
└── 📄 README.md             # You are here!
```

---

## 🛠️ Tech Stack

<p align="center">
  <img src="https://skillicons.dev/icons?i=react,typescript,vite,python,fastapi,docker,nginx,sqlite" alt="Tech Stack" />
</p>

| Layer | Technologies |
|-------|--------------|
| **Frontend** | React 19, TypeScript 5.9, Vite 7, React Router 7 |
| **Backend** | FastAPI, Python 3.11, SQLModel, Pydantic |
| **AI Services** | Claude 3.5 Sonnet (AWS Bedrock), FLUX.2 Pro (Azure) |
| **Infrastructure** | Docker, Nginx, SQLite, Uvicorn |
| **DevOps** | GitHub Actions, Ruff, Mypy, pytest, ESLint |

---

<p align="center">
  <strong>Built for internal use</strong>
</p>