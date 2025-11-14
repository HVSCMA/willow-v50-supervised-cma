// WILLOW V50 CMA Workbench - Complete Netlify Function
// Purpose: Server-side FUB/CloudCMA API integration with HTML serving, FUB Context Processing, Attom Property Data Enhancement, and Intelligent Caching

const https = require('https');
const crypto = require('crypto');

// API Credentials
const FUB_API_KEY = process.env.FUB_API_KEY || 'fka_0oHt62NxmsExO6x69p08ix82zx8ii1hzrj';
const CLOUDCMA_API_KEY = process.env.CLOUDCMA_API_KEY || '742f4a46e1780904da090d721a9bae7b';
const ATTOM_API_KEY = process.env.ATTOM_API_KEY || 'bba0b57b0da26db5b5dd45b5750b0be8'; // Glenn's Attom API key
const WEBHOOK_URL = 'https://willow-v50-supervised-cma.netlify.app/.netlify/functions/cloudcma-webhook';

// Glenn's Center Range Protocol Configuration
const CENTER_RANGE_MULTIPLIER = 1.024; // Configurable multiplier factor

// Attom Data Caching Configuration (Glenn's 6-month requirement)
const CACHE_DURATION_MS = 180 * 24 * 60 * 60 * 1000; // 6 months in milliseconds
const CACHE_VERSION = 'v1'; // For cache invalidation when structure changes

exports.handler = async (event, context) => {
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        // Parse request
        const params = event.httpMethod === 'GET' 
            ? event.queryStringParameters || {}
            : JSON.parse(event.body || '{}');

        const action = params.action;

        // If no action parameter, serve HTML interface with FUB context processing
        if (!action) {
            // Process FUB context for address prepopulation
            let contextData = null;
            let personId = null;
            let prefilledAddress = '';
            
            try {
                // FUB passes contact data via base64-encoded context parameter
                const contextParam = params.context;
                if (contextParam) {
                    const contextJson = Buffer.from(contextParam, 'base64').toString('utf8');
                    contextData = JSON.parse(contextJson);
                    
                    // Extract person ID and address from FUB context
                    if (contextData.person) {
                        personId = contextData.person.id;
                        
                        // Get address from multiple possible fields
                        const addresses = contextData.person.addresses || [];
                        if (addresses.length > 0) {
                            const primaryAddress = addresses.find(addr => addr.type === 'home') || addresses[0];
                            if (primaryAddress) {
                                const addressParts = [
                                    primaryAddress.street,
                                    primaryAddress.city,
                                    primaryAddress.state,
                                    primaryAddress.postal_code
                                ].filter(Boolean);
                                prefilledAddress = addressParts.join(', ');
                            }
                        }
                    }
                }
            } catch (contextError) {
                console.warn('FUB context processing failed:', contextError.message);
                // Continue with empty prefill - not a fatal error
            }

            // Generate dynamic HTML with address prefilled from FUB context
            const html = generateHTML(prefilledAddress, personId);
            
            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'text/html',
                    'Access-Control-Allow-Origin': '*'
                },
                body: html
            };
        }

        // Route to appropriate API handler
        switch (action) {
            case 'getPersonData':
                return await getPersonData(params.personId, headers);
            
            case 'generateCMA':
                return await generateOptimalCMA(params, headers);
            
            case 'getHomebeatData':
                return await getHomebeatData(params.personId, headers);
            
            case 'resendHomebeat':
                return await resendHomebeat(params, headers);
            
            case 'createTask':
                return await createTask(params, headers);
            
            case 'createManualAction':
                return await createManualAction(params, headers);
            
            case 'getMarketValue':
                return await getMarketValue(params.address, headers);
            
            case 'getPropertyDetails':
                return await getPropertyDetailsWithCache(params.address, params.personId, params.forceRefresh, headers);
            
            default:
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Invalid action' })
                };
        }

    } catch (error) {
        console.error('Function error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};

// Generate cache key from normalized address
function generateCacheKey(address) {
    const normalized = address.toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return crypto.createHash('sha256').update(`${CACHE_VERSION}:${normalized}`).digest('hex').substring(0, 16);
}

// Get comprehensive property details with intelligent caching
async function getPropertyDetailsWithCache(address, personId, forceRefresh, headers) {
    try {
        if (!address) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing address parameter' })
            };
        }

        const cacheKey = generateCacheKey(address);
        let cachedData = null;
        let cacheAge = null;
        let cacheSource = 'fresh';

        // Check for cached data in FUB if personId provided (unless force refresh)
        if (personId && !forceRefresh) {
            try {
                const personData = await fubAPIRequest('GET', `/v1/people/${personId}`);
                const cacheField = `customWILLOWAttomCache${cacheKey}`;
                const cacheTimestampField = `customWILLOWAttomCacheTime${cacheKey}`;
                
                if (personData[cacheField] && personData[cacheTimestampField]) {
                    const cacheTimestamp = new Date(personData[cacheTimestampField]).getTime();
                    const now = Date.now();
                    cacheAge = now - cacheTimestamp;
                    
                    // Check if cache is within 6-month window
                    if (cacheAge < CACHE_DURATION_MS) {
                        try {
                            cachedData = JSON.parse(personData[cacheField]);
                            cacheSource = 'cached';
                            console.log(`WILLOW V50: Using cached Attom data for ${address} (age: ${Math.round(cacheAge / (24 * 60 * 60 * 1000))} days)`);
                        } catch (parseError) {
                            console.warn('Failed to parse cached Attom data:', parseError.message);
                        }
                    } else {
                        console.log(`WILLOW V50: Attom cache expired for ${address} (age: ${Math.round(cacheAge / (24 * 60 * 60 * 1000))} days > 180 days)`);
                    }
                }
            } catch (cacheError) {
                console.warn('Cache retrieval failed:', cacheError.message);
            }
        }

        // Fetch fresh data if no valid cache or force refresh
        if (!cachedData || forceRefresh) {
            console.log(`WILLOW V50: Fetching fresh Attom data for ${address}${forceRefresh ? ' (force refresh)' : ''}`);
            cachedData = await attomPropertySearch(address);
            cacheSource = 'fresh';
            
            if (cachedData && personId) {
                // Cache the fresh data in FUB custom fields
                try {
                    const cacheField = `customWILLOWAttomCache${cacheKey}`;
                    const cacheTimestampField = `customWILLOWAttomCacheTime${cacheKey}`;
                    
                    const cacheUpdate = {
                        [cacheField]: JSON.stringify(cachedData),
                        [cacheTimestampField]: new Date().toISOString()
                    };
                    
                    await fubAPIRequest('PUT', `/v1/people/${personId}`, cacheUpdate);
                    console.log(`WILLOW V50: Cached Attom data for ${address} (6-month expiry)`);
                } catch (cacheStorageError) {
                    console.warn('Failed to cache Attom data:', cacheStorageError.message);
                }
            }
        }
        
        if (cachedData) {
            // Enhance response with cache metadata
            const response = {
                ...cachedData,
                _cache: {
                    source: cacheSource,
                    age_days: cacheAge ? Math.round(cacheAge / (24 * 60 * 60 * 1000)) : 0,
                    expires_in_days: cacheAge ? Math.max(0, 180 - Math.round(cacheAge / (24 * 60 * 60 * 1000))) : 180,
                    cache_key: cacheKey,
                    force_refresh_available: !!personId
                }
            };
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(response)
            };
        } else {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ 
                    error: 'Property data not found',
                    message: 'No property details available for this address in Attom database',
                    cache_key: cacheKey
                })
            };
        }
    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Property lookup failed: ' + error.message })
        };
    }
}

