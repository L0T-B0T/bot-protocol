/**
 * Bot-to-Bot Protocol Parser
 * Parses structured protocol messages from raw text
 */

const VALID_TYPES = ['REQUEST', 'RESPONSE', 'CLARIFY', 'HANDOFF', 'BROADCAST'];
const VALID_STATUSES = ['done', 'partial', 'failed'];
const VALID_PRIORITIES = ['low', 'normal', 'high'];

/**
 * Parse a raw message into a protocol object
 * @param {string} rawText - Raw message text
 * @returns {object|null} - Parsed protocol object or null if not a protocol message
 */
function parse(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return null;
  }

  // Extract code block content (strip triple backticks)
  const codeBlockMatch = rawText.match(/```([^`]+)```/s);
  if (!codeBlockMatch) {
    return null;
  }

  const content = codeBlockMatch[1].trim();
  const lines = content.split('\n');
  
  if (lines.length === 0) {
    return null;
  }

  // Parse first line: [TYPE → @Recipient]
  const headerMatch = lines[0].match(/^\[(\w+)\s*→\s*@(\S+)\]$/);
  if (!headerMatch) {
    return null;
  }

  const [, type, to] = headerMatch;

  // Validate type
  if (!VALID_TYPES.includes(type)) {
    return null;
  }

  // Parse key-value fields
  const result = {
    type,
    to,
    from: null,
    requestId: null,
    task: null,
    result: null,
    context: null,
    depth: null,
    callback: null,
    priority: null,
    status: null,
    question: null,
    message: null,
    meta: {},
    raw: rawText
  };

  let currentKey = null;
  let currentValue = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];

    // Check if this is a new key: value line
    const kvMatch = line.match(/^([A-Za-z]+):\s*(.*)$/);
    
    if (kvMatch) {
      // Save previous key-value if any
      if (currentKey) {
        saveField(result, currentKey, currentValue.join('\n'));
      }
      
      // Start new key-value
      const [, key, value] = kvMatch;
      currentKey = key.toLowerCase();
      currentValue = [value];
    } else if (currentKey) {
      // Multi-line value continuation
      currentValue.push(line);
    }
  }

  // Save final key-value
  if (currentKey) {
    saveField(result, currentKey, currentValue.join('\n'));
  }

  // Validate required fields
  if (!result.from || !result.requestId) {
    return null;
  }

  // Parse depth if present
  if (result.depth) {
    const depthMatch = result.depth.match(/^(\d+)\/(\d+)$/);
    if (depthMatch) {
      result.depth = {
        current: parseInt(depthMatch[1], 10),
        max: parseInt(depthMatch[2], 10)
      };
    } else {
      result.depth = null;
    }
  }

  // Validate type-specific required fields
  if (type === 'REQUEST' && !result.task) return null;
  if (type === 'RESPONSE' && !result.result && !result.status) return null;
  if (type === 'CLARIFY' && !result.question) return null;
  if (type === 'HANDOFF' && !result.task) return null;
  if (type === 'BROADCAST' && !result.message) return null;

  return result;
}

/**
 * Save a field to the result object
 * Known fields go to their properties, unknown fields go to meta
 */
function saveField(result, key, value) {
  const cleanValue = value.trim();
  
  const knownFields = [
    'from', 'requestid', 'task', 'result', 'context', 'depth',
    'callback', 'priority', 'status', 'question', 'message'
  ];

  const normalizedKey = key.toLowerCase().replace(/[-_]/g, '');

  // Check if this is a known field
  const isKnown = knownFields.includes(normalizedKey);

  if (isKnown) {
    // Handle special case for requestId
    if (normalizedKey === 'requestid') {
      result.requestId = cleanValue;
    } else {
      result[normalizedKey] = cleanValue;
    }
    
    // Validate enum fields
    if (normalizedKey === 'status' && !VALID_STATUSES.includes(cleanValue)) {
      result.status = null;
    }
    if (normalizedKey === 'priority' && !VALID_PRIORITIES.includes(cleanValue)) {
      result.priority = null;
    }
  } else {
    // Unknown field - store in meta for forward compatibility
    result.meta[key] = cleanValue;
  }
}

module.exports = { parse };
