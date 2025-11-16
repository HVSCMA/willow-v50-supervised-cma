/**
 * WILLOW V50 CMA Smart Defaults - Embedded App Version
 * No JWT required - works with FUB embedded app
 * Fetches ATTOM data + FUB data + Calculates Glenn's expertise defaults
 */

const https = require('https');

const FUB_API_KEY = process.env.FUB_API_KEY || 'fka_0oHt62NxmsExO6x69p08ix82zx8ii1hzrj';
const ATTOM_API_KEY = process.env.ATTOM_API_KEY || '83d56a0076ca0aeefd240b3d397ce708';

// Get FUB person data
function getFUBPerson(personId) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(FUB_API_KEY + ':').toString('base64');
    const options = {
      hostname: 'api.followupboss.com',
      path: `/v1/people/${personId}`,
      method: 'GET',
      headers: {
        'Authorization': 'Basic ' + auth,
        'Content-Type': 'application/json'
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error('Failed to parse FUB response'));
          }
        } else {
          reject(new Error(`FUB API returned status ${res.statusCode}`));
        }
      });
    });
    
    req.on('error', reject);
    req.end();
  });
}

// Get ATTOM property data
function getATTOMProperty(address) {
  return new Promise((resolve, reject) => {
    // URL-encode the address
    const encodedAddress = encodeURIComponent(address);
    
    const options = {
      hostname: 'api.gateway.attomdata.com',
      path: `/propertyapi/v1.0.0/property/expandedprofile?address=${encodedAddress}`,
      method: 'GET',
      headers: {
        'apikey': ATTOM_API_KEY,
        'Accept': 'application/json'
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed);
          } catch (e) {
            reject(new Error('Failed to parse ATTOM response'));
          }
        } else {
          console.warn(`ATTOM API returned status ${res.statusCode} for address: ${address}`);
          resolve(null); // Don't fail, just return null
        }
      });
    });
    
    req.on('error', (err) => {
      console.error('ATTOM API error:', err);
      resolve(null); // Don't fail, just return null
    });
    
    req.setTimeout(5000, () => {
      req.destroy();
      console.warn('ATTOM API timeout');
      resolve(null);
    });
    
    req.end();
  });
}

/**
 * Calculate smart CMA defaults based on Glenn's 22-year expertise
 */
