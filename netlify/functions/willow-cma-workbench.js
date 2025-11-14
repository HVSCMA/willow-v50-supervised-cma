// WILLOW V50 CMA Workbench - FIXED VERSION
// Simplified imports and error handling for Netlify deployment

const https = require('https');

// API Configuration
const FUB_API_KEY = process.env.FUB_API_KEY || 'fka_0oHt62NxmsExO6x69p08ix82zx8ii1hzrj';
const CLOUDCMA_API_KEY = process.env.CLOUDCMA_API_KEY || '742f4a46e1780904da090d721a9bae7b';
const ATTOM_API_KEY = process.env.ATTOM_API_KEY || '83d56a0076ca0aeefd240b3d397ce708';
const WEBHOOK_URL = 'https://willow-v50-supervised-cma.netlify.app/.netlify/functions/cloudcma-webhook';

// Glenn's Center Range Protocol
const ZESTIMATE_MULTIPLIER = 1.024;

// Helper function for API requests
function makeAPIRequest(options, data = null) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(body ? JSON.parse(body) : {});
                    } else {
                        reject(new Error(`API Error: ${res.statusCode} - ${body}`));
                    }
                } catch (e) {
                    // If JSON parsing fails but status is OK, return raw body
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve({ raw: body });
                    } else {
                        reject(new Error(`Parse Error: ${e.message} - Body: ${body}`));
                    }
                }
            });
        });

        req.on('error', reject);
        req.setTimeout(25000, () => reject(new Error('Request timeout')));
        
        if (data) {
            req.write(typeof data === 'string' ? data : JSON.stringify(data));
        }
        
        req.end();
    });
}

// Main function handler
exports.handler = async (event, context) => {
    // Set function timeout
    context.callbackWaitsForEmptyEventLoop = false;
    
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Handle preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        console.log('WILLOW V50: Function triggered', event.httpMethod);
        
        // Parse request
        const params = event.httpMethod === 'GET' 
            ? event.queryStringParameters || {}
            : JSON.parse(event.body || '{}');
        
        console.log('WILLOW V50: Parameters received', params);

        // Validate required parameters
        if (!params.address) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    error: 'Missing required parameter: address',
                    received: params 
                })
            };
        }

        const address = params.address;
        const personId = params.personId;
        const template = params.template || 'quick';
        
        console.log(`WILLOW V50: Processing CMA for ${address}`);

        // Step 1: Get Zestimate for Glenn's center range protocol
        console.log('WILLOW V50: Step 1 - Fetching Zestimate');
        
        let zestimate = null;
        let centerValue = null;
        
        try {
            const zillowOptions = {
                hostname: 'willow-v50-supervised-cma.netlify.app',
                path: `/.netlify/functions/zillow-zestimate?address=${encodeURIComponent(address)}`,
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            };
            
            const zillowResult = await makeAPIRequest(zillowOptions);
            console.log('WILLOW V50: Zestimate result:', zillowResult);
            
            if (zillowResult.zestimate) {
                zestimate = zillowResult.zestimate;
                // Glenn's Protocol: Zestimate × 1.024, round up to next $5K
                const calculated = zestimate * ZESTIMATE_MULTIPLIER;
                centerValue = Math.ceil(calculated / 5000) * 5000;
                console.log(`WILLOW V50: Glenn's Protocol - ${zestimate} × ${ZESTIMATE_MULTIPLIER} = ${centerValue}`);
            }
        } catch (zillowError) {
            console.warn('WILLOW V50: Zestimate lookup failed:', zillowError.message);
            // Continue without zestimate
        }

        // Step 2: Generate CloudCMA
        console.log('WILLOW V50: Step 2 - Generating CloudCMA');
        
        const jobId = `willow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const cmaParams = new URLSearchParams({
            api_key: CLOUDCMA_API_KEY,
            address: address,
            template: template,
            callback_url: WEBHOOK_URL,
            job_id: jobId
        });

        // Add center value if available
        if (centerValue) {
            cmaParams.append('center_value', centerValue.toString());
        }

        const cmaUrl = `https://cloudcma.com/cmas/new?${cmaParams.toString()}`;
        console.log('WILLOW V50: CMA URL generated:', cmaUrl);

        // Step 3: Update FUB if personId provided
        if (personId) {
            console.log('WILLOW V50: Step 3 - Updating FUB fields');
            
            try {
                const fubOptions = {
                    hostname: 'api.followupboss.com',
                    path: `/v1/people/${personId}`,
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${FUB_API_KEY}`,
                        'Content-Type': 'application/json'
                    }
                };

                const updateData = {
                    customWILLOWCMADate: new Date().toISOString(),
                    customWILLOWCMAAddress: address,
                    customWILLOWCMALink: cmaUrl,
                    customWILLOWJobId: jobId
                };

                if (centerValue) {
                    updateData.customWILLOWCenterValue = centerValue;
                }

                const fubResult = await makeAPIRequest(fubOptions, updateData);
                console.log('WILLOW V50: FUB update successful');

                // Create timeline note
                const noteOptions = {
                    hostname: 'api.followupboss.com',
                    path: '/v1/notes',
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${FUB_API_KEY}`,
                        'Content-Type': 'application/json'
                    }
                };

                const noteData = {
                    personId: parseInt(personId),
                    subject: '🎯 WILLOW V50: CMA Generated',
                    body: `CMA generated for ${address}\n\nJob ID: ${jobId}\nTemplate: ${template}${centerValue ? `\nCenter Value: $${centerValue.toLocaleString()} (Glenn's Protocol)` : ''}\n\n⚡ Automated by WILLOW V50`
                };

                await makeAPIRequest(noteOptions, noteData);
                console.log('WILLOW V50: Timeline note created');
                
            } catch (fubError) {
                console.warn('WILLOW V50: FUB update failed:', fubError.message);
                // Continue - CMA generation succeeded even if FUB update failed
            }
        }

        // Success response
        const response = {
            success: true,
            cma_url: cmaUrl,
            job_id: jobId,
            address: address,
            template: template,
            timestamp: new Date().toISOString()
        };

        if (centerValue) {
            response.center_value = centerValue;
            response.zestimate = zestimate;
            response.glenn_protocol = `${zestimate} × ${ZESTIMATE_MULTIPLIER} = ${centerValue}`;
        }

        if (personId) {
            response.fub_updated = true;
            response.person_id = personId;
        }

        console.log('WILLOW V50: Success response:', response);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(response)
        };

    } catch (error) {
        console.error('WILLOW V50: Function error:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'WILLOW V50 function error',
                message: error.message,
                timestamp: new Date().toISOString()
            })
        };
    }
};