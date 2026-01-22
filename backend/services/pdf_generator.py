"""
Pitch-Sync PDF Report Generator
Premium HTML-to-PDF generation using xhtml2pdf - pure Python with no system dependencies.
"""

import logging
from pathlib import Path
from datetime import datetime
from typing import Optional, List, Dict, Any
import base64
from io import BytesIO

from xhtml2pdf import pisa

from backend.models.session import SessionState, PhaseStatus
from backend.models import get_phases_for_usecase
from backend.config import GENERATED_DIR, settings
from backend.services.state import get_leaderboard_sessions

# --- SVG LOGOS (from frontend branding) - simplified for xhtml2pdf compatibility ---
EG_LOGO_SVG = '''
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 500 506">
    <rect x="0" y="280" width="226" height="226" rx="22" fill="#ef0304"/>
    <rect x="274" y="0" width="226" height="226" rx="22" fill="#ef0304"/>
    <text x="90" y="180" font-size="180" font-family="Arial" font-weight="bold" fill="white">E</text>
    <text x="300" y="440" font-size="180" font-family="Arial" font-weight="bold" fill="white">G</text>
</svg>
'''


def clean_text(text: Optional[str]) -> str:
    """Escape HTML entities for safe rendering."""
    if not text:
        return ""
    text = str(text)
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    text = text.replace('"', "&quot;")
    return text


def format_duration(seconds: float) -> str:
    """Format duration in human-readable format."""
    mins, secs = divmod(int(seconds), 60)
    if mins > 0:
        return f"{mins}m {secs}s"
    return f"{secs}s"


