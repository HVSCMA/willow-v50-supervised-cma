/**
 * WILLOW V50 CMA Smart Defaults Calculator
 * Glenn Fitzgerald's 22-Year Real Estate Expertise
 * Analyzes property and market data to suggest optimal CMA parameters
 */

const https = require('https');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'WILLOW_V50_SECRET_CHANGE_IN_PRODUCTION_2025';
const FUB_API_KEY = process.env.FUB_API_KEY || 'fka_0oHt62NxmsExO6x69p08ix82zx8ii1hzrj';

// Token verification
function verifyToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { valid: false, error: 'No token provided' };
  }
  
  const token = authHeader.substring(7);
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return { valid: true, user: decoded };
  } catch (error) {
    return { valid: false, error: error.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token' };
  }
}

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

/**
 * Calculate smart CMA defaults based on Glenn's 22-year expertise
 * @param {Object} propertyData - ATTOM property intelligence
 * @param {Object} leadData - FUB lead data with behavioral intelligence
 * @param {Object} marketConditions - Current market conditions (optional)
 * @returns {Object} Optimized CMA parameters with reasoning
 */
function calculateSmartDefaults(propertyData, leadData, marketConditions = {}) {
  const defaults = {
    radius: 3,          // Base: Hudson Valley standard
    daysBack: 180,      // Base: Current market optimal
    comparables: 6,     // Base: Balanced analysis
    priceVariance: 15,  // Base: Standard range
    reasoning: {},
    confidence: 'HIGH'
  };
  
  const value = propertyData.estimatedValue || 0;
  const sqft = propertyData.sqft || 0;
  const propertyType = propertyData.propertyType || '';
  const waterfront = propertyData.waterfront || false;
  const priority = leadData.customFields?.customWILLOWPriorityLevel || 'WARM';
  const lastCMADate = leadData.customFields?.customWILLOWCMAGenerated;
  
  // ===========================================
  // PROPERTY VALUE ADJUSTMENTS (Glenn's Protocol)
  // ===========================================
  
  if (value > 750000) {
    // LUXURY PROPERTY PROTOCOL
    defaults.radius = 5;
    defaults.comparables = 8;
    defaults.priceVariance = 20;
    defaults.reasoning.radius = "Luxury property ($" + Math.round(value/1000) + "K) requires wider search area for comparable high-end properties";
    defaults.reasoning.comparables = "High-value properties need more comps for accurate valuation confidence";
    defaults.reasoning.priceVariance = "Luxury market variance - unique features command premium pricing";
  } else if (value < 250000) {
    // ENTRY-LEVEL PROPERTY
    defaults.radius = 2;
    defaults.priceVariance = 10;
    defaults.reasoning.radius = "Entry-level market - tighter geographic comp search";
    defaults.reasoning.priceVariance = "More standardized pricing in this range";
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
    defaults.reasoning.radius = "Waterfront property - location is premium factor, wider search needed";
    defaults.reasoning.daysBack = "Waterfront sales less frequent - extended lookback period";
    defaults.reasoning.priceVariance = "Waterfront features vary significantly - higher variance needed";
    defaults.confidence = 'MEDIUM';
  }
  
  if (propertyType.toLowerCase().includes('condo') || propertyType.toLowerCase().includes('townhouse')) {
    // CONDO/TOWNHOUSE PROTOCOL
    defaults.radius = 1.5;
    defaults.comparables = 8;
    defaults.reasoning.radius = "Condo/townhouse - comps should be from same or similar complexes";
    defaults.reasoning.comparables = "More comps needed to account for amenity differences";
  }
  
  if (sqft > 4000) {
    // LARGE PROPERTY
    defaults.radius = 7;
    defaults.comparables = 8;
    defaults.reasoning.radius = "Large home (4000+ sqft) - expanded search for comparable size";
    defaults.reasoning.comparables = "Fewer large homes available - need more comps";
  }
  
  // ===========================================
  // MARKET TIMING ADJUSTMENTS
  // ===========================================
  
  if (lastCMADate) {
    const monthsSince = getMonthsSince(lastCMADate);
    
    if (monthsSince > 6) {
      defaults.daysBack = 270;
      defaults.reasoning.daysBack = "Previous CMA is " + monthsSince + " months old - extended lookback for trend analysis";
    } else if (monthsSince < 2) {
      defaults.daysBack = 90;
      defaults.reasoning.daysBack = "Recent CMA (" + monthsSince + " months ago) - focus on latest market data";
    }
  }
  
  // Market conditions (if provided)
  if (marketConditions.inventoryLow) {
    defaults.daysBack = 270;
    defaults.radius += 2;
    defaults.reasoning.daysBack = (defaults.reasoning.daysBack || '') + ' [Low inventory market - go back further]';
    defaults.reasoning.radius = (defaults.reasoning.radius || defaults.radius + ' miles') + ' [Low inventory - wider search]';
  }
  
  if (marketConditions.rapidAppreciation) {
    defaults.daysBack = 120;
    defaults.comparables = 8;
    defaults.priceVariance += 10;
    defaults.reasoning.daysBack = "Rapidly appreciating market - focus on recent sales only";
    defaults.reasoning.priceVariance = "Higher variance due to rapid price changes";
  }
  
  // ===========================================
  // BEHAVIORAL INTELLIGENCE ADJUSTMENTS
  // ===========================================
  
  if (priority === 'CRITICAL' || priority === 'SUPER_HOT') {
    // HOT LEAD PROTOCOL
    defaults.comparables = 8;
    defaults.reasoning.comparables = (defaults.reasoning.comparables || '') + ' [High-priority lead - detailed analysis required]';
  }
  
  // First-time CMA generation
  if (!lastCMADate) {
    defaults.comparables = 8;
    defaults.reasoning.comparables = 'First CMA for this lead - comprehensive analysis with more comps';
    defaults.reasoning.general = "🎯 Initial CMA - Glenn's complete analysis protocol";
  }
  
  // ===========================================
  // GEOGRAPHIC ADJUSTMENTS (Hudson Valley)
  // ===========================================
  
  const address = propertyData.address || '';
  
  // Urban centers (Poughkeepsie, Newburgh, Kingston)
  if (address.match(/poughkeepsie|newburgh|kingston/i)) {
    defaults.radius = 2;
    defaults.daysBack = 90;
    defaults.reasoning.radius = "Urban center - dense comp availability, tighter search";
    defaults.reasoning.daysBack = "Active urban market - recent sales most relevant";
  }
  
  // Rural areas (Rhinebeck, Red Hook, Milan, etc.)
  if (address.match(/rhinebeck|red hook|milan|tivoli|stanfordville/i)) {
    defaults.radius = 10;
    defaults.daysBack = 270;
    defaults.reasoning.radius = "Rural location - fewer comps, wider search required";
    defaults.reasoning.daysBack = "Rural market - extended lookback for sufficient data";
    defaults.confidence = 'MEDIUM';
  }
  
  // ===========================================
  // VALIDATION & SANITY CHECKS
  // ===========================================
  
  // Ensure reasonable bounds
  defaults.radius = Math.max(1, Math.min(15, defaults.radius));
  defaults.daysBack = Math.max(60, Math.min(365, defaults.daysBack));
  defaults.comparables = Math.max(3, Math.min(12, defaults.comparables));
  defaults.priceVariance = Math.max(5, Math.min(30, defaults.priceVariance));
  
  // Round to reasonable precision
  defaults.radius = Math.round(defaults.radius * 2) / 2; // Round to nearest 0.5
  
  return defaults;
}

