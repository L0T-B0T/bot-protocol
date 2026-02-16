/**
 * Parser Tests
 */

const { parse } = require('../lib/parser.js');

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function testValidRequest() {
  const raw = `\`\`\`
[REQUEST → @Mantis]
From: Lotbot
RequestId: lotbot-abc123
Task: Check Mac Mini CLI version
Context: Weekly audit
Depth: 1/5
Priority: normal
\`\`\``;

  const parsed = parse(raw);
  
  assert(parsed !== null, 'Should parse valid REQUEST');
  assert(parsed.type === 'REQUEST', 'Type should be REQUEST');
  assert(parsed.to === 'Mantis', 'To should be Mantis');
  assert(parsed.from === 'Lotbot', 'From should be Lotbot');
  assert(parsed.requestId === 'lotbot-abc123', 'RequestId should match');
  assert(parsed.task === 'Check Mac Mini CLI version', 'Task should match');
  assert(parsed.depth.current === 1, 'Depth current should be 1');
  assert(parsed.depth.max === 5, 'Depth max should be 5');
  assert(parsed.priority === 'normal', 'Priority should be normal');
  
  console.log('✓ testValidRequest passed');
}

function testValidResponse() {
  const raw = `\`\`\`
[RESPONSE → @Lotbot]
From: Mantis
RequestId: lotbot-abc123
Status: done
Result: CLI version is up to date (v2026.2.13)
Depth: 2/5
\`\`\``;

  const parsed = parse(raw);
  
  assert(parsed !== null, 'Should parse valid RESPONSE');
  assert(parsed.type === 'RESPONSE', 'Type should be RESPONSE');
  assert(parsed.status === 'done', 'Status should be done');
  assert(parsed.result === 'CLI version is up to date (v2026.2.13)', 'Result should match');
  
  console.log('✓ testValidResponse passed');
}

function testValidClarify() {
  const raw = `\`\`\`
[CLARIFY → @Lotbot]
From: Mantis
RequestId: lotbot-abc123
Question: Which version should I check against?
Depth: 2/5
\`\`\``;

  const parsed = parse(raw);
  
  assert(parsed !== null, 'Should parse valid CLARIFY');
  assert(parsed.type === 'CLARIFY', 'Type should be CLARIFY');
  assert(parsed.question === 'Which version should I check against?', 'Question should match');
  
  console.log('✓ testValidClarify passed');
}

function testMultilineValue() {
  const raw = `\`\`\`
[REQUEST → @Mantis]
From: Lotbot
RequestId: lotbot-abc123
Task: Do these things:
1. Check version
2. Report status
3. Clean up
Depth: 1/5
\`\`\``;

  const parsed = parse(raw);
  
  assert(parsed !== null, 'Should parse message with multiline task');
  assert(parsed.task.includes('1. Check version'), 'Task should include first line');
  assert(parsed.task.includes('3. Clean up'), 'Task should include last line');
  
  console.log('✓ testMultilineValue passed');
}

function testMalformedHeader() {
  const raw = `\`\`\`
[INVALID HEADER]
From: Lotbot
Task: Do something
\`\`\``;

  const parsed = parse(raw);
  
  assert(parsed === null, 'Should reject malformed header');
  
  console.log('✓ testMalformedHeader passed');
}

function testMissingRequiredField() {
  const raw = `\`\`\`
[REQUEST → @Mantis]
From: Lotbot
Task: Do something
Depth: 1/5
\`\`\``;

  const parsed = parse(raw);
  
  assert(parsed === null, 'Should reject message missing RequestId');
  
  console.log('✓ testMissingRequiredField passed');
}

function testInvalidType() {
  const raw = `\`\`\`
[INVALID → @Mantis]
From: Lotbot
RequestId: lotbot-abc123
Task: Do something
\`\`\``;

  const parsed = parse(raw);
  
  assert(parsed === null, 'Should reject invalid message type');
  
  console.log('✓ testInvalidType passed');
}

function testNoCodeBlock() {
  const raw = `[REQUEST → @Mantis]
From: Lotbot
RequestId: lotbot-abc123
Task: Do something`;

  const parsed = parse(raw);
  
  assert(parsed === null, 'Should reject message without code blocks');
  
  console.log('✓ testNoCodeBlock passed');
}

function testUnknownFields() {
  const raw = `\`\`\`
[REQUEST → @Mantis]
From: Lotbot
RequestId: lotbot-abc123
Task: Do something
Depth: 1/5
CustomField: custom value
AnotherField: another value
\`\`\``;

  const parsed = parse(raw);
  
  assert(parsed !== null, 'Should parse message with unknown fields');
  assert(parsed.meta.customfield === 'custom value', 'Should preserve custom field in meta');
  assert(parsed.meta.anotherfield === 'another value', 'Should preserve another field in meta');
  
  console.log('✓ testUnknownFields passed');
}

function testBroadcast() {
  const raw = `\`\`\`
[BROADCAST → @all]
From: Lotbot
RequestId: lotbot-bcast-001
Message: System maintenance in 5 minutes
Depth: 1/5
\`\`\``;

  const parsed = parse(raw);
  
  assert(parsed !== null, 'Should parse BROADCAST');
  assert(parsed.type === 'BROADCAST', 'Type should be BROADCAST');
  assert(parsed.to === 'all', 'To should be all');
  assert(parsed.message === 'System maintenance in 5 minutes', 'Message should match');
  
  console.log('✓ testBroadcast passed');
}

// Run all tests
function runParserTests() {
  console.log('\n=== Parser Tests ===');
  
  try {
    testValidRequest();
    testValidResponse();
    testValidClarify();
    testMultilineValue();
    testMalformedHeader();
    testMissingRequiredField();
    testInvalidType();
    testNoCodeBlock();
    testUnknownFields();
    testBroadcast();
    
    console.log('\n✅ All parser tests passed!\n');
    return true;
  } catch (err) {
    console.error('\n❌ Parser test failed:', err.message);
    console.error(err.stack);
    return false;
  }
}

if (require.main === module) {
  process.exit(runParserTests() ? 0 : 1);
}

module.exports = { runParserTests };
