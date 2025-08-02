import mongoose from 'mongoose';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Clean AI response by removing tokenization artifacts
 * @param {string} response - The raw AI response
 * @returns {string} Cleaned response
 */
const cleanAIResponse = (response) => {
  if (!response || typeof response !== 'string') return response;

  return response
    .replace(/<\|header_start\|>/g, '')
    .replace(/<\|header_end\|>/g, '')
    .replace(/<\|im_start\|>/g, '')
    .replace(/<\|im_end\|>/g, '')
    .replace(/<\|system\|>/g, '')
    .replace(/<\|user\|>/g, '')
    .replace(/<\|assistant\|>/g, '')
    .trim();
};

// ── CONNECTIONS ────────────────────────────────────────────────────────────────
// We’ll create two distinct connections:
//  • `tourismConn` points to the “tourism” database (contains “sites” collection).
//  • `restaurantConn` points to the “Resturants” database (contains “Egyptian” collection).

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://abdelrahmannasser139:12345@cluster0.5ddi3ns.mongodb.net/';

const tourismConn = mongoose.createConnection(
  `${MONGO_URI}tourism`,
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
);

const restaurantConn = mongoose.createConnection(
  `${MONGO_URI}Resturants`,
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
);

tourismConn.once('open', () => {
  console.log('✅ Connected to “tourism” database (sites collection)');
});
tourismConn.on('error', err => {
  console.error('❌ tourismConn connection error:', err);
});

restaurantConn.once('open', () => {
  console.log('✅ Connected to “Resturants” database (Egyptian collection)');
});
restaurantConn.on('error', err => {
  console.error('❌ restaurantConn connection error:', err);
});

// ── SCHEMAS ─────────────────────────────────────────────────────────────────────
const siteSchema = new mongoose.Schema({
  name: String,
  city: String,
  description: String,
  searchbyembedding: [Number],
  activities: [String],
  opening_time: String,
  closing_time: String,
  average_time_spent_hours: Number,
  budget: Number,
  latitude: Number,
  longitude: Number,
  age_limit: Number
});

const restaurantSchema = new mongoose.Schema({
  name: String,
  city: String,
  description: String,
  average_budget_egp: Number,
  opening_hours: String,
  closing_hours: String,
  latitude: Number,
  longitude: Number,
  type: String // breakfast, lunch, dinner
});

// ── MODELS ──────────────────────────────────────────────────────────────────────
// Bind each model to its respective connection and collection name:
export const Site = tourismConn.model('Site', siteSchema, 'sites');
export const Restaurant = restaurantConn.model('Restaurant', restaurantSchema, 'Egyptian');

// ── UTILITY FUNCTIONS ───────────────────────────────────────────────────────────
export const haversineDistance = (coord1, coord2) => {
  const R = 6371.0; // Earth's radius in kilometers
  const toRad = x => x * Math.PI / 180;
  const lat1 = toRad(coord1.latitude),
    lon1 = toRad(coord1.longitude);
  const lat2 = toRad(coord2.latitude),
    lon2 = toRad(coord2.longitude);

  const dlat = lat2 - lat1;
  const dlon = lon2 - lon1;

  const a =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dlon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return Number(distance.toFixed(2));
};

// Embedding generation (placeholder – replace with real API)
export const generateEmbedding = async (text) => {
  if (!text) return Array(384).fill(0);
  const prefix = "Represent this sentence for searching relevant passages: ";
  const fullText = text.startsWith(prefix) ? text : prefix + text.trim();

  try {
    // TODO: plug in your actual embedding API call
    console.log('Generating embedding for:', text);
    return Array(384).fill(0).map(() => Math.random() - 0.5);
  } catch (error) {
    console.error('Embedding API error:', error.message);
    return Array(384).fill(0);
  }
};

export const cosineSimilarity = (vecA, vecB) => {
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return magA && magB ? dotProduct / (magA * magB) : 0;
};