/**
 * Get months since a date
 */
function getMonthsSince(dateStr) {
  if (!dateStr) return null;
  
  const date = new Date(dateStr);
  const now = new Date();
  const months = (now.getFullYear() - date.getFullYear()) * 12 + 
                 (now.getMonth() - date.getMonth());
  
  return Math.max(0, months);
}

exports.handler = async (event) => {
  console.log('🎯 CMA SMART DEFAULTS: Request received');
  
  const baseHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };
  
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: baseHeaders, body: '' };
  }
  
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: baseHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }
  
  // Verify authentication
  const authCheck = verifyToken(event.headers.authorization);
  if (!authCheck.valid) {
    return {
      statusCode: 401,
      headers: baseHeaders,
      body: JSON.stringify({ error: authCheck.error })
    };
  }
  
  try {
    const payload = JSON.parse(event.body);
    const { leadId, propertyData, marketConditions } = payload;
    
    if (!leadId) {
      return {
        statusCode: 400,
        headers: baseHeaders,
        body: JSON.stringify({ error: 'leadId required' })
      };
    }
    
    console.log('🎯 Calculating smart defaults for lead:', leadId);
    
    // Get FUB lead data for behavioral intelligence
    const leadData = await getFUBPerson(leadId);
    
    // Calculate smart defaults
    const smartDefaults = calculateSmartDefaults(
      propertyData || {},
      leadData,
      marketConditions || {}
    );
    
    console.log('✅ Smart defaults calculated:', JSON.stringify(smartDefaults, null, 2));
    
    return {
      statusCode: 200,
      headers: baseHeaders,
      body: JSON.stringify({
        success: true,
        leadId: leadId,
        defaults: smartDefaults,
        propertyContext: {
          estimatedValue: propertyData?.estimatedValue || 0,
          propertyType: propertyData?.propertyType || 'Unknown',
          waterfront: propertyData?.waterfront || false,
          sqft: propertyData?.sqft || 0
        },
        leadContext: {
          priority: leadData.customFields?.customWILLOWPriorityLevel || 'WARM',
          behavioralScore: leadData.customFields?.customWILLOWBehavioralScore || 0,
          lastCMA: leadData.customFields?.customWILLOWCMAGenerated || null
        },
        timestamp: new Date().toISOString()
      })
    };
    
  } catch (error) {
    console.error('❌ CMA SMART DEFAULTS ERROR:', error);
    return {
      statusCode: 500,
      headers: baseHeaders,
      body: JSON.stringify({
        error: 'Smart defaults calculation failed',
        message: error.message
      })
    };
  }
};

// Export for testing
exports.calculateSmartDefaults = calculateSmartDefaults;
