/**
 * Bot-to-Bot Protocol State Tracker
 * Tracks open conversations and timeouts
 */

const fs = require('fs').promises;
const path = require('path');

const STATE_FILE = path.join(
  process.env.HOME || process.env.USERPROFILE,
  '.openclaw',
  'workspace',
  'bot-protocol-state.json'
);

const DEFAULT_TIMEOUTS = {
  CLARIFY: 10 * 60 * 1000, // 10 minutes
  REQUEST: 30 * 60 * 1000, // 30 minutes
  HANDOFF: 30 * 60 * 1000, // 30 minutes
  BROADCAST: 5 * 60 * 1000  // 5 minutes
};

// Simple lock to prevent concurrent read/write races
let stateLock = Promise.resolve();

/**
 * Acquire lock for state operations
 */
function withLock(fn) {
  const wrappedFn = async () => {
    try {
      return await fn();
    } finally {
      // Lock released after fn completes
    }
  };
  
  stateLock = stateLock.then(wrappedFn, wrappedFn);
  return stateLock;
}

/**
 * Load state from disk
 */
async function loadState() {
  try {
    const data = await fs.readFile(STATE_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return {}; // File doesn't exist yet
    }
    throw err;
  }
}

/**
 * Save state to disk
 */
async function saveState(state) {
  const dir = path.dirname(STATE_FILE);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

/**
 * Track a protocol message (add or update conversation)
 */
async function track(parsedMessage) {
  return withLock(async () => {
    const state = await loadState();
    const { requestId, type, from, to } = parsedMessage;

    const now = new Date().toISOString();

    if (!state[requestId]) {
      // New conversation
      state[requestId] = {
        type,
        to,
        from,
        task: parsedMessage.task || parsedMessage.question || parsedMessage.message,
        status: type === 'RESPONSE' ? (parsedMessage.status || 'done') : 'open',
        depth: parsedMessage.depth ? parsedMessage.depth.current : 1,
        createdAt: now,
        updatedAt: now,
        lastType: type, // Track latest message type for timeout calculation
        history: []
      };
    } else {
      // Update existing conversation
      const conv = state[requestId];
      
      if (type === 'RESPONSE') {
        conv.status = parsedMessage.status || 'done';
      } else if (type === 'CLARIFY') {
        conv.status = 'clarifying';
      }
      
      conv.updatedAt = now;
      conv.lastType = type; // Update to latest message type
    }

    // Add to history
    state[requestId].history.push({
      type,
      from,
      to,
      status: parsedMessage.status,
      at: now,
      content: parsedMessage.task || parsedMessage.result || parsedMessage.question || parsedMessage.message
    });

    await saveState(state);
    return state[requestId];
  });
}

/**
 * Get conversation by requestId
 */
async function get(requestId) {
  const state = await loadState();
  return state[requestId] || null;
}

/**
 * List conversations with optional filters
 */
async function list({ status, from, to } = {}) {
  const state = await loadState();
  let conversations = Object.entries(state).map(([id, conv]) => ({
    requestId: id,
    ...conv
  }));

  if (status) {
    conversations = conversations.filter(c => c.status === status);
  }
  if (from) {
    conversations = conversations.filter(c => c.from === from);
  }
  if (to) {
    conversations = conversations.filter(c => c.to === to);
  }

  return conversations;
}

/**
 * Mark a conversation as timed out
 */
async function timeout(requestId, reason = 'timeout') {
  return withLock(async () => {
    const state = await loadState();
    
    if (state[requestId]) {
      state[requestId].status = 'timeout';
      state[requestId].updatedAt = new Date().toISOString();
      state[requestId].history.push({
        type: 'TIMEOUT',
        reason,
        at: new Date().toISOString()
      });
      
      await saveState(state);
    }
    
    return state[requestId] || null;
  });
}

/**
 * Cleanup old conversations
 */
async function cleanup(olderThanMs = 24 * 60 * 60 * 1000) {
  return withLock(async () => {
    const state = await loadState();
    const now = Date.now();
    let removed = 0;

    for (const [requestId, conv] of Object.entries(state)) {
      const updatedAt = new Date(conv.updatedAt).getTime();
      const age = now - updatedAt;

      // Remove if old and completed/failed/timeout
      if (age > olderThanMs && ['done', 'failed', 'timeout'].includes(conv.status)) {
        delete state[requestId];
        removed++;
      }
    }

    if (removed > 0) {
      await saveState(state);
    }

    return removed;
  });
}

/**
 * Check for timeouts and mark conversations as timed out
 */
async function checkTimeouts() {
  const state = await loadState();
  const now = Date.now();
  let timedOut = [];

  for (const [requestId, conv] of Object.entries(state)) {
    if (conv.status !== 'open' && conv.status !== 'clarifying') {
      continue; // Already completed or timed out
    }

    const updatedAt = new Date(conv.updatedAt).getTime();
    // Use lastType (latest message type) for timeout calculation, fallback to type
    const messageType = conv.lastType || conv.type;
    const timeoutMs = DEFAULT_TIMEOUTS[messageType] || DEFAULT_TIMEOUTS.REQUEST;
    const age = now - updatedAt;

    if (age > timeoutMs) {
      await timeout(requestId, `No response after ${Math.floor(age / 1000 / 60)} minutes`);
      timedOut.push(requestId);
    }
  }

  return timedOut;
}

module.exports = {
  track,
  get,
  list,
  timeout,
  cleanup,
  checkTimeouts,
  STATE_FILE
};
