/**
 * Test Runner for Bot Protocol
 */

const { runParserTests } = require('./test-parser.js');
const { runBuilderTests } = require('./test-builder.js');

async function runAllTests() {
  console.log('\n╔═══════════════════════════════════════╗');
  console.log('║  Bot-to-Bot Protocol Test Suite     ║');
  console.log('╚═══════════════════════════════════════╝');
  
  const results = {
    parser: false,
    builder: false
  };
  
  // Run parser tests
  results.parser = runParserTests();
  
  // Run builder tests
  results.builder = runBuilderTests();
  
  // Summary
  console.log('═══════════════════════════════════════');
  console.log('Test Summary:');
  console.log(`  Parser:  ${results.parser ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Builder: ${results.builder ? '✅ PASS' : '❌ FAIL'}`);
  console.log('═══════════════════════════════════════\n');
  
  const allPassed = results.parser && results.builder;
  
  if (allPassed) {
    console.log('🎉 All tests passed!\n');
  } else {
    console.log('❌ Some tests failed.\n');
  }
  
  return allPassed;
}

// Run tests
if (require.main === module) {
  runAllTests().then(passed => {
    process.exit(passed ? 0 : 1);
  }).catch(err => {
    console.error('Test runner error:', err);
    process.exit(1);
  });
}

module.exports = { runAllTests };