// ── Enhanced Itinerary Generation with RAG ────────────────────────────────────────────
export const generateComprehensiveItinerary = async (sites, restaurants, userData, dayNumber) => {
  console.log(`🎯 Generating comprehensive itinerary for day ${dayNumber + 1}`);

  // Calculate actual daily total
  const siteCosts = sites.reduce((sum, site) => sum + (site.cost_egp || 0), 0);
  const restaurantCosts = (restaurants.breakfast?.budget_egp || 0) +
                         (restaurants.lunch?.budget_egp || 0) +
                         (restaurants.dinner?.budget_egp || 0);
  const actualDailyTotal = siteCosts + restaurantCosts;
  const primaryCity = sites[0]?.city || 'Cairo';

  // Generate intelligent transportation suggestions
  const transportationSuggestion = generateTransportationSuggestions(sites, restaurants, primaryCity);
  const transportationCost = calculateTransportationCosts(sites, primaryCity);

  const prompt = `
Create a professional full-day Egypt travel itinerary for Day ${dayNumber + 1}.

STRICT REQUIREMENTS:
- Use ONLY the exact restaurant names and costs provided
- Use ONLY the exact site names and costs provided
- Follow the format template EXACTLY
- Keep descriptions professional and informative
- Include practical travel tips

USER PROFILE: Age ${userData.age}, interests: ${userData.interests.join(', ')}

SITES FOR TODAY:
${sites.map(site => `- ${site.name} (${site.city}): ${(site.description || 'Historic site').substring(0, 80)}... | COST: ${site.cost_egp} EGP`).join('\n')}

RESTAURANTS FOR TODAY:
${restaurants.breakfast ? `- Breakfast: ${restaurants.breakfast.name} | COST: ${restaurants.breakfast.budget_egp} EGP` : '- Breakfast: Not scheduled'}
${restaurants.lunch ? `- Lunch: ${restaurants.lunch.name} | COST: ${restaurants.lunch.budget_egp} EGP` : '- Lunch: Not scheduled'}
${restaurants.dinner ? `- Dinner: ${restaurants.dinner.name} | COST: ${restaurants.dinner.budget_egp} EGP` : '- Dinner: Not scheduled'}

REQUIRED FORMAT (copy exactly, replace bracketed content):

🌅 **Day ${dayNumber + 1} - ${primaryCity} Adventure**

**08:00 - Breakfast**
Breakfast at ${restaurants.breakfast?.name || 'Local Café'} - ${restaurants.breakfast ? 'Traditional Egyptian breakfast with authentic local flavors' : 'Local breakfast experience'}
💰 Budget: ${restaurants.breakfast?.budget_egp || 100} EGP | ⏱️ Duration: 1 hour
💡 Tip: Try the traditional ful medames (fava beans) with fresh Egyptian bread

**09:00 - Morning Site Visit**
Visit ${sites[0]?.name || 'Historic Site'} - ${sites[0] ? (sites[0].description || 'Explore ancient Egyptian heritage').substring(0, 100) : 'Explore ancient Egyptian heritage'}
⏱️ Duration: ${sites[0]?.average_time_spent_hours || 2} hours | 💰 Cost: ${sites[0]?.cost_egp || 0} EGP | 📍 Location: ${sites[0]?.city || primaryCity}
🎯 Activities: Guided tour, photography, historical exploration
💡 Tip: Arrive early to avoid crowds and enjoy cooler temperatures

**12:00 - Lunch Break**
Lunch at ${restaurants.lunch?.name || 'Local Restaurant'} - ${restaurants.lunch ? 'Authentic Egyptian and Middle Eastern cuisine' : 'Traditional Egyptian lunch'}
💰 Budget: ${restaurants.lunch?.budget_egp || 200} EGP | ⏱️ Duration: 1.5 hours
💡 Tip: Order koshari, Egypt's national dish, for an authentic experience

${sites[1] ? `**14:00 - Afternoon Site Visit**
Visit ${sites[1].name} - ${(sites[1].description || 'Cultural site exploration').substring(0, 100)}
⏱️ Duration: ${sites[1].average_time_spent_hours || 2} hours | 💰 Cost: ${sites[1].cost_egp || 0} EGP | 📍 Location: ${sites[1].city || primaryCity}
🎯 Activities: Cultural exploration, guided tour, souvenir shopping
💡 Tip: Bring comfortable walking shoes and stay hydrated` : `**14:00 - Free Time**
Explore local markets or relax at your accommodation
💡 Tip: Use this time to rest and prepare for dinner`}

**19:00 - Dinner**
Dinner at ${restaurants.dinner?.name || 'Traditional Restaurant'} - ${restaurants.dinner ? 'Elegant Egyptian dining with traditional specialties' : 'Authentic Egyptian dinner experience'}
💰 Budget: ${restaurants.dinner?.budget_egp || 300} EGP | ⏱️ Duration: 1.5 hours
💡 Tip: Try grilled meats and traditional Egyptian desserts

**Transportation:** ${transportationSuggestion}
**Transportation Cost:** Approximately ${transportationCost} EGP for the day
**Daily Total:** ${actualDailyTotal} EGP (excluding transportation)

IMPORTANT: Use this exact format and the exact costs provided above.
`;

  try {
    const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: 'llama-3.1-70b-versatile', // More reliable model for consistent formatting
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3, // Lower temperature for more consistent output
      max_tokens: 1500
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const aiResponse = cleanAIResponse(response.data.choices[0].message.content);

    // Validate and fix the response if needed
    return validateAndFixItinerary(aiResponse, sites, restaurants, dayNumber, actualDailyTotal, primaryCity);

  } catch (error) {
    console.error('Error generating comprehensive itinerary:', error.message);
    // Fallback to basic itinerary
    return generateBasicItinerary(sites, restaurants, dayNumber);
  }
};

