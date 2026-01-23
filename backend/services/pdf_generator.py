"""
Pitch-Sync PDF Report Generator
Dark Theme Edition - Matching Website Aesthetic with Poppins Support
Version 4.1 - Premium Dark Mode Design
"""

import logging
import re
import io
from pathlib import Path
from datetime import datetime
from typing import Optional, List, Dict, Any, Tuple
import base64
from io import BytesIO
from PIL import Image as PILImage

from reportlab.graphics import renderPDF
from svglib.svglib import svg2rlg

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm, mm, inch
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    PageTemplate,
    Frame,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    Image,
    PageBreak,
    KeepTogether,
    NextPageTemplate,
    HRFlowable,
    CondPageBreak,
)
from reportlab.pdfgen import canvas
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY

from backend.models.session import SessionState, PhaseStatus
from backend.models import get_phases_for_usecase
from backend.config import GENERATED_DIR, settings

# =============================================================================
# WEBSITE THEME COLORS (Dark Mode) - Solid Unified Tone
# =============================================================================
BG_DARK = colors.HexColor("#050508")
BG_CARD = colors.HexColor("#050508")  # Same as BG_DARK for unified tone
BG_PANEL = colors.HexColor("#050508") # Same as BG_DARK

PRIMARY = colors.HexColor("#a78bfa")
SECONDARY = colors.HexColor("#3b82f6")
ACCENT = colors.HexColor("#f472b6")

EG_NAVY = colors.HexColor("#050508")  # Unified with background
EG_RED = colors.HexColor("#EF0304")

SUCCESS = colors.HexColor("#10b981")
WARNING = colors.HexColor("#f59e0b")
DANGER = colors.HexColor("#ef4444")
INFO = colors.HexColor("#3b82f6")

TEXT_PRIMARY = colors.HexColor("#f8fafc")
TEXT_SECONDARY = colors.HexColor("#cbd5e1")
TEXT_DIM = colors.HexColor("#94a3b8")
TEXT_MUTED = colors.HexColor("#64748b")

BORDER_LIGHT = colors.HexColor("#1e293b")

TIER_S = colors.HexColor("#FFD700")
TIER_A = colors.HexColor("#10B981")
TIER_B = colors.HexColor("#3B82F6")
TIER_C = colors.HexColor("#F59E0B")
TIER_D = colors.HexColor("#EF4444")

PAGE_WIDTH, PAGE_HEIGHT = A4
MARGIN = 2 * cm
TEXT_WIDTH = PAGE_WIDTH - 2 * MARGIN

LOGO_PATH = settings.BACKEND_DIR / "vault" / "construction_ai_deviation" / "logo" / "EGDK logo.png"
FONTS_DIR = settings.BACKEND_DIR / "assets" / "fonts"

