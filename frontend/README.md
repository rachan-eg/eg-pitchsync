# Pitch-Sync Frontend

React 19 + TypeScript frontend for the Pitch-Sync Engine platform.

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19.2.0 | UI framework |
| TypeScript | 5.9.3 | Type safety |
| Vite | 7.2.4 | Build tool & dev server |
| React Router | 7.12.0 | Client-side routing |
| react-markdown | 10.1.0 | Markdown rendering |

## Project Structure

```
src/
├── components/           # Reusable UI components
│   ├── GlobalHeader/     # Navigation header with score display
│   ├── ErrorModal/       # Error handling modal
│   ├── PhaseFeedback/    # AI evaluation results modal
│   └── PhaseInput/       # Question input form
├── pages/                # Route page components
│   ├── UsecaseSelect/    # Mission selection screen
│   ├── TeamInput/        # Team name entry
│   ├── MissionBrief/     # Mission overview
│   ├── WarRoom/          # Main game phase interface
│   ├── PromptCuration/   # Image prompt editor
│   ├── FinalReveal/      # Generated image display
│   ├── PresentationMode/ # Fullscreen presentation
│   └── Leaderboard/      # Team rankings
├── utils/                # Shared utilities
│   ├── api.ts            # API URL helpers
│   ├── scoring.ts        # Score tier calculations
│   └── index.ts          # Barrel exports
├── App.tsx               # Root component with routing
├── AppContext.tsx        # Global state management
├── types.ts              # TypeScript interfaces
├── main.tsx              # Entry point
└── index.css             # Design system & global styles
```

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_URL` | No | `http://localhost:8000` | Backend API URL |

For Docker builds, this is passed as a build argument.

## Design System

The application uses a custom CSS design system defined in `index.css`:

### CSS Custom Properties
- **Colors**: `--primary`, `--success`, `--danger`, `--warning`
- **Spacing**: `--space-xs` through `--space-3xl`
- **Typography**: `--text-xs` through `--text-6xl`
- **Radii**: `--radius-sm` through `--radius-2xl`
- **Z-index**: `--z-base` through `--z-toast`

### Component Styling
- Each component has its own `.css` file
- BEM naming convention: `.block__element--modifier`
- Glassmorphism effects throughout

### Score Tier Thresholds
All components use consistent tier thresholds:
- **S-TIER**: 900+ points
- **A-TIER**: 800-899 points
- **B-TIER**: 700-799 points
- **C-TIER**: 500-699 points
- **D-TIER**: Below 500 points

## State Management

Global state is managed via React Context (`AppContext.tsx`):

```typescript
// Available context values
const {
  session,           // Current game session
  phaseConfig,       // Phase definitions
  isLoading,         // Loading state
  error,             // Error state
  initSession,       // Start new session
  submitPhase,       // Submit phase answers
  generateImage,     // Trigger image generation
  resetToStart,      // Reset game
  // ... more
} = useApp();
```

## API Integration

API calls are made through the shared `utils/api.ts`:

```typescript
import { getApiUrl, getFullUrl } from './utils';

// API endpoint
const url = getApiUrl('/api/init');

// Static assets
const imageUrl = getFullUrl('/generated/image.png');
```

## Accessibility

- ARIA labels on interactive elements
- Keyboard navigation support (Enter/Space on cards)
- Focus indicators with visible outlines
- Screen reader support via `aria-hidden` on decorative icons

## Docker Build

The frontend uses a multi-stage Docker build:

1. **Build stage**: Node 20, runs `npm run build`
2. **Production stage**: Nginx Alpine, serves static files

```dockerfile
# Build
docker build -t pitch-sync-frontend .

# Run
docker run -p 80:80 pitch-sync-frontend
```

## Nginx Configuration

The `nginx.conf` handles:
- SPA routing (fallback to `index.html`)
- API proxying to backend (`/api` → `backend:8000`)
- Security headers (X-Frame-Options, CSP, etc.)
- Static file serving

## Development Notes

- Hot reload enabled via Vite
- TypeScript strict mode enabled
- ESLint configured for React best practices
- No CSS-in-JS; uses vanilla CSS for performance