// Attom API Property Search with enhanced error handling
async function attomPropertySearch(address) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'search.onboard-apis.com',
            path: `/propertyapi/v1.0.0/property/detail?address1=${encodeURIComponent(address)}&format=json`,
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'apikey': ATTOM_API_KEY
            },
            timeout: 15000
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    if (res.statusCode === 200) {
                        const data = JSON.parse(body);
                        const property = data.property?.[0];
                        
                        if (property) {
                            // Extract comprehensive property details for optimal CMA enhancement
                            const details = {
                                // Basic property information
                                address: property.address?.oneLine || address,
                                propertyType: property.summary?.propclass || 'Single Family Residential',
                                
                                // Physical characteristics
                                beds: property.building?.rooms?.beds || null,
                                baths: property.building?.rooms?.bathstotal || property.building?.rooms?.baths || null,
                                sqft: property.building?.size?.livingsize || property.building?.size?.grosssize || null,
                                
                                // Lot information
                                lotSqft: property.lot?.lotsize1 || null,
                                acres: property.lot?.lotsize1 ? (property.lot.lotsize1 / 43560).toFixed(4) : null,
                                
                                // Additional features for optimal CMA
                                garageSpaces: property.building?.parking?.garagespaces || property.building?.parking?.carportspaces || null,
                                yearBuilt: property.summary?.yearbuilt || null,
                                stories: property.building?.summary?.stories || null,
                                
                                // Location data for precise CMA
                                latitude: property.location?.latitude || null,
                                longitude: property.location?.longitude || null,
                                
                                // Property classification for CloudCMA
                                propClass: property.summary?.propclass || 'Residential',
                                propSubType: property.summary?.propsubtype || 'Single Family Residence',
                                
                                // Market data
                                lastSalePrice: property.sale?.amount?.saleamt || null,
                                lastSaleDate: property.sale?.amount?.salerecdate || null,
                                
                                // Assessment data
                                assessedValue: property.assessment?.assessed?.assdtotal || null,
                                marketValue: property.assessment?.market?.mktttl || null,
                                taxes: property.assessment?.tax?.taxyear ? property.assessment.tax.taxamt : null,
                                
                                // Additional CloudCMA enhancement fields
                                basement: property.building?.basement?.bsmttype || null,
                                fireplace: property.building?.interior?.fireplaces || null,
                                pool: property.building?.summary?.pool || null,
                                
                                // Construction details
                                construction: property.building?.construction?.walltype || null,
                                roofing: property.building?.construction?.rooftype || null,
                                heating: property.building?.utilities?.heatingtype || null,
                                cooling: property.building?.utilities?.coolingtype || null,
                                
                                // Lot details
                                lotDescription: property.lot?.lotdesc || null,
                                zoning: property.lot?.zoning || null,
                                
                                // Data source metadata for audit trail
                                attomId: property.identifier?.attomId || null,
                                parcelNumber: property.identifier?.parcelnumber || null,
                                dataFreshness: new Date().toISOString()
                            };

                            // Clean up null values and format numbers
                            Object.keys(details).forEach(key => {
                                if (details[key] === null || details[key] === undefined || details[key] === '') {
                                    delete details[key];
                                }
                                // Convert string numbers to actual numbers where appropriate
                                if (typeof details[key] === 'string' && !isNaN(details[key]) && details[key].trim() !== '') {
                                    const numValue = parseFloat(details[key]);
                                    if (!isNaN(numValue)) {
                                        details[key] = numValue;
                                    }
                                }
                            });

                            resolve(details);
                        } else {
                            resolve(null);
                        }
                    } else {
                        console.warn(`Attom API error: ${res.statusCode} - ${body}`);
                        resolve(null);
                    }
                } catch (e) {
                    console.warn('Failed to parse Attom response:', e.message);
                    resolve(null);
                }
            });
        });

        req.on('error', (err) => {
            console.warn('Attom API request failed:', err.message);
            resolve(null);
        });
        
        req.on('timeout', () => {
            req.destroy();
            console.warn('Attom API request timeout');
            resolve(null);
        });

        req.end();
    });
}

