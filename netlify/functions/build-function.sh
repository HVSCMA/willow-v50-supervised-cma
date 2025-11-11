#!/bin/bash
cd "$(dirname "$0")"

cat > willow-app.js << 'EOFFUNCTION'
/**
 * WILLOW V50 FUB Embedded App - Netlify Function
 * LAZY LOAD ARCHITECTURE: User clicks button to load intelligence
 * Fixed circular dependency in getMockTriggeredPatterns()
 */

const crypto = require('crypto');
const https = require('https');

const FUB_API_KEY = process.env.FUB_API_KEY || 'fka_0oHt62NxmsExO6x69p08ix82zx8ii1hzrj';
const FUB_SECRET_KEY = process.env.FUB_SECRET_KEY || 'f1e0c6af664bc1525ecd8fecba255235';
const CLOUDCMA_API_KEY = process.env.CLOUDCMA_API_KEY || '742f4a46e1780904da090d721a9bae7b';

const HTML_TEMPLATE_B64 = 'TEMPLATE_PLACEHOLDER';

function fetchFUBPerson(personId) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(FUB_API_KEY + ':').toString('base64');
    const options = {
      hostname: 'api.followupboss.com',
      path: "/v1/people/" + personId,
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
          reject(new Error("FUB API returned status " + res.statusCode));
        }
      });
    });
    
    req.on('error', reject);
    req.end();
  });
}

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
    components: { fello: felloScore, cloudCMA: cloudCMAScore, willow: willowScore, sierra: sierraScore },
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
    triggers.push({ id: 1, name: 'Ultra High Fello Score', severity: 'CRITICAL' });
  }
  if ((person.customFelloOfDashboardClicks || 0) >= 10) {
    triggers.push({ id: 2, name: 'High Dashboard Engagement', severity: 'HOT' });
  }
  return triggers;
}

exports.handler = async (event, context) => {
  console.log('WILLOW Function invoked (Lazy-Load, Fixed Circular Dependency)');
  
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
    
    let personData = null;
    let intelligenceData = null;
    
    if (contextParam) {
      try {
        const decodedContext = Buffer.from(contextParam, 'base64').toString('utf-8');
        const contextObj = JSON.parse(decodedContext);
        const basicPersonData = contextObj.person || null;
        
        if (basicPersonData && basicPersonData.id) {
          console.log('Fetching full person record from FUB API for person ID:', basicPersonData.id);
          try {
            personData = await fetchFUBPerson(basicPersonData.id);
            console.log('FUB API: Person fetched successfully with', Object.keys(personData).length, 'fields');
            intelligenceData = calculateOmnipresentScore(personData);
            console.log('Intelligence calculated from FUB data:', intelligenceData.totalScore);
          } catch (apiError) {
            console.error('FUB API fetch error:', apiError.message);
            personData = basicPersonData;
            intelligenceData = calculateOmnipresentScore(personData);
            console.log('Fallback to basic context data, score:', intelligenceData.totalScore);
          }
        }
      } catch (err) {
        console.error('Context decode error:', err);
      }
    }
    
    let htmlTemplate = Buffer.from(HTML_TEMPLATE_B64, 'base64').toString('utf-8');
    
    if (intelligenceData && personData) {
      const dataScript = "<script>window.WILLOW_INTELLIGENCE=" + JSON.stringify(intelligenceData) + ";window.WILLOW_PERSON=" + JSON.stringify(personData) + ";</script>";
      htmlTemplate = htmlTemplate.replace('</head>', dataScript + '</head>');
    }
    
    return { statusCode: 200, headers, body: htmlTemplate };
    
  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      headers,
      body: "<html><body><h1>Server Error</h1><p>" + error.message + "</p></body></html>"
    };
  }
};
EOFFUNCTION

# Replace placeholder with actual Base64 (single-line version to avoid JavaScript syntax errors)
sed -i "s|TEMPLATE_PLACEHOLDER|$(cat template-fixed-oneline.b64)|" willow-app.js

echo "✓ Function rebuilt with fixed template ($(wc -c < willow-app.js) bytes)"
