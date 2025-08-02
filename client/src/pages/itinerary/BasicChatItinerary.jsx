import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { format, addDays, differenceInDays } from 'date-fns';
import { PlusIcon, TrashIcon, PaperAirplaneIcon, MapIcon, SparklesIcon, GlobeAltIcon } from '@heroicons/react/24/outline';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';

// Import destination images
import pyramidsGizaPhoto from '../../assets/Home Page.jpg';
import karnakTemplePhoto from '../../assets/karnak temp.jpg';
import valleyKingsPhoto from '../../assets/Valley_of_the_Kings.jpg';
import abuSimbelPhoto from '../../assets/Abu Simble.jpg';
import GrandEgyptianMuseumImage from '../../assets/GrandEgyptianMuseum.avif';
import MountSinaiImage from '../../assets/MountSinai.avif';

import { sendGroqChatMessage, convertSuggestionsToDestinations, parseTripPlanFromText, generateEnhancedFallback } from '../../services/groqChatbotService';
import MapboxItineraryMap from '../../components/maps/MapboxItineraryMap';
import MapControlPanel from '../../components/maps/MapControlPanel';

// Inject custom styles for comprehensive plan formatting
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = `
    .comprehensive-plan-content h4 {
      font-size: 1.125rem !important;
      font-weight: 700 !important;
      color: #7c3aed !important;
      margin-top: 1.5rem !important;
      margin-bottom: 0.75rem !important;
      padding-bottom: 0.5rem !important;
      border-bottom: 2px solid #e9d5ff !important;
    }

    .comprehensive-plan-content p {
      margin-bottom: 1rem !important;
      line-height: 1.7 !important;
    }

    .comprehensive-plan-content li {
      margin-left: 1rem !important;
      margin-bottom: 0.5rem !important;
      list-style: none !important;
      position: relative !important;
    }

    .comprehensive-plan-content li::before {
      content: "•" !important;
      color: #7c3aed !important;
      font-weight: bold !important;
      position: absolute !important;
      left: -1rem !important;
    }

    .comprehensive-plan-content strong {
      font-weight: 700 !important;
      color: #1f2937 !important;
    }

    /* Custom scrollbar styles for day tabs */
    .scrollbar-thin {
      scrollbar-width: thin;
    }

    .scrollbar-thin::-webkit-scrollbar {
      height: 6px;
    }

    .scrollbar-track-gray-100::-webkit-scrollbar-track {
      background-color: #f3f4f6;
      border-radius: 3px;
    }

    .scrollbar-thumb-gray-300::-webkit-scrollbar-thumb {
      background-color: #d1d5db;
      border-radius: 3px;
    }

    .scrollbar-thumb-gray-300:hover::-webkit-scrollbar-thumb,
    .hover\\:scrollbar-thumb-gray-400:hover::-webkit-scrollbar-thumb {
      background-color: #9ca3af;
    }

    /* Smooth scrolling for day tabs */
    .day-tabs-container {
      scroll-behavior: smooth;
    }
  `;
  document.head.appendChild(styleElement);
}