// Generate intelligent transportation suggestions based on sites
const generateTransportationSuggestions = (sites, _restaurants, primaryCity) => {
  if (!sites || sites.length === 0) {
    return "Use local transportation as needed (approximately 50-100 EGP per trip)";
  }

  const siteNames = sites.map(s => s.name?.toLowerCase() || '');
  const cityLower = primaryCity?.toLowerCase() || '';

  // Site-specific transportation recommendations
  const transportationRules = {
    // Pyramids and Giza area
    pyramids: {
      keywords: ['pyramid', 'giza', 'sphinx'],
      suggestion: "🚗 Taxi/Uber to Pyramids (150-200 EGP from Cairo center) or organized tour bus. 🐪 Camel rides available on-site (100-150 EGP). Avoid walking long distances in desert heat."
    },

    // Cairo city center and museums
    museums: {
      keywords: ['museum', 'egyptian museum', 'coptic', 'islamic cairo'],
      suggestion: "🚇 Cairo Metro (5-10 EGP) or taxi (30-80 EGP within city). 🚶‍♂️ Walking between nearby sites in Islamic/Coptic Cairo. Use ride-sharing apps for convenience."
    },

    // Luxor sites
    luxor: {
      keywords: ['luxor', 'karnak', 'valley of kings', 'hatshepsut', 'thebes'],
      suggestion: "🚗 Private taxi for full day (300-500 EGP) or organized tour. 🚲 Bicycle rental for East Bank sites (50-100 EGP/day). ⛵ Felucca boat for Nile crossing (20-50 EGP)."
    },

    // Aswan sites
    aswan: {
      keywords: ['aswan', 'philae', 'abu simbel', 'high dam', 'nubian'],
      suggestion: "🚗 Private taxi/driver (400-600 EGP/day) for multiple sites. ⛵ Motorboat to Philae Temple (100-150 EGP). 🚌 Tour bus for Abu Simbel (300-500 EGP including transport)."
    },

    // Alexandria sites
    alexandria: {
      keywords: ['alexandria', 'bibliotheca', 'citadel', 'catacombs', 'montaza'],
      suggestion: "🚗 Taxi or ride-sharing within city (20-60 EGP per trip). 🚌 Local buses (5-10 EGP). 🚶‍♂️ Walking along Corniche between waterfront sites."
    },

    // Red Sea destinations
    redsea: {
      keywords: ['hurghada', 'sharm', 'dahab', 'marsa alam', 'red sea'],
      suggestion: "🚗 Hotel shuttle or taxi to dive sites (100-200 EGP). 🚤 Boat trips for snorkeling/diving (300-800 EGP including transport). 🚌 Tourist buses between resorts."
    },

    // Siwa Oasis
    siwa: {
      keywords: ['siwa', 'oasis', 'desert'],
      suggestion: "🚗 4WD vehicle essential for desert sites (500-800 EGP/day with driver). 🚲 Bicycle for town exploration (30-50 EGP/day). 🐪 Camel treks for sunset tours."
    }
  };

  // Find matching transportation rule
  let matchedRule = null;
  let matchCount = 0;

  for (const [_category, rule] of Object.entries(transportationRules)) {
    const matches = rule.keywords.filter(keyword =>
      siteNames.some(siteName => siteName.includes(keyword)) ||
      cityLower.includes(keyword)
    ).length;

    if (matches > matchCount) {
      matchCount = matches;
      matchedRule = rule;
    }
  }

  // Default transportation for Cairo/general Egypt
  if (!matchedRule) {
    if (cityLower.includes('cairo') || cityLower.includes('giza')) {
      return "🚇 Cairo Metro (5-10 EGP), taxi (30-100 EGP per trip), or ride-sharing apps. 🚶‍♂️ Walking between nearby sites when possible.";
    } else {
      return "🚗 Local taxi or ride-sharing (50-150 EGP per trip). 🚌 Public buses available (10-30 EGP). Consider hiring a driver for multiple sites.";
    }
  }

  return matchedRule.suggestion;
};

