// WILLOW V50 CMA Workbench - Complete Netlify Function
// Purpose: Server-side FUB/CloudCMA API integration with HTML serving

const https = require('https');

// API Credentials
const FUB_API_KEY = process.env.FUB_API_KEY || 'fka_0oHt62NxmsExO6x69p08ix82zx8ii1hzrj';
const CLOUDCMA_API_KEY = process.env.CLOUDCMA_API_KEY || '742f4a46e1780904da090d721a9bae7b';
const WEBHOOK_URL = 'https://willow-v50-supervised-cma.netlify.app/.netlify/functions/cloudcma-webhook';

exports.handler = async (event, context) => {
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        // Parse request
        const params = event.httpMethod === 'GET' 
            ? event.queryStringParameters || {}
            : JSON.parse(event.body || '{}');

        const action = params.action;

        // If no action parameter, serve HTML interface (Base64 decoded)
        if (!action) {
            const htmlBase64 = /* HTML_BASE64_PLACEHOLDER */;
            const html = Buffer.from(htmlBase64, 'base64').toString('utf8');
            
            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'text/html',
                    'Access-Control-Allow-Origin': '*'
                },
                body: html
            };
        }

        // Route to appropriate API handler
        switch (action) {
            case 'getPersonData':
                return await getPersonData(params.personId, headers);
            
            case 'generateCMA':
                return await generateCMA(params, headers);
            
            case 'getHomebeatData':
                return await getHomebeatData(params.personId, headers);
            
            case 'resendHomebeat':
                return await resendHomebeat(params, headers);
            
            case 'createTask':
                return await createTask(params, headers);
            
            case 'createManualAction':
                return await createManualAction(params, headers);
            
            default:
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Invalid action' })
                };
        }

    } catch (error) {
        console.error('Function error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};

// Get person data from FUB
async function getPersonData(personId, headers) {
    try {
        const personData = await fubAPIRequest('GET', `/v1/people/${personId}`);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(personData)
        };
    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to fetch person data: ' + error.message })
        };
    }
}

// Generate CMA with CloudCMA API
async function generateCMA(params, headers) {
    try {
        const {
            personId,
            address,
            beds,
            baths,
            sqft,
            radius,
            monthsBack,
            minListings,
            propType,
            title,
            createHomebeat,
            homebeatFrequency
        } = params;

        // Get person data for lead info
        const personData = await fubAPIRequest('GET', `/v1/people/${personId}`);

        // Build CMA URL
        const cmaParams = new URLSearchParams({
            api_key: CLOUDCMA_API_KEY,
            address: address,
            beds: beds || '',
            baths: baths || '',
            sqft: sqft || '',
            radius: radius || '0.75',
            months_back: monthsBack || '9',
            min_listings: minListings || '10',
            prop_type: propType || '',
            title: title || `${personData.name || 'Client'} - ${address}`,
            callback_url: WEBHOOK_URL
        });

        const cmaUrl = `https://cloudcma.com/cmas/new?${cmaParams.toString()}`;

        // Update FUB custom fields
        const updatePayload = {
            customWILLOWCMADate: new Date().toISOString(),
            customWILLOWCMAAddress: address,
            customWILLOWCMALink: cmaUrl
        };

        await fubAPIRequest('PUT', `/v1/people/${personId}`, updatePayload);

        // Create FUB activity
        await fubAPIRequest('POST', '/v1/events', {
            person_id: parseInt(personId),
            type: 'Note',
            body: `CMA generated for ${address}. Parameters: ${beds}bd/${baths}ba, ${sqft}sqft, ${radius}mi radius, ${monthsBack}mo back.`
        });

        let homebeatUrl = null;
        let homebeatCreated = false;

        // Create Homebeat if requested
        if (createHomebeat === true || createHomebeat === 'true') {
            try {
                const homebeatPayload = {
                    automation: {
                        api_key: CLOUDCMA_API_KEY,
                        frequency: homebeatFrequency || 'quarterly',
                        welcome_email: 'true',
                        report: {
                            prop_type: propType || null,
                            callback_url: null
                        },
                        subject_property: {
                            address: address,
                            sqft: sqft || null,
                            beds: beds || null,
                            baths: baths || null
                        },
                        lead: {
                            name: personData.name || '',
                            email_address: personData.emails?.[0]?.value || '',
                            phone: personData.phones?.[0]?.value || ''
                        }
                    }
                };

                const homebeatResponse = await cloudCMAAPIRequest('POST', '/homebeats/widget', homebeatPayload);
                homebeatCreated = true;
                homebeatUrl = homebeatResponse.homebeat_url || null;

                // Update FUB with Homebeat info
                await fubAPIRequest('PUT', `/v1/people/${personId}`, {
                    customWILLOWCloudCMAHomeBeatURL: homebeatUrl,
                    customWILLOWHomebeatFirstSendDate: new Date().toISOString()
                });

                // Create FUB activity for Homebeat
                await fubAPIRequest('POST', '/v1/events', {
                    person_id: parseInt(personId),
                    type: 'Note',
                    body: `Homebeat subscription created for ${address}. Frequency: ${homebeatFrequency}. Lead will receive automated market updates.`
                });

            } catch (homebeatError) {
                console.error('Homebeat creation failed:', homebeatError);
            }
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                cmaUrl: cmaUrl,
                homebeatCreated: homebeatCreated,
                homebeatUrl: homebeatUrl
            })
        };

    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to generate CMA: ' + error.message })
        };
    }
}

