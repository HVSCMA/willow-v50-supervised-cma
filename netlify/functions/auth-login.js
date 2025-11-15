/**
 * WILLOW V50 Authentication System
 * JWT-based login with role-based access control
 * Admin: Glenn (full access)
 * Agents: Justin, Heather, Lloyd (limited access)
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// JWT Secret (store in Netlify env vars for production)
const JWT_SECRET = process.env.JWT_SECRET || 'WILLOW_V50_SECRET_CHANGE_IN_PRODUCTION_2025';

// User database with roles
// Password hashes generated with: echo -n "password" | sha256sum
const USERS = {
  'glenn': {
    passwordHash: process.env.GLENN_PASSWORD_HASH || '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8', // "password" for testing
    role: 'admin',
    name: 'Glenn Fitzgerald',
    email: 'glenn@hudsonvalleysold.com',
    permissions: ['view_all', 'generate_cma', 'edit_leads', 'bulk_operations', 'system_settings']
  },
  'justin': {
    passwordHash: process.env.JUSTIN_PASSWORD_HASH || '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
    role: 'agent',
    name: 'Justin Partner',
    email: 'justin@hudsonvalleysold.com',
    permissions: ['view_assigned', 'generate_cma']
  },
  'heather': {
    passwordHash: process.env.HEATHER_PASSWORD_HASH || '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
    role: 'agent',
    name: 'Heather Partner',
    email: 'heather@hudsonvalleysold.com',
    permissions: ['view_assigned', 'generate_cma']
  },
  'lloyd': {
    passwordHash: process.env.LLOYD_PASSWORD_HASH || '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
    role: 'agent',
    name: 'Lloyd Partner',
    email: 'lloyd@hudsonvalleysold.com',
    permissions: ['view_assigned', 'generate_cma']
  }
};

exports.handler = async (event) => {
  console.log('🔐 AUTH: Login attempt');
  
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
  
  try {
    const { username, password } = JSON.parse(event.body);
    
    if (!username || !password) {
      return {
        statusCode: 400,
        headers: baseHeaders,
        body: JSON.stringify({ error: 'Username and password required' })
      };
    }
    
    // Hash submitted password
    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
    
    console.log('🔐 AUTH: Checking user:', username);
    
    // Verify credentials
    const user = USERS[username.toLowerCase()];
    
    if (!user) {
      console.log('❌ AUTH: User not found:', username);
      return {
        statusCode: 401,
        headers: baseHeaders,
        body: JSON.stringify({ error: 'Invalid credentials' })
      };
    }
    
    if (user.passwordHash !== passwordHash) {
      console.log('❌ AUTH: Invalid password for user:', username);
      return {
        statusCode: 401,
        headers: baseHeaders,
        body: JSON.stringify({ error: 'Invalid credentials' })
      };
    }
    
    // Generate JWT token (expires in 24 hours)
    const token = jwt.sign(
      {
        username: username.toLowerCase(),
        role: user.role,
        name: user.name,
        email: user.email,
        permissions: user.permissions,
        iat: Math.floor(Date.now() / 1000)
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    console.log('✅ AUTH: Login successful for:', user.name, '(', user.role, ')');
    
    // Log audit trail
    const auditLog = {
      timestamp: new Date().toISOString(),
      action: 'login',
      username: username.toLowerCase(),
      role: user.role,
      ip: event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown'
    };
    
    console.log('📊 AUDIT:', JSON.stringify(auditLog));
    
    return {
      statusCode: 200,
      headers: baseHeaders,
      body: JSON.stringify({
        success: true,
        token,
        user: {
          username: username.toLowerCase(),
          name: user.name,
          email: user.email,
          role: user.role,
          permissions: user.permissions
        }
      })
    };
    
  } catch (error) {
    console.error('❌ AUTH ERROR:', error);
    return {
      statusCode: 500,
      headers: baseHeaders,
      body: JSON.stringify({ error: 'Authentication system error' })
    };
  }
};

// Export verifyToken function for use in other functions
exports.verifyToken = function(authHeader) {
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
};

// Export JWT_SECRET for use in other functions
exports.JWT_SECRET = JWT_SECRET;
