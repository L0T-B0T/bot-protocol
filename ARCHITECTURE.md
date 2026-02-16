# Bot-Protocol Architecture Discussion
## The "Two Brain" Problem & Middleware Solutions

**Date:** 2026-02-16  
**Participants:** Michael, Lotbot, with context from Alex, Clawcos, Mantis  
**Status:** Analysis complete, awaiting decision

---

## Table of Contents
1. [The Problem](#the-problem)
2. [Solutions Explored](#solutions-explored)
3. [Risk Analysis](#risk-analysis)
4. [Recommendation](#recommendation)
5. [Next Steps](#next-steps)

---

## The Problem

### Current State (v0.1 - Library Approach)
The bot-protocol works as a **library**. When a protocol message arrives:

```
Discord: [REQUEST → @Lotbot]
         From: Mantis
         Task: Check weather in Paris
         Depth: 1/5

↓ (OpenClaw sees @mention, triggers agent)

Agent sees raw message, must:
  1. Recognize it's a protocol message
  2. Call parse() manually
  3. Extract the task
  4. Do the work
  5. Call buildResponse() manually
  6. Format reply
  7. Send back to Discord
```

**Problem:** Agent is manually handling protocol logic. Not elegant.

### The Ideal (True Middleware)

Protocol handler sits **in front** of the agent as preprocessing:

```
Discord: [REQUEST → @Lotbot]
         From: Mantis
         Task: Check weather in Paris
         Depth: 1/5

↓ (Protocol middleware intercepts)

Middleware:
  - Parses protocol message
  - Extracts: "Mantis is asking you to check weather in Paris"
  - Passes to agent as natural language

↓ (Agent sees clean request)

Agent: "18°C, partly cloudy"

↓ (Middleware intercepts response)

Middleware:
  - Formats: [RESPONSE → @Mantis]
              Result: 18°C, partly cloudy
              Depth: 2/5
  - Sends to Discord

Agent never sees protocol syntax ✅
```

**Requirement:** OpenClaw needs message preprocessing hooks (don't exist yet)

---

## Solutions Explored

### Option 1: Library Approach (Current v0.1)
**What:** Agent manually calls parse() and buildResponse()

**Pros:**
- Works today with zero infrastructure
- Simple to understand
- Single process (no coordination)
- Already shipped and tested

**Cons:**
- Protocol logic leaks into agent code
- Agent must remember to parse protocol messages
- Not transparent/automatic
- Every agent must implement same logic

**Verdict:** ✅ Shipped. Works. Not elegant but functional.

---

### Option 2: Separate Channel
**What:** Create `#bot-protocol` channel that main agent doesn't watch

**How it works:**
1. Main agent config excludes `#bot-protocol` (no access)
2. Protocol handler (cron or daemon) watches that channel only
3. Handler sees protocol message → parses → sends clean task via `sessions_send`
4. Main agent responds naturally (in its own session)
5. Handler sees response → formats back to protocol → posts to `#bot-protocol`

**Pros:**
- No "two brain" problem (main agent never sees protocol channel)
- Protocol isolated from normal conversation
- Can use real @mentions in protocol channel

**Cons:**
- Fragmented conversations (protocol in one channel, discussion in another)
- Humans can't easily follow bot coordination
- Still need handler process (cron or daemon)

**Verdict:** ⚠️ Solves two-brain problem but feels fragmented

---

### Option 3: No @Mentions + Periodic Polling (Cron)
**What:** Protocol messages use plain text (no Discord @mention), cron polls for them

**How it works:**
1. Bots post protocol messages as plain text: `[REQUEST → Lotbot]` (not `@Lotbot`)
2. Discord requireMention=true → main agent ignores them
3. Cron job (every 30-60s):
   - Checks Discord session history via `sessions_list` + `sessions_history`
   - Detects protocol messages addressed to you (regex match)
   - Parses with bot-protocol library
   - Sends clean task to main session via `sessions_send`
4. Main agent responds naturally
5. Next cron run:
   - Sees response in main session
   - Formats back to protocol
   - Posts to Discord via `message` tool

**Pros:**
- No "two brain" problem (main agent ignores non-@mention messages)
- Works in same channel (not fragmented)
- Uses existing OpenClaw APIs (sessions, message tool)
- Cron is simple (no long-running process)

**Cons:**
- **30-60s polling delay** per interaction (slow round trips)
- **State management complexity:**
  - Which protocol messages already processed?
  - Which tasks sent to main agent (pending responses)?
  - How to correlate agent responses to protocol RequestIds?
  - Where to persist state across cron runs?
- **Concurrent request handling:**
  - Multiple protocol messages between cron runs
  - Multiple agent responses to track
  - Which response goes to which RequestId?
- **Race conditions:**
  - Cron runs while agent still thinking
  - Duplicate processing if state tracking fails
- **Error recovery:**
  - Cron timeout mid-process → lost messages
  - State corruption → duplicate responses
- **Cost:** 2,880 cron runs/day (even if most are NO_REPLY)
- **Debugging:** 3 moving pieces (Discord, cron state, main session)

**Verdict:** ⚠️ Solves two-brain but introduces complex state machine

---

### Option 4: No @Mentions + Long-Running Daemon
**What:** Same as Option 3, but daemon instead of cron

**How it works:**
Same flow as Option 3, but:
- Daemon runs continuously (not periodic)
- Maintains in-memory state (faster, cleaner)
- Can respond immediately (no 30s polling delay)
- Better error handling and logging

**Pros:**
- All the pros of Option 3
- **Faster:** no 30-60s delay, near-instant processing
- **Better state management:** in-memory (no file coordination)
- **Easier correlation:** track pending requests in memory
- **Cleaner error recovery:** can retry, handle timeouts properly

**Cons:**
- **Process management:**
  - Must keep daemon running (systemd/pm2/launchd)
  - Crashes = missed messages
  - Needs auto-restart and health monitoring
  - Resource leaks over time?
- **Deployment complexity:**
  - Another service to deploy/configure
  - Another point of failure
  - Needs separate logging/monitoring
- **State persistence:**
  - In-memory state lost on crash
  - Need to persist to disk anyway (back to file coordination)
  - Or accept losing pending request tracking on restart
- **Authentication/security:**
  - Daemon needs OpenClaw API access
  - Token management
  - Gateway URL configuration
- **Still not true middleware:**
  - Agent still "involved" (receives tasks via sessions_send)
  - Not transparent preprocessing
  - Coordination via sessions is a workaround

**Verdict:** ✅ Solves two-brain, much better than cron, but complex deployment

---

### Option 5: Wait for OpenClaw Core Preprocessing Hooks
**What:** Don't build workarounds, wait for proper middleware support in OpenClaw

**How it would work:**
```javascript
// OpenClaw config (future)
{
  channels: {
    discord: {
      preprocessing: [
        {
          skill: "bot-protocol",
          handler: "preprocessMessage"
        }
      ]
    }
  }
}

// bot-protocol/lib/middleware.js
export function preprocessMessage(rawMessage, context) {
  const parsed = parse(rawMessage.content);
  if (parsed && parsed.to === context.botName) {
    return {
      intercepted: true,
      naturalLanguage: `${parsed.from} is asking you to ${parsed.task}`,
      metadata: { requestId: parsed.requestId, depth: parsed.depth }
    };
  }
  return { intercepted: false };
}

export function postprocessResponse(agentResponse, metadata) {
  return buildResponse({
    to: metadata.originalSender,
    requestId: metadata.requestId,
    result: agentResponse.content,
    depth: incrementDepth(metadata.depth)
  });
}
```

**Pros:**
- ✅ **True middleware** - agent never sees protocol syntax
- ✅ **Transparent** - works automatically for all agents
- ✅ **Clean architecture** - proper separation of concerns
- ✅ **No coordination overhead** - runs in-process
- ✅ **No state tracking** - handles message flow directly
- ✅ **Instant** - no polling delay
- ✅ **Reliable** - no separate process to crash

**Cons:**
- ❌ **Doesn't exist yet** - requires OpenClaw core changes
- ❌ **Unknown timeline** - when will hooks be added?
- ❌ **Blocks current use** - can't use protocol until this lands

**Verdict:** 🎯 The right long-term solution, but doesn't help us today

---

## Risk Analysis

### Daemon vs Cron vs Library

| Risk Factor | Library (v0.1) | Cron | Daemon | Core Hooks (future) |
|-------------|----------------|------|--------|---------------------|
| **Two-brain problem** | Agent handles it | Solved (no @mention) | Solved (no @mention) | Solved (preprocessing) |
| **Response latency** | Instant | 30-60s delay | Near-instant | Instant |
| **State complexity** | None (stateless) | High (file-based) | Medium (in-memory) | None (in-process) |
| **Deployment** | Zero overhead | Cron job only | Full daemon process | Zero overhead |
| **Debugging** | Simple (one place) | Complex (3 pieces) | Medium (2 pieces) | Simple (one place) |
| **Reliability** | Very high | Medium (state corruption) | Medium (process crashes) | Very high |
| **Code in agent** | Protocol logic mixed in | Clean separation | Clean separation | Perfect separation |
| **Cost** | Low | Medium (2880 runs/day) | Low (persistent) | Low |

---

## Recommendation

### Hybrid Approach: Ship Now, Build Prototype, Push for Core

**Phase 1: Ship Library (v0.1)** ✅ DONE
- Library approach works today
- Zero infrastructure overhead
- Gets real usage data
- Proves the protocol concept

**Phase 2: Build Daemon Prototype**
- Develop middleware logic externally
- Test with multi-bot workflows
- Identify pain points
- **Daemon IS the middleware logic, just running outside OpenClaw**
- When core hooks land, 80% of daemon code survives (just changes how it delivers to agent)

**Phase 3: Push for OpenClaw Core Hooks**
- Use daemon prototype as proof-of-concept
- Show what preprocessing hooks would enable
- Demonstrate the value to OpenClaw team
- Build consensus around the API design

**Phase 4: True Middleware (v0.2)**
- When OpenClaw adds preprocessing hooks
- Port daemon logic into proper middleware
- Deprecate external daemon
- Ship clean, integrated solution

---

## Why Daemon is Worth Building (Even Without Core Hooks)

### The Key Insight:
**The daemon IS the middleware, just running externally.**

**What the daemon does:**
1. Watches Discord for protocol messages
2. Parses them with bot-protocol library
3. Translates to natural language
4. Delivers to agent (currently via `sessions_send`)
5. Watches for agent response
6. Translates back to protocol format
7. Sends to Discord

**When OpenClaw adds preprocessing hooks, we just change step 4:**
- ~~Delivers to agent via `sessions_send`~~
- ✅ Preprocesses message in OpenClaw pipeline → agent sees natural language directly

**80% of the daemon code survives.** We're building the middleware logic now, just running it externally as a prototype.

### Value Proposition

**Library Approach (v0.1):**
```javascript
// Agent has to do this EVERY TIME
const parsed = parse(message);
if (parsed && parsed.to === 'Lotbot') {
  // handle task
  const response = buildResponse(...);
  // send response
}
```
**Problem:** Protocol concerns leak into agent logic everywhere

**Daemon Approach:**
```
Agent receives: "Check the weather in Paris" (natural language)
Agent responds: "18°C, partly cloudy"
```
**Protocol logic completely isolated in daemon**

**When OpenClaw Adds Hooks:**
We just plug the daemon into OpenClaw's preprocessing pipeline. Same translation logic, cleaner integration.

---

## Next Steps

### Immediate (This Week)
1. ✅ Library (v0.1) is shipped and tested
2. 📋 Document this architecture discussion (this file)
3. 🗳️ **Decision needed:** Build daemon prototype or wait for core hooks?

### If Building Daemon:
1. Create `bot-protocol-daemon` repo
2. Implement core logic:
   - Discord session watcher
   - Protocol message detector/parser
   - Natural language translator
   - Response formatter
3. Test locally with multiple bots
4. Document deployment (systemd/pm2/launchd)
5. Use as proof-of-concept for OpenClaw preprocessing hooks

### If Waiting for Core:
1. Continue using library approach
2. Gather pain points from real usage
3. Draft OpenClaw preprocessing hook proposal
4. Engage with OpenClaw team on feature request

---

## Questions for the Team

1. **Alex:** Do you want to see daemon prototype first, or push for core hooks directly?
2. **Clawcos:** Would you use daemon locally for testing, or prefer to wait for proper integration?
3. **Mantis:** Any concerns about daemon approach we haven't covered?
4. **Michael:** What's your appetite for deploying/managing a daemon process?

---

## Appendix: Two-Brain Problem Explained

### The Problem
When protocol message with @mention arrives:

```
Discord receives: [REQUEST → @Lotbot]
                  From: Mantis
                  Task: Check weather

↓ (Two things happen simultaneously)

1. OpenClaw Discord integration:
   - Sees @Lotbot mention
   - Triggers requireMention
   - Sends to main agent session
   - Agent processes and responds

2. Protocol handler (cron/daemon):
   - Also sees same message
   - Also parses it
   - Also sends to agent (via sessions_send)
   - Agent processes AGAIN and responds AGAIN

Result: Two brains, both responding, chaos
```

### The Solutions
**All non-core solutions require:** Protocol messages DON'T use real @mentions

Either:
- Separate channel (main agent doesn't watch it)
- Plain text in same channel (requireMention ignores it)

Then only handler sees protocol messages → one brain ✅

**Core hooks solution:** Preprocessing intercepts BEFORE agent sees mention → one brain ✅

---

**End of Document**

*Last updated: 2026-02-16*  
*Authors: Lotbot, with input from Michael*  
*For: Alex, Clawcos, Mantis, OpenClaw community*
