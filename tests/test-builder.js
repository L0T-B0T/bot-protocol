/**
 * Builder Tests
 */

const { buildRequest, buildResponse, buildClarify, buildHandoff, buildBroadcast, generateRequestId } = require('../lib/builder.js');

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function testBuildRequest() {
  const msg = buildRequest({
    to: 'Mantis',
    from: 'Lotbot',
    task: 'Check CLI version',
    depth: { current: 1, max: 5 },
    priority: 'normal'
  });
  
  assert(msg.includes('[REQUEST → @Mantis]'), 'Should include REQUEST header');
  assert(msg.includes('From: Lotbot'), 'Should include From');
  assert(msg.includes('Task: Check CLI version'), 'Should include Task');
  assert(msg.includes('Depth: 1/5'), 'Should include Depth');
  assert(msg.includes('Priority: normal'), 'Should include Priority');
  assert(msg.includes('RequestId:'), 'Should auto-generate RequestId');
  
  console.log('✓ testBuildRequest passed');
}

function testBuildResponse() {
  const msg = buildResponse({
    to: 'Lotbot',
    from: 'Mantis',
    requestId: 'lotbot-abc123',
    status: 'done',
    result: 'CLI is up to date',
    depth: { current: 2, max: 5 }
  });
  
  assert(msg.includes('[RESPONSE → @Lotbot]'), 'Should include RESPONSE header');
  assert(msg.includes('RequestId: lotbot-abc123'), 'Should include RequestId');
  assert(msg.includes('Status: done'), 'Should include Status');
  assert(msg.includes('Result: CLI is up to date'), 'Should include Result');
  
  console.log('✓ testBuildResponse passed');
}

function testBuildClarify() {
  const msg = buildClarify({
    to: 'Lotbot',
    from: 'Mantis',
    requestId: 'lotbot-abc123',
    question: 'Which version?',
    depth: { current: 2, max: 5 }
  });
  
  assert(msg.includes('[CLARIFY → @Lotbot]'), 'Should include CLARIFY header');
  assert(msg.includes('Question: Which version?'), 'Should include Question');
  
  console.log('✓ testBuildClarify passed');
}

function testBuildHandoff() {
  const msg = buildHandoff({
    to: 'Clawcos',
    from: 'Lotbot',
    requestId: 'lotbot-abc123',
    task: 'Check Mac Mini',
    context: 'System audit',
    depth: { current: 2, max: 5 },
    callback: '@Lotbot'
  });
  
  assert(msg.includes('[HANDOFF → @Clawcos]'), 'Should include HANDOFF header');
  assert(msg.includes('Task: Check Mac Mini'), 'Should include Task');
  assert(msg.includes('Callback: @Lotbot'), 'Should include Callback');
  
  console.log('✓ testBuildHandoff passed');
}

function testBuildBroadcast() {
  const msg = buildBroadcast({
    from: 'Lotbot',
    message: 'Going offline',
    depth: { current: 1, max: 5 }
  });
  
  assert(msg.includes('[BROADCAST → @all]'), 'Should include BROADCAST header');
  assert(msg.includes('Message: Going offline'), 'Should include Message');
  assert(msg.includes('RequestId:'), 'Should auto-generate RequestId');
  
  console.log('✓ testBuildBroadcast passed');
}

function testDepthEnforcement() {
  try {
    buildRequest({
      to: 'Mantis',
      from: 'Lotbot',
      task: 'Do something',
      depth: { current: 5, max: 5 }
    });
    assert(false, 'Should throw error at max depth');
  } catch (err) {
    assert(err.message.includes('Depth limit reached'), 'Should throw depth limit error');
  }
  
  console.log('✓ testDepthEnforcement passed');
}

function testMissingRequiredFields() {
  try {
    buildRequest({
      to: 'Mantis',
      from: 'Lotbot'
      // Missing task
    });
    assert(false, 'Should throw error for missing task');
  } catch (err) {
    assert(err.message.includes('requires field'), 'Should throw missing field error');
  }
  
  console.log('✓ testMissingRequiredFields passed');
}

function testGenerateRequestId() {
  const id1 = generateRequestId('Lotbot');
  const id2 = generateRequestId('Lotbot');
  
  assert(id1.startsWith('lotbot-'), 'RequestId should start with botname');
  assert(id1 !== id2, 'RequestIds should be unique');
  assert(id1.length > 7, 'RequestId should have nanoid suffix');
  
  console.log('✓ testGenerateRequestId passed');
}

function testDefaultDepth() {
  const msg = buildRequest({
    to: 'Mantis',
    from: 'Lotbot',
    task: 'Do something'
    // No depth provided
  });
  
  assert(msg.includes('Depth: 1/5'), 'Should default to 1/5');
  
  console.log('✓ testDefaultDepth passed');
}

function testResponseWithoutResult() {
  try {
    buildResponse({
      to: 'Lotbot',
      from: 'Mantis',
      requestId: 'lotbot-abc123',
      depth: { current: 2, max: 5 }
      // No status or result
    });
    assert(false, 'Should throw error without status or result');
  } catch (err) {
    assert(err.message.includes('requires either status or result'), 'Should throw appropriate error');
  }
  
  console.log('✓ testResponseWithoutResult passed');
}

// Run all tests
function runBuilderTests() {
  console.log('\n=== Builder Tests ===');
  
  try {
    testBuildRequest();
    testBuildResponse();
    testBuildClarify();
    testBuildHandoff();
    testBuildBroadcast();
    testDepthEnforcement();
    testMissingRequiredFields();
    testGenerateRequestId();
    testDefaultDepth();
    testResponseWithoutResult();
    
    console.log('\n✅ All builder tests passed!\n');
    return true;
  } catch (err) {
    console.error('\n❌ Builder test failed:', err.message);
    console.error(err.stack);
    return false;
  }
}

if (require.main === module) {
  process.exit(runBuilderTests() ? 0 : 1);
}

module.exports = { runBuilderTests };
