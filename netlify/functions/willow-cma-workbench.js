/**
 * WILLOW V50 CMA WORKBENCH - COMPLETE IMPLEMENTATION
 * Integrates all backend functions for comprehensive CMA generation
 * 
 * Features:
 * - Address prepopulation from FUB person data
 * - ATTOM property data collection and validation 
 * - Zillow Zestimate center range value adjustment (× 1.024)
 * - Behavioral scoring integration
 * - CloudCMA API integration with comprehensive URL management
 * - Multi-property support with intelligent detection
 * - FUB custom field updates
 * 
 * @version 3.0.0 - COMPLETE SYSTEM
 * @date 2025-11-17
 */

const fetch = require('node-fetch');

// API Configuration
const FUB_API_KEY = 'fka_0oHt62NxmsExO6x69p08ix82zx8ii1hzrj';
const FUB_BASE_URL = 'https://api.followupboss.com/v1';
const CLOUDCMA_API_KEY = process.env.CLOUDCMA_API_KEY || '742f4a46e1780904da090d721a9bae7b';
const ATTOM_API_KEY = process.env.ATTOM_API_KEY || '83d56a0076ca0aeefd240b3d397ce708';

/**
 * Enhanced HTML template with complete functionality
 */
const HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WILLOW V50 CMA Workbench</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #1a202c; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .tabs { display: flex; border-bottom: 2px solid #e2e8f0; margin-bottom: 20px; }
        .tab { padding: 12px 24px; cursor: pointer; border: none; background: none; font-size: 16px; font-weight: 500; color: #64748b; border-bottom: 3px solid transparent; transition: all 0.2s; }
        .tab.active { color: #3b82f6; border-bottom-color: #3b82f6; }
        .tab:hover { color: #3b82f6; background: #f1f5f9; }
        .tab-content { display: none; }
        .tab-content.active { display: block; }
        .card { background: white; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 20px; }
        .form-group { margin-bottom: 20px; }
        .form-label { display: block; margin-bottom: 8px; font-weight: 600; color: #374151; }
        .form-input, .form-select { width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 16px; transition: border-color 0.2s; }
        .form-input:focus, .form-select:focus { outline: none; border-color: #3b82f6; }
        .btn { padding: 12px 24px; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; gap: 8px; }
        .btn-primary { background: #3b82f6; color: white; }
        .btn-primary:hover { background: #2563eb; }
        .btn-success { background: #10b981; color: white; }
        .btn-success:hover { background: #059669; }
        .btn-danger { background: #ef4444; color: white; }
        .btn-danger:hover { background: #dc2626; }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .property-selector { background: #f8fafc; border: 2px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 20px; }
        .property-count { background: #3b82f6; color: white; padding: 4px 8px; border-radius: 12px; font-size: 12px; margin-left: 8px; }
        .data-section { background: #f8fafc; border-left: 4px solid #3b82f6; padding: 16px; margin: 16px 0; border-radius: 0 8px 8px 0; }
        .url-section { border: 2px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 16px 0; }
        .agent-section { border-color: #10b981; background: #f0fdf4; }
        .client-section { border-color: #ef4444; background: #fef2f2; }
        .url-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-top: 12px; }
        .url-button { padding: 8px 16px; border: none; border-radius: 6px; font-size: 14px; cursor: pointer; transition: all 0.2s; }
        .url-edit { background: #3b82f6; color: white; }
        .url-edit:hover { background: #2563eb; }
        .url-live { background: #10b981; color: white; }
        .url-live:hover { background: #059669; }
        .url-pdf { background: #06b6d4; color: white; }
        .url-pdf:hover { background: #0891b2; }
        .url-copy { background: #ef4444; color: white; }
        .url-copy:hover { background: #dc2626; }
        .loading { text-align: center; padding: 40px; color: #64748b; }
        .spinner { display: inline-block; width: 20px; height: 20px; border: 3px solid #e5e7eb; border-top-color: #3b82f6; border-radius: 50%; animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .toast { position: fixed; top: 20px; right: 20px; background: #10b981; color: white; padding: 12px 20px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); transform: translateY(-100px); transition: transform 0.3s; z-index: 1000; }
        .toast.show { transform: translateY(0); }
        .error-message { background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; padding: 12px; border-radius: 8px; margin: 12px 0; }
    </style>
</head>
<body>
    <div class="container">
        <h1 style="text-align: center; margin-bottom: 30px; color: #1f2937;">WILLOW V50 CMA Workbench</h1>
        
        <div class="tabs">
            <button class="tab active" onclick="switchTab('template')">CMA Template</button>
            <button class="tab" onclick="switchTab('property')">Property Data</button>
            <button class="tab" onclick="switchTab('results')">CMA Results</button>
        </div>

        <!-- Template Selection Tab -->
        <div id="template-tab" class="tab-content active">
            <div class="card">
                <h2>Choose CMA Template Type</h2>
                <p>Select the appropriate template based on your client needs and timeline requirements.</p>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-top: 20px;">
                    <div class="card" style="cursor: pointer; border: 2px solid #e5e7eb;" onclick="selectTemplate('quick')">
                        <h3 style="color: #3b82f6;">Quick CMA</h3>
                        <p>Rapid automated generation for time-sensitive leads and competitive situations.</p>
                        <ul style="margin-top: 12px; padding-left: 20px; color: #64748b;">
                            <li>Delivered within 1 minute</li>
                            <li>Automated email delivery</li>
                            <li>Perfect for fast response</li>
                            <li>Uses 'Web Leads' template</li>
                        </ul>
                    </div>
                    <div class="card" style="cursor: pointer; border: 2px solid #e5e7eb;" onclick="selectTemplate('website')">
                        <h3 style="color: #10b981;">Website CMA</h3>
                        <p>Interactive live report for lead education and market engagement.</p>
                        <ul style="margin-top: 12px; padding-left: 20px; color: #64748b;">
                            <li>Interactive live report</li>
                            <li>Similar to Homebeat emails</li>
                            <li>Great for lead nurturing</li>
                            <li>Real-time market data</li>
                        </ul>
                    </div>
                    <div class="card" style="cursor: pointer; border: 2px solid #e5e7eb;" onclick="selectTemplate('full')">
                        <h3 style="color: #f59e0b;">Full CMA</h3>
                        <p>Comprehensive manual completion for listing presentations and detailed analysis.</p>
                        <ul style="margin-top: 12px; padding-left: 20px; color: #64748b;">
                            <li>Complete customization</li>
                            <li>Manual agent completion</li>
                            <li>Professional presentation</li>
                            <li>Detailed market analysis</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>

        <!-- Property Data Tab -->
        <div id="property-tab" class="tab-content">
            <div class="card">
                <h2>Property Information</h2>
                <p>Enter the property details for CMA generation. Address will be auto-populated from FUB if available.</p>
                
                <div id="property-selector" class="property-selector" style="display: none;">
                    <label class="form-label">🏘️ Multiple Properties Detected <span id="property-count" class="property-count">0</span></label>
                    <select id="property-dropdown" class="form-select">
                        <option value="">Select a property...</option>
                    </select>
                    <button type="button" class="btn btn-primary" style="margin-top: 12px;" onclick="addNewProperty()">+ Add New Property</button>
                </div>

                <div class="form-group">
                    <label for="property-address" class="form-label">Property Address</label>
                    <input type="text" id="property-address" class="form-input" placeholder="123 Main Street, City, State ZIP">
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                    <div class="form-group">
                        <label for="radius" class="form-label">Search Radius</label>
                        <select id="radius" class="form-select">
                            <option value="0.25">0.25 miles</option>
                            <option value="0.5">0.5 miles</option>
                            <option value="0.75" selected>0.75 miles</option>
                            <option value="1.0">1.0 mile</option>
                            <option value="1.5">1.5 miles</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="months-back" class="form-label">Months Back</label>
                        <select id="months-back" class="form-select">
                            <option value="6">6 months</option>
                            <option value="12" selected>12 months</option>
                            <option value="18">18 months</option>
                            <option value="24">24 months</option>
                        </select>
                    </div>
                </div>

                <button class="btn btn-primary" onclick="loadPropertyData()">
                    <span class="spinner" id="property-spinner" style="display: none;"></span>
                    Load Property Data
                </button>

                <div id="property-data" class="data-section" style="display: none;">
                    <h3>Property Intelligence</h3>
                    <div id="property-details"></div>
                </div>

                <div id="attom-data" class="data-section" style="display: none;">
                    <h3>ATTOM Property Data</h3>
                    <div id="attom-details"></div>
                </div>

                <div id="zillow-data" class="data-section" style="display: none;">
                    <h3>Zillow Zestimate (Center Range Value)</h3>
                    <div id="zillow-details"></div>
                </div>
            </div>
        </div>

        <!-- Results Tab -->
        <div id="results-tab" class="tab-content">
            <div class="card">
                <h2>Generate CMA</h2>
                <p>Review property data and generate your comprehensive CMA report.</p>

                <div class="form-group">
                    <label class="form-label">Selected Property</label>
                    <div id="selected-property" class="form-input" style="background: #f8fafc;">No property selected</div>
                </div>

                <div class="form-group">
                    <label class="form-label">Center Range Value (Zillow × 1.024)</label>
                    <div id="center-range-value" class="form-input" style="background: #f8fafc;">Not calculated</div>
                </div>

                <button class="btn btn-success" onclick="generateCMA()" id="generate-btn">
                    <span class="spinner" id="cma-spinner" style="display: none;"></span>
                    Generate CMA
                </button>

                <div id="cma-results" style="display: none;">
                    <div class="url-section agent-section">
                        <h3 style="color: #059669;">🛡️ Agent URLs (Analytics-Safe)</h3>
                        <p>These URLs are safe for internal agent use and will not contaminate client analytics.</p>
                        <div class="url-grid">
                            <button class="url-button url-edit" onclick="openAgentURL('edit')">Edit CMA</button>
                            <button class="url-button url-live" onclick="openAgentURL('live')">Agent Live</button>
                            <button class="url-button url-pdf" onclick="openAgentURL('pdf')">Agent PDF</button>
                        </div>
                    </div>

                    <div class="url-section client-section">
                        <h3 style="color: #dc2626;">📧 Client URLs (Delivery & Analytics)</h3>
                        <p>These URLs are for client delivery and will track engagement analytics.</p>
                        <div class="url-grid">
                            <button class="url-button url-copy" onclick="copyClientURL('live')">Copy Live URL</button>
                            <button class="url-button url-copy" onclick="copyClientURL('pdf')">Copy PDF URL</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div id="toast" class="toast"></div>

    <script>
        // Global state
        let currentPersonId = null;
        let currentTemplate = null;
        let propertyData = null;
        let cmaUrls = null;

        // Initialize
        document.addEventListener('DOMContentLoaded', function() {
            // Extract person_id from URL parameters
            const urlParams = new URLSearchParams(window.location.search);
            currentPersonId = urlParams.get('person_id');
            
            if (currentPersonId) {
                loadPersonData(currentPersonId);
            }
        });

        function switchTab(tabName) {
            // Update tab buttons
            document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
            event.target.classList.add('active');
            
            // Update tab content
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            document.getElementById(tabName + '-tab').classList.add('active');
        }

        function selectTemplate(template) {
            currentTemplate = template;
            
            // Visual feedback
            document.querySelectorAll('#template-tab .card').forEach(card => {
                card.style.border = '2px solid #e5e7eb';
            });
            event.currentTarget.style.border = '2px solid #3b82f6';
            
            // Switch to property tab
            switchTab('property');
            
            showToast('CMA template selected: ' + template.charAt(0).toUpperCase() + template.slice(1));
        }

        async function loadPersonData(personId) {
            try {
                console.log('Loading FUB person data:', personId);
                
                const response = await fetch('/.netlify/functions/behavioral-scoring', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ personId: personId })
                });
                
                const data = await response.json();
                
                if (data.success && data.person) {
                    populatePersonData(data.person);
                }
            } catch (error) {
                console.error('Error loading person data:', error);
            }
        }

        function populatePersonData(person) {
            // Collect all potential addresses
            let addresses = [];
            
            // Standard FUB addresses
            if (person.addresses && person.addresses.length > 0) {
                addresses.push(...person.addresses.map(addr => addr.address));
            }
            
            // WILLOW CMA history
            if (person.customWILLOWCMAAddress) {
                addresses.push(person.customWILLOWCMAAddress);
            }
            
            // Fello property address
            if (person.customFelloPropertyAddress) {
                addresses.push(person.customFelloPropertyAddress);
            }
            
            // Deduplicate and filter
            addresses = [...new Set(addresses)].filter(addr => addr && addr.length > 10);
            
            if (addresses.length > 1) {
                // Show property selector
                showPropertySelector(addresses);
            } else if (addresses.length === 1) {
                // Auto-fill single address
                document.getElementById('property-address').value = addresses[0];
            }
        }

        function showPropertySelector(addresses) {
            const selector = document.getElementById('property-selector');
            const dropdown = document.getElementById('property-dropdown');
            const count = document.getElementById('property-count');
            
            // Clear existing options
            dropdown.innerHTML = '<option value="">Select a property...</option>';
            
            // Add addresses
            addresses.forEach(address => {
                const option = document.createElement('option');
                option.value = address;
                option.textContent = address;
                dropdown.appendChild(option);
            });
            
            // Update count and show
            count.textContent = addresses.length;
            selector.style.display = 'block';
            
            // Handle selection
            dropdown.addEventListener('change', function() {
                if (this.value) {
                    document.getElementById('property-address').value = this.value;
                }
            });
        }

        function addNewProperty() {
            document.getElementById('property-address').value = '';
            document.getElementById('property-address').focus();
        }

        async function loadPropertyData() {
            const address = document.getElementById('property-address').value;
            if (!address) {
                showError('Please enter a property address');
                return;
            }
            
            const spinner = document.getElementById('property-spinner');
            const button = event.target;
            
            try {
                spinner.style.display = 'inline-block';
                button.disabled = true;
                
                // Load ATTOM data
                await loadATTOMData(address);
                
                // Load Zillow data
                await loadZillowData(address);
                
                // Update results tab
                updateResultsTab(address);
                
                showToast('Property data loaded successfully');
                
            } catch (error) {
                console.error('Error loading property data:', error);
                showError('Failed to load property data: ' + error.message);
            } finally {
                spinner.style.display = 'none';
                button.disabled = false;
            }
        }

        async function loadATTOMData(address) {
            try {
                const response = await fetch('/.netlify/functions/attom-property-lookup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ address: address })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    displayATTOMData(data.property);
                    document.getElementById('attom-data').style.display = 'block';
                }
            } catch (error) {
                console.warn('ATTOM data unavailable:', error);
            }
        }

        async function loadZillowData(address) {
            try {
                const response = await fetch('/.netlify/functions/zillow-zestimate?' + new URLSearchParams({
                    address: address
                }));
                
                const data = await response.json();
                
                if (data.success && data.zestimate) {
                    const centerValue = Math.round(data.zestimate * 1.024 / 5000) * 5000;
                    displayZillowData(data.zestimate, centerValue);
                    document.getElementById('zillow-data').style.display = 'block';
                }
            } catch (error) {
                console.warn('Zillow data unavailable:', error);
            }
        }

        function displayATTOMData(property) {
            const container = document.getElementById('attom-details');
            container.innerHTML = \`
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
                    <div><strong>AVM:</strong> $\${property.avm?.toLocaleString() || 'N/A'}</div>
                    <div><strong>Confidence:</strong> \${property.avmConfidence || 'N/A'}</div>
                    <div><strong>Year Built:</strong> \${property.yearBuilt || 'N/A'}</div>
                    <div><strong>Sq Ft:</strong> \${property.sqFt?.toLocaleString() || 'N/A'}</div>
                    <div><strong>Bedrooms:</strong> \${property.bedrooms || 'N/A'}</div>
                    <div><strong>Bathrooms:</strong> \${property.bathrooms || 'N/A'}</div>
                </div>
            \`;
        }

        function displayZillowData(zestimate, centerValue) {
            const container = document.getElementById('zillow-details');
            container.innerHTML = \`
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
                    <div><strong>Zestimate:</strong> $\${zestimate.toLocaleString()}</div>
                    <div><strong>Center Value (× 1.024):</strong> $\${centerValue.toLocaleString()}</div>
                    <div><strong>Adjustment:</strong> +\${((centerValue - zestimate) / zestimate * 100).toFixed(1)}%</div>
                    <div><strong>Rounded to:</strong> $5,000</div>
                </div>
            \`;
            
            // Store center value globally
            window.centerRangeValue = centerValue;
        }

        function updateResultsTab(address) {
            document.getElementById('selected-property').textContent = address;
            
            if (window.centerRangeValue) {
                document.getElementById('center-range-value').textContent = 
                    '$' + window.centerRangeValue.toLocaleString();
            }
        }

        async function generateCMA() {
            const address = document.getElementById('property-address').value;
            if (!address) {
                showError('Please select a property first');
                return;
            }
            
            const spinner = document.getElementById('cma-spinner');
            const button = document.getElementById('generate-btn');
            
            try {
                spinner.style.display = 'inline-block';
                button.disabled = true;
                
                const requestData = {
                    address: address,
                    template: currentTemplate || 'full',
                    personId: currentPersonId,
                    centerRangeValue: window.centerRangeValue,
                    radius: document.getElementById('radius').value,
                    monthsBack: document.getElementById('months-back').value
                };
                
                const response = await fetch('/.netlify/functions/cloudcma-generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestData)
                });
                
                const data = await response.json();
                
                if (data.success) {
                    cmaUrls = data.urls;
                    displayCMAResults(data);
                    showToast('CMA generated successfully!');
                    switchTab('results');
                } else {
                    throw new Error(data.message || 'CMA generation failed');
                }
                
            } catch (error) {
                console.error('Error generating CMA:', error);
                showError('Failed to generate CMA: ' + error.message);
            } finally {
                spinner.style.display = 'none';
                button.disabled = false;
            }
        }

        function displayCMAResults(data) {
            document.getElementById('cma-results').style.display = 'block';
            // URLs are handled by the button click functions
        }

        function openAgentURL(type) {
            if (!cmaUrls) return;
            
            let url;
            switch(type) {
                case 'edit': url = cmaUrls.editUrl; break;
                case 'live': url = cmaUrls.liveUrl + '?preview=agent'; break;
                case 'pdf': url = cmaUrls.pdfUrl + '?preview=agent'; break;
            }
            
            if (url) {
                window.open(url, '_blank');
                showToast('Agent URL opened safely');
            }
        }

        function copyClientURL(type) {
            if (!cmaUrls) return;
            
            const url = type === 'live' ? cmaUrls.liveUrl : cmaUrls.pdfUrl;
            
            if (url && navigator.clipboard) {
                navigator.clipboard.writeText(url).then(() => {
                    showToast('Client URL copied to clipboard');
                });
            }
        }

        function showToast(message) {
            const toast = document.getElementById('toast');
            toast.textContent = message;
            toast.classList.add('show');
            setTimeout(() => toast.classList.remove('show'), 3000);
        }

        function showError(message) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            errorDiv.textContent = message;
            
            const container = document.querySelector('.tab-content.active .card');
            container.insertBefore(errorDiv, container.firstChild);
            
            setTimeout(() => errorDiv.remove(), 5000);
        }
    </script>
</body>
</html>`;

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'text/html'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod === 'GET') {
    return {
      statusCode: 200,
      headers,
      body: HTML_TEMPLATE
    };
  }

  // Handle POST requests for CMA generation
  if (event.httpMethod === 'POST') {
    try {
      const requestBody = JSON.parse(event.body || '{}');
      const { address, template, personId, centerRangeValue, radius, monthsBack } = requestBody;

      if (!address) {
        return {
          statusCode: 400,
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Address is required' })
        };
      }

      // Call CloudCMA API
      const cmaResponse = await fetch('https://willow-v50-supervised-cma.netlify.app/.netlify/functions/cloudcma-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          template: template || 'full',
          centerRangeValue,
          radius: radius || '0.75',
          monthsBack: monthsBack || '12'
        })
      });

      const cmaData = await cmaResponse.json();

      if (cmaData.success) {
        // Update FUB custom fields if personId provided
        if (personId) {
          await updateFUBFields(personId, {
            customWILLOWCMADate: new Date().toISOString(),
            customWILLOWCMAAddress: address,
            customWILLOWCMALink: cmaData.urls?.editUrl,
            customWILLOWCMALiveURL: cmaData.urls?.liveUrl,
            customWILLOWCMAPDFURL: cmaData.urls?.pdfUrl
          });
        }

        return {
          statusCode: 200,
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: true,
            urls: cmaData.urls,
            message: 'CMA generated successfully with complete functionality'
          })
        };
      } else {
        throw new Error(cmaData.message || 'CloudCMA generation failed');
      }

    } catch (error) {
      console.error('CMA Workbench Error:', error);
      return {
        statusCode: 500,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'CMA generation failed',
          message: error.message
        })
      };
    }
  }

  return {
    statusCode: 405,
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: 'Method not allowed' })
  };
};

/**
 * Update FUB custom fields
 */
async function updateFUBFields(personId, fields) {
  try {
    const auth = Buffer.from(`${FUB_API_KEY}:`).toString('base64');
    
    const response = await fetch(`${FUB_BASE_URL}/people/${personId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(fields)
    });

    if (response.ok) {
      console.log('✅ FUB fields updated successfully');
    } else {
      console.error('❌ FUB update failed:', response.status, response.statusText);
    }
  } catch (error) {
    console.error('❌ FUB update error:', error);
  }
}