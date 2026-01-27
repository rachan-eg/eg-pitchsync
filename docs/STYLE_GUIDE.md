# 🎨 PitchSync Design System & Style Guide

PitchSync follows a **"Strategy Suite"** aesthetic—a premium, high-tech interface that blends cyberpunk vibes with enterprise-grade refinement. The design is built on three core pillars: **Atmosphere, Clarity, and Flow.**

---

## 🌌 Visual Identity: "The Strategy Suite"
The interface is designed to feel like a high-end command center. It uses deep dark backgrounds, vibrant neon accents, and layered glassmorphism to create a sense of depth and focus.

### 🎨 Color Palette
PitchSync uses a curated, harmonious palette optimized for dark mode performance and high contrast.

#### **Core Atmosphere**
*   **Deep Space (Background):** `#050508`
*   **Tactical Glass (Cards):** `rgba(15, 15, 25, 0.7)` with `16px` blur.
*   **Void Input:** `rgba(0, 0, 0, 0.3)`

#### **Strategic Accents**
*   **Primary (Action):** `#A78BFA` (Vibrant Lavender)
*   **Secondary (Safe):** `#3B82F6` (Electric Blue)
*   **Accent (Focus):** `#F472B6` (Pink Glow)
*   **Lead Partner (Claude):** `#D97757` (Claude Orange)

#### **Semantic Status**
*   **Success:** `#10B981` (Emerald)
*   **Warning:** `#F59E0B` (Amber)
*   **Danger:** `#EF4444` (CRIMSON)

---

## 🪟 Materials & Components
The UI is composed of digital "layers" that evoke a futuristic HUD (Heads-Up Display).

### **Glassmorphism**
Every panel uses the **Tactical Glass** utility:
*   Subtle white border (`rgba(255, 255, 255, 0.08)`)
*   Deep background blur (`16px`)
*   Reactive border glows that pulse during interaction.

### **Textures & Overlays**
*   **Noise Overlay:** A fixed, 8% opacity SVG grain that adds organic texture to the digital void.
*   **Aurora Layers:** Dynamic, multi-colored linear gradients that pulse in the background.
*   **Scanlines:** Periodic CRT-style scanlines that scroll vertically to reinforce the "monitor" aesthetic.

---

## ⌨️ Typography
PitchSync prioritizes readability with a focus on hierarchy and technical precision.

*   **Primary Interface:** `Inter` or `SF Pro Display`. Clean, modern, high x-height.
*   **Tactical Data:** `JetBrains Mono`. Used for scores, timers, and AI logs to provide a "coded" feel.

---

## ✨ Motion & Micro-animations
Motion is not just decorative; it provides feedback and reinforces the "Strategy Suite" narrative.

*   **Premium Entry:** Components don't just appear; they slide up (`12px`), scale (`0.99`), and de-blur over `700ms`.
*   **Reactive Borders:** Buttons and cards glow when hovered, expanding their "glow zone" to create a physical sense of light.
*   **Pulse & Float:** Critical elements (like the timer or score badges) have subtle floating or pulsing animations to maintain urgency.
*   **Staggered Reveals:** Content groups use CSS Stagger variables to reveal items sequentially, guiding the user's eye.

---

## 🛠️ Implementation Specs (For Developers)
Global CSS tokens are stored in `:root` and should be used exclusively:

| Token Type | Variable Name | Value |
| :--- | :--- | :--- |
| **Primary**| `--primary` | `#a78bfa` |
| **Glass** | `--glass-blur` | `16px` |
| **Shadow** | `--shadow-glow` | `0 0 20px var(--primary-glow)` |
| **Radius** | `--radius-lg` | `16px` |
| **Logic** | `--z-max` | `9999` |

---

*Style Guide Version 2.1 | "Strategy Suite" Edition*
