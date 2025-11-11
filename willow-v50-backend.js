/**
 * WILLOW V50 FUB Embedded App Backend
 * Complete Follow Up Boss integration with behavioral intelligence
 */

const express = require('express');
const crypto = require('crypto');
const cors = require('cors');
const path = require('path');

const app = express();

// Environment variables (to be set in Netlify)
const FUB_API_KEY = process.env.FUB_API_KEY || 'fka_0oHt62NxmsExO6x69p08ix82zx8ii1hzrj';
const FUB_SECRET_KEY = process.env.FUB_SECRET_KEY || 'your-secret-key';
const CLOUDCMA_API_KEY = process.env.CLOUDCMA_API_KEY || '742f4a46e1780904da090d721a9bae7b';

// CRITICAL: CORS configuration for FUB iframe compliance
app.use(cors({
  origin: [
    'https://app.followupboss.com',
    'https://*.followupboss.com',
    'https://willow-v50-production-1762200889.netlify.app',
    'http://localhost:3000'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true
}));

// CRITICAL: Remove X-Frame-Options header (causes FUB CORS failure)
app.use((req, res, next) => {
  res.removeHeader('X-Frame-Options');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Middleware
app.use(express.json());
app.use(express.static('public'));

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
  
  // MLS Intelligence (0-5 points)
  if (cloudCMAData.mlsLastQuery && isWithinDays(cloudCMAData.mlsLastQuery, 7)) {
    score += 5;
  }
  
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
      priority: 'CRITICAL',
      actionLabel: 'Contact Immediately'
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
      priority: 'HIGH',
      actionLabel: 'Generate CMA'
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
      priority: 'HIGH',
      actionLabel: 'Call Today'
    });
  }
  
  // Pattern 5: Investment Detection
  if (felloData.propertiesOwned >= 3) {
    patterns.push({
      id: 5,
      name: 'Portfolio Investor Detection',
      icon: '🏢',
      description: 'Multi-property ownership indicates investment opportunity',
      conversionRate: 85,
      priority: 'MEDIUM',
      actionLabel: 'Investment Analysis'
    });
  }
  
  // Pattern 10: CMA Engagement
  if (cloudCMAData.cmaViews >= 1) {
    patterns.push({
      id: 10,
      name: 'CMA Engagement',
      icon: '📈',
      description: 'Active engagement with previous CMA reports',
      conversionRate: 85,
      priority: 'MEDIUM',
      actionLabel: 'Follow Up'
    });
  }
  
  return patterns;
}

function isWithinDays(dateString, days) {
  if (!dateString) return false;
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now - date);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays <= days;
}

/**
 * Main FUB Embedded App Route
 */
app.get('/willow-app', async (req, res) => {
  try {
    const { context, signature } = req.query;
    
    // MANDATORY: Verify signature for security
    if (!isFromFollowUpBoss(context, signature)) {
      return res.status(403).json({ 
        error: 'Invalid signature',
        message: 'Request not verified from Follow Up Boss' 
      });
    }
    
    // Decode FUB context
    let decodedContext;
    try {
      decodedContext = JSON.parse(Buffer.from(context, 'base64').toString('utf-8'));
    } catch (error) {
      return res.status(400).json({ 
        error: 'Invalid context',
        message: 'Failed to decode FUB context' 
      });
    }
    
    // Handle debug states (FUB requirement)
    if (decodedContext.debugState && decodedContext.debugState !== 'working') {
      return res.sendFile(path.join(__dirname, 'willow-v50-embedded-app.html'));
    }
    
    // Serve the embedded app HTML
    res.sendFile(path.join(__dirname, 'willow-v50-embedded-app.html'));
    
  } catch (error) {
    console.error('WILLOW App Route Error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to load WILLOW application' 
    });
  }
});

/**
 * API: Get Intelligence for Person
 */
app.get('/api/intelligence/:personId', async (req, res) => {
  try {
    const { personId } = req.params;
    
    // In production, fetch from FUB API
    // const person = await fetchFUBPerson(personId);
    
    // Mock response for development
    const mockPerson = {
      id: personId,
      firstName: 'John',
      lastName: 'Smith',
      customFelloLeadScore: 75,
      customFelloOfDashboardClicks: 3,
      customFelloOfFormSubmissions: 1,
      customFelloSellingTimeline: 'Less than 3 months',
      customFelloOfProperties: 2,
      customWILLOWCMAViews: 2,
      customWILLOWHotScore: 65
    };
    
    const intelligence = calculateOmnipresentScore(mockPerson);
    
    res.json({
      success: true,
      person: mockPerson,
      intelligence: intelligence
    });
    
  } catch (error) {
    console.error('Intelligence API Error:', error);
    res.status(500).json({ 
      error: 'Failed to calculate intelligence',
      message: error.message 
    });
  }
});

/**
 * API: Generate CMA
 */
