You are a senior software architect. Analyze the project files I have open in my workspace and generate a single markdown file named `ARCHITECTURE_AND_AUDIT.md`.  **STRICT RULES:** - Derive EVERYTHING only from the files I provide. Do not reference external examples, templates, or hypothetical projects. - Use exact filenames, dependency versions, and table names found in the code. - Use Mermaid syntax for all diagrams. - Use markdown tables for all inventories. - No placeholder text like "insert here" or "TODO". If something is absent, write "Not detected in provided files."  ---  ## OUTPUT STRUCTURE  Generate a single markdown file with this exact heading hierarchy:  # Technical Architecture & Audit Report  ## 1. Executive Summary One paragraph classifying the app architecture (SPA, SSR, Serverless, Monolith, etc.), naming the core stack, backend strategy, unique/specialized libraries, and package manager used.  ## 2. Project Structure  ### Directory Mapping Hierarchical bullet list of the `src/` (or equivalent) directory tree with a one-line responsibility description for each folder and notable files.  ### Architecture Summary A concise paragraph summarizing the frontend framework, build tool, state strategy, backend paradigm, database, and auth provider.  ## 3. Application Flowcharts  Include exactly three Mermaid diagrams in separate code blocks:  ### System Architecture & Data Flow ```mermaid graph TD   ... (Frontend -> Router -> State -> API/DB -> Auth -> Storage)

User Journey Flow

Mermaid

CodePreview

graph TD   ... (Entry -> Auth Check -> Dashboard -> Feature Branches -> Save Progress)

Frontend Component Hierarchy

Mermaid

CodePreview

graph TD   ... (App -> Providers -> Router -> Layout -> Pages -> Feature Components)

4. Technology & Dependency Inventory

Create a markdown table with columns: Dependency | Version | Purpose / Notes | Direct/Transitive Group into these exact categories:

Core Frameworks & Runtimes

State Management & Data Fetching

Backend / Server & APIs

UI / Styling

Specialized Libraries (Visuals, Data, Game Engines, PDF, Charts, etc.)

Testing & Quality

5. Detailed Architectural Breakdown

A. Data Flow and State Strategy

Explain the state management philosophy. Name the specific libraries used for server state, global client state, and local component state.

B. Authentication & Security

Describe the auth mechanism, session handling, route protection patterns, and database-level security (RLS, middleware, permissions, etc.).

C. Key Modules & Responsibilities

For each major feature domain (Auth, Dashboard, Core Business Logic, Admin, Reporting, etc.), describe the components/hooks/pages involved and how they persist data.

D. Notable Design Patterns

Identify 3-5 patterns used (e.g., Provider, Layout Route, Container/Presentational, Adapter, Compound Component) with brief explanations and file locations.

6. External Resources & Submodules

List any Git submodules, external repos, or third-party API integrations.

State "None detected" if applicable.

7. Security & Maintenance Recommendations

Provide exactly 5 actionable, specific recommendations:

Bundle size / code-splitting for heavy libraries.

Dynamic imports for large optional features.

Security posture (RLS, client secrets, auth robustness).

Dependency auditing and lockfile hygiene.

One recommendation specific to the project's most unique or complex dependency.