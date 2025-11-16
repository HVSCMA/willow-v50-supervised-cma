// WILLOW V50 - Behavioral Scoring V4.0
// Omnipresent intelligence fusion: Fello 35% + CloudCMA 25% + WILLOW 25% + Sierra 15%

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
    return { statusCode: 200, headers, body: '' };
  }
  
  try {
    const { leadId } = JSON.parse(event.body);
    
    if (!leadId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing leadId parameter' })
      };
    }
    
    console.log('Computing behavioral score for lead:', leadId);
    
    // MOCK DATA for now - TODO: Replace with real API calls
    // This simulates the 4-source intelligence fusion
    
    const felloScore = Math.floor(Math.random() * 100);
    const cloudcmaScore = Math.floor(Math.random() * 100);
    const willowScore = Math.floor(Math.random() * 100);
    const sierraScore = Math.floor(Math.random() * 100);
    
    // Weighted calculation: Fello 35% + CloudCMA 25% + WILLOW 25% + Sierra 15%
    const overallScore = Math.round(
      (felloScore * 0.35) +
      (cloudcmaScore * 0.25) +
      (willowScore * 0.25) +
      (sierraScore * 0.15)
    );
    
    // Classify priority based on score
    let priority;
    if (overallScore >= 80) priority = 'CRITICAL';
    else if (overallScore >= 70) priority = 'SUPER_HOT';
    else if (overallScore >= 60) priority = 'HOT';
    else if (overallScore >= 40) priority = 'WARM';
    else priority = 'COLD';
    
    // Mock trigger data
    const triggers = [
      {
        triggered: overallScore > 60,
        pattern: 'cma_request',
        name: 'CMA Request Received',
        detail: 'CloudCMA request detected 2 days ago',
        source: 'CloudCMA'
      },
      {
        triggered: overallScore > 70,
        pattern: 'property_view',
        name: 'Multiple Property Views',
        detail: '3 properties viewed in 48 hours',
        source: 'Sierra'
      },
      {
        triggered: overallScore > 50,
        pattern: 'email_open',
        name: 'High Email Engagement',
        detail: 'Opened 5 emails this week',
        source: 'Fello'
      }
    ];
    
    // Return structured response
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        leadId,
        overallScore,
        priority,
        breakdown: {
          fello: { score: felloScore, weight: 35 },
          cloudcma: { score: cloudcmaScore, weight: 25 },
          willow: { score: willowScore, weight: 25 },
          sierra: { score: sierraScore, weight: 15 }
        },
        triggers: triggers,
        calculatedAt: new Date().toISOString()
      })
    };
    
  } catch (error) {
    console.error('Behavioral scoring error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to compute behavioral score',
        message: error.message
      })
    };
  }
};
