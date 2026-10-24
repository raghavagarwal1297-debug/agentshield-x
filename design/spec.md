# AgentShield X: dashboard redesign spec (MuleNet style)

Status: **draft, waiting for approval**. Nothing has been built yet.

Sources: `design/mission1.png`, `mission2.png`, `investigate.png`, `testlab.png`.
`design/mapping.md` was requested but does not exist, so the mapping below is
derived from the screenshots alone. The MuleNet name and copy are not reused;
only the visual language is (colours, panels, type, layout, motion).

---

## 1. Feature inventory (current code)

Every feature that exists today in `client/`, `client/src/api.js` or `server/`.
"UI" = shown in the current dashboard, "API only" = backend has it but the UI does not use it.

| # | Feature | Where it comes from | Today |
|---|---|---|---|
| F1 | Server health: up/down, agent + judge model, provider, demo mode (live/cached), scanner rules loaded, DLP detectors loaded | `GET /api/health` | UI (dot only) |
| F2 | Guard mode OFF / MONITOR / ENFORCE | `GET/POST /api/guard` | UI |
| F3 | Per-layer toggles: scanner, firewall, approval, egress | `POST /api/guard {layers}` | UI |
| F4 | Guard state sync across browser tabs | SSE `guard_changed`, `hello` | API only |
| F5 | Acting user / role switch (Karan HR, Riya Admin, Aman Intern) | `users.json` via `user_id` | UI |
| F6 | Mock / live data source toggle | `api.js` | UI |
| F7 | Reset sandbox (data, incidents, approvals, sessions) | `GET /api/reset` | UI |
| F8 | Chat with NimbusAssist | `POST /api/chat` | UI |
| F9 | Attach documents to a message; warn when a document has hidden text spans | `GET /api/documents` (`hidden_spans`) | UI |
| F10 | Document viewer with hidden spans highlighted by line | `GET /api/documents/:id` | API only |
| F11 | Per-reply verdict: clean / intercepted / needs sign-off / unguarded / redacted | chat `verdict`, `blocked`, `approval_required`, `layer_stopped_at` | UI (3 states) |
| F12 | Per-reply tool trace (tool, args, status completed/blocked/pending/rejected) | chat `steps` | UI |
| F13 | Per-reply guard decisions (outcome, layer, risk, rule ids, `would_block`) | chat `decisions` | UI |
| F14 | LLM unavailable / fail-closed error reply | chat 503 | UI (error bubble) |
| F15 | 7 guided demo scenarios (role, docs, guard override, expected outcome) | `mock/chat.json` | UI |
| F16 | Live decision feed with filters (all / blocked / allowed / approvals) and search | SSE `decision` | UI |
| F17 | Toasts on new incident / approval | SSE `incident`, `approval_created` | UI |
| F18 | Request grouping (all checkpoints of one request) | `request_id` on decisions | API only |
| F19 | Approval queue: pending dockets, tool, args, requester, role, risk, reason | `GET /api/approvals` | UI |
| F20 | Approve / reject with confirmation; resumed run's answer returned | `POST /api/approvals/:id` | UI |
| F21 | Approval expiry (auto-reject after 5 min) | `expires_at` | API only (no countdown) |
| F22 | Rejected tool not retried in the same request (APR-REJECTED) | agent | API only |
| F23 | Incident list: search, filter, risk, OWASP tags, user, attempted tool | `GET /api/incidents` | UI |
| F24 | Incident dossier: what happened / why / where it came from / what was protected / suggested fix, source excerpt + line, hidden spans, removed lines, attempted call, rule ids, mode, would_block | `GET /api/incidents/:id` | UI (partial) |
| F25 | Manager incident report (LLM, template fallback) | `POST /api/incidents/:id/report` | UI |
| F26 | Policy viewer: approval rules, egress allowlist, document classification | `GET /api/policy` | UI |
| F27 | Policy viewer: roles -> tools, data scopes, limits, redaction, thresholds | `GET /api/policy` | API only |
| F28 | Policy JSON editor (admin only, validation errors, can be disabled) | `PUT /api/policy` | UI (errors not shown well) |
| F29 | Metrics from last run: ASR off/on, task completion, false positives, permission enforcement, latency, guard ms | `GET /api/metrics` | UI |
| F30 | Per-attack OFF vs ON comparison, what got through, false-positive list, errored cases, model + demo mode of the run | `GET /api/metrics`, `/api/tests/latest` | UI (partial) |
| F31 | Run evaluation suite (mode, case subset, pause) | `POST /api/tests/run` | UI (fixed settings) |
| F32 | Live suite progress per case | SSE `test_progress`, `test_finished` | API only |
| F33 | Held-out attack set (pending, returns a clear error) | `POST /api/tests/heldout` | UI |
| F34 | Session overview: requests inspected, threats intercepted, pending approvals, incidents; traffic trend; severity breakdown | derived from feed + incidents | UI |
| F35 | Animated defence visual (agent + 4 gates) | `DefenseCore3D.jsx` (three.js) | UI |
| F36 | Monitor mode "would have blocked" marking | `would_block` | UI (pill) |
| F37 | Fictional / sandbox disclaimer | README rule | missing |

