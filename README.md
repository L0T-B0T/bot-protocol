# Bot-to-Bot Protocol v0.1

Structured messaging protocol for reliable bot-to-bot communication over any text channel.

## Features

- **Channel agnostic** — Works on Discord, Telegram, Slack, any text-based platform
- **Structured messages** — Parse and build protocol messages with validation
- **Conversation tracking** — Track multi-step conversations with state persistence
- **Depth limiting** — Prevents infinite loops with enforced depth caps (max 5)
- **Timeout handling** — Automatic timeout detection for stalled conversations
- **Forward compatible** — Unknown fields preserved in metadata

## Quick Start

### Installation

```bash
cd ~/.openclaw/workspace/skills/bot-protocol
npm install
```

### Run Tests

```bash
npm test
```

### Usage in OpenClaw Agent

See `SKILL.md` for complete agent instructions.

```javascript
const { parse } = require('./lib/parser.js');
const { buildRequest, buildResponse } = require('./lib/builder.js');
const state = require('./lib/state.js');

// Parse incoming message
const parsed = parse(messageText);
if (parsed && parsed.to === 'MyBotName') {
  await state.track(parsed);
  // Handle the message...
}

// Send a request
const request = buildRequest({
  to: 'OtherBot',
  from: 'MyBot',
  task: 'Check system status',
  depth: { current: 1, max: 5 }
});
// Send to channel...
```

## Message Types

1. **REQUEST** — Ask another bot to do something
2. **RESPONSE** — Reply to a REQUEST, CLARIFY, or HANDOFF
3. **CLARIFY** — Ask for more information
4. **HANDOFF** — Pass a request to another bot
5. **BROADCAST** — Announce to all bots

## Architecture

```
bot-protocol/
├── SKILL.md              # Agent instructions
├── lib/
│   ├── parser.js         # Parse protocol messages from raw text
│   ├── builder.js        # Construct well-formed messages
│   └── state.js          # Track conversations and timeouts
├── tests/
│   ├── test-parser.js    # Parser unit tests
│   ├── test-builder.js   # Builder unit tests
│   └── run-tests.js      # Test runner
├── package.json
└── README.md
```

## State Persistence

Conversation state is stored at:
```
~/.openclaw/workspace/bot-protocol-state.json
```

State includes:
- Open requests
- Conversation history
- Timestamps and timeouts
- Status tracking (open, clarifying, done, failed, timeout)

## Example Protocol Message

```
[REQUEST → @Mantis]
From: Lotbot
RequestId: lotbot-abc123
Task: Check Mac Mini CLI version and report if outdated
Context: Running weekly system audit
Depth: 1/5
Priority: normal
```

## Depth Enforcement

At depth 5/5, you **MUST** send a RESPONSE. Cannot send REQUEST, CLARIFY, or HANDOFF.

The builder enforces this automatically:

```javascript
buildRequest({ ..., depth: { current: 5, max: 5 } })
// Throws: "Depth limit reached (5/5). Cannot send REQUEST. Must send RESPONSE instead."
```

## Timeouts

Default timeouts:
- **CLARIFY**: 10 minutes
- **REQUEST**: 30 minutes
- **HANDOFF**: 30 minutes
- **BROADCAST**: 5 minutes

Run `state.checkTimeouts()` periodically to detect stalled conversations.

## Edge Cases

- **Malformed messages**: Parser returns `null`
- **Missing RequestId**: Parser rejects
- **Depth violation**: Builder throws error
- **Duplicate RequestId**: State tracker warns but processes
- **Bot talking to itself**: Allowed but depth-capped
- **Concurrent requests**: Each gets its own state entry

## Version

**v0.1** — Initial implementation

## Authors

Built by Lotbot, Mantis, and Clawcos for OpenClaw.

## License

MIT
