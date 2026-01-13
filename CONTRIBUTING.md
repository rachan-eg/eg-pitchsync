# Contributing to Pitch-Sync Engine

Thank you for your interest in contributing! This document provides guidelines and instructions.

## 🚀 Quick Start

### Prerequisites
- **Node.js 20+** for frontend
- **Python 3.11+** for backend
- **Docker** (optional, for containerized deployment)

### Local Development Setup

#### 1. Clone and Configure
```bash
git clone <repo-url>
cd gum

# Copy environment template and fill in your credentials
cp .env.example .env
# Edit .env with your AWS and Flux API keys
```

#### 2. Backend Setup
```bash
# Create virtual environment
python -m venv .venv

# Activate (Windows)
.venv\Scripts\activate

# Activate (macOS/Linux)
source .venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt

# Run development server
python -m uvicorn backend.main:app --port 8000 --reload
```

#### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

The app will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

### Using Docker
```bash
docker compose up --build
```
Access at http://localhost

## 📁 Project Structure

```
gum/
├── backend/               # FastAPI Python backend
│   ├── api/routes/        # API endpoints
│   ├── services/          # Business logic & AI services
│   ├── models/            # Pydantic models
│   ├── database/          # SQLite/SQLModel layer
│   └── config/            # Configuration & settings
├── frontend/              # React TypeScript frontend
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Route pages
│   │   ├── utils/         # Shared utilities
│   │   └── types.ts       # TypeScript interfaces
└── .github/workflows/     # CI/CD pipelines
```

## 🧪 Running Tests

```bash
# Backend tests
pytest backend/ -v

# Frontend linting
cd frontend && npm run lint

# Full CI check
npm run lint && npm run build
```

## 📝 Code Style

### Python
- Use **Ruff** for linting: `ruff check backend/`
- Use **Mypy** for type checking: `mypy backend/`
- Follow PEP 8 conventions
- Maximum line length: 120 characters

### TypeScript/React
- Use **ESLint** with provided config
- Use functional components with hooks
- Follow BEM naming for CSS classes

## 🔀 Pull Request Process

1. **Branch naming**: `feature/description` or `fix/description`
2. **Commit messages**: Use conventional commits (`feat:`, `fix:`, `docs:`, etc.)
3. **PR description**: Include what, why, and any testing notes
4. **CI must pass**: All linting and build checks must succeed

## 🔐 Environment Variables

Required for production (can bypass with `TEST_MODE=true` for development):

| Variable | Description |
|----------|-------------|
| `AWS_ACCESS_KEY_ID` | AWS credentials for Bedrock |
| `AWS_SECRET_ACCESS_KEY` | AWS credentials for Bedrock |
| `FLUX_API_KEY` | Azure AI Studio API key |
| `CORS_ORIGINS` | Comma-separated allowed origins |

## 📚 Additional Resources

- [FastAPI Docs](https://fastapi.tiangolo.com/)
- [React Docs](https://react.dev/)
- [SQLModel Docs](https://sqlmodel.tiangolo.com/)

## 🐛 Reporting Issues

Please include:
- Steps to reproduce
- Expected vs actual behavior
- Browser/OS/Python version
- Relevant error messages or logs