---

## 2. Visual language (taken from the screenshots)

### Colour tokens

| Token | Hex (approx.) | Seen in MuleNet as | AgentShield use |
|---|---|---|---|
| `--bg` | `#06121F` | page background, deep navy | page |
| `--bg-grid` | `#0B2236` @ 40% | faint grid / scanlines | background texture |
| `--panel` | `#0A1B2D` | panel fill | panels |
| `--panel-2` | `#0E2338` | selected list row | selected rows, inputs |
| `--line` | `#1A3550` | panel border, dividers | borders |
| `--bracket` | `#2CCFE3` | L-shaped corner brackets | panel corners, focus ring |
| `--cyan` | `#3BE2F2` | active tab, numbers, Bank A nodes | primary accent, ALLOW-path, links |
| `--amber` | `#F6B520` | CTA buttons, session label, money | primary action, NEEDS_APPROVAL |
| `--magenta` | `#FF3D7A` | flagged accounts, risk score, ring nodes | BLOCK, threats, high risk |
| `--violet` | `#B26CFF` | Bank B nodes | MONITOR mode, `would_block` |
| `--green` | `#4CE38C` | terminal output, "stitched" | ALLOW / completed / clean |
| `--text` | `#DCE8F3` | primary text | text |
| `--text-dim` | `#7E93A8` | secondary text, hints | captions, labels |
| `--disclaimer` | `#F6B520` bold + `--text-dim` | top notice strip | sandbox notice |

Outcome colours are fixed everywhere: ALLOW green, REDACT cyan, NEEDS_APPROVAL amber,
BLOCK magenta, would_block violet (dashed outline), unguarded/OFF grey `#5B6B7D`.

### Type

| Role | Font (Google Fonts) | Style |
|---|---|---|
| Brand, tab labels, panel titles | **Chakra Petch** 600 | UPPERCASE, letter-spacing 0.18em; panel titles 13px, tabs 15px, brand 30px |
| Headlines in narrative panels | **Chakra Petch** 700 | sentence case, 26px / 1.2 |
| Body | **Rajdhani** 500 | 15px / 1.5 |
| Numbers, clock, terminal, ticker, ids, JSON | **JetBrains Mono** 500 | tabular figures |
| Hero numbers ("9+4", "18") | **Chakra Petch** 700 | 64-72px, cyan or magenta with soft glow |

### Building blocks

- **Panel**: `--panel` fill, 1px `--line` border, cyan corner brackets (14px L-shapes)
  at top-left and bottom-right, title row inside (UPPERCASE, `--text-dim` or cyan),
  optional right-aligned meta (e.g. `18 rings`, `mulenet@fiu` -> `nimbus@guard`).
  Top-right and bottom-left corners are cut at 45° (8px).
- **CTA button**: amber fill, dark text, Chakra Petch 700 UPPERCASE, diagonal cut on
  the bottom-left corner, subtle horizontal stripe texture. One CTA per panel.
