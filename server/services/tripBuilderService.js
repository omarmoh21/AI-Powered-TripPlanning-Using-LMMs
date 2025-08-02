import {
  Site,
  Restaurant,
  generateEmbedding,
  getTopSimilarRecords,
  selectClosestSitePair,
  haversineDistance,
  getMidpoint,
  generateComprehensiveItinerary
} from './groqTripPlannerService.js';

// Helper function to get default meal prices based on meal type and restaurant price range
const getDefaultMealPrice = (mealType, priceRange) => {
  const priceMatrix = {
    breakfast: { Budget: 80, Moderate: 150, Upscale: 250 },
    lunch: { Budget: 150, Moderate: 300, Upscale: 450 },
    dinner: { Budget: 150, Moderate: 350, Upscale: 550 }
  };

  return priceMatrix[mealType]?.[priceRange] || priceMatrix[mealType]?.Moderate || 200;
};

// Helper function to find closest restaurant by meal type from a list
const findClosestRestaurant = (restaurants, targetCoord, mealType, excludeSet) => {
  const mealRestaurants = restaurants.filter(r =>
    r.type === mealType &&
    !excludeSet.has(r._id?.toString() || r.name) &&
    r.latitude && r.longitude
  );

  return mealRestaurants.reduce((min, r) => {
    const dist = haversineDistance(targetCoord, { latitude: r.latitude, longitude: r.longitude });
    return !min || dist < min.dist ? { ...r, dist } : min;
  }, null);
};

// Get Day 1 sites (always Pyramids + Egyptian Museum)
const getDay1Sites = async () => {
  console.log(`🏛️ Getting Day 1 mandatory sites: Pyramids + Egyptian Museum`);

  try {
    // Try to get actual sites from database
    const pyramids = await Site.findOne({
      $or: [
        { name: { $regex: /pyramid/i } },
        { name: { $regex: /giza/i } }
      ]
    }).lean();

    const museum = await Site.findOne({
      $or: [
        { name: { $regex: /egyptian museum/i } },
        { name: { $regex: /museum/i } }
      ]
    }).lean();

    const sites = [];

    // Add Pyramids (real or fallback)
    if (pyramids) {
      sites.push({
        ...pyramids,
        cost_egp: pyramids.budget || 800
      });
    } else {
      sites.push({
        name: 'Pyramids of Giza',
        city: 'Giza',
        governorate: 'Giza',
        description: 'The last surviving wonder of the ancient world, these magnificent pyramids have stood for over 4,500 years.',
        similarity_score: 1.0,
        activities: ['Exploring', 'Photography', 'Camel Riding'],
        opening_time: '08:00',
        closing_time: '17:00',
        average_time_spent_hours: 3,
        cost_egp: 800,
        latitude: 29.9792,
        longitude: 31.1342
      });
    }

    // Add Egyptian Museum (real or fallback)
    if (museum) {
      sites.push({
        ...museum,
        cost_egp: museum.budget || 1000
      });
    } else {
      sites.push({
        name: 'Egyptian Museum',
        city: 'Cairo',
        governorate: 'Cairo',
        description: 'Home to the world\'s most extensive collection of ancient Egyptian artifacts, including treasures from Tutankhamun\'s tomb.',
        similarity_score: 1.0,
        activities: ['Museum Tour', 'Photography', 'Learning'],
        opening_time: '09:00',
        closing_time: '17:00',
        average_time_spent_hours: 2.5,
        cost_egp: 1000,
        latitude: 30.0478,
        longitude: 31.2336
      });
    }

    console.log(`✅ Day 1 sites prepared: ${sites.map(s => s.name).join(' + ')}`);
    return sites;

  } catch (error) {
    console.error('Error getting Day 1 sites:', error);
    // Return fallback sites
    return [
      {
        name: 'Pyramids of Giza',
        city: 'Giza',
        governorate: 'Giza',
        description: 'The last surviving wonder of the ancient world.',
        similarity_score: 1.0,
        activities: ['Exploring', 'Photography'],
        opening_time: '08:00',
        closing_time: '17:00',
        average_time_spent_hours: 3,
        cost_egp: 800,
        latitude: 29.9792,
        longitude: 31.1342
      },
      {
        name: 'Egyptian Museum',
        city: 'Cairo',
        governorate: 'Cairo',
        description: 'World\'s most extensive collection of ancient Egyptian artifacts.',
        similarity_score: 1.0,
        activities: ['Museum Tour', 'Learning'],
        opening_time: '09:00',
        closing_time: '17:00',
        average_time_spent_hours: 2.5,
        cost_egp: 1000,
        latitude: 30.0478,
        longitude: 31.2336
      }
    ];
  }
};

