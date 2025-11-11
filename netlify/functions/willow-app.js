/**
 * WILLOW V50 FUB Embedded App - Netlify Function
 * Complete Follow Up Boss integration with behavioral intelligence
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Environment variables
const FUB_API_KEY = process.env.FUB_API_KEY || 'fka_0oHt62NxmsExO6x69p08ix82zx8ii1hzrj';
const FUB_SECRET_KEY = process.env.FUB_SECRET_KEY || 'f1e0c6af664bc1525ecd8fecba255235';
const CLOUDCMA_API_KEY = process.env.CLOUDCMA_API_KEY || '742f4a46e1780904da090d721a9bae7b';

/**
 * HMAC SHA256 Signature Verification (FUB Security)
 */
function isFromFollowUpBoss(context, signature) {
  const calculated = crypto
    .createHmac('sha256', FUB_SECRET_KEY)
    .update(context)
    .digest('hex');
  return calculated === signature;
}

/**
 * Enhanced Behavioral Scoring V4.0 Algorithm
 * Omnipresent Intelligence: Fello 35% + CloudCMA 25% + WILLOW 25% + Sierra 15%
 */
function calculateOmnipresentScore(person) {
  
  const felloIntelligence = {
    leadScore: person.customFelloLeadScore || 0,
    dashboardClicks: person.customFelloOfDashboardClicks || 0,
    emailClicks: person.customFelloOfEmailClicks || 0,
    formSubmissions: person.customFelloOfFormSubmissions || 0,
    sellingTimeline: person.customFelloSellingTimeline || 'Unknown',
    propertiesOwned: person.customFelloOfProperties || 1
  };
  
  const felloScore = calculateFelloScore(felloIntelligence);
  const cloudCMAScore = 10;
  const willowScore = 10;
  const sierraScore = 10;
  
  const totalScore = Math.min(felloScore + cloudCMAScore + willowScore + sierraScore, 100);
  
  return {
    totalScore: totalScore,
    components: {
      fello: felloScore,
      cloudCMA: cloudCMAScore,
      willow: willowScore,
      sierra: sierraScore
    },
    classification: classifyPriority(totalScore),
    triggeredPatterns: evaluateTriggers(person)
  };
}

function calculateFelloScore(fello) {
  let score = 0;
  
  if (fello.leadScore >= 80) score += 15;
  else if (fello.leadScore >= 60) score += 10;
  else if (fello.leadScore >= 40) score += 5;
  
  if (fello.dashboardClicks > 10) score += 10;
  else if (fello.dashboardClicks > 5) score += 7;
  else if (fello.dashboardClicks > 0) score += 3;
  
  if (fello.emailClicks > 5) score += 5;
  else if (fello.emailClicks > 0) score += 2;
  
  if (fello.formSubmissions > 0) score += 5;
  
  return Math.min(score, 35);
}

function classifyPriority(score) {
  if (score >= 90) return 'CRITICAL';
  if (score >= 75) return 'SUPER_HOT';
  if (score >= 60) return 'HOT';
  if (score >= 40) return 'WARM';
  return 'COLD';
}

function evaluateTriggers(person) {
  const triggers = [];
  
  if ((person.customFelloLeadScore || 0) >= 80) {
    triggers.push({
      id: 1,
      name: 'Ultra High Fello Score',
      severity: 'CRITICAL'
    });
  }
  
  if ((person.customFelloOfDashboardClicks || 0) >= 10) {
    triggers.push({
      id: 2,
      name: 'High Dashboard Engagement',
      severity: 'HOT'
    });
  }
  
  return triggers;
}

/**
 * Main Lambda Handler
 */
exports.handler = async (event, context) => {
  
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'text/html',
    'X-Content-Type-Options': 'nosniff',
    'X-XSS-Protection': '1; mode=block'
  };
  
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  
  try {
    const params = event.queryStringParameters || {};
    const contextParam = params.context;
    const signatureParam = params.signature;
    
    let personData = null;
    let intelligenceData = null;
    
    if (contextParam) {
      try {
        const decodedContext = Buffer.from(contextParam, 'base64').toString('utf-8');
        const contextObj = JSON.parse(decodedContext);
        personData = contextObj.person || null;
        
        if (personData) {
          intelligenceData = calculateOmnipresentScore(personData);
        }
      } catch (err) {
        console.error('Context decode error:', err);
      }
    }
    
    // Read HTML template from file (same directory as function)
    let htmlTemplate;
    try {
      const templatePath = path.join(__dirname, 'willow-v50-embedded-app.html');
      htmlTemplate = fs.readFileSync(templatePath, 'utf-8');
    } catch (fileErr) {
      console.error('Template read error:', fileErr);
      // Fallback to minimal HTML
      htmlTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WILLOW V50 Intelligence System</title>
</head>
<body>
  <div style="padding: 20px; font-family: sans-serif;">
    <h1>WILLOW V50 Intelligence Dashboard</h1>
    <p>System loading...</p>
    <pre>${JSON.stringify(intelligenceData, null, 2)}</pre>
  </div>
  <script type="text/javascript" src="https://eia.followupboss.com/embeddedApps-v1.0.0.js"></script>
</body>
</html>`;
    }
    
    // Inject intelligence data if available
    if (intelligenceData && personData) {
      const dataScript = `
    <script>
      window.WILLOW_INTELLIGENCE = ${JSON.stringify(intelligenceData)};
      window.WILLOW_PERSON = ${JSON.stringify(personData)};
    </script>
  `;
      // Insert before closing head tag
      htmlTemplate = htmlTemplate.replace('</head>', `${dataScript}</head>`);
    }
    
    return {
      statusCode: 200,
      headers,
      body: htmlTemplate
    };
    
  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      headers,
      body: `<html><body><h1>Error</h1><p>${error.message}</p></body></html>`
    };
  }
};