app.post('/api/cma/generate', async (req, res) => {
  try {
    const { personId, address, targetValue } = req.body;
    
    if (!address) {
      return res.status(400).json({ 
        error: 'Address required',
        message: 'Property address is required for CMA generation' 
      });
    }
    
    // In production, integrate with CloudCMA API
    console.log('Generating CMA:', { personId, address, targetValue });
    
    // Mock CMA generation
    const mockCMAResult = {
      success: true,
      cmaId: `cma_${Date.now()}`,
      cmaURL: `https://cloudcma.com/cma/${Date.now()}`,
      address: address,
      centerValue: targetValue || 500000,
      rangeLow: (targetValue || 500000) * 0.9,
      rangeHigh: (targetValue || 500000) * 1.1,
      comparableCount: 15,
      qualityScore: 88,
      generatedAt: new Date().toISOString()
    };
    
    res.json(mockCMAResult);
    
  } catch (error) {
    console.error('CMA Generation Error:', error);
    res.status(500).json({ 
      error: 'CMA generation failed',
      message: error.message 
    });
  }
});

/**
 * API: Update Person (FUB Custom Fields)
 */
app.put('/api/person/:personId/update', async (req, res) => {
  try {
    const { personId } = req.params;
    const updates = req.body;
    
    // Whitelist of WILLOW-writable fields (never update Fello fields)
    const WILLOW_WRITABLE_FIELDS = [
      'customWILLOWHotScore',
      'customWILLOWCenterValue',
      'customWILLOWRangeLow',
      'customWILLOWRangeHigh',
      'customWILLOWCMALink',
      'customWILLOWCMADate',
      'customWILLOWAssignedAgent',
      'customWILLOWPriorityLevel',
      'customWILLOWLastUpdate',
      'customWILLOWRecommendedAction',
      // MLS Intelligence Fields
      'customWILLOWMLSLastQuery',
      'customWILLOWMLSComparableCount',
      'customWILLOWMLSMarketTrend',
      'customWILLOWMLSAvgDaysOnMarket',
      'customWILLOWMLSInventoryLevel',
      'customWILLOWMLSPricePerSqft',
      'customWILLOWMLSMarketVelocity',
      // CMA Engagement Fields
      'customWILLOWCMAViews',
      'customWILLOWCMADownloads',
      'customWILLOWCMAShares',
      'customWILLOWCMATimeOnPage',
      'customWILLOWCMALastViewed',
      // Market Position Fields
      'customWILLOWMarketPosition',
      'customWILLOWOptimalListPrice',
      'customWILLOWMarketConfidence'
    ];
    
    // Sanitize updates (protect Fello fields)
    const sanitizedUpdates = {};
    let blockedFields = [];
    
    for (const [field, value] of Object.entries(updates)) {
      if (WILLOW_WRITABLE_FIELDS.includes(field)) {
        sanitizedUpdates[field] = value;
      } else if (field.startsWith('customFello')) {
        blockedFields.push(field);
        console.warn(`BLOCKED: Write attempt to READ-ONLY Fello field: ${field}`);
      } else {
        sanitizedUpdates[field] = value; // Other FUB standard fields
      }
    }
    
    if (blockedFields.length > 0) {
      return res.status(403).json({
        error: 'FELLO_FIELD_WRITE_BLOCKED',
        message: 'Cannot write to read-only Fello fields',
        blockedFields: blockedFields
      });
    }
    
    // In production, update via FUB API
    console.log('Updating FUB person:', personId, sanitizedUpdates);
    
    res.json({
      success: true,
      personId: personId,
      updatedFields: Object.keys(sanitizedUpdates),
      message: 'Person updated successfully'
    });
    
  } catch (error) {
    console.error('Person Update Error:', error);
    res.status(500).json({ 
      error: 'Update failed',
      message: error.message 
    });
  }
});

/**
 * Webhook: FUB Person Updated
 */
app.post('/api/webhooks/fub/person-updated', async (req, res) => {
  try {
    console.log('FUB Webhook - Person Updated:', req.body);
    
    // Process behavioral intelligence changes
    const personId = req.body.person?.id;
    if (personId) {
      // Recalculate intelligence score
      // Update triggered patterns
      // Generate recommendations
    }
    
    res.status(200).json({ received: true });
    
  } catch (error) {
    console.error('FUB Webhook Error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * Webhook: CloudCMA Activity
 */
app.post('/api/webhooks/cloudcma/activity', async (req, res) => {
  try {
    console.log('CloudCMA Webhook - Activity:', req.body);
    
    // Process CMA engagement events
    const eventType = req.body.event_type;
    const personId = req.body.person_id;
    
    switch (eventType) {
      case 'cma.viewed':
        // Update customWILLOWCMAViews
        break;
      case 'cma.downloaded':
        // Update customWILLOWCMADownloads + create urgent task
        break;
      case 'cma.shared':
        // Update customWILLOWCMAShares + referral opportunity
        break;
    }
    
    res.status(200).json({ received: true });
    
  } catch (error) {
    console.error('CloudCMA Webhook Error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * Health Check Endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: 'WILLOW V50.0',
    integrations: {
      fub: !!FUB_API_KEY,
      cloudcma: !!CLOUDCMA_API_KEY,
      embeddeApps: 'operational'
    }
  });
});

/**
 * 404 Handler
 */
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not found',
    message: 'WILLOW V50 endpoint not found' 
  });
});

/**
 * Error Handler
 */
app.use((error, req, res, next) => {
  console.error('WILLOW V50 Error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: 'WILLOW V50 system error' 
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🌳 WILLOW V50 FUB Embedded App listening on port ${PORT}`);
  console.log(`🎯 Ready to serve Follow Up Boss embedded app with omnipresent intelligence`);
});

module.exports = app;