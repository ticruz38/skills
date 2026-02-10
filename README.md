# OpenClaw Skills Collection

A collection of agentic skills for Claude Code, OpenCode, and other AI assistants.

## Available Skills

| Skill | Description |
|-------|-------------|
| `google-oauth` | Google OAuth2 authentication for Gmail, Calendar, Drive, Sheets |
| `query-agent` | Natural language to SQL with schema discovery |
| `luxembourg-vat-xml` | Luxembourg VAT declarations in eCDF XML format |
| `file-ingestion` | Ingest CSV/JSON/XML/Excel into databases with auto-schema |

## Installation

### List available skills
```bash
npx skills add yourusername/openclaw-skills --list
```

### Install a specific skill
```bash
npx skills add yourusername/openclaw-skills --skill google-oauth
```

### Install all skills
```bash
npx skills add yourusername/openclaw-skills --all
```

## Structure

```
skills/
├── google-oauth/      # Google OAuth2 integration
├── query-agent/       # SQL query agent
├── luxembourg-vat-xml/# Luxembourg VAT XML
└── file-ingestion/    # File ingestion pipeline
```

Each skill follows the [Agent Skills specification](https://agentskills.io).
