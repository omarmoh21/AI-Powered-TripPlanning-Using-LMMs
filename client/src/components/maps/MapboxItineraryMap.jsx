import React, { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';

// Set Mapbox access token
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

const MapboxItineraryMap = ({ days, height = '500px', onDestinationClick, showComprehensiveView = false }) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markersRef = useRef([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mapError, setMapError] = useState(null);

  // Coordinate lookup for Egyptian destinations
  const getCoordinates = (locationName) => {
    console.log(`🔍 getCoordinates called with: "${locationName}"`);
    
    const coordinates = {
      // Cairo and Giza
      'cairo': [31.2357, 30.0444],
      'giza': [31.2081, 29.9792],
      'pyramids': [31.1342, 29.9792],
      'egyptian museum': [31.2357, 30.0444],
      'khan el khalili': [31.2621, 30.0472],
      'citadel': [31.2599, 30.0291],
      'coptic cairo': [31.2296, 30.0056],
      
      // Alexandria
      'alexandria': [29.9187, 31.2001],
      'bibliotheca alexandrina': [29.9062, 31.2081],
      'qaitbay citadel': [29.8856, 31.2144],
      'montaza palace': [29.9158, 31.2859],
      
      // Luxor
      'luxor': [32.6396, 25.6872],
      'karnak temple': [32.6573, 25.7188],
      'valley of the kings': [32.6014, 25.7402],
      'luxor temple': [32.6396, 25.6872],
      'hatshepsut temple': [32.6062, 25.7381],
      
      // Aswan
      'aswan': [32.8998, 24.0889],
      'philae temple': [32.8842, 24.0267],
      'abu simbel': [31.6258, 22.3372],
      'high dam': [32.8770, 24.0048],
      'unfinished obelisk': [32.8998, 24.0889],
      
      // Hurghada
      'hurghada': [33.8116, 27.2574],
      'red sea': [33.8116, 27.2574],
      
      // Sharm El Sheikh
      'sharm el sheikh': [34.2999, 27.9158],
      'sharm': [34.2999, 27.9158],
      
      // Dahab
      'dahab': [34.5197, 28.5069],
      
      // Siwa
      'siwa': [25.5197, 29.2032],
      'siwa oasis': [25.5197, 29.2032]
    };

    if (!locationName) {
      console.log('❌ No location name provided, using Cairo as default');
      return coordinates['cairo'];
    }

    const searchKey = locationName.toLowerCase().trim();
    console.log(`🔎 Searching for: "${searchKey}"`);

    // Try exact match first
    if (coordinates[searchKey]) {
      console.log(`✅ Exact match found: ${coordinates[searchKey]}`);
      return coordinates[searchKey];
    }

    // Try partial match
    for (const [key, coords] of Object.entries(coordinates)) {
      if (key.includes(searchKey) || searchKey.includes(key)) {
        console.log(`✅ Partial match found: ${key} -> ${coords}`);
        return coords;
      }
    }

    console.log('❌ No match found, using Cairo as default');
    return coordinates['cairo'];
  };

  // Clear existing markers
  const clearMarkers = () => {
    console.log('🧹 Clearing existing markers...');
    markersRef.current.forEach(marker => {
      marker.remove();
    });
    markersRef.current = [];
    console.log('✅ All markers cleared');
  };

  // Create markers for all days
  const createMarkers = () => {
    console.log('🎯 createMarkers called');
    
    if (!map.current) {
      console.log('❌ No map instance available');
      return;
    }

    if (!map.current.isStyleLoaded()) {
      console.log('❌ Map style not loaded yet');
      return false;
    }

    console.log('✅ Map style is loaded, proceeding with marker creation');

    // Clear existing markers first
    clearMarkers();

    if (!days || Object.keys(days).length === 0) {
      console.log('❌ No days data available');
      return true;
    }

    console.log(`📊 Processing ${Object.keys(days).length} days`);
    const bounds = new mapboxgl.LngLatBounds();
    let markersCreated = 0;

    Object.entries(days).forEach(([dayKey, dayData], index) => {
      console.log(`📅 Processing ${dayKey}:`, dayData);
      
      let activities = [];
      if (Array.isArray(dayData)) {
        activities = dayData;
      } else if (dayData && dayData.activities) {
        activities = dayData.activities;
      } else if (dayData && typeof dayData === 'object') {
        activities = Object.values(dayData).filter(item => 
          item && typeof item === 'object' && (item.name || item.title)
        );
      }

      console.log(`🎯 Found ${activities.length} activities for ${dayKey}`);

      if (activities.length > 0) {
        const firstActivity = activities[0];
        const locationName = firstActivity.name || firstActivity.title || firstActivity.location || 'Cairo';
        console.log(`📍 Using location: "${locationName}" for ${dayKey}`);
        
        const coordinates = getCoordinates(locationName);
        console.log(`🗺️ Coordinates for ${dayKey}: [${coordinates[0]}, ${coordinates[1]}]`);

        // Create marker element
        const markerElement = document.createElement('div');
        markerElement.innerHTML = `${index + 1}`;
        markerElement.style.cssText = `
          background-color: #FF6B6B;
          color: white;
          border-radius: 50%;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 14px;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          cursor: pointer;
        `;

        // Create marker
        const marker = new mapboxgl.Marker(markerElement)
          .setLngLat(coordinates)
          .addTo(map.current);

        // Create popup
        const popupContent = `
          <div style="padding: 10px; max-width: 200px;">
            <h3 style="margin: 0 0 8px 0; color: #333; font-size: 16px;">Day ${index + 1}</h3>
            <p style="margin: 0; color: #666; font-size: 14px;">${locationName}</p>
            <p style="margin: 4px 0 0 0; color: #888; font-size: 12px;">${activities.length} activities</p>
          </div>
        `;

        const popup = new mapboxgl.Popup({ offset: 25 })
          .setHTML(popupContent);

        marker.setPopup(popup);
        markersRef.current.push(marker);
        bounds.extend(coordinates);
        markersCreated++;

        console.log(`✅ Created marker ${markersCreated} for ${dayKey} at [${coordinates[0]}, ${coordinates[1]}]`);
      }
    });

    console.log(`🎯 Total markers created: ${markersCreated}`);

    // Fit map to show all markers
    if (markersCreated > 0) {
      console.log('🔍 Fitting map bounds to show all markers...');
      map.current.fitBounds(bounds, {
        padding: 50,
        maxZoom: 10
      });
      console.log('✅ Map bounds fitted');
    }

    return true;
  };

  // Wait for map style to load, then create markers
  const waitForStyleAndCreateMarkers = () => {
    console.log('⏳ Waiting for map style to load...');
    
    const checkAndCreate = () => {
      if (!map.current) {
        console.log('❌ Map instance not available');
        return;
      }

      if (map.current.isStyleLoaded()) {
        console.log('✅ Map style loaded, creating markers...');
        const success = createMarkers();
        if (success) {
          setIsLoading(false);
          console.log('🎉 Marker creation completed successfully');
        }
      } else {
        console.log('⏳ Map style not loaded yet, retrying in 100ms...');
        setTimeout(checkAndCreate, 100);
      }
    };

    checkAndCreate();
  };

  // Initialize map
  useEffect(() => {
    console.log('🗺️ Initializing map...');
    
    if (!mapContainer.current) {
      console.log('❌ Map container not available');
      return;
    }

    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [31.2357, 30.0444], // Cairo
        zoom: 6
      });

      map.current.on('load', () => {
        console.log('🗺️ Map loaded successfully');
        waitForStyleAndCreateMarkers();
      });

      map.current.on('error', (e) => {
        console.error('❌ Map error:', e);
        setMapError('Failed to load map');
        setIsLoading(false);
      });

    } catch (error) {
      console.error('❌ Error initializing map:', error);
      setMapError('Failed to initialize map');
      setIsLoading(false);
    }

    return () => {
      if (map.current) {
        console.log('🧹 Cleaning up map...');
        clearMarkers();
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Update markers when days data changes
  useEffect(() => {
    console.log('📊 Days data changed, updating markers...');
    console.log('📊 Days keys:', Object.keys(days || {}));
    console.log('📏 Days length:', Object.keys(days || {}).length);
    
    if (map.current && days) {
      waitForStyleAndCreateMarkers();
    }
  }, [days]);

  if (mapError) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f5f5', border: '1px solid #ddd', borderRadius: '8px' }}>
        <div style={{ textAlign: 'center', color: '#666' }}>
          <p>⚠️ Map Error</p>
          <p style={{ fontSize: '14px' }}>{mapError}</p>
        </div>
      </div>
    );
  }

  const hasData = days && Object.keys(days).length > 0;

  return (
    <div style={{ position: 'relative', height }}>
      {isLoading && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', marginBottom: '10px' }}>🗺️</div>
            <p style={{ margin: 0, color: '#666' }}>Loading map...</p>
          </div>
        </div>
      )}
      
      <div 
        ref={mapContainer} 
        style={{ 
          width: '100%', 
          height: '100%',
          borderRadius: '8px',
          overflow: 'hidden'
        }} 
      />
      
      {!hasData && !isLoading && (
        <div style={{
          position: 'absolute',
          bottom: '20px',
          left: '20px',
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          padding: '10px 15px',
          borderRadius: '6px',
          fontSize: '14px',
          color: '#666',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          📍 Generate a trip plan to see locations on the map
        </div>
      )}
    </div>
  );
};

export default MapboxItineraryMap;
