// WILLOW V50 - REAL BEHAVIORAL SCORING V4.0
// Replaces mock data with actual FUB API integration
// Enhanced Behavioral Scoring using 63 FUB custom fields

const FUB_API_KEY = 'fka_0oHt62NxmsExO6x69p08ix82zx8ii1hzrj';
const FUB_BASE_URL = 'https://api.followupboss.com/v1';

// ============================================================================
// HELPER: FUB API REQUEST
// ============================================================================
async function fetchFUBPerson(personId) {
  const auth = Buffer.from(`${FUB_API_KEY}:`).toString('base64');
  
  try {
    const response = await fetch(`${FUB_BASE_URL}/people/${personId}?fields=allFields`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'X-System': 'WILLOW_V50',
        'X-System-Key': 'behavioral-scoring-v4',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.error(`❌ FUB API Error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    console.log(`✅ FUB Person Data Retrieved: ${personId}`);
    return data;
    
  } catch (error) {
    console.error(`❌ FUB API Exception:`, error);
    return null;
  }
}

// ============================================================================
// FELLO INTELLIGENCE SCORING (35% WEIGHT)
// ============================================================================
function calculateFelloScore(person) {
  let score = 0;
  
  console.log('📊 Fello Fields:', {
    leadScore: person.customFelloLeadScore,
    emailClicks: person.customFelloOfEmailClicks,
    dashboardClicks: person.customFelloOfDashboardClicks,
    formSubmissions: person.customFelloOfFormSubmissions,
    timeline: person.customFelloSellingTimeline,
    lastEmailClick: person.customFelloLastEmailClickDate,
    lastLeadType: person.customFelloLastLeadType
  });

  // Fello Lead Score (0-100 direct mapping) - 40% of Fello score
  if (person.customFelloLeadScore) {
    const felloScore = parseFloat(person.customFelloLeadScore) || 0;
    score += felloScore * 0.4;
  }

  // Email Click Engagement - 25% of Fello score
  if (person.customFelloOfEmailClicks) {
    const clicks = parseInt(person.customFelloOfEmailClicks) || 0;
    if (clicks >= 10) score += 25;
    else if (clicks >= 5) score += 20;
    else if (clicks >= 2) score += 15;
    else if (clicks >= 1) score += 10;
  }

  // Dashboard Clicks - 15% of Fello score
  if (person.customFelloOfDashboardClicks) {
    const clicks = parseInt(person.customFelloOfDashboardClicks) || 0;
    if (clicks >= 10) score += 15;
    else if (clicks >= 5) score += 10;
    else if (clicks >= 1) score += 5;
  }

  // Form Submissions - 10% of Fello score
  if (person.customFelloOfFormSubmissions) {
    const submissions = parseInt(person.customFelloOfFormSubmissions) || 0;
    if (submissions >= 3) score += 10;
    else if (submissions >= 1) score += 5;
  }

  // Timeline Urgency - 10% of Fello score
  if (person.customFelloSellingTimeline) {
    const timeline = person.customFelloSellingTimeline.toLowerCase();
    if (timeline.includes('immediate') || timeline.includes('30') || timeline.includes('1-3')) score += 10;
    else if (timeline.includes('90') || timeline.includes('3-6')) score += 7;
    else if (timeline.includes('6')) score += 3;
  }

  console.log(`✅ Fello Score: ${score.toFixed(1)}/100`);
  return Math.min(score, 100);
}

// ============================================================================
// CLOUDCMA INTELLIGENCE SCORING (25% WEIGHT)
// ============================================================================
function calculateCloudCMAScore(person) {
  let score = 0;

  console.log('📊 CloudCMA Fields:', {
    homebeatViews: person.customWILLOWHomebeatViews,
    homebeatLastView: person.customWILLOWHomebeatLastView,
    cloudCMACreated: person.customWILLOWCloudCMACreated,
    homeBeatURL: person.customWILLOWCloudCMAHomeBeatURL
  });

  // CMA Report Exists - 20% of CloudCMA score
  if (person.customWILLOWCloudCMAHomeBeatURL || person.customWILLOWCloudCMACreated) {
    score += 20;
  }

  // Homebeat Views - 30% of CloudCMA score
  if (person.customWILLOWHomebeatViews) {
    const views = parseInt(person.customWILLOWHomebeatViews) || 0;
    if (views >= 10) score += 30;
    else if (views >= 5) score += 20;
    else if (views >= 1) score += 10;
  }

  // Last Homebeat View Recency - 25% of CloudCMA score
  if (person.customWILLOWHomebeatLastView) {
    const lastView = new Date(person.customWILLOWHomebeatLastView);
    const now = new Date();
    const daysSince = (now - lastView) / (1000 * 60 * 60 * 24);
    
    if (daysSince <= 7) score += 25;
    else if (daysSince <= 30) score += 15;
    else if (daysSince <= 90) score += 5;
  }

  // Homebeat Active - 25% of CloudCMA score
  if (person.customWILLOWCloudCMAHomeBeatURL) {
    score += 25;
  }

  // CloudCMA Created Date Recency - 10% of CloudCMA score  
  if (person.customWILLOWCloudCMACreated) {
    const created = new Date(person.customWILLOWCloudCMACreated);
    const now = new Date();
    const daysSince = (now - created) / (1000 * 60 * 60 * 24);
    
    if (daysSince <= 30) score += 10;
    else if (daysSince <= 90) score += 5;
  }

  console.log(`✅ CloudCMA Score: ${score.toFixed(1)}/100`);
  return Math.min(score, 100);
}

// ============================================================================
// WILLOW INTELLIGENCE SCORING (25% WEIGHT)
// ============================================================================
function calculateWILLOWScore(person) {
  let score = 0;

  console.log('📊 WILLOW Fields:', {
    cmaDate: person.customWILLOWCMADate,
    centerValue: person.customWILLOWCenterValue,
    priorityLevel: person.customWILLOWPriorityLevel,
    hotScore: person.customWILLOWHotScore,
    cmaLink: person.customWILLOWCMALink
  });

  // Previous Hot Score - 30% of WILLOW score
  if (person.customWILLOWHotScore) {
    const prevScore = parseFloat(person.customWILLOWHotScore) || 0;
    score += prevScore * 0.3;
  }

  // CMA Recency - 25% of WILLOW score
  if (person.customWILLOWCMADate) {
    const cmaDate = new Date(person.customWILLOWCMADate);
    const now = new Date();
    const daysSince = (now - cmaDate) / (1000 * 60 * 60 * 24);
    
    if (daysSince <= 7) score += 25;
    else if (daysSince <= 30) score += 20;
    else if (daysSince <= 90) score += 10;
    else if (daysSince <= 180) score += 5;
  }

  // Property Value (Luxury Indicator) - 20% of WILLOW score
  if (person.customWILLOWCenterValue) {
    const value = parseFloat(person.customWILLOWCenterValue) || 0;
    if (value >= 2000000) score += 20; // $2M+ = ultra-luxury
    else if (value >= 1000000) score += 15; // $1M+ = luxury
    else if (value >= 750000) score += 10; // $750K+ = upper
    else if (value >= 500000) score += 5; // $500K+ = standard
  }

  // Priority Level - 15% of WILLOW score
  if (person.customWILLOWPriorityLevel) {
    const priority = person.customWILLOWPriorityLevel.toUpperCase();
    if (priority === 'CRITICAL') score += 15;
    else if (priority === 'SUPER_HOT') score += 12;
    else if (priority === 'HOT') score += 9;
    else if (priority === 'WARM') score += 6;
    else if (priority === 'COLD') score += 3;
  }

  // CMA Link Exists - 10% of WILLOW score
  if (person.customWILLOWCMALink) {
    score += 10;
  }

  console.log(`✅ WILLOW Score: ${score.toFixed(1)}/100`);
  return Math.min(score, 100);
}

// ============================================================================
// SIERRA INTELLIGENCE SCORING (15% WEIGHT)
// ============================================================================
function calculateSierraScore(person) {
  let score = 0;

  console.log('📊 Sierra Fields:', {
    propertyViews: person.customSierraPropertyViews,
    savedListings: person.customSierraSavedListings,
    showingRequests: person.customSierraShowingRequests,
    searchActivity: person.customSierraSearchActivity,
    velocity: person.customSierraEngagementVelocity,
    note: 'Sierra fields may not exist yet in FUB'
  });

  // Property Views - 30% of Sierra score
  if (person.customSierraPropertyViews) {
    const views = parseInt(person.customSierraPropertyViews) || 0;
    if (views >= 20) score += 30;
    else if (views >= 10) score += 20;
    else if (views >= 5) score += 10;
    else if (views >= 1) score += 5;
  }

  // Saved Listings - 25% of Sierra score
  if (person.customSierraSavedListings) {
    const saved = parseInt(person.customSierraSavedListings) || 0;
    if (saved >= 10) score += 25;
    else if (saved >= 5) score += 15;
    else if (saved >= 1) score += 10;
  }

  // Showing Requests - 25% of Sierra score (highest intent indicator)
  if (person.customSierraShowingRequests) {
    const showings = parseInt(person.customSierraShowingRequests) || 0;
    if (showings >= 5) score += 25;
    else if (showings >= 2) score += 20;
    else if (showings >= 1) score += 15;
  }

  // Search Activity - 10% of Sierra score
  if (person.customSierraSearchActivity) {
    const activity = person.customSierraSearchActivity.toLowerCase();
    if (activity.includes('high') || activity.includes('daily')) score += 10;
    else if (activity.includes('medium') || activity.includes('weekly')) score += 7;
    else if (activity.includes('low') || activity.includes('monthly')) score += 3;
  }

  // Engagement Velocity - 10% of Sierra score
  if (person.customSierraEngagementVelocity) {
    const velocity = person.customSierraEngagementVelocity.toLowerCase();
    if (velocity.includes('increasing') || velocity.includes('accelerating')) score += 10;
    else if (velocity.includes('steady') || velocity.includes('stable')) score += 5;
    else if (velocity.includes('declining')) score += 0;
  }

  console.log(`✅ Sierra Score: ${score.toFixed(1)}/100`);
  return Math.min(score, 100);
}

// ============================================================================
// ENHANCED BEHAVIORAL SCORE V4.0 - WEIGHTED FUSION
// ============================================================================
function calculateEnhancedBehavioralScore(felloScore, cloudCMAScore, willowScore, sierraScore) {
  // Weighted fusion algorithm
  const enhancedScore = (
    (felloScore * 0.35) +      // Fello: 35%
    (cloudCMAScore * 0.25) +   // CloudCMA: 25%
    (willowScore * 0.25) +     // WILLOW: 25%
    (sierraScore * 0.15)       // Sierra: 15%
  );

  return Math.round(enhancedScore);
}

// ============================================================================
// PRIORITY CLASSIFICATION
// ============================================================================
function classifyPriority(score) {
  if (score >= 90) return 'CRITICAL';
  if (score >= 80) return 'SUPER_HOT';
  if (score >= 60) return 'HOT';
  if (score >= 40) return 'WARM';
  return 'COLD';
}

// ============================================================================
// ACTIVE TRIGGERS DETECTION
// ============================================================================
function detectActiveTriggers(person, felloScore, cloudCMAScore, willowScore, sierraScore) {
  const triggers = [];

  // Trigger 1: High Fello Engagement
  if (felloScore >= 70) {
    triggers.push('High Fello Engagement');
  }

  // Trigger 2: Recent Homebeat View
  if (person.customWILLOWHomebeatLastView) {
    const lastView = new Date(person.customWILLOWHomebeatLastView);
    const daysSince = (new Date() - lastView) / (1000 * 60 * 60 * 24);
    if (daysSince <= 7) {
      triggers.push('Homebeat View (Last 7 Days)');
    }
  }

  // Trigger 3: Luxury Property Interest
  if (person.customWILLOWCenterValue) {
    const value = parseFloat(person.customWILLOWCenterValue) || 0;
    if (value >= 750000) {
      triggers.push('Luxury Property ($750K+)');
    }
  }

  // Trigger 4: Multiple Property Views (Sierra)
  if (person.customSierraPropertyViews) {
    const views = parseInt(person.customSierraPropertyViews) || 0;
    if (views >= 10) {
      triggers.push('High Property View Count');
    }
  }

  // Trigger 5: Showing Requests (Sierra)
  if (person.customSierraShowingRequests) {
    const showings = parseInt(person.customSierraShowingRequests) || 0;
    if (showings >= 1) {
      triggers.push('Showing Request');
    }
  }

  return triggers;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================
exports.handler = async (event, context) => {
  console.log('🚀 WILLOW V50 - Real Behavioral Scoring V4.0');
  
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  try {
    // Parse request
    const { personId } = event.queryStringParameters || {};
    
    if (!personId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Missing personId parameter',
          usage: '?personId=1733'
        })
      };
    }

    console.log(`📋 Processing Person ID: ${personId}`);

    // Fetch FUB person data
    const person = await fetchFUBPerson(personId);
    
    if (!person) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Failed to fetch person data from FUB',
          personId
        })
      };
    }

    // Calculate individual source scores
    console.log('\n🔬 Calculating Source Scores...');
    const felloScore = calculateFelloScore(person);
    const cloudCMAScore = calculateCloudCMAScore(person);
    const willowScore = calculateWILLOWScore(person);
    const sierraScore = calculateSierraScore(person);

    // Calculate enhanced behavioral score
    const enhancedScore = calculateEnhancedBehavioralScore(
      felloScore, 
      cloudCMAScore, 
      willowScore, 
      sierraScore
    );

    // Classify priority
    const priority = classifyPriority(enhancedScore);

    // Detect active triggers
    const activeTriggers = detectActiveTriggers(
      person,
      felloScore,
      cloudCMAScore,
      willowScore,
      sierraScore
    );

    // Build response
    const response = {
      success: true,
      personId,
      personName: `${person.firstName || ''} ${person.lastName || ''}`.trim(),
      enhancedBehavioralScore: enhancedScore,
      priority,
      breakdown: {
        fello: Math.round(felloScore),
        cloudCMA: Math.round(cloudCMAScore),
        willow: Math.round(willowScore),
        sierra: Math.round(sierraScore)
      },
      activeTriggers,
      timestamp: new Date().toISOString()
    };

    console.log('\n✅ Behavioral Score Calculated:');
    console.log(`   Enhanced Score: ${enhancedScore}/100`);
    console.log(`   Priority: ${priority}`);
    console.log(`   Active Triggers: ${activeTriggers.length}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response, null, 2)
    };

  } catch (error) {
    console.error('❌ Behavioral Scoring Error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      })
    };
  }
};