// Get Homebeat data from CloudCMA
async function getHomebeatData(personId, headers) {
    try {
        // Try to fetch homebeat data, but gracefully handle CloudCMA auth failures
        let homebeatReport = [];
        try {
            homebeatReport = await cloudCMAAPIRequest('GET', `/homebeats/report?api_key=${CLOUDCMA_API_KEY}&format=json`);
        } catch (cloudCMAError) {
            console.warn('CloudCMA API unavailable:', cloudCMAError.message);
            // Return empty homebeats array instead of failing
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ 
                    homebeats: [],
                    warning: 'CloudCMA API unavailable. Check API key configuration.'
                })
            };
        }

        const personData = await fubAPIRequest('GET', `/v1/people/${personId}`);
        const personEmail = personData.emails?.[0]?.value?.toLowerCase();

        if (!personEmail) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ homebeats: [] })
            };
        }

        const leadHomebeats = (homebeatReport || []).filter(hb => 
            hb.lead_email?.toLowerCase() === personEmail
        );

        const enrichedHomebeats = leadHomebeats.map(hb => ({
            ...hb,
            first_send_date: personData.customWILLOWHomebeatFirstSendDate || hb.created_at,
            status: (hb.total_views || 0) === 0 ? 'pending' : 'active'
        }));

        if (enrichedHomebeats.length > 0) {
            const totalViews = enrichedHomebeats.reduce((sum, hb) => sum + (hb.total_views || 0), 0);
            const latestView = enrichedHomebeats
                .map(hb => hb.last_view)
                .filter(v => v)
                .sort()
                .reverse()[0];

            await fubAPIRequest('PUT', `/v1/people/${personId}`, {
                customWILLOWHomebeatViews: totalViews,
                customWILLOWHomebeatLastView: latestView || null
            });
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ homebeats: enrichedHomebeats })
        };

    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to fetch Homebeat data: ' + error.message })
        };
    }
}

// Resend Homebeat
async function resendHomebeat(params, headers) {
    try {
        const { homebeatId, personId } = params;

        const personData = await fubAPIRequest('GET', `/v1/people/${personId}`);
        
        const homebeatReport = await cloudCMAAPIRequest('GET', `/homebeats/report?api_key=${CLOUDCMA_API_KEY}&format=json`);
        const homebeat = (homebeatReport || []).find(hb => hb.id === homebeatId);

        if (!homebeat) {
            throw new Error('Homebeat not found');
        }

        const homebeatPayload = {
            automation: {
                api_key: CLOUDCMA_API_KEY,
                frequency: homebeat.frequency || 'quarterly',
                welcome_email: 'true',
                subject_property: {
                    address: homebeat.property_address,
                    sqft: homebeat.sqft || null,
                    beds: homebeat.beds || null,
                    baths: homebeat.baths || null
                },
                lead: {
                    name: personData.name || '',
                    email_address: personData.emails?.[0]?.value || '',
                    phone: personData.phones?.[0]?.value || ''
                }
            }
        };

        await cloudCMAAPIRequest('POST', '/homebeats/widget', homebeatPayload);

        await fubAPIRequest('PUT', `/v1/people/${personId}`, {
            customWILLOWHomebeatLastResend: new Date().toISOString()
        });

        await fubAPIRequest('POST', '/v1/events', {
            person_id: parseInt(personId),
            type: 'Note',
            body: `Homebeat resent for ${homebeat.property_address}. Status was pending (0 views). Manual resend triggered.`
        });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true })
        };

    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to resend Homebeat: ' + error.message })
        };
    }
}

