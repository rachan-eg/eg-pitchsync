"""
Scoring Service Unit Tests
Tests for the scoring calculation logic.
"""

import pytest
from datetime import datetime, timedelta
from backend.services.scoring import (
    calculate_phase_score,
    calculate_total_score,
    determine_pass_threshold,
    get_score_tier
)


from backend.config import settings

class TestCalculatePhaseScore:
    """Tests for phase score calculation."""

    def test_perfect_score_calculation(self):
        """Test calculation with perfect AI score."""
        start_time = datetime.now()
        end_time = start_time + timedelta(minutes=2)  # Under time limit

        result = calculate_phase_score(
            ai_score=1.0,
            retries=0,
            start_time=start_time,
            end_time=end_time,
            token_count=300,  # Within optimal range
            phase_number=1,
            phase_def={"weight": 0.33, "time_limit_seconds": 300}
        )

        assert result["raw_score"] > 0
        assert result["weighted_score"] > 0
        assert "metrics" in result
        assert "breakdown" in result

    def test_failed_score_calculation(self):
        """Test calculation with zero AI score."""
        start_time = datetime.now()
        end_time = start_time + timedelta(minutes=2)

        result = calculate_phase_score(
            ai_score=0.0,
            retries=0,
            start_time=start_time,
            end_time=end_time,
            token_count=300,
            phase_number=1,
            phase_def={"weight": 0.33, "time_limit_seconds": 300}
        )

        # With 0 AI score, should get minimal points
        assert result["raw_score"] <= 0 or result["weighted_score"] == 0

    def test_retry_penalty_applied(self):
        """Test that retry penalty is applied correctly."""
        start_time = datetime.now()
        end_time = start_time + timedelta(minutes=2)

        result_no_retry = calculate_phase_score(
            ai_score=0.8,
            retries=0,
            start_time=start_time,
            end_time=end_time,
            token_count=300,
            phase_number=1,
            phase_def={"weight": 0.33, "time_limit_seconds": 300}
        )

        result_with_retry = calculate_phase_score(
            ai_score=0.8,
            retries=2,
            start_time=start_time,
            end_time=end_time,
            token_count=300,
            phase_number=1,
            phase_def={"weight": 0.33, "time_limit_seconds": 300}
        )

        if settings.RETRY_PENALTY_POINTS > 0:
            assert result_with_retry["raw_score"] < result_no_retry["raw_score"]
            assert result_with_retry["breakdown"]["retry_penalty"] > 0
        else:
            assert result_with_retry["raw_score"] <= result_no_retry["raw_score"]

    def test_time_penalty_applied(self):
        """Test that overtime penalty is applied."""
        start_time = datetime.now()
        end_time = start_time + timedelta(minutes=10)  # Over 5 min limit

        result = calculate_phase_score(
            ai_score=0.8,
            retries=0,
            start_time=start_time,
            end_time=end_time,
            token_count=300,
            phase_number=1,
            phase_def={"weight": 0.33, "time_limit_seconds": 300}
        )

        assert result["breakdown"]["time_penalty"] > 0

    def test_hint_penalty_applied(self):
        """Test that hint penalty is applied."""
        start_time = datetime.now()
        end_time = start_time + timedelta(minutes=2)

        result_no_hint = calculate_phase_score(
            ai_score=0.8,
            retries=0,
            start_time=start_time,
            end_time=end_time,
            token_count=300,
            phase_number=1,
            phase_def={"weight": 0.33, "time_limit_seconds": 300},
            hint_penalty=0
        )

        result_with_hint = calculate_phase_score(
            ai_score=0.8,
            retries=0,
            start_time=start_time,
            end_time=end_time,
            token_count=300,
            phase_number=1,
            phase_def={"weight": 0.33, "time_limit_seconds": 300},
            hint_penalty=100
        )

        assert result_with_hint["raw_score"] < result_no_hint["raw_score"]


class TestCalculateTotalScore:
    """Tests for total score calculation."""

    def test_empty_scores(self):
        """Test with no phase scores."""
        result = calculate_total_score({})
        assert result == 0.0

    def test_sum_of_scores(self):
        """Test that total is sum of phase scores."""
        phase_scores = {
            "Problem Definition": 200,
            "Solution Architecture": 300,
            "Market & Revenue": 400
        }
        result = calculate_total_score(phase_scores)
        assert result == 900.0

    def test_capped_at_1000(self):
        """Test that total is capped at 1000."""
        phase_scores = {
            "Phase1": 500,
            "Phase2": 500,
            "Phase3": 500  # Would sum to 1500
        }
        result = calculate_total_score(phase_scores)
        assert result == 1000.0


class TestPassThreshold:
    """Tests for pass/fail determination."""

    def test_pass_above_threshold(self):
        """Test passing with score above threshold."""
        assert determine_pass_threshold(0.70, 0) is True

    def test_fail_below_threshold(self):
        """Test failing with score below threshold."""
        assert determine_pass_threshold(0.50, 0) is False

    def test_mercy_rule(self):
        """Test mercy rule after multiple retries."""
        # Should fail normally
        assert determine_pass_threshold(0.50, 0) is False
        assert determine_pass_threshold(0.50, 1) is False

        # Should pass with mercy after 2+ retries
        assert determine_pass_threshold(0.50, 2) is True


class TestScoreTier:
    """Tests for score tier classification."""

    def test_s_tier(self):
        """Test S-tier classification."""
        assert get_score_tier(950) == "S-TIER"
        assert get_score_tier(900) == "S-TIER"

    def test_a_tier(self):
        """Test A-tier classification."""
        assert get_score_tier(850) == "A-TIER"
        assert get_score_tier(800) == "A-TIER"

    def test_b_tier(self):
        """Test B-tier classification."""
        assert get_score_tier(750) == "B-TIER"
        assert get_score_tier(700) == "B-TIER"

    def test_c_tier(self):
        """Test C-tier classification."""
        assert get_score_tier(600) == "C-TIER"
        assert get_score_tier(500) == "C-TIER"

    def test_d_tier(self):
        """Test D-TIER classification."""
        assert get_score_tier(400) == "D-TIER"
        assert get_score_tier(0) == "D-TIER"
