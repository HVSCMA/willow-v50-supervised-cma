// WILLOW V50 - Generate Transition Token
// Creates short-lived JWT for transitioning from FUB embedded to standalone

const jwt = require('jsonwebtoken');

exports.handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };
  
  // Handle OPTIONS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }
  
  try {
    // Parse request body
    const { leadId, userId, context } = JSON.parse(event.body);
    
    if (!leadId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Missing required parameter: leadId'
        })
      };
    }
    
    // Get JWT secret
    const JWT_SECRET = process.env.JWT_SECRET;
    
    if (!JWT_SECRET) {
      console.error('JWT_SECRET not configured');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'Server configuration error'
        })
      };
    }
    
    // Generate short-lived transition token (5 minutes expiry)
    const token = jwt.sign(
      {
        leadId,
        userId: userId || null,
        context: context || 'transition',
        purpose: 'embedded_to_standalone_transition',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (5 * 60) // 5 minutes
      },
      JWT_SECRET
    );
    
    console.log('Transition token generated', {
      leadId,
      userId,
      expiresIn: '5 minutes',
      timestamp: new Date().toISOString()
    });
    
    // Return token
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        token,
        expiresIn: 300, // seconds
        leadId
      })
    };
    
  } catch (error) {
    console.error('Transition token generation error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to generate transition token',
        message: error.message
      })
    };
  }
};