// Select sites by governorate to ensure they're in the same region (STRICT SINGLE LOCATION CONSTRAINT)
const selectSitesByGovernorate = (sites, usedSites = new Set()) => {
  console.log(`🗺️ STRICT: Grouping sites by governorate for same-day visits (Single Location Constraint)`);

  const availableSites = sites.filter(site => !usedSites.has(site.name));
  if (availableSites.length === 0) return [];

  // Group sites by governorate/city with strict location matching
  const sitesByLocation = {};
  availableSites.forEach(site => {
    // Use both governorate and city for more precise grouping
    const location = site.governorate || site.city || 'Unknown';
    const normalizedLocation = location.toLowerCase().trim();

    if (!sitesByLocation[normalizedLocation]) {
      sitesByLocation[normalizedLocation] = [];
    }
    sitesByLocation[normalizedLocation].push(site);
  });

  console.log(`📍 Sites grouped by location:`, Object.keys(sitesByLocation).map(loc =>
    `${loc}: ${sitesByLocation[loc].length} sites`
  ).join(', '));

  // STRICT CONSTRAINT: Only consider locations with multiple sites
  const validLocations = Object.keys(sitesByLocation).filter(loc =>
    sitesByLocation[loc].length >= 2
  );

  if (validLocations.length === 0) {
    console.log(`⚠️ STRICT CONSTRAINT VIOLATION: No location has 2+ sites. Selecting best sites from same location.`);

    // Find the location with the highest scoring single site and try to find another nearby
    const allLocationScores = Object.keys(sitesByLocation).map(loc => {
      const sites = sitesByLocation[loc];
      const bestScore = Math.max(...sites.map(s => s.similarity_score || 0));
      return { location: loc, score: bestScore, sites };
    });

    allLocationScores.sort((a, b) => b.score - a.score);
    const bestLocation = allLocationScores[0];

    if (bestLocation.sites.length === 1) {
      // Try to find another site in the same city/governorate
      const primarySite = bestLocation.sites[0];
      const sameCitySites = availableSites.filter(s =>
        s.city?.toLowerCase() === primarySite.city?.toLowerCase() ||
        s.governorate?.toLowerCase() === primarySite.governorate?.toLowerCase()
      );

      if (sameCitySites.length >= 2) {
        console.log(`✅ Found ${sameCitySites.length} sites in same city/governorate: ${primarySite.city || primarySite.governorate}`);
        return sameCitySites.slice(0, 2);
      }
    }

    return bestLocation.sites.slice(0, Math.min(2, bestLocation.sites.length));
  }

  // Find the location with the highest average similarity score
  let bestLocation = null;
  let bestScore = 0;

  validLocations.forEach(loc => {
    const locSites = sitesByLocation[loc];
    const avgScore = locSites.reduce((sum, site) => sum + (site.similarity_score || 0), 0) / locSites.length;
    if (avgScore > bestScore) {
      bestScore = avgScore;
      bestLocation = loc;
    }
  });

  if (!bestLocation) {
    console.log(`⚠️ FALLBACK: No location with 2+ sites found, selecting best individual sites`);
    // Fallback: Select top 2 sites regardless of location constraint
    const fallbackSites = sites
      .sort((a, b) => (b.similarity_score || 0) - (a.similarity_score || 0))
      .slice(0, 2);

    if (fallbackSites.length > 0) {
      console.log(`✅ FALLBACK: Selected ${fallbackSites.length} sites without location constraint`);
      return fallbackSites;
    }

    console.log(`❌ CRITICAL: No sites available at all`);
    return [];
  }

  console.log(`🎯 STRICT: Selected location: ${bestLocation} (avg score: ${bestScore.toFixed(2)})`);

  // Return top 2 sites from the best location
  const selectedLocationSites = sitesByLocation[bestLocation]
    .sort((a, b) => (b.similarity_score || 0) - (a.similarity_score || 0))
    .slice(0, 2);

  console.log(`✅ STRICT: Selected sites in same location: ${selectedLocationSites.map(s => `${s.name} (${s.city})`).join(', ')}`);
  return selectedLocationSites;
};

