# Purview DLP Logic Visualizer

The **Purview DLP Logic Visualizer** is an interactive web application designed to help administrators and security engineers build, visualize, test, summarize, and share complex Data Loss Prevention (DLP) logic for Microsoft Purview.

## 🚀 Quick Start
1. **Rule Builder:** Click **+ New Policy**, add conditions from the right sidebar, and drag operators (`AND`, `OR`, `NOT`) into the Drop Zone to build your visual logic.
2. **Simulate:** Go to the **Simulator Tab**, check specific variables, and click **Run Simulation** to see a live evaluation trace of your logic.
3. **Summarize & Export:** Go to the **Rule Summary Tab** to see all rules translated into plain English and export them to a clean PDF.
4. **Share:** Click **Share Link** to instantly generate a URL with your exact policies to send to colleagues.

---

## 🌟 Key Features

*   **Drag-and-Drop Logic Builder:** Build complex nested logic using visual blocks and operators (`AND`, `OR`, `NOT`, brackets).
*   **Live Truth Table & Simulator:** Automatically evaluates rule logic combinations and simulates real-world email/endpoint scenarios.
*   **Natural Language Explanations (NEW!):** Instantly translates visual logic blocks into readable English. Supports static formats or advanced dynamic AI summaries (OpenAI, Gemini, Claude, DeepSeek) with secure local caching.
*   **Rule Summary & PDF Export (NEW!):** A dedicated view listing all policies and natural language rule descriptions. Select rules to export as a cleanly paginated, highlightable native PDF.
*   **Live Debug Logger (NEW!):** Track internal application states, API fetch metrics, and errors in a live debug log viewer built directly into the Settings tab.
*   **Import / Export:** Save your workspace locally or import raw Purview PowerShell JSON to automatically rebuild the logic visually.
*   **Cross-tab Sync & Dark Mode:** Edits instantly sync across open tabs, fully supported by a robust persistent dark mode theme.
