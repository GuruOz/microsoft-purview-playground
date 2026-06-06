# Purview DLP Logic Visualizer

The Purview DLP Logic Visualizer is a powerful, interactive web application designed to help administrators and security engineers build, visualize, test, and share complex Data Loss Prevention (DLP) logic for Microsoft Purview. 

---

## 🌟 Comprehensive Feature List

### 1. Rule Builder (Index Tab)
The core workspace for designing and structuring your DLP policies and rules.

*   **Policy & Rule Hierarchy Management:**
    *   **Create & Delete:** Easily add new policies and nested rules, or delete obsolete ones.
    *   **Drag/Move Order:** Move policies and rules up or down to adjust priority evaluation order.
    *   **Inline Editing:** Click on any policy or rule name to rename it instantly.
*   **Granular Rule Configuration:**
    *   **Enable/Disable:** Toggle individual rules or entire policies on and off.
    *   **Workload Targeting:** Specify whether a rule applies to **Email** (Exchange) or **Endpoint** workloads.
    *   **Action Toggles:** Configure rule outcomes: **Monitor**, **Notify**, **Override**, and **Block**.
    *   **Stop Processing:** Check this to immediately halt further policy evaluation when a rule matches.
*   **Condition Pool & Variable Management:**
    *   **Categories:** Choose from standardized Microsoft Purview Exchange and Endpoint condition templates.
    *   **Property Configuration:** Add specific properties (e.g., specific domains, keywords, IP addresses) when adding a condition.
    *   **Pool Management:** Edit or delete conditions currently sitting in the pool.
    *   **Search:** Filter the pool to quickly find the exact condition you need.
*   **Visual Logic Builder (Drag and Drop):**
    *   **Operators:** Drag and drop logical operators (`AND`, `OR`, `NOT`, `AND NOT`, `(`, `)`) to structure your logic.
    *   **Nesting & Indentation:** Automatically visualizes nested logic using parentheses with color-coded brackets and indented guide lines.
    *   **Condition Tokens:** Drag variables from your Condition Pool into the Drop Zone.
    *   **Inline Property Editing:** Directly on the dragged condition token, you can click `+ Add` to add new properties, click a property to edit it, or click the `x` to remove it.
    *   **Smart Merging:** Drag a condition from the pool onto an existing condition token in the builder with the same base name to merge their properties automatically.
*   **Live Truth Table Evaluation:**
    *   Automatically generates a truth table for the currently selected rule.
    *   Shows all possible `True/False` combinations for the conditions present.
    *   Provides a step-by-step **Evaluation Trace** showing exactly how the logic resolves to a final `True` or `False` result.
*   **Change History & Timeline (Undo/Redo):**
    *   Every change made to policies, rules, or conditions is tracked in a visual timeline.
    *   Click any point in the timeline to instantly jump back/forward to that state.
    *   Supports standard keyboard shortcuts (`Ctrl+Z` to Undo, `Ctrl+Y` or `Ctrl+Shift+Z` to Redo).

### 2. Simulator Tab
A testing environment to evaluate how your configured policies behave against simulated real-world scenarios.

*   **Channel Workload Selection:**
    *   Choose the channel to simulate: **Email (Exchange)**, **Endpoint (Web)**, **Endpoint (Application)**, **Endpoint (Printing)**, or **Endpoint (USB/Removable)**.
    *   Rules are automatically filtered to only evaluate if they apply to the selected workload.
*   **Interactive Variables Checklist:**
    *   Automatically extracts every unique condition used across your active rules.
    *   Check specific conditions to simulate them evaluating as `True` in the current scenario.
    *   **User Override Simulation:** A special toggle to simulate a user providing a business justification to override a block action.
*   **Run Simulation & Evaluation Trace Timeline:**
    *   Click "Run Simulation" to cascade the simulated state through all enabled policies sequentially.
    *   Displays a visual timeline trace showing which rules matched and which were bypassed.
    *   Highlights the step-by-step logic trace for matching rules.
    *   Clearly indicates if a matching rule triggered a **Stop Processing** halt.
*   **Final Outcome Summary:**
    *   Summarizes the cumulative actions triggered across all matched rules (e.g., Monitor, Notify, Block).
    *   Calculates block vs. override states correctly based on user override inputs.

### 3. Global Capabilities

*   **Import / Export Data System:**
    *   **Export Visualizer State:** Save your entire workspace (all policies and condition pools) to a JSON file.
    *   **Import Visualizer State:** Load a previously saved visualizer workspace.
    *   **Import Purview PowerShell JSON:** Paste raw JSON exported directly from Microsoft Purview PowerShell. The visualizer will parse the Advanced Rule ASTs and condition maps into visual logic blocks automatically.
*   **Shareable Links:**
    *   Click **Share Link** to encode your entire current workspace state into a secure, shareable URL. Paste it in chat to let colleagues instantly load your exact configuration.
*   **Persistent & Syncing Storage:**
    *   Your workspace is automatically saved locally in your browser. It persists even if you close the tab.
    *   **Cross-tab Sync:** If you have the visualizer open in multiple tabs, changes made in one tab instantly reflect in all others.
*   **Dark & Light Mode:**
    *   Fully supports a seamless dark mode for comfortable viewing. Toggles persist across sessions.

---

## 📖 User Guide: How to Use the Application

### Getting Started: Building Your First Rule
1. **Create a Policy:** On the main page, click **+ New Policy**. You can rename it by clicking the bold "Policy 1" text.
2. **Add a Condition to the Pool:** 
   * On the right sidebar, go to **2. Create Condition**.
   * Select a category (e.g., "Exchange").
   * Type or select a base condition like "Sender domain is".
   * An input box will appear. Type the domain (e.g., `contoso.com`) and click **Add to Pool**.
3. **Draft the Logic:**
   * Click on the empty rule box under your policy to ensure it is active (it will highlight in blue).
   * From **1. Operators**, drag `(` into the "Drop Zone" of the rule.
   * From **3. Condition Pool**, drag your newly created `Sender domain is: contoso.com` condition into the Drop Zone next to the parenthesis.
   * Drag an operator like `AND`, add another condition, and close it with `)`.
4. **Refine inline:** If you need to add another domain, simply click the **+ Add** button directly on the condition block inside the rule to add `fabrikam.com`.
5. **Set Actions:** Check the action checkboxes on the rule (Monitor, Block, etc.) to define what happens when this logic matches.

### Testing the Logic
1. Look down at the **Truth Table Evaluation**.
2. It automatically calculates the outputs of your logic for every possible True/False combination of the conditions you dropped in. Use this to verify that your nested `AND`/`OR`/`NOT` statements behave exactly as expected.

### Simulating a Scenario
1. Switch to the **Simulator Tab** using the top navigation bar.
2. Select the **Channel** (e.g., Email).
3. Under the **Variables Checklist**, you will see the conditions you used in your rule. Check the box next to `Sender domain is: contoso.com` to simulate an email arriving from that domain.
4. Click **Run Simulation**.
5. The **Evaluation Trace Timeline** will show your rule turning green (MATCH) and summarize that the action (e.g., Block) was triggered.

### Saving, Sharing, and Importing
* **Share with a Colleague:** Click **Share Link** at the top right. Send the copied URL to a teammate. When they open it, their browser will load your exact policies.
* **Backup your work:** Click **Import / Export** -> **Export Visualizer State** to save your progress locally.
* **Import from Microsoft Purview:** If you have exported a policy from Purview via PowerShell to JSON, click **Import / Export**, paste the JSON, and click **Import Purview PowerShell JSON**. The application will automatically translate the Purview rule structure into the visualizer blocks!