// Get fallback sites for when RAG fails
const getFallbackSites = async (dayNumber) => {
  console.log(`🔄 Getting fallback sites for day ${dayNumber + 1}`);

  const fallbackSitesByDay = [
    // Day 2: Luxor sites
    [
      { name: 'Karnak Temple', city: 'Luxor', governorate: 'Luxor' },
      { name: 'Valley of the Kings', city: 'Luxor', governorate: 'Luxor' }
    ],
    // Day 3: Alexandria sites
    [
      { name: 'Bibliotheca Alexandrina', city: 'Alexandria', governorate: 'Alexandria' },
      { name: 'Citadel of Qaitbay', city: 'Alexandria', governorate: 'Alexandria' }
    ],
    // Day 4: Aswan sites
    [
      { name: 'Philae Temple', city: 'Aswan', governorate: 'Aswan' },
      { name: 'High Dam', city: 'Aswan', governorate: 'Aswan' }
    ],
    // Day 5+: Cairo sites
    [
      { name: 'Citadel of Saladin', city: 'Cairo', governorate: 'Cairo' },
      { name: 'Khan el-Khalili', city: 'Cairo', governorate: 'Cairo' }
    ]
  ];

  const dayIndex = Math.min(dayNumber - 1, fallbackSitesByDay.length - 1);
  const fallbackPair = fallbackSitesByDay[dayIndex];

  return fallbackPair.map((site, index) => ({
    ...site,
    description: `Historic site in ${site.city}`,
    similarity_score: 0.7,
    activities: ['Exploring', 'Photography'],
    opening_time: '08:00',
    closing_time: '17:00',
    average_time_spent_hours: 2.5,
    cost_egp: index === 0 ? 500 : 300,
    latitude: 30.0 + Math.random() * 2, // Approximate coordinates
    longitude: 31.0 + Math.random() * 2
  }));
};

// Helper function to calculate budget allocation
const calculateBudgetAllocation = (totalBudget, days) => {
  const dailyBudget = totalBudget / days;
  return {
    dailyBudget,
    sitesBudget: dailyBudget * 0.65,
    foodBudget: dailyBudget * 0.35
  };
};

// Helper function to create restaurant object
const createRestaurantObject = (restaurant, mealType, distance = 0) => {
  if (!restaurant) return null;

  return {
    name: restaurant.name || 'Unknown Restaurant',
    city: restaurant.city || 'Cairo',
    description: restaurant.description || 'No description available',
    budget_egp: Number(restaurant.average_budget_egp || getDefaultMealPrice(mealType, restaurant.price_range)),
    opening_hours: restaurant.opening_hours || getDefaultOpeningHours(mealType),
    closing_hours: restaurant.closing_hours || getDefaultClosingHours(mealType),
    distance_km: Math.round(distance * 100) / 100
  };
};

// Helper function to get default opening/closing hours
const getDefaultOpeningHours = (mealType) => {
  const defaults = { breakfast: '08:00', lunch: '11:00', dinner: '17:00' };
  return defaults[mealType] || '09:00';
};

const getDefaultClosingHours = (mealType) => {
  const defaults = { breakfast: '16:00', lunch: '20:00', dinner: '23:00' };
  return defaults[mealType] || '22:00';
};