- **Secondary button**: transparent, 1px `--line` border, white UPPERCASE text, hover -> cyan border.
- **Tab bar**: plain text tabs, active tab white with 2px cyan underline the width of the tab.
- **Stepper**: row of 5-7 short bars; done = cyan, current = amber, todo = `--line`.
- **List row** (Rings by risk): id in mono bold, type label dim, amount amber right-aligned,
  second line dim meta with one green status word. Selected row: `--panel-2` + cyan border.
- **Evidence block** (account card): magenta-tinted card, flagged badge (magenta outline),
  big risk number top-right, rule entries with a 2px magenta left bar, rule id in
  magenta UPPERCASE mono, plain-English sentence under it; key/value table below
  (dim key left, mono value right).
- **Terminal**: mono 14px, `> command` lines in cyan, output lines in green, waiting lines dim,
  types out line by line (20 ms/char, instant when reduced motion is on).
- **Ticker**: full-width bottom strip, mono 13px, scrolling right-to-left, amber for money,
  pauses on hover.
- **Canvas**: starfield + faint polar grid floor, corner hint text top-right
  ("Drag to rotate · double-click to reset"), stats bottom-left, mode text bottom-right.
- **Sliders**: cyan filled track, round cyan thumb, label left, mono value right.
- **Sound toggle**: square icon button, muted by default.

### Layout

- Header (2 rows) + 3-column body + bottom ticker, full viewport height, no page scroll on ≥1280px.
- Body columns: left 22%, centre 54%, right 24%, 16px gaps, 20px outer gutter.
  Right column can hold two stacked panels (Terminal 50% / Alerts 50%).
- 1024-1279px: right column drops under the centre. <1024px: single column, ticker hidden,
  canvas height 360px.
- `prefers-reduced-motion`: no ticker scroll, no typewriter, no canvas auto-rotate.

---

## 3. Shell (on every tab)

### Header row 1
| Element | Spec | Feature |
|---|---|---|
| Brand | `AGENTSHIELD X` (Chakra Petch 30px) + `AI agent security console` (Rajdhani dim) | - |
| Session label | dot + text, colour by guard mode: `Guard ENFORCE` magenta dot / amber text as in MuleNet, `MONITOR` violet, `OFF` grey | F2 |
| Clock | `HH:MM:SS IST`, mono, cyan, ticks every second | - |
| Tabs | `MISSION · CONSOLE · INVESTIGATE · APPROVALS · RESULTS · TEST LAB · POLICY`; APPROVALS shows an amber count badge when pending > 0; INVESTIGATE shows the incident count | navigation |
| Sound | icon button, plays a short tone on BLOCK and on new approval when unmuted | F17 |
| Autopilot | secondary button; runs MISSION scenarios 1-7 in order with a 10 s pause, stops on any error, stops when an approval is pending until it is decided | F15 |

### Header row 2 (MuleNet's disclaimer strip, extended with controls; MuleNet has no controls)
- Left: **`Fictional sandbox.`** (amber bold) `Nimbus Retail is invented; tools are mocks and no real email, payment or deletion happens.` (dim). (F37)
- Right, in this order:
  - **Mode switch** (F2): 3-segment control `OFF | MONITOR | ENFORCE`, mono 12px; selected segment filled
    grey / violet / magenta. Changes call `POST /api/guard`; the label in row 1 updates from the
    `guard_changed` event so all open tabs stay in sync (F4).
  - **Layer chips** (F3): `L1 SCAN  L2 FIREWALL  L3 APPROVAL  L4 EGRESS`; on = cyan outline + dot,
    off = struck-through dim. L4 shows a small `not built` tag while egress is pending (honest state).
  - **Acting as** (F5): compact select with the three users, shows role in dim text.
  - **Server dot** (F1): green `LIVE` / magenta `OFFLINE` / amber `CACHED` (demo mode replay);
    hover card lists models, demo mode, rules loaded, detectors loaded.
  - **Reset** (F7): secondary button, confirm popover "Reset sandbox data, incidents and approvals?".
  - **Data source** (F6): hidden behind a `…` menu (dev only), shows `MOCK` badge in row 1 when on.

### Bottom ticker (F16 condensed)
Each guard decision from SSE as
`12:31:03  REQ-0004  hr_karan → send_email  BLOCK  FW-INTENT`, outcome coloured,
tool name cyan, amounts in tool args amber (`₹75,000`). Click an item -> INVESTIGATE
with its incident selected (uses `incident_id`, fixes the current stage-based match).

### Toasts (F17)
Bottom-right above the ticker, panel style with a 2px left bar in outcome colour, 4 s.

---

## 4. Tabs

### 4.1 MISSION: guided demo (MuleNet "Mission")
Purpose: the stage demo. One scenario per step, before/after story.

| Column | Panel | Content and behaviour | Features |
|---|---|---|---|
| Left | `MISSION` | Stepper with 7 bars (one per scenario). Amber kicker (e.g. `Poisoned invoice`), headline (e.g. "A hidden line tells the assistant to email salaries"), 2-3 sentence explanation, hero number after the run (e.g. `0` emails sent with guard ON vs `1` with guard OFF; magenta when the attack worked, cyan when it was stopped). Chips: role, attached docs (doc chip with a magenta `hidden text` tag when `hidden_spans` > 0), guard override (e.g. `L1 off`). CTA: `RUN SCENARIO`; after a pause for approval it becomes `OPEN APPROVAL`. `Back` / `Next` + ← → keys. | F15, F9, F11 |
| Centre | Canvas | Animated pipeline instead of the transaction graph: user node left, NimbusAssist core centre, tools as nodes right, four concentric gate rings around the core (L1-L4). Each decision of the current request animates a packet along the path; ALLOW passes in green, REDACT turns cyan, NEEDS_APPROVAL stops at the L3 ring pulsing amber, BLOCK bursts magenta at the gate that stopped it. Disabled layers draw their ring dashed grey. OFF mode: rings hidden, packets grey. Reuses the three.js scene from `DefenseCore3D.jsx`. Corner hint: `Drag to rotate · double-click to reset`; bottom-left `REQ-0007 · STEPS 3 · GATES 4/4`; bottom-right `GUARD ENFORCE · 3D VIEW`. | F35, F11, F12, F3 |
| Right top | `TERMINAL` (`nimbus@guard`) | The current request as terminal lines: `> scan input` / `ALLOW risk 0`, `> read vendor_invoice_oct.txt` / `line 10 hidden span removed`, `> firewall send_email` / `BLOCK FW-INTENT`, final reply summary. Types line by line as decisions arrive. | F13, F18 |
| Right bottom | `ALERTS` (count) | Incidents created by this request, newest first, as compact evidence rows (rule id magenta, one-line why). Click -> INVESTIGATE. | F23 |

### 4.2 CONSOLE: free chat (not in MuleNet)
Purpose: ad-hoc requests and judge questions.

| Column | Panel | Content and behaviour | Features |
|---|---|---|---|
| Left | `COMPOSE` | Acting-as (mirrors header), document list with checkboxes (hidden-span tag, classification badge: public / internal / external / critical), eye icon opens the document viewer drawer with hidden spans highlighted magenta by line (F10), quick chips for the 7 scenario prompts, multiline input, CTA `SEND`. | F5, F8, F9, F10 |
| Centre | `CONVERSATION` | Messages. User: right-aligned, `--panel-2`. Assistant: left, with a verdict strip on top (green `CLEAN`, magenta `INTERCEPTED at L2 FIREWALL`, amber `WAITING FOR SIGN-OFF`, cyan `REDACTED`, grey `UNGUARDED`, violet `WOULD BLOCK` in monitor), reply text, collapsible tool trace (mono rows: tool, args, status chip), decision chips (outcome, layer, risk). Error bubble in magenta outline for LLM unavailable / fail-closed. Loading: the four gate chips light in sequence. | F11-F14, F36 |
| Right top | `TERMINAL` | Same as MISSION, for the latest request. | F13, F18 |
| Right bottom | `LIVE FEED` | Full decision feed with filter pills `ALL · BLOCKED · ALLOWED · APPROVALS` and a search box; rows grouped by `request_id` with a thin cyan connector. | F16, F18 |

### 4.3 INVESTIGATE: incidents (MuleNet "Investigate")

| Column | Panel | Content and behaviour | Features |
|---|---|---|---|
| Left | `INCIDENTS BY RISK` (`N incidents`) | List rows like "Rings by risk": `INC-0004` mono bold, title dim (`Unauthorised tool call`), risk right-aligned (magenta ≥70, amber 30-69, cyan <30); second line `hr_karan · send_email · FW-INTENT · blocked` with the outcome word in its colour (violet `would block` in monitor). Search box and filter (outcome, OWASP, user) above the list. Sorted by risk, then time. | F23, F36 |
| Centre | Flow view | Title `INC-0004 · Action the user never asked for`, subtitle `hr_karan asked "process this invoice"; the assistant tried send_email to billing@…`. Graph: source (document / user message) → NimbusAssist → attempted tool, with the stopping gate drawn on the edge as a magenta ring; amber arrows like MuleNet's money flow. Below the graph: source excerpt with the hidden or removed line highlighted, line number in mono. Buttons: `REPLAY FLOW` (secondary; re-animates the packets) and `CASE PACKET` (amber CTA; generates the manager report, F25, shown in a drawer with classification, summary, data-protection note, `generated by llm/template`, copy button). | F24, F25 |
| Right | `EVIDENCE` | Evidence card: incident id, badge `BLOCKED` / `WOULD BLOCK` / `PAUSED`, risk score big top-right (magenta). Five entries with magenta left bar: `WHAT_HAPPENED`, `WHY`, `WHERE_IT_CAME_FROM`, `WHAT_WAS_PROTECTED`, `SUGGESTED_FIX`. Key/value table: stage, layer, mode, user, role, request_id, session, rule_ids, OWASP (chips with names), time. | F24 |

### 4.4 APPROVALS: human sign-off (MuleNet "Watchlist" slot, new behaviour)

| Column | Panel | Content and behaviour | Features |
|---|---|---|---|
| Left | `PENDING SIGN-OFF` (`N pending`) | Rows: `APR-0003` mono, tool label (`Refund`), amount amber right (`₹75,000`); second line `admin_riya · risk 65 · auto-reject in 4:12` with a countdown from `expires_at`, turning magenta under 60 s. Below: `RESOLVED` section, dim rows with `approved by` / `rejected by` / `timed out`. | F19, F21 |
| Centre | `PROPOSED ACTION` | Large card: tool name, the exact arguments as a key/value table (mono), the requesting message and the rule that paused it (`APR-ISSUE_REFUND: amount > 10000`), the conversation it came from. After a decision, shows the resumed run's reply and its tool trace; if the reviewer rejected and the model tried again, shows the `APR-REJECTED` block. | F19, F20, F22 |
| Right | `DECISION` | Amber CTA `APPROVE`, magenta-outline `REJECT`, both with a confirm step ("Approve refund of ₹75,000 for order 889?"). Reviewer = acting-as user. Hint text: "Pending actions are rejected automatically after 5 minutes." | F20 |

### 4.5 RESULTS: evaluation numbers (MuleNet "Results")

| Column | Panel | Content and behaviour | Features |
|---|---|---|---|
| Left | `SCORECARD` | Stack of KPI rows, label dim left, value mono right, with OFF → ON pairs: attack success (OFF magenta / ON cyan), task completion, false positive rate, permission enforcement, guard time per request. Values that were never measured show `—` and the tooltip `not measured` (held-out ASR, explanation quality). Run metadata: model, demo mode (`CACHED REPLAY` amber tag when cached), finished time, errored cases. | F29, F30 |
| Centre | Charts | (1) Per-attack OFF vs ON paired bars (magenta = attack worked, cyan = stopped, grey hatched = errored). (2) Latency: request OFF / ON / guard hooks. (3) Session panel: requests inspected, threats intercepted, pending approvals, incidents, plus traffic trend and severity donut from the live feed (moved here from today's Overview). Recharts, colours from the tokens. | F29, F30, F34 |
| Right | `WHAT GOT THROUGH` / `FALSE POSITIVES` | Evidence-style entries for attacks that succeeded with the guard ON and legit tasks that were blocked or not completed; "redacted but completed" listed separately in dim text. Empty state: "Nothing got through in the last run." | F30 |

### 4.6 TEST LAB: run the suite (MuleNet "Test Lab")

| Column | Panel | Content and behaviour | Features |
|---|---|---|---|
| Left | `RUN BUILDER` | Mode segmented control `OFF · ENFORCE · BOTH`; slider `Pause between cases` 0-30 s (default 8); case picker chips grouped `ATTACKS S2-S7` / `LEGIT L01-L20` with select all/none; estimated time and LLM calls shown under the chips; `HELD-OUT (pending)` chip disabled with the server's reason; CTA `RUN SUITE` (disabled while a run is in progress, 409 shown as "A run is already in progress"). | F31, F33 |
| Centre | Progress grid | Empty state `AWAITING TEST` as in MuleNet. During a run, one tile per case × mode fills in from `test_progress`: magenta `ATTACK WORKED`, cyan `STOPPED`, green `DONE`, amber `NOT DONE`, grey `ERROR`; tile shows id, ms, stopping layer. Bottom-left `CASES 12 / 52`, bottom-right `LIVE LLM` or `CACHED REPLAY`. | F32 |
| Right | `RESULT` + `CASE LOOKUP` | Result summary when `test_finished` arrives (same numbers as RESULTS, link to it). Case lookup input (`S2`, `L06`) → shows the case's tools, rules, effect and reply for both modes. | F30, F31 |

### 4.7 POLICY: rules the guard enforces (not in MuleNet)

| Column | Panel | Content and behaviour | Features |
|---|---|---|---|
| Left | `SECTIONS` | List: Roles & tools, Data scopes, Limits, Approvals, Egress allowlist, Redaction, Document classification, Thresholds. Click scrolls the centre. | F26, F27 |
| Centre | `POLICY` | Read view: role × tool matrix (✓ cyan / ✗ dim), data scopes per role, approval rules (`issue_refund when amount > 10000`), egress domains as chips, classification table with coloured badges, redaction lists. `EDIT JSON` switches to a mono editor with line numbers. | F26, F27 |
| Right | `CHANGES` | While editing: validation result live (green "valid" or magenta list of problems from the server), CTA `SAVE POLICY`, `DISCARD`. Shows "Saved as admin_riya" or the 403 reason (non-admin or `ALLOW_POLICY_EDIT=false`). | F28 |

---

## 5. What moves where (current dashboard → new)

| Current | New home |
|---|---|
| SidebarNav (7 items) | Header tabs |
| TopBar mode / layers / role / reset / data source | Header row 2 |
| OverviewTab tiles, trend, donut | RESULTS → session panel; counts also in tab badges |
| OverviewTab scenario deck, StackedScenarioDeck | MISSION stepper |
| DefenseCore3D | MISSION and INVESTIGATE canvas |
| ChatPanel | CONSOLE centre |
| LiveFeed / Telemetry tab | CONSOLE right + bottom ticker |
| ApprovalsTab | APPROVALS |
| IncidentsTab + IncidentModal | INVESTIGATE |
| MetricsTab | RESULTS + TEST LAB |
| PolicyTab | POLICY |

Nothing is dropped.

## 6. Build notes

- Same `api.js` contract and backend; no API changes are needed (all data already exists).
  The new UI also consumes `guard_changed`, `test_progress`, `test_finished`, `expires_at`,
  `incident_id`, `/api/documents/:id`, which today's UI ignores.
- Fonts via Google Fonts link in `client/index.html`; tokens as CSS variables in `index.css`.
- Keep three.js and Recharts; no new runtime libraries.
- Hardcoded marketing text in today's Metrics tab ("35 cases", "BLOCKED" on every tile,
  "0 / 5 breaches") is replaced by values from the API.
