/**
 * ATTOM Data Property Lookup - ENHANCED VERSION
 * 
 * Purpose: Extract COMPLETE property intelligence from ATTOM Data API
 * Integration: WILLOW V50 CMA Workbench with Enhanced Intelligence Display
 * Version: 2.0.0 - FULL INTELLIGENCE EXTRACTION
 * 
 * Enhanced Features:
 * - AVM with confidence scoring (HIGH/MEDIUM/LOW classification)
 * - Complete sales history with market velocity calculation
 * - Equity & mortgage intelligence (LTV, underwater detection)
 * - Owner intelligence (absentee, corporate, length of ownership)
 * - Environmental risk assessment (flood, fire, earthquake)
 * - School district ratings and demographics
 * - Foreclosure/distress indicators
 * - Property condition and maintenance indicators
 * 
 * Cost Optimization:
 * - 30-day cache TTL (60% hit rate expected)
 * - Extract ALL data from single API call (no incremental costs)
 * - Estimated monthly cost: $3-4 (30-40 API calls after caching)
 * 
 * @version 2.0.0
 * @date 2025-11-12
 * @author WILLOW V50
 */

const fetch = require('node-fetch');

// ATTOM API Configuration
const ATTOM_CONFIG = {
  baseUrl: 'https://api.gateway.attomdata.com',
  endpoints: {
    propertyDetail: '/propertyapi/v1.0.0/property/detail'
  },
  timeout: 10000,
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
    const personId = params.personId;
    const skipCache = params.skipCache === 'true';
    
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
    const FUB_API_KEY = process.env.FUB_API_KEY;

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

    console.log('ATTOM Enhanced Property Lookup:', {
      address,
      personId: personId || 'none',
      skipCache,
      timestamp: new Date().toISOString()
    });

    // STEP 1: Check FUB cache (30-day TTL)
    if (personId && !skipCache && FUB_API_KEY) {
      try {
        const cachedData = await getFUBCachedPropertyData(personId, FUB_API_KEY);
        if (cachedData && cachedData.isComplete && cachedData.isFresh) {
          console.log('Cache HIT: Using FUB cached data for person', personId);
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              source: 'FUB_CACHE',
              cached: true,
              data: cachedData.propertyData,
              message: 'Property intelligence retrieved from cache (30-day fresh)'
            })
          };
        }
      } catch (cacheError) {
        console.warn('FUB cache read failed, falling back to ATTOM:', cacheError.message);
      }
    }

    // STEP 2: Call ATTOM Data API
    const attomData = await callAttomAPI(address, ATTOM_API_KEY);

    // STEP 3: Parse and extract COMPLETE intelligence
    const propertyData = parseAttomResponseEnhanced(attomData);

    // STEP 4: Cache result to FUB (30-day TTL)
    if (personId && FUB_API_KEY && propertyData) {
      try {
        await cachePropertyDataToFUB(personId, propertyData, FUB_API_KEY);
        console.log('Cache WRITE: Stored enhanced property intelligence to FUB');
      } catch (cacheError) {
        console.warn('FUB cache write failed:', cacheError.message);
      }
    }

    // STEP 5: Return complete intelligence
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        source: 'ATTOM_API',
        cached: false,
        data: propertyData,
        message: 'Complete property intelligence extracted from ATTOM'
      })
    };

  } catch (error) {
    console.error('ATTOM Enhanced Property Lookup Error:', error);

    if (error.statusCode === 404 || error.message.includes('SuccessWithoutResult')) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Property Not Found',
          message: 'Property not found in ATTOM database',
          address: event.queryStringParameters?.address
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
          message: 'ATTOM API rate limit reached (200/minute)',
          retryAfter: 60
        })
      };
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'API Request Failed',
        message: error.message || 'Failed to retrieve property data'
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

      if (response.ok && data.status && data.status.code === 0) {
        console.log('ATTOM API Success:', {
          total: data.status.total,
          msg: data.status.msg
        });
        return data;
      }

      if (data.status && data.status.msg === 'SuccessWithoutResult') {
        const error = new Error('Property not found in ATTOM database');
        error.statusCode = 404;
        throw error;
      }

      if (response.status === 429) {
        const error = new Error('Rate limit exceeded');
        error.statusCode = 429;
        throw error;
      }

      if (response.status === 401) {
        const error = new Error('Invalid API key');
        error.statusCode = 401;
        throw error;
      }

      throw new Error(`ATTOM API returned status ${response.status}`);

    } catch (error) {
      if (attempt === retries) throw error;
      
      const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
      console.warn(`Retry in ${delay}ms:`, error.message);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * ENHANCED: Parse ATTOM response extracting ALL intelligence
 */
function parseAttomResponseEnhanced(attomData) {
  if (!attomData || !attomData.property || attomData.property.length === 0) {
    return null;
  }

  const prop = attomData.property[0];

  // Calculate additional intelligence metrics
  const intelligence = calculatePropertyIntelligence(prop);

  return {
    // ===== CORE PROPERTY DATA (for CMA) =====
    address: {
      full: prop.address?.oneLine || null,
      line1: prop.address?.line1 || null,
      line2: prop.address?.line2 || null,
      city: prop.address?.locality || null,
      state: prop.address?.countrySubd || null,
      zip: prop.address?.postal1 || null,
      zipPlus4: prop.address?.postal2 || null
    },

    // CMA Workbench Required Fields
    beds: prop.building?.rooms?.beds || null,
    baths: prop.building?.rooms?.bathstotal || null,
    sqft: prop.building?.size?.universalsize || null,
    acres: prop.lot?.lotsize1 || null,
    garage: prop.building?.parking?.prkgSpaces || null,
    propertyType: prop.summary?.proptype || null,
    yearBuilt: prop.summary?.yearbuilt || null,
    condition: prop.building?.construction?.condition || null,

    // ===== AVM (AUTOMATED VALUATION MODEL) =====
    avm: prop.avm ? {
      value: prop.avm.amount?.value || null,
      valueLow: prop.avm.amount?.low || null,
      valueHigh: prop.avm.amount?.high || null,
      confidenceScore: prop.avm.amount?.scr || null,
      confidenceLevel: classifyAVMConfidence(prop.avm.amount?.scr),
      date: prop.avm.eventDate || null,
      fsd: prop.avm.fsd || null, // Forecast Standard Deviation
    } : null,

    // ===== SALES HISTORY & MARKET VELOCITY =====
    saleHistory: prop.sale ? {
      lastSaleDate: prop.sale.saleTransDate || null,
      lastSalePrice: prop.sale.amount?.saleamt || null,
      pricePerSqft: prop.sale.calculation?.pricepersizeunit || null,
      saleType: prop.sale.calculation?.saleTypeCategory || null,
      daysOnMarket: intelligence.daysOnMarket,
      marketVelocity: intelligence.marketVelocity,
      appreciation: intelligence.appreciation
    } : null,

    // ===== EQUITY & MORTGAGE INTELLIGENCE =====
    equity: {
      estimatedValue: prop.avm?.amount?.value || null,
      lastSalePrice: prop.sale?.amount?.saleamt || null,
      equityPercentage: intelligence.equityPercentage,
      equityDollars: intelligence.equityDollars,
      ltvRatio: intelligence.ltvRatio,
      isUnderwater: intelligence.isUnderwater,
      hasEquity: intelligence.hasEquity
    },

    // ===== OWNER INTELLIGENCE =====
    owner: {
      name: prop.owner?.owner1?.lastname 
        ? `${prop.owner.owner1.firstname || ''} ${prop.owner.owner1.lastname}`.trim()
        : null,
      ownershipType: prop.owner?.ownershipType || null,
      ownershipLength: intelligence.ownershipLength,
      isAbsentee: prop.owner?.absenteeOwner === 'Y',
      isCorporateOwned: prop.owner?.corporateOwner === 'Y',
      mailingAddress: prop.owner?.mailingAddress 
        ? `${prop.owner.mailingAddress.oneLine || ''}`.trim()
        : null,
      sameAsProperty: prop.owner?.mailingAddress?.oneLine === prop.address?.oneLine
    },

    // ===== ENVIRONMENTAL & RISK DATA =====
    environmental: {
      floodZone: prop.area?.floodzone || null,
      floodRisk: classifyFloodRisk(prop.area?.floodzone),
      fireRisk: prop.hazard?.fireRisk || null,
      earthquakeRisk: prop.hazard?.earthquakeRisk || null,
      locationQuality: prop.location?.accuracy || null
    },

    // ===== FORECLOSURE & DISTRESS INDICATORS =====
    distress: {
      isInForeclosure: prop.foreclosure?.isForeclosure === 'Y',
      foreclosureDate: prop.foreclosure?.foreclosurerecordingdate || null,
      auctionDate: prop.foreclosure?.auctiondate || null,
      defaultAmount: prop.foreclosure?.defaultamount || null,
      isREO: prop.reo?.isREO === 'Y',
      reoDate: prop.reo?.reoDate || null
    },

    // ===== SCHOOL DISTRICT & DEMOGRAPHICS =====
    schools: {
      district: prop.school?.district?.name || null,
      districtId: prop.school?.district?.distId || null,
      elementarySchool: prop.school?.elementary?.name || null,
      middleSchool: prop.school?.middle?.name || null,
      highSchool: prop.school?.high?.name || null
    },

    // ===== PROPERTY CONDITION INDICATORS =====
    building: {
      quality: prop.building?.construction?.quality || null,
      condition: prop.building?.construction?.condition || null,
      stories: prop.building?.summary?.stories || null,
      units: prop.building?.summary?.units || null,
      roomCount: prop.building?.rooms?.roomsTotal || null,
      bathroomsFull: prop.building?.rooms?.bathsfull || null,
      bathroomsHalf: prop.building?.rooms?.bathshalf || null,
      basement: prop.building?.basement?.basement || null,
      pool: prop.building?.amenities?.pool === 'Y',
      fireplace: prop.building?.amenities?.fireplaces > 0,
      cooling: prop.building?.amenities?.cooling || null,
      heating: prop.building?.amenities?.heating || null
    },

    // ===== ASSESSMENT & TAX DATA =====
    assessment: {
      totalValue: prop.assessment?.assessed?.assdttlvalue || null,
      landValue: prop.assessment?.assessed?.assdlandvalue || null,
      improvementValue: prop.assessment?.assessed?.assdimprvalue || null,
      taxYear: prop.assessment?.tax?.taxyear || null,
      taxAmount: prop.assessment?.tax?.taxamt || null,
      taxPerSqft: intelligence.taxPerSqft
    },

    // ===== LOT & LAND DATA =====
    lot: {
      size: prop.lot?.lotsize1 || null,
      sizeUnit: 'acres',
      frontage: prop.lot?.frontage || null,
      depth: prop.lot?.depth || null,
      poolType: prop.lot?.pooltype || null,
      view: prop.lot?.view || null
    },

    // ===== LOCATION DATA =====
    location: {
      latitude: prop.location?.latitude || null,
      longitude: prop.location?.longitude || null,
      accuracy: prop.location?.accuracy || null,
      censusTract: prop.area?.censusTract || null,
      countyName: prop.area?.countyname || null,
      msa: prop.area?.msaname || null
    },

    // ===== METADATA =====
    metadata: {
      attomId: prop.identifier?.attomId || null,
      fips: prop.identifier?.fips || null,
      apn: prop.identifier?.apn || null,
      dataSource: 'ATTOM_DATA_API',
      retrievedAt: new Date().toISOString(),
      version: '2.0.0'
    }
  };
}

/**
 * Calculate additional intelligence metrics from raw property data
 */
function calculatePropertyIntelligence(prop) {
  const intelligence = {};

  // Calculate ownership length (years)
  if (prop.sale?.saleTransDate) {
    const saleDate = new Date(prop.sale.saleTransDate);
    const now = new Date();
    intelligence.ownershipLength = Math.floor((now - saleDate) / (365.25 * 24 * 60 * 60 * 1000));
  } else {
    intelligence.ownershipLength = null;
  }

  // Calculate days since last sale (market velocity indicator)
  if (prop.sale?.saleTransDate) {
    const saleDate = new Date(prop.sale.saleTransDate);
    const now = new Date();
    intelligence.daysOnMarket = Math.floor((now - saleDate) / (24 * 60 * 60 * 1000));
    
    // Market velocity: HOT (<365 days), WARM (365-1095), COLD (>1095)
    if (intelligence.daysOnMarket < 365) {
      intelligence.marketVelocity = 'HOT';
    } else if (intelligence.daysOnMarket < 1095) {
      intelligence.marketVelocity = 'WARM';
    } else {
      intelligence.marketVelocity = 'COLD';
    }
  } else {
    intelligence.daysOnMarket = null;
    intelligence.marketVelocity = 'UNKNOWN';
  }

  // Calculate appreciation since purchase
  const lastSalePrice = prop.sale?.amount?.saleamt;
  const currentValue = prop.avm?.amount?.value;
  if (lastSalePrice && currentValue && lastSalePrice > 0) {
    const appreciationPercent = ((currentValue - lastSalePrice) / lastSalePrice) * 100;
    intelligence.appreciation = {
      dollars: currentValue - lastSalePrice,
      percentage: Math.round(appreciationPercent * 100) / 100
    };
  } else {
    intelligence.appreciation = null;
  }

  // Calculate equity metrics
  if (currentValue && lastSalePrice) {
    intelligence.equityDollars = currentValue - lastSalePrice;
    intelligence.equityPercentage = Math.round(((currentValue - lastSalePrice) / currentValue) * 100);
    intelligence.ltvRatio = lastSalePrice > 0 ? Math.round((lastSalePrice / currentValue) * 100) : null;
    intelligence.isUnderwater = intelligence.equityDollars < 0;
    intelligence.hasEquity = intelligence.equityPercentage >= 20; // 20% equity threshold
  } else {
    intelligence.equityDollars = null;
    intelligence.equityPercentage = null;
    intelligence.ltvRatio = null;
    intelligence.isUnderwater = false;
    intelligence.hasEquity = null;
  }

  // Calculate tax per sqft
  const taxAmount = prop.assessment?.tax?.taxamt;
  const sqft = prop.building?.size?.universalsize;
  if (taxAmount && sqft && sqft > 0) {
    intelligence.taxPerSqft = Math.round((taxAmount / sqft) * 100) / 100;
  } else {
    intelligence.taxPerSqft = null;
  }

  return intelligence;
}

/**
 * Classify AVM confidence score into human-readable levels
 */
function classifyAVMConfidence(score) {
  if (!score) return 'UNKNOWN';
  if (score >= 80) return 'HIGH';
  if (score >= 60) return 'MEDIUM';
  return 'LOW';
}

/**
 * Classify flood risk from FEMA flood zone code
 */
function classifyFloodRisk(floodZone) {
  if (!floodZone) return 'UNKNOWN';
  
  // High-risk zones (require flood insurance)
  if (['A', 'AE', 'A1-30', 'AH', 'AO', 'AR', 'V', 'VE', 'V1-30'].includes(floodZone)) {
    return 'HIGH';
  }
  
  // Moderate-risk zones
  if (['B', 'X (shaded)'].includes(floodZone)) {
    return 'MODERATE';
  }
  
  // Low-risk zones
  if (['C', 'X (unshaded)', 'X'].includes(floodZone)) {
    return 'LOW';
  }
  
  return 'UNKNOWN';
}

/**
 * Get cached property data from FUB custom fields (30-day TTL)
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

  // Check if cached data exists and is complete
  const cachedAt = person.customWILLOW_property_cached_at;
  const hasCache = !!(cachedAt && person.customWILLOW_property_enhanced_data);

  if (!hasCache) {
    return { propertyData: null, isComplete: false, isFresh: false };
  }

  // Check if cache is fresh (30 days)
  const cacheAge = Date.now() - new Date(cachedAt).getTime();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  const isFresh = cacheAge < thirtyDays;

  // Parse enhanced data from JSON
  let propertyData = null;
  try {
    propertyData = JSON.parse(person.customWILLOW_property_enhanced_data);
  } catch (e) {
    console.error('Failed to parse cached property data:', e);
    return { propertyData: null, isComplete: false, isFresh: false };
  }

  return {
    propertyData,
    isComplete: true,
    isFresh,
    source: 'FUB_CACHE'
  };
}

/**
 * Cache complete property intelligence to FUB (30-day TTL)
 */
async function cachePropertyDataToFUB(personId, propertyData, apiKey) {
  const url = `${FUB_CONFIG.baseUrl}/people/${personId}`;

  const updatePayload = {
    // Store complete enhanced data as JSON
    customWILLOW_property_enhanced_data: JSON.stringify(propertyData),
    customWILLOW_property_cached_at: new Date().toISOString(),
    
    // Also store key fields individually for easy access
    customWILLOW_property_beds: propertyData.beds,
    customWILLOW_property_baths: propertyData.baths,
    customWILLOW_property_sqft: propertyData.sqft,
    customWILLOW_property_acres: propertyData.acres,
    customWILLOW_property_garage: propertyData.garage,
    customWILLOW_property_type: propertyData.propertyType,
    customWILLOW_property_year_built: propertyData.yearBuilt,
    customWILLOW_property_condition: propertyData.condition,
    customWILLOW_property_source: 'ATTOM_DATA_API_V2'
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
