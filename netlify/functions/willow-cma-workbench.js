// WILLOW V50 CMA Workbench - Complete Netlify Function
// Purpose: Server-side FUB/CloudCMA API integration with HTML serving and FUB Context Processing

const https = require('https');

// API Credentials
const FUB_API_KEY = process.env.FUB_API_KEY || 'fka_0oHt62NxmsExO6x69p08ix82zx8ii1hzrj';
const CLOUDCMA_API_KEY = process.env.CLOUDCMA_API_KEY || '742f4a46e1780904da090d721a9bae7b';
const WEBHOOK_URL = 'https://willow-v50-supervised-cma.netlify.app/.netlify/functions/cloudcma-webhook';

// Glenn's Center Range Protocol Configuration
const CENTER_RANGE_MULTIPLIER = 1.024; // Configurable multiplier factor

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

        // If no action parameter, serve HTML interface with FUB context processing
        if (!action) {
            // Process FUB context for address prepopulation
            let contextData = null;
            let personId = null;
            let prefilledAddress = '';
            
            try {
                // FUB passes contact data via base64-encoded context parameter
                const contextParam = params.context;
                if (contextParam) {
                    const contextJson = Buffer.from(contextParam, 'base64').toString('utf8');
                    contextData = JSON.parse(contextJson);
                    
                    // Extract person ID and address from FUB context
                    if (contextData.person) {
                        personId = contextData.person.id;
                        
                        // Get address from multiple possible fields
                        const addresses = contextData.person.addresses || [];
                        if (addresses.length > 0) {
                            const primaryAddress = addresses.find(addr => addr.type === 'home') || addresses[0];
                            if (primaryAddress) {
                                const addressParts = [
                                    primaryAddress.street,
                                    primaryAddress.city,
                                    primaryAddress.state,
                                    primaryAddress.postal_code
                                ].filter(Boolean);
                                prefilledAddress = addressParts.join(', ');
                            }
                        }
                    }
                }
            } catch (contextError) {
                console.warn('FUB context processing failed:', contextError.message);
                // Continue with empty prefill - not a fatal error
            }

            // Generate dynamic HTML with address prefilled from FUB context
            const html = generateHTML(prefilledAddress, personId);
            
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
            
            case 'getMarketValue':
                return await getMarketValue(params.address, headers);
            
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

// Generate dynamic HTML with FUB context data
function generateHTML(prefilledAddress = '', personId = null) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WILLOW V50 - CMA Workbench</title>
    <!-- FUB Embedded Apps SDK -->
    <script type="text/javascript" src="https://eia.followupboss.com/embeddedApps-v1.0.1.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #2d3748;
            line-height: 1.6;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
        }

        .header {
            background: white;
            border-radius: 12px;
            padding: 20px 30px;
            margin-bottom: 20px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }

        .header h1 {
            font-size: 24px;
            color: #667eea;
            margin-bottom: 5px;
        }

        .header .subtitle {
            font-size: 14px;
            color: #718096;
        }

        .tabs {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
        }

        .tab-button {
            flex: 1;
            background: white;
            border: none;
            padding: 15px 20px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .tab-button.active {
            background: #667eea;
            color: white;
            transform: translateY(-1px);
            box-shadow: 0 4px 8px rgba(102,126,234,0.3);
        }

        .tab-button:hover:not(.active) {
            background: #f7fafc;
            transform: translateY(-1px);
        }

        .tab-content {
            display: none;
        }

        .tab-content.active {
            display: block;
        }

        .card {
            background: white;
            border-radius: 12px;
            padding: 25px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }

        .form-group {
            margin-bottom: 20px;
        }

        .form-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
        }

        .form-row-3 {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 15px;
        }

        label {
            display: block;
            margin-bottom: 8px;
            font-weight: 500;
            color: #2d3748;
        }

        input, select, textarea {
            width: 100%;
            padding: 12px;
            border: 2px solid #e2e8f0;
            border-radius: 8px;
            font-size: 14px;
            transition: border-color 0.2s;
        }

        input:focus, select:focus, textarea:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102,126,234,0.1);
        }

        .checkbox-group {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-top: 15px;
        }

        .checkbox-group input[type="checkbox"] {
            width: auto;
            margin: 0;
        }

        .btn {
            background: #667eea;
            color: white;
            padding: 15px 30px;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            width: 100%;
            margin-top: 20px;
        }

        .btn:hover {
            background: #5a67d8;
            transform: translateY(-1px);
            box-shadow: 0 4px 8px rgba(102,126,234,0.3);
        }

        .btn:disabled {
            background: #a0aec0;
            cursor: not-allowed;
            transform: none;
        }

        .status {
            padding: 15px;
            border-radius: 8px;
            margin-top: 20px;
            display: none;
        }

        .status.success {
            background: #f0fff4;
            color: #22543d;
            border: 1px solid #9ae6b4;
        }

        .status.error {
            background: #fed7d7;
            color: #742a2a;
            border: 1px solid #feb2b2;
        }

        .status.info {
            background: #ebf8ff;
            color: #2a4365;
            border: 1px solid #90cdf4;
        }

        .loading {
            display: none;
            text-align: center;
            padding: 20px;
        }

        .spinner {
            border: 3px solid #f3f3f3;
            border-top: 3px solid #667eea;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 0 auto 10px;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        .homebeat-item {
            background: #f7fafc;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 10px;
        }

        .homebeat-header {
            display: flex;
            justify-content: between;
            align-items: center;
            margin-bottom: 10px;
        }

        .homebeat-address {
            font-weight: 600;
            color: #2d3748;
        }

        .homebeat-status {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 500;
        }

        .homebeat-status.active {
            background: #c6f6d5;
            color: #22543d;
        }

        .homebeat-status.pending {
            background: #fef5e7;
            color: #975a16;
        }

        .homebeat-actions {
            display: flex;
            gap: 10px;
            margin-top: 10px;
        }

        .btn-sm {
            padding: 8px 15px;
            font-size: 12px;
            margin: 0;
            width: auto;
        }

        .info-box {
            background: #ebf8ff;
            border: 1px solid #90cdf4;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 20px;
        }

        .info-box h4 {
            color: #2b6cb0;
            margin-bottom: 8px;
        }

        .info-box p {
            color: #2a4365;
            font-size: 14px;
            margin: 0;
        }

        @media (max-width: 768px) {
            .form-row, .form-row-3 {
                grid-template-columns: 1fr;
            }
            
            .container {
                padding: 10px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>WILLOW V50 - CMA Workbench</h1>
            <div class="subtitle">Comprehensive Market Analysis & Lead Intelligence System</div>
        </div>

        <div class="tabs">
            <button class="tab-button active" onclick="switchTab('cma')">Generate CMA</button>
            <button class="tab-button" onclick="switchTab('homebeat')">Homebeat Manager</button>
            <button class="tab-button" onclick="switchTab('intelligence')">Lead Intelligence</button>
        </div>

        <!-- CMA Generation Tab -->
        <div id="cma-tab" class="tab-content active">
            <div class="card">
                <form id="cma-form">
                    <div class="info-box">
                        <h4>🎯 Glenn's Center Range Protocol Active</h4>
                        <p>When market data is available, system will suggest center range using Market Value × 1.024, rounded up to next $5K increment.</p>
                    </div>

                    <div class="form-group">
                        <label for="address">Property Address *</label>
                        <input type="text" id="address" name="address" value="${prefilledAddress}" required 
                               placeholder="123 Main St, City, State, ZIP">
                    </div>

                    <div class="form-row-3">
                        <div class="form-group">
                            <label for="beds">Bedrooms</label>
                            <input type="number" id="beds" name="beds" placeholder="Auto-detect">
                        </div>
                        <div class="form-group">
                            <label for="baths">Bathrooms</label>
                            <input type="number" step="0.5" id="baths" name="baths" placeholder="Auto-detect">
                        </div>
                        <div class="form-group">
                            <label for="sqft">Square Feet</label>
                            <input type="number" id="sqft" name="sqft" placeholder="Auto-detect">
                        </div>
                    </div>

                    <div class="form-row-3">
                        <div class="form-group">
                            <label for="radius">Search Radius (miles)</label>
                            <select id="radius" name="radius">
                                <option value="0.25">0.25 miles</option>
                                <option value="0.5">0.5 miles</option>
                                <option value="0.75" selected>0.75 miles</option>
                                <option value="1">1 mile</option>
                                <option value="1.5">1.5 miles</option>
                                <option value="2">2 miles</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="months_back">Months Back</label>
                            <select id="months_back" name="months_back">
                                <option value="3">3 months</option>
                                <option value="6">6 months</option>
                                <option value="9" selected>9 months</option>
                                <option value="12">12 months</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="min_listings">Min Listings</label>
                            <select id="min_listings" name="min_listings">
                                <option value="5">5 listings</option>
                                <option value="10" selected>10 listings</option>
                                <option value="15">15 listings</option>
                                <option value="20">20 listings</option>
                            </select>
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label for="prop_type">Property Type</label>
                            <select id="prop_type" name="prop_type">
                                <option value="">Auto-detect</option>
                                <option value="single_family">Single Family</option>
                                <option value="condo">Condo</option>
                                <option value="townhome">Townhome</option>
                                <option value="multi_family">Multi-Family</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="title">Report Title</label>
                            <input type="text" id="title" name="title" placeholder="Auto-generate">
                        </div>
                    </div>

                    <div class="checkbox-group">
                        <input type="checkbox" id="create_homebeat" name="create_homebeat">
                        <label for="create_homebeat">Create Homebeat Subscription</label>
                    </div>

                    <div id="homebeat_options" style="display: none; margin-top: 15px;">
                        <div class="form-group">
                            <label for="homebeat_frequency">Homebeat Frequency</label>
                            <select id="homebeat_frequency" name="homebeat_frequency">
                                <option value="monthly">Monthly</option>
                                <option value="quarterly" selected>Quarterly</option>
                                <option value="semi_annually">Semi-Annually</option>
                            </select>
                        </div>
                    </div>

                    <button type="submit" class="btn">Generate CMA Report</button>
                </form>

                <div id="cma-status" class="status"></div>
                <div id="cma-loading" class="loading">
                    <div class="spinner"></div>
                    <div>Generating CMA report...</div>
                </div>
            </div>
        </div>

        <!-- Homebeat Manager Tab -->
        <div id="homebeat-tab" class="tab-content">
            <div class="card">
                <h3 style="margin-bottom: 20px;">Homebeat Subscriptions</h3>
                
                <button onclick="loadHomebeats()" class="btn" style="margin-bottom: 20px;">
                    Refresh Homebeat Data
                </button>

                <div id="homebeat-list"></div>
                <div id="homebeat-status" class="status"></div>
                <div id="homebeat-loading" class="loading">
                    <div class="spinner"></div>
                    <div>Loading Homebeat data...</div>
                </div>
            </div>
        </div>

        <!-- Lead Intelligence Tab -->
        <div id="intelligence-tab" class="tab-content">
            <div class="card">
                <h3 style="margin-bottom: 20px;">Lead Intelligence Dashboard</h3>
                
                <button onclick="loadPersonData()" class="btn" style="margin-bottom: 20px;">
                    Load Lead Profile
                </button>

                <div id="person-data"></div>
                <div id="intelligence-status" class="status"></div>
                <div id="intelligence-loading" class="loading">
                    <div class="spinner"></div>
                    <div>Loading lead intelligence...</div>
                </div>
            </div>
        </div>
    </div>

    <script>
        // Global variables - Store person ID from FUB context
        let currentPersonId = ${personId ? `"${personId}"` : 'null'};
        
        // Initialize FUB SDK
        document.addEventListener('DOMContentLoaded', function() {
            console.log('WILLOW V50 CMA Workbench initialized');
            console.log('Person ID from FUB context:', currentPersonId);
            
            // If we have person ID from FUB context, load person data automatically
            if (currentPersonId) {
                loadPersonData();
            }
        });

        // Tab switching
        function switchTab(tabName) {
            // Hide all tabs
            document.querySelectorAll('.tab-content').forEach(tab => {
                tab.classList.remove('active');
            });
            
            // Remove active class from all buttons
            document.querySelectorAll('.tab-button').forEach(btn => {
                btn.classList.remove('active');
            });
            
            // Show selected tab
            document.getElementById(tabName + '-tab').classList.add('active');
            event.target.classList.add('active');
        }

        // Show/hide homebeat options
        document.getElementById('create_homebeat').addEventListener('change', function() {
            const options = document.getElementById('homebeat_options');
            options.style.display = this.checked ? 'block' : 'none';
        });

        // Form submission
        document.getElementById('cma-form').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            if (!currentPersonId) {
                showStatus('cma', 'error', 'Missing FUB person context. Please ensure app is loaded within Follow Up Boss.');
                return;
            }
            
            const formData = new FormData(this);
            const params = {
                action: 'generateCMA',
                personId: currentPersonId,
                address: formData.get('address'),
                beds: formData.get('beds'),
                baths: formData.get('baths'),
                sqft: formData.get('sqft'),
                radius: formData.get('radius'),
                monthsBack: formData.get('months_back'),
                minListings: formData.get('min_listings'),
                propType: formData.get('prop_type'),
                title: formData.get('title'),
                createHomebeat: formData.get('create_homebeat') === 'on',
                homebeatFrequency: formData.get('homebeat_frequency')
            };
            
            showLoading('cma');
            hideStatus('cma');
            
            try {
                const response = await fetch(window.location.href, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(params)
                });
                
                const result = await response.json();
                hideLoading('cma');
                
                if (result.success) {
                    let message = '✅ CMA report generated successfully!';
                    if (result.suggested_center_range) {
                        message += \`\\n\\n🎯 Suggested Center Range: $\${result.suggested_center_range.toLocaleString()}\\n(Market Value × 1.024 Protocol)\`;
                    }
                    if (result.homebeatCreated) {
                        message += '\\n\\n🏠 Homebeat subscription created successfully!';
                    }
                    showStatus('cma', 'success', message);
                    
                    // Open CMA in new tab
                    window.open(result.cmaUrl, '_blank');
                } else {
                    showStatus('cma', 'error', result.error || 'Failed to generate CMA');
                }
            } catch (error) {
                hideLoading('cma');
                showStatus('cma', 'error', 'Network error: ' + error.message);
            }
        });

        // Load person data
        async function loadPersonData() {
            if (!currentPersonId) {
                showStatus('intelligence', 'error', 'Missing FUB person context. Please ensure app is loaded within Follow Up Boss.');
                return;
            }
            
            showLoading('intelligence');
            hideStatus('intelligence');
            
            try {
                const response = await fetch(\`\${window.location.href}?action=getPersonData&personId=\${currentPersonId}\`);
                const result = await response.json();
                hideLoading('intelligence');
                
                if (response.ok) {
                    displayPersonData(result);
                    showStatus('intelligence', 'success', 'Lead data loaded successfully');
                } else {
                    showStatus('intelligence', 'error', result.error || 'Failed to load person data');
                }
            } catch (error) {
                hideLoading('intelligence');
                showStatus('intelligence', 'error', 'Network error: ' + error.message);
            }
        }

        // Load homebeats
        async function loadHomebeats() {
            if (!currentPersonId) {
                showStatus('homebeat', 'error', 'Missing FUB person context. Please ensure app is loaded within Follow Up Boss.');
                return;
            }
            
            showLoading('homebeat');
            hideStatus('homebeat');
            
            try {
                const response = await fetch(\`\${window.location.href}?action=getHomebeatData&personId=\${currentPersonId}\`);
                const result = await response.json();
                hideLoading('homebeat');
                
                if (response.ok) {
                    displayHomebeats(result.homebeats || []);
                    showStatus('homebeat', 'success', \`\${result.homebeats?.length || 0} homebeat(s) found\`);
                } else {
                    showStatus('homebeat', 'error', result.error || 'Failed to load homebeat data');
                }
            } catch (error) {
                hideLoading('homebeat');
                showStatus('homebeat', 'error', 'Network error: ' + error.message);
            }
        }

        // Display person data
        function displayPersonData(person) {
            const container = document.getElementById('person-data');
            
            const addresses = person.addresses || [];
            const phones = person.phones || [];
            const emails = person.emails || [];
            
            container.innerHTML = \`
                <div style="background: #f7fafc; padding: 20px; border-radius: 8px;">
                    <h4 style="margin-bottom: 15px; color: #2d3748;">Contact Information</h4>
                    <p><strong>Name:</strong> \${person.name || 'Not provided'}</p>
                    <p><strong>Email:</strong> \${emails.map(e => e.value).join(', ') || 'Not provided'}</p>
                    <p><strong>Phone:</strong> \${phones.map(p => p.value).join(', ') || 'Not provided'}</p>
                    <p><strong>Addresses:</strong> \${addresses.map(a => \`\${a.street || ''}, \${a.city || ''}, \${a.state || ''} \${a.postal_code || ''}\`).join('; ') || 'Not provided'}</p>
                    <p><strong>Source:</strong> \${person.source || 'Not specified'}</p>
                    <p><strong>Created:</strong> \${person.created ? new Date(person.created).toLocaleDateString() : 'Unknown'}</p>
                </div>
            \`;
        }

        // Display homebeats
        function displayHomebeats(homebeats) {
            const container = document.getElementById('homebeat-list');
            
            if (homebeats.length === 0) {
                container.innerHTML = '<p style="text-align: center; color: #718096; padding: 40px;">No Homebeat subscriptions found for this lead.</p>';
                return;
            }
            
            container.innerHTML = homebeats.map(homebeat => \`
                <div class="homebeat-item">
                    <div class="homebeat-header">
                        <div class="homebeat-address">\${homebeat.property_address || 'Unknown Address'}</div>
                        <div class="homebeat-status \${homebeat.status || 'pending'}">\${homebeat.status || 'pending'}</div>
                    </div>
                    <p><strong>Frequency:</strong> \${homebeat.frequency || 'quarterly'}</p>
                    <p><strong>Total Views:</strong> \${homebeat.total_views || 0}</p>
                    <p><strong>Last View:</strong> \${homebeat.last_view ? new Date(homebeat.last_view).toLocaleDateString() : 'Never'}</p>
                    <p><strong>Created:</strong> \${homebeat.created_at ? new Date(homebeat.created_at).toLocaleDateString() : 'Unknown'}</p>
                    
                    <div class="homebeat-actions">
                        <button class="btn btn-sm" onclick="resendHomebeat('\${homebeat.id}')">
                            Resend Homebeat
                        </button>
                    </div>
                </div>
            \`).join('');
        }

        // Resend homebeat
        async function resendHomebeat(homebeatId) {
            if (!currentPersonId) {
                showStatus('homebeat', 'error', 'Missing person context');
                return;
            }
            
            showLoading('homebeat');
            
            try {
                const response = await fetch(window.location.href, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        action: 'resendHomebeat',
                        homebeatId: homebeatId,
                        personId: currentPersonId
                    })
                });
                
                const result = await response.json();
                hideLoading('homebeat');
                
                if (result.success) {
                    showStatus('homebeat', 'success', 'Homebeat resent successfully!');
                    // Reload homebeats to show updated data
                    setTimeout(() => loadHomebeats(), 2000);
                } else {
                    showStatus('homebeat', 'error', result.error || 'Failed to resend homebeat');
                }
            } catch (error) {
                hideLoading('homebeat');
                showStatus('homebeat', 'error', 'Network error: ' + error.message);
            }
        }

        // Utility functions
        function showLoading(section) {
            document.getElementById(section + '-loading').style.display = 'block';
        }

        function hideLoading(section) {
            document.getElementById(section + '-loading').style.display = 'none';
        }

        function showStatus(section, type, message) {
            const statusElement = document.getElementById(section + '-status');
            statusElement.className = \`status \${type}\`;
            statusElement.textContent = message;
            statusElement.style.display = 'block';
            
            if (type === 'success') {
                setTimeout(() => hideStatus(section), 5000);
            }
        }

        function hideStatus(section) {
            document.getElementById(section + '-status').style.display = 'none';
        }
    </script>
</body>
</html>`;
}

// Get person data from FUB
async function getPersonData(personId, headers) {
    try {
        // Validate personId
        if (!personId || personId === 'null' || personId === 'undefined') {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing person_id parameter' })
            };
        }
        
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

        // CRITICAL: Validate personId exists
        if (!personId || personId === 'null' || personId === 'undefined') {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    error: 'Missing person_id. FUB context parameter not decoded correctly.',
                    debug: {
                        personId: personId,
                        allParams: Object.keys(params)
                    }
                })
            };
        }

        // Get person data for lead info
        const personData = await fubAPIRequest('GET', `/v1/people/${personId}`);

        // Generate unique job ID for webhook matching
        const jobId = `CMA_${Date.now()}_${personId}`;

        // Step 1: Get market value for Glenn's center range protocol
        let centerValue = null;
        let marketValue = null;
        
        try {
            // Call market value lookup (internal function)
            const marketData = await getMarketValueInternal(address);
            
            if (marketData && marketData.value) {
                marketValue = marketData.value;
                // Glenn's Protocol: Market Value × 1.024, round up to next $5K
                const calculated = marketValue * CENTER_RANGE_MULTIPLIER;
                centerValue = Math.ceil(calculated / 5000) * 5000;
                console.log(`WILLOW V50: Center Range Protocol - ${marketValue} × ${CENTER_RANGE_MULTIPLIER} = ${centerValue}`);
            }
        } catch (marketError) {
            console.warn('WILLOW V50: Market value lookup failed:', marketError.message);
            // Continue without center range suggestion
        }

        // Build CMA URL with job_id in callback
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
            notes: `Generated by WILLOW V50\nJob ID: ${jobId}`,
            callback_url: `${WEBHOOK_URL}?job_id=${encodeURIComponent(jobId)}`
        });

        const cmaUrl = `https://cloudcma.com/cmas/new?${cmaParams.toString()}`;

        // Update FUB custom fields
        const updatePayload = {
            customWILLOWCMADate: new Date().toISOString(),
            customWILLOWCMAAddress: address,
            customWILLOWCMALink: cmaUrl
            // Note: Job ID stored in CMA notes for webhook matching
        };
        
        // Add center value if available (Glenn's protocol)
        if (centerValue) {
            updatePayload.customWILLOWCenterValue = centerValue;
        }

        await fubAPIRequest('PUT', `/v1/people/${personId}`, updatePayload);

        // Create FUB activity note (using Notes API for proper timeline visibility)
        await fubAPIRequest('POST', '/v1/notes', {
            personId: parseInt(personId),
            subject: '🎯 WILLOW V50: CMA Generated',
            body: `CMA generated for ${address}

Template: ${params.template || 'Standard'}
Parameters: ${beds || 'auto'}bd/${baths || 'auto'}ba, ${sqft || 'auto'}sqft
Search: ${radius || '0.75'}mi radius, ${monthsBack || '9'} months back, min ${minListings || '10'} comps

CloudCMA URL: ${cmaUrl}
Job ID: ${jobId}

${params.notes || 'Generated via WILLOW V50 CMA Workbench'}`
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

                // Create FUB activity note for Homebeat (using Notes API)
                await fubAPIRequest('POST', '/v1/notes', {
                    personId: parseInt(personId),
                    subject: '🏠 WILLOW V50: Homebeat Created',
                    body: `Homebeat subscription created for ${address}

Frequency: ${homebeatFrequency || 'quarterly'}
Homebeat URL: ${homebeatUrl}

Lead will receive automated market updates with property value estimates and neighborhood insights.`,
                    // isExternal: true // Removed - not supported by FUB API
                });

            } catch (homebeatError) {
                console.error('Homebeat creation failed:', homebeatError);
            }
        }

        // Build response with conditional center range
        const response = {
            success: true,
            cmaUrl: cmaUrl,
            homebeatCreated: homebeatCreated,
            homebeatUrl: homebeatUrl,
            jobId: jobId,
            address: address
        };
        
        // Add center range suggestion only when market data validates as current
        if (centerValue) {
            response.suggested_center_range = centerValue;
            response.center_range_note = "Suggested center range based on current market data";
        }
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(response)
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
        // Validate personId
        if (!personId || personId === 'null' || personId === 'undefined') {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing person_id parameter' })
            };
        }
        
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

        // Validate personId
        if (!personId || personId === 'null' || personId === 'undefined') {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing person_id parameter' })
            };
        }

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

        // Create FUB activity note for Homebeat resend (using Notes API)
        await fubAPIRequest('POST', '/v1/notes', {
            personId: parseInt(personId),
            subject: '🔁 WILLOW V50: Homebeat Resent',
            body: `Homebeat resent for ${homebeat.property_address}

Previous Status: Pending (0 views)
Action: Manual resend triggered

Lead will receive a new Homebeat welcome email with the latest market data.`,
            // isExternal: true // Removed - not supported by FUB API
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

        // Validate personId
        if (!personId || personId === 'null' || personId === 'undefined') {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing person_id parameter' })
            };
        }

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

        // FUB tasks API doesn't accept description/body field
        // Task details should be added as a note after task creation
        const taskPayload = {
            personId: parseInt(personId),
            type: 'Follow Up',
            dueDate: dueDate.toISOString()
        };

        const taskResult = await fubAPIRequest('POST', '/v1/tasks', taskPayload);
        
        // Add task details as a note
        const notePayload = {
            personId: parseInt(personId),
            subject: `Task: ${taskDescription}`,
            body: `${taskDescription}\n\nAssigned to: ${assignedTo}\nUrgency: ${urgency}\nDue: ${dueDate.toLocaleDateString()}`,
            isHtml: false
        };
        await fubAPIRequest('POST', '/v1/notes', notePayload);

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

        // Validate personId
        if (!personId || personId === 'null' || personId === 'undefined') {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing person_id parameter' })
            };
        }

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
            // FUB tasks API doesn't accept description field
            const taskPayload = {
                personId: parseInt(personId),
                type: fubType,
                dueDate: dueDate.toISOString()
            };
            await fubAPIRequest('POST', '/v1/tasks', taskPayload);
            
            // Add action details as a note
            const notePayload = {
                personId: parseInt(personId),
                subject: `${fubType} Action`,
                body: `${notes}\n\nAssigned to: ${assignedTo}\nUrgency: ${urgency}`,
                isHtml: false
            };
            await fubAPIRequest('POST', '/v1/notes', notePayload);
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


// Market Value Lookup (External API endpoint)
async function getMarketValue(address, headers) {
    try {
        if (!address) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing address parameter' })
            };
        }
        
        const marketData = await getMarketValueInternal(address);
        
        if (marketData && marketData.value) {
            const centerRange = Math.ceil(marketData.value * CENTER_RANGE_MULTIPLIER / 5000) * 5000;
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    market_value: marketData.value,
                    suggested_center_range: centerRange,
                    data_source: marketData.source,
                    timestamp: new Date().toISOString()
                })
            };
        } else {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ 
                    error: 'Market data not available for this address',
                    message: 'No current market data found to validate center range'
                })
            };
        }
    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Market value lookup failed: ' + error.message })
        };
    }
}

// Internal Market Value Lookup (used by CMA generation)
async function getMarketValueInternal(address) {
    return new Promise((resolve, reject) => {
        // Call the existing zillow-zestimate function
        const options = {
            hostname: 'willow-v50-supervised-cma.netlify.app',
            path: `/.netlify/functions/zillow-zestimate?address=${encodeURIComponent(address)}`,
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000
        };
        
        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    if (res.statusCode === 200) {
                        const data = JSON.parse(body);
                        if (data.zestimate) {
                            resolve({
                                value: data.zestimate,
                                source: 'Market Data',
                                timestamp: new Date().toISOString()
                            });
                        } else {
                            resolve(null); // No market data available
                        }
                    } else {
                        resolve(null); // Market data not found
                    }
                } catch (e) {
                    resolve(null); // Parsing failed, no market data
                }
            });
        });
        
        req.on('error', () => resolve(null)); // Network error, no market data
        req.on('timeout', () => {
            req.destroy();
            resolve(null); // Timeout, no market data
        });
        
        req.end();
    });
}