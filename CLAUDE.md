# AgentShield X

Project: AgentShield - hackathon prototype for track CY-03 "AI Agent Security Guard".
Goal: a security layer that monitors a demo business AI agent's inputs, tool
calls and outputs. It flags prompt injection, enforces role permissions,
blocks data leaks to unauthorised destinations, requires human approval for
sensitive actions, logs every block with a plain-language explanation, and
lets legitimate tasks continue.

Company (fictional): Nimbus Retail Pvt Ltd, domain nimbusretail.in.
Demo agent name: **NimbusAssist**.
Users / roles: admin_riya (admin), hr_karan (hr), intern_aman (intern).

## Hard rules
- Everything is fictional and sandboxed. Tools are MOCKS that only read/write
  JSON files in server/data. Never send real email or call real services.
- Stack: Node 20 + Express (server/), React + Vite + Tailwind (client/),
  Recharts, Server-Sent Events. LLM via a single wrapper server/llm.js that
  supports Groq (OpenAI-compatible) and Gemini, chosen by env LLM_PROVIDER.
- Two model slots in the wrapper:
  - `AGENT_MODEL` - runs the agent loop (temperature 0). Pick the model on
    which the poisoned-invoice attack succeeds with guard OFF >= 7/10 times.
  - `JUDGE_MODEL` - small fast model, used ONLY for the input-scanner
    classifier (on suspicious text) and the optional incident report.
  - Env: `LLM_PROVIDER`, `AGENT_MODEL`, `JUDGE_MODEL`, `DEMO_MODE=cached`.
- Plain JavaScript (ES modules), no TypeScript, no database.
- The user's role always comes from the server-side users.json via user_id,
  never from message text.
- Guard has three modes, set via /api/guard:
  - `off` - no checks; only a grey "unguarded" event is logged. Attacks must
    succeed so the demo shows the difference.
  - `monitor` - checks run and are logged with `would_block: true`, but the
    action is NOT stopped.
  - `enforce` - full guard.
- Per-layer toggles (`scanner`, `firewall`, `approval`, `egress`), each can be
  switched independently to prove defense in depth.
- Intent alignment check is rule-based (keyword -> allowed tools map), not an
  LLM call.
- Fail closed: if the classifier errors or times out, the decision is BLOCK.
- Keep code simple, readable, commented. Favour working end-to-end over
  completeness.

## Guard decision object
```
{ stage: input|document|tool|egress|output,
  outcome: ALLOW|REDACT|NEEDS_APPROVAL|BLOCK,
  rule_ids, risk, explanation, layer, would_block }
```
`layer` is one of scanner|firewall|approval|egress. `would_block` is true in
monitor mode when enforce mode would have blocked/paused.

## Frontend
The React dashboard (client/) is built by a teammate against the API
contract. Backend work must keep the contract stable.
