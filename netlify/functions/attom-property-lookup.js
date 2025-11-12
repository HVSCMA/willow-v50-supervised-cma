/**
 * ATTOM Data Property Lookup - Netlify Function
 * 
 * Purpose: Retrieve property details from ATTOM Data API for CMA auto-fill
 * Integration: WILLOW V50 CMA Workbench
 * Tier: 1 (PRIMARY) - Property detail lookup by address
 * 
 * Architecture:
 * Tier 1: ATTOM Data API (THIS FUNCTION) ← Property detail lookup
 * Tier 2: FUB Custom Fields (CACHE) ← Store results for future use
 * Tier 3: Fello Lead Data ← Address extraction
 * Tier 4: Manual Entry ← Smart defaults fallback
 * 
 * Rate Limits:
 * - 200 requests/minute (ATTOM enforced)
 * - Monthly quota varies by plan (check dashboard)
 * 
 * @version 1.0.0
 * @date 2025-11-12
 */

const fetch = require('node-fetch');

// ATTOM API Configuration
const ATTOM_CONFIG = {
  baseUrl: 'https://api.gateway.attomdata.com',
  endpoints: {
    propertyDetail: '/propertyapi/v1.0.0/property/detail'
  },
  timeout: 10000, // 10 second timeout
  retries: 2
};

// FUB Configuration (for caching)
const FUB_CONFIG = {
  baseUrl: 'https://api.followupboss.com/v1',
  timeout: 5000
};

/**
 * Main handler function
 */
exports.handler = async (event, context) => {
  // CORS headers for browser access
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Only allow GET requests
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
    // Extract parameters
    const params = event.queryStringParameters || {};
    const address = params.address;
    const personId = params.personId; // FUB person ID for caching
    const skipCache = params.skipCache === 'true'; // Force fresh lookup
    
    // Validate required parameters
    if (!address) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Missing Required Parameter',
          message: 'Address parameter is required',
          usage: '?address=123 Main St, City, State ZIP',
          example: '?address=1 Civic Center Plaza, Poughkeepsie, NY 12601'
        })
      };
    }

    // Check environment variables
    const ATTOM_API_KEY = process.env.ATTOM_API_KEY;
    const FUB_API_KEY = process.env.FUB_API_KEY;

    if (!ATTOM_API_KEY) {
      console.error('ATTOM_API_KEY not configured in environment');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'Configuration Error',
          message: 'ATTOM API key not configured. Contact system administrator.'
        })
      };
    }

    // Log request for monitoring
    console.log('ATTOM Property Lookup Request:', {
      address,
      personId: personId || 'none',
      skipCache,
      timestamp: new Date().toISOString()
    });

    // STEP 1: Check FUB cache first (if personId provided and cache not skipped)
    if (personId && !skipCache && FUB_API_KEY) {
      try {
        const cachedData = await getFUBCachedPropertyData(personId, FUB_API_KEY);
        if (cachedData && cachedData.isComplete) {
          console.log('Cache HIT: Using FUB cached property data for person', personId);
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              source: 'FUB_CACHE',
              cached: true,
              data: cachedData.propertyData,
              message: 'Property data retrieved from cache'
            })
          };
        }
      } catch (cacheError) {
        // Cache read failed, continue to ATTOM API
        console.warn('FUB cache read failed, falling back to ATTOM API:', cacheError.message);
      }
    }

    // STEP 2: Call ATTOM Data API
    const attomData = await callAttomAPI(address, ATTOM_API_KEY);

    // STEP 3: Parse and format response
    const propertyData = parseAttomResponse(attomData);

    // STEP 4: Cache result to FUB (if personId provided and data complete)
    if (personId && FUB_API_KEY && propertyData) {
      try {
        await cachePropertyDataToFUB(personId, propertyData, FUB_API_KEY);
        console.log('Cache WRITE: Stored property data to FUB for person', personId);
      } catch (cacheError) {
        // Cache write failed, but still return the data
        console.warn('FUB cache write failed:', cacheError.message);
      }
    }

    // STEP 5: Return successful response
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        source: 'ATTOM_API',
        cached: false,
        data: propertyData,
        message: 'Property data retrieved from ATTOM Data API'
      })
    };

  } catch (error) {
    console.error('ATTOM Property Lookup Error:', error);

    // Determine appropriate error response
    if (error.statusCode === 404 || error.message.includes('SuccessWithoutResult')) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Property Not Found',
          message: 'Property not found in ATTOM database. Try manual entry or check address spelling.',
          address: event.queryStringParameters?.address,
          suggestion: 'Ensure address includes city, state, and ZIP code'
        })
      };
    }

    if (error.statusCode === 429) {
      return {
        statusCode: 429,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Rate Limit Exceeded',
          message: 'ATTOM API rate limit reached (200 requests/minute). Please try again in a moment.',
          retryAfter: 60
        })
      };
    }

    if (error.statusCode === 401) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Authentication Error',
          message: 'ATTOM API authentication failed. Contact system administrator.'
        })
      };
    }

    // Generic error
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'API Request Failed',
        message: error.message || 'Failed to retrieve property data',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      })
    };
  }
};