# Pitch-Sync "Flipping" Logo SVG Data (Back side from Branding.tsx)
PITCH_SYNC_LOGO_SVG = """
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <path transform="translate(80.969 37.867)" d="m0 0c1.2104-0.0012891 2.4209-0.0025781 3.668-0.0039062 1.2749 0.0038672 2.5498 0.0077344 3.8633 0.011719 1.9123-0.0058008 1.9123-0.0058008 3.8633-0.011719 1.8156 0.0019336 1.8156 0.0019336 3.668 0.0039062 1.1196 0.0011279 2.2391 0.0022559 3.3926 0.003418 2.5762 0.12939 2.5762 0.12939 3.5762 1.1294 0.094137 2.0556 0.11743 4.1144 0.11353 6.1721 1.4603e-4 0.64388 2.9205e-4 1.2878 4.4251e-4 1.9512-6.9905e-4 2.1373-0.008491 4.2746-0.016312 6.4119-0.0018642 1.4783-0.0032881 2.9566-0.0042877 4.4349-0.0038249 3.8979-0.013655 7.7958-0.024704 11.694-0.010215 3.9747-0.014794 7.9494-0.019836 11.924-0.010737 7.8041-0.027813 15.608-0.048828 23.412-3.9693 0.024659-7.9386 0.04284-11.908 0.054932-1.3512 0.0050389-2.7025 0.01187-4.0537 0.020508-1.9385 0.012085-3.8771 0.017259-5.8157 0.022217-1.7517 0.0078552-1.7517 0.0078552-3.5388 0.015869-2.6838-0.11353-2.6838-0.11353-3.6838-1.1135-0.099351-2.0195-0.128-4.0425-0.12939-6.0645-0.0031522-1.298-0.0063043-2.5961-0.009552-3.9335 0.0017898-1.4278 0.0038407-2.8556 0.006134-4.2833-6.7308e-4 -1.4535-0.0016431-2.907-0.0028992-4.3605-0.0014768-3.0499 6.7697e-4 -6.0998 0.0053406-9.1498 0.0056973-3.9178 0.0024182-7.8355-0.0035725-11.753-0.0036061-3.0025-0.0024668-6.0049 1.2779e-4 -9.0074 6.6913e-4 -1.445-1.5865e-4 -2.8899-0.0024796-4.3349-0.0025273-2.0161 0.0020048-4.0323 0.0069008-6.0484 7.9559e-4 -1.1495 0.0015912-2.299 0.0024109-3.4833 0.23758-4.8293 2.8528-3.7097 7.0957-3.714z" fill="#EF0203" />
    <path transform="translate(7.4062 73.867)" d="m0 0c1.3007-0.0012891 2.6013-0.0025781 3.9414-0.0039062 1.0212 0.0031421 1.0212 0.0031421 2.063 0.0063477 2.0806 0.0053487 4.1611 5.429e-5 6.2417-0.0063477 1.951 0.0019336 1.951 0.0019336 3.9414 0.0039062 1.2033 0.0011279 2.4067 0.0022559 3.6465 0.003418 2.7598 0.12939 2.7598 0.12939 3.7598 1.1294 0.10003 2.1335 0.13081 4.2704 0.13281 6.4062 0.0012891 1.3007 0.0025781 2.6013 0.0039062 3.9414-0.0031421 1.0212-0.0031421 1.0212-0.0063477 2.063-0.0053487 2.0806-5.429e-5 4.1611 0.0063477 6.2417-0.0012891 1.3007-0.0025781 2.6013-0.0039062 3.9414-0.0011279 1.2033-0.0022559 2.4067-0.003418 3.6465-0.12939 2.7598-0.12939 2.7598-1.1294 3.7598-2.2186 0.087835-4.4399 0.10695-6.6602 0.097656-0.9967-0.0021224-0.9967-0.0021224-2.0135-0.0042877-2.1296-0.0056134-4.2592-0.018168-6.3888-0.030869-1.4408-0.0050133-2.8815-0.0095765-4.3223-0.013672-3.5384-0.011047-7.0768-0.02832-10.615-0.048828-0.024656-4.2541-0.042839-8.5083-0.054932-12.762-0.0050394-1.4482-0.011871-2.8965-0.020508-4.3447-0.012083-2.0776-0.017793-4.1551-0.022217-6.2327-0.0052368-1.2516-0.010474-2.5032-0.015869-3.7927 0.20749-5.2409 2.8801-3.9959 7.5198-4.0002z" fill="#EF0203" />
    <path transform="translate(36,38)" d="m0 0c3.9693-0.024659 7.9386-0.04284 11.908-0.054932 1.3512-0.0050389 2.7025-0.01187 4.0537-0.020508 1.9385-0.012085 3.8771-0.017259 5.8157-0.022217 1.7517-0.0078552 1.7517-0.0078552 3.5388-0.015869 2.6838 0.11353 2.6838 0.11353 3.6838 1.1135 0.099831 1.9876 0.13081 3.9787 0.13281 5.9688 0.0019336 1.8156 0.0019336 1.8156 0.0039062 3.668-0.0038672 1.2749-0.0077344 2.5498-0.011719 3.8633 0.0058008 1.9123 0.0058008 1.9123 0.011719 3.8633-0.0012891 1.2104-0.0025781 2.4209-0.0039062 3.668-0.0011279 1.1196-0.0022559 2.2391-0.003418 3.3926-0.12939 2.5762-0.12939 2.5762-1.1294 3.5762-2.0726 0.087671-4.1482 0.10696-6.2227 0.097656-1.2601-0.0032227-2.5201-0.0064453-3.8184-0.0097656-1.3405-0.0083566-2.681-0.016822-4.0215-0.025391-1.3444-0.0050134-2.6888-0.0095766-4.0332-0.013672-3.3015-0.011833-6.6029-0.028318-9.9043-0.048828-1.32-2.64-1.1296-4.6408-1.1328-7.5938-0.0019336-1.6687-0.0019336-1.6687-0.0039062-3.3711 0.0038672-1.1666 0.0077344-2.3332 0.011719-3.5352-0.0038672-1.1666-0.0077344-2.3332-0.011719-3.5352 0.0012891-1.1125 0.0025781-2.2249 0.0039062-3.3711 0.0016919-1.5362 0.0016919-1.5362 0.003418-3.1035 0.12939-2.4902 0.12939-2.4902 1.1294-4.4902z" fill="#EE0303" />
    <path transform="translate(77.684 -.11353)" d="m0 0c1.1678 0.0052368 2.3356 0.010474 3.5388 0.015869 1.2601 0.0032227 2.5201 0.0064453 3.8184 0.0097656 1.3405 0.0083566 2.681 0.016822 4.0215 0.025391 1.3444 0.0050134 2.6888 0.0095766 4.0332 0.013672 3.3015 0.011833 6.6029 0.028318 9.9043 0.048828 0.024659 3.9693 0.04284 7.9386 0.054932 11.908 0.0050389 1.3512 0.01187 2.7025 0.020508 4.0537 0.012085 1.9385 0.017259 3.8771 0.022217 5.8157 0.0078552 1.7517 0.0078552 1.7517 0.015869 3.5388-0.11353 2.6838-0.11353 2.6838-1.1135 3.6838-1.9876 0.099831-3.9787 0.13081-5.9688 0.13281-1.2104 0.0012891-2.4209 0.0025781-3.668 0.0039062-1.2749-0.0038672-2.5498-0.0077344-3.8633-0.011719-1.2749 0.0038672-2.5498 0.0077344-3.8633 0.011719-1.8156-0.0019336-1.8156-0.0019336-3.668-0.0039062-1.1196-0.0011279-2.2391-0.0022559-3.3926-0.003418-2.5762-0.12939-2.5762-0.12939-3.5762-1.1294-0.099831-1.9876-0.13081-3.9787-0.13281-5.9688-0.0012891-1.2104-0.0025781-2.4209-0.0039062-3.668 0.0038672-1.2749 0.0077344-2.3332 0.011719-3.8633-0.0038672-1.2749-0.0077344-2.5498-0.011719-3.8633 0.0012891-1.2104 0.0025781-2.4209 0.0039062-3.668 0.0011279-1.1196 0.0022559-2.2391 0.003418-3.3926 0.17741-3.5322 0.26778-3.5397 3.8132-3.6897z" fill="#EF0303" />
</svg>
"""

# =============================================================================
# FONT CONFIGURATION
# =============================================================================
# Attempt to register Poppins if available, else fall back to Helvetica
HEADER_FONT = "Helvetica-Bold"
BODY_FONT = "Helvetica"
ITALIC_FONT = "Helvetica-Oblique"

def register_custom_fonts():
    """Register Poppins fonts if available."""
    global HEADER_FONT, BODY_FONT, ITALIC_FONT
    
    try:
        if not FONTS_DIR.exists():
            return

        poppins_reg = FONTS_DIR / "Poppins-Regular.ttf"
        poppins_bold = FONTS_DIR / "Poppins-Bold.ttf"
        poppins_italic = FONTS_DIR / "Poppins-Italic.ttf"

        if poppins_reg.exists() and poppins_bold.exists():
            pdfmetrics.registerFont(TTFont('Poppins', str(poppins_reg)))
            pdfmetrics.registerFont(TTFont('Poppins-Bold', str(poppins_bold)))
            if poppins_italic.exists():
                pdfmetrics.registerFont(TTFont('Poppins-Italic', str(poppins_italic)))
            
            HEADER_FONT = "Poppins-Bold"
            BODY_FONT = "Poppins"
            ITALIC_FONT = "Poppins-Italic" if poppins_italic.exists() else "Poppins"
            logging.info("Successfully registered Poppins fonts.")
            
    except Exception as e:
        logging.warning(f"Failed to register custom fonts: {e}")

# Register fonts on module load
if "Poppins" not in pdfmetrics.getRegisteredFontNames():
    register_custom_fonts()


