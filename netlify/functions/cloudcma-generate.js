/**
 * CloudCMA Integration - CMA Generation
 * 
 * Purpose: Generate CMA reports using CloudCMA API
 * Integration: WILLOW V50 CMA Workbench
 * API Docs: https://cloudcma.com/developers
 * 
 * @version 1.0.0
 * @date 2025-11-12
 */

const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ 
        error: 'Method Not Allowed',
        message: 'Only POST requests are supported'
      })
    };
  }

  try {
    const CLOUDCMA_API_KEY = process.env.CLOUDCMA_API_KEY;

    if (!CLOUDCMA_API_KEY) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'Configuration Error',
          message: 'CloudCMA API key not configured'
        })
      };
    }

    // Parse request body
    const body = JSON.parse(event.body || '{}');
    
    const {
      address,
      centerValue,
      beds,
      baths,
      sqft,
      propertyType,
      radius,
      daysBack,
      comparableCount,
      title,
      notes
    } = body;

    if (!address) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Missing Required Parameter',
          message: 'Address parameter is required'
        })
      };
    }

    console.log('Generating CloudCMA for:', address);

    // Build CloudCMA API request
    // Using the CMA creation endpoint from API documentation
    const cmaUrl = buildCloudCMAUrl({
      api_key: CLOUDCMA_API_KEY,
      address: address,
      title: title || `CMA Report - ${address}`,
      notes: notes || `Generated from WILLOW V50 CMA Workbench`,
      beds: beds,
      baths: baths,
      sqft: sqft,
      prop_type: propertyType,
      // CloudCMA uses their own algorithms for proximity search
      // We'll pass our parameters in notes for Glenn's reference
    });

    // Make request to CloudCMA
    const response = await fetch(cmaUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'WILLOW-V50-CMA-Workbench/1.0',
        'Accept': 'text/html,application/json'
      },
      redirect: 'manual', // Get the redirect URL
      timeout: 15000
    });

    // CloudCMA redirects to the CMA editing interface
    // The Location header contains the CMA edit URL
    const cmaEditUrl = response.headers.get('location') || cmaUrl;
    
    console.log('CloudCMA Response Status:', response.status);
    console.log('CloudCMA Edit URL:', cmaEditUrl);

    // Return success with CMA URL (frontend expects 'cmaUrl' key)
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'CMA generation initiated successfully',
        cmaUrl: cmaEditUrl,  // Frontend expects this key
        cma: {
          editUrl: cmaEditUrl,
          parameters: {
            address: address,
            centerValue: centerValue,
            beds: beds,
            baths: baths,
            sqft: sqft,
            propertyType: propertyType,
            searchRadius: radius,
            daysBack: daysBack,
            comparables: comparableCount
          }
        },
        instructions: {
          nextSteps: [
            '1. CloudCMA is opening in a new tab',
            '2. Review and adjust comparables if needed',
            '3. Customize report presentation',
            '4. Generate and share PDF with client'
          ]
        },
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('CloudCMA generation error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: error.message,
        details: 'Failed to generate CloudCMA report'
      })
    };
  }
};

/**
 * Build CloudCMA URL with parameters
 * Based on CloudCMA API documentation: https://cloudcma.com/developers
 */
function buildCloudCMAUrl(params) {
  // CloudCMA CMA creation endpoint
  const baseUrl = 'https://cloudcma.com/cmas/new';
  
  const urlParams = new URLSearchParams();
  
  // API Key
  if (params.api_key) {
    urlParams.append('api_key', params.api_key);
  }
  
  // Subject property address
  if (params.address) {
    urlParams.append('address', params.address);
  }
  
  // Report metadata
  if (params.title) {
    urlParams.append('title', params.title);
  }
  
  if (params.notes) {
    urlParams.append('notes', params.notes);
  }
  
  // Property characteristics
  if (params.beds) {
    urlParams.append('beds', params.beds);
  }
  
  if (params.baths) {
    urlParams.append('baths', params.baths);
  }
  
  if (params.sqft) {
    urlParams.append('sqft', params.sqft);
  }
  
  if (params.prop_type) {
    urlParams.append('prop_type', params.prop_type);
  }
  
  return `${baseUrl}?${urlParams.toString()}`;
}