// Add custom styles for enhanced visual experience
const customStyles = `
  .animate-fade-in {
    animation: fadeIn 0.3s ease-in-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .custom-scrollbar {
    scrollbar-width: thin;
    scrollbar-color: #D4AF37 #f1f1f1;
  }

  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }

  .custom-scrollbar::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 10px;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: linear-gradient(45deg, #D4AF37, #B8860B);
    border-radius: 10px;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(45deg, #B8860B, #D4AF37);
  }

  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.type = 'text/css';
  styleSheet.innerText = customStyles;
  document.head.appendChild(styleSheet);
}

function BasicChatItinerary() {

  // Constants for localStorage keys
  const STORAGE_KEYS = {
    TRIP_STATE: 'egypt_trip_planner_state',
    LAST_SAVED: 'egypt_trip_planner_last_saved'
  };

  // Helper function to get initial state from localStorage
  const getInitialState = () => {
    try {
      const savedState = localStorage.getItem(STORAGE_KEYS.TRIP_STATE);
      const lastSaved = localStorage.getItem(STORAGE_KEYS.LAST_SAVED);

      if (savedState && lastSaved) {
        const parsedState = JSON.parse(savedState);
        const savedTime = new Date(lastSaved);
        const now = new Date();

        // Only restore if saved within last 24 hours
        if (now - savedTime < 24 * 60 * 60 * 1000) {
          return parsedState;
        }
      }
    } catch (error) {
      console.error('Error loading saved trip state:', error);
    }
    return null;
  };

  const savedState = getInitialState();

  // Basic state for days and dates
  const [days, setDays] = useState(savedState?.days || {});
  const [dates] = useState({
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(addDays(new Date(), 7), 'yyyy-MM-dd')
  });

  // Chat state
  const [messages, setMessages] = useState(savedState?.messages || [
    { role: 'assistant', content: "Hello! I'm Amira, your friendly Egypt travel assistant 🏺 I'm excited to help plan your Egyptian adventure!\nTell me about your dream trip - your age, budget, how many days, what interests you, and any cities you'd like to visit. Just describe it naturally!" }
  ]);
  const [input, setInput] = useState('');
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [sessionId, setSessionId] = useState(savedState?.sessionId || null);

  // State for extracted trip information
  const [extractedTripInfo, setExtractedTripInfo] = useState(savedState?.extractedTripInfo || {
    age: null,
    budget: null,
    days: null,
    interests: [],
    cities: [],
    duration: null,
    travelStyle: null
  });

  // State for AI suggestions
  const [aiSuggestions, setAiSuggestions] = useState(savedState?.aiSuggestions || []);
  const [tripPlan, setTripPlan] = useState(savedState?.tripPlan || null);



  // State for map functionality
  const [showMap, setShowMap] = useState(savedState?.showMap || false);

  // State for day management
  const [activeDay, setActiveDay] = useState(savedState?.activeDay || 'day-1');

  // State for comprehensive plan expansion
  const [expandedPlans, setExpandedPlans] = useState(savedState?.expandedPlans || {});

  // State to track if we have a saved trip
  const [hasSavedTrip, setHasSavedTrip] = useState(!!savedState);



  // Calculate number of days based on user's trip duration or default to 5
  const numDays = extractedTripInfo.days || 5;



  // Initialize days when trip duration changes
  useEffect(() => {
    if (extractedTripInfo.days && extractedTripInfo.days > 0) {

      setDays(prev => {
        const newDays = { ...prev };

        // Initialize empty days up to the requested number
        for (let i = 1; i <= extractedTripInfo.days; i++) {
          const dayId = `day-${i}`;
          if (!newDays[dayId]) {
            newDays[dayId] = []; // Initialize empty day if it doesn't exist
          }
        }

        // Remove days beyond the requested number
        Object.keys(newDays).forEach(dayId => {
          const dayNumber = parseInt(dayId.split('-')[1]);
          if (dayNumber > extractedTripInfo.days) {
            delete newDays[dayId];
          }
        });

        return newDays;
      });

      // Set active day to day-1 if it's not already set or if current active day is beyond the trip duration
      const currentDayNumber = parseInt(activeDay.split('-')[1]);
      if (currentDayNumber > extractedTripInfo.days) {
        setActiveDay('day-1');
      }
    }
  }, [extractedTripInfo.days]);



  // Auto-save trip state when important data changes
  useEffect(() => {
    // Only save if we have meaningful trip data and it's not the initial load
    if (hasSavedTrip || Object.keys(days).length > 0 || messages.length > 1 || extractedTripInfo.days) {
      const timeoutId = setTimeout(() => {
        saveTripState();
        if (!hasSavedTrip) {
          setHasSavedTrip(true);
        }
      }, 1000); // Debounce saves by 1 second

      return () => clearTimeout(timeoutId);
    }
  }, [days, messages, extractedTripInfo, sessionId, activeDay, showMap, expandedPlans]);

  // Function to save trip state to localStorage
  const saveTripState = () => {
    try {
      const stateToSave = {
        days,
        messages,
        sessionId,
        extractedTripInfo,
        aiSuggestions,
        tripPlan,
        showMap,
        activeDay,
        expandedPlans
      };

      localStorage.setItem(STORAGE_KEYS.TRIP_STATE, JSON.stringify(stateToSave));
      localStorage.setItem(STORAGE_KEYS.LAST_SAVED, new Date().toISOString());
    } catch (error) {
      console.error('Error saving trip state:', error);
    }
  };

  // Function to clear saved trip state
  const clearSavedTrip = () => {
    try {
      localStorage.removeItem(STORAGE_KEYS.TRIP_STATE);
      localStorage.removeItem(STORAGE_KEYS.LAST_SAVED);

      // Reset all state to initial values
      setDays({});
      setMessages([
        { role: 'assistant', content: "Hello! I'm Amira, your friendly Egypt travel assistant 🏺 I'm excited to help plan your Egyptian adventure!\nTell me about your dream trip - your age, budget, how many days, what interests you, and any cities you'd like to visit. Just describe it naturally!" }
      ]);
      setSessionId(null);
      setExtractedTripInfo({
        age: null,
        budget: null,
        days: null,
        interests: [],
        cities: [],
        duration: null,
        travelStyle: null
      });
      setAiSuggestions([]);
      setTripPlan(null);
      setShowMap(false);
      setActiveDay('day-1');
      setExpandedPlans({});
      setHasSavedTrip(false);


    } catch (error) {
      console.error('Error clearing trip state:', error);
    }
  };

  // Add a new activity to a day
  const addActivity = (dayId) => {
    const newActivity = {
      id: `activity-${Date.now()}`,
      title: 'New Activity',
      description: 'Click to edit',
      time: '12:00',
      location: 'Location'
    };

    setDays(prev => ({
      ...prev,
      [dayId]: [...(prev[dayId] || []), newActivity]
    }));
  };

  // Remove an activity
  const removeActivity = (dayId, activityIndex) => {
    setDays(prev => {
      const day = [...prev[dayId]];
      day.splice(activityIndex, 1);
      // Recalculate times for remaining activities
      const updatedDay = recalculateActivityTimes(day);
      return { ...prev, [dayId]: updatedDay };
    });
  };



  // Function to recalculate all activity times in a day
  const recalculateActivityTimes = (activities) => {
    if (!activities || activities.length === 0) return activities;

    const startTime = { hours: 9, minutes: 0 }; // 9:00 AM
    let currentTime = { ...startTime };

    return activities.map((activity) => {
      const activityTime = formatTime(currentTime.hours, currentTime.minutes);
      const duration = getActivityDuration(activity);

      // Update current time for next activity (current start + duration + 30 min buffer)
      currentTime = addMinutes(currentTime, duration + 30);

      return {
        ...activity,
        time: activityTime
      };
    });
  };

  // Helper function to get estimated duration for an activity (in minutes)
  const getActivityDuration = (activity) => {
    // Default durations based on destination type or use visitDuration if available
    const defaultDurations = {
      'Pyramids of Giza': 240, // 4 hours
      'Sphinx of Giza': 60,    // 1 hour
      'Karnak Temple': 180,    // 3 hours
      'Luxor Temple': 120,     // 2 hours
      'Valley of the Kings': 180, // 3 hours
      'Temple of Hatshepsut': 90, // 1.5 hours
      'Philae Temple': 120,    // 2 hours
      'Saqqara Step Pyramid': 150, // 2.5 hours
      'Siwa Oasis': 480,       // 8 hours (full day)
    };

    // Try to get duration from the activity's location/title
    const locationKey = activity.location || activity.title?.replace('Visit ', '');
    if (defaultDurations[locationKey]) {
      return defaultDurations[locationKey];
    }

    // Default to 3 hours if not specified
    return 180;
  };



  // Helper function to format time object to string
  const formatTime = (hours, minutes) => {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  // Helper function to add minutes to a time object
  const addMinutes = (time, minutesToAdd) => {
    let totalMinutes = time.hours * 60 + time.minutes + minutesToAdd;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    // Cap at reasonable evening time (don't go past 6 PM)
    if (hours >= 18) {
      return { hours: 18, minutes: 0 };
    }

    return { hours, minutes };
  };

  // Handle drag and drop
  const handleDragEnd = (result) => {
    const { source, destination } = result;

    // If dropped outside a droppable area
    if (!destination) {
      return;
    }

    // If dropped in the same position
    if (source.droppableId === destination.droppableId && source.index === destination.index) {

      return;
    }

    // Note: Destination-to-day drag functionality removed since we now use Most Popular Sites with direct links

    // If reordering within a day
    else if (source.droppableId.startsWith('day-') && destination.droppableId.startsWith('day-')) {

      const sourceDay = source.droppableId;
      const destDay = destination.droppableId;

      try {
        // If moving between days
        if (sourceDay !== destDay) {

          const sourceActivities = [...(days[sourceDay] || [])];
          const destActivities = [...(days[destDay] || [])];

          if (sourceActivities.length <= source.index) {
            console.error("Source activity not found at index:", source.index);
            return;
          }

          // Remove from source day and add to destination day
          const [movedActivity] = sourceActivities.splice(source.index, 1);
          destActivities.splice(destination.index, 0, movedActivity);

          // Recalculate times for both days
          const updatedSourceActivities = recalculateActivityTimes(sourceActivities);
          const updatedDestActivities = recalculateActivityTimes(destActivities);

          setDays(prev => ({
            ...prev,
            [sourceDay]: updatedSourceActivities,
            [destDay]: updatedDestActivities
          }));
        }
        // If reordering within the same day
        else {

          const dayActivities = [...(days[sourceDay] || [])];

          if (dayActivities.length <= source.index) {
            console.error("Activity not found at index:", source.index);
            return;
          }

          const [movedActivity] = dayActivities.splice(source.index, 1);
          dayActivities.splice(destination.index, 0, movedActivity);

          // Recalculate times for the reordered activities
          const updatedActivities = recalculateActivityTimes(dayActivities);

          setDays(prev => ({
            ...prev,
            [sourceDay]: updatedActivities
          }));
        }
      } catch (error) {
        console.error("Error handling activity reordering:", error);
      }
    }
  };

  // Handle regenerating the entire trip plan
  const handleRegeneratePlan = () => {
    // Clear all trip data and start fresh
    setDays({});
    setExtractedTripInfo({});
    setTripPlan(null);
    setAiSuggestions([]);
    setActiveDay('day-1');
    setShowMap(false);
    setExpandedPlans({});

    // Reset chat to initial state
    setMessages([{
      role: 'assistant',
      content: `🏺 Welcome to your Egypt Trip Planner! 🇪🇬

I'm here to help you create an amazing Egyptian adventure. Tell me about your dream trip:

**What I need to know:**
• How many days will you be visiting?
• What's your daily budget?
• Which cities interest you? (Cairo, Luxor, Aswan, Alexandria, etc.)
• What are you most excited to see? (Pyramids, temples, museums, Nile cruise, etc.)
• Any special preferences?