// Calculate estimated transportation costs based on sites
const calculateTransportationCosts = (sites, primaryCity) => {
  if (!sites || sites.length === 0) return 100;

  const siteNames = sites.map(s => s.name?.toLowerCase() || '');
  const cityLower = primaryCity?.toLowerCase() || '';

  // Cost estimates based on site types and locations
  if (siteNames.some(name => name.includes('pyramid') || name.includes('giza'))) {
    return 200; // Higher cost for Pyramids (taxi from Cairo + local transport)
  }

  if (cityLower.includes('luxor') || cityLower.includes('aswan')) {
    return 300; // Higher cost for Upper Egypt (private transport often needed)
  }

  if (cityLower.includes('alexandria')) {
    return 150; // Moderate cost for Alexandria
  }

  if (siteNames.some(name => name.includes('museum') || name.includes('cairo'))) {
    return 80; // Lower cost for Cairo city center (metro + short taxis)
  }

  return 120; // Default moderate cost
};

// Validate and fix AI-generated itinerary for consistency
const validateAndFixItinerary = (aiResponse, sites, restaurants, dayNumber, actualDailyTotal, primaryCity) => {
  // If AI response is malformed or too short, use fallback
  if (!aiResponse || aiResponse.length < 200) {
    console.log('⚠️ AI response too short, using fallback itinerary');
    return generateBasicItinerary(sites, restaurants, dayNumber);
  }

  // Fix common formatting issues
  let fixedResponse = aiResponse
    // Ensure consistent emoji spacing
    .replace(/💰\s*Budget:/g, '💰 Budget:')
    .replace(/⏱️\s*Duration:/g, '⏱️ Duration:')
    .replace(/📍\s*Location:/g, '📍 Location:')
    .replace(/🎯\s*Activities:/g, '🎯 Activities:')
    .replace(/💡\s*Tip:/g, '💡 Tip:')
    // Fix daily total if incorrect
    .replace(/\*\*Daily Total:\*\*\s*\d+\s*EGP/g, `**Daily Total:** ${actualDailyTotal} EGP`)
    // Ensure proper line breaks
    .replace(/\n{3,}/g, '\n\n')
    // Fix city name consistency
    .replace(/Day \d+ - .* Adventure/g, `Day ${dayNumber + 1} - ${primaryCity} Adventure`);

  return fixedResponse;
};

const generateBasicItinerary = (sites, restaurants, dayNumber) => {
  const primaryCity = sites[0]?.city || 'Cairo';
  const transportationSuggestion = generateTransportationSuggestions(sites, restaurants, primaryCity);
  const transportationCost = calculateTransportationCosts(sites, primaryCity);
  let itinerary = `🌅 **Day ${dayNumber + 1} - ${primaryCity} Adventure**\n\n`;

  // Breakfast (08:00)
  if (restaurants.breakfast) {
    itinerary += `**08:00 - Breakfast**\n`;
    itinerary += `Breakfast at ${restaurants.breakfast.name} - ${restaurants.breakfast.description || 'Traditional Egyptian breakfast'}\n`;
    itinerary += `💰 Budget: ${restaurants.breakfast.budget_egp || 0} EGP | ⏱️ Duration: 1 hour\n`;
    itinerary += `💡 Tip: Start your day with traditional ful medames and fresh bread\n\n`;
  }

  // Morning site (09:00)
  if (sites[0]) {
    itinerary += `**09:00 - Morning Site Visit**\n`;
    itinerary += `Visit ${sites[0].name} - ${sites[0].description || 'Historic site exploration'}\n`;
    itinerary += `⏱️ Duration: ${sites[0].average_time_spent_hours} hours | 💰 Cost: ${sites[0].cost_egp || 0} EGP | 📍 Location: ${sites[0].city}\n`;
    itinerary += `🎯 Activities: ${sites[0].activities?.join(', ') || 'Exploring, Photography'}\n`;
    itinerary += `💡 Tip: Arrive early to avoid crowds and enjoy the best lighting for photos\n\n`;
  }

  // Lunch (13:00)
  if (restaurants.lunch) {
    itinerary += `**13:00 - Lunch Break**\n`;
    itinerary += `Lunch at ${restaurants.lunch.name} - ${restaurants.lunch.description || 'Local cuisine experience'}\n`;
    itinerary += `💰 Budget: ${restaurants.lunch.budget_egp || 0} EGP | ⏱️ Duration: 1 hour\n`;
    itinerary += `💡 Tip: Try traditional Egyptian dishes and stay hydrated\n\n`;
  }

  // Afternoon site (15:00)
  if (sites[1]) {
    itinerary += `**15:00 - Afternoon Site Visit**\n`;
    itinerary += `Visit ${sites[1].name} - ${sites[1].description || 'Cultural site exploration'}\n`;
    itinerary += `⏱️ Duration: ${sites[1].average_time_spent_hours} hours | 💰 Cost: ${sites[1].cost_egp || 0} EGP | 📍 Location: ${sites[1].city}\n`;
    itinerary += `🎯 Activities: ${sites[1].activities?.join(', ') || 'Exploring, Photography'}\n`;
    itinerary += `💡 Tip: Perfect time for afternoon exploration with comfortable temperatures\n\n`;
  }

  // Dinner (19:00)
  if (restaurants.dinner) {
    itinerary += `**19:00 - Dinner**\n`;
    itinerary += `Dinner at ${restaurants.dinner.name} - ${restaurants.dinner.description || 'Authentic Egyptian dining experience'}\n`;
    itinerary += `� Budget: ${restaurants.dinner.budget_egp || 0} EGP | ⏱️ Duration: 1.5 hours\n`;
    itinerary += `💡 Tip: Experience local flavors and enjoy the evening atmosphere\n\n`;
  }

  // Transportation and total
  const totalCost = (sites[0]?.cost_egp || 0) + (sites[1]?.cost_egp || 0) +
                   (restaurants.breakfast?.budget_egp || 0) + (restaurants.lunch?.budget_egp || 0) + (restaurants.dinner?.budget_egp || 0);

  itinerary += `**Transportation:** ${transportationSuggestion}\n`;
  itinerary += `**Transportation Cost:** Approximately ${transportationCost} EGP for the day\n`;
  itinerary += `**Daily Total:** ${totalCost} EGP (excluding transportation)\n`;

  return itinerary;
};

