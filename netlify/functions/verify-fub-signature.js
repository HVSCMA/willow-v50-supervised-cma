// WILLOW V50 - FUB Signature Verification
// Verifies HMAC SHA256 signature from Follow Up Boss embedded app context

const crypto = require('crypto');

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
    const { context, signature } = JSON.parse(event.body);
    
    if (!context || !signature) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          valid: false,
          error: 'Missing context or signature parameter'
        })
      };
    }
    
    // Get FUB embedded app secret from environment
    const SECRET_KEY = process.env.FUB_EMBEDDED_APP_SECRET;
    
    if (!SECRET_KEY) {
      console.error('FUB_EMBEDDED_APP_SECRET not configured');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          valid: false,
          error: 'Server configuration error'
        })
      };
    }
    
    // Calculate HMAC SHA256 signature
    const calculated = crypto
      .createHmac('sha256', SECRET_KEY)
      .update(context)
      .digest('hex');
    
    // Compare signatures (constant-time comparison to prevent timing attacks)
    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature, 'utf8'),
      Buffer.from(calculated, 'utf8')
    );
    
    if (!isValid) {
      console.warn('Invalid FUB signature detected', {
        received: signature.substring(0, 10) + '...',
        calculated: calculated.substring(0, 10) + '...'
      });
      
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({
          valid: false,
          error: 'Invalid signature'
        })
      };
    }
    
    // Decode and parse context to extract lead ID
    let leadId = null;
    try {
      const contextJSON = Buffer.from(context, 'base64').toString('utf-8');
      const contextData = JSON.parse(contextJSON);
      leadId = contextData.person?.id || null;
    } catch (parseError) {
      console.error('Failed to parse context:', parseError);
    }
    
    // Log successful verification
    console.log('FUB signature verified successfully', {
      leadId,
      accountId: extractAccountId(context),
      timestamp: new Date().toISOString()
    });
    
    // Return success
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        valid: true,
        leadId,
        timestamp: new Date().toISOString()
      })
    };
    
  } catch (error) {
    console.error('FUB signature verification error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        valid: false,
        error: 'Internal server error',
        message: error.message
      })
    };
  }
};

// Helper: Extract account ID from context (for logging)
function extractAccountId(contextB64) {
  try {
    const json = Buffer.from(contextB64, 'base64').toString('utf-8');
    const data = JSON.parse(json);
    return data.account?.id || null;
  } catch {
    return null;
  }
}