// Helper function to optimize budget utilization
const optimizeBudgetUtilization = async (
  dailyBudget,
  dailyCost,
  selectedSites,
  restaurants,
  Restaurant
) => {
  const budgetUtilization = dailyCost / dailyBudget;
  const remainingBudget = dailyBudget - dailyCost;
  let optimizedCost = dailyCost;

  console.log(`💰 Current cost: ${dailyCost} EGP / ${dailyBudget} EGP (${(budgetUtilization * 100).toFixed(1)}% utilized)`);
  console.log(`💰 Remaining budget: ${remainingBudget} EGP`);

  // If we're significantly under budget (less than 85% utilized), try to optimize
  if (budgetUtilization < 0.85 && remainingBudget > 100) {
    console.log(`🎯 BUDGET OPTIMIZATION: Attempting to maximize ${remainingBudget} EGP remaining budget...`);

    // Strategy 1: Upgrade restaurants to higher-end options
    if (selectedSites.length > 0 && remainingBudget > 200) {
      const siteCity = selectedSites[0].city;
      const upgradeAmount = Math.min(remainingBudget * 0.6, 500); // Use up to 60% of remaining budget or 500 EGP max

      console.log(`🍽️ Attempting to upgrade restaurants with ${upgradeAmount} EGP budget...`);

      // Try to upgrade dinner first (usually most expensive)
      if (restaurants.dinner && upgradeAmount > 100) {
        const premiumDinnerBudget = restaurants.dinner.budget_egp + upgradeAmount * 0.5;

        // Find premium restaurants using existing logic
        const premiumRestaurants = await Restaurant.find({
          city: siteCity,
          type: 'dinner',
          average_budget_egp: { $gte: restaurants.dinner.budget_egp, $lte: premiumDinnerBudget }
        }).lean();

        if (premiumRestaurants.length > 0) {
          const premiumDinner = premiumRestaurants[0];
          const additionalCost = premiumDinner.average_budget_egp - restaurants.dinner.budget_egp;

          if (additionalCost > 0 && additionalCost <= upgradeAmount * 0.5) {
            console.log(`⬆️ Upgrading dinner: ${restaurants.dinner.name} → ${premiumDinner.name} (+${additionalCost} EGP)`);
            const lastSiteCoord = selectedSites.length === 2
              ? { latitude: selectedSites[1].latitude, longitude: selectedSites[1].longitude }
              : { latitude: selectedSites[0].latitude, longitude: selectedSites[0].longitude };

            const distance = haversineDistance(lastSiteCoord, { latitude: premiumDinner.latitude, longitude: premiumDinner.longitude });
            restaurants.dinner = createRestaurantObject(premiumDinner, 'dinner', distance);
            optimizedCost += additionalCost;
          }
        }
      }

      // Try to upgrade lunch if still have budget
      const newRemainingBudget = dailyBudget - optimizedCost;
      if (restaurants.lunch && newRemainingBudget > 100) {
        const premiumLunchBudget = restaurants.lunch.budget_egp + newRemainingBudget * 0.4;

        // Find premium restaurants using existing logic
        const premiumRestaurants = await Restaurant.find({
          city: siteCity,
          type: 'lunch',
          average_budget_egp: { $gte: restaurants.lunch.budget_egp, $lte: premiumLunchBudget }
        }).lean();

        if (premiumRestaurants.length > 0) {
          const premiumLunch = premiumRestaurants[0];
          const additionalCost = premiumLunch.average_budget_egp - restaurants.lunch.budget_egp;

          if (additionalCost > 0 && additionalCost <= newRemainingBudget * 0.4) {
            console.log(`⬆️ Upgrading lunch: ${restaurants.lunch.name} → ${premiumLunch.name} (+${additionalCost} EGP)`);
            const lunchLocation = selectedSites.length === 2
              ? getMidpoint(selectedSites[0], selectedSites[1])
              : { latitude: selectedSites[0].latitude, longitude: selectedSites[0].longitude };

            const distance = haversineDistance(lunchLocation, { latitude: premiumLunch.latitude, longitude: premiumLunch.longitude });
            restaurants.lunch = createRestaurantObject(premiumLunch, 'lunch', distance);
            optimizedCost += additionalCost;
          }
        }
      }
    }
  }

  return { optimizedCost, restaurants };
};