Just describe your ideal Egypt trip and I'll create a personalized itinerary for you! ✨`
    }]);

    // Generate new session ID for fresh conversation
    setSessionId(`session-${Date.now()}`);

    // Clear saved trip data
    clearSavedTrip();

    // Show confirmation message
    setTimeout(() => {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '🔄 Ready for a fresh start! Tell me about your new Egypt trip plans.'
      }]);
    }, 500);
  };

  // Groq-powered chat submission with RAG and trip planning
  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoadingChat) return;

    const userMessage = input.trim();
    setInput('');
    setIsLoadingChat(true);

    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);

    try {


      // Try enhanced fallback first for better offline experience
      let response;
      try {
        // Send message to Groq-powered chatbot API
        response = await sendGroqChatMessage({
          message: userMessage,
          sessionId: sessionId,
          context: {
            type: 'itinerary_planning',
            extractedInfo: extractedTripInfo
          }
        });
      } catch (error) {

        const fallbackResponse = generateEnhancedFallback(userMessage, extractedTripInfo);
        response = {
          success: true,
          data: fallbackResponse
        };
      }

      if (response.success) {
        // Add bot response
        setMessages(prev => [...prev, { role: 'assistant', content: response.data.response }]);

        // Update session ID
        if (response.data.sessionId) {
          setSessionId(response.data.sessionId);
        }

        // Update extracted trip information
        if (response.data.extractedInfo) {

          setExtractedTripInfo(prev => ({
            ...prev,
            ...response.data.extractedInfo
          }));
        }

        // Parse trip plan from response and populate day boxes
        if (response.data.response) {
          const parsedItinerary = parseTripPlanFromText(response.data.response);


          if (Object.keys(parsedItinerary).length > 0) {
            // Merge with existing days, AI-generated activities take priority
            setDays(prev => {
              const newDays = { ...prev };

              // Add parsed activities to respective days
              Object.keys(parsedItinerary).forEach(dayId => {
                const dayData = parsedItinerary[dayId];

                // Handle both old format (array) and new format (object with activities)
                let activities = [];
                if (Array.isArray(dayData)) {
                  // Old format - just activities array
                  activities = dayData;
                } else if (dayData && dayData.activities) {
                  // New format - object with activities and metadata
                  activities = dayData.activities;

                  // Store comprehensive text for display
                  if (dayData.isComprehensive && dayData.comprehensiveText) {
                    // Store the comprehensive text in a separate state or data structure
                    // For now, we'll add it as a special activity
                    activities.unshift({
                      id: `comprehensive-text-${dayId}`,
                      title: `📋 Full Day Plan`,
                      description: dayData.comprehensiveText,
                      time: '00:00',
                      location: 'Overview',
                      type: 'comprehensive-plan',
                      source: 'ai-comprehensive',
                      isComprehensivePlan: true
                    });
                  }
                }

                if (activities.length > 0) {
                  // Only recalculate times if it's not a comprehensive plan with preset times
                  const shouldRecalculateTimes = !dayData.isComprehensive ||
                    !activities.some(a => a.time && a.time !== '09:00');

                  const updatedActivities = shouldRecalculateTimes
                    ? recalculateActivityTimes(activities)
                    : activities;

                  newDays[dayId] = updatedActivities;
                }
              });

              return newDays;
            });

            // Save the trip state after updating days
            setTimeout(() => {
              saveTripState();
              setHasSavedTrip(true);
            }, 500);

            // Show success message
            setTimeout(() => {
              setMessages(prev => [...prev, {
                role: 'assistant',
                content: '✅ Trip plan added to your day tabs above!'
              }]);
            }, 1000);

            // Auto-show map for the first day with activities
            const firstDayWithActivities = Object.keys(parsedItinerary).find(dayId =>
              parsedItinerary[dayId] && parsedItinerary[dayId].length > 0
            );
            if (firstDayWithActivities) {
              setTimeout(() => {
                setActiveDay(firstDayWithActivities);
                setShowMap(true);
              }, 2000);
            }
          }
        }

        // Handle AI suggestions and trip plan
        if (response.data.suggestions && response.data.suggestions.destinations) {


          // Convert MongoDB suggestions to frontend format
          const convertedDestinations = convertSuggestionsToDestinations(response.data.suggestions);
          setAiSuggestions(convertedDestinations);

          // Store the full trip plan
          if (response.data.tripPlan) {
            setTripPlan(response.data.tripPlan);
          }

          // Auto-add high-priority destinations to the itinerary
          const highPriorityDestinations = convertedDestinations.filter(
            dest => dest.priority === 'high'
          );

          if (highPriorityDestinations.length > 0) {


            // Add to first available day
            const dayId = 'day-1';
            const newActivities = highPriorityDestinations.slice(0, 3).map((dest, index) => {
              const baseTime = 9 + (index * 3); // 9 AM, 12 PM, 3 PM
              return {
                id: `groq-suggestion-${dest.id}-${Date.now()}-${index}`,
                title: `Visit ${dest.name}`,
                description: dest.shortDescription || `Explore ${dest.name}`,
                time: `${baseTime.toString().padStart(2, '0')}:00`,
                location: dest.name,
                destinationId: dest.id,
                coverImage: dest.coverImage,
                aiSuggested: true,
                mongoData: dest.mongoData
              };
            });

            setDays(prev => ({
              ...prev,
              [dayId]: [...(prev[dayId] || []), ...newActivities]
            }));

            // Add confirmation message
            setMessages(prev => [...prev, {
              role: 'assistant',
              content: `✨ I've added ${highPriorityDestinations.length} recommended destinations to your itinerary based on AI analysis! You can drag and drop them to rearrange or remove any you don't want.`
            }]);
          }

          // If trip plan is complete, show summary
          if (response.data.isComplete && response.data.tripPlan) {
            const summary = `🎉 Your complete ${response.data.tripPlan.user_preferences.duration_days}-day Egypt itinerary is ready!\n\n💰 Total estimated cost: ${response.data.tripPlan.trip_summary.total_trip_cost_egp.toFixed(2)} EGP\n💵 Remaining budget: ${response.data.tripPlan.trip_summary.remaining_budget_egp.toFixed(2)} EGP\n\nI've added the best destinations to your itinerary. You can drag and drop to customize!`;

            setMessages(prev => [...prev, {
              role: 'assistant',
              content: summary
            }]);
          }
        }
      } else {
        // Handle error
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: response.data.response || 'Sorry, I encountered an error. Please try again.'
        }]);
      }
    } catch (error) {
      console.error('Error in chat submission:', error);

      // Use enhanced fallback for better offline experience
      const fallbackResponse = generateEnhancedFallback(userMessage, extractedTripInfo);

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: fallbackResponse.response
      }]);

      // Update extracted info from fallback
      if (fallbackResponse.extractedInfo) {
        setExtractedTripInfo(prev => ({
          ...prev,
          ...fallbackResponse.extractedInfo
        }));
      }

      // Handle trip plan from fallback
      if (fallbackResponse.tripPlan) {
        setDays(prev => {
          const newDays = { ...prev };
          Object.keys(fallbackResponse.tripPlan).forEach(dayId => {
            const dayData = fallbackResponse.tripPlan[dayId];

            // Handle both old format (array) and new format (object with activities)
            let activities = [];
            if (Array.isArray(dayData)) {
              activities = dayData;
            } else if (dayData && dayData.activities) {
              activities = dayData.activities;
            }

            if (activities.length > 0) {
              const updatedActivities = recalculateActivityTimes(activities);
              newDays[dayId] = updatedActivities;
            }
          });
          return newDays;
        });

        // Show success message for fallback plan
        setTimeout(() => {
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: '✅ Sample plan created! Check your day tabs above!'
          }]);
        }, 1000);
      }
    } finally {
      setIsLoadingChat(false);
    }
  };

  // Handle drag start for debugging
  const handleDragStart = () => {
    // Drag started - could add visual feedback here if needed
  };

  // Handle drag update for debugging
  const handleDragUpdate = () => {
    // Drag update - could add visual feedback here if needed
  };

  // Day management handlers
  const handleDayChange = (dayId) => {
    setActiveDay(dayId);
  };



  const handleDestinationClick = () => {
    // You can add more functionality here, like showing details
  };

  // Toggle comprehensive plan expansion
  const toggleComprehensivePlan = (activityId) => {
    setExpandedPlans(prev => ({
      ...prev,
      [activityId]: !prev[activityId]
    }));
  };



  // Format comprehensive plan content for better display
  const formatComprehensivePlan = (content) => {
    if (!content) return '';

    let formatted = content
      // Remove AI tokenization artifacts first
      .replace(/<\|header_start\|>/g, '')
      .replace(/<\|header_end\|>/g, '')
      .replace(/<\|im_start\|>/g, '')
      .replace(/<\|im_end\|>/g, '')
      .replace(/<\|system\|>/g, '')
      .replace(/<\|user\|>/g, '')
      .replace(/<\|assistant\|>/g, '')
      // Convert **text** to bold
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Convert time patterns to highlighted times
      .replace(/(\d{1,2}:\d{2}\s*(?:AM|PM))/g, '<span class="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 text-sm font-semibold rounded-full mx-1">🕐 $1</span>')
      // Convert budget amounts to highlighted currency
      .replace(/(\d+(?:,\d+)*\s*EGP)/g, '<span class="inline-flex items-center px-3 py-1 bg-green-100 text-green-800 text-sm font-semibold rounded-full mx-1">💰 $1</span>')
      // Convert section headers (lines starting with ** and ending with **)
      .replace(/^\*\*([^*]+)\*\*$/gm, '<h4>$1</h4>')
      // Convert bullet points to proper list items
      .replace(/^[-*]\s+(.+)$/gm, '<li>$1</li>')
      // Convert numbered lists
      .replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>')
      // Convert newlines to proper spacing
      .replace(/\n\n+/g, '</p><p>')
      .replace(/\n/g, '<br/>');

    // Wrap content in paragraphs if not already wrapped
    if (!formatted.startsWith('<')) {
      formatted = '<p>' + formatted + '</p>';
    }

    // Wrap consecutive list items in ul tags
    formatted = formatted.replace(/(<li>.*?<\/li>)(\s*<li>.*?<\/li>)*/g, (match) => {
      return '<ul class="space-y-2 my-4">' + match + '</ul>';
    });

    return formatted;
  };

  // Check if we have any planned destinations to show the map
  const hasPlannedDestinations = Object.values(days).some(dayActivities =>
    dayActivities && dayActivities.length > 0
  );

  // Get available days with activities
  const getAvailableDays = () => {
    const availableDays = [];
    for (let i = 1; i <= numDays; i++) {
      const dayId = `day-${i}`;
      availableDays.push({
        id: dayId,
        number: i,
        hasActivities: days[dayId] && days[dayId].length > 0,
        activityCount: days[dayId]?.length || 0
      });
    }
    return availableDays;
  };

  return (
    <DragDropContext
      onDragEnd={handleDragEnd}
      onDragStart={handleDragStart}
      onDragUpdate={handleDragUpdate}
    >
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
        <div className="container mx-auto px-4 py-8">
          {/* Enhanced Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-nile-blue via-pharaoh-gold to-nile-blue bg-clip-text text-transparent mb-4">
              Plan Your Egyptian Adventure
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Let our AI-powered assistant help you create the perfect itinerary for your journey through ancient Egypt
            </p>
          </div>


          <div className="flex flex-col lg:flex-row gap-8">
            {/* Left column - Chat and Destinations */}
            <div className="lg:w-2/5 space-y-6">
              {/* Enhanced Chat */}
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 h-[650px] flex flex-col overflow-hidden">
                {/* Enhanced Chat header */}
                <div className="bg-gradient-to-r from-nile-blue to-pharaoh-gold p-6 flex items-center">
                  <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center mr-3">
                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-white font-bold text-lg">Pharaoh's Compass</h2>
                    <p className="text-white/80 text-sm">Your AI Travel Assistant</p>
                  </div>
                  <div className="ml-auto">
                    <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                  </div>
                </div>

                {/* Enhanced Chat messages */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gradient-to-b from-gray-50 to-white">
                  {messages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
                    >
                      <div className={`flex items-start space-x-3 max-w-[85%] ${message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                        {/* Avatar */}
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          message.role === 'user'
                            ? 'bg-gradient-to-r from-pharaoh-gold to-yellow-500'
                            : 'bg-gradient-to-r from-nile-blue to-blue-600'
                        }`}>
                          {message.role === 'user' ? (
                            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                            </svg>
                          ) : (
                            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                            </svg>
                          )}
                        </div>

                        {/* Message bubble */}
                        <div
                          className={`rounded-2xl p-4 shadow-sm ${
                            message.role === 'user'
                              ? 'bg-gradient-to-r from-pharaoh-gold to-yellow-500 text-white'
                              : 'bg-white border border-gray-200 text-gray-800 shadow-md'
                          }`}
                        >
                          <p className="text-sm leading-relaxed">{message.content}</p>
                          <div className={`text-xs mt-2 ${message.role === 'user' ? 'text-white/70' : 'text-gray-500'}`}>
                            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Typing indicator */}
                  {isLoadingChat && (
                    <div className="flex justify-start animate-fade-in">
                      <div className="flex items-start space-x-3 max-w-[85%]">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-nile-blue to-blue-600 flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                          </svg>
                        </div>
                        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-md">
                          <div className="flex space-x-1">
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Enhanced Chat input */}
                <div className="p-6 bg-white border-t border-gray-100">
                  <form onSubmit={handleChatSubmit}>
                    <div className="flex items-center space-x-3">
                      <div className="flex-1 relative">
                        <input
                          type="text"
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          placeholder={isLoadingChat ? "AI is analyzing..." : "Tell me your age, budget, days, and interests for Egypt..."}
                          className="w-full border-2 border-gray-200 rounded-2xl px-6 py-4 pr-12 focus:outline-none focus:ring-2 focus:ring-pharaoh-gold focus:border-pharaoh-gold disabled:bg-gray-50 disabled:text-gray-500 transition-all duration-200 text-sm"
                          disabled={isLoadingChat}
                        />
                        <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                          <SparklesIcon className="h-5 w-5 text-gray-400" />
                        </div>
                      </div>
                      <button
                        type="submit"
                        className="bg-gradient-to-r from-pharaoh-gold to-yellow-500 text-white p-4 rounded-2xl hover:from-yellow-500 hover:to-pharaoh-gold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:scale-105"
                        disabled={!input.trim() || isLoadingChat}
                      >
                        {isLoadingChat ? (
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        ) : (
                          <PaperAirplaneIcon className="h-5 w-5" />
                        )}
                      </button>
                    </div>

                    {/* Enhanced Trip info display */}
                    {(extractedTripInfo.interests.length > 0 || extractedTripInfo.budget || extractedTripInfo.days) && (
                      <div className="mt-4 p-4 bg-gradient-to-r from-pharaoh-gold/10 via-yellow-50 to-pharaoh-gold/10 rounded-2xl border border-pharaoh-gold/20">
                        <div className="text-sm text-pharaoh-gold font-bold mb-3 flex items-center">
                          <SparklesIcon className="h-5 w-5 mr-2" />
                          AI Extracted Trip Information
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          {extractedTripInfo.age && (
                            <div className="flex items-center space-x-2 bg-white/50 rounded-lg p-2">
                              <span className="text-lg">👤</span>
                              <span className="text-gray-700 font-medium">Age: {extractedTripInfo.age}+</span>
                            </div>
                          )}
                          {extractedTripInfo.budget && (
                            <div className="flex items-center space-x-2 bg-white/50 rounded-lg p-2">
                              <span className="text-lg">💰</span>
                              <span className="text-gray-700 font-medium">Budget: {extractedTripInfo.budget} EGP</span>
                            </div>
                          )}
                          {extractedTripInfo.days && (
                            <div className="flex items-center space-x-2 bg-white/50 rounded-lg p-2">
                              <span className="text-lg">📅</span>
                              <span className="text-gray-700 font-medium">Duration: {extractedTripInfo.days} days</span>
                            </div>
                          )}
                          {extractedTripInfo.interests.length > 0 && (
                            <div className="flex items-center space-x-2 bg-white/50 rounded-lg p-2 col-span-2">
                              <span className="text-lg">🎯</span>
                              <span className="text-gray-700 font-medium">Interests: {extractedTripInfo.interests.join(', ')}</span>
                            </div>
                          )}
                          {extractedTripInfo.cities && extractedTripInfo.cities.length > 0 && (
                            <div className="flex items-center space-x-2 bg-white/50 rounded-lg p-2 col-span-2">
                              <span className="text-lg">🏙️</span>
                              <span className="text-gray-700 font-medium">Cities: {extractedTripInfo.cities.join(', ')}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </form>
                </div>
              </div>

              {/* Enhanced AI Suggestions Box */}
              {aiSuggestions.length > 0 && (
                <div className="bg-gradient-to-br from-pharaoh-gold/10 via-yellow-50 to-nile-blue/10 rounded-2xl shadow-xl border border-pharaoh-gold/20 p-6 animate-fade-in">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold bg-gradient-to-r from-pharaoh-gold to-nile-blue bg-clip-text text-transparent flex items-center">
                      <SparklesIcon className="h-6 w-6 mr-2 text-pharaoh-gold" />
                      AI-Powered Recommendations
                    </h2>
                    <div className="bg-gradient-to-r from-pharaoh-gold to-yellow-500 text-white text-xs px-3 py-1 rounded-full font-medium">
                      {aiSuggestions.length} suggestions
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">Personalized recommendations based on your preferences and AI analysis:</p>

                  <div className="space-y-3 max-h-[350px] overflow-y-auto custom-scrollbar">
                    {aiSuggestions.slice(0, 8).map((suggestion) => (
                      <div key={suggestion.id} className="bg-white rounded-xl p-4 shadow-md border border-gray-100 hover:shadow-lg transition-all duration-200 hover:scale-[1.02] group">
                        <div className="flex items-center space-x-4">
                          {suggestion.coverImage ? (
                            <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 shadow-md">
                              <img
                                src={suggestion.coverImage}
                                alt={suggestion.name}
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  e.target.nextSibling.style.display = 'flex';
                                }}
                              />
                              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-pharaoh-gold/20 to-nile-blue/20 flex items-center justify-center" style={{display: 'none'}}>
                                <SparklesIcon className="h-8 w-8 text-pharaoh-gold" />
                              </div>
                            </div>
                          ) : (
                            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-pharaoh-gold/20 to-nile-blue/20 flex items-center justify-center flex-shrink-0 shadow-md">
                              <SparklesIcon className="h-8 w-8 text-pharaoh-gold" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-gray-900 text-sm mb-1 truncate">{suggestion.name}</h4>
                            <p className="text-xs text-gray-600 line-clamp-2 mb-2">{suggestion.shortDescription}</p>
                            <div className="flex items-center flex-wrap gap-2">
                              <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                                suggestion.priority === 'high' ? 'bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 border border-green-200' :
                                suggestion.priority === 'medium' ? 'bg-gradient-to-r from-yellow-100 to-amber-100 text-yellow-800 border border-yellow-200' :
                                'bg-gradient-to-r from-gray-100 to-slate-100 text-gray-800 border border-gray-200'
                              }`}>
                                {suggestion.priority} priority
                              </span>
                              {suggestion.mongoData && suggestion.mongoData.similarity_score && (
                                <span className="text-xs bg-gradient-to-r from-pharaoh-gold/10 to-yellow-100 text-pharaoh-gold px-3 py-1 rounded-full font-medium border border-pharaoh-gold/20">
                                  AI Match: {(suggestion.mongoData.similarity_score * 100).toFixed(0)}%
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {tripPlan && (
                    <div className="mt-6 p-4 bg-gradient-to-r from-white to-gray-50 rounded-xl border border-pharaoh-gold/30 shadow-md">
                      <h4 className="font-bold text-pharaoh-gold mb-3 flex items-center">
                        <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                        </svg>
                        Trip Summary
                      </h4>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                          <div className="text-2xl mb-1">💰</div>
                          <div className="font-bold text-gray-900">{tripPlan.trip_summary.total_trip_cost_egp.toFixed(0)} EGP</div>
                          <div className="text-xs text-gray-500">Total Cost</div>
                        </div>
                        <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                          <div className="text-2xl mb-1">💵</div>
                          <div className="font-bold text-gray-900">{tripPlan.trip_summary.remaining_budget_egp.toFixed(0)} EGP</div>
                          <div className="text-xs text-gray-500">Remaining</div>
                        </div>
                        <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                          <div className="text-2xl mb-1">📅</div>
                          <div className="font-bold text-gray-900">{tripPlan.user_preferences.duration_days}</div>
                          <div className="text-xs text-gray-500">Days</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Most Popular Sites Box */}
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold bg-gradient-to-r from-nile-blue to-pharaoh-gold bg-clip-text text-transparent flex items-center">
                    <SparklesIcon className="h-6 w-6 text-pharaoh-gold mr-2" />
                    Most Popular Sites
                  </h2>
                  <div className="bg-gradient-to-r from-nile-blue to-pharaoh-gold text-white text-xs px-3 py-1 rounded-full font-medium">
                    6 sites
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-6 flex items-center">
                  <svg className="w-4 h-4 mr-2 text-pharaoh-gold" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                  Click on any destination to view its detailed profile
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Link
                    to="/destinations/1"
                    className="group bg-gradient-to-r from-white to-gray-50 border border-gray-200 rounded-xl p-4 shadow-md hover:shadow-lg transition-all duration-200 hover:scale-[1.02] hover:border-pharaoh-gold/30"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 shadow-md group-hover:scale-110 transition-transform">
                        <img
                          src={pyramidsGizaPhoto}
                          alt="Pyramids of Giza"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-gray-900 text-sm mb-1 truncate group-hover:text-nile-blue transition-colors">Pyramids of Giza</h4>
                        <p className="text-xs text-gray-500 mb-1">Giza</p>
                        <div className="flex items-center text-xs text-pharaoh-gold">
                          <span className="mr-1">⭐</span>
                          4.9 Rating
                        </div>
                      </div>
                    </div>
                  </Link>

                  <Link
                    to="/destinations/5"
                    className="group bg-gradient-to-r from-white to-gray-50 border border-gray-200 rounded-xl p-4 shadow-md hover:shadow-lg transition-all duration-200 hover:scale-[1.02] hover:border-pharaoh-gold/30"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 shadow-md group-hover:scale-110 transition-transform">
                        <img
                          src={karnakTemplePhoto}
                          alt="Karnak Temple"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-gray-900 text-sm mb-1 truncate group-hover:text-nile-blue transition-colors">Karnak Temple</h4>
                        <p className="text-xs text-gray-500 mb-1">Luxor</p>
                        <div className="flex items-center text-xs text-pharaoh-gold">
                          <span className="mr-1">⭐</span>
                          4.8 Rating
                        </div>
                      </div>
                    </div>
                  </Link>

                  <Link
                    to="/destinations/6"
                    className="group bg-gradient-to-r from-white to-gray-50 border border-gray-200 rounded-xl p-4 shadow-md hover:shadow-lg transition-all duration-200 hover:scale-[1.02] hover:border-pharaoh-gold/30"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 shadow-md group-hover:scale-110 transition-transform">
                        <img
                          src={valleyKingsPhoto}
                          alt="Valley of the Kings"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-gray-900 text-sm mb-1 truncate group-hover:text-nile-blue transition-colors">Valley of the Kings</h4>
                        <p className="text-xs text-gray-500 mb-1">Luxor</p>
                        <div className="flex items-center text-xs text-pharaoh-gold">
                          <span className="mr-1">⭐</span>
                          4.9 Rating
                        </div>
                      </div>
                    </div>
                  </Link>

                  <Link
                    to="/destinations/9"
                    className="group bg-gradient-to-r from-white to-gray-50 border border-gray-200 rounded-xl p-4 shadow-md hover:shadow-lg transition-all duration-200 hover:scale-[1.02] hover:border-pharaoh-gold/30"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 shadow-md group-hover:scale-110 transition-transform">
                        <img
                          src={abuSimbelPhoto}
                          alt="Abu Simbel"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-gray-900 text-sm mb-1 truncate group-hover:text-nile-blue transition-colors">Abu Simbel</h4>
                        <p className="text-xs text-gray-500 mb-1">Aswan</p>
                        <div className="flex items-center text-xs text-pharaoh-gold">
                          <span className="mr-1">⭐</span>
                          4.9 Rating
                        </div>
                      </div>
                    </div>
                  </Link>

                  <Link
                    to="/destinations/54"
                    className="group bg-gradient-to-r from-white to-gray-50 border border-gray-200 rounded-xl p-4 shadow-md hover:shadow-lg transition-all duration-200 hover:scale-[1.02] hover:border-pharaoh-gold/30"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 shadow-md group-hover:scale-110 transition-transform">
                        <img
                          src={GrandEgyptianMuseumImage}
                          alt="Grand Egyptian Museum"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-gray-900 text-sm mb-1 truncate group-hover:text-nile-blue transition-colors">Grand Egyptian Museum</h4>
                        <p className="text-xs text-gray-500 mb-1">Giza</p>
                        <div className="flex items-center text-xs text-pharaoh-gold">
                          <span className="mr-1">⭐</span>
                          4.9 Rating
                        </div>
                      </div>
                    </div>
                  </Link>

                  <Link
                    to="/destinations/64"
                    className="group bg-gradient-to-r from-white to-gray-50 border border-gray-200 rounded-xl p-4 shadow-md hover:shadow-lg transition-all duration-200 hover:scale-[1.02] hover:border-pharaoh-gold/30"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 shadow-md group-hover:scale-110 transition-transform">
                        <img
                          src={MountSinaiImage}
                          alt="Mount Sinai"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-gray-900 text-sm mb-1 truncate group-hover:text-nile-blue transition-colors">Mount Sinai</h4>
                        <p className="text-xs text-gray-500 mb-1">Sinai</p>
                        <div className="flex items-center text-xs text-pharaoh-gold">
                          <span className="mr-1">⭐</span>
                          4.9 Rating
                        </div>
                      </div>
                    </div>
                  </Link>
                </div>
              </div>
          </div>

            {/* Enhanced Right column - Itinerary builder */}
            <div className="lg:w-3/5">
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-nile-blue/10 via-pharaoh-gold/10 to-nile-blue/10 p-6 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-nile-blue to-pharaoh-gold rounded-full flex items-center justify-center">
                        <MapIcon className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold bg-gradient-to-r from-nile-blue to-pharaoh-gold bg-clip-text text-transparent">
                          Your Egyptian Adventure
                        </h2>
                        <p className="text-sm text-gray-600">
                          Plan each day of your journey • Drag destinations to build your itinerary
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <div className="bg-gradient-to-r from-nile-blue to-pharaoh-gold text-white text-xs px-3 py-1 rounded-full font-medium">
                        {numDays} days
                      </div>
                      {/* Map Toggle for Desktop */}
                      {hasPlannedDestinations && (
                        <button
                          onClick={() => setShowMap(!showMap)}
                          className={`hidden md:flex items-center space-x-2 px-3 py-2 rounded-lg font-medium transition-all duration-200 ${
                            showMap
                              ? 'bg-pharaoh-gold text-white hover:bg-yellow-600'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          <GlobeAltIcon className="w-4 h-4" />
                          <span className="text-xs">{showMap ? 'Hide' : 'Map'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Day Tabs */}
                <div className="border-b border-gray-200 bg-gray-50 relative">
                  {/* Scroll indicators */}
                  {numDays > 7 && (
                    <div className="absolute right-2 top-1/2 transform -translate-y-1/2 z-10 bg-gray-50/90 px-2 py-1 rounded-full text-xs text-gray-500 font-medium">
                      {numDays} days • Scroll →
                    </div>
                  )}
                  <div className={`flex overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-track-gray-100 scrollbar-thumb-gray-300 hover:scrollbar-thumb-gray-400 pb-1 day-tabs-container ${numDays > 7 ? 'pr-24' : ''}`}>
                    {getAvailableDays().map((day) => (
                      <button
                        key={day.id}
                        onClick={() => handleDayChange(day.id)}
                        className={`flex-shrink-0 px-6 py-4 text-sm font-medium border-b-2 transition-all duration-200 whitespace-nowrap ${
                          activeDay === day.id
                            ? 'border-pharaoh-gold text-pharaoh-gold bg-white'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <span>Day {day.number}</span>
                          {day.hasActivities && (
                            <span className={`inline-flex items-center justify-center w-5 h-5 text-xs rounded-full ${
                              activeDay === day.id
                                ? 'bg-pharaoh-gold text-white'
                                : 'bg-gray-400 text-white'
                            }`}>
                              {day.activityCount}
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Active Day Content */}
                <div className="p-6">
                  {(() => {
                    const dayNum = parseInt(activeDay.split('-')[1]);
                    const dayDate = format(
                      addDays(new Date(dates.startDate), dayNum - 1),
                      'EEEE, MMMM d, yyyy'
                    );

                    return (
                      <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-md">
                        <div className="bg-gradient-to-r from-nile-blue/10 via-pharaoh-gold/10 to-nile-blue/10 p-5 border-b border-gray-100">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="font-bold text-nile-blue text-lg">Day {dayNum}</h3>
                              <p className="text-sm text-gray-600">{dayDate}</p>
                            </div>
                            <div className="flex items-center space-x-2">
                              <div className="bg-white/80 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-medium text-gray-600">
                                {days[activeDay]?.length || 0} activities
                              </div>
                              <div className="w-8 h-8 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center">
                                <span className="text-sm font-bold text-nile-blue">{dayNum}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Check if this day has a comprehensive plan */}
                        {(() => {
                          const comprehensivePlan = days[activeDay]?.find(activity => activity.isComprehensivePlan);

                          if (comprehensivePlan) {
                            // Display comprehensive plan
                            return (
                              <div className="p-6">
                                <div className="bg-gradient-to-br from-purple-50 via-white to-blue-50 rounded-2xl border border-purple-200 shadow-lg">
                                  {/* Header */}
                                  <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-6 rounded-t-2xl">
                                    <div className="flex items-center space-x-3">
                                      <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                                        <span className="text-2xl">📋</span>
                                      </div>
                                      <div>
                                        <h3 className="text-xl font-bold">Complete Day Plan</h3>
                                        <p className="text-purple-100 text-sm">AI-Generated Comprehensive Itinerary</p>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Content */}
                                  <div className="p-6">
                                    <div className="prose prose-sm max-w-none">
                                      <div
                                        className="comprehensive-plan-content text-gray-800 leading-relaxed space-y-4"
                                        dangerouslySetInnerHTML={{
                                          __html: formatComprehensivePlan(comprehensivePlan.description)
                                        }}
                                      />
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="mt-6">
                                      <button
                                        onClick={() => handleRegeneratePlan(activeDay)}
                                        className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-sm font-medium"
                                      >
                                        Regenerate Plan
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          } else {
                            // Display regular droppable area for individual activities
                            return (
                              <Droppable droppableId={activeDay}>
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.droppableProps}
                                    className={`p-5 min-h-[120px] transition-all duration-200 ${
                                      snapshot.isDraggingOver
                                        ? 'bg-gradient-to-br from-pharaoh-gold/5 via-yellow-50 to-nile-blue/5 border-2 border-dashed border-pharaoh-gold/30'
                                        : 'bg-gray-50/30'
                                    }`}
                                    data-day-id={activeDay}
                                  >
                              {days[activeDay]?.length > 0 ? (
                                days[activeDay].map((activity, index) => (
                                  <Draggable
                                    key={activity.id || `activity-${activeDay}-${index}`}
                                    draggableId={activity.id || `activity-${activeDay}-${index}`}
                                    index={index}
                                  >
                                    {(provided, snapshot) => (
                                      <div
                                        ref={provided.innerRef}
                                        {...provided.draggableProps}
                                        {...provided.dragHandleProps}
                                        className={`bg-white border border-gray-200 rounded-xl p-4 shadow-md hover:shadow-lg transition-all duration-200 cursor-grab mb-4 group ${
                                          snapshot.isDragging ? 'opacity-50 rotate-1 scale-105 shadow-2xl' : 'hover:scale-[1.02]'
                                        } ${activity.aiSuggested ? 'border-pharaoh-gold/30 bg-gradient-to-r from-white to-pharaoh-gold/5' : ''}`}
                                        style={{
                                          ...provided.draggableProps.style
                                        }}
                                      >
                                        <div className="flex justify-between items-start">
                                          <div className="flex items-start space-x-4 flex-1">
                                            {activity.coverImage ? (
                                              <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 shadow-md">
                                                <img
                                                  src={activity.coverImage}
                                                  alt={activity.title}
                                                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200"
                                                />
                                              </div>
                                            ) : (
                                              <div className={`w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md ${
                                                activity.type === 'comprehensive-plan'
                                                  ? 'bg-gradient-to-br from-purple-100 to-purple-200'
                                                  : activity.type === 'restaurant'
                                                  ? 'bg-gradient-to-br from-red-100 to-red-200'
                                                  : 'bg-gradient-to-br from-nile-blue/20 to-pharaoh-gold/20'
                                              }`}>
                                                {activity.type === 'comprehensive-plan' ? (
                                                  <span className="text-2xl">📋</span>
                                                ) : activity.type === 'restaurant' ? (
                                                  <span className="text-2xl">🍽️</span>
                                                ) : (
                                                  <MapIcon className="h-8 w-8 text-nile-blue" />
                                                )}
                                              </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                              <div className="flex items-center space-x-2 mb-1">
                                                <h4 className="font-bold text-gray-900 text-sm truncate">{activity.title}</h4>
                                                {activity.aiSuggested && (
                                                  <span className="bg-gradient-to-r from-pharaoh-gold to-yellow-500 text-white text-xs px-2 py-1 rounded-full font-medium">
                                                    AI
                                                  </span>
                                                )}
                                                {activity.isComprehensivePlan && (
                                                  <span className="bg-gradient-to-r from-purple-500 to-purple-600 text-white text-xs px-2 py-1 rounded-full font-medium">
                                                    Full Day Plan
                                                  </span>
                                                )}
                                              </div>
                                              <div className="flex items-center text-sm text-gray-500 mb-2">
                                                {activity.time && (
                                                  <span className="flex items-center mr-3">
                                                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 24 24">
                                                      <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M16.2,16.2L11,13V7H12.5V12.2L17,14.7L16.2,16.2Z"/>
                                                    </svg>
                                                    {activity.time}
                                                  </span>
                                                )}
                                                <span className="flex items-center">
                                                  <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 24 24">
                                                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                                                  </svg>
                                                  {activity.location}
                                                </span>
                                              </div>
                                              {activity.isComprehensivePlan ? (
                                                <div className="text-sm text-gray-700">
                                                  <div className={`${expandedPlans[activity.id] ? '' : 'line-clamp-3'}`}>
                                                    <div className="whitespace-pre-wrap">{activity.description}</div>
                                                  </div>
                                                  <button
                                                    onClick={() => toggleComprehensivePlan(activity.id)}
                                                    className="text-purple-600 hover:text-purple-800 font-medium text-xs mt-2 flex items-center"
                                                  >
                                                    {expandedPlans[activity.id] ? (
                                                      <>
                                                        <span>Show Less</span>
                                                        <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                                        </svg>
                                                      </>
                                                    ) : (
                                                      <>
                                                        <span>View Full Day Plan</span>
                                                        <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                        </svg>
                                                      </>
                                                    )}
                                                  </button>
                                                </div>
                                              ) : (
                                                <p className="text-sm text-gray-700 line-clamp-2">{activity.description}</p>
                                              )}
                                            </div>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => removeActivity(activeDay, index)}
                                            className="text-gray-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-all duration-200 ml-2"
                                          >
                                            <TrashIcon className="h-5 w-5" />
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </Draggable>
                                ))
                              ) : (
                                <div className={`flex flex-col items-center justify-center h-32 text-gray-400 rounded-xl border-2 border-dashed transition-all duration-200 ${
                                  snapshot.isDraggingOver
                                    ? 'border-pharaoh-gold/50 bg-pharaoh-gold/5 text-pharaoh-gold'
                                    : 'border-gray-300 hover:border-gray-400'
                                }`}>
                                  <svg className="w-8 h-8 mb-2" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                                  </svg>
                                  <p className="font-medium">No activities planned for this day</p>
                                  <p className="text-xs mt-1">Drag destinations here to add them</p>
                                </div>
                              )}
                              {provided.placeholder}
                            </div>
                          )}
                        </Droppable>
                            );
                          }
                        })()}

                        <div className="bg-gray-50 p-4 border-t border-gray-100">
                          <button
                            type="button"
                            onClick={() => addActivity(activeDay)}
                            className="flex items-center text-sm text-nile-blue hover:text-pharaoh-gold font-medium transition-colors duration-200 group"
                          >
                            <PlusIcon className="h-4 w-4 mr-2 group-hover:scale-110 transition-transform duration-200" />
                            Add Custom Activity
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Comprehensive Trip Map - Show when destinations are planned */}
                {hasPlannedDestinations && (
                  <div className="mt-6 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                    {/* Map Header */}
                    <div className="bg-gradient-to-r from-nile-blue/10 via-pharaoh-gold/10 to-nile-blue/10 p-6 border-b border-gray-100">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gradient-to-r from-nile-blue to-pharaoh-gold rounded-full flex items-center justify-center">
                            <GlobeAltIcon className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <h2 className="text-xl font-bold bg-gradient-to-r from-nile-blue to-pharaoh-gold bg-clip-text text-transparent">
                              Complete Trip Journey Map
                            </h2>
                            <p className="text-sm text-gray-600">
                              Visualize your entire {Object.keys(days).length}-day Egypt adventure with city-to-city routing
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => setShowMap(!showMap)}
                          className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                            showMap
                              ? 'bg-pharaoh-gold text-white hover:bg-yellow-600'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {showMap ? 'Hide Map' : 'Show Trip Map'}
                        </button>
                      </div>
                    </div>

                    {/* Map Content */}
                    {showMap && (
                      <div className="p-6">
                        {/* Comprehensive Trip Map */}
                        <div className="mb-6">
                          <MapboxItineraryMap
                            days={days}
                            height="500px"
                            onDestinationClick={handleDestinationClick}
                            showComprehensiveView={true}
                          />
                        </div>

                        {/* Trip Overview Info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Trip Summary */}
                          <div className="bg-gradient-to-r from-pharaoh-gold/5 via-yellow-50 to-pharaoh-gold/5 rounded-xl border border-pharaoh-gold/20 p-4">
                            <div className="flex items-center space-x-3 mb-3">
                              <div className="w-8 h-8 bg-pharaoh-gold rounded-full flex items-center justify-center text-white font-bold text-sm">
                                🗺️
                              </div>
                              <div>
                                <h4 className="font-semibold text-pharaoh-gold">Trip Overview</h4>
                                <p className="text-sm text-gray-600">
                                  {Object.keys(days).length} days • {Object.values(days).reduce((total, dayActivities) => total + (dayActivities?.length || 0), 0)} total activities
                                </p>
                              </div>
                            </div>

                            {/* Cities visited */}
                            <div className="space-y-2">
                              {Object.entries(days).map(([dayId, activities]) => {
                                if (!activities || activities.length === 0) return null;

                                const dayNumber = parseInt(dayId.split('-')[1]);

                                // Determine primary city for this day
                                let primaryCity = 'Cairo';
                                const locations = activities.map(a => a.location?.toLowerCase() || '').join(' ');

                                if (locations.includes('luxor') || locations.includes('karnak') || locations.includes('valley')) {
                                  primaryCity = 'Luxor';
                                } else if (locations.includes('aswan') || locations.includes('abu simbel') || locations.includes('philae')) {
                                  primaryCity = 'Aswan';
                                } else if (locations.includes('alexandria') || locations.includes('library') || locations.includes('qaitbay')) {
                                  primaryCity = 'Alexandria';
                                } else if (locations.includes('pyramid') || locations.includes('sphinx') || locations.includes('giza')) {
                                  primaryCity = 'Giza';
                                } else if (locations.includes('hurghada') || locations.includes('sharm') || locations.includes('dahab')) {
                                  primaryCity = 'Red Sea';
                                }

                                return (
                                  <div key={dayId} className="flex items-center space-x-3 text-sm">
                                    <div className="w-6 h-6 bg-pharaoh-gold rounded-full flex items-center justify-center text-white font-bold text-xs">
                                      {dayNumber}
                                    </div>
                                    <div className="flex-1">
                                      <span className="font-medium text-gray-900">{primaryCity}</span>
                                      <span className="text-gray-500 ml-2">• {activities.length} activities</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Trip Map Legend */}
                          <div className="space-y-4">
                            {/* Map Legend */}
                            <div className="bg-gray-50 rounded-xl p-4">
                              <h4 className="font-semibold text-gray-900 mb-3">Map Legend</h4>
                              <div className="space-y-3">
                                <div className="flex items-center space-x-3">
                                  <div className="w-6 h-6 bg-pharaoh-gold rounded-full flex items-center justify-center text-white font-bold text-xs">
                                    1
                                  </div>
                                  <span className="text-sm text-gray-600">Day numbers show primary city for each day</span>
                                </div>
                                <div className="flex items-center space-x-3">
                                  <div className="w-8 h-1 bg-pharaoh-gold opacity-80" style={{borderStyle: 'dashed', borderWidth: '1px 0'}}></div>
                                  <span className="text-sm text-gray-600">Dashed lines show travel routes between cities</span>
                                </div>
                                <div className="flex items-center space-x-3">
                                  <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center">
                                    <svg className="w-3 h-3 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                                    </svg>
                                  </div>
                                  <span className="text-sm text-gray-600">Click pins to see day details and activities</span>
                                </div>
                              </div>
                            </div>

                            {/* Trip Map Tips */}
                            <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                              <div className="flex items-start space-x-3">
                                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                                  </svg>
                                </div>
                                <div>
                                  <h4 className="font-semibold text-blue-700 mb-2">Trip Map Features</h4>
                                  <ul className="text-sm text-blue-600 space-y-1">
                                    <li>• One pin per day showing the main city</li>
                                    <li>• Connected route lines show travel sequence</li>
                                    <li>• Auto-zoomed to show your complete journey</li>
                                    <li>• Click pins for detailed day information</li>
                                  </ul>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Floating Action Buttons */}
        <div className="fixed bottom-6 right-6 flex flex-col space-y-3 z-50">
          {/* Map Toggle Button - Show when destinations are planned */}
          {hasPlannedDestinations && (
            <button
              onClick={() => setShowMap(!showMap)}
              className={`p-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-110 group ${
                showMap
                  ? 'bg-gradient-to-r from-pharaoh-gold to-yellow-500 text-white'
                  : 'bg-white text-pharaoh-gold border border-pharaoh-gold/20'
              }`}
              title={showMap ? 'Hide Map' : 'Show Map'}
            >
              <GlobeAltIcon className="w-6 h-6 group-hover:scale-110 transition-transform duration-200" />
            </button>
          )}

          {/* Save Itinerary Button */}
          <button className="bg-gradient-to-r from-nile-blue to-pharaoh-gold text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-110 group">
            <svg className="w-6 h-6 group-hover:scale-110 transition-transform duration-200" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/>
            </svg>
          </button>

          {/* Export Button */}
          <button className="bg-white text-nile-blue p-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-110 border border-gray-200 group">
            <svg className="w-6 h-6 group-hover:scale-110 transition-transform duration-200" fill="currentColor" viewBox="0 0 24 24">
              <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
            </svg>
          </button>

          {/* Share Button */}
          <button className="bg-white text-pharaoh-gold p-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-110 border border-gray-200 group">
            <svg className="w-6 h-6 group-hover:scale-110 transition-transform duration-200" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18,16.08C17.24,16.08 16.56,16.38 16.04,16.85L8.91,12.7C8.96,12.47 9,12.24 9,12C9,11.76 8.96,11.53 8.91,11.3L15.96,7.19C16.5,7.69 17.21,8 18,8A3,3 0 0,0 21,5A3,3 0 0,0 18,2A3,3 0 0,0 15,5C15,5.24 15.04,5.47 15.09,5.7L8.04,9.81C7.5,9.31 6.79,9 6,9A3,3 0 0,0 3,12A3,3 0 0,0 6,15C6.79,15 7.5,14.69 8.04,14.19L15.16,18.34C15.11,18.55 15.08,18.77 15.08,19C15.08,20.61 16.39,21.91 18,21.91C19.61,21.91 20.92,20.61 20.92,19A2.92,2.92 0 0,0 18,16.08Z"/>
            </svg>
          </button>
        </div>

        {/* Progress Indicator */}
        {(extractedTripInfo.interests.length > 0 || extractedTripInfo.budget || extractedTripInfo.days) && (
          <div className="fixed top-6 right-6 bg-white rounded-2xl shadow-xl border border-gray-100 p-4 z-40 animate-fade-in">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-pharaoh-gold to-yellow-500 rounded-full flex items-center justify-center">
                <SparklesIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">Trip Planning Progress</p>
                <div className="flex items-center space-x-2 mt-1">
                  <div className="flex space-x-1">
                    {[
                      extractedTripInfo.age,
                      extractedTripInfo.budget,
                      extractedTripInfo.days,
                      extractedTripInfo.interests.length > 0
                    ].map((completed, index) => (
                      <div
                        key={index}
                        className={`w-2 h-2 rounded-full ${
                          completed ? 'bg-green-500' : 'bg-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-gray-500">
                    {[extractedTripInfo.age, extractedTripInfo.budget, extractedTripInfo.days, extractedTripInfo.interests.length > 0].filter(Boolean).length}/4 complete
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DragDropContext>
  );
}

export default BasicChatItinerary;
