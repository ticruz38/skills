# Skill Examples (SKILL.md Format)

Complete working examples using the **SKILL.md-native** approach.

---

## Three Templates

### 1. `binance/` - API Skill with Auth

**Files:**
- `SKILL.md` - Documentation + capabilities
- `onboard.yaml` - Questions for API keys
- `binance.sh` - Bash script entry point

**Type:** Script (stateless, fork-exec)

**Shows:**
- API authentication (env vars)
- Onboarding questions (secrets)
- HMAC signature generation
- Testnet vs live switching

**Usage:**
```bash
cd binance
./binance.sh balance BTC
./binance.sh ticker BTCUSDT
```

---

### 2. `calendar/` - HTTP API Service

**Files:**
- `SKILL.md` - Documentation + HTTP endpoints
- `onboard.yaml` - OAuth questions
- `calendar.py` - Flask HTTP service
- `requirements.txt` - Python deps

**Type:** API (stateful, HTTP)

**Shows:**
- HTTP service pattern
- OAuth token handling
- Health checks
- REST API design

**Usage:**
```bash
cd calendar
pip install -r requirements.txt
python3 calendar.py &
curl http://localhost:5000/health
curl http://localhost:5000/events?days=7
```

---

### 3. `summarizer/` - No-Config Skill

**Files:**
- `SKILL.md` - Documentation only
- `summarize.js` - Node.js script (no deps!)
- `onboard.yaml` - Empty (optional)

**Type:** Script (no onboarding needed)

**Shows:**
- Works immediately
- Optional env vars
- No dependencies
- Graceful degradation

**Usage:**
```bash
cd summarizer
./summarize.js "Long text to summarize..."
./summarize.js "Long text..." 100
```

---

## Quick Comparison

| Aspect | binance | calendar | summarizer |
|--------|---------|----------|------------|
| **Runtime** | Bash | Python | Node.js |
| **Onboarding** | Required (API keys) | Required (OAuth) | None |
| **Type** | Script | API service | Script |
| **Stateful** | No | Yes | No |
| **Dependencies** | curl, jq | flask, google-api | None (node built-in) |
| **Complexity** | Medium | High | Low |

---

## File Structure

Every skill needs at minimum:

```
skill-name/
├── SKILL.md          # REQUIRED: Docs + metadata frontmatter
└── [entry-point]     # REQUIRED: Script or binary named in SKILL.md
```

Optional:

```
skill-name/
├── SKILL.md
├── onboard.yaml      # OPTIONAL: Only if you need to ask questions
├── [entry-point]
└── [supporting files]
```

---

## SKILL.md Format

```markdown
---
name: my-skill                    # Skill identifier
description: "What it does"       # Shown to users
version: 1.0.0
author: your-name
entry: ./my-script.sh             # How to execute
type: script                      # script, api, or llm-tool
port: 5000                        # For type: api
health_path: /health              # For type: api
---

# My Skill

Description here.

## Capabilities

- `command [arg]` - Description
  - Returns: JSON format
  - Example: `my-script.sh command arg`

## Setup

Any setup instructions.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `API_KEY` | Yes | API key |
| `DEBUG` | No | Debug mode (default: false) |
```

---

## onboard.yaml Format

```yaml
# Optional - omit if no questions needed
questions:
  - key: api_key                    # Unique ID
    question: "Enter API key:"      # What user sees
    type: secret                    # secret | text | boolean | number | choice
    env_var: API_KEY                # Where answer is stored
    required: true                  # Must answer?
    default: "optional-default"     # Pre-filled value
    help: "Additional context"      # Shown alongside question
    
  - key: environment
    question: "Which environment?"
    type: choice
    options: [production, staging, development]
    default: staging
    env_var: ENV
```

---

## Installation Flow

```bash
# 1. Install skill
npx skills add https://github.com/ticruz38/skills --skill binance

# 2. Skill is cloned to ~/.openclaw/skills/binance/

# 3. SKILL.md is parsed
#    - Extract entry point: ./binance.sh
#    - Extract type: script

# 4. onboard.yaml is checked
#    - If exists: ask questions
#    - Answers saved to ~/.openclaw/skills/binance/.env

# 5. Skill is ready
#    - Script: just run it
#    - API: start service, call HTTP endpoints
```

---

## Capability Discovery

No need to duplicate capabilities in YAML! They're parsed from SKILL.md:

```markdown
## Capabilities

- `balance [asset]` - Get balance
  - Returns: `{ "asset": "BTC", "free": "0.5" }`
```

Parsed as:
```json
{
  "name": "balance",
  "params": ["asset"],
  "returns": "{ \"asset\": \"BTC\", \"free\": \"0.5\" }"
}
```

---

## Testing Your Skill

### Local Testing

```bash
# Script skill
cd skills/my-skill
MY_VAR=value ./entry.sh command arg

# API skill
cd skills/my-skill
python3 server.py &
curl http://localhost:5000/health
```

### Integration Testing

```bash
# Install locally
mkdir -p ~/.openclaw/skills
cp -r skills/my-skill ~/.openclaw/skills/

# Test entry point
~/.openclaw/skills/my-skill/entry.sh command
```

---

## Best Practices

### Do:
- ✅ Keep entry point simple
- ✅ Return JSON for machine parsing
- ✅ Handle errors gracefully
- ✅ Support `--help` / `-h`
- ✅ Use environment variables for config
- ✅ Include health check (for API type)

### Don't:
- ❌ Require npm install for simple scripts
- ❌ Store state in files (use env vars)
- ❌ Log secrets
- ❌ Hardcode credentials
- ❌ Make network calls in health check (keep it fast)

---

## Choosing Your Approach

### Use Script (binance, summarizer) when:
- Stateless operations
- Simple command-response
- No need for persistent connections
- Want zero dependencies (bash)

### Use API (calendar) when:
- Need to maintain connections (DB, OAuth tokens)
- Multiple capabilities with shared state
- Want HTTP interface for flexibility
- Need background processing

---

## Next Steps

1. Read [SKILL_INTEGRATION.md](../SKILL_INTEGRATION.md) for full spec
2. Copy the example closest to your use case
3. Modify SKILL.md with your capabilities
4. Add onboard.yaml only if you need config
5. Implement your entry point
6. Test locally
7. Push to ticruz38/skills repo
