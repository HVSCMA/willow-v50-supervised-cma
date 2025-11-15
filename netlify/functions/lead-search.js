/**
 * WILLOW V50 Lead Search Function
 * Search FUB leads by name, email, phone, or custom fields
 * Supports pagination and filtering
 */

const https = require('https');
const jwt = require('jsonwebtoken');

const FUB_API_KEY = process.env.FUB_API_KEY || 'fka_0oHt62NxmsExO6x69p08ix82zx8ii1hzrj';
const JWT_SECRET = process.env.JWT_SECRET || 'WILLOW_V50_SECRET_CHANGE_IN_PRODUCTION_2025';

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
    if (error.name === 'TokenExpiredError') {
      return { valid: false, error: 'Token expired' };
    }
    return { valid: false, error: 'Invalid token' };
  }
}

// Search FUB people
function searchFUBPeople(query, limit = 20) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(FUB_API_KEY + ':').toString('base64');
    
    // Build query parameters
    let path = `/v1/people?limit=${limit}`;
    if (query.name) path += `&name=${encodeURIComponent(query.name)}`;
    if (query.email) path += `&email=${encodeURIComponent(query.email)}`;
    if (query.phone) path += `&phone=${encodeURIComponent(query.phone)}`;
    
    const options = {
      hostname: 'api.followupboss.com',
      path: path,
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
            const parsed = JSON.parse(data);
            resolve(parsed.people || parsed);
          } catch (e) {
            reject(new Error('Failed to parse FUB search response'));
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

// Get person by ID
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
            reject(new Error('Failed to parse FUB API response'));
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

exports.handler = async (event) => {
  console.log('🔍 LEAD SEARCH: Request received');
  
  const baseHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };
  
  // Handle CORS
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: baseHeaders, body: '' };
  }
  
  // Verify authentication
  const auth = verifyToken(event.headers.authorization || event.headers.Authorization);
  
  if (!auth.valid) {
    console.log('❌ LEAD SEARCH: Unauthorized -', auth.error);
    return {
      statusCode: 401,
      headers: baseHeaders,
      body: JSON.stringify({ error: auth.error })
    };
  }
  
  console.log('✅ LEAD SEARCH: Authenticated user:', auth.user.name);
  
  try {
    const params = event.queryStringParameters || {};
    
    // Direct ID lookup
    if (params.id) {
      console.log('🔍 LEAD SEARCH: Fetching person by ID:', params.id);
      const person = await getFUBPerson(params.id);
      return {
        statusCode: 200,
        headers: baseHeaders,
        body: JSON.stringify({ success: true, results: [person], count: 1 })
      };
    }
    
    // Search by name/email/phone
    const query = {
      name: params.name || null,
      email: params.email || null,
      phone: params.phone || null
    };
    
    if (!query.name && !query.email && !query.phone) {
      return {
        statusCode: 400,
        headers: baseHeaders,
        body: JSON.stringify({ error: 'Provide name, email, phone, or id parameter' })
      };
    }
    
    console.log('🔍 LEAD SEARCH: Searching with query:', query);
    const results = await searchFUBPeople(query, params.limit || 20);
    
    console.log('✅ LEAD SEARCH: Found', results.length, 'results');
    
    // Filter by role permissions
    let filteredResults = results;
    if (auth.user.role === 'agent' && !auth.user.permissions.includes('view_all')) {
      // Agents can only see their assigned leads (implement based on assignment field)
      filteredResults = results.filter(person => {
        // TODO: Check if person is assigned to this agent
        return true; // For now, show all
      });
    }
    
    return {
      statusCode: 200,
      headers: baseHeaders,
      body: JSON.stringify({
        success: true,
        results: filteredResults,
        count: filteredResults.length,
        query: query
      })
    };
    
  } catch (error) {
    console.error('❌ LEAD SEARCH ERROR:', error);
    return {
      statusCode: 500,
      headers: baseHeaders,
      body: JSON.stringify({ error: error.message })
    };
  }
};
