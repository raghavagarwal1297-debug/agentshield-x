# Scanner rules and test samples: file format (for Member 1)

Two files, both plain JSON:

| File | Purpose |
|---|---|
| `server/guard/rules.json` | The ~40 detection rules the Input Scanner uses |
| `server/tests/scanner_samples.json` | 10 malicious + 10 benign strings for the precision/recall test |

## 1. `server/guard/rules.json`

```json
{
  "version": 1,
  "bonuses": { "hidden_text": 25, "obfuscation": 15 },
  "rules": [
    {
      "id": "OVR-01",
      "category": "override",
      "pattern": "\\bexample\\s+phrase\\b",
      "weight": 40,
      "desc": "Short human-readable reason shown in the incident log"
    }
  ]
}
```

### Rule fields

| Field | Required | Rules |
|---|---|---|
| `id` | yes | UPPERCASE letters, digits, dashes. Unique. Suggested prefix per category: `OVR-`, `ROLE-`, `PROBE-`, `EXFIL-`, `AUTH-`, `SEC-`, `HING-` |
| `category` | yes | One of: `override`, `role_hijack`, `prompt_probe`, `exfil`, `authority`, `secrets`, `hinglish`, `other` |
| `pattern` | yes | A JavaScript regular expression, written as a JSON string (see escaping below) |
| `weight` | yes | Number 1-100: how much this rule adds to the risk score |
| `desc` | no, but please add | Plain-language reason, e.g. "asks the assistant to ignore its instructions" |

### Bonuses

Bonuses are added only when at least one rule already matched:

- `hidden_text`: a matching rule fired inside hidden HTML (white text, tiny font, `display:none`, comments)
- `obfuscation`: the text used invisible characters, base64 or spaced-out letters

Both are 0-100. Suggested values: 25 and 15.

### How the score works

- **Risk** is the sum of the weights of every rule that matched, plus any bonuses, capped at 100. Each rule counts once.
- **Thresholds** come from `policy.json`: under 30 is allowed, 30-69 is a warning (the session is marked suspicious), and 70 or more is blocked.
- **Scores from 20 to 69** are borderline. The server asks the LLM classifier and averages the two scores. If the classifier is unavailable, the text is blocked (fail closed).
- **Weight guide:** one strong, unambiguous signal should be 70 or more by itself. Weaker signals that are only dangerous together should be 20-40 each, so that two of them combine past 70.

### What the scanner matches against

The scanner first normalises the text, so you do **not** need patterns for these tricks:

- Everything is lowercased, and matching is case-insensitive anyway.
- Zero-width and bidi characters are removed. Fullwidth letters become normal letters.
- Spaced or dotted letters are joined: `e x a m p l e` becomes `example`.
- Base64 chunks longer than 20 characters are decoded and added to the text.
- HTML tags are stripped, and hidden-element text is kept and matched like normal text.

Write patterns for the normal, lowercase wording. Use `\\s+` between words so extra spaces or line breaks still match.

### Escaping (the most common mistake)

In JSON every backslash must be doubled:

| You want the regex | Write in JSON |
|---|---|
| `\b` (word boundary) | `"\\b"` |
| `\s+` | `"\\s+"` |
| `\.` | `"\\."` |

A single `"\b"` in JSON is a backspace character. The loader rejects it with a clear message instead of silently never matching.

### Checking your file

Bad rules are skipped, never crash the server. Problems are listed by:

- `GET http://localhost:4000/api/health`, under `scanner_rules.problems`
- `node tests/scannerTest.js`, run from `server/`

The file is re-read automatically when it changes, so there is no need to restart the server.

## 2. `server/tests/scanner_samples.json`

```json
{
  "malicious": [
    { "text": "…an injection attempt…", "note": "A1 direct injection" },
    { "text": "…", "source": "document", "note": "A2 hidden text in invoice" }
  ],
  "benign": [
    { "text": "Summarise the Q3 report in 5 points", "note": "legit task" }
  ]
}
```

| Field | Required | Notes |
|---|---|---|
| `text` | yes | The exact string. Use `\n` for new lines, and `\"` for quotes inside HTML |
| `source` | no | `user message` (default), `document` or `web`. This only changes the wording sent to the classifier |
| `note` | no | Which attack ID (A1-A14) or legit task the sample stands for |

Please include **hard benign** samples: normal business text that uses risky-looking words. Examples are an HR email about "ignoring the previous draft", an urgent CEO message about a real meeting, or a question about where API documentation lives. These are what keep the false-positive rate honest.

Run it from `server/`:

```
node tests/scannerTest.js          # heuristics only, no API calls
node tests/scannerTest.js --llm    # also uses the LLM classifier for borderline scores
```

It prints every sample with its score, then precision and recall at the block threshold (70) and at the warn threshold (30).

The 5 held-out attacks (owned by Member 3) must **not** go into either file.

## 3. `server/guard/detectors.json` (DLP patterns)

Extra patterns for sensitive data that the egress guard should recognise in outgoing emails, links and replies.

```json
{
  "version": 1,
  "detectors": [
    {
      "id": "DET-EXAMPLE-01",
      "kind": "other",
      "sensitivity": "high",
      "label": "Short name shown in incidents",
      "pattern": "PATTERN_HERE",
      "case_sensitive": false
    }
  ]
}
```

| Field | Required | Rules |
|---|---|---|
| `id` | yes | UPPERCASE letters, digits, dashes. Unique, e.g. `DET-PHONE-01` |
| `kind` | yes | One of `phone`, `email`, `pan`, `aadhaar`, `salary`, `secret`, `other` |
| `sensitivity` | yes | `high` or `critical` |
| `label` | no | Plain-language name, e.g. "Indian mobile number" |
| `pattern` | yes | JavaScript regex as a JSON string; the same doubled-backslash rule as `rules.json` applies |
| `case_sensitive` | no | Default `false` |

Unlike scanner rules, detectors run on the original text, without the clean-up step. Problems show under `dlp_detectors.problems` in `GET /api/health`. The file reloads automatically when it changes.