// Build daily plan with RAG-based site selection
export const buildDailyPlan = async (userData, dayNumber, usedSites, assignedCity = null) => {
  console.log(`🏗️ Building daily plan for day ${dayNumber + 1}`);
  console.log(`Interests: ${userData.interests.join(', ')}`);

  // Use assigned city from optimized allocation
  const targetCity = assignedCity || (userData.cities ? userData.cities[0] : null);
  console.log(`🏙️ Assigned city for day ${dayNumber + 1}: ${targetCity || 'Any city'}`);

  const { dailyBudget, sitesBudget, foodBudget } = calculateBudgetAllocation(userData.budget, userData.days);
  let currentSitesBudget = sitesBudget;
  let currentFoodBudget = foodBudget;

  console.log(`💰 Daily budget: ${dailyBudget} EGP (Initial - Sites: ${currentSitesBudget}, Food: ${currentFoodBudget})`);

  let selectedSites = [];

  // Generate embedding once for the entire day planning
  const interestsText = userData.interests.join(' ');
  const userEmbedding = await generateEmbedding(interestsText);
  console.log(`📊 Generated embedding with ${userEmbedding.length} dimensions`);

  // Day 1: Always Pyramids + Egyptian Museum (but respect city constraint)
  if (dayNumber === 0) {
    console.log(`🏛️ Day 1: Setting up Pyramids + Egyptian Museum`);
    selectedSites = await getDay1Sites();

    // Ensure Day 1 sites are in the assigned city if specified
    if (targetCity && targetCity.toLowerCase() !== 'cairo' && targetCity.toLowerCase() !== 'giza') {
      console.log(`⚠️ Day 1 assigned to ${targetCity}, but Pyramids are in Cairo/Giza. Adjusting...`);
      // For non-Cairo/Giza cities, use RAG to find appropriate sites
      const sites = await getTopSimilarRecords(Site, userEmbedding, targetCity, 10, sitesBudget, userData.age);

      if (sites.length > 0) {
        selectedSites = selectSitesByGovernorate(sites, usedSites);
        console.log(`✅ Adjusted Day 1 sites for ${targetCity}: ${selectedSites.map(s => s.name).join(', ')}`);
      }
    } else {
      console.log(`✅ Day 1 sites selected: ${selectedSites.map(s => s.name).join(', ')}`);
    }
  } else {
    // Other days: Use RAG with governorate grouping
    console.log(`🔍 Day ${dayNumber + 1}: Using RAG with governorate grouping`);

    console.log(`🔍 Searching for sites with RAG...`);
    const sites = await getTopSimilarRecords(Site, userEmbedding, targetCity, 10, sitesBudget, userData.age);
    console.log(`📍 Found ${sites.length} sites from RAG search`);

    if (sites.length === 0) {
      console.log(`⚠️ No sites found for day ${dayNumber + 1} - creating fallback plan`);
      selectedSites = await getFallbackSites(dayNumber);
    } else {
      selectedSites = selectSitesByGovernorate(sites, usedSites);
      console.log(`✅ Selected ${selectedSites.length} sites for day ${dayNumber + 1} in same governorate`);
    }
  }

  for (const site of selectedSites) {
    usedSites.add(site.name);
  }

  const formattedSites = selectedSites.map(site => ({
    name: site.name || 'Unknown Site',
    city: site.city || 'Cairo',
    description: site.description || 'No description available',
    similarity_score: site.similarity_score || 0.0,
    activities: site.activities || ['Exploring', 'Photography'],
    opening_time: site.opening_time || '08:00',
    closing_time: site.closing_time || '18:00',
    average_time_spent_hours: Number(site.average_time_spent_hours || 2.0),
    cost_egp: Number(site.cost_egp || site.budget || 0.0),
    latitude: site.latitude,
    longitude: site.longitude
  }));

  let distanceBetweenSites = 0.0;
  if (selectedSites.length === 2) {
    const coord1 = { latitude: selectedSites[0].latitude, longitude: selectedSites[0].longitude };
    const coord2 = { latitude: selectedSites[1].latitude, longitude: selectedSites[1].longitude };
    distanceBetweenSites = haversineDistance(coord1, coord2);
  }

  const restaurants = { breakfast: null, lunch: null, dinner: null };
  let dailyCost = formattedSites.reduce((sum, s) => sum + s.cost_egp, 0);

  console.log(`💰 Initial sites cost: ${dailyCost} EGP (Target daily budget: ${dailyBudget} EGP)`);

  if (selectedSites.length) {
    // CRITICAL: Ensure restaurants are in the same city as sites for single location constraint
    const siteCity = selectedSites[0].city;
    console.log(`🍽️ Finding restaurants in ${siteCity} for day ${dayNumber + 1} (Single Location Constraint)`);

    // Validate all sites are in the same city/governorate
    const siteCities = [...new Set(selectedSites.map(s => s.city))];
    if (siteCities.length > 1) {
      console.log(`⚠️ WARNING: Sites span multiple cities: ${siteCities.join(', ')}. Using primary city: ${siteCity}`);
    }

    // Get all unique restaurants to avoid duplicates
    const usedRestaurants = new Set();

    // BREAKFAST: Near the first site (user starts day here)
    console.log(`🌅 Finding breakfast restaurants near first site: ${selectedSites[0].name}`);
    const firstSiteCoord = { latitude: selectedSites[0].latitude, longitude: selectedSites[0].longitude };
    // Get all restaurants for the city at once to avoid multiple queries
    const allRestaurants = await Restaurant.find({
      city: siteCity,
      average_budget_egp: { $lte: foodBudget }
    }).lean();

    console.log(`Found ${allRestaurants.length} total restaurants in ${siteCity}`);

    const breakfast = findClosestRestaurant(allRestaurants, firstSiteCoord, 'breakfast', usedRestaurants);

    if (breakfast) {
      restaurants.breakfast = createRestaurantObject(breakfast, 'breakfast', breakfast.dist);
      dailyCost += breakfast.average_budget_egp || getDefaultMealPrice('breakfast', breakfast.price_range);
      usedRestaurants.add(breakfast._id?.toString() || breakfast.name);
      console.log(`✅ Breakfast: ${breakfast.name} (${Math.round(breakfast.dist * 100) / 100} km from ${selectedSites[0].name})`);
    }

    // LUNCH: Near current location at lunch time (12:00-13:00)
    let lunch = null;
    let lunchLocation = firstSiteCoord; // Default to first site

    if (selectedSites.length === 2) {
      // If user has 2 sites, they'll likely be at the first site during lunch time
      // Or moving between sites, so we use the first site location
      lunchLocation = firstSiteCoord;
      console.log(`🍽️ Finding lunch restaurants near current location at 12:00 (${selectedSites[0].name})`);
    } else {
      console.log(`🍽️ Finding lunch restaurants near ${selectedSites[0].name}`);
    }

    lunch = findClosestRestaurant(allRestaurants, lunchLocation, 'lunch', usedRestaurants);

    if (lunch) {
      restaurants.lunch = createRestaurantObject(lunch, 'lunch', lunch.dist);
      dailyCost += lunch.average_budget_egp || getDefaultMealPrice('lunch', lunch.price_range);
      usedRestaurants.add(lunch._id?.toString() || lunch.name);
      console.log(`✅ Lunch: ${lunch.name} (${Math.round(lunch.dist * 100) / 100} km from current location)`);
    }

    // DINNER: Near the last site (where user ends the day)
    const lastSiteCoord = selectedSites.length === 2
      ? { latitude: selectedSites[1].latitude, longitude: selectedSites[1].longitude }
      : firstSiteCoord;
    const lastSiteName = selectedSites.length === 2 ? selectedSites[1].name : selectedSites[0].name;

    console.log(`🌆 Finding dinner restaurants near last site: ${lastSiteName}`);

    const dinner = findClosestRestaurant(allRestaurants, lastSiteCoord, 'dinner', usedRestaurants);

    if (dinner) {
      restaurants.dinner = createRestaurantObject(dinner, 'dinner', dinner.dist);
      dailyCost += dinner.average_budget_egp || getDefaultMealPrice('dinner', dinner.price_range);
      console.log(`✅ Dinner: ${dinner.name} (${Math.round(dinner.dist * 100) / 100} km from ${lastSiteName})`);
    }
  }

  // 🎯 BUDGET OPTIMIZATION: Maximize daily budget utilization
  const optimizationResult = await optimizeBudgetUtilization(
    dailyBudget,
    dailyCost,
    selectedSites,
    restaurants,
    Restaurant
  );

  dailyCost = optimizationResult.optimizedCost;
  Object.assign(restaurants, optimizationResult.restaurants);

  // Strategy 2: Add premium experiences/activities to sites if still under budget
  const finalRemainingBudget = dailyBudget - dailyCost;
  if (finalRemainingBudget > 150) {
    console.log(`🎭 Adding premium experiences with remaining ${finalRemainingBudget} EGP...`);

    // Add premium experiences to sites
    formattedSites.forEach((site) => {
      if (finalRemainingBudget > 100) {
        const premiumExperiencesCost = Math.min(finalRemainingBudget * 0.3, 200);
        site.cost_egp += premiumExperiencesCost;
        dailyCost += premiumExperiencesCost;

        // Add premium activities
        const premiumActivities = [
          'Private guided tour',
          'Professional photography session',
          'VIP access',
          'Audio guide rental',
          'Souvenir shopping'
        ];

        site.activities = [...(site.activities || []), ...premiumActivities.slice(0, 2)];
        console.log(`⭐ PREMIUM: Added ${premiumExperiencesCost} EGP premium experience to ${site.name}`);
      }
    });
  }

  const finalBudgetUtilization = dailyCost / dailyBudget;
  console.log(`💰 FINAL: ${dailyCost} EGP / ${dailyBudget} EGP (${(finalBudgetUtilization * 100).toFixed(1)}% utilized)`);
  console.log(`💰 Final remaining: ${(dailyBudget - dailyCost).toFixed(0)} EGP`);

  // Generate comprehensive itinerary using AI
  let comprehensiveItinerary = null;
  try {
    console.log(`🤖 Generating AI-powered comprehensive itinerary for day ${dayNumber + 1}`);
    comprehensiveItinerary = await generateComprehensiveItinerary(
      formattedSites,
      restaurants,
      userData,
      dayNumber
    );
    console.log(`✅ Generated comprehensive itinerary for day ${dayNumber + 1}`);
  } catch (error) {
    console.error(`❌ Error generating comprehensive itinerary for day ${dayNumber + 1}:`, error.message);
  }

  // Create standardized activities structure for consistent frontend display
  const standardizedActivities = [];

  // Breakfast activity (08:00)
  if (restaurants.breakfast) {
    standardizedActivities.push({
      id: `day-${dayNumber + 1}-breakfast`,
      time: '08:00',
      title: `Breakfast at ${restaurants.breakfast.name}`,
      description: restaurants.breakfast.description,
      location: restaurants.breakfast.city,
      type: 'restaurant',
      duration: '1 hour',
      cost_egp: restaurants.breakfast.budget_egp,
      meal_type: 'breakfast'
    });
  }

  // Morning activity (first site)
  if (formattedSites[0]) {
    standardizedActivities.push({
      id: `day-${dayNumber + 1}-morning-site`,
      time: '09:00',
      title: `Visit ${formattedSites[0].name}`,
      description: formattedSites[0].description,
      location: formattedSites[0].city,
      type: 'site',
      duration: `${formattedSites[0].average_time_spent_hours} hours`,
      cost_egp: formattedSites[0].cost_egp,
      activities: formattedSites[0].activities,
      coordinates: {
        latitude: formattedSites[0].latitude,
        longitude: formattedSites[0].longitude
      }
    });
  }

  // Lunch activity
  if (restaurants.lunch) {
    standardizedActivities.push({
      id: `day-${dayNumber + 1}-lunch`,
      time: '12:00',
      title: `Lunch at ${restaurants.lunch.name}`,
      description: restaurants.lunch.description,
      location: restaurants.lunch.city,
      type: 'restaurant',
      duration: '1 hour',
      cost_egp: restaurants.lunch.budget_egp,
      meal_type: 'lunch'
    });
  }

  // Afternoon activity (second site if available)
  if (formattedSites[1]) {
    standardizedActivities.push({
      id: `day-${dayNumber + 1}-afternoon-site`,
      time: '15:00',
      title: `Visit ${formattedSites[1].name}`,
      description: formattedSites[1].description,
      location: formattedSites[1].city,
      type: 'site',
      duration: `${formattedSites[1].average_time_spent_hours} hours`,
      cost_egp: formattedSites[1].cost_egp,
      activities: formattedSites[1].activities,
      coordinates: {
        latitude: formattedSites[1].latitude,
        longitude: formattedSites[1].longitude
      }
    });
  }

  // Dinner activity
  if (restaurants.dinner) {
    standardizedActivities.push({
      id: `day-${dayNumber + 1}-dinner`,
      time: '19:00',
      title: `Dinner at ${restaurants.dinner.name}`,
      description: restaurants.dinner.description,
      location: restaurants.dinner.city,
      type: 'restaurant',
      duration: '1.5 hours',
      cost_egp: restaurants.dinner.budget_egp,
      meal_type: 'dinner'
    });
  }

  return {
    day: dayNumber + 1,
    city: formattedSites[0]?.city || targetCity || 'Cairo', // Add city to main structure
    sites: formattedSites,
    distance_between_sites_km: Number(distanceBetweenSites),
    restaurants,
    daily_cost_egp: Number(dailyCost),
    comprehensive_itinerary: comprehensiveItinerary,
    // NEW: Standardized activities structure for consistent frontend display
    activities: standardizedActivities,
    day_summary: {
      total_activities: standardizedActivities.length,
      sites_count: formattedSites.length,
      restaurants_count: Object.values(restaurants).filter(r => r !== null).length,
      estimated_duration: '10 hours',
      primary_city: formattedSites[0]?.city || targetCity || 'Cairo'
    }
  };
};

