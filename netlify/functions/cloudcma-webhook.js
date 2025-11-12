// CloudCMA Webhook Receiver for WILLOW V50
// Receives webhook callbacks when CMAs are created/updated/destroyed

const https = require('https');

const FUB_API_KEY = process.env.FUB_API_KEY || 'fka_0oHt62NxmsExO6x69p08ix82zx8ii1hzrj';

// Generate agent-safe URLs by appending common preview parameters
function generateAgentSafeURL(originalUrl) {
    if (!originalUrl) return null;
    
    // If URL already has parameters, use & instead of ?
    const separator = originalUrl.includes('?') ? '&' : '?';
    
    // Try the most common agent preview parameter
    return originalUrl + separator + 'preview=agent';
}

// Generate all agent-safe deliverable URLs
function generateAllAgentSafeURLs(payload) {
    return {
        agentLiveURL: payload.live_url ? generateAgentSafeURL(payload.live_url) : 
                     (payload.share_url ? generateAgentSafeURL(payload.share_url) : 
                     (payload.public_url ? generateAgentSafeURL(payload.public_url) : null)),
        agentPDFURL: payload.pdf_url ? generateAgentSafeURL(payload.pdf_url) : null
    };
}

// Extract live URLs from webhook payload (when CloudCMA adds them)
function extractLiveURL(payload) {
    // Look for common live URL patterns in CloudCMA webhooks
    // This may need updates when CloudCMA provides live URLs
    if (payload.live_url) return payload.live_url;
    if (payload.share_url) return payload.share_url;
    if (payload.public_url) return payload.public_url;
    
    // For now, return null - will be enhanced when we discover the pattern
    return null;
}