class ReportGenerator:
    """HTML-to-PDF Report Generator with premium styling."""

    def __init__(self, session: SessionState):
        self.session = session
        self.team_id = session.team_id
        
        # Calculate category ranks
        self.category_ranks = self._calculate_category_ranks()
        self.podium_wins = self._get_podium_wins()

    def _calculate_category_ranks(self) -> Dict[str, Dict]:
        """Calculate rankings across all competition categories."""
        placements = {}
        try:
            best_sessions = get_leaderboard_sessions(limit=100)
            
            def get_rank(sorted_list):
                for i, s in enumerate(sorted_list):
                    if s.team_id == self.team_id:
                        return i + 1
                return None

            # 1. Elite Score
            elite = sorted([s for s in best_sessions if s.total_score > 0],
                           key=lambda x: (-x.total_score, x.total_tokens))
            r = get_rank(elite)
            placements["Elite Score"] = {"val": r, "str": f"#{r}" if r else "N/A", "desc": "Highest Overall Score"}

            # 2. No-Retry Legends
            legends = sorted([s for s in best_sessions
                              if sum(p.metrics.retries for p in s.phases.values()) == 0 and s.total_score > 0],
                             key=lambda x: (-x.total_score, x.total_tokens))
            is_legend = sum(p.metrics.retries for p in self.session.phases.values()) == 0
            if is_legend:
                r = get_rank(legends)
                placements["No-Retry Legends"] = {"val": r, "str": f"#{r}" if r else "N/A", "desc": "Perfect First Attempt"}
            else:
                placements["No-Retry Legends"] = {"val": None, "str": "N/A", "desc": "Perfect First Attempt"}

            # 3. Minimalist
            minimalist = sorted([s for s in best_sessions if s.is_complete],
                                key=lambda x: (x.total_tokens, -x.total_score))
            if self.session.is_complete:
                r = get_rank(minimalist)
                placements["Minimalist"] = {"val": r, "str": f"#{r}" if r else "N/A", "desc": "Lowest Token Usage"}
            else:
                placements["Minimalist"] = {"val": None, "str": "N/A", "desc": "Lowest Token Usage"}

            # 4. Strategic Speed
            def get_dur(sess):
                return sum(p.metrics.duration_seconds for p in sess.phases.values())
            blitz = sorted([s for s in best_sessions if s.is_complete],
                           key=lambda x: (get_dur(x), -x.total_score))
            if self.session.is_complete:
                r = get_rank(blitz)
                placements["Strategic Speed"] = {"val": r, "str": f"#{r}" if r else "N/A", "desc": "Fastest Completion"}
            else:
                placements["Strategic Speed"] = {"val": None, "str": "N/A", "desc": "Fastest Completion"}

            # 5. Phase Champions
            for p_num in [1, 2, 3]:
                def get_p_score(sess, idx):
                    try:
                        return list(sess.phases.values())[idx - 1].metrics.weighted_score
                    except:
                        return 0

                p_sorted = sorted([s for s in best_sessions if len(s.phases) >= p_num],
                                  key=lambda x: -get_p_score(x, p_num))

                if len(self.session.phases) >= p_num:
                    r = get_rank(p_sorted)
                    placements[f"Phase {p_num} Champion"] = {"val": r, "str": f"#{r}" if r else "N/A", "desc": f"Phase {p_num} Excellence"}
                else:
                    placements[f"Phase {p_num} Champion"] = {"val": None, "str": "N/A", "desc": f"Phase {p_num} Excellence"}

        except Exception as e:
            print(f"Rank calculation error: {e}")
            placements["Elite Score"] = {"val": None, "str": "N/A", "desc": "Highest Overall Score"}

        return placements

    def _get_podium_wins(self) -> List[Dict]:
        """Get only categories where team placed in top 3."""
        wins = []
        for cat, data in self.category_ranks.items():
            val = data.get('val')
            if val and val <= 3:
                wins.append({
                    "category": cat,
                    "rank": val,
                    "label": "GOLD" if val == 1 else "SILVER" if val == 2 else "BRONZE",
                    "desc": data.get("desc", "")
                })
        return wins

    def _get_tier(self, score: float) -> str:
        """Determine performance tier."""
        if score >= 900: return 'S'
        if score >= 800: return 'A'
        if score >= 700: return 'B'
        if score >= 500: return 'C'
        return 'D'

    def _get_tier_color(self, score: float) -> str:
        """Get color for tier."""
        tier = self._get_tier(score)
        colors = {'S': '#FFD700', 'A': '#22C55E', 'B': '#4078D9', 'C': '#F2A633', 'D': '#D94D4D'}
        return colors.get(tier, '#4078D9')

    def _generate_css(self) -> str:
        """Generate CSS styles compatible with xhtml2pdf."""
        return '''
        @page {
            size: A4;
            margin: 1.5cm 1.5cm 2cm 1.5cm;
            @frame footer {
                -pdf-frame-content: footerContent;
                bottom: 0.5cm;
                margin-left: 1.5cm;
                margin-right: 1.5cm;
                height: 1cm;
            }
        }
        
        body {
            font-family: Helvetica, Arial, sans-serif;
            font-size: 10pt;
            line-height: 1.4;
            color: #1a1a2e;
        }
        
        /* === HEADER === */
        .header {
            background-color: #0F1729;
            color: white;
            padding: 12px 15px;
            margin: -1.5cm -1.5cm 15px -1.5cm;
            border-bottom: 3px solid #4078D9;
        }
        
        .header-table {
            width: 100%;
        }
        
        .header-brand {
            font-size: 16pt;
            font-weight: bold;
            letter-spacing: 0.5px;
        }
        
        .header-subtitle {
            font-size: 8pt;
            color: #6690E6;
        }
        
        .header-right {
            text-align: right;
        }
        
        .header-powered {
            font-size: 7pt;
            color: #8a8a9e;
        }
        
        .header-coe {
            font-size: 11pt;
            font-weight: bold;
        }
        
        /* === TITLE SECTION === */
        .report-title {
            font-size: 20pt;
            font-weight: bold;
            color: #0F1729;
            margin-bottom: 3px;
        }
        
        .report-subtitle {
            font-size: 10pt;
            color: #5a5a6e;
            margin-bottom: 15px;
        }
        
        /* === SCORE CARD === */
        .score-card {
            background-color: #f8f9fb;
            border: 1px solid #e5e7eb;
            padding: 15px;
            margin-bottom: 15px;
        }
        
        .score-table {
            width: 100%;
            margin-bottom: 12px;
            border-bottom: 1px solid #e5e7eb;
            padding-bottom: 12px;
        }
        
        .score-value {
            font-size: 36pt;
            font-weight: bold;
            color: #4078D9;
            text-align: center;
        }
        
        .score-label {
            font-size: 8pt;
            color: #8a8a9e;
            text-transform: uppercase;
            letter-spacing: 1px;
            text-align: center;
        }
        
        .stats-table {
            width: 100%;
        }
        
        .stats-table td {
            text-align: center;
            padding: 8px 5px;
            background-color: #f0f2f5;
        }
        
        .stat-value {
            font-size: 14pt;
            font-weight: bold;
            color: #1a1a2e;
        }
        
        .stat-value-negative {
            font-size: 14pt;
            font-weight: bold;
            color: #D94D4D;
        }
        
        .stat-value-positive {
            font-size: 14pt;
            font-weight: bold;
            color: #2EBF80;
        }
        
        .stat-label {
            font-size: 7pt;
            color: #8a8a9e;
            text-transform: uppercase;
        }
        
        /* === SECTION HEADERS === */
        .section-header {
            font-size: 13pt;
            font-weight: bold;
            color: #0F1729;
            margin-top: 20px;
            margin-bottom: 10px;
            padding-bottom: 5px;
            border-bottom: 2px solid #4078D9;
        }
        
        /* === ACHIEVEMENTS === */
        .achievement-table {
            width: 100%;
            margin-bottom: 15px;
        }
        
        .achievement-card {
            text-align: center;
            padding: 12px 8px;
            border: 2px solid;
        }
        
        .achievement-gold {
            background-color: #FFF9E6;
            border-color: #FFD700;
        }
        
        .achievement-silver {
            background-color: #F5F5F5;
            border-color: #C0C0C0;
        }
        
        .achievement-bronze {
            background-color: #FDF4E8;
            border-color: #CD7F32;
        }
        
        .achievement-medal {
            font-size: 18pt;
            font-weight: bold;
        }
        
        .medal-gold { color: #FFD700; }
        .medal-silver { color: #A0A0A0; }
        .medal-bronze { color: #CD7F32; }
        
        .achievement-rank {
            font-size: 11pt;
            font-weight: bold;
            margin: 3px 0;
        }
        
        .achievement-category {
            font-size: 8pt;
            color: #5a5a6e;
        }
        
        /* === PHASE CARDS === */
        .phase-card {
            background-color: #ffffff;
            border: 1px solid #e5e7eb;
            margin-bottom: 12px;
            page-break-inside: avoid;
        }
        
        .phase-header {
            background-color: #f8f9fb;
            padding: 10px 12px;
            border-bottom: 1px solid #e5e7eb;
        }
        
        .phase-header-table {
            width: 100%;
        }
        
        .phase-title {
            font-size: 12pt;
            font-weight: bold;
            color: #0F1729;
        }
        
        .phase-status {
            font-size: 9pt;
            font-weight: bold;
            padding: 3px 10px;
            text-align: right;
        }
        
        .status-passed {
            color: #2EBF80;
        }
        
        .status-failed {
            color: #D94D4D;
        }
        
        .phase-body {
            padding: 12px;
        }
        
        .breakdown-table {
            width: 100%;
            background-color: #f8f9fb;
            margin-bottom: 10px;
        }
        
        .breakdown-table td {
            text-align: center;
            padding: 8px 5px;
        }
        
        .breakdown-value {
            font-size: 13pt;
            font-weight: bold;
        }
        
        .breakdown-label {
            font-size: 7pt;
            color: #8a8a9e;
            text-transform: uppercase;
        }
        
        .penalty-detail {
            font-size: 8pt;
            color: #8a8a9e;
            margin-bottom: 10px;
            padding: 5px 8px;
            background-color: #FEF3E2;
            border-left: 3px solid #F2A633;
        }
        
        /* === Q&A === */
        .qa-label {
            font-size: 9pt;
            font-weight: bold;
            color: #4078D9;
            margin-bottom: 6px;
        }
        
        .qa-item {
            margin-bottom: 8px;
            padding-left: 8px;
            border-left: 2px solid #e5e7eb;
        }
        
        .qa-question {
            font-size: 9pt;
            font-weight: bold;
            color: #5a5a6e;
            margin-bottom: 2px;
        }
        
        .qa-answer {
            font-size: 9pt;
            color: #1a1a2e;
            padding-left: 8px;
        }
        
        .hint-badge {
            font-size: 7pt;
            background-color: #F2A633;
            color: white;
            padding: 1px 5px;
        }
        
        /* === FEEDBACK === */
        .feedback-box {
            margin-top: 10px;
            padding: 10px;
            background-color: #F0F4FF;
            border-left: 3px solid #4078D9;
        }
        
        .feedback-label {
            font-size: 9pt;
            font-weight: bold;
            color: #4078D9;
            margin-bottom: 4px;
        }
        
        .feedback-text {
            font-size: 9pt;
            color: #1a1a2e;
            line-height: 1.4;
        }
        
        .list-item {
            font-size: 8pt;
            margin-bottom: 2px;
        }
        
        .list-success { color: #2EBF80; }
        .list-muted { color: #5a5a6e; }
        
        /* === HISTORY TABLE === */
        .history-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 8pt;
            margin-top: 8px;
        }
        
        .history-table th {
            background-color: #f8f9fb;
            padding: 5px 6px;
            text-align: center;
            font-weight: bold;
            color: #5a5a6e;
            border-bottom: 2px solid #e5e7eb;
        }
        
        .history-table td {
            padding: 4px 6px;
            text-align: center;
            border-bottom: 1px solid #e5e7eb;
        }
        
        .history-final {
            background-color: #E8F8F0;
            font-weight: bold;
        }
        
        /* === VISUAL SECTION === */
        .visual-container {
            text-align: center;
            margin-bottom: 12px;
        }
        
        .visual-image {
            max-width: 100%;
            max-height: 300px;
            border: 1px solid #e5e7eb;
        }
        
        .visual-metrics-table {
            width: auto;
            margin: 10px auto;
        }
        
        .visual-metric {
            text-align: center;
            padding: 10px 20px;
            background-color: #f8f9fb;
            border: 1px solid #4078D9;
        }
        
        .visual-metric-value {
            font-size: 14pt;
            font-weight: bold;
            color: #4078D9;
        }
        
        .visual-metric-label {
            font-size: 8pt;
            color: #8a8a9e;
            text-transform: uppercase;
        }
        
        /* === FOOTER === */
        .footer {
            text-align: center;
            font-size: 7pt;
            color: #8a8a9e;
        }
        '''

    def _generate_html(self) -> str:
        """Generate the complete HTML report."""
        # Get data
        score = int(self.session.total_score)
        tier = self._get_tier(score)
        tier_color = self._get_tier_color(score)
        
        phase_count = len(self.session.phases)
        total_retries = sum(p.metrics.retries for p in self.session.phases.values())
        total_hints = sum(sum(1 for r in p.responses if r.hint_used) for p in self.session.phases.values())
        total_dur = sum(p.metrics.duration_seconds for p in self.session.phases.values())
        total_penalties = sum(p.metrics.time_penalty + p.metrics.retry_penalty + p.metrics.hint_penalty for p in self.session.phases.values())
        total_bonus = sum(p.metrics.efficiency_bonus for p in self.session.phases.values())
        
        usecase_id = self.session.usecase.get('id', '')
        phase_config = get_phases_for_usecase(usecase_id)
        
        # Build HTML
        html = f'''<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Mission Report - {clean_text(self.team_id)}</title>
    <style>{self._generate_css()}</style>
</head>
<body>
    <!-- HEADER -->
    <div class="header">
        <table class="header-table">
            <tr>
                <td style="width: 60%;">
                    <span class="header-brand">EG | PITCH-SYNC</span><br/>
                    <span class="header-subtitle">Intelligent Proposal Analysis</span>
                </td>
                <td class="header-right" style="width: 40%;">
                    <span class="header-powered">Powered by</span><br/>
                    <span class="header-coe">AI COE</span>
                </td>
            </tr>
        </table>
    </div>
    
    <!-- TITLE -->
    <div class="report-title">Mission Report: {clean_text(self.team_id)}</div>
    <div class="report-subtitle">{clean_text(self.session.usecase.get('domain', 'Business'))} Domain &bull; {clean_text(self.session.usecase.get('title', 'Strategic Challenge'))}</div>
    
    <!-- SCORE CARD -->
    <div class="score-card">
        <table class="score-table">
            <tr>
                <td style="width: 50%;">
                    <div class="score-value">{score}</div>
                    <div class="score-label">Pursuit Score</div>
                </td>
                <td style="width: 50%;">
                    <div class="score-value" style="color: {tier_color};">{tier}</div>
                    <div class="score-label">Performance Tier</div>
                </td>
            </tr>
        </table>
        <table class="stats-table">
            <tr>
                <td>
                    <div class="stat-value">{phase_count}</div>
                    <div class="stat-label">Phases</div>
                </td>
                <td>
                    <div class="stat-value">{total_retries + phase_count}</div>
                    <div class="stat-label">Attempts</div>
                </td>
                <td>
                    <div class="stat-value">{total_hints}</div>
                    <div class="stat-label">Hints</div>
                </td>
                <td>
                    <div class="stat-value">{format_duration(total_dur)}</div>
                    <div class="stat-label">Duration</div>
                </td>
                <td>
                    <div class="stat-value-negative">-{int(total_penalties)}</div>
                    <div class="stat-label">Penalties</div>
                </td>
                <td>
                    <div class="stat-value-positive">+{int(total_bonus)}</div>
                    <div class="stat-label">Bonus</div>
                </td>
            </tr>
        </table>
    </div>
'''
        
        # Achievements section (only if podium wins)
        if self.podium_wins:
            html += '''
    <div class="section-header">Podium Achievements</div>
    <table class="achievement-table">
        <tr>
'''
            for win in self.podium_wins[:3]:  # Max 3 per row
                rank = win['rank']
                medal_class = 'gold' if rank == 1 else 'silver' if rank == 2 else 'bronze'
                medal_symbol = '1ST' if rank == 1 else '2ND' if rank == 2 else '3RD'
                html += f'''
            <td class="achievement-card achievement-{medal_class}" style="width: 33%;">
                <div class="achievement-medal medal-{medal_class}">[{medal_symbol}]</div>
                <div class="achievement-rank">{win['label']}</div>
                <div class="achievement-category">{clean_text(win['category'])}</div>
            </td>
'''
            html += '''
        </tr>
    </table>
'''
            # Second row if more than 3
            if len(self.podium_wins) > 3:
                html += '''
    <table class="achievement-table">
        <tr>
'''
                for win in self.podium_wins[3:6]:
                    rank = win['rank']
                    medal_class = 'gold' if rank == 1 else 'silver' if rank == 2 else 'bronze'
                    medal_symbol = '1ST' if rank == 1 else '2ND' if rank == 2 else '3RD'
                    html += f'''
            <td class="achievement-card achievement-{medal_class}" style="width: 33%;">
                <div class="achievement-medal medal-{medal_class}">[{medal_symbol}]</div>
                <div class="achievement-rank">{win['label']}</div>
                <div class="achievement-category">{clean_text(win['category'])}</div>
            </td>
'''
                html += '''
        </tr>
    </table>
'''
        
        # Phase Details
        html += '''
    <div class="section-header">Tactical Phase Analysis</div>
'''
        
        for phase_idx, (phase_name, phase_data) in enumerate(self.session.phases.items()):
            p_idx = next((idx for idx, d in phase_config.items() if d['name'] == phase_name), phase_idx)
            p_def = phase_config.get(p_idx, {})
            weight = p_def.get('weight', 0.33)
            max_points = int(1000 * weight)
            
            status_class = 'status-passed' if phase_data.status == PhaseStatus.PASSED else 'status-failed'
            status_text = 'CLEARED' if phase_data.status == PhaseStatus.PASSED else 'INCOMPLETE'
            
            metrics = phase_data.metrics
            base_score = int(metrics.ai_score * 1000 * weight)
            penalties = int(metrics.time_penalty + metrics.retry_penalty + metrics.hint_penalty)
            bonus = int(metrics.efficiency_bonus)
            final_score = int(metrics.weighted_score)
            
            html += f'''
    <div class="phase-card">
        <div class="phase-header">
            <table class="phase-header-table">
                <tr>
                    <td class="phase-title">{clean_text(phase_name)}</td>
                    <td class="phase-status {status_class}">{status_text}</td>
                </tr>
            </table>
        </div>
        <div class="phase-body">
            <table class="breakdown-table">
                <tr>
                    <td>
                        <div class="breakdown-value">{base_score}</div>
                        <div class="breakdown-label">Base Score</div>
                    </td>
                    <td>
                        <div class="breakdown-value" style="color: #D94D4D;">-{penalties}</div>
                        <div class="breakdown-label">Penalties</div>
                    </td>
                    <td>
                        <div class="breakdown-value" style="color: #2EBF80;">+{bonus}</div>
                        <div class="breakdown-label">Bonus</div>
                    </td>
                    <td>
                        <div class="breakdown-value" style="color: #4078D9;">{final_score}/{max_points}</div>
                        <div class="breakdown-label">Final</div>
                    </td>
                </tr>
            </table>
'''
            
            # Penalty details
            penalty_parts = []
            if metrics.retry_penalty > 0:
                penalty_parts.append(f"Retry: -{int(metrics.retry_penalty)}")
            if metrics.time_penalty > 0:
                penalty_parts.append(f"Time: -{int(metrics.time_penalty)}")
            if metrics.hint_penalty > 0:
                penalty_parts.append(f"Hints: -{int(metrics.hint_penalty)}")
            
            if penalty_parts:
                html += f'''
            <div class="penalty-detail">
                Penalty Breakdown: {' | '.join(penalty_parts)}
            </div>
'''
            
            # Q&A Responses
            if phase_data.responses:
                html += '''
            <div class="qa-label">Submission Details</div>
'''
                for q_idx, response in enumerate(phase_data.responses):
                    hint_html = ' <span class="hint-badge">HINT</span>' if response.hint_used else ''
                    answer = clean_text(response.a) if response.a else '<em>No response</em>'
                    html += f'''
            <div class="qa-item">
                <div class="qa-question">Q{q_idx + 1}: {clean_text(response.q)}{hint_html}</div>
                <div class="qa-answer">{answer}</div>
            </div>
'''
            
            # AI Feedback
            if phase_data.feedback or phase_data.rationale:
                feedback_text = clean_text(phase_data.rationale or phase_data.feedback or "No detailed feedback.")
                html += f'''
            <div class="feedback-box">
                <div class="feedback-label">Intelligence Analysis</div>
                <div class="feedback-text">{feedback_text}</div>
'''
                
                if phase_data.strengths:
                    for strength in phase_data.strengths[:3]:
                        html += f'<div class="list-item list-success">&#10003; {clean_text(strength)}</div>\n'
                
                if phase_data.improvements:
                    for improvement in phase_data.improvements[:3]:
                        html += f'<div class="list-item list-muted">&bull; {clean_text(improvement)}</div>\n'
                
                html += '            </div>\n'
            
            # Attempt History
            if phase_data.history:
                html += '''
            <table class="history-table">
                <tr>
                    <th>#</th>
                    <th>AI Score</th>
                    <th>Time</th>
                    <th>Retry Pen</th>
                    <th>Time Pen</th>
                    <th>Hint Pen</th>
                </tr>
'''
                for i, h in enumerate(phase_data.history):
                    html += f'''
                <tr>
                    <td>{i + 1}</td>
                    <td>{int(h.ai_score * 100)}%</td>
                    <td>{int(h.duration_seconds)}s</td>
                    <td>-{int(h.retry_penalty)}</td>
                    <td>-{int(h.time_penalty)}</td>
                    <td>-{int(h.hint_penalty)}</td>
                </tr>
'''
                # Final attempt
                curr = phase_data.metrics
                html += f'''
                <tr class="history-final">
                    <td>{len(phase_data.history) + 1} *</td>
                    <td>{int(curr.ai_score * 100)}%</td>
                    <td>{int(curr.duration_seconds)}s</td>
                    <td>-{int(curr.retry_penalty)}</td>
                    <td>-{int(curr.time_penalty)}</td>
                    <td>-{int(curr.hint_penalty)}</td>
                </tr>
            </table>
'''
            
            html += '''
        </div>
    </div>
'''
        
        # Visual Section
        if self.session.final_output.image_url:
            img_name = self.session.final_output.image_url.split('/')[-1]
            img_path = GENERATED_DIR / img_name
            
            if img_path.exists():
                try:
                    with open(img_path, 'rb') as f:
                        img_bytes = f.read()
                        img_b64 = base64.b64encode(img_bytes).decode('utf-8')
                        img_data = f'data:image/png;base64,{img_b64}'
                    
                    html += f'''
    <pdf:nextpage />
    <div class="section-header">Visual Synthesis</div>
    <div class="visual-container">
        <img src="{img_data}" class="visual-image" />
    </div>
    <table class="visual-metrics-table">
        <tr>
            <td class="visual-metric">
                <div class="visual-metric-value">{clean_text(self.session.final_output.visual_alignment or 'N/A')}</div>
                <div class="visual-metric-label">Alignment Tier</div>
            </td>
            <td class="visual-metric">
                <div class="visual-metric-value">{int(self.session.final_output.visual_score * 100)}%</div>
                <div class="visual-metric-label">Match Score</div>
            </td>
        </tr>
    </table>
'''
                    if self.session.final_output.visual_feedback:
                        html += f'''
    <div class="feedback-box">
        <div class="feedback-label">Visual Analysis</div>
        <div class="feedback-text">{clean_text(self.session.final_output.visual_feedback)}</div>
    </div>
'''
                except Exception as e:
                    print(f"Error loading image: {e}")
        
        # Footer content for @frame
        html += f'''
    <div id="footerContent" class="footer">
        Mission Report &bull; Generated {datetime.now().strftime('%d %b %Y, %H:%M')} &bull; Confidential
    </div>
</body>
</html>
'''
        return html

    def generate(self) -> Path:
        """Generate the PDF report."""
        reports_dir = settings.BACKEND_DIR / "vault" / "reports"
        reports_dir.mkdir(parents=True, exist_ok=True)

        filename = f"Report_{self.team_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        output_path = reports_dir / filename

        # Generate HTML
        html_content = self._generate_html()
        
        # Convert to PDF
        with open(output_path, "wb") as pdf_file:
            pisa_status = pisa.CreatePDF(html_content, dest=pdf_file)
        
        if pisa_status.err:
            raise Exception(f"PDF generation failed with {pisa_status.err} errors")

        return output_path


def generate_report(session: SessionState) -> Path:
    """Main entry point for report generation."""
    generator = ReportGenerator(session)
    return generator.generate()