// Optimize city allocation for logical trip flow
const optimizeCityAllocation = (cities, totalDays) => {
  if (!cities || cities.length <= 1) {
    const allocation = Array(totalDays).fill(cities?.[0] || null);
    console.log(`🗺️ Single city trip: ${cities?.[0] || 'Any city'} for all ${totalDays} days`);
    return allocation;
  }

  console.log(`🗺️ OPTIMIZING LOGICAL TRIP FLOW:`);
  console.log(`   📊 ${totalDays} days across ${cities.length} cities: [${cities.join(', ')}]`);

  // Calculate days per city (distribute as evenly as possible)
  const baseDaysPerCity = Math.floor(totalDays / cities.length);
  const extraDays = totalDays % cities.length;

  console.log(`   📐 Base days per city: ${baseDaysPerCity}, Extra days to distribute: ${extraDays}`);

  const cityAllocation = [];
  let currentDay = 0;

  cities.forEach((city, index) => {
    // Some cities get an extra day if there are remainder days
    const daysForThisCity = baseDaysPerCity + (index < extraDays ? 1 : 0);
    console.log(`   🏙️ ${city}: ${daysForThisCity} consecutive days`);

    for (let i = 0; i < daysForThisCity; i++) {
      cityAllocation[currentDay] = city;
      currentDay++;
    }
  });

  console.log(`✅ OPTIMIZED ALLOCATION (Consecutive Grouping):`);
  console.log(`   ${cityAllocation.map((city, day) => `Day ${day + 1}: ${city}`).join(' | ')}`);

  // Show the logical flow benefit
  const consecutiveGroups = [];
  let currentGroup = { city: cityAllocation[0], start: 1, count: 1 };

  for (let i = 1; i < cityAllocation.length; i++) {
    if (cityAllocation[i] === currentGroup.city) {
      currentGroup.count++;
    } else {
      consecutiveGroups.push(`${currentGroup.city}: Days ${currentGroup.start}-${currentGroup.start + currentGroup.count - 1}`);
      currentGroup = { city: cityAllocation[i], start: i + 1, count: 1 };
    }
  }
  consecutiveGroups.push(`${currentGroup.city}: Days ${currentGroup.start}-${currentGroup.start + currentGroup.count - 1}`);

  console.log(`🎯 LOGICAL FLOW ACHIEVED: ${consecutiveGroups.join(' → ')}`);
  return cityAllocation;
};