exports.handler = async (event, context) => {
    // Only accept POST requests
    if (event.httpMethod !== 'POST') {
        return { 
            statusCode: 405, 
            body: JSON.stringify({ error: 'Method not allowed' }) 
        };
    }

    try {
        const payload = JSON.parse(event.body);
        
        console.log('CloudCMA webhook received:', JSON.stringify(payload, null, 2));

        // CloudCMA webhook payload structure:
        // {
        //   id: "12345",
        //   user_id: "67890",
        //   type: "cma",
        //   title: "John Smith - 123 Main St",
        //   action: "created" | "updated" | "destroyed",
        //   pdf_url: "https://cloudcma.com/pdf/...",
        //   edit_url: "https://cloudcma.com/cmas/12345/edit",
        //   created_at: "2025-11-11T14:30:00Z",
        //   updated_at: "2025-11-11T15:45:00Z",
        //   deleted_at: null
        // }

        // Extract address from title (format: "Name - Address" or just "Address")
        const addressMatch = payload.title.match(/[-–]\s*(.+)$/) || payload.title.match(/^(.+)$/);
        const address = addressMatch ? addressMatch[1].trim() : payload.title;

        console.log('Extracted address:', address);

        // Search FUB for lead by address (search in CMA address field or notes)
        const searchQuery = encodeURIComponent(address);
        const searchResults = await fubAPIRequest('GET', `/v1/people?search=${searchQuery}&limit=10`);
        
        if (!searchResults || !searchResults.people || searchResults.people.length === 0) {
            console.log('No FUB lead found for address:', address);
            
            // Return success anyway (CloudCMA expects 200)
            return { 
                statusCode: 200, 
                body: JSON.stringify({ 
                    message: 'Webhook received, no matching lead found',
                    address: address 
                }) 
            };
        }

        // Use first matching lead
        const lead = searchResults.people[0];
        console.log('Found FUB lead:', lead.id, lead.name);

        // Handle different webhook actions
        if (payload.action === 'created') {
            // Determine template type based on URL patterns
            let templateType = 'full'; // default
            if (payload.edit_url && payload.edit_url.includes('/widget/')) {
                templateType = payload.pdf_url ? 'quick' : 'website';
            }
            
            // Extract and process all URLs
            const liveUrl = extractLiveURL(payload);
            const agentUrls = generateAllAgentSafeURLs(payload);
            
            // Comprehensive FUB custom fields with ALL URL types
            const updatePayload = {
                // Primary tracking
                customWILLOWCMALink: payload.pdf_url || payload.edit_url, // Backward compatibility
                customWILLOWCMADate: payload.created_at,
                customWILLOWCMAID: payload.id.toString(),
                customWILLOWCMAStatus: 'created',
                customWILLOWCMAType: templateType,
                customWILLOWCMAAddress: address,
                
                // AGENT URLs (Safe for Glenn & Partners - No View Count Impact)
                customWILLOWCMAEditURL: payload.edit_url,        // Agent editing interface
                customWILLOWCMAAgentLiveURL: agentUrls.agentLiveURL,  // Agent-safe live deliverable
                customWILLOWCMAAgentPDFURL: agentUrls.agentPDFURL,    // Agent-safe PDF deliverable
                
                // CLIENT URLs (For Client Delivery - Will Count Views)
                customWILLOWCMALiveURL: liveUrl,                // Client live deliverable 
                customWILLOWCMAPDFURL: payload.pdf_url          // Client PDF deliverable
            };
            
            await fubAPIRequest('PUT', `/v1/people/${lead.id}`, updatePayload);

            console.log('Updated FUB custom fields for lead:', lead.id);

            // Create FUB activity log
            await fubAPIRequest('POST', '/v1/events', {
                person_id: parseInt(lead.id),
                type: 'Note',
                body: `CMA created via CloudCMA\n\nProperty: ${address}\nPDF: ${payload.pdf_url}\nEdit: ${payload.edit_url}\n\nWebhook received: ${new Date().toISOString()}`
            });

            console.log('Created FUB activity for lead:', lead.id);
        }

        if (payload.action === 'updated') {
            // Increment CMA open counter (if CloudCMA sends updates for views)
            const currentOpens = lead.customWILLOWCMAOpens ? parseInt(lead.customWILLOWCMAOpens) : 0;
            
            await fubAPIRequest('PUT', `/v1/people/${lead.id}`, {
                customWILLOWCMAOpens: currentOpens + 1,
                customWILLOWCMALastOpen: new Date().toISOString()
            });

            console.log('CMA view tracked for lead:', lead.id, 'Total opens:', currentOpens + 1);
        }

        if (payload.action === 'destroyed') {
            console.log('CMA destroyed:', payload.id, 'for lead:', lead.id);
            
            // Optionally log this event
            await fubAPIRequest('POST', '/v1/events', {
                person_id: parseInt(lead.id),
                type: 'Note',
                body: `CMA deleted: ${address}\n\nWebhook received: ${new Date().toISOString()}`
            });
        }

        return { 
            statusCode: 200, 
            body: JSON.stringify({ 
                message: 'Webhook processed successfully',
                action: payload.action,
                lead_id: lead.id 
            }) 
        };

    } catch (error) {
        console.error('Webhook processing error:', error);
        
        // Return 200 even on error (CloudCMA retries on non-200)
        return { 
            statusCode: 200, 
            body: JSON.stringify({ 
                message: 'Webhook received with error',
                error: error.message 
            }) 
        };
    }
};

// FUB API Request Helper
function fubAPIRequest(method, path, data = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.followupboss.com',
            port: 443,
            path: path,
            method: method,
            headers: {
                'Authorization': `Basic ${Buffer.from(FUB_API_KEY + ':').toString('base64')}`,
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(parsed);
                    } else {
                        console.error('FUB API error:', res.statusCode, body);
                        reject(new Error(`FUB API error: ${res.statusCode} - ${body}`));
                    }
                } catch (e) {
                    console.error('Failed to parse FUB response:', body);
                    reject(new Error(`Failed to parse FUB response: ${body}`));
                }
            });
        });

        req.on('error', (error) => {
            console.error('FUB API request error:', error);
            reject(error);
        });
        
        if (data) {
            req.write(JSON.stringify(data));
        }
        
        req.end();
    });
}