// Generate dynamic HTML with FUB context data and enhanced property lookup
function generateHTML(prefilledAddress = '', personId = null) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WILLOW V50 - CMA Workbench</title>
    <!-- FUB Embedded Apps SDK -->
    <script type="text/javascript" src="https://eia.followupboss.com/embeddedApps-v1.0.1.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #2d3748;
            line-height: 1.6;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
        }

        .header {
            background: white;
            border-radius: 12px;
            padding: 20px 30px;
            margin-bottom: 20px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }

        .header h1 {
            font-size: 24px;
            color: #667eea;
            margin-bottom: 5px;
        }

        .header .subtitle {
            font-size: 14px;
            color: #718096;
        }

        .tabs {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
        }

        .tab-button {
            flex: 1;
            background: white;
            border: none;
            padding: 15px 20px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .tab-button.active {
            background: #667eea;
            color: white;
            transform: translateY(-1px);
            box-shadow: 0 4px 8px rgba(102,126,234,0.3);
        }

        .tab-button:hover:not(.active) {
            background: #f7fafc;
            transform: translateY(-1px);
        }

        .tab-content {
            display: none;
        }

        .tab-content.active {
            display: block;
        }

        .card {
            background: white;
            border-radius: 12px;
            padding: 25px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }

        .form-group {
            margin-bottom: 20px;
        }

        .form-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
        }

        .form-row-3 {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 15px;
        }

        .form-row-4 {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr 1fr;
            gap: 15px;
        }

        .form-row-5 {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr 1fr 1fr;
            gap: 15px;
        }

        label {
            display: block;
            margin-bottom: 8px;
            font-weight: 500;
            color: #2d3748;
        }

        input, select, textarea {
            width: 100%;
            padding: 12px;
            border: 2px solid #e2e8f0;
            border-radius: 8px;
            font-size: 14px;
            transition: border-color 0.2s;
        }

        input:focus, select:focus, textarea:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102,126,234,0.1);
        }

        .checkbox-group {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-top: 15px;
        }

        .checkbox-group input[type="checkbox"] {
            width: auto;
            margin: 0;
        }

        .btn {
            background: #667eea;
            color: white;
            padding: 15px 30px;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            width: 100%;
            margin-top: 20px;
        }

        .btn:hover {
            background: #5a67d8;
            transform: translateY(-1px);
            box-shadow: 0 4px 8px rgba(102,126,234,0.3);
        }

        .btn:disabled {
            background: #a0aec0;
            cursor: not-allowed;
            transform: none;
        }

        .btn-secondary {
            background: #ed8936;
            margin-top: 10px;
        }

        .btn-secondary:hover {
            background: #dd6b20;
        }

        .btn-refresh {
            background: #38a169;
            margin-top: 5px;
            padding: 8px 15px;
            font-size: 14px;
        }

        .btn-refresh:hover {
            background: #2f855a;
        }

        .status {
            padding: 15px;
            border-radius: 8px;
            margin-top: 20px;
            display: none;
        }

        .status.success {
            background: #f0fff4;
            color: #22543d;
            border: 1px solid #9ae6b4;
        }

        .status.error {
            background: #fed7d7;
            color: #742a2a;
            border: 1px solid #feb2b2;
        }

        .status.info {
            background: #ebf8ff;
            color: #2a4365;
            border: 1px solid #90cdf4;
        }

        .loading {
            display: none;
            text-align: center;
            padding: 20px;
        }

        .spinner {
            border: 3px solid #f3f3f3;
            border-top: 3px solid #667eea;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 0 auto 10px;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        .homebeat-item {
            background: #f7fafc;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 10px;
        }

        .homebeat-header {
            display: flex;
            justify-content: between;
            align-items: center;
            margin-bottom: 10px;
        }

        .homebeat-address {
            font-weight: 600;
            color: #2d3748;
        }

        .homebeat-status {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 500;
        }

        .homebeat-status.active {
            background: #c6f6d5;
            color: #22543d;
        }

        .homebeat-status.pending {
            background: #fef5e7;
            color: #975a16;
        }

        .homebeat-actions {
            display: flex;
            gap: 10px;
            margin-top: 10px;
        }

        .btn-sm {
            padding: 8px 15px;
            font-size: 12px;
            margin: 0;
            width: auto;
        }

        .info-box {
            background: #ebf8ff;
            border: 1px solid #90cdf4;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 20px;
        }

        .info-box h4 {
            color: #2b6cb0;
            margin-bottom: 8px;
        }

        .info-box p {
            color: #2a4365;
            font-size: 14px;
            margin: 0;
        }

        .enhancement-box {
            background: #f0fff4;
            border: 1px solid #9ae6b4;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 20px;
        }

        .enhancement-box h4 {
            color: #22543d;
            margin-bottom: 8px;
        }

        .enhancement-box p {
            color: #22543d;
            font-size: 14px;
            margin: 0;
        }

        .cache-info {
            background: #fff5f5;
            border: 1px solid #feb2b2;
            border-radius: 8px;
            padding: 15px;
            margin-top: 15px;
            font-size: 13px;
            display: none;
        }

        .cache-info.show {
            display: block;
        }

        .cache-info h5 {
            color: #742a2a;
            margin-bottom: 8px;
        }

        @media (max-width: 768px) {
            .form-row, .form-row-3, .form-row-4, .form-row-5 {
                grid-template-columns: 1fr;
            }
            
            .container {
                padding: 10px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>WILLOW V50 - CMA Workbench</h1>
            <div class="subtitle">Optimal CloudCMA Generation with Attom Property Enhancement & Intelligent 6-Month Caching</div>
        </div>

        <div class="tabs">
            <button class="tab-button active" onclick="switchTab('cma')">Optimal CMA Generator</button>
            <button class="tab-button" onclick="switchTab('homebeat')">Homebeat Manager</button>
            <button class="tab-button" onclick="switchTab('intelligence')">Lead Intelligence</button>
        </div>

        <!-- CMA Generation Tab -->
        <div id="cma-tab" class="tab-content active">
            <div class="card">
                <form id="cma-form">
                    <div class="info-box">
                        <h4>🎯 Glenn's Center Range Protocol Active</h4>
                        <p>When market data is available, system will suggest center range using Market Value × 1.024, rounded up to next $5K increment.</p>
                    </div>

                    <div class="enhancement-box">
                        <h4>🏠 Optimal CloudCMA Enhancement with Attom Intelligence</h4>
                        <p>Enter address and click "Auto-Fill Property Details" to populate comprehensive property data from Attom database. Data is cached for 6 months for instant access. Uses CloudCMA Widget API for maximum parameter utilization.</p>
                    </div>

                    <div class="form-group">
                        <label for="address">Property Address *</label>
                        <input type="text" id="address" name="address" value="${prefilledAddress}" required 
                               placeholder="123 Main St, City, State, ZIP">
                    </div>

                    <div class="form-row">
                        <button type="button" class="btn btn-secondary" onclick="autoFillPropertyDetails()">
                            🔍 Auto-Fill Property Details from Attom Database
                        </button>
                        <button type="button" class="btn btn-refresh" onclick="autoFillPropertyDetails(true)" style="display:none;" id="force-refresh-btn">
                            🔄 Force Refresh (Bypass Cache)
                        </button>
                    </div>

                    <div id="cache-info" class="cache-info">
                        <h5>📊 Cache Information</h5>
                        <p id="cache-details"></p>
                    </div>

                    <div class="form-row-5">
                        <div class="form-group">
                            <label for="beds">Bedrooms</label>
                            <input type="number" id="beds" name="beds" placeholder="Auto-detect">
                        </div>
                        <div class="form-group">
                            <label for="baths">Bathrooms</label>
                            <input type="number" step="0.5" id="baths" name="baths" placeholder="Auto-detect">
                        </div>
                        <div class="form-group">
                            <label for="sqft">Square Feet</label>
                            <input type="number" id="sqft" name="sqft" placeholder="Auto-detect">
                        </div>
                        <div class="form-group">
                            <label for="garage_spaces">Garage Spaces</label>
                            <input type="number" id="garage_spaces" name="garage_spaces" placeholder="Auto-detect">
                        </div>
                        <div class="form-group">
                            <label for="taxes">Annual Taxes</label>
                            <input type="number" id="taxes" name="taxes" placeholder="Auto-detect">
                        </div>
                    </div>

                    <div class="form-row-4">
                        <div class="form-group">
                            <label for="acres">Lot Size (Acres)</label>
                            <input type="number" step="0.0001" id="acres" name="acres" placeholder="Auto-detect">
                        </div>
                        <div class="form-group">
                            <label for="year_built">Year Built</label>
                            <input type="number" id="year_built" name="year_built" placeholder="Auto-detect">
                        </div>
                        <div class="form-group">
                            <label for="stories">Stories</label>
                            <input type="number" step="0.5" id="stories" name="stories" placeholder="Auto-detect">
                        </div>
                        <div class="form-group">
                            <label for="pool">Pool</label>
                            <select id="pool" name="pool">
                                <option value="">Auto-detect</option>
                                <option value="yes">Yes</option>
                                <option value="no">No</option>
                            </select>
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label for="latitude">Latitude (GPS)</label>
                            <input type="number" step="0.000001" id="latitude" name="latitude" placeholder="Auto-detect">
                        </div>
                        <div class="form-group">
                            <label for="longitude">Longitude (GPS)</label>
                            <input type="number" step="0.000001" id="longitude" name="longitude" placeholder="Auto-detect">
                        </div>
                    </div>

                    <div class="form-row-4">
                        <div class="form-group">
                            <label for="radius">Search Radius (miles)</label>
                            <select id="radius" name="radius">
                                <option value="0.25">0.25 miles</option>
                                <option value="0.5">0.5 miles</option>
                                <option value="0.75" selected>0.75 miles</option>
                                <option value="1">1 mile</option>
                                <option value="1.5">1.5 miles</option>
                                <option value="2">2 miles</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="months_back">Months Back</label>
                            <select id="months_back" name="months_back">
                                <option value="3">3 months</option>
                                <option value="6">6 months</option>
                                <option value="9" selected>9 months</option>
                                <option value="12">12 months</option>
                                <option value="18">18 months</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="min_listings">Min Listings</label>
                            <select id="min_listings" name="min_listings">
                                <option value="5">5 listings</option>
                                <option value="10" selected>10 listings</option>
                                <option value="15">15 listings</option>
                                <option value="20">20 listings</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="template">CMA Template</label>
                            <select id="template" name="template">
                                <option value="">Default Template</option>
                                <option value="Professional">Professional</option>
                                <option value="Luxury">Luxury Properties</option>
                                <option value="Investment">Investment Analysis</option>
                                <option value="First Time Buyer">First Time Buyer</option>
                            </select>
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label for="prop_type">Property Type</label>
                            <select id="prop_type" name="prop_type">
                                <option value="">Auto-detect</option>
                                <option value="Residential">Residential</option>
                                <option value="Single Family">Single Family</option>
                                <option value="Condo">Condo</option>
                                <option value="Townhome">Townhome</option>
                                <option value="Multi Family">Multi-Family</option>
                                <option value="Land">Land</option>
                                <option value="Commercial">Commercial</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="title">Report Title</label>
                            <input type="text" id="title" name="title" placeholder="Auto-generate from client name">
                        </div>
                    </div>

                    <div class="form-group">
                        <label for="headline">Report Headline</label>
                        <input type="text" id="headline" name="headline" placeholder="Professional Market Analysis" 
                               value="Professional Market Analysis">
                    </div>

                    <div class="checkbox-group">
                        <input type="checkbox" id="create_homebeat" name="create_homebeat">
                        <label for="create_homebeat">Create Enhanced Homebeat Subscription</label>
                    </div>

                    <div id="homebeat_options" style="display: none; margin-top: 15px;">
                        <div class="form-group">
                            <label for="homebeat_frequency">Homebeat Frequency</label>
                            <select id="homebeat_frequency" name="homebeat_frequency">
                                <option value="monthly">Monthly</option>
                                <option value="quarterly" selected>Quarterly</option>
                                <option value="semi_annually">Semi-Annually</option>
                                <option value="annually">Annually</option>
                            </select>
                        </div>
                    </div>

                    <button type="submit" class="btn">Generate Optimal CMA Report</button>
                </form>

                <div id="cma-status" class="status"></div>
                <div id="cma-loading" class="loading">
                    <div class="spinner"></div>
                    <div>Generating optimal CMA report...</div>
                </div>
            </div>
        </div>

        <!-- Homebeat Manager Tab -->
        <div id="homebeat-tab" class="tab-content">
            <div class="card">
                <h3 style="margin-bottom: 20px;">Homebeat Subscriptions</h3>
                
                <button onclick="loadHomebeats()" class="btn" style="margin-bottom: 20px;">
                    Refresh Homebeat Data
                </button>

                <div id="homebeat-list"></div>
                <div id="homebeat-status" class="status"></div>
                <div id="homebeat-loading" class="loading">
                    <div class="spinner"></div>
                    <div>Loading Homebeat data...</div>
                </div>
            </div>
        </div>

        <!-- Lead Intelligence Tab -->
        <div id="intelligence-tab" class="tab-content">
            <div class="card">
                <h3 style="margin-bottom: 20px;">Lead Intelligence Dashboard</h3>
                
                <button onclick="loadPersonData()" class="btn" style="margin-bottom: 20px;">
                    Load Lead Profile
                </button>

                <div id="person-data"></div>
                <div id="intelligence-status" class="status"></div>
                <div id="intelligence-loading" class="loading">
                    <div class="spinner"></div>
                    <div>Loading lead intelligence...</div>
                </div>
            </div>
        </div>
    </div>

    <script>
        // Global variables - Store person ID from FUB context and cache info
        let currentPersonId = ${personId ? `"${personId}"` : 'null'};
        let currentCacheInfo = null;
        
        // Initialize FUB SDK
        document.addEventListener('DOMContentLoaded', function() {
            console.log('WILLOW V50 CMA Workbench initialized');
            console.log('Person ID from FUB context:', currentPersonId);
            
            // If we have person ID from FUB context, load person data automatically
            if (currentPersonId) {
                loadPersonData();
            }
        });

        // Auto-fill property details from Attom API with intelligent caching
        async function autoFillPropertyDetails(forceRefresh = false) {
            const address = document.getElementById('address').value.trim();
            
            if (!address) {
                showStatus('cma', 'error', 'Please enter an address first');
                return;
            }
            
            showLoading('cma');
            hideStatus('cma');
            hideCacheInfo();
            
            try {
                const params = new URLSearchParams({
                    action: 'getPropertyDetails',
                    address: address
                });
                
                if (currentPersonId) params.append('personId', currentPersonId);
                if (forceRefresh) params.append('forceRefresh', 'true');
                
                const response = await fetch(\`\${window.location.href}?\${params.toString()}\`);
                const result = await response.json();
                hideLoading('cma');
                
                if (response.ok && result) {
                    // Store cache info
                    currentCacheInfo = result._cache;
                    
                    // Populate form fields with Attom data
                    if (result.beds) document.getElementById('beds').value = result.beds;
                    if (result.baths) document.getElementById('baths').value = result.baths;
                    if (result.sqft) document.getElementById('sqft').value = result.sqft;
                    if (result.garageSpaces) document.getElementById('garage_spaces').value = result.garageSpaces;
                    if (result.taxes) document.getElementById('taxes').value = result.taxes;
                    if (result.acres) document.getElementById('acres').value = result.acres;
                    if (result.yearBuilt) document.getElementById('year_built').value = result.yearBuilt;
                    if (result.stories) document.getElementById('stories').value = result.stories;
                    if (result.latitude) document.getElementById('latitude').value = result.latitude;
                    if (result.longitude) document.getElementById('longitude').value = result.longitude;
                    if (result.pool) document.getElementById('pool').value = result.pool === 'Y' ? 'yes' : 'no';
                    
                    // Set property type based on Attom classification
                    const propTypeSelect = document.getElementById('prop_type');
                    if (result.propertyType) {
                        const type = result.propertyType.toLowerCase();
                        if (type.includes('single')) {
                            propTypeSelect.value = 'Single Family';
                        } else if (type.includes('condo')) {
                            propTypeSelect.value = 'Condo';
                        } else if (type.includes('town')) {
                            propTypeSelect.value = 'Townhome';
                        } else {
                            propTypeSelect.value = 'Residential';
                        }
                    }
                    
                    let populatedFields = [];
                    if (result.beds) populatedFields.push(\`\${result.beds} beds\`);
                    if (result.baths) populatedFields.push(\`\${result.baths} baths\`);
                    if (result.sqft) populatedFields.push(\`\${result.sqft.toLocaleString()} sqft\`);
                    if (result.acres) populatedFields.push(\`\${result.acres} acres\`);
                    if (result.garageSpaces) populatedFields.push(\`\${result.garageSpaces} garage spaces\`);
                    if (result.yearBuilt) populatedFields.push(\`built \${result.yearBuilt}\`);
                    if (result.taxes) populatedFields.push(\`$\${result.taxes.toLocaleString()} taxes\`);
                    
                    const cacheMsg = currentCacheInfo.source === 'cached' ? 
                        \` (cached data, \${currentCacheInfo.age_days} days old)\` : ' (fresh data)';
                    
                    showStatus('cma', 'success', 
                        \`✅ Property details auto-filled: \${populatedFields.join(', ')}\${result.latitude && result.longitude ? ', with GPS coordinates' : ''}\${cacheMsg}\`);
                    
                    // Show cache information
                    if (currentCacheInfo) {
                        displayCacheInfo(currentCacheInfo);
                        
                        // Show force refresh button if we have cached data and person ID
                        if (currentCacheInfo.force_refresh_available && currentCacheInfo.source === 'cached') {
                            document.getElementById('force-refresh-btn').style.display = 'inline-block';
                        }
                    }
                } else {
                    showStatus('cma', 'error', result.error || 'Property details not found in Attom database');
                }
            } catch (error) {
                hideLoading('cma');
                showStatus('cma', 'error', 'Property lookup failed: ' + error.message);
            }
        }

        // Display cache information
        function displayCacheInfo(cacheInfo) {
            const cacheDiv = document.getElementById('cache-info');
            const detailsP = document.getElementById('cache-details');
            
            let cacheText = '';
            if (cacheInfo.source === 'cached') {
                cacheText = \`Data Source: Cached (\${cacheInfo.age_days} days old)\\n\`;
                cacheText += \`Cache Expires: \${cacheInfo.expires_in_days} days remaining\\n\`;
                cacheText += \`Cache Key: \${cacheInfo.cache_key}\`;
            } else {
                cacheText = \`Data Source: Fresh from Attom API\\n\`;
                cacheText += \`Cached for: 180 days (6 months)\\n\`;
                cacheText += \`Cache Key: \${cacheInfo.cache_key}\`;
            }
            
            detailsP.textContent = cacheText;
            cacheDiv.classList.add('show');
        }

        // Hide cache information
        function hideCacheInfo() {
            document.getElementById('cache-info').classList.remove('show');
            document.getElementById('force-refresh-btn').style.display = 'none';
        }

        // Tab switching
        function switchTab(tabName) {
            // Hide all tabs
            document.querySelectorAll('.tab-content').forEach(tab => {
                tab.classList.remove('active');
            });
            
            // Remove active class from all buttons
            document.querySelectorAll('.tab-button').forEach(btn => {
                btn.classList.remove('active');
            });
            
            // Show selected tab
            document.getElementById(tabName + '-tab').classList.add('active');
            event.target.classList.add('active');
        }

        // Show/hide homebeat options
        document.getElementById('create_homebeat').addEventListener('change', function() {
            const options = document.getElementById('homebeat_options');
            options.style.display = this.checked ? 'block' : 'none';
        });

        // Form submission with optimal CMA data
        document.getElementById('cma-form').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            if (!currentPersonId) {
                showStatus('cma', 'error', 'Missing FUB person context. Please ensure app is loaded within Follow Up Boss.');
                return;
            }
            
            const formData = new FormData(this);
            const params = {
                action: 'generateCMA',
                personId: currentPersonId,
                address: formData.get('address'),
                beds: formData.get('beds'),
                baths: formData.get('baths'),
                sqft: formData.get('sqft'),
                garageSpaces: formData.get('garage_spaces'),
                taxes: formData.get('taxes'),
                acres: formData.get('acres'),
                yearBuilt: formData.get('year_built'),
                stories: formData.get('stories'),
                pool: formData.get('pool'),
                latitude: formData.get('latitude'),
                longitude: formData.get('longitude'),
                radius: formData.get('radius'),
                monthsBack: formData.get('months_back'),
                minListings: formData.get('min_listings'),
                propType: formData.get('prop_type'),
                template: formData.get('template'),
                title: formData.get('title'),
                headline: formData.get('headline'),
                createHomebeat: formData.get('create_homebeat') === 'on',
                homebeatFrequency: formData.get('homebeat_frequency')
            };
            
            showLoading('cma');
            hideStatus('cma');
            
            try {
                const response = await fetch(window.location.href, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(params)
                });
                
                const result = await response.json();
                hideLoading('cma');
                
                if (result.success) {
                    let message = '✅ Optimal CMA report generated successfully!';
                    if (result.suggested_center_range) {
                        message += \`\\n\\n🎯 Suggested Center Range: $\${result.suggested_center_range.toLocaleString()}\\n(Market Value × 1.024 Protocol)\`;
                    }
                    if (result.homebeatCreated) {
                        message += '\\n\\n🏠 Enhanced Homebeat subscription created successfully!';
                    }
                    if (result.enhancementLevel) {
                        message += \`\\n\\n📊 Enhancement Level: \${result.enhancementLevel}\`;
                    }
                    showStatus('cma', 'success', message);
                    
                    // Open CMA in new tab
                    window.open(result.cmaUrl, '_blank');
                } else {
                    showStatus('cma', 'error', result.error || 'Failed to generate CMA');
                }
            } catch (error) {
                hideLoading('cma');
                showStatus('cma', 'error', 'Network error: ' + error.message);
            }
        });

        // Load person data
        async function loadPersonData() {
            if (!currentPersonId) {
                showStatus('intelligence', 'error', 'Missing FUB person context. Please ensure app is loaded within Follow Up Boss.');
                return;
            }
            
            showLoading('intelligence');
            hideStatus('intelligence');
            
            try {
                const response = await fetch(\`\${window.location.href}?action=getPersonData&personId=\${currentPersonId}\`);
                const result = await response.json();
                hideLoading('intelligence');
                
                if (response.ok) {
                    displayPersonData(result);
                    showStatus('intelligence', 'success', 'Lead data loaded successfully');
                } else {
                    showStatus('intelligence', 'error', result.error || 'Failed to load person data');
                }
            } catch (error) {
                hideLoading('intelligence');
                showStatus('intelligence', 'error', 'Network error: ' + error.message);
            }
        }

        // Load homebeats
        async function loadHomebeats() {
            if (!currentPersonId) {
                showStatus('homebeat', 'error', 'Missing FUB person context. Please ensure app is loaded within Follow Up Boss.');
                return;
            }
            
            showLoading('homebeat');
            hideStatus('homebeat');
            
            try {
                const response = await fetch(\`\${window.location.href}?action=getHomebeatData&personId=\${currentPersonId}\`);
                const result = await response.json();
                hideLoading('homebeat');
                
                if (response.ok) {
                    displayHomebeats(result.homebeats || []);
                    showStatus('homebeat', 'success', \`\${result.homebeats?.length || 0} homebeat(s) found\`);
                } else {
                    showStatus('homebeat', 'error', result.error || 'Failed to load homebeat data');
                }
            } catch (error) {
                hideLoading('homebeat');
                showStatus('homebeat', 'error', 'Network error: ' + error.message);
            }
        }

        // Display person data
        function displayPersonData(person) {
            const container = document.getElementById('person-data');
            
            const addresses = person.addresses || [];
            const phones = person.phones || [];
            const emails = person.emails || [];
            
            container.innerHTML = \`
                <div style="background: #f7fafc; padding: 20px; border-radius: 8px;">
                    <h4 style="margin-bottom: 15px; color: #2d3748;">Contact Information</h4>
                    <p><strong>Name:</strong> \${person.name || 'Not provided'}</p>
                    <p><strong>Email:</strong> \${emails.map(e => e.value).join(', ') || 'Not provided'}</p>
                    <p><strong>Phone:</strong> \${phones.map(p => p.value).join(', ') || 'Not provided'}</p>
                    <p><strong>Addresses:</strong> \${addresses.map(a => \`\${a.street || ''}, \${a.city || ''}, \${a.state || ''} \${a.postal_code || ''}\`).join('; ') || 'Not provided'}</p>
                    <p><strong>Source:</strong> \${person.source || 'Not specified'}</p>
                    <p><strong>Created:</strong> \${person.created ? new Date(person.created).toLocaleDateString() : 'Unknown'}</p>
                </div>
            \`;
        }

        // Display homebeats
        function displayHomebeats(homebeats) {
            const container = document.getElementById('homebeat-list');
            
            if (homebeats.length === 0) {
                container.innerHTML = '<p style="text-align: center; color: #718096; padding: 40px;">No Homebeat subscriptions found for this lead.</p>';
                return;
            }
            
            container.innerHTML = homebeats.map(homebeat => \`
                <div class="homebeat-item">
                    <div class="homebeat-header">
                        <div class="homebeat-address">\${homebeat.property_address || 'Unknown Address'}</div>
                        <div class="homebeat-status \${homebeat.status || 'pending'}">\${homebeat.status || 'pending'}</div>
                    </div>
                    <p><strong>Frequency:</strong> \${homebeat.frequency || 'quarterly'}</p>
                    <p><strong>Total Views:</strong> \${homebeat.total_views || 0}</p>
                    <p><strong>Last View:</strong> \${homebeat.last_view ? new Date(homebeat.last_view).toLocaleDateString() : 'Never'}</p>
                    <p><strong>Created:</strong> \${homebeat.created_at ? new Date(homebeat.created_at).toLocaleDateString() : 'Unknown'}</p>
                    
                    <div class="homebeat-actions">
                        <button class="btn btn-sm" onclick="resendHomebeat('\${homebeat.id}')">
                            Resend Homebeat
                        </button>
                    </div>
                </div>
            \`).join('');
        }

        // Resend homebeat
        async function resendHomebeat(homebeatId) {
            if (!currentPersonId) {
                showStatus('homebeat', 'error', 'Missing person context');
                return;
            }
            
            showLoading('homebeat');
            
            try {
                const response = await fetch(window.location.href, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        action: 'resendHomebeat',
                        homebeatId: homebeatId,
                        personId: currentPersonId
                    })
                });
                
                const result = await response.json();
                hideLoading('homebeat');
                
                if (result.success) {
                    showStatus('homebeat', 'success', 'Homebeat resent successfully!');
                    // Reload homebeats to show updated data
                    setTimeout(() => loadHomebeats(), 2000);
                } else {
                    showStatus('homebeat', 'error', result.error || 'Failed to resend homebeat');
                }
            } catch (error) {
                hideLoading('homebeat');
                showStatus('homebeat', 'error', 'Network error: ' + error.message);
            }
        }

        // Utility functions
        function showLoading(section) {
            document.getElementById(section + '-loading').style.display = 'block';
        }

        function hideLoading(section) {
            document.getElementById(section + '-loading').style.display = 'none';
        }

        function showStatus(section, type, message) {
            const statusElement = document.getElementById(section + '-status');
            statusElement.className = \`status \${type}\`;
            statusElement.textContent = message;
            statusElement.style.display = 'block';
            
            if (type === 'success') {
                setTimeout(() => hideStatus(section), 10000);
            }
        }

        function hideStatus(section) {
            document.getElementById(section + '-status').style.display = 'none';
        }
    </script>
</body>
</html>`;
}

// Generate optimal CMA using CloudCMA Widget API with maximum parameters
async function generateOptimalCMA(params, headers) {
    try {
        const {
            personId,
            address,
            beds,
            baths,
            sqft,
            garageSpaces,
            taxes,
            acres,
            yearBuilt,
            stories,
            pool,
            latitude,
            longitude,
            radius,
            monthsBack,
            minListings,
            propType,
            template,
            title,
            headline,
            createHomebeat,
            homebeatFrequency
        } = params;

        // CRITICAL: Validate personId exists
        if (!personId || personId === 'null' || personId === 'undefined') {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    error: 'Missing person_id. FUB context parameter not decoded correctly.',
                    debug: {
                        personId: personId,
                        allParams: Object.keys(params)
                    }
                })
            };
        }

        // Get person data for lead info
        const personData = await fubAPIRequest('GET', `/v1/people/${personId}`);

        // Generate unique job ID for webhook matching
        const jobId = `OPTIMAL_CMA_${Date.now()}_${personId}`;

        // Step 1: Get market value for Glenn's center range protocol
        let centerValue = null;
        let marketValue = null;
        
        try {
            // Call market value lookup (internal function)
            const marketData = await getMarketValueInternal(address);
            
            if (marketData && marketData.value) {
                marketValue = marketData.value;
                // Glenn's Protocol: Market Value × 1.024, round up to next $5K
                const calculated = marketValue * CENTER_RANGE_MULTIPLIER;
                centerValue = Math.ceil(calculated / 5000) * 5000;
                console.log(`WILLOW V50: Center Range Protocol - ${marketValue} × ${CENTER_RANGE_MULTIPLIER} = ${centerValue}`);
            }
        } catch (marketError) {
            console.warn('WILLOW V50: Market value lookup failed:', marketError.message);
            // Continue without center range suggestion
        }

        // Build optimal CMA using CloudCMA Widget API for maximum parameter utilization
        const optimalParams = new URLSearchParams({
            api_key: CLOUDCMA_API_KEY,
            address: address,
            name: personData.name || 'Valued Client'
        });

        // Core property characteristics
        if (sqft) optimalParams.append('sqft', sqft);
        if (beds) optimalParams.append('beds', beds);
        if (baths) optimalParams.append('baths', baths);

        // Advanced property features
        if (garageSpaces) optimalParams.append('garages', garageSpaces);
        if (taxes) optimalParams.append('taxes', taxes);
        if (acres) {
            // Convert acres to square feet for CloudCMA lot_size parameter
            const lotSqft = Math.round(parseFloat(acres) * 43560);
            optimalParams.append('lot_size', lotSqft.toString());
        }

        // Professional presentation parameters
        if (title) optimalParams.append('title', title);
        if (headline) optimalParams.append('headline', headline);
        if (template) optimalParams.append('template', template);

        // Search parameters for optimal comparable selection
        optimalParams.append('min_listings', minListings || '10');
        optimalParams.append('months_back', monthsBack || '9');
        if (propType) optimalParams.append('prop_type', propType);

        // Enhanced notes with comprehensive property intelligence
        const enhancementDetails = [
            beds ? `${beds} bedrooms` : null,
            baths ? `${baths} bathrooms` : null,
            sqft ? `${parseInt(sqft).toLocaleString()} sqft` : null,
            garageSpaces ? `${garageSpaces} garage spaces` : null,
            acres ? `${acres} acres` : null,
            yearBuilt ? `built in ${yearBuilt}` : null,
            taxes ? `$${parseInt(taxes).toLocaleString()} annual taxes` : null,
            stories ? `${stories} stories` : null,
            pool && pool !== '' ? `pool: ${pool}` : null,
            latitude && longitude ? `GPS: ${latitude}, ${longitude}` : null
        ].filter(Boolean);

        const notes = `Generated by WILLOW V50 Optimal CMA System
Job ID: ${jobId}
Enhancement Level: ${enhancementDetails.length > 0 ? 'Attom Database Enhanced' : 'Address Only'}
${enhancementDetails.length > 0 ? 'Enhanced Data: ' + enhancementDetails.join(', ') : ''}

${centerValue ? `Suggested Center Range: $${centerValue.toLocaleString()} (Market Value × 1.024 Protocol)` : ''}

Powered by Attom Property Intelligence & CloudCMA Widget API`;

        optimalParams.append('notes', notes);
        optimalParams.append('job_id', jobId);
        optimalParams.append('callback_url', `${WEBHOOK_URL}?job_id=${encodeURIComponent(jobId)}`);

        // Use CloudCMA Widget endpoint for optimal parameter utilization
        const cmaUrl = `https://cloudcma.com/cmas/widget?${optimalParams.toString()}`;

        // Update FUB custom fields with comprehensive enhancement data
        const updatePayload = {
            customWILLOWCMADate: new Date().toISOString(),
            customWILLOWCMAAddress: address,
            customWILLOWCMALink: cmaUrl,
            customWILLOWCMAJobId: jobId,
            customWILLOWEnhancementLevel: enhancementDetails.length > 0 ? 'Attom Enhanced' : 'Address Only'
        };
        
        // Add center value if available (Glenn's protocol)
        if (centerValue) {
            updatePayload.customWILLOWCenterValue = centerValue;
        }

        // Store comprehensive property data in FUB custom fields
        if (beds) updatePayload.customWILLOWBeds = parseInt(beds);
        if (baths) updatePayload.customWILLOWBaths = parseFloat(baths);
        if (sqft) updatePayload.customWILLOWSqFt = parseInt(sqft);
        if (garageSpaces) updatePayload.customWILLOWGarageSpaces = parseInt(garageSpaces);
        if (taxes) updatePayload.customWILLOWTaxes = parseInt(taxes);
        if (acres) updatePayload.customWILLOWAcres = parseFloat(acres);
        if (yearBuilt) updatePayload.customWILLOWYearBuilt = parseInt(yearBuilt);
        if (stories) updatePayload.customWILLOWStories = parseFloat(stories);
        if (latitude) updatePayload.customWILLOWLatitude = parseFloat(latitude);
        if (longitude) updatePayload.customWILLOWLongitude = parseFloat(longitude);
        if (pool && pool !== '') updatePayload.customWILLOWPool = pool;

        await fubAPIRequest('PUT', `/v1/people/${personId}`, updatePayload);

        // Create comprehensive FUB activity note
        await fubAPIRequest('POST', '/v1/notes', {
            personId: parseInt(personId),
            subject: '🎯 WILLOW V50: Optimal CMA Generated',
            body: `Optimal CMA generated for ${address}

Property Enhancement: ${enhancementDetails.length > 0 ? enhancementDetails.join(', ') : 'Address only'}
Template: ${template || 'Default CloudCMA Template'}
Headline: ${headline || 'Professional Market Analysis'}
Search Parameters: ${radius || '0.75'}mi radius, ${monthsBack || '9'} months back, min ${minListings || '10'} comps

CloudCMA Widget URL: ${cmaUrl}
Job ID: ${jobId}

API Endpoint: CloudCMA Widget (Optimal Parameter Utilization)
Enhancement Source: Attom Property Database
Cache Strategy: 6-month intelligent caching active

${notes}`
        });

        let homebeatUrl = null;
        let homebeatCreated = false;

        // Create enhanced Homebeat if requested with comprehensive property data
        if (createHomebeat === true || createHomebeat === 'true') {
            try {
                const homebeatPayload = {
                    automation: {
                        api_key: CLOUDCMA_API_KEY,
                        frequency: homebeatFrequency || 'quarterly',
                        welcome_email: 'true',
                        report: {
                            prop_type: propType || null,
                            callback_url: null
                        },
                        subject_property: {
                            address: address,
                            sqft: sqft || null,
                            beds: beds || null,
                            baths: baths || null,
                            garages: garageSpaces || null,
                            lot_size: acres ? Math.round(parseFloat(acres) * 43560) : null,
                            taxes: taxes || null,
                            geo_lat: latitude || null,
                            geo_lon: longitude || null
                        },
                        lead: {
                            name: personData.name || '',
                            email_address: personData.emails?.[0]?.value || '',
                            phone: personData.phones?.[0]?.value || ''
                        }
                    }
                };

                const homebeatResponse = await cloudCMAAPIRequest('POST', '/homebeats/widget', homebeatPayload);
                homebeatCreated = true;
                homebeatUrl = homebeatResponse.homebeat_url || null;

                // Update FUB with enhanced Homebeat info
                await fubAPIRequest('PUT', `/v1/people/${personId}`, {
                    customWILLOWCloudCMAHomeBeatURL: homebeatUrl,
                    customWILLOWHomebeatFirstSendDate: new Date().toISOString()
                });

                // Create FUB activity note for enhanced Homebeat
                await fubAPIRequest('POST', '/v1/notes', {
                    personId: parseInt(personId),
                    subject: '🏠 WILLOW V50: Enhanced Homebeat Created',
                    body: `Enhanced Homebeat subscription created for ${address}

Property Enhancement: ${enhancementDetails.length > 0 ? enhancementDetails.join(', ') : 'Address only'}
Frequency: ${homebeatFrequency || 'quarterly'}
Homebeat URL: ${homebeatUrl}

Advanced Features Included:
${garageSpaces ? `- Garage tracking (${garageSpaces} spaces)` : ''}
${taxes ? `- Tax information ($${parseInt(taxes).toLocaleString()})` : ''}
${latitude && longitude ? '- GPS-precise location tracking' : ''}

Lead will receive automated market updates with enhanced property intelligence and neighborhood insights.`
                });

            } catch (homebeatError) {
                console.error('Enhanced Homebeat creation failed:', homebeatError);
            }
        }

        // Build comprehensive response with enhancement metrics
        const response = {
            success: true,
            cmaUrl: cmaUrl,
            homebeatCreated: homebeatCreated,
            homebeatUrl: homebeatUrl,
            jobId: jobId,
            address: address,
            enhancementLevel: enhancementDetails.length > 0 ? 'Attom Database Enhanced' : 'Address Only',
            enhancedFields: enhancementDetails,
            apiEndpoint: 'CloudCMA Widget (Optimal)',
            parameterCount: optimalParams.toString().split('&').length
        };
        
        // Add center range suggestion only when market data validates as current
        if (centerValue) {
            response.suggested_center_range = centerValue;
            response.center_range_note = "Suggested center range based on current market data (Glenn's 1.024 Protocol)";
        }
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(response)
        };

    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to generate optimal CMA: ' + error.message })
        };
    }
}

