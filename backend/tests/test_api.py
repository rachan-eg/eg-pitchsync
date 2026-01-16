"""
API Integration Tests
Tests for the FastAPI endpoints using httpx.
"""

import pytest
from fastapi.testclient import TestClient
from backend.main import app


@pytest.fixture
def client():
    """Create a test client for the FastAPI app."""
    return TestClient(app)


class TestHealthEndpoints:
    """Tests for health check endpoints."""

    def test_root_health_check(self, client):
        """Test the root endpoint returns health status."""
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "online"
        assert "system" in data
        assert "timestamp" in data

    def test_detailed_health_check(self, client):
        """Test the detailed health endpoint."""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "version" in data


class TestUsecaseEndpoints:
    """Tests for usecase and theme endpoints."""

    def test_get_usecases(self, client):
        """Test retrieving available usecases and themes."""
        response = client.get("/api/usecases")
        assert response.status_code == 200
        data = response.json()
        assert "usecases" in data
        assert "themes" in data
        assert isinstance(data["usecases"], list)
        assert isinstance(data["themes"], list)
        assert len(data["usecases"]) > 0
        assert len(data["themes"]) > 0


class TestSessionEndpoints:
    """Tests for session management endpoints."""

    def test_init_session(self, client):
        """Test initializing a new session."""
        response = client.post("/api/init", json={
            "team_id": "test_team_001",
            "usecase_id": None,
            "theme_id": None
        })
        assert response.status_code == 200
        data = response.json()
        assert "session_id" in data
        assert "usecase" in data
        assert "theme" in data
        assert "phases" in data
        assert "scoring_info" in data

    def test_check_session(self, client):
        """Test checking for existing session."""
        # First create a session
        init_response = client.post("/api/init", json={
            "team_id": "test_team_002"
        })
        assert init_response.status_code == 200

        # Then check for it
        response = client.get("/api/check-session/test_team_002")
        assert response.status_code == 200
        data = response.json()
        assert data["has_session"] is True

    def test_check_nonexistent_session(self, client):
        """Test checking for a session that doesn't exist."""
        response = client.get("/api/check-session/nonexistent_team_xyz")
        assert response.status_code == 200
        data = response.json()
        assert data["has_session"] is False


class TestLeaderboardEndpoints:
    """Tests for leaderboard endpoints."""

    def test_get_leaderboard(self, client):
        """Test retrieving the leaderboard."""
        response = client.get("/api/leaderboard")
        assert response.status_code == 200
        data = response.json()
        assert "entries" in data
        assert "total_teams" in data
        assert "updated_at" in data
        assert isinstance(data["entries"], list)


class TestPhaseEndpoints:
    """Tests for phase-related endpoints."""

    def test_start_phase(self, client):
        """Test starting a phase."""
        # First create a session
        init_response = client.post("/api/init", json={
            "team_id": "test_team_phase_001"
        })
        session_id = init_response.json()["session_id"]

        # Start phase 1
        response = client.post("/api/start-phase", json={
            "session_id": session_id,
            "phase_number": 1
        })
        assert response.status_code == 200
        data = response.json()
        assert "phase_id" in data
        assert "phase_name" in data
        assert "questions" in data
        assert "time_limit_seconds" in data
        assert "started_at" in data

    def test_start_phase_invalid_session(self, client):
        """Test starting a phase with invalid session ID."""
        response = client.post("/api/start-phase", json={
            "session_id": "nonexistent_session_123",
            "phase_number": 1
        })
        assert response.status_code == 404

    def test_submit_phase_with_test_bypass(self, client):
        """Test submitting a phase using the test bypass."""
        # Create session and start phase
        init_response = client.post("/api/init", json={
            "team_id": "test_team_submit_001"
        })
        session_id = init_response.json()["session_id"]

        # Get phase 1 name
        phases = init_response.json()["phases"]
        phase_name = phases["1"]["name"]

        client.post("/api/start-phase", json={
            "session_id": session_id,
            "phase_number": 1
        })

        # Submit with "test" bypass
        response = client.post("/api/submit-phase", json={
            "session_id": session_id,
            "phase_name": phase_name,
            "responses": [
                {"q": "Q1", "a": "test"},
                {"q": "Q2", "a": "test"},
                {"q": "Q3", "a": "test"}
            ],
            "time_taken_seconds": 60
        })
        assert response.status_code == 200
        data = response.json()
        assert "passed" in data
        assert "ai_score" in data
        assert "phase_score" in data
        assert "feedback" in data