// ── Groq-powered Trip Data Extraction ────────────────────────────────────────────
export const extractTripDataConversational = async (message, conversationHistory = []) => {
  // No need to “await connectMongoDB” here, since our connections are already open
  const conversation = [
    {
      role: 'system',
      content: `
You are Amira, a friendly Egyptian travel assistant who loves helping people discover Egypt! Be warm, enthusiastic, and helpful while staying concise.

YOUR MISSION: Extract trip planning information from natural language and guide users through a friendly conversation.

CONVERSATION FLOW:
1. **First Message**: User describes their trip naturally
2. **Extract & Review**: Extract what you can, show it to user, ask for missing info
3. **Complete**: When all info is gathered, generate trip plan

INFORMATION NEEDED:
1. **Age** (5-100 years)
2. **Budget in EGP** (minimum 1,000 EGP/day)
3. **Trip Duration** (1-30 days)
4. **Interests** (history, beaches, culture, adventure, etc.)
5. **Cities** (optional - Cairo, Luxor, Hurghada, Sharm El Sheikh, etc.)

EXTRACTION GUIDELINES:
- Extract ANY information you can find from user's natural language
- Look for age mentions: "I'm 25", "25 years old", "I am twenty-five"
- Look for budget: "2000 EGP", "around 1500 per day", "budget of 3000"
- Look for duration: "5 days", "week long", "10 day trip"
- Look for interests: "love history", "interested in beaches", "cultural sites"
- Look for cities: "want to visit Cairo", "Luxor sounds amazing"

CURRENCY CONVERSION (ALWAYS convert to EGP):
- 1 USD = 50 EGP
- 1 EUR = 58 EGP
- If user mentions "$100" or "100 dollars", convert to "5000 EGP"
- If user mentions "€100" or "100 euros", convert to "5800 EGP"
- Always show the conversion: "That's 5000 EGP (converted from $100)"

RESPONSE FORMATS:

**Once all required info is collected, reply with :**
"Great! Let me confirm what I understood:
 Age: [AGE] years old
 Budget: [BUDGET] EGP 
 Duration: [DAYS] days
 Interests: [INTERESTS]
 Cities: [CITIES or "I'll recommend the best ones"]

Is this correct? And I still need: [LIST MISSING INFO]"

**When asking for missing info:**
- Be specific and friendly
- Explain why you need it
- Ask for ONE missing piece at a time

**When complete, return ONLY this JSON:**
{
  "age": AGE_NUMBER,
  "budget": BUDGET_NUMBER_IN_EGP,
  "days": DAYS_NUMBER,
  "interests": ["interest1", "interest2"],
  "cities": ["City1"] or [],
  "complete": true
}

PERSONALITY:
- Warm and enthusiastic about Egypt
- Use encouraging language ("Perfect!" "Wonderful!" "Egypt is amazing for that!")
- Keep responses concise but friendly (4-5 sentences max)
- Show excitement about their trip choices
      `
    },
    ...conversationHistory,
    { role: 'user', content: message }
  ];

  try {
    const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: conversation,
      temperature: 0.5,
      max_tokens: 1024
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const responseText = cleanAIResponse(response.data.choices[0].message.content);

    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        if (data.complete && ['age', 'budget', 'days', 'interests', 'cities'].every(key => key in data)) {
          data.cities = data.cities.length ? data.cities : null;
          return { success: true, data, response: responseText };
        }
      }
    } catch (parseError) {
      console.log('No JSON found, treating as conversational response');
    }

    return {
      success: true,
      data: { complete: false },
      response: responseText
    };
  } catch (error) {
    console.error('Groq API error:', error.message);
    console.error('Error details:', error.response?.data || 'No response data');
    console.error('Status code:', error.response?.status || 'No status');
    console.error('Request URL:', error.config?.url || 'No URL');
    return {
      success: false,
      error: 'Failed to process request',
      response: 'Sorry, I encountered an error. Please try again.'
    };
  }
};