// Get Homebeat data from CloudCMA
async function getHomebeatData(personId, headers) {
    try {
        // Validate personId
        if (!personId || personId === 'null' || personId === 'undefined') {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing person_id parameter' })
            };
        }
        
        // Try to fetch homebeat data, but gracefully handle CloudCMA auth failures
        let homebeatReport = [];
        try {
            homebeatReport = await cloudCMAAPIRequest('GET', `/homebeats/report?api_key=${CLOUDCMA_API_KEY}&format=json`);
        } catch (cloudCMAError) {
            console.warn('CloudCMA API unavailable:', cloudCMAError.message);
            // Return empty homebeats array instead of failing
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ 
                    homebeats: [],
                    warning: 'CloudCMA API unavailable. Check API key configuration.'
                })
            };
        }

        const personData = await fubAPIRequest('GET', `/v1/people/${personId}`);
        const personEmail = personData.emails?.[0]?.value?.toLowerCase();

        if (!personEmail) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ homebeats: [] })
            };
        }

        const leadHomebeats = (homebeatReport || []).filter(hb => 
            hb.lead_email?.toLowerCase() === personEmail
        );

        const enrichedHomebeats = leadHomebeats.map(hb => ({
            ...hb,
            first_send_date: personData.customWILLOWHomebeatFirstSendDate || hb.created_at,
            status: (hb.total_views || 0) === 0 ? 'pending' : 'active'
        }));

        if (enrichedHomebeats.length > 0) {
            const totalViews = enrichedHomebeats.reduce((sum, hb) => sum + (hb.total_views || 0), 0);
            const latestView = enrichedHomebeats
                .map(hb => hb.last_view)
                .filter(v => v)
                .sort()
                .reverse()[0];

            await fubAPIRequest('PUT', `/v1/people/${personId}`, {
                customWILLOWHomebeatViews: totalViews,
                customWILLOWHomebeatLastView: latestView || null
            });
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ homebeats: enrichedHomebeats })
        };

    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to fetch Homebeat data: ' + error.message })
        };
    }
}

