/**
 * ATTOM Building Data Lookup - SIMPLIFIED
 * 
 * Purpose: Extract building characteristics only (what ATTOM actually provides)
 * Integration: WILLOW V50 CMA Workbench
 * Version: 3.0.0 - SIMPLIFIED TO WORKING DATA ONLY
 * 
 * @version 3.0.0
 * @date 2025-11-12
 */

const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ 
        error: 'Method Not Allowed',
        message: 'Only GET requests are supported'
      })
    };
  }

  try {
    const params = event.queryStringParameters || {};
    const address = params.address;
    
    if (!address) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Missing Required Parameter',
          message: 'Address parameter is required',
          usage: '?address=123 Main St, City, State ZIP'
        })
      };
    }

    const ATTOM_API_KEY = process.env.ATTOM_API_KEY;

    if (!ATTOM_API_KEY) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'Configuration Error',
          message: 'ATTOM API key not configured'
        })
      };
    }

    console.log('Fetching ATTOM data for:', address);

    // Parse address into address1 and address2
    const { address1, address2 } = parseAddress(address);
    
    if (!address1 || !address2) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Invalid Address Format',
          message: 'Please provide full address with city, state, and ZIP',
          example: '123 Main St, City, State ZIP'
        })
      };
    }

    // Call ATTOM API
    const apiUrl = `https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/detail?address1=${encodeURIComponent(address1)}&address2=${encodeURIComponent(address2)}`;
    
    const response = await fetch(apiUrl, {
      headers: {
        'apikey': ATTOM_API_KEY,
        'Accept': 'application/json'
      },
      timeout: 10000
    });

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({
          error: 'ATTOM API Error',
          message: `API returned status ${response.status}`
        })
      };
    }

    const data = await response.json();

    if (data.status?.code !== 0 || !data.property || data.property.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          error: 'Property Not Found',
          message: data.status?.msg || 'No property data available',
          address: address
        })
      };
    }

    const prop = data.property[0];

    // Extract only building characteristics (what ATTOM actually provides)
    const buildingData = {
      success: true,
      address: address,
      property: {
        // Basic characteristics
        beds: prop.building?.rooms?.beds || null,
        baths: prop.building?.rooms?.bathstotal || null,
        sqft: prop.building?.size?.universalsize || prop.building?.size?.bldgsize || null,
        acres: prop.lot?.lotsize1 || null,
        propertyType: prop.summary?.propertyType || null,
        yearBuilt: prop.summary?.yearbuilt || null,
        condition: prop.building?.construction?.condition || null,
        
        // Parking/Garage
        garage: prop.building?.parking?.prkgSpaces || null,
        
        // Building details
        stories: prop.building?.summary?.levels || null,
        quality: prop.building?.summary?.quality || null,
        
        // Amenities
        pool: prop.lot?.pooltype && prop.lot.pooltype !== 'NO POOL' ? 'Yes' : 'No',
        fireplace: prop.building?.interior?.fplcind === 'Y' ? 'Yes' : 'No',
        
        // Systems
        heating: prop.utilities?.heatingtype || null,
        cooling: prop.utilities?.coolingtype || null,
        
        // Identifiers
        attomId: prop.identifier?.attomId || null
      },
      source: 'ATTOM_DATA_API',
      timestamp: new Date().toISOString()
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(buildingData)
    };

  } catch (error) {
    console.error('ATTOM lookup error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: error.message
      })
    };
  }
};

/**
 * Parse full address into address1 and address2 components
 * ATTOM requires: address1 = street address, address2 = city, state ZIP
 */
function parseAddress(fullAddress) {
  // Try to split on comma
  const parts = fullAddress.split(',').map(p => p.trim());
  
  if (parts.length >= 2) {
    // Street address is before first comma
    const address1 = parts[0];
    
    // City, state ZIP is everything after
    const address2 = parts.slice(1).join(', ');
    
    return { address1, address2 };
  }
  
  // Try to split on last space (assuming format: "123 Main St City State ZIP")
  const words = fullAddress.split(' ');
  if (words.length >= 5) {
    // Last 3 words are likely: City State ZIP
    const address2 = words.slice(-3).join(' ');
    const address1 = words.slice(0, -3).join(' ');
    
    return { address1, address2 };
  }
  
  // Unable to parse
  return { address1: null, address2: null };
}
