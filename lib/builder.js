/**
 * Bot-to-Bot Protocol Builder
 * Constructs well-formed protocol messages
 */

const { customAlphabet } = require('nanoid');
const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 6);

/**
 * Build a REQUEST message
 */
function buildRequest({ to, from, requestId, task, context, depth, callback, priority }) {
  validateRequired({ to, from, task }, 'REQUEST');
  
  const id = requestId || generateRequestId(from);
  const d = depth || { current: 1, max: 5 };
  
  // Enforce depth limit
  if (d.current === d.max) {
    throw new Error(`Depth limit reached (${d.current}/${d.max}). Cannot send REQUEST. Must send RESPONSE instead.`);
  }

  let message = `\`\`\`\n[REQUEST → @${to}]\n`;
  message += `From: ${from}\n`;
  message += `RequestId: ${id}\n`;
  message += `Task: ${task}\n`;
  if (context) message += `Context: ${context}\n`;
  message += `Depth: ${d.current}/${d.max}\n`;
  if (callback) message += `Callback: ${callback}\n`;
  if (priority) message += `Priority: ${priority}\n`;
  message += `\`\`\``;

  return message;
}

/**
 * Build a RESPONSE message
 */
function buildResponse({ to, from, requestId, status, result, context, depth }) {
  validateRequired({ to, from, requestId }, 'RESPONSE');
  
  if (!status && !result) {
    throw new Error('RESPONSE requires either status or result');
  }

  const d = depth || { current: 1, max: 5 };

  let message = `\`\`\`\n[RESPONSE → @${to}]\n`;
  message += `From: ${from}\n`;
  message += `RequestId: ${requestId}\n`;
  if (status) message += `Status: ${status}\n`;
  if (result) message += `Result: ${result}\n`;
  if (context) message += `Context: ${context}\n`;
  message += `Depth: ${d.current}/${d.max}\n`;
  message += `\`\`\``;

  return message;
}

/**
 * Build a CLARIFY message
 */
function buildClarify({ to, from, requestId, question, depth }) {
  validateRequired({ to, from, requestId, question }, 'CLARIFY');
  
  const d = depth || { current: 1, max: 5 };
  
  // Enforce depth limit
  if (d.current === d.max) {
    throw new Error(`Depth limit reached (${d.current}/${d.max}). Cannot send CLARIFY. Must send RESPONSE instead.`);
  }

  let message = `\`\`\`\n[CLARIFY → @${to}]\n`;
  message += `From: ${from}\n`;
  message += `RequestId: ${requestId}\n`;
  message += `Question: ${question}\n`;
  message += `Depth: ${d.current}/${d.max}\n`;
  message += `\`\`\``;

  return message;
}

/**
 * Build a HANDOFF message
 */
function buildHandoff({ to, from, requestId, task, context, depth, callback, priority }) {
  validateRequired({ to, from, requestId, task }, 'HANDOFF');
  
  const d = depth || { current: 1, max: 5 };
  
  // Enforce depth limit
  if (d.current === d.max) {
    throw new Error(`Depth limit reached (${d.current}/${d.max}). Cannot send HANDOFF. Must send RESPONSE instead.`);
  }

  let message = `\`\`\`\n[HANDOFF → @${to}]\n`;
  message += `From: ${from}\n`;
  message += `RequestId: ${requestId}\n`;
  message += `Task: ${task}\n`;
  if (context) message += `Context: ${context}\n`;
  message += `Depth: ${d.current}/${d.max}\n`;
  if (callback) message += `Callback: ${callback}\n`;
  if (priority) message += `Priority: ${priority}\n`;
  message += `\`\`\``;

  return message;
}

/**
 * Build a BROADCAST message
 */
function buildBroadcast({ from, requestId, message, context, depth }) {
  validateRequired({ from, message }, 'BROADCAST');
  
  const id = requestId || generateRequestId(from);
  const d = depth || { current: 1, max: 5 };

  let msg = `\`\`\`\n[BROADCAST → @all]\n`;
  msg += `From: ${from}\n`;
  msg += `RequestId: ${id}\n`;
  msg += `Message: ${message}\n`;
  if (context) msg += `Context: ${context}\n`;
  msg += `Depth: ${d.current}/${d.max}\n`;
  msg += `\`\`\``;

  return msg;
}

/**
 * Generate a unique request ID
 */
function generateRequestId(botname) {
  const cleanName = botname.toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${cleanName}-${nanoid()}`;
}

/**
 * Increment depth for a reply message
 * IMPORTANT: When replying to a message, always increment the depth
 * @param {object} incomingDepth - Depth from the message you're replying to
 * @returns {object} - Incremented depth { current, max }
 */
function incrementDepth(incomingDepth) {
  if (!incomingDepth || typeof incomingDepth.current !== 'number') {
    throw new Error('incrementDepth requires valid incoming depth { current, max }');
  }
  
  return {
    current: incomingDepth.current + 1,
    max: incomingDepth.max
  };
}

/**
 * Validate required fields
 */
function validateRequired(fields, messageType) {
  for (const [key, value] of Object.entries(fields)) {
    if (!value) {
      throw new Error(`${messageType} requires field: ${key}`);
    }
  }
}

module.exports = {
  buildRequest,
  buildResponse,
  buildClarify,
  buildHandoff,
  buildBroadcast,
  generateRequestId,
  incrementDepth
};