// Get person data from FUB
async function getPersonData(personId, headers) {
    try {
        // Validate personId
        if (!personId || personId === 'null' || personId === 'undefined') {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing person_id parameter' })
            };
        }
        
        const personData = await fubAPIRequest('GET', `/v1/people/${personId}`);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(personData)
        };
    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to fetch person data: ' + error.message })
        };
    }
}

// Resend Homebeat
async function resendHomebeat(params, headers) {
    try {
        const { homebeatId, personId } = params;

        // Validate personId
        if (!personId || personId === 'null' || personId === 'undefined') {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing person_id parameter' })
            };
        }

        const personData = await fubAPIRequest('GET', `/v1/people/${personId}`);
        
        const homebeatReport = await cloudCMAAPIRequest('GET', `/homebeats/report?api_key=${CLOUDCMA_API_KEY}&format=json`);
        const homebeat = (homebeatReport || []).find(hb => hb.id === homebeatId);

        if (!homebeat) {
            throw new Error('Homebeat not found');
        }

        const homebeatPayload = {
            automation: {
                api_key: CLOUDCMA_API_KEY,
                frequency: homebeat.frequency || 'quarterly',
                welcome_email: 'true',
                subject_property: {
                    address: homebeat.property_address,
                    sqft: homebeat.sqft || null,
                    beds: homebeat.beds || null,
                    baths: homebeat.baths || null
                },
                lead: {
                    name: personData.name || '',
                    email_address: personData.emails?.[0]?.value || '',
                    phone: personData.phones?.[0]?.value || ''
                }
            }
        };

        await cloudCMAAPIRequest('POST', '/homebeats/widget', homebeatPayload);

        await fubAPIRequest('PUT', `/v1/people/${personId}`, {
            customWILLOWHomebeatLastResend: new Date().toISOString()
        });

        // Create FUB activity note for Homebeat resend
        await fubAPIRequest('POST', '/v1/notes', {
            personId: parseInt(personId),
            subject: '🔁 WILLOW V50: Homebeat Resent',
            body: `Homebeat resent for ${homebeat.property_address}

Previous Status: Pending (0 views)
Action: Manual resend triggered

Lead will receive a new Homebeat welcome email with the latest market data.`
        });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true })
        };

    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to resend Homebeat: ' + error.message })
        };
    }
}