// Create task in FUB
async function createTask(params, headers) {
    try {
        const { personId, taskDescription, urgency, assignedTo } = params;

        const now = new Date();
        let dueDate = new Date(now);
        
        switch (urgency) {
            case 'IMMEDIATE':
                dueDate.setHours(now.getHours() + 24);
                break;
            case 'SAME_DAY':
                dueDate.setHours(23, 59, 59);
                break;
            case 'NEXT_DAY':
                dueDate.setDate(now.getDate() + 1);
                break;
            case 'WEEKLY':
                dueDate.setDate(now.getDate() + 7);
                break;
            default:
                dueDate.setDate(now.getDate() + 1);
        }

        const taskPayload = {
            personId: parseInt(personId),
            type: 'Follow Up',
            description: `${taskDescription}\n\nAssigned to: ${assignedTo}\nUrgency: ${urgency}`,
            dueDate: dueDate.toISOString()
        };

        await fubAPIRequest('POST', '/v1/tasks', taskPayload);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true })
        };

    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to create task: ' + error.message })
        };
    }
}

// Create manual action in FUB
async function createManualAction(params, headers) {
    try {
        const { personId, actionType, assignedTo, urgency, notes } = params;

        const now = new Date();
        let dueDate = new Date(now);
        
        switch (urgency) {
            case 'IMMEDIATE':
                dueDate.setHours(now.getHours() + 24);
                break;
            case 'SAME_DAY':
                dueDate.setHours(23, 59, 59);
                break;
            case 'NEXT_DAY':
                dueDate.setDate(now.getDate() + 1);
                break;
            case 'WEEKLY':
                dueDate.setDate(now.getDate() + 7);
                break;
            default:
                dueDate.setDate(now.getDate() + 1);
        }

        // Map action types to FUB task types
        const taskTypeMap = {
            'Task': 'Follow Up',
            'Call': 'Call',
            'Email': 'Email',
            'Text': 'Text',
            'Note': 'Note'
        };
        
        const fubType = taskTypeMap[actionType] || 'Follow Up';
        
        // If it's a Note, use /v1/notes endpoint, otherwise use /v1/tasks
        if (actionType === 'Note') {
            const notePayload = {
                personId: parseInt(personId),
                subject: `${urgency} Action`,
                body: `${notes}\n\nAssigned to: ${assignedTo}`,
                isHtml: false
            };
            await fubAPIRequest('POST', '/v1/notes', notePayload);
        } else {
            const taskPayload = {
                personId: parseInt(personId),
                type: fubType,
                description: `${notes}\n\nAssigned to: ${assignedTo}\nUrgency: ${urgency}`,
                dueDate: dueDate.toISOString()
            };
            await fubAPIRequest('POST', '/v1/tasks', taskPayload);
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true })
        };

    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to create action: ' + error.message })
        };
    }
}

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
                        reject(new Error(`FUB API error: ${res.statusCode} - ${body}`));
                    }
                } catch (e) {
                    reject(new Error(`Failed to parse FUB response: ${body}`));
                }
            });
        });

        req.on('error', reject);
        
        if (data) {
            req.write(JSON.stringify(data));
        }
        
        req.end();
    });
}

// CloudCMA API Request Helper
function cloudCMAAPIRequest(method, path, data = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'cloudcma.com',
            port: 443,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const parsed = body ? JSON.parse(body) : {};
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(parsed);
                    } else {
                        reject(new Error(`CloudCMA API error: ${res.statusCode} - ${body}`));
                    }
                } catch (e) {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve({});
                    } else {
                        reject(new Error(`Failed to parse CloudCMA response: ${body}`));
                    }
                }
            });
        });

        req.on('error', reject);
        
        if (data) {
            req.write(JSON.stringify(data));
        }
        
        req.end();
    });
}