function calculateSmartDefaults(propertyData, leadData, address) {
  const defaults = {
    radius: 3,          // Base: Hudson Valley standard
    daysBack: 180,      // Base: Current market optimal
    comparables: 6,     // Base: Balanced analysis
    priceVariance: 15,  // Base: Standard range
    reasoning: {},
    confidence: 'HIGH'
  };
  
  const value = propertyData?.estimatedValue || propertyData?.avm?.amount?.value || 0;
  const sqft = propertyData?.building?.size?.livingSize || propertyData?.lot?.lotSize1 || 0;
  const propertyType = propertyData?.summary?.propType || '';
  const waterfront = propertyData?.location?.waterfront || false;
  const priority = leadData?.customFields?.customWILLOWPriorityLevel || 'WARM';
  const lastCMADate = leadData?.customFields?.customWILLOWCMAGenerated;
  
  // ===========================================
  // PROPERTY VALUE ADJUSTMENTS (Glenn's Protocol)
  // ===========================================
  
  if (value > 750000) {
    // LUXURY PROPERTY PROTOCOL
    defaults.radius = 5;
    defaults.comparables = 8;
    defaults.priceVariance = 20;
    defaults.daysBack = 180;
    defaults.reasoning.type = "Luxury Property";
    defaults.reasoning.radius = "Luxury property ($" + Math.round(value/1000) + "K) requires wider search area";
    defaults.reasoning.comparables = "High-value properties need more comps for accuracy";
    defaults.reasoning.priceVariance = "Luxury market variance - unique features command premium";
  } else if (value < 250000) {
    // ENTRY-LEVEL PROPERTY
    defaults.radius = 2;
    defaults.priceVariance = 10;
    defaults.reasoning.type = "Entry-Level Property";
    defaults.reasoning.radius = "Entry-level market - tighter geographic comp search";
    defaults.reasoning.priceVariance = "More standardized pricing in this range";
  } else {
    // STANDARD PROPERTY
    defaults.reasoning.type = "Standard Residential";
  }
  
  // ===========================================
  // PROPERTY TYPE ADJUSTMENTS
  // ===========================================
  
  if (waterfront) {
    // WATERFRONT PROTOCOL
    defaults.radius = 10;
    defaults.daysBack = 270;
    defaults.comparables = 8;
    defaults.priceVariance = 25;
    defaults.reasoning.type = "Waterfront Property";
    defaults.reasoning.radius = "Waterfront property - location is premium factor";
    defaults.reasoning.daysBack = "Waterfront sales less frequent - extended lookback";
    defaults.reasoning.priceVariance = "Waterfront features vary significantly";
    defaults.confidence = 'MEDIUM';
  }
  
  if (propertyType.toLowerCase().includes('condo') || propertyType.toLowerCase().includes('townhouse')) {
    // CONDO/TOWNHOUSE PROTOCOL
    defaults.radius = 1.5;
    defaults.comparables = 8;
    defaults.reasoning.type = "Condo/Townhouse";
    defaults.reasoning.radius = "Comps should be from same or similar complexes";
    defaults.reasoning.comparables = "More comps needed for amenity differences";
  }
  
  if (sqft > 4000) {
    // LARGE PROPERTY
    defaults.radius = 7;
    defaults.comparables = 8;
    defaults.reasoning.radius = "Large home (" + sqft + " sqft) - expanded search";
    defaults.reasoning.comparables = "Fewer large homes available - need more comps";
  }
  
  // ===========================================
  // GEOGRAPHIC ADJUSTMENTS (Hudson Valley)
  // ===========================================
  
  if (address) {
    // Urban centers (Poughkeepsie, Newburgh, Kingston)
    if (address.match(/poughkeepsie|newburgh|kingston/i)) {
      defaults.radius = 2;
      defaults.daysBack = 90;
      defaults.reasoning.geographic = "Urban center - dense comp availability";
    }
    
    // Rural areas (Rhinebeck, Red Hook, Milan, etc.)
    if (address.match(/rhinebeck|red hook|milan|tivoli|stanfordville/i)) {
      defaults.radius = 10;
      defaults.daysBack = 270;
      defaults.reasoning.geographic = "Rural location - fewer comps, wider search";
      defaults.confidence = 'MEDIUM';
    }
  }
  
  // ===========================================
  // BEHAVIORAL INTELLIGENCE ADJUSTMENTS
  // ===========================================
  
  if (priority === 'CRITICAL' || priority === 'SUPER_HOT' || priority === 'HOT') {
    // HOT LEAD PROTOCOL
    defaults.comparables = 8;
    defaults.reasoning.priority = "High-priority lead - detailed analysis";
  }
  
  // First-time CMA generation
  if (!lastCMADate) {
    defaults.comparables = 8;
    defaults.reasoning.first = 'First CMA - comprehensive analysis';
  }
  
  // ===========================================
  // VALIDATION & SANITY CHECKS
  // ===========================================
  
  // Ensure reasonable bounds
  defaults.radius = Math.max(1, Math.min(15, defaults.radius));
  defaults.daysBack = Math.max(90, Math.min(365, defaults.daysBack));
  defaults.comparables = Math.max(4, Math.min(12, defaults.comparables));
  defaults.priceVariance = Math.max(5, Math.min(30, defaults.priceVariance));
  
  // Round to reasonable precision
  defaults.radius = Math.round(defaults.radius * 2) / 2; // Round to nearest 0.5
  
  // Build explanation text
  const explanations = [];
  if (defaults.reasoning.type) explanations.push(defaults.reasoning.type);
  if (defaults.reasoning.geographic) explanations.push(defaults.reasoning.geographic);
  if (defaults.reasoning.priority) explanations.push(defaults.reasoning.priority);
  if (defaults.reasoning.first) explanations.push(defaults.reasoning.first);
  
  defaults.reasoning.explanation = explanations.join('. ') || 'Standard residential analysis';
  
  return defaults;
}

exports.handler = async (event) => {
  console.log('🎯 CMA SMART DEFAULTS (EMBEDDED): Request received');
  
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };
  
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  
  try {
    const payload = JSON.parse(event.body);
    const { leadId, address } = payload;
    
    if (!leadId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'leadId required' })
      };
    }
    
    console.log('📊 Lead ID:', leadId);
    console.log('📍 Address:', address);
    
    // Fetch data in parallel
    const [leadData, attomData] = await Promise.all([
      getFUBPerson(leadId).catch(err => {
        console.error('FUB fetch failed:', err);
        return null;
      }),
      address ? getATTOMProperty(address).catch(err => {
        console.error('ATTOM fetch failed:', err);
        return null;
      }) : Promise.resolve(null)
    ]);
    
    console.log('✅ FUB data received:', !!leadData);
    console.log('✅ ATTOM data received:', !!attomData);
    
    // Extract property data from ATTOM response
    let propertyData = {};
    if (attomData && attomData.property && attomData.property.length > 0) {
      const prop = attomData.property[0];
      propertyData = {
        estimatedValue: prop.avm?.amount?.value || prop.assessment?.assessed?.assdTtlValue || null,
        sqft: prop.building?.size?.livingSize || null,
        propertyType: prop.summary?.propType || null,
        waterfront: prop.location?.waterfront || false,
        address: prop.address?.oneLine || address,
        bedrooms: prop.building?.rooms?.beds || null,
        bathrooms: prop.building?.rooms?.bathsTotal || null,
        yearBuilt: prop.summary?.yearBuilt || null,
        lotSize: prop.lot?.lotSize1 || null
      };
    }
    
    // Calculate smart defaults
    const smartDefaults = calculateSmartDefaults(
      propertyData,
      leadData,
      address
    );
    
    console.log('✅ Smart defaults calculated:', JSON.stringify(smartDefaults, null, 2));
    
    // Return response
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        defaults: smartDefaults,
        property: propertyData,
        leadId,
        calculatedAt: new Date().toISOString()
      })
    };
    
  } catch (error) {
    console.error('💥 Error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to calculate smart defaults',
        message: error.message
      })
    };
  }
};