// Create task in FUB
async function createTask(params, headers) {
    try {
        const { personId, taskDescription, urgency, assignedTo } = params;

        // Validate personId
        if (!personId || personId === 'null' || personId === 'undefined') {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing person_id parameter' })
            };
        }

        const now = new Date();
        let dueDate = new Date(now);
        
        switch (urgency) {
            case 'IMMEDIATE':
                dueDate.setHours(now.getHours() + 24);
                break;
            case 'SAME_DAY':
                dueDate.setHours(23, 59, 59);
                break;
            case 'NEXT_DAY':
                dueDate.setDate(now.getDate() + 1);
                break;
            case 'WEEKLY':
                dueDate.setDate(now.getDate() + 7);
                break;
            default:
                dueDate.setDate(now.getDate() + 1);
        }

        // FUB tasks API doesn't accept description/body field
        // Task details should be added as a note after task creation
        const taskPayload = {
            personId: parseInt(personId),
            type: 'Follow Up',
            dueDate: dueDate.toISOString()
        };

        const taskResult = await fubAPIRequest('POST', '/v1/tasks', taskPayload);
        
        // Add task details as a note
        const notePayload = {
            personId: parseInt(personId),
            subject: `Task: ${taskDescription}`,
            body: `${taskDescription}\n\nAssigned to: ${assignedTo}\nUrgency: ${urgency}\nDue: ${dueDate.toLocaleDateString()}`,
            isHtml: false
        };
        await fubAPIRequest('POST', '/v1/notes', notePayload);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true })
        };

    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to create task: ' + error.message })
        };
    }
}