// Build complete trip plan
export const buildTripPlan = async (userData) => {
  console.log('🚀 Starting trip plan generation...');
  console.log('User data:', userData);

  try {
    // Input validation and data extraction
    let extractedData = userData;

    // Handle extraction service response format
    if (userData.success !== undefined) {
      if (!userData.success || !userData.data || !userData.data.complete) {
        console.log('❌ Incomplete extraction data - cannot build trip plan');
        return {
          success: false,
          error: 'Trip data extraction incomplete. Please provide all required information.',
          days: [],
          totalCost: 0
        };
      }
      extractedData = userData.data;
    }

    // Validate required fields with fallbacks
    const validatedData = {
      age: extractedData.age || 25, // Default age
      budget: Number(extractedData.budget) || 5000, // Default budget
      days: Number(extractedData.days) || 3, // Default days
      interests: Array.isArray(extractedData.interests) ? extractedData.interests : ['culture', 'history'],
      cities: Array.isArray(extractedData.cities) ? extractedData.cities : ['Cairo']
    };

    console.log('✅ Validated data:', validatedData);

    // Optimize city allocation for logical travel flow
    const cityAllocation = optimizeCityAllocation(validatedData.cities, validatedData.days);

    const tripPlan = {
      user_preferences: {
        age: validatedData.age,
        total_budget_egp: Number(validatedData.budget),
        daily_budget_egp: Number(validatedData.budget / validatedData.days),
        interests: validatedData.interests,
        duration_days: validatedData.days,
        city: validatedData.cities ? validatedData.cities[0] : 'Not specified (Nationwide)',
        city_allocation: cityAllocation // Add city allocation to user preferences
      },
      days: [],
      trip_summary: {
        total_trip_cost_egp: 0.0,
        remaining_budget_egp: 0.0
      }
    };

    const usedSites = new Set();
    console.log(`📅 Generating ${validatedData.days} days of itinerary...`);

    for (let day = 0; day < validatedData.days; day++) {
      console.log(`\n--- Day ${day + 1} ---`);
      try {
        // Pass the optimized city allocation to daily plan builder
        const dailyPlan = await buildDailyPlan(validatedData, day, usedSites, cityAllocation[day]);
        tripPlan.days.push(dailyPlan);
        console.log(`✅ Day ${day + 1} completed successfully`);
      } catch (dayError) {
        console.error(`❌ Error building day ${day + 1}:`, dayError.message);
        // Add a fallback day
        tripPlan.days.push({
          day: day + 1,
          sites: [],
          distance_between_sites_km: 0,
          restaurants: { breakfast: null, lunch: null, dinner: null },
          daily_cost_egp: 0
        });
      }
    }

    const totalCost = tripPlan.days.reduce((sum, day) => sum + day.daily_cost_egp, 0);
    tripPlan.trip_summary.total_trip_cost_egp = Number(totalCost);
    tripPlan.trip_summary.remaining_budget_egp = Number(userData.budget - totalCost);

    console.log('🎉 Trip plan generation completed!');
    console.log(`Total cost: ${totalCost} EGP`);
    console.log(`Days generated: ${tripPlan.days.length}`);

    return tripPlan;
  } catch (error) {
    console.error('❌ Critical error in buildTripPlan:', error);
    throw error;
  }
};

