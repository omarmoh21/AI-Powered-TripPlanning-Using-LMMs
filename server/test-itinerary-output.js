import { buildTripPlan } from './services/tripBuilderService.js';

console.log('🧪 Testing Itinerary Output Quality...\n');

const testItineraryOutput = async () => {
  console.log('=== ITINERARY OUTPUT QUALITY TEST ===');
  
  const validInput = {
    age: 28,
    budget: 8000,
    days: 2,
    interests: ['historical sites', 'culture', 'photography'],
    cities: ['Cairo']
  };
  
  try {
    console.log('🏗️ Building trip plan...');
    const tripPlan = await buildTripPlan(validInput);
    
    if (!tripPlan || tripPlan.success === false) {
      console.log('❌ Failed to generate trip plan');
      return false;
    }
    
    console.log('\n🎉 Trip Plan Generated Successfully!');
    console.log(`💰 Total Cost: ${tripPlan.trip_summary.total_trip_cost_egp} EGP`);
    console.log(`📅 Days: ${tripPlan.days.length}`);
    
    // Display each day's comprehensive itinerary
    tripPlan.days.forEach((day, index) => {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📅 DAY ${index + 1} COMPREHENSIVE ITINERARY`);
      console.log(`🏙️ City: ${day.city}`);
      console.log(`💵 Daily Cost: ${day.daily_cost_egp} EGP`);
      console.log(`${'='.repeat(60)}`);
      
      if (day.comprehensive_itinerary) {
        console.log(day.comprehensive_itinerary);
      } else {
        console.log('❌ No comprehensive itinerary generated');
      }
      
      console.log(`\n📊 Day ${index + 1} Summary:`);
      console.log(`- Sites: ${day.sites?.length || 0}`);
      console.log(`- Restaurants: ${Object.keys(day.restaurants || {}).length}`);
      console.log(`- Activities: ${day.activities?.length || 0}`);
    });
    
    console.log(`\n${'='.repeat(60)}`);
    console.log('📋 TRIP SUMMARY');
    console.log(`${'='.repeat(60)}`);
    console.log(`💰 Total Budget: ${validInput.budget} EGP`);
    console.log(`💸 Total Cost: ${tripPlan.trip_summary.total_trip_cost_egp} EGP`);
    console.log(`💵 Remaining: ${tripPlan.trip_summary.remaining_budget_egp} EGP`);
    console.log(`📊 Budget Utilization: ${((tripPlan.trip_summary.total_trip_cost_egp / validInput.budget) * 100).toFixed(1)}%`);
    
    return true;
    
  } catch (error) {
    console.error('❌ Error testing itinerary output:', error.message);
    return false;
  }
};

// Run the test
testItineraryOutput().then(success => {
  if (success) {
    console.log('\n🎉 ITINERARY OUTPUT TEST: PASSED');
  } else {
    console.log('\n❌ ITINERARY OUTPUT TEST: FAILED');
  }
}).catch(console.error);