// Create manual action in FUB
async function createManualAction(params, headers) {
    try {
        const { personId, actionType, assignedTo, urgency, notes } = params;

        // Validate personId
        if (!personId || personId === 'null' || personId === 'undefined') {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing person_id parameter' })
            };
        }

        const now = new Date();
        let dueDate = new Date(now);
        
        switch (urgency) {
            case 'IMMEDIATE':
                dueDate.setHours(now.getHours() + 24);
                break;
            case 'SAME_DAY':
                dueDate.setHours(23, 59, 59);
                break;
            case 'NEXT_DAY':
                dueDate.setDate(now.getDate() + 1);
                break;
            case 'WEEKLY':
                dueDate.setDate(now.getDate() + 7);
                break;
            default:
                dueDate.setDate(now.getDate() + 1);
        }

        // Map action types to FUB task types
        const taskTypeMap = {
            'Task': 'Follow Up',
            'Call': 'Call',
            'Email': 'Email',
            'Text': 'Text',
            'Note': 'Note'
        };
        
        const fubType = taskTypeMap[actionType] || 'Follow Up';
        
        // If it's a Note, use /v1/notes endpoint, otherwise use /v1/tasks
        if (actionType === 'Note') {
            const notePayload = {
                personId: parseInt(personId),
                subject: `${urgency} Action`,
                body: `${notes}\n\nAssigned to: ${assignedTo}`,
                isHtml: false
            };
            await fubAPIRequest('POST', '/v1/notes', notePayload);
        } else {
            // FUB tasks API doesn't accept description field
            const taskPayload = {
                personId: parseInt(personId),
                type: fubType,
                dueDate: dueDate.toISOString()
            };
            await fubAPIRequest('POST', '/v1/tasks', taskPayload);
            
            // Add action details as a note
            const notePayload = {
                personId: parseInt(personId),
                subject: `${fubType} Action`,
                body: `${notes}\n\nAssigned to: ${assignedTo}\nUrgency: ${urgency}`,
                isHtml: false
            };
            await fubAPIRequest('POST', '/v1/notes', notePayload);
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true })
        };

    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to create action: ' + error.message })
        };
    }
}

