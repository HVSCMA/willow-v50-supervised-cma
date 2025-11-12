/**
 * Zillow Zestimate Lookup Function
 * 
 * Purpose: Extract Zestimate value and date from Zillow property pages
 * Method: HTTP request + HTML parsing (no headless browser needed)
 * Integration: WILLOW V50 CMA Workbench
 * 
 * @version 1.0.0
 * @date 2025-11-12
 */

const fetch = require('node-fetch');

/**
 * Main handler function
 */
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

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ 
        error: 'Method Not Allowed',
        message: 'Only GET requests are supported'
      })
    };
  }

  try {
    const params = event.queryStringParameters || {};
    const address = params.address;
    
    if (!address) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Missing Required Parameter',
          message: 'Address parameter is required',
          usage: '?address=123 Main St, City, State ZIP'
        })
      };
    }

    console.log('Fetching Zestimate for:', address);

    // Step 1: Search Zillow for the property to get ZPID
    const zpid = await searchZillowForProperty(address);
    
    if (!zpid) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          error: 'Property Not Found',
          message: 'Could not find property on Zillow',
          address: address
        })
      };
    }

    console.log('Found ZPID:', zpid);

    // Step 2: Fetch property page and extract Zestimate
    const zestimate = await fetchZestimateData(zpid);

    if (!zestimate) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          error: 'Zestimate Not Available',
          message: 'Property found but Zestimate not available',
          zpid: zpid
        })
      };
    }

    // Return the data
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        address: address,
        zpid: zpid,
        zestimate: zestimate,
        source: 'Zillow',
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('Zillow lookup error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: error.message,
        details: 'Failed to fetch Zestimate data'
      })
    };
  }
};

/**
 * Search Zillow for property and extract ZPID
 */
async function searchZillowForProperty(address) {
  try {
    // Build Zillow search URL
    const searchUrl = `https://www.zillow.com/homes/${encodeURIComponent(address)}_rb/`;
    
    console.log('Searching Zillow:', searchUrl);

    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      redirect: 'follow',
      timeout: 15000
    });

    if (!response.ok) {
      console.error('Zillow search failed:', response.status);
      return null;
    }

    const html = await response.text();
    
    // Method 1: Extract ZPID from URL redirect (most reliable)
    const finalUrl = response.url;
    const zpidMatch = finalUrl.match(/\/homedetails\/[^\/]+\/(\d+)_zpid/);
    if (zpidMatch) {
      return zpidMatch[1];
    }

    // Method 2: Extract ZPID from HTML data-zpid attributes
    const zpidAttrMatch = html.match(/data-zpid="(\d+)"/);
    if (zpidAttrMatch) {
      return zpidAttrMatch[1];
    }

    // Method 3: Extract from JSON-LD structured data
    const jsonLdMatch = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s);
    if (jsonLdMatch) {
      try {
        const jsonData = JSON.parse(jsonLdMatch[1]);
        if (jsonData.url) {
          const urlZpidMatch = jsonData.url.match(/\/(\d+)_zpid/);
          if (urlZpidMatch) {
            return urlZpidMatch[1];
          }
        }
      } catch (e) {
        console.error('Failed to parse JSON-LD:', e);
      }
    }

    // Method 4: Extract from NextJS data script
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s);
    if (nextDataMatch) {
      try {
        const nextData = JSON.parse(nextDataMatch[1]);
        // Zillow embeds ZPID in various places in their NextJS data
        const zpidFromNext = extractZpidFromObject(nextData);
        if (zpidFromNext) {
          return zpidFromNext;
        }
      } catch (e) {
        console.error('Failed to parse NEXT_DATA:', e);
      }
    }

    console.error('Could not extract ZPID from response');
    return null;

  } catch (error) {
    console.error('Search error:', error);
    return null;
  }
}

/**
 * Recursively search object for ZPID
 */
function extractZpidFromObject(obj, depth = 0) {
  if (depth > 5 || !obj || typeof obj !== 'object') {
    return null;
  }

  if (obj.zpid && typeof obj.zpid === 'string' && /^\d+$/.test(obj.zpid)) {
    return obj.zpid;
  }

  for (const key in obj) {
    if (key === 'zpid' && typeof obj[key] === 'string' && /^\d+$/.test(obj[key])) {
      return obj[key];
    }
    if (typeof obj[key] === 'object') {
      const result = extractZpidFromObject(obj[key], depth + 1);
      if (result) return result;
    }
  }

  return null;
}

/**
 * Fetch property page and extract Zestimate data
 */
async function fetchZestimateData(zpid) {
  try {
    const propertyUrl = `https://www.zillow.com/homedetails/${zpid}_zpid/`;
    
    console.log('Fetching property page:', propertyUrl);

    const response = await fetch(propertyUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      timeout: 15000
    });

    if (!response.ok) {
      console.error('Property page fetch failed:', response.status);
      return null;
    }

    const html = await response.text();

    // Extract from NextJS data (most reliable method)
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s);
    if (nextDataMatch) {
      try {
        const nextData = JSON.parse(nextDataMatch[1]);
        const zestimate = extractZestimateFromNextData(nextData);
        if (zestimate) {
          return zestimate;
        }
      } catch (e) {
        console.error('Failed to parse NEXT_DATA for Zestimate:', e);
      }
    }

    // Fallback: Extract from meta tags
    const priceMatch = html.match(/<meta property="zillow_fb:zestimate" content="(\d+)"/);
    if (priceMatch) {
      return {
        value: parseInt(priceMatch[1]),
        lastUpdated: null,
        valueChange: null,
        valuationRange: null
      };
    }

    console.error('Could not extract Zestimate from property page');
    return null;

  } catch (error) {
    console.error('Fetch Zestimate error:', error);
    return null;
  }
}

/**
 * Extract Zestimate details from Zillow's NextJS data
 */
function extractZestimateFromNextData(data) {
  try {
    // Zillow stores property data in various places
    // Navigate through the data structure to find Zestimate
    
    if (data.props?.pageProps?.componentProps?.gdpClientCache) {
      const cacheStr = data.props.pageProps.componentProps.gdpClientCache;
      
      // Parse the GDP client cache
      const cacheMatch = cacheStr.match(/"zestimate":\s*(\d+)/);
      const dateMatch = cacheStr.match(/"zestimateUpdateDate":\s*"([^"]+)"/);
      const rangeMatch = cacheStr.match(/"zestimateRange":\s*{[^}]*"high":\s*(\d+)[^}]*"low":\s*(\d+)/);
      
      if (cacheMatch) {
        return {
          value: parseInt(cacheMatch[1]),
          lastUpdated: dateMatch ? dateMatch[1] : null,
          valuationRange: rangeMatch ? {
            low: parseInt(rangeMatch[2]),
            high: parseInt(rangeMatch[1])
          } : null,
          valueChange: null
        };
      }
    }

    // Alternative: Look for property data in initialReduxState
    if (data.props?.pageProps?.initialReduxState?.gdp) {
      const gdp = data.props.pageProps.initialReduxState.gdp;
      
      // Search through GDP data for property details
      for (const key in gdp) {
        if (gdp[key]?.property?.zestimate) {
          const z = gdp[key].property.zestimate;
          return {
            value: z.value || z.zestimate,
            lastUpdated: z.lastUpdated || z.zestimateUpdateDate,
            valuationRange: z.valuationRange || z.zestimateRange,
            valueChange: z.valueChange || null
          };
        }
      }
    }

    return null;
  } catch (error) {
    console.error('Extract Zestimate from NextData error:', error);
    return null;
  }
}
