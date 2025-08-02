import { buildTripPlan } from './services/tripBuilderService.js';

console.log('🧪 Testing Trip Builder with Valid Input...\n');

const testTripBuilder = async () => {
  console.log('=== TRIP BUILDER VALIDATION TEST ===');
  
  // Test with proper validated input
  const validInput = {
    age: 25,
    budget: 6000,
    days: 3,
    interests: ['historical sites', 'culture'],
    cities: ['Cairo']
  };
  
  try {
    console.log('📝 Input data:', JSON.stringify(validInput, null, 2));
    console.log('\n🏗️ Building trip plan...');
    
    const startTime = Date.now();
    const tripPlan = await buildTripPlan(validInput);
    const endTime = Date.now();
    
    console.log(`⏱️ Execution time: ${endTime - startTime}ms`);
    
    // Validate the response structure
    if (!tripPlan) {
      console.log('❌ FAILED: No trip plan returned');
      return false;
    }
    
    if (tripPlan.success === false) {
      console.log('❌ FAILED: Trip plan returned error:', tripPlan.error);
      return false;
    }
    
    console.log('\n✅ Trip plan generated successfully!');
    console.log(`📅 Days generated: ${tripPlan.days?.length || 0}`);
    console.log(`💰 Total cost: ${tripPlan.trip_summary?.total_trip_cost_egp || 0} EGP`);
    
    // Validate each day
    if (tripPlan.days && tripPlan.days.length > 0) {
      let allDaysValid = true;
      
      tripPlan.days.forEach((day, index) => {
        console.log(`\n--- Day ${index + 1} Validation ---`);
        console.log(`🏙️ City: ${day.city || 'Not specified'}`);
        console.log(`🏛️ Sites: ${day.sites?.length || 0} sites`);
        console.log(`🍽️ Restaurants: ${Object.keys(day.restaurants || {}).length} meals`);
        console.log(`💵 Daily cost: ${day.daily_cost_egp || 0} EGP`);
        console.log(`📋 Itinerary: ${day.comprehensive_itinerary ? 'Generated' : 'Missing'}`);
        
        // Check if day has minimum required content
        if (!day.sites || day.sites.length === 0) {
          console.log(`⚠️ Warning: Day ${index + 1} has no sites`);
        }
        
        if (!day.restaurants || Object.keys(day.restaurants).length === 0) {
          console.log(`⚠️ Warning: Day ${index + 1} has no restaurants`);
        }
        
        if (!day.comprehensive_itinerary) {
          console.log(`⚠️ Warning: Day ${index + 1} has no itinerary`);
        }
      });
      
      console.log('\n🎉 TRIP BUILDER TEST: PASSED');
      return true;
    } else {
      console.log('❌ FAILED: No days generated in trip plan');
      return false;
    }
    
  } catch (error) {
    console.error('❌ FAILED: Trip builder threw error:', error.message);
    console.error('Stack trace:', error.stack);
    return false;
  }
};

// Test with extraction service format
const testExtractionFormat = async () => {
  console.log('\n=== EXTRACTION SERVICE FORMAT TEST ===');
  
  // Test with incomplete extraction data (should fail gracefully)
  const incompleteInput = {
    success: true,
    data: {
      complete: false
    },
    response: "Need more information..."
  };
  
  try {
    console.log('📝 Testing incomplete extraction data...');
    const result = await buildTripPlan(incompleteInput);
    
    if (result.success === false) {
      console.log('✅ Correctly handled incomplete data');
      console.log('📝 Error message:', result.error);
      return true;
    } else {
      console.log('❌ Should have failed with incomplete data');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Unexpected error with incomplete data:', error.message);
    return false;
  }
};

// Run tests
const runTests = async () => {
  console.log('🚀 Starting Trip Builder Validation Tests...\n');
  
  const results = {
    tripBuilder: await testTripBuilder(),
    extractionFormat: await testExtractionFormat()
  };
  
  console.log('\n' + '='.repeat(50));
  console.log('📋 FINAL VALIDATION RESULTS');
  console.log('='.repeat(50));
  console.log(`✅ Trip Builder: ${results.tripBuilder ? 'PASSED' : 'FAILED'}`);
  console.log(`✅ Extraction Format: ${results.extractionFormat ? 'PASSED' : 'FAILED'}`);
  
  const totalPassed = Object.values(results).filter(Boolean).length;
  const totalTests = Object.keys(results).length;
  
  console.log(`\n🎯 Overall Score: ${totalPassed}/${totalTests} tests passed`);
  
  if (totalPassed === totalTests) {
    console.log('🎉 ALL VALIDATION TESTS PASSED! Trip builder is working correctly.');
  } else {
    console.log('⚠️ Some validation tests failed. Please review the issues above.');
  }
  
  return totalPassed === totalTests;
};

// Execute validation tests
runTests().catch(console.error);