// FUB API Request Helper
function fubAPIRequest(method, path, data = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.followupboss.com',
            port: 443,
            path: path,
            method: method,
            headers: {
                'Authorization': `Basic ${Buffer.from(FUB_API_KEY + ':').toString('base64')}`,
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(parsed);
                    } else {
                        reject(new Error(`FUB API error: ${res.statusCode} - ${body}`));
                    }
                } catch (e) {
                    reject(new Error(`Failed to parse FUB response: ${body}`));
                }
            });
        });

        req.on('error', reject);
        
        if (data) {
            req.write(JSON.stringify(data));
        }
        
        req.end();
    });
}

// CloudCMA API Request Helper
function cloudCMAAPIRequest(method, path, data = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'cloudcma.com',
            port: 443,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const parsed = body ? JSON.parse(body) : {};
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(parsed);
                    } else {
                        reject(new Error(`CloudCMA API error: ${res.statusCode} - ${body}`));
                    }
                } catch (e) {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve({});
                    } else {
                        reject(new Error(`Failed to parse CloudCMA response: ${body}`));
                    }
                }
            });
        });

        req.on('error', reject);
        
        if (data) {
            req.write(JSON.stringify(data));
        }
        
        req.end();
    });
}

// Market Value Lookup (External API endpoint)
async function getMarketValue(address, headers) {
    try {
        if (!address) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing address parameter' })
            };
        }
        
        const marketData = await getMarketValueInternal(address);
        
        if (marketData && marketData.value) {
            const centerRange = Math.ceil(marketData.value * CENTER_RANGE_MULTIPLIER / 5000) * 5000;
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    market_value: marketData.value,
                    suggested_center_range: centerRange,
                    data_source: marketData.source,
                    timestamp: new Date().toISOString()
                })
            };
        } else {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ 
                    error: 'Market data not available for this address',
                    message: 'No current market data found to validate center range'
                })
            };
        }
    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Market value lookup failed: ' + error.message })
        };
    }
}

// Internal Market Value Lookup (used by CMA generation)
async function getMarketValueInternal(address) {
    return new Promise((resolve, reject) => {
        // Call the existing zillow-zestimate function
        const options = {
            hostname: 'willow-v50-supervised-cma.netlify.app',
            path: `/.netlify/functions/zillow-zestimate?address=${encodeURIComponent(address)}`,
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000
        };
        
        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    if (res.statusCode === 200) {
                        const data = JSON.parse(body);
                        if (data.zestimate) {
                            resolve({
                                value: data.zestimate,
                                source: 'Market Data',
                                timestamp: new Date().toISOString()
                            });
                        } else {
                            resolve(null); // No market data available
                        }
                    } else {
                        resolve(null); // Market data not found
                    }
                } catch (e) {
                    resolve(null); // Parsing failed, no market data
                }
            });
        });
        
        req.on('error', () => resolve(null)); // Network error, no market data
        req.on('timeout', () => {
            req.destroy();
            resolve(null); // Timeout, no market data
        });
        
        req.end();
    });
}