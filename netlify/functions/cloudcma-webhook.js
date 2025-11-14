/**
 * WILLOW V50 CloudCMA Webhook Handler
 * 
 * Receives webhook callbacks from CloudCMA when CMAs are created, updated, or destroyed.
 * Captures complete deliverables (edit links, PDF links, timestamps) and syncs to FUB.
 * 
 * CloudCMA Webhook Payload:
 * {
 *   id: 12345,
 *   user_id: 67890,
 *   type: 'Cma',
 *   title: 'The Robertsons',
 *   notes: '',
 *   mls_code: 'crmls',
 *   created_at: '2015-07-21T18:04:24Z',
 *   updated_at: '2015-07-21T18:04:24Z',
 *   deleted_at: null,
 *   edit_url: 'https://cloudcma.com/cmas/12345/edit',
 *   pdf_url: 'https://cloudcma.com/pdf/f6f280a379b61c88e9bb68c6f996d501',
 *   action: 'update'
 * }
 */

const https = require('https');

// Follow Up Boss API Configuration
const FUB_API_KEY = process.env.FUB_API_KEY;
const FUB_SYSTEM_ID = process.env.FUB_SYSTEM_ID || 'Tm91ZW1iZXJfMTMsXzIwMjVfaHViX2lkOl9XV1NMTE9XX1Y1MF9FbWFpbF9JbnRlbGxpZ2VuY2VfU3lzdGVt';

/**
 * Make authenticated request to Follow Up Boss API
 */
async function fubAPIRequest(method, path, data = null) {
    const auth = Buffer.from(`${FUB_API_KEY}:${FUB_SYSTEM_ID}`).toString('base64');
    
    const options = {
        hostname: 'api.followupboss.com',
        port: 443,
        path: path,
        method: method,
        headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json'
        }
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch (e) {
                    resolve(body);
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

/**
 * Find FUB person by job_id stored in customWILLOWCMAJobID field
 */
async function findFUBPersonByJobId(jobId) {
    if (!jobId) {
        console.log('No job_id provided for person matching');
        return null;
    }

    try {
        // Query FUB for person with matching job_id
        // Note: FUB search API may require exact match or contains logic
        const response = await fubAPIRequest('GET', `/v1/people?customWILLOWCMAJobID=${encodeURIComponent(jobId)}`);
        
        if (response && response.people && response.people.length > 0) {
            console.log(`Found person ${response.people[0].id} for job_id ${jobId}`);
            return response.people[0].id;
        }

        console.log(`No FUB person found for job_id ${jobId}`);
        return null;
    } catch (error) {
        console.error('Error finding FUB person:', error);
        return null;
    }
}

/**
 * Find FUB person by CMA ID in existing customWILLOWCMALink field (fallback)
 */
async function findFUBPersonByCMAId(cmaId) {
    if (!cmaId) {
        return null;
    }

    try {
        // Search for CMA ID in existing link field
        const searchQuery = `/cmas/${cmaId}`;
        const response = await fubAPIRequest('GET', `/v1/people?customWILLOWCMALink=${encodeURIComponent(searchQuery)}`);
        
        if (response && response.people && response.people.length > 0) {
            console.log(`Found person ${response.people[0].id} for CMA ID ${cmaId}`);
            return response.people[0].id;
        }

        return null;
    } catch (error) {
        console.error('Error finding FUB person by CMA ID:', error);
        return null;
    }
}

/**
 * Main webhook handler
 */
exports.handler = async (event, context) => {
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

    // Only accept POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed. Expected POST.' })
        };
    }

    try {
        console.log('CloudCMA webhook received');
        console.log('Query params:', event.queryStringParameters);
        console.log('Body:', event.body);

        // Extract job_id from query params (passed via callback_url)
        const jobId = event.queryStringParameters?.job_id;

        // Parse CloudCMA webhook payload
        let payload;
        try {
            payload = JSON.parse(event.body || '{}');
        } catch (e) {
            console.error('Failed to parse webhook body:', e);
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Invalid JSON payload' })
            };
        }

        // Extract deliverables from payload
        const {
            id: cmaId,
            user_id: userId,
            type,
            title,
            notes,
            mls_code: mlsCode,
            created_at: createdAt,
            updated_at: updatedAt,
            deleted_at: deletedAt,
            edit_url: editUrl,
            pdf_url: pdfUrl,
            action
        } = payload;

        console.log(`Processing CloudCMA webhook: CMA ${cmaId}, action: ${action}, job_id: ${jobId}`);

        // Validate required fields
        if (!cmaId || !action) {
            console.error('Missing required fields in webhook payload');
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing required fields: id, action' })
            };
        }

        // Find corresponding FUB person
        let personId = null;
        
        // Strategy 1: Match by job_id (PRIMARY)
        if (jobId) {
            personId = await findFUBPersonByJobId(jobId);
        }
        
        // Strategy 2: Fallback to CMA ID search
        if (!personId && cmaId) {
            personId = await findFUBPersonByCMAId(cmaId);
        }

        // If no match found, log and return success (CloudCMA expects 200)
        if (!personId) {
            console.log(`No FUB person found for CMA ${cmaId} (job_id: ${jobId})`);
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    status: 'skipped',
                    message: 'No matching FUB person found',
                    cmaId,
                    jobId
                })
            };
        }

        console.log(`Matched webhook to FUB person ${personId}`);

        // Build FUB update payload with deliverables
        const fubUpdate = {};

        // Add edit URL (agent modification link)
        if (editUrl) {
            fubUpdate.customWILLOWCMAEditLink = editUrl;
        }

        // Add PDF URL (final deliverable)
        if (pdfUrl) {
            fubUpdate.customWILLOWCMAPDFLink = pdfUrl;
        }

        // Add completion timestamp
        if (createdAt && action === 'create') {
            fubUpdate.customWILLOWCloudCMACreated = createdAt;
        }

        // Add CMA type
        if (type) {
            fubUpdate.customWILLOWCloudCMAType = type;
        }

        // Only update FUB if we have deliverables to sync
        if (Object.keys(fubUpdate).length === 0) {
            console.log('No deliverables to sync - webhook payload incomplete');
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    status: 'skipped',
                    message: 'No deliverables in payload',
                    cmaId
                })
            };
        }

        console.log('Updating FUB with deliverables:', fubUpdate);

        // Update FUB custom fields
        try {
            await fubAPIRequest('PUT', `/v1/people/${personId}`, fubUpdate);
            console.log(`Successfully updated FUB person ${personId}`);
        } catch (error) {
            console.error('Failed to update FUB fields:', error);
            // Continue to create note even if field update fails
        }

        // Create timeline note with deliverable details
        const noteAction = action === 'create' ? 'Completed' : action === 'update' ? 'Updated' : 'Modified';
        const noteBody = `CloudCMA deliverables received and synced to FUB\n\n` +
                        `**CMA Details:**\n` +
                        `- CMA ID: ${cmaId}\n` +
                        `- Type: ${type || 'Unknown'}\n` +
                        `- Title: ${title || 'N/A'}\n` +
                        `- Action: ${action}\n\n` +
                        `**Deliverables:**\n` +
                        `- Edit Link: ${editUrl || 'Not provided'}\n` +
                        `- PDF Link: ${pdfUrl || 'Not provided'}\n\n` +
                        `**Timestamps:**\n` +
                        `- Created: ${createdAt || 'N/A'}\n` +
                        `- Updated: ${updatedAt || 'N/A'}\n` +
                        `- Deleted: ${deletedAt || 'N/A'}\n\n` +
                        `**Tracking:**\n` +
                        `- Job ID: ${jobId || 'N/A'}\n` +
                        `- MLS Code: ${mlsCode || 'N/A'}`;

        try {
            await fubAPIRequest('POST', '/v1/notes', {
                personId: parseInt(personId),
                subject: `🎯 WILLOW V50: CMA ${noteAction}`,
                body: noteBody
            });
            console.log('Successfully created FUB timeline note');
        } catch (error) {
            console.error('Failed to create FUB note:', error);
            // Continue - note creation failure is not critical
        }

        // Return success response
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                status: 'success',
                message: 'Deliverables captured and synced to FUB',
                personId,
                cmaId,
                jobId,
                deliverables: {
                    editUrl,
                    pdfUrl
                },
                action
            })
        };

    } catch (error) {
        console.error('Webhook handler error:', error);
        
        // Return 500 for CloudCMA to retry
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                status: 'error',
                message: error.message
            })
        };
    }
};
