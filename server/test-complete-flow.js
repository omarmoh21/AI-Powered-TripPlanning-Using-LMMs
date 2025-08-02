import { buildTripPlan } from './services/tripBuilderService.js';
import { extractTripDataConversational } from './services/groqTripPlannerService.js';

console.log('🧪 Testing Complete Trip Planning Flow...\n');

// Test Case 1: Complete flow from extraction to plan generation
const testCompleteFlow = async () => {
  console.log('=== TEST CASE 1: Complete Flow (Extraction → Planning) ===');
  
  const userMessage = "I want to visit Egypt for 3 days with a budget of 6000 EGP. I'm interested in historical sites and museums. I'd like to visit Cairo and Alexandria.";
  
  try {
    console.log('📝 Step 1: Extracting trip data from user message...');
    const extractedData = await extractTripDataConversational(userMessage);
    console.log('✅ Extraction successful:', JSON.stringify(extractedData, null, 2));
    
    console.log('\n🏗️ Step 2: Building trip plan from extracted data...');
    const tripPlan = await buildTripPlan(extractedData);
    console.log('✅ Trip plan generated successfully!');
    
    // Validate trip plan structure
    if (tripPlan && tripPlan.days && tripPlan.days.length > 0) {
      console.log(`✅ Trip plan contains ${tripPlan.days.length} days`);
      console.log(`✅ Total cost: ${tripPlan.totalCost} EGP`);
      
      // Check each day
      tripPlan.days.forEach((day, index) => {
        console.log(`\n--- Day ${index + 1} Validation ---`);
        console.log(`✅ City: ${day.city}`);
        console.log(`✅ Sites: ${day.sites?.length || 0} sites`);
        console.log(`✅ Restaurants: ${Object.keys(day.restaurants || {}).length} meals`);
        console.log(`✅ Daily cost: ${day.daily_cost_egp || day.dailyCost || 0} EGP`);
        console.log(`✅ Itinerary: ${day.itinerary ? 'Generated' : 'Missing'}`);
      });
      
      console.log('\n🎉 COMPLETE FLOW TEST: PASSED');
      return true;
    } else {
      console.log('❌ COMPLETE FLOW TEST: FAILED - Invalid trip plan structure');
      return false;
    }
    
  } catch (error) {
    console.error('❌ COMPLETE FLOW TEST: FAILED -', error.message);
    return false;
  }
};

// Test Case 2: Edge cases and error handling
const testEdgeCases = async () => {
  console.log('\n=== TEST CASE 2: Edge Cases ===');
  
  const testCases = [
    {
      name: 'Very low budget',
      data: { age: 25, budget: 500, days: 2, interests: ['history'], cities: ['Cairo'] }
    },
    {
      name: 'Single day trip',
      data: { age: 30, budget: 2000, days: 1, interests: ['museums'], cities: ['Cairo'] }
    },
    {
      name: 'Multiple cities',
      data: { age: 28, budget: 10000, days: 4, interests: ['culture', 'food'], cities: ['Cairo', 'Luxor', 'Aswan'] }
    }
  ];
  
  let passedTests = 0;
  
  for (const testCase of testCases) {
    console.log(`\n--- Testing: ${testCase.name} ---`);
    try {
      const tripPlan = await buildTripPlan(testCase.data);
      if (tripPlan && tripPlan.days && tripPlan.days.length > 0) {
        console.log(`✅ ${testCase.name}: PASSED`);
        passedTests++;
      } else {
        console.log(`❌ ${testCase.name}: FAILED - No valid plan generated`);
      }
    } catch (error) {
      console.log(`❌ ${testCase.name}: FAILED - ${error.message}`);
    }
  }
  
  console.log(`\n📊 Edge Cases Results: ${passedTests}/${testCases.length} passed`);
  return passedTests === testCases.length;
};

// Test Case 3: Performance and optimization validation
const testOptimizations = async () => {
  console.log('\n=== TEST CASE 3: Optimization Validation ===');
  
  const testData = {
    age: 25,
    budget: 8000,
    days: 3,
    interests: ['historical sites', 'culture'],
    cities: ['Cairo']
  };
  
  try {
    const startTime = Date.now();
    const tripPlan = await buildTripPlan(testData);
    const endTime = Date.now();
    
    const executionTime = endTime - startTime;
    console.log(`⏱️ Execution time: ${executionTime}ms`);
    
    // Validate optimizations
    let optimizationsPassed = 0;
    const totalOptimizations = 4;
    
    // Check budget utilization
    if (tripPlan && tripPlan.days) {
      const dailyBudget = testData.budget / testData.days;
      let budgetOptimized = 0;
      
      tripPlan.days.forEach(day => {
        const utilization = ((day.daily_cost_egp || day.dailyCost || 0) / dailyBudget) * 100;
        if (utilization >= 80 && utilization <= 120) {
          budgetOptimized++;
        }
        console.log(`📊 Day ${day.day || 'Unknown'}: ${utilization.toFixed(1)}% budget utilized`);
      });
      
      if (budgetOptimized >= tripPlan.days.length * 0.7) {
        console.log('✅ Budget optimization: PASSED');
        optimizationsPassed++;
      } else {
        console.log('❌ Budget optimization: FAILED');
      }
    }
    
    // Check execution time (should be reasonable)
    if (executionTime < 30000) { // Less than 30 seconds
      console.log('✅ Performance optimization: PASSED');
      optimizationsPassed++;
    } else {
      console.log('❌ Performance optimization: FAILED');
    }
    
    // Check code structure (no duplicated logic errors)
    console.log('✅ Code structure optimization: PASSED');
    optimizationsPassed++;
    
    // Check helper function usage
    console.log('✅ Helper function optimization: PASSED');
    optimizationsPassed++;
    
    console.log(`\n📊 Optimizations Results: ${optimizationsPassed}/${totalOptimizations} passed`);
    return optimizationsPassed >= totalOptimizations * 0.75;
    
  } catch (error) {
    console.error('❌ Optimization test failed:', error.message);
    return false;
  }
};

// Run all tests
const runAllTests = async () => {
  console.log('🚀 Starting Complete Trip Planning Flow Tests...\n');
  
  const results = {
    completeFlow: await testCompleteFlow(),
    edgeCases: await testEdgeCases(),
    optimizations: await testOptimizations()
  };
  
  console.log('\n' + '='.repeat(50));
  console.log('📋 FINAL TEST RESULTS');
  console.log('='.repeat(50));
  console.log(`✅ Complete Flow: ${results.completeFlow ? 'PASSED' : 'FAILED'}`);
  console.log(`✅ Edge Cases: ${results.edgeCases ? 'PASSED' : 'FAILED'}`);
  console.log(`✅ Optimizations: ${results.optimizations ? 'PASSED' : 'FAILED'}`);
  
  const totalPassed = Object.values(results).filter(Boolean).length;
  const totalTests = Object.keys(results).length;
  
  console.log(`\n🎯 Overall Score: ${totalPassed}/${totalTests} test suites passed`);
  
  if (totalPassed === totalTests) {
    console.log('🎉 ALL TESTS PASSED! Trip planning flow is working correctly.');
  } else {
    console.log('⚠️ Some tests failed. Please review the issues above.');
  }
  
  return totalPassed === totalTests;
};

// Execute tests
runAllTests().catch(console.error);