/**
 * Call ATTOM Data API with retries
 */
async function callAttomAPI(address, apiKey, retries = 2) {
  const url = `${ATTOM_CONFIG.baseUrl}${ATTOM_CONFIG.endpoints.propertyDetail}`;
  const params = new URLSearchParams({ address });

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      console.log(`ATTOM API Request (attempt ${attempt + 1}/${retries + 1}):`, address);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), ATTOM_CONFIG.timeout);

      const response = await fetch(`${url}?${params}`, {
        method: 'GET',
        headers: {
          'apikey': apiKey,
          'accept': 'application/json'
        },
        signal: controller.signal
      });

      clearTimeout(timeout);

      const data = await response.json();

      // Check for successful response
      if (response.ok && data.status && data.status.code === 0) {
        console.log('ATTOM API Success:', {
          total: data.status.total,
          msg: data.status.msg
        });
        return data;
      }

      // Check for "no results" response (not an error, but no property found)
      if (data.status && data.status.msg === 'SuccessWithoutResult') {
        const error = new Error('Property not found in ATTOM database');
        error.statusCode = 404;
        throw error;
      }

      // Handle rate limiting
      if (response.status === 429) {
        const error = new Error('Rate limit exceeded');
        error.statusCode = 429;
        throw error;
      }

      // Handle authentication errors
      if (response.status === 401) {
        const error = new Error('Invalid API key');
        error.statusCode = 401;
        throw error;
      }

      // Other HTTP errors
      throw new Error(`ATTOM API returned status ${response.status}: ${data.status?.msg || 'Unknown error'}`);

    } catch (error) {
      // Last attempt failed
      if (attempt === retries) {
        throw error;
      }

      // Retry after delay (exponential backoff)
      const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
      console.warn(`ATTOM API attempt ${attempt + 1} failed, retrying in ${delay}ms:`, error.message);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Parse ATTOM API response into CMA-friendly format
 */
function parseAttomResponse(attomData) {
  if (!attomData || !attomData.property || attomData.property.length === 0) {
    return null;
  }

  const prop = attomData.property[0];

  return {
    // Address information
    address: {
      full: prop.address?.oneLine || null,
      line1: prop.address?.line1 || null,
      line2: prop.address?.line2 || null,
      city: prop.address?.locality || null,
      state: prop.address?.countrySubd || null,
      zip: prop.address?.postal1 || null,
      zipPlus4: prop.address?.postal2 || null
    },

    // CMA Workbench Required Fields (9 property characteristics)
    beds: prop.building?.rooms?.beds || null,
    baths: prop.building?.rooms?.bathstotal || null,
    sqft: prop.building?.size?.universalsize || null,
    acres: prop.lot?.lotsize1 || null,
    garage: prop.building?.parking?.prkgSpaces || null,
    propertyType: prop.summary?.proptype || null,
    yearBuilt: prop.summary?.yearbuilt || null,
    condition: prop.building?.construction?.condition || null,

    // Bonus data for validation and market context
    location: {
      latitude: prop.location?.latitude || null,
      longitude: prop.location?.longitude || null,
      accuracy: prop.location?.accuracy || null
    },

    // Assessment data for validation
    assessment: {
      totalValue: prop.assessment?.assessed?.assdttlvalue || null,
      landValue: prop.assessment?.assessed?.assdlandvalue || null,
      improvementValue: prop.assessment?.assessed?.assdimprvalue || null,
      taxYear: prop.assessment?.tax?.taxyear || null,
      taxAmount: prop.assessment?.tax?.taxamt || null
    },

    // AVM (Automated Valuation Model) for pricing guidance
    avm: prop.avm ? {
      value: prop.avm.amount?.value || null,
      valueLow: prop.avm.amount?.low || null,
      valueHigh: prop.avm.amount?.high || null,
      confidence: prop.avm.amount?.scr || null,
      date: prop.avm.eventDate || null
    } : null,

    // Sales history for market context
    saleHistory: prop.sale ? {
      lastSaleDate: prop.sale.saleTransDate || null,
      lastSalePrice: prop.sale.amount?.saleamt || null,
      pricePerSqft: prop.sale.calculation?.pricepersizeunit || null
    } : null,

    // Metadata
    attomId: prop.identifier?.attomId || null,
    fips: prop.identifier?.fips || null,
    apn: prop.identifier?.apn || null,
    dataSource: 'ATTOM_DATA_API',
    retrievedAt: new Date().toISOString()
  };
}

/**
 * Get cached property data from FUB custom fields
 */
async function getFUBCachedPropertyData(personId, apiKey) {
  const url = `${FUB_CONFIG.baseUrl}/people/${personId}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${Buffer.from(apiKey + ':').toString('base64')}`,
      'Content-Type': 'application/json'
    },
    timeout: FUB_CONFIG.timeout
  });

  if (!response.ok) {
    throw new Error(`FUB API returned status ${response.status}`);
  }

  const person = await response.json();

  // Extract WILLOW property custom fields
  const propertyData = {
    beds: person.customWILLOW_property_beds || null,
    baths: person.customWILLOW_property_baths || null,
    sqft: person.customWILLOW_property_sqft || null,
    acres: person.customWILLOW_property_acres || null,
    garage: person.customWILLOW_property_garage || null,
    propertyType: person.customWILLOW_property_type || null,
    yearBuilt: person.customWILLOW_property_year_built || null,
    condition: person.customWILLOW_property_condition || null,
    cachedAt: person.customWILLOW_property_cached_at || null
  };

  // Check if data is complete (at least beds, baths, sqft present)
  const isComplete = !!(propertyData.beds && propertyData.baths && propertyData.sqft);

  // Check if data is fresh (less than 1 year old)
  let isFresh = false;
  if (propertyData.cachedAt) {
    const cacheAge = Date.now() - new Date(propertyData.cachedAt).getTime();
    const oneYear = 365 * 24 * 60 * 60 * 1000;
    isFresh = cacheAge < oneYear;
  }

  return {
    propertyData,
    isComplete,
    isFresh,
    source: 'FUB_CACHE'
  };
}

/**
 * Cache property data to FUB custom fields
 */
async function cachePropertyDataToFUB(personId, propertyData, apiKey) {
  const url = `${FUB_CONFIG.baseUrl}/people/${personId}`;

  const updatePayload = {
    customWILLOW_property_beds: propertyData.beds,
    customWILLOW_property_baths: propertyData.baths,
    customWILLOW_property_sqft: propertyData.sqft,
    customWILLOW_property_acres: propertyData.acres,
    customWILLOW_property_garage: propertyData.garage,
    customWILLOW_property_type: propertyData.propertyType,
    customWILLOW_property_year_built: propertyData.yearBuilt,
    customWILLOW_property_condition: propertyData.condition,
    customWILLOW_property_cached_at: new Date().toISOString(),
    customWILLOW_property_source: 'ATTOM_DATA_API'
  };

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Basic ${Buffer.from(apiKey + ':').toString('base64')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updatePayload),
    timeout: FUB_CONFIG.timeout
  });

  if (!response.ok) {
    throw new Error(`FUB cache write failed: ${response.status}`);
  }

  return await response.json();
}
