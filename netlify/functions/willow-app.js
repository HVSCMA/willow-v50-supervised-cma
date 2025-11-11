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
  
  // Extract intelligence from all systems
  const felloIntelligence = {
    leadScore: person.customFelloLeadScore || 0,
    dashboardClicks: person.customFelloOfDashboardClicks || 0,
    emailClicks: person.customFelloOfEmailClicks || 0,
    formSubmissions: person.customFelloOfFormSubmissions || 0,
    sellingTimeline: person.customFelloSellingTimeline || 'Unknown',
    propertiesOwned: person.customFelloOfProperties || 1
  };
  
  const cloudCMAIntelligence = {
    cmaViews: person.customWILLOWCMAViews || 0,
    cmaDownloads: person.customWILLOWCMADownloads || 0,
    cmaShares: person.customWILLOWCMAShares || 0,
    mlsLastQuery: person.customWILLOWMLSLastQuery,
    comparableCount: person.customWILLOWMLSComparableCount || 0
  };
  
  const willowIntelligence = {
    hotScore: person.customWILLOWHotScore || 0,
    centerValue: person.customWILLOWCenterValue || 0,
    cmaDate: person.customWILLOWCMADate,
    priorityLevel: person.customWILLOWPriorityLevel || 'COLD'
  };
  
  // Calculate component scores
  const felloScore = calculateFelloScore(felloIntelligence);      // 0-35
  const cloudCMAScore = calculateCloudCMAScore(cloudCMAIntelligence); // 0-25  
  const willowScore = calculateWILLOWScore(willowIntelligence);   // 0-25
  const sierraScore = 10; // Base Sierra score (0-15)
  
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
    triggeredPatterns: evaluateTriggerPatterns(person, felloIntelligence, cloudCMAIntelligence)
  };
}

function calculateFelloScore(felloData) {
  let score = 0;
  
  // Fello Lead Score Direct (0-100 → 0-15 points)
  score += (felloData.leadScore * 0.15);
  
  // Dashboard Engagement (0-20 points)
  if (felloData.dashboardClicks >= 5) score += 20;
  else if (felloData.dashboardClicks >= 3) score += 15;
  else if (felloData.dashboardClicks >= 1) score += 10;
  
  // Timeline Urgency (0-10 points)
  if (felloData.sellingTimeline === 'ASAP') score += 10;
  else if (felloData.sellingTimeline === 'Less than 3 months') score += 7;
  else if (felloData.sellingTimeline === '3-6 months') score += 3;
  
  // Form Submissions (0-5 points)
  score += Math.min(felloData.formSubmissions * 2, 5);
  
  // Properties Owned (Investor Detection) (0-5 points)
  if (felloData.propertiesOwned >= 3) score += 5;
  else if (felloData.propertiesOwned >= 2) score += 3;
  
  return Math.min(score, 35);
}

function calculateCloudCMAScore(cloudCMAData) {
  let score = 0;
  
  // CMA Engagement (0-20 points)
  if (cloudCMAData.cmaViews >= 3) score += 15;
  else if (cloudCMAData.cmaViews >= 1) score += 10;
  
  if (cloudCMAData.cmaDownloads >= 1) score += 10;
  if (cloudCMAData.cmaShares >= 1) score += 5;
  
  return Math.min(score, 25);
}

function calculateWILLOWScore(willowData) {
  return Math.min(willowData.hotScore * 0.25, 25);
}

function classifyPriority(score) {
  if (score >= 95) return 'CRITICAL';
  if (score >= 85) return 'SUPER_HOT';
  if (score >= 70) return 'HOT';
  if (score >= 40) return 'WARM';
  return 'COLD';
}

function evaluateTriggerPatterns(person, felloData, cloudCMAData) {
  const patterns = [];
  
  // Pattern 12: Omnipresent Intelligence Consensus
  const totalEngagement = (felloData.dashboardClicks || 0) + (cloudCMAData.cmaViews || 0) + (felloData.formSubmissions || 0);
  if (totalEngagement >= 5) {
    patterns.push({
      id: 12,
      name: 'Omnipresent Intelligence Consensus',
      icon: '🎯',
      description: 'Multiple systems indicate high conversion probability',
      conversionRate: 98,
      priority: 'CRITICAL'
    });
  }
  
  // Pattern 2: Dashboard Activity Spike
  if (felloData.dashboardClicks >= 3) {
    patterns.push({
      id: 2,
      name: 'Dashboard Activity Spike',
      icon: '📊',
      description: 'Multiple property dashboard views indicate seller intent',
      conversionRate: 92,
      priority: 'HIGH'
    });
  }
  
  // Pattern 3: Form Submission Velocity
  if (felloData.formSubmissions >= 1) {
    patterns.push({
      id: 3,
      name: 'Form Submission Intent',
      icon: '📝',
      description: 'Direct form submissions indicate immediate interest',
      conversionRate: 95,
      priority: 'CRITICAL'
    });
  }
  
  return patterns;
}

/**
 * Netlify Function Handler
 */
exports.handler = async (event, context) => {
  
  // CRITICAL: Set CORS headers for FUB compliance
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'text/html',
    'X-Content-Type-Options': 'nosniff',
    'X-XSS-Protection': '1; mode=block'
    // CRITICAL: NO X-Frame-Options header (causes FUB failure)
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
    // Extract FUB parameters
    const params = event.queryStringParameters || {};
    const contextParam = params.context;
    const signatureParam = params.signature;
    const debugState = params.debugState;
    
    // Verify FUB signature (unless in debug mode)
    if (signatureParam && !debugState) {
      if (!isFromFollowUpBoss(contextParam, signatureParam)) {
        return {
          statusCode: 403,
          headers,
          body: '<html><body><h1>Unauthorized</h1><p>Invalid signature</p></body></html>'
        };
      }
    }
    
    // Decode context
    let personData = null;
    let accountData = null;
    let userData = null;
    
    if (contextParam) {
      try {
        const decodedContext = Buffer.from(contextParam, 'base64').toString('utf-8');
        const contextObj = JSON.parse(decodedContext);
        personData = contextObj.person || null;
        accountData = contextObj.account || null;
        userData = contextObj.user || null;
      } catch (err) {
        console.error('Context decode error:', err);
      }
    }
    
    // Calculate behavioral intelligence if person data available
    let intelligenceData = null;
    if (personData) {
      intelligenceData = calculateOmnipresentScore(personData);
    }
    
    // Load HTML template
    const htmlPath = path.join(__dirname, '..', '..', 'willow-v50-embedded-app.html');
    let html = fs.readFileSync(htmlPath, 'utf-8');
    
    // Inject intelligence data into HTML
    if (intelligenceData) {
      const intelligenceScript = `
        <script>
          window.WILLOW_INTELLIGENCE = ${JSON.stringify(intelligenceData)};
          window.WILLOW_PERSON = ${JSON.stringify(personData)};
          window.WILLOW_ACCOUNT = ${JSON.stringify(accountData)};
          window.WILLOW_USER = ${JSON.stringify(userData)};
        </script>
      `;
      html = html.replace('</head>', intelligenceScript + '</head>');
    }
    
    return {
      statusCode: 200,
      headers,
      body: html
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
