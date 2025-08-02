import { generateComprehensiveItinerary } from './services/groqTripPlannerService.js';

console.log('🚗 Testing Transportation Suggestions...\n');

const testTransportationSuggestions = async () => {
  console.log('=== TRANSPORTATION SUGGESTIONS TEST ===');
  
  // Test different site combinations
  const testCases = [
    {
      name: "Pyramids & Egyptian Museum",
      sites: [
        { name: "Pyramids of Giza", city: "Cairo", cost_egp: 900, average_time_spent_hours: 3 },
        { name: "Egyptian Museum", city: "Cairo", cost_egp: 800, average_time_spent_hours: 2 }
      ],
      restaurants: {
        breakfast: { name: "El Hawary", budget_egp: 160 },
        lunch: { name: "Bab El-Sharq", budget_egp: 280 },
        dinner: { name: "Abou El Sid", budget_egp: 350 }
      }
    },
    {
      name: "Luxor Sites",
      sites: [
        { name: "Karnak Temple", city: "Luxor", cost_egp: 500, average_time_spent_hours: 3 },
        { name: "Valley of the Kings", city: "Luxor", cost_egp: 600, average_time_spent_hours: 4 }
      ],
      restaurants: {
        breakfast: { name: "Luxor Cafe", budget_egp: 120 },
        lunch: { name: "Nile Restaurant", budget_egp: 250 },
        dinner: { name: "Traditional Luxor", budget_egp: 300 }
      }
    },
    {
      name: "Alexandria Sites",
      sites: [
        { name: "Bibliotheca Alexandrina", city: "Alexandria", cost_egp: 200, average_time_spent_hours: 2 },
        { name: "Citadel of Qaitbay", city: "Alexandria", cost_egp: 150, average_time_spent_hours: 2 }
      ],
      restaurants: {
        breakfast: { name: "Alex Cafe", budget_egp: 100 },
        lunch: { name: "Mediterranean", budget_egp: 200 },
        dinner: { name: "Seafood Palace", budget_egp: 400 }
      }
    }
  ];

  const userData = {
    age: 28,
    interests: ['historical sites', 'culture'],
    budget: 8000
  };

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`\n${'='.repeat(50)}`);
    console.log(`🧪 TEST CASE ${i + 1}: ${testCase.name}`);
    console.log(`${'='.repeat(50)}`);
    
    try {
      // Generate comprehensive itinerary (will use fallback due to AI errors)
      const itinerary = await generateComprehensiveItinerary(
        testCase.sites,
        testCase.restaurants,
        userData,
        i
      );
      
      console.log('📋 Generated Itinerary:');
      console.log(itinerary);
      
      // Extract transportation section
      const transportationMatch = itinerary.match(/\*\*Transportation:\*\*\s*(.+?)(?=\n\*\*|$)/s);
      if (transportationMatch) {
        console.log('\n🚗 Transportation Suggestion:');
        console.log(`"${transportationMatch[1].trim()}"`);
      } else {
        console.log('\n❌ No transportation suggestion found');
      }
      
    } catch (error) {
      console.error(`❌ Error testing ${testCase.name}:`, error.message);
    }
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log('🎉 TRANSPORTATION SUGGESTIONS TEST COMPLETED');
  console.log(`${'='.repeat(60)}`);
};

// Run the test
testTransportationSuggestions().catch(console.error);