def clean_text(text: Optional[str]) -> str:
    """Sanitize text for ReportLab XML compatibility."""
    if not text:
        return ""
    text = str(text)
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    text = text.replace('"', "&quot;")
    text = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', text)
    text = re.sub(r'\*(.*?)\*', r'<i>\1</i>', text)
    text = text.replace('\n', '<br/>')
    return text


def format_duration(seconds: float) -> str:
    mins, secs = divmod(int(seconds), 60)
    hours, mins = divmod(mins, 60)
    if hours > 0:
        return f"{hours}h {mins}m {secs}s"
    if mins > 0:
        return f"{mins}m {secs}s"
    return f"{secs}s"


class DarkThemeReportGenerator:
    """Updated Dark Theme Generator with Font Support - Now Fully Dynamic"""
    
    def __init__(self, session: SessionState):
        self.session = session
        self.team_id = session.team_id
        
        # Load Dynamic Colors from Session Theme
        theme = session.theme_palette or {}
        theme_colors = theme.get('colors', {})
        
        self.primary_color = colors.HexColor(theme_colors.get('primary', "#a78bfa"))
        self.secondary_color = colors.HexColor(theme_colors.get('secondary', "#3b82f6"))
        self.accent_color = colors.HexColor(theme_colors.get('accent', "#f472b6"))
        self.bg_color = colors.HexColor(theme_colors.get('bg_pdf', "#050508")) if 'bg_pdf' in theme_colors else BG_DARK
        
        # Dynamic Logo Discovery
        self.logo_path = self._discover_logo()
        
        self.styles = self._create_styles()
        self.section_counter = 0
        self.subsection_counter = 0
        self.figure_counter = 0
        self.table_counter = 0
        self._cached_svg_drawing = None

    def _get_compressed_image(self, img_path: Path, max_dim: int = 800) -> Optional[BytesIO]:
        """Downscale and compress image for PDF to save space and time."""
        try:
            with PILImage.open(img_path) as img:
                # Convert to RGB (removes alpha channel, saves space)
                if img.mode != "RGB":
                    img = img.convert("RGB")
                
                # Resize if too large
                w, h = img.size
                if max(w, h) > max_dim:
                    scale = max_dim / float(max(w, h))
                    img = img.resize((int(w * scale), int(h * scale)), PILImage.LANCZOS)
                
                output = BytesIO()
                # Use low quality (good enough for report reading)
                img.save(output, format="JPEG", quality=60, optimize=True)
                output.seek(0)
                return output
        except Exception as e:
            logging.warning(f"Failed to compress image {img_path}: {e}")
            return None

    def _discover_logo(self) -> Optional[Path]:
        """Find the best logo for this usecase."""
        usecase_id = self.session.usecase.get('id')
        if not usecase_id:
            return None
            
        logo_dir = settings.BACKEND_DIR / "vault" / usecase_id / "logo"
        if logo_dir.exists():
            # Try to find Sasha or specific logos first, then any PNG
            for pattern in ["EG-Sasha.png", "EGDK logo.png", "*.png", "*.jpg"]:
                for logo_file in logo_dir.glob(pattern):
                    return logo_file
        
        # Fallback to the global default if specific mission logo not found
        fallback = settings.BACKEND_DIR / "vault" / "construction_ai_deviation" / "logo" / "EGDK logo.png"
        return fallback if fallback.exists() else None

    def _get_tier_info(self, score: int) -> Tuple[str, str, colors.Color]:
        if score >= 900: return "S-TIER", "Exceptional", TIER_S
        elif score >= 800: return "A-TIER", "Strong", TIER_A
        elif score >= 700: return "B-TIER", "Good", TIER_B
        elif score >= 500: return "C-TIER", "Satisfactory", TIER_C
        else: return "D-TIER", "Needs Work", TIER_D

    def _create_styles(self) -> Dict[str, ParagraphStyle]:
        styles = {}
        
        styles["Display"] = ParagraphStyle(
            name="Display",
            fontName=HEADER_FONT,
            fontSize=32,
            leading=38,
            textColor=TEXT_PRIMARY,
            alignment=TA_CENTER
        )
        
        styles["DisplaySub"] = ParagraphStyle(
            name="DisplaySub",
            fontName=BODY_FONT,
            fontSize=14,
            leading=18,
            textColor=TEXT_DIM,
            alignment=TA_CENTER
        )
        
        styles["H1"] = ParagraphStyle(
            name="H1",
            fontName=HEADER_FONT,
            fontSize=18,
            leading=24,
            textColor=TEXT_PRIMARY,
            spaceBefore=16,
            spaceAfter=10
        )
        
        styles["H2"] = ParagraphStyle(
            name="H2",
            fontName=HEADER_FONT,
            fontSize=14,
            leading=18,
            textColor=self.primary_color,
            spaceBefore=14,
            spaceAfter=8
        )
        
        styles["PhaseHeading"] = ParagraphStyle(
            name="PhaseHeading",
            fontName=HEADER_FONT,
            fontSize=15,
            leading=20,
            textColor=TEXT_PRIMARY,
            alignment=TA_CENTER,
            spaceBefore=5,
            spaceAfter=5,
            textTransform="uppercase"
        )
        
        styles["H3"] = ParagraphStyle(
            name="H3",
            fontName=HEADER_FONT,
            fontSize=11,
            leading=14,
            textColor=TEXT_SECONDARY,
            spaceBefore=10,
            spaceAfter=6
        )
        
        styles["Body"] = ParagraphStyle(
            name="Body",
            fontName=BODY_FONT,
            fontSize=10,
            leading=15,
            textColor=TEXT_SECONDARY,
            alignment=TA_JUSTIFY
        )
        
        styles["BodySmall"] = ParagraphStyle(
            name="BodySmall",
            fontName=BODY_FONT,
            fontSize=9,
            leading=12,
            textColor=TEXT_DIM
        )
        
        styles["Label"] = ParagraphStyle(
            name="Label",
            fontName=HEADER_FONT,
            fontSize=8,
            leading=10,
            textColor=TEXT_MUTED,
            textTransform="uppercase"
        )
        
        styles["Caption"] = ParagraphStyle(
            name="Caption",
            fontName=BODY_FONT,
            fontSize=9,
            leading=12,
            textColor=TEXT_DIM,
            alignment=TA_CENTER
        )
        
        styles["MetricLarge"] = ParagraphStyle(
            name="MetricLarge",
            fontName=HEADER_FONT,
            fontSize=36,
            leading=40,
            textColor=self.primary_color,
            alignment=TA_CENTER
        )
        
        styles["MetricMedium"] = ParagraphStyle(
            name="MetricMedium",
            fontName=HEADER_FONT,
            fontSize=20,
            leading=24,
            textColor=TEXT_PRIMARY,
            alignment=TA_CENTER
        )
        
        styles["TableHeader"] = ParagraphStyle(
            name="TableHeader",
            fontName=HEADER_FONT,
            fontSize=9,
            leading=12,
            textColor=TEXT_PRIMARY
        )
        
        styles["TableCell"] = ParagraphStyle(
            name="TableCell",
            fontName=BODY_FONT,
            fontSize=9,
            leading=12,
            textColor=TEXT_SECONDARY
        )
        
        styles["TableCellCenter"] = ParagraphStyle(
            name="TableCellCenter",
            fontName=BODY_FONT,
            fontSize=9,
            leading=12,
            textColor=TEXT_SECONDARY,
            alignment=TA_CENTER
        )
        
        styles["Quote"] = ParagraphStyle(
            name="Quote",
            fontName=ITALIC_FONT,
            fontSize=12,
            leading=16,
            textColor=self.primary_color,
            alignment=TA_CENTER,
            leftIndent=20,
            rightIndent=20
        )
        
        styles["ListItem"] = ParagraphStyle(
            name="ListItem",
            fontName=BODY_FONT,
            fontSize=10,
            leading=14,
            textColor=TEXT_SECONDARY,
            leftIndent=15,
            bulletIndent=8
        )
        
        return styles

    def _next_section(self, title: str) -> str:
        self.section_counter += 1
        self.subsection_counter = 0
        return title

    def _next_subsection(self, title: str) -> str:
        self.subsection_counter += 1
        return title

    def _next_figure(self) -> int:
        self.figure_counter += 1
        return self.figure_counter

    def _next_table(self) -> int:
        self.table_counter += 1
        return self.table_counter

    # =========================================================================
    # PAGE TEMPLATES
    # =========================================================================
    def _draw_dark_background(self, canvas):
        """Draw the solid single-toned dark background."""
        canvas.setFillColor(self.bg_color)
        canvas.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, fill=1, stroke=0)

    def _draw_header(self, canvas, doc):
        """Draw the dark header matching website navbar."""
        header_height = 1.8 * cm
        header_y = PAGE_HEIGHT - header_height
        
        canvas.setFillColor(EG_NAVY)
        canvas.rect(0, header_y, PAGE_WIDTH, header_height, fill=1, stroke=0)
        
        canvas.setFillColor(EG_RED)
        canvas.rect(0, header_y - 4, PAGE_WIDTH, 4, fill=1, stroke=0)
        
        logo_size = 0.8 * cm
        logo_x = MARGIN
        logo_y = header_y + (header_height - logo_size) / 2
        
        # 1. Draw EG Logo (PNG) on the LEFT
        logo_cursor_x = MARGIN
        if self.logo_path and self.logo_path.exists():
            try:
                canvas.drawImage(str(self.logo_path), logo_cursor_x, logo_y, width=logo_size, height=logo_size, mask='auto', preserveAspectRatio=True)
                logo_cursor_x += logo_size + 0.35*cm
            except Exception: pass

        # 2. Draw Pitch-Sync Branding Block on the LEFT (now following EG logo)
        h_font = HEADER_FONT if "Poppins" in HEADER_FONT else "Helvetica-Bold"
        b_font = BODY_FONT if "Poppins" in BODY_FONT else "Helvetica"
        
        try:
            # OPTIMIZATION: Cache the SVG drawing
            if not self._cached_svg_drawing:
                drawing = svg2rlg(io.BytesIO(PITCH_SYNC_LOGO_SVG.encode('utf-8')))
                sx = sy = logo_size / max(drawing.width, drawing.height)
                drawing.scale(sx, sy)
                self._cached_svg_drawing = drawing
            
            renderPDF.draw(self._cached_svg_drawing, canvas, logo_cursor_x, logo_y)
            
            text_x = logo_cursor_x + logo_size + 0.35*cm
            text_y_main = header_y + header_height/2 + 0.05*cm
            text_y_sub = header_y + header_height/2 - 0.30*cm
            
            canvas.setFillColor(self.primary_color)
            canvas.setFont(h_font, 12)
            canvas.drawString(text_x, text_y_main, "PITCH")
            
            pitch_w = canvas.stringWidth("PITCH", h_font, 12)
            canvas.setFillColor(TEXT_PRIMARY)
            canvas.drawString(text_x + pitch_w + 1, text_y_main, "-SYNC")
            
            canvas.setFillColor(TEXT_MUTED)
            canvas.setFont(b_font, 6)
            canvas.drawString(text_x, text_y_sub, "Powered By")
            
            pb_w = canvas.stringWidth("Powered By ", b_font, 6)
            canvas.setFillColor(TEXT_PRIMARY)
            canvas.setFont(h_font, 6)
            canvas.drawString(text_x + pb_w, text_y_sub, "AI COE")
            
        except Exception as e:
            logging.warning(f"Failed to render left branding block: {e}")

        # 3. Team Name Branding - CENTERED
        canvas.setFillColor(TEXT_PRIMARY)
        canvas.setFont(h_font, 14)
        team_display = clean_text(self.team_id)
        if not team_display.lower().startswith("team"):
            team_display = f"Team {team_display}"
        canvas.drawCentredString(PAGE_WIDTH / 2, header_y + header_height/2 - 0.2*cm, team_display)

    def _draw_footer(self, canvas, doc):
        footer_y = MARGIN - 0.3*cm
        b_font = BODY_FONT if "Poppins" in BODY_FONT else "Helvetica"
        h_font = HEADER_FONT if "Poppins" in HEADER_FONT else "Helvetica-Bold"
        
        canvas.setStrokeColor(BORDER_LIGHT)
        canvas.setLineWidth(1.5)
        canvas.line(MARGIN, footer_y + 0.4*cm, PAGE_WIDTH - MARGIN, footer_y + 0.4*cm)
        
        canvas.setFillColor(TEXT_MUTED)
        canvas.setFont(b_font, 9)
        canvas.drawCentredString(PAGE_WIDTH / 2, footer_y, str(doc.page))
        
        canvas.setFont(b_font, 7)
        canvas.drawString(MARGIN, footer_y, datetime.now().strftime("%d %b %Y"))

    def _draw_title_page(self, canvas, doc):
        self._draw_dark_background(canvas)
        self._draw_header(canvas, doc)

    def _draw_content_page(self, canvas, doc):
        self._draw_dark_background(canvas)
        self._draw_header(canvas, doc)
        self._draw_footer(canvas, doc)

    def _create_stat_metric(self, label: str, value: str, color: colors.Color = None) -> List:
        """Create a naked stat metric (no box)."""
        c = color or self.primary_color
        return [
            Paragraph(label, self.styles["Label"]),
            Spacer(1, 0.1*cm),
            Paragraph(f'<font color="{c.hexval()}">{value}</font>', self.styles["MetricMedium"])
        ]

    def _create_dark_table(self, data: List[List], col_widths: List[float], has_header: bool = True) -> Table:
        """Create a dark-themed table matching the background."""
        table = Table(data, colWidths=col_widths)
        
        style_commands = [
            ('BACKGROUND', (0, 0), (-1, -1), self.bg_color),
            ('TEXTCOLOR', (0, 0), (-1, -1), TEXT_SECONDARY),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
            ('LEFTPADDING', (0, 0), (-1, -1), 12),
            ('RIGHTPADDING', (0, 0), (-1, -1), 12),
            ('LINEBELOW', (0, -1), (-1, -1), 1, BORDER_LIGHT),
        ]
        
        if has_header and len(data) > 1:
            style_commands.append(('BACKGROUND', (0, 0), (-1, 0), self.bg_color))
            style_commands.append(('TEXTCOLOR', (0, 0), (-1, 0), TEXT_PRIMARY))
            style_commands.append(('LINEBELOW', (0, 0), (-1, 0), 1, BORDER_LIGHT))
        table.setStyle(TableStyle(style_commands))
        return table

    def _create_section_header(self, title: str) -> List:
        elements = []
        elements.append(Paragraph(title, self.styles["H1"]))
        line = HRFlowable(width="35%", thickness=4, color=self.primary_color, spaceBefore=0, spaceAfter=12, hAlign='LEFT')
        elements.append(line)
        return elements

    def generate(self, force: bool = False) -> Path:
        """
        Generate the dark-themed PDF report with caching and cleanup logic.
        Uses session_id for a stable filename to prevent duplicate/orphan files.
        """
        reports_dir = GENERATED_DIR / "reports"
        reports_dir.mkdir(parents=True, exist_ok=True)
        
        # 1. Define a stable, unique filename per session with team prefix for easy cleanup
        clean_team_id = re.sub(r'[^a-zA-Z0-9_\-]', '_', self.team_id)
        short_id = self.session.session_id[:8]
        filename = f"Report_{clean_team_id}_{short_id}.pdf"
        output_path = reports_dir / filename
        
        # OPTIMIZATION 1: Check if we can reuse an existing report for THIS session
        if not force and output_path.exists():
            try:
                # Compare file modification time with session updated_at
                file_mtime = datetime.fromtimestamp(output_path.stat().st_mtime, tz=timezone.utc)
                session_updated = self.session.updated_at
                
                # If session hasn't changed since the file was made, return existing
                if session_updated < file_mtime:
                    logging.info(f"♻️  Reusing existing report for session {short_id}")
                    return output_path
            except Exception as e:
                logging.warning(f"⚠️  Report caching check failed: {e}")

        # 3. HOUSEKEEPING: Cleanup OLD reports for this specific team from PREVIOUS sessions
        try:
            for old_report in reports_dir.glob(f"Report_{clean_team_id}_*.pdf"):
                # Only delete if it's a different session (different short_id)
                if old_report.name != filename:
                    try:
                        old_report.unlink()
                        logging.info(f"🗑️  Auto-cleaned orphan report: {old_report.name}")
                    except Exception: pass
        except Exception: pass

        logging.info(f"📝 Generating fresh report for session {short_id}")
        
        doc = BaseDocTemplate(
            str(output_path),
            pagesize=A4,
            title=f"Mission Report — {self.team_id}",
            author="EG Pitch-Sync | AI COE",
            pageCompression=1 # Enable PDF stream compression
        )
        
        title_frame = Frame(
            MARGIN, MARGIN + 1*cm,
            TEXT_WIDTH, PAGE_HEIGHT - 2*MARGIN - 2*cm,
            id='title', showBoundary=0,
            topPadding=1*cm
        )
        
        content_frame = Frame(
            MARGIN, MARGIN + 1*cm,
            TEXT_WIDTH, PAGE_HEIGHT - 2*MARGIN - 1.5*cm,
            id='content', showBoundary=0,
            topPadding=1*cm
        )
        
        doc.addPageTemplates([
            PageTemplate(id='Title', frames=title_frame, onPage=self._draw_title_page),
            PageTemplate(id='Content', frames=content_frame, onPage=self._draw_content_page)
        ])
        
        story = []
        
        # TITLE PAGE
        title_block = [
            Spacer(1, 4*cm),
            Paragraph(f'<font color="{TEXT_PRIMARY.hexval()}">{clean_text(self.team_id)}</font>', self.styles["Display"]),
            Spacer(1, 0.5*cm),
            Paragraph(clean_text(self.session.usecase.get("title", "Strategic Challenge")), self.styles["DisplaySub"]),
            Spacer(1, 2*cm)
        ]
        story.append(KeepTogether(title_block))
        
        score = int(self.session.total_score)
        tier, tier_desc, tier_color = self._get_tier_info(score)
        
        hero_data = [[
            [
                Paragraph("PURSUIT SCORE", self.styles["Label"]),
                Spacer(1, 0.2*cm),
                Paragraph(f'<font color="{self.primary_color.hexval()}" size="42">{score}</font>', self.styles["MetricLarge"])
            ],
            [
                Paragraph("PERFORMANCE TIER", self.styles["Label"]),
                Spacer(1, 0.2*cm),
                Paragraph(f'<font color="{tier_color.hexval()}" size="28">{tier}</font>', self.styles["MetricMedium"])
            ]
        ]]
        
        hero_table = Table(hero_data, colWidths=[8*cm, 8*cm])
        hero_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), BG_CARD),
            ('BOX', (0, 0), (-1, -1), 1, BORDER_LIGHT),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 20),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 20),
            ('LINEAFTER', (0, 0), (0, -1), 1, BORDER_LIGHT),
        ]))
        story.append(hero_table)
        
        story.append(NextPageTemplate('Content'))
        story.append(PageBreak())
        
        # EXECUTIVE SUMMARY
        header_block = self._create_section_header(self._next_section("Executive Summary"))
        story.append(KeepTogether(header_block))
        # Block: Naked Metrics Row
        phase_count = len(self.session.phases)
        total_retries = sum(p.metrics.retries for p in self.session.phases.values())
        total_dur = sum(p.metrics.duration_seconds for p in self.session.phases.values())
        total_tokens = self.session.total_tokens + self.session.extra_ai_tokens
        
        metrics_data = [[
            self._create_stat_metric("PHASES", str(phase_count), self.secondary_color),
            self._create_stat_metric("RETRIES", str(total_retries), WARNING),
            self._create_stat_metric("DURATION", format_duration(total_dur), INFO),
            self._create_stat_metric("TOKENS", f"{total_tokens:,}", self.primary_color)
        ]]
        
        metrics_row = Table(metrics_data, colWidths=[4.1*cm, 4.1*cm, 4.1*cm, 4.1*cm])
        metrics_row.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            # Vertical dividers between columns
            ('LINEAFTER', (0, 0), (0, 0), 0.5, BORDER_LIGHT),
            ('LINEAFTER', (1, 0), (1, 0), 0.5, BORDER_LIGHT),
            ('LINEAFTER', (2, 0), (2, 0), 0.5, BORDER_LIGHT),
            ('LEFTPADDING', (1, 0), (-1, 0), 12),
        ]))
        
        phases_passed = sum(1 for p in self.session.phases.values() if p.status == PhaseStatus.PASSED)
        overview_text = (
            f'Team achieved <font color="{self.primary_color.hexval()}"><b>{score}/1000</b></font> points, '
            f'completing <b>{phases_passed}/{phase_count}</b> phases successfully. '
            f'Performance tier: <font color="{tier_color.hexval()}"><b>{tier}</b></font> ({tier_desc}).'
        )
        
        # Phase Performance Summary Table - Expanded
        summary_table_data = [
            [
                Paragraph("<b>Phase / Niche</b>", self.styles["TableHeader"]), 
                Paragraph("<b>Time</b>", self.styles["TableHeader"]),
                Paragraph("<b>Retries</b>", self.styles["TableHeader"]),
                Paragraph("<b>Hints</b>", self.styles["TableHeader"]),
                Paragraph("<b>Score</b>", self.styles["TableHeader"])
            ]
        ]
        
        total_hints = 0
        phases_sorted = sorted(self.session.phases.items(), key=lambda x: x[0])
        for p_name, p_data in phases_sorted:
            p_hints = sum(1 for r in p_data.responses if r.hint_used)
            total_hints += p_hints
            
            summary_table_data.append([
                Paragraph(p_name, self.styles["TableCell"]),
                Paragraph(format_duration(p_data.metrics.duration_seconds), self.styles["TableCellCenter"]),
                Paragraph(str(p_data.metrics.retries), self.styles["TableCellCenter"]),
                Paragraph(str(p_hints), self.styles["TableCellCenter"]),
                Paragraph(f"{int(p_data.metrics.weighted_score)}", self.styles["TableCellCenter"])
            ])
            
        summary_table_data.append([
            Paragraph("<b>OVERALL TOTALS</b>", self.styles["TableCell"]),
            Paragraph(f"<b>{format_duration(total_dur)}</b>", self.styles["TableCellCenter"]),
            Paragraph(f"<b>{total_retries}</b>", self.styles["TableCellCenter"]),
            Paragraph(f"<b>{total_hints}</b>", self.styles["TableCellCenter"]),
            Paragraph(f"<b>{score}</b>", self.styles["TableCellCenter"])
        ])
        
        # Columns widths: [Name, Time, Retries, Hints, Score] totaling ~17cm
        perf_summary_table = self._create_dark_table(summary_table_data, [6.5*cm, 3*cm, 2.5*cm, 2.5*cm, 2.5*cm])
        
        summary_block = [
            Spacer(1, 0.5*cm),
            metrics_row,
            Spacer(1, 0.8*cm),
            Paragraph(overview_text, self.styles["Body"]),
            Spacer(1, 0.6*cm),
            Paragraph("Performance Summary", self.styles["H3"]),
            Spacer(1, 0.2*cm),
            perf_summary_table,
            Spacer(1, 0.5*cm)
        ]
        story.append(KeepTogether(summary_block))
        
        # PHASE ANALYSIS - Start on new page
        story.append(PageBreak())
        story.append(KeepTogether(self._create_section_header(self._next_section("Phase Analysis"))))
        
        # Use session's usecase ID to fetch the correct configuration for weights
        usecase_id = self.session.usecase.get("id", "")
        # Get phase config mapping: Name -> Config
        phases_repo = get_phases_for_usecase(usecase_id)
        phase_map = {d["name"]: d for d in phases_repo.values()}
        
        phases_sorted = sorted(self.session.phases.items(), key=lambda x: x[0])
        
        for i, (phase_name, phase_data) in enumerate(phases_sorted):
            if i > 0:
                story.append(PageBreak())
            
            # Phase Hero Heading - Centered Sub-header
            # Clean phase name to remove existing "Phase X:" prefix if present
            clean_phase_name = re.sub(r'^PHASE\s+\d+[:\s-]+', '', phase_name, flags=re.IGNORECASE).strip()
            p_title = f"PHASE {i+1}: {clean_phase_name}"
            story.append(Paragraph(p_title, self.styles["PhaseHeading"]))
            story.append(HRFlowable(width="100%", thickness=3, color=BORDER_LIGHT, spaceBefore=5, spaceAfter=20))

            # Chunk: Status Message
            phase_intro = []
            
            # Find weight properly from config
            config = phase_map.get(phase_name, {})
            weight = config.get("weight", 0.33)
            max_points = int(settings.AI_QUALITY_MAX_POINTS * weight)
            
            metrics = phase_data.metrics
            final_score = int(metrics.weighted_score)
            ai_pct = int(metrics.ai_score * 100)
            is_passed = phase_data.status == PhaseStatus.PASSED
            
            status_color = SUCCESS if is_passed else DANGER
            status_text = "CLEARED" if is_passed else "INCOMPLETE"
            
            status_line = (
                f'<font color="{status_color.hexval()}"><b>[{status_text}]</b></font> '
                f'Score: <b>{final_score}/{max_points}</b> pts | AI: <b>{ai_pct}%</b>'
            )
            phase_intro.append(Paragraph(status_line, self.styles["Body"]))
            phase_intro.append(Spacer(1, 0.3*cm))
            story.append(KeepTogether(phase_intro))
            
            # Chunk: Scoring Table (ALL components must be WEIGHTED to sum to final_score)
            table_block = []
            table_num = self._next_table()
            
            # Calculations
            w_base = round(metrics.ai_score * settings.AI_QUALITY_MAX_POINTS * weight)
            w_time = round(metrics.time_penalty * weight)
            w_retry = round(metrics.retry_penalty * weight)
            w_hint = round(metrics.hint_penalty * weight)
            w_bonus = round(metrics.efficiency_bonus * weight)
            
            scoring_data = [
                [Paragraph("Component", self.styles["TableHeader"]), Paragraph("Points", self.styles["TableHeader"])],
                [Paragraph("Base Performance", self.styles["TableCell"]), Paragraph(f"{w_base}", self.styles["TableCellCenter"])],
                [Paragraph("Time Adjustment", self.styles["TableCell"]), Paragraph(f'<font color="{DANGER.hexval()}">−{w_time}</font>', self.styles["TableCellCenter"])],
                [Paragraph("Retry Adjustment", self.styles["TableCell"]), Paragraph(f'<font color="{DANGER.hexval()}">−{w_retry}</font>', self.styles["TableCellCenter"])],
                [Paragraph("Hint Adjustment", self.styles["TableCell"]), Paragraph(f'<font color="{DANGER.hexval()}">−{w_hint}</font>', self.styles["TableCellCenter"])],
                [Paragraph("Efficiency Bonus", self.styles["TableCell"]), Paragraph(f'<font color="{SUCCESS.hexval()}">+{w_bonus}</font>', self.styles["TableCellCenter"])],
                [Paragraph("<b>Final Phase Score</b>", self.styles["TableCell"]), Paragraph(f"<b>{final_score}</b>", self.styles["TableCellCenter"])],
            ]
            score_table = self._create_dark_table(scoring_data, [5.5*cm, 3.5*cm])
            table_block.append(score_table)
            table_block.append(Paragraph(f"<i>Table {table_num}: {phase_name} breakdown</i>", self.styles["Caption"]))
            table_block.append(Spacer(1, 0.5*cm))
            story.append(KeepTogether(table_block))
            
            if phase_data.rationale or phase_data.feedback:
                feedback_block = []
                feedback_block.append(Paragraph("AI Feedback", self.styles["H3"]))
                feedback_block.append(Paragraph(clean_text(phase_data.rationale or phase_data.feedback), self.styles["Body"]))
                feedback_block.append(Spacer(1, 0.2*cm))
                story.append(KeepTogether(feedback_block))
            
            if phase_data.strengths:
                strength_block = []
                strength_block.append(Paragraph(f'<font color="{SUCCESS.hexval()}">Strengths</font>', self.styles["H3"]))
                for s in phase_data.strengths:
                    strength_block.append(Paragraph(f'<font color="{SUCCESS.hexval()}">✓</font> {clean_text(s)}', self.styles["ListItem"]))
                story.append(KeepTogether(strength_block))
            
            if phase_data.improvements:
                improv_block = []
                improv_block.append(Paragraph(f'<font color="{WARNING.hexval()}">Improvements</font>', self.styles["H3"]))
                for i in phase_data.improvements:
                    improv_block.append(Paragraph(f'<font color="{WARNING.hexval()}">→</font> {clean_text(i)}', self.styles["ListItem"]))
                story.append(KeepTogether(improv_block))
            
            # --- NEW: SUBMISSION LOG (Q&A) ---
            if phase_data.responses:
                for idx, resp in enumerate(phase_data.responses):
                    qa_block = []
                    if idx == 0:
                        qa_block.append(Spacer(1, 0.4*cm))
                        qa_block.append(Paragraph("Submission Log", self.styles["H3"]))
                    
                    # Question
                    q_text = clean_text(resp.q)
                    qa_block.append(Paragraph(f"<b>Q: {q_text}</b>", self.styles["BodySmall"]))
                    qa_block.append(Spacer(1, 0.15*cm))
                    
                    # Answer in a BOX
                    a_text = clean_text(resp.a)
                    a_para = Paragraph(f'<font color="{TEXT_PRIMARY.hexval()}">{a_text}</font>', self.styles["BodySmall"])
                    
                    a_table = Table([[a_para]], colWidths=[TEXT_WIDTH])
                    a_table.setStyle(TableStyle([
                        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#0f0f1a")),
                        ('BOX', (0,0), (-1,-1), 1, BORDER_LIGHT),
                        ('TOPPADDING', (0,0), (-1,-1), 8),
                        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
                        ('LEFTPADDING', (0,0), (-1,-1), 10),
                        ('RIGHTPADDING', (0,0), (-1,-1), 10),
                    ]))
                    qa_block.append(a_table)
                    qa_block.append(Spacer(1, 0.5*cm))
                    story.append(KeepTogether(qa_block))

            story.append(Spacer(1, 0.8*cm))
        
        # STRATEGIC NARRATIVE
        if self.session.final_output.visionary_hook or self.session.final_output.customer_pitch:
            sn_block = []
            sn_block.extend(self._create_section_header(self._next_section("Strategic Narrative")))
            
            if self.session.final_output.visionary_hook:
                sn_block.append(Paragraph(self._next_subsection("Visionary Hook"), self.styles["H2"]))
                sn_block.append(Paragraph(f'"{clean_text(self.session.final_output.visionary_hook)}"', self.styles["Quote"]))
                sn_block.append(Spacer(1, 0.5*cm))
            
            if self.session.final_output.customer_pitch:
                sn_block.append(Paragraph(self._next_subsection("Customer Pitch"), self.styles["H2"]))
                sn_block.append(Paragraph(clean_text(self.session.final_output.customer_pitch), self.styles["Body"]))
            
            story.append(KeepTogether(sn_block))
            story.append(Spacer(1, 0.5*cm))
        
        # VISUAL SYNTHESIS
        if self.session.final_output.image_url:
            img_name = self.session.final_output.image_url.split("/")[-1]
            img_path = GENERATED_DIR / img_name
            
            if img_path.exists():
                story.append(PageBreak())
                story.extend(self._create_section_header(self._next_section("Visual Synthesis")))
                
                try:
                    # OPTIMIZATION: Compress image before embedding
                    compressed_io = self._get_compressed_image(img_path)
                    
                    if compressed_io:
                        img_reader = ImageReader(compressed_io)
                        iw, ih = img_reader.getSize()
                        aspect = ih / float(iw)
                        target_w = min(TEXT_WIDTH * 0.9, 14*cm)
                        target_h = target_w * aspect
                        if target_h > 10*cm:
                            target_h = 10*cm
                            target_w = target_h / aspect
                        
                        compressed_io.seek(0)
                        img_flowable = Image(compressed_io, width=target_w, height=target_h)
                    else:
                        # Fallback to original if compression fails
                        img_flowable = Image(str(img_path), width=TEXT_WIDTH*0.5, height=TEXT_WIDTH*0.5)
                    
                    visual_block = []
                    img_container = Table([[img_flowable]], colWidths=[TEXT_WIDTH])
                    img_container.setStyle(TableStyle([
                        ('BACKGROUND', (0, 0), (0, 0), BG_CARD),
                        ('BOX', (0, 0), (0, 0), 1, BORDER_LIGHT),
                        ('ALIGN', (0, 0), (0, 0), 'CENTER'),
                        ('VALIGN', (0, 0), (0, 0), 'MIDDLE'),
                        ('TOPPADDING', (0, 0), (0, 0), 15),
                        ('BOTTOMPADDING', (0, 0), (0, 0), 15),
                    ]))
                    visual_block.append(img_container)
                    
                    fig_num = self._next_figure()
                    visual_block.append(Paragraph(f"<i>Figure {fig_num}: AI-generated visual synthesis</i>", self.styles["Caption"]))
                    visual_block.append(Spacer(1, 0.5*cm))
                    
                    vis_score = int(self.session.final_output.visual_score * 100)
                    if vis_score > 0:
                        vis_text = (
                            f'Alignment Score: <font color="{self.primary_color.hexval()}"><b>{vis_score}%</b></font> | '
                            f'Assessment: <b>{clean_text(self.session.final_output.visual_alignment or "N/A")}</b>'
                        )
                        visual_block.append(Paragraph(vis_text, self.styles["Body"]))
                    
                    story.append(KeepTogether(visual_block))
                    
                    if self.session.final_output.visual_feedback:
                        fb_block = []
                        fb_block.append(Spacer(1, 0.3*cm))
                        fb_block.append(Paragraph("AI Analysis:", self.styles["H3"]))
                        fb_block.append(Paragraph(clean_text(self.session.final_output.visual_feedback), self.styles["Body"]))
                        story.append(KeepTogether(fb_block))
                        
                except Exception as e:
                    logging.warning(f"Failed to embed visual: {e}")

        # --- NEW: SYNTHESIS BLUEPRINT (Master Prompt) ---
        if self.session.final_output.image_prompt:
            p_block = []
            p_block.extend(self._create_section_header(self._next_section("Synthesis Blueprint")))
            p_block.append(Paragraph(self._next_subsection("Master Image Prompt"), self.styles["H2"]))
            p_block.append(Paragraph(
                "The following semantic blueprint was synthesized from the team's combined phase outputs to generate the final strategic asset.",
                self.styles["Body"]
            ))
            p_block.append(Spacer(1, 0.3*cm))
            
            # Draw the prompt in a dark code-like box
            prompt_text = clean_text(self.session.final_output.image_prompt)
            prompt_data = [[Paragraph(f'<font face="Courier" size="8" color="#cbd5e1">{prompt_text}</font>', self.styles["BodySmall"])]]
            prompt_table = Table(prompt_data, colWidths=[TEXT_WIDTH])
            prompt_table.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#0f0f1a")),
                ('BOX', (0,0), (-1,-1), 1, BORDER_LIGHT), # Matching the bolder border
                ('TOPPADDING', (0,0), (-1,-1), 10),
                ('BOTTOMPADDING', (0,0), (-1,-1), 10),
                ('LEFTPADDING', (0,0), (-1,-1), 10),
                ('RIGHTPADDING', (0,0), (-1,-1), 10),
            ]))
            p_block.append(prompt_table)
            story.append(KeepTogether(p_block))
            story.append(Spacer(1, 0.8*cm))
        
        # CONCLUSION
        concl_block = []
        concl_block.extend(self._create_section_header(self._next_section("Conclusion")))
        
        conclusion = (
            f'Team <b>{clean_text(self.team_id)}</b> completed the Pitch-Sync simulation with '
            f'<font color="{PRIMARY.hexval()}"><b>{score}/1000</b></font> points '
            f'(<font color="{tier_color.hexval()}"><b>{tier}</b></font>). '
        )
        if score >= 700:
            conclusion += "This demonstrates strong strategic thinking and effective communication."
        elif score >= 500:
            conclusion += "There remain opportunities for improvement in strategic depth."
        else:
            conclusion += "Focus on strengthening strategic communication and analytical skills."
        
        concl_block.append(Paragraph(conclusion, self.styles["Body"]))
        concl_block.append(Spacer(1, 1*cm))
        concl_block.append(HRFlowable(width="60%", thickness=2, color=BORDER_LIGHT, spaceBefore=10, spaceAfter=10, hAlign='CENTER'))
        concl_block.append(Paragraph(
            f'<i>Generated by EG Pitch-Sync | Powered by AI COE</i><br/>{datetime.now().strftime("%B %d, %Y at %H:%M")}',
            self.styles["Caption"]
        ))
        
        story.append(KeepTogether(concl_block))
        
        doc.build(story)
        return output_path


def generate_report(session: SessionState, force: bool = False) -> Path:
    """Main entry point."""
    generator = DarkThemeReportGenerator(session)
    return generator.generate(force=force)
