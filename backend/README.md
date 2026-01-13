# Pitch-Sync Backend

FastAPI Python backend for the Pitch-Sync Engine platform.

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| FastAPI | 0.115.0 | Web framework |
| Python | 3.11 | Runtime |
| SQLModel | 0.0.22 | ORM (SQLite) |
| Boto3 | 1.35.0 | AWS Bedrock client |
| Pydantic | 2.9.0 | Data validation |
| Uvicorn | 0.32.0 | ASGI server |

## Project Structure

```
backend/
├── api/
│   └── routes/           # API endpoint handlers
│       ├── session.py    # Session & phase management
│       ├── synthesis.py  # Image prompt generation
│       └── leaderboard.py # Rankings & stats
├── services/
│   ├── ai/               # AI integration layer
│   │   ├── client.py     # Claude (Bedrock) client
│   │   ├── evaluator.py  # Phase evaluation (Red Team + Judge)
│   │   ├── synthesizer.py # Prompt curation
│   │   └── image_gen.py  # FLUX.2 image generation
│   ├── state.py          # Session persistence
│   └── scoring.py        # Score calculations
├── models/
│   ├── session.py        # Domain models (SessionState, PhaseData)
│   ├── api.py            # Request/Response models
│   └── constants.py      # Static data (themes, usecases, phases)
├── database/
│   ├── models.py         # SQLModel table definitions
│   └── utils.py          # DB initialization & migrations
├── config/
│   └── settings.py       # Environment configuration
├── vault/                # Static JSON data
│   ├── phases.json       # Phase definitions & questions
│   ├── themes.json       # Visual themes
│   └── usecases.json     # Startup scenarios
├── scripts/              # Utility scripts
│   └── test_claude.py    # AI client testing
├── tests/                # Test suite
│   ├── test_api.py       # API integration tests
│   └── test_scoring.py   # Scoring unit tests
└── main.py               # Application entry point
```

## Quick Start

```bash
# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run development server
python -m uvicorn backend.main:app --port 8000 --reload

# Run tests
pytest . -v

# Lint code
ruff check .
mypy . --ignore-missing-imports
```

## API Endpoints

### Session Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/init` | Initialize or resume session |
| GET | `/api/check-session/{team_id}` | Check for existing session |
| POST | `/api/start-phase` | Begin a phase |
| POST | `/api/submit-phase` | Submit phase answers |

### Synthesis
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/prepare-synthesis` | Generate prompt draft |
| POST | `/api/curate-prompt` | Refine prompt with feedback |
| POST | `/api/generate-image` | Generate final image |

### Leaderboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/leaderboard` | Get team rankings |
| GET | `/api/usecases` | Get available missions & themes |

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Basic health check |
| GET | `/health` | Detailed health status |

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AWS_ACCESS_KEY_ID` | Yes* | - | AWS Bedrock credentials |
| `AWS_SECRET_ACCESS_KEY` | Yes* | - | AWS Bedrock credentials |
| `AWS_SESSION_TOKEN` | No | - | For temporary credentials |
| `AWS_REGION` | No | `eu-central-1` | AWS region |
| `FLUX_API_KEY` | Yes* | - | Azure AI Studio key |
| `FLUX_ENDPOINT` | No | (default) | Custom Flux endpoint |
| `DEBUG` | No | `false` | Enable debug logging |
| `TEST_MODE` | No | `true` | Skip credential validation |
| `CORS_ORIGINS` | No | localhost | Comma-separated origins |

*Required when `DEBUG=false` and `TEST_MODE=false`

## AI Services

### Phase Evaluation (Claude 3.5 Sonnet)
Two-agent evaluation system:
1. **Red Team Agent**: Critiques submission for logical flaws
2. **Lead Partner Agent**: Synthesizes critique into final score

### Image Generation (FLUX.2 Pro)
- Endpoint: Azure AI Studio MaaS
- Aspect ratio: 21:9 (cinematic)
- Output: PNG with base64 encoding

## Scoring System

### Phase Score Calculation
```
Phase Score = AI Quality Points - Penalties + Bonuses

Where:
- AI Quality Points = AI Score × Phase Weight × 1000
- Retry Penalty = 50 points per retry
- Time Penalty = Up to 150 points for overtime
- Hint Penalty = 50 points per hint used
- Efficiency Bonus = 5% for optimal token usage
```

### Tier Thresholds (Total Score / 1000)
| Tier | Score Range |
|------|-------------|
| S-TIER | 900-1000 |
| A-TIER | 800-899 |
| B-TIER | 700-799 |
| C-TIER | 500-699 |
| D-TIER | 0-499 |

## Database

SQLite database with SQLModel ORM:

### Tables
- **SessionData**: Game session state (JSON blob)
- **TeamContext**: Team-to-usecase/theme assignments

### Location
- Development: `gum_app.db` (project root)
- Docker: `/app/data/gum_app.db` (mounted volume)

## Testing

```bash
# Run all tests
pytest . -v

# Run specific test file
pytest tests/test_api.py -v

# Run with coverage
pytest . --cov=. --cov-report=html
```

## Docker

```dockerfile
# Build
docker build -f Dockerfile -t pitch-sync-backend ..

# Run
docker run -p 8000:8000 \
  -e AWS_ACCESS_KEY_ID=xxx \
  -e AWS_SECRET_ACCESS_KEY=xxx \
  -e FLUX_API_KEY=xxx \
  pitch-sync-backend
```

## Configuration Files

| File | Purpose |
|------|---------|
| `requirements.txt` | Python dependencies (pinned) |
| `pyproject.toml` | Ruff, Mypy, pytest configuration |
| `Dockerfile` | Container build instructions |

## Development Notes

- Use `TEST_MODE=true` to bypass API credential validation
- The "test" bypass: submitting "test" as any answer auto-passes
- Debug logs written to `claude_debug.log` when `DEBUG=true`
- Database auto-initializes on first startup