// Convert MongoDB trip plan to frontend format
export const convertTripPlanToFrontendFormat = (tripPlan) => {
  const suggestions = [];
  
  tripPlan.days.forEach((day, dayIndex) => {
    day.sites.forEach((site, siteIndex) => {
      suggestions.push({
        id: `mongo-site-${dayIndex}-${siteIndex}`,
        name: site.name,
        region: site.city,
        category: 'historical', // Default category
        shortDescription: site.description,
        coverImage: `/src/assets/destinations/${site.name.toLowerCase().replace(/\s+/g, '-')}.svg`,
        averageRating: Math.min(5, 3 + site.similarity_score * 2), // Convert similarity to rating
        reviewCount: Math.floor(Math.random() * 1000) + 100,
        entryFee: { adult: `${site.cost_egp} EGP` },
        visitDuration: `${site.average_time_spent_hours} hours`,
        reason: `Similarity score: ${site.similarity_score}`,
        priority: site.similarity_score > 0.7 ? 'high' : site.similarity_score > 0.4 ? 'medium' : 'low',
        mongoData: site // Keep original data for reference
      });
    });
  });

  return {
    destinations: suggestions,
    tripPlan: tripPlan,
    dailyPlans: tripPlan.days,
    totalEstimatedCost: tripPlan.trip_summary.total_trip_cost_egp,
    recommendations: [
      'Book popular attractions in advance',
      'Stay hydrated and wear sun protection',
      'Consider hiring local guides for historical sites'
    ]
  };
};