// ── INITIALIZATION CHECK (OPTIONAL) 
export const initializeGroqTripPlanner = async () => {
  // Verify that each connection is ready
  if (tourismConn.readyState === 1) {
    try {
      const siteCount = await tourismConn.collection('sites').countDocuments();
      console.log(`📊 tourism.sites collection: ${siteCount} documents`);
      if (siteCount > 0) {
        const sampleSite = await tourismConn.collection('sites').findOne();
        console.log(`📋 Sample site: ${JSON.stringify({
          name: sampleSite.name,
          city: sampleSite.city,
          hasEmbedding: Array.isArray(sampleSite.searchbyembedding) && sampleSite.searchbyembedding.length > 0
        })}`);
      }
    } catch (e) {
      console.error('❌ Error querying tourism.sites:', e.message);
    }
  }

  if (restaurantConn.readyState === 1) {
    try {
      const restCount = await restaurantConn.collection('Egyptian').countDocuments();
      console.log(`📊 Resturants.Egyptian collection: ${restCount} documents`);
      if (restCount > 0) {
        const sampleRest = await restaurantConn.collection('Egyptian').findOne();
        console.log(`📋 Sample restaurant: ${JSON.stringify({
          name: sampleRest.name,
          city: sampleRest.city,
          average_budget_egp: sampleRest.average_budget_egp
        })}`);
      }
    } catch (e) {
      console.error('❌ Error querying Resturants.Egyptian:', e.message);
    }
  }

  console.log('✅ Groq Trip Planner Service initialized');
};

