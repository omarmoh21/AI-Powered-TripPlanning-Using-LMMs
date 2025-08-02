import { buildDailyPlan } from './services/tripBuilderService.js';

console.log('🧪 Testing updated pricing for Egyptian tourism sites and restaurants...\n');

// Test data with 2000 EGP daily budget (user's typical budget)
const testUserData = {
  age: 30,
  budget: 2000,
  days: 1,
  interests: ['history', 'culture'],
  cities: ['Cairo']
};

console.log('📊 Expected Pricing (2024/2025 Research):');
console.log('   - Pyramids of Giza: 700 EGP');
console.log('   - Egyptian Museum: 550 EGP');
console.log('   - Breakfast (mid-range): ~150 EGP');
console.log('   - Lunch (mid-range): ~300 EGP');
console.log('   - Dinner (mid-range): ~350 EGP');
console.log('   - Total expected: ~2050 EGP\n');

console.log('🏗️ Building Day 1 plan with updated pricing...\n');

try {
  const dayPlan = await buildDailyPlan(testUserData, 0, new Set(), 'Cairo');
  
  console.log('✅ Day 1 Plan Generated Successfully!\n');
  
  console.log('💰 PRICING ANALYSIS:');
  console.log('='.repeat(50));
  
  // Analyze sites pricing
  console.log('\n🏛️ SITES PRICING:');
  dayPlan.sites.forEach((site, index) => {
    console.log(`   ${index + 1}. ${site.name}: ${site.cost_egp} EGP`);
  });
  
  const totalSitesCost = dayPlan.sites.reduce((sum, site) => sum + site.cost_egp, 0);
  console.log(`   📊 Total Sites Cost: ${totalSitesCost} EGP`);
  
  // Analyze restaurant pricing
  console.log('\n🍽️ RESTAURANT PRICING:');
  let totalFoodCost = 0;
  
  if (dayPlan.restaurants.breakfast) {
    console.log(`   🌅 Breakfast (${dayPlan.restaurants.breakfast.name}): ${dayPlan.restaurants.breakfast.budget_egp} EGP`);
    totalFoodCost += dayPlan.restaurants.breakfast.budget_egp;
  }
  
  if (dayPlan.restaurants.lunch) {
    console.log(`   🍽️ Lunch (${dayPlan.restaurants.lunch.name}): ${dayPlan.restaurants.lunch.budget_egp} EGP`);
    totalFoodCost += dayPlan.restaurants.lunch.budget_egp;
  }
  
  if (dayPlan.restaurants.dinner) {
    console.log(`   🌙 Dinner (${dayPlan.restaurants.dinner.name}): ${dayPlan.restaurants.dinner.budget_egp} EGP`);
    totalFoodCost += dayPlan.restaurants.dinner.budget_egp;
  }
  
  console.log(`   📊 Total Food Cost: ${totalFoodCost} EGP`);
  
  // Overall analysis
  const totalDayCost = totalSitesCost + totalFoodCost;
  const budgetUtilization = (totalDayCost / testUserData.budget * 100).toFixed(1);
  
  console.log('\n📈 OVERALL BUDGET ANALYSIS:');
  console.log(`   💵 Daily Budget: ${testUserData.budget} EGP`);
  console.log(`   💸 Total Day Cost: ${totalDayCost} EGP`);
  console.log(`   📊 Budget Utilization: ${budgetUtilization}%`);
  console.log(`   💰 Remaining Budget: ${testUserData.budget - totalDayCost} EGP`);
  
  // Pricing accuracy check
  console.log('\n🎯 PRICING ACCURACY CHECK:');
  const pyramidsFound = dayPlan.sites.find(s => s.name.includes('Pyramids'));
  const museumFound = dayPlan.sites.find(s => s.name.includes('Museum'));
  
  if (pyramidsFound) {
    const pyramidsAccurate = pyramidsFound.cost_egp >= 600; // Allow some flexibility
    console.log(`   🔍 Pyramids pricing: ${pyramidsFound.cost_egp} EGP ${pyramidsAccurate ? '✅ ACCURATE' : '❌ TOO LOW'}`);
  }
  
  if (museumFound) {
    const museumAccurate = museumFound.cost_egp >= 400; // Allow some flexibility
    console.log(`   🔍 Museum pricing: ${museumFound.cost_egp} EGP ${museumAccurate ? '✅ ACCURATE' : '❌ TOO LOW'}`);
  }
  
  // Food pricing accuracy
  const avgFoodCost = totalFoodCost / 3;
  const foodAccurate = avgFoodCost >= 200; // Should average around 250-300 EGP per meal
  console.log(`   🔍 Average meal cost: ${avgFoodCost.toFixed(0)} EGP ${foodAccurate ? '✅ REASONABLE' : '❌ TOO LOW'}`);
  
  console.log('\n' + '='.repeat(50));
  
  if (budgetUtilization >= 90 && budgetUtilization <= 105) {
    console.log('🎉 SUCCESS: Budget utilization is optimal (90-105%)!');
  } else if (budgetUtilization < 90) {
    console.log('⚠️  WARNING: Budget utilization is low - prices might still be too conservative');
  } else {
    console.log('⚠️  WARNING: Budget utilization is high - might exceed user budget');
  }
  
  console.log('\n✅ Pricing update test completed!');
  
} catch (error) {
  console.error('❌ Error testing pricing updates:', error);
  process.exit(1);
}

process.exit(0);
