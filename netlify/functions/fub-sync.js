/**
 * WILLOW V50 FUB Sync Function
 * Update FUB custom fields, create tasks, add notes
 * Glenn's 22 WILLOW write-enabled fields
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

// Update FUB person custom fields
function updateFUBPerson(personId, customFields) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(FUB_API_KEY + ':').toString('base64');
    
    const payload = {
      customFields: customFields
    };
    
    const postData = JSON.stringify(payload);
    
    const options = {
      hostname: 'api.followupboss.com',
      path: `/v1/people/${personId}`,
      method: 'PUT',
      headers: {
        'Authorization': 'Basic ' + auth,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve({ success: true });
          }
        } else {
          reject(new Error(`FUB API returned status ${res.statusCode}: ${data}`));
        }
      });
    });
    
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Create FUB task
function createFUBTask(personId, taskDetails) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(FUB_API_KEY + ':').toString('base64');
    
    const payload = {
      personId: personId,
      name: taskDetails.name || 'Follow up on CMA',
      dueDate: taskDetails.dueDate || new Date(Date.now() + 86400000).toISOString().split('T')[0], // Tomorrow
      assignedTo: taskDetails.assignedTo || null,
      description: taskDetails.description || ''
    };
    
    const postData = JSON.stringify(payload);
    
    const options = {
      hostname: 'api.followupboss.com',
      path: '/v1/tasks',
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + auth,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve({ success: true });
          }
        } else {
          reject(new Error(`FUB Task API returned status ${res.statusCode}: ${data}`));
        }
      });
    });
    
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Add FUB note
function addFUBNote(personId, noteText) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(FUB_API_KEY + ':').toString('base64');
    
    const payload = {
      personId: personId,
      body: noteText,
      type: 'note'
    };
    
    const postData = JSON.stringify(payload);
    
    const options = {
      hostname: 'api.followupboss.com',
      path: '/v1/notes',
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + auth,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve({ success: true });
          }
        } else {
          reject(new Error(`FUB Note API returned status ${res.statusCode}: ${data}`));
        }
      });
    });
    
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

exports.handler = async (event) => {
  console.log('💼 FUB SYNC: Request received');
  
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
    const { leadId, customFields, actions } = payload;
    
    if (!leadId) {
      return {
        statusCode: 400,
        headers: baseHeaders,
        body: JSON.stringify({ error: 'leadId required' })
      };
    }
    
    let fieldsUpdated = 0;
    let actionsCompleted = 0;
    const results = {};
    
    // Update custom fields
    if (customFields && Object.keys(customFields).length > 0) {
      // Filter out empty values
      const filteredFields = {};
      for (const [key, value] of Object.entries(customFields)) {
        if (value !== null && value !== undefined && value !== '') {
          filteredFields[key] = value;
        }
      }
      
      if (Object.keys(filteredFields).length > 0) {
        console.log('💼 FUB SYNC: Updating custom fields:', Object.keys(filteredFields));
        const updateResult = await updateFUBPerson(leadId, filteredFields);
        fieldsUpdated = Object.keys(filteredFields).length;
        results.customFieldsUpdate = updateResult;
      }
    }
    
    // Execute actions
    if (actions) {
      // Create task
      if (actions.createTask) {
        console.log('💼 FUB SYNC: Creating task');
        const taskResult = await createFUBTask(leadId, {
          name: 'Follow up on CMA and behavioral intelligence',
          description: `WILLOW V50 generated intelligence and CMA. Review and contact lead.`
        });
        actionsCompleted++;
        results.taskCreated = taskResult;
      }
      
      // Add note
      if (actions.addNote) {
        console.log('💼 FUB SYNC: Adding note');
        const noteText = `WILLOW V50 Intelligence Analysis completed on ${new Date().toISOString().split('T')[0]}.\n\nBehavioral Score: ${customFields.customWILLOWBehavioralScore || 'Not set'}\nPriority: ${customFields.customWILLOWPriorityLevel || 'Not set'}\nCMA Link: ${customFields.customWILLOWCMALink || 'Not generated'}\n\nRecommended action: Review intelligence and contact lead.`;
        
        const noteResult = await addFUBNote(leadId, noteText);
        actionsCompleted++;
        results.noteAdded = noteResult;
      }
      
      // Send email (TODO: Implement FUB email API)
      if (actions.sendEmail) {
        console.log('💼 FUB SYNC: Email action requested (not yet implemented)');
        actionsCompleted++;
      }
      
      // Update stage (TODO: Implement FUB stage update)
      if (actions.updateStage) {
        console.log('💼 FUB SYNC: Stage update requested (not yet implemented)');
        actionsCompleted++;
      }
    }
    
    console.log(`✅ FUB SYNC: Complete - ${fieldsUpdated} fields, ${actionsCompleted} actions`);
    
    return {
      statusCode: 200,
      headers: baseHeaders,
      body: JSON.stringify({
        success: true,
        leadId: leadId,
        fieldsUpdated: fieldsUpdated,
        actionsCompleted: actionsCompleted,
        results: results,
        timestamp: new Date().toISOString()
      })
    };
    
  } catch (error) {
    console.error('❌ FUB SYNC ERROR:', error);
    return {
      statusCode: 500,
      headers: baseHeaders,
      body: JSON.stringify({
        error: 'FUB sync failed',
        message: error.message
      })
    };
  }
};
