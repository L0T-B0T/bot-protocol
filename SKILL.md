---
name: bot-protocol
description: Send, receive, and track structured protocol messages with other bots over shared channels (Discord, Telegram, etc.). Enables reliable bot-to-bot communication with depth tracking, timeouts, and conversation state.
---

# Bot-to-Bot Protocol

Structured messaging protocol for bot-to-bot communication over any text channel.

## Quick Start

```javascript
const { parse } = require('{baseDir}/lib/parser.js');
const { buildRequest, buildResponse } = require('{baseDir}/lib/builder.js');
const state = require('{baseDir}/lib/state.js');

// Parse incoming message
const parsed = parse(rawMessageText);
if (parsed && parsed.to === 'YourBotName') {
  // Handle the protocol message
}

// Send a request
const request = buildRequest({
  to: 'OtherBot',
  from: 'YourBotName',
  task: 'Check the weather in Paris',
  depth: { current: 1, max: 5 }
});
// Send `request` to the channel
```

## When to Use This Skill

**Use the protocol when:**
- Another bot sends you a structured message (code block with `[TYPE → @YourName]`)
- You need to delegate a task to another bot
- You want to track multi-step conversations with other bots
- You need reliable async communication with depth limiting

**Don't use for:**
- Regular human conversation
- Unstructured bot replies
- Simple one-off questions

## Message Flow

### Receiving Messages

On **every incoming message**, check if it's a protocol message:

```javascript
const { parse } = require('{baseDir}/lib/parser.js');
const state = require('{baseDir}/lib/state.js');

const parsed = parse(messageText);

if (!parsed) {
  // Not a protocol message - handle normally
  return;
}

if (parsed.to !== 'YourBotName' && parsed.to !== 'all') {
  // Not addressed to you - ignore
  return;
}

// Track the message
await state.track(parsed);

// Handle based on type
switch (parsed.type) {
  case 'REQUEST':
  case 'HANDOFF':
    await handleRequest(parsed);
    break;
  case 'CLARIFY':
    await handleClarify(parsed);
    break;
  case 'RESPONSE':
    await handleResponse(parsed);
    break;
  case 'BROADCAST':
    await handleBroadcast(parsed);
    break;
}
```

### Sending Messages

**Always use the builder** - never hand-format protocol messages:

```javascript
const { buildRequest, buildResponse, buildClarify, buildHandoff, buildBroadcast } = require('{baseDir}/lib/builder.js');

// Request another bot to do something
const msg = buildRequest({
  to: 'Mantis',
  from: 'Lotbot',
  task: 'Check Mac Mini CLI version and report if outdated',
  context: 'Running weekly system audit',
  depth: { current: 1, max: 5 },
  priority: 'normal'
});
// Send msg to the channel

// Respond to a request
const response = buildResponse({
  to: parsed.from,
  from: 'Lotbot',
  requestId: parsed.requestId,
  status: 'done',
  result: 'CLI is up to date (v2026.2.13)',
  depth: { current: parsed.depth.current + 1, max: parsed.depth.max }
});
// Send response to the channel
```

## Handling Requests

When you receive a REQUEST or HANDOFF:

1. **Parse and validate**
2. **Execute the task**
3. **Respond with RESPONSE**

```javascript
async function handleRequest(parsed) {
  const { from, requestId, task, depth } = parsed;
  
  try {
    // Execute the task
    const result = await doTheTask(task);
    
    // Build response
    const response = buildResponse({
      to: from,
      from: 'YourBotName',
      requestId,
      status: 'done',
      result,
      depth: { current: depth.current + 1, max: depth.max }
    });
    
    // Send response
    await sendToChannel(response);
    
  } catch (error) {
    // Failed - send error response
    const response = buildResponse({
      to: from,
      from: 'YourBotName',
      requestId,
      status: 'failed',
      result: error.message,
      depth: { current: depth.current + 1, max: depth.max }
    });
    
    await sendToChannel(response);
  }
}
```

## Handling Clarifications

If you need more info to complete a request, send a CLARIFY:

```javascript
const clarify = buildClarify({
  to: parsed.from,
  from: 'YourBotName',
  requestId: parsed.requestId,
  question: 'Which version should I check against?',
  depth: { current: parsed.depth.current + 1, max: parsed.depth.max }
});
// Send clarify to channel
```

When you receive a CLARIFY, answer inline (not in protocol format):

```javascript
async function handleClarify(parsed) {
  // Answer the question in plain text, referencing the RequestId
  const answer = `Re: ${parsed.requestId}: Check against the latest stable release.`;
  await sendToChannel(answer);
}
```

## Depth Enforcement

**Critical rule:** At depth 5/5, you **MUST** send a RESPONSE. You cannot send REQUEST, HANDOFF, or CLARIFY.

The builder will throw an error if you try to violate this:

```javascript
try {
  const msg = buildRequest({
    to: 'OtherBot',
    from: 'YourBot',
    task: 'Do something',
    depth: { current: 5, max: 5 } // ERROR: Can't send non-terminal at max depth
  });
} catch (err) {
  // err: "Depth limit reached (5/5). Cannot send REQUEST. Must send RESPONSE instead."
}
```

When at max depth, wrap up the conversation:

```javascript
if (depth.current === depth.max) {
  // Must complete or fail - no more forwarding
  const response = buildResponse({
    to: parsed.from,
    from: 'YourBot',
    requestId: parsed.requestId,
    status: 'partial',
    result: 'Max depth reached. Partial result: ...',
    depth
  });
  await sendToChannel(response);
}
```

## Conversation State

Track open requests and check for timeouts:

```javascript
const state = require('{baseDir}/lib/state.js');

// Get all open conversations
const open = await state.list({ status: 'open' });

// Get a specific conversation
const conv = await state.get('lotbot-abc123');

// Check for timeouts (run periodically)
const timedOut = await state.checkTimeouts();
if (timedOut.length > 0) {
  console.log(`Timed out: ${timedOut.join(', ')}`);
}

// Cleanup old completed conversations (run daily)
const removed = await state.cleanup(24 * 60 * 60 * 1000); // older than 24h
```

## Message Types

### REQUEST
Ask another bot to do something:
```
[REQUEST → @BotName]
From: YourBot
RequestId: yourbot-abc123
Task: Check the weather in Paris
Context: User asked for travel advice
Depth: 1/5
Priority: normal
```

### RESPONSE
Reply to a REQUEST, CLARIFY, or HANDOFF:
```
[RESPONSE → @RequesterBot]
From: YourBot
RequestId: requester-xyz789
Status: done
Result: Weather in Paris: 18°C, partly cloudy
Depth: 2/5
```

### CLARIFY
Ask for more information:
```
[CLARIFY → @RequesterBot]
From: YourBot
RequestId: requester-xyz789
Question: Which date? Today or tomorrow?
Depth: 2/5
```

### HANDOFF
Pass a request to another bot:
```
[HANDOFF → @AnotherBot]
From: YourBot
RequestId: yourbot-abc123
Task: Check the weather in Paris
Context: Original request from User, I don't have weather API
Depth: 2/5
Callback: @YourBot
```

### BROADCAST
Announce something to all bots:
```
[BROADCAST → @all]
From: YourBot
RequestId: yourbot-bcast-001
Message: Going offline for maintenance in 5 minutes
Depth: 1/5
```

## Edge Cases

**Malformed messages:** Parser returns `null` - ignore and continue

**Missing RequestId:** Parser rejects the message

**Depth violation:** Builder throws error - catch and send RESPONSE instead

**Duplicate RequestId:** State tracker warns but processes (no dedup in v0.1)

**Bot talking to itself:** Allowed but depth-capped

**Concurrent requests:** Each gets its own state entry

## Files

- `lib/parser.js` - Parse protocol messages from raw text
- `lib/builder.js` - Construct well-formed messages
- `lib/state.js` - Track conversations and timeouts
- State file: `~/.openclaw/workspace/bot-protocol-state.json`

## Notes

- Channel agnostic - works on Discord, Telegram, any text channel
- No webhooks or API - pure message-based
- Stateless between invocations - state loaded from file each time
- Default timeouts: CLARIFY 10 min, REQUEST/HANDOFF 30 min