// ── RAG SEARCH ──────────────────────────────────────────────────────────────────
export const getTopSimilarRecords = async (collection, userEmbedding, city = null, limit = 6, budgetConstraint = null, ageConstraint = null) => {
  console.log(`🔍 RAG Search - Collection: ${collection.modelName}`);
  console.log(`🔍 RAG Search - City filter: ${city || 'None'}`);
  console.log(`🔍 RAG Search - Budget constraint: ${budgetConstraint || 'None'}`);
  console.log(`🔍 RAG Search - Age constraint: ${ageConstraint || 'None'}`);

  let query = { searchbyembedding: { $exists: true, $ne: [] } };
  if (city) query.city = city;
  if (budgetConstraint !== null) {
    query[collection.modelName === 'Site' ? 'budget' : 'average_budget_egp'] = { $lte: budgetConstraint };
  }
  if (ageConstraint !== null && collection.modelName === 'Site') {
    query.age_limit = { $lte: ageConstraint };
  }

  console.log(`🔍 MongoDB Query:`, JSON.stringify(query, null, 2));

  try {
    const candidates = await collection.find(query).lean();
    console.log(`📊 Found ${candidates.length} candidates from database`);

    if (!candidates.length) {
      console.log(`⚠️ No candidates found – trying without embedding filter…`);
      const fallbackQuery = {};
      if (city) fallbackQuery.city = city;
      const fallbackCandidates = await collection.find(fallbackQuery).limit(10).lean();
      console.log(`📊 Fallback search found ${fallbackCandidates.length} documents`);

      if (fallbackCandidates.length > 0) {
        console.log(`📋 Sample document:`, JSON.stringify(fallbackCandidates[0], null, 2));
        return fallbackCandidates.slice(0, limit).map(doc => ({
          ...doc,
          similarity_score: Math.random() * 0.5 + 0.5
        }));
      }
      return [];
    }

    const validCandidates = [];
    const dbEmbeddings = [];
    const expectedDim = userEmbedding.length;

    for (const doc of candidates) {
      const embedding = doc.searchbyembedding || [];
      if (Array.isArray(embedding) && embedding.length === expectedDim) {
        validCandidates.push(doc);
        dbEmbeddings.push(embedding);
      } else {
        console.log(`⚠️ Invalid embedding for ${doc.name}: length ${embedding.length}, expected ${expectedDim}`);
      }
    }

    console.log(`✅ Valid candidates with embeddings: ${validCandidates.length}`);

    if (!dbEmbeddings.length) {
      console.log(`⚠️ No valid embeddings found – returning candidates with mock scores`);
      return candidates.slice(0, limit).map(doc => ({
        ...doc,
        similarity_score: Math.random() * 0.5 + 0.5
      }));
    }

    const similarities = dbEmbeddings.map(emb => cosineSimilarity(userEmbedding, emb));
    const indexedSims = similarities.map((sim, idx) => [idx, sim]);
    indexedSims.sort((a, b) => b[1] - a[1]);

    const topIndices = indexedSims.slice(0, limit).map(([idx]) => idx);
    const topRecords = topIndices.map(idx => ({
      ...validCandidates[idx],
      similarity_score: Number(similarities[idx].toFixed(2))
    }));

    console.log(`🎯 Returning ${topRecords.length} top similar records`);
    return topRecords;
  } catch (error) {
    console.error(`❌ Error in RAG search:`, error.message);
    return [];
  }
};

// ── ROUTING HELPERS ─────────────────────────────────────────────────────────────
export const selectClosestSitePair = (sites, usedSites = new Set()) => {
  const availableSites = sites.filter(site => !usedSites.has(site.name));
  if (availableSites.length < 2) return availableSites.slice(0, 2);

  let minDistance = Infinity;
  let closestPair = null;

  for (let i = 0; i < availableSites.length; i++) {
    for (let j = i + 1; j < availableSites.length; j++) {
      const coord1 = { latitude: availableSites[i].latitude, longitude: availableSites[i].longitude };
      const coord2 = { latitude: availableSites[j].latitude, longitude: availableSites[j].longitude };
      const distance = haversineDistance(coord1, coord2);
      if (distance < minDistance) {
        minDistance = distance;
        closestPair = [availableSites[i], availableSites[j]];
      }
    }
  }

  return closestPair || availableSites.slice(0, 2);
};

export const getMidpoint = (coord1, coord2) => {
  const toRad = x => x * Math.PI / 180;
  const toDeg = x => x * 180 / Math.PI;
  const lat1 = toRad(coord1.latitude),
    lon1 = toRad(coord1.longitude);
  const lat2 = toRad(coord2.latitude),
    lon2 = toRad(coord2.longitude);

  const x1 = Math.cos(lat1) * Math.cos(lon1);
  const y1 = Math.cos(lat1) * Math.sin(lon1);
  const z1 = Math.sin(lat1);
  const x2 = Math.cos(lat2) * Math.cos(lon2);
  const y2 = Math.cos(lat2) * Math.sin(lon2);
  const z2 = Math.sin(lat2);

  const x = (x1 + x2) / 2;
  const y = (y1 + y2) / 2;
  const z = (z1 + z2) / 2;
  const lon = Math.atan2(y, x);
  const hyp = Math.sqrt(x * x + y * y);
  const lat = Math.atan2(z, hyp);

  return { latitude: toDeg(lat), longitude: toDeg(lon) };
};
