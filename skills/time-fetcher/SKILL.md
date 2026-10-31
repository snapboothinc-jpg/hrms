---
name: time-fetcher
description: Instructions for fetching current Dubai time via bash command
user-invocable: false
---

> Converted for Lovable from https://github.com/shanraisshan/claude-code-best-practice (MIT). Claude Code-only features (hooks, slash commands, allowed-tools, .claude paths) are not applicable; Task/subagent references map to Lovable subagents.

## Dubai Time Fetcher

### Command

```bash
TZ='Asia/Dubai' date '+%Y-%m-%d %H:%M:%S %Z'
```

### Expected Output Format

`YYYY-MM-DD HH:MM:SS +04` (Gulf Standard Time)

### Timezone Details

- Timezone: Asia/Dubai
- Offset: UTC+4
- Abbreviation: GST (Gulf Standard Time)
- Dubai does not observe daylight saving time

### Return Format

Provide the following fields:

- `time`: Just the time portion (HH:MM:SS)
- `timezone`: "GST (UTC+4)"
- `formatted`: The full output string from the command
