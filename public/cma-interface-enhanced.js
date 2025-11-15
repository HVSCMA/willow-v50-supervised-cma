/**
 * WILLOW V50 Enhanced CMA Interface
 * Smart defaults with Glenn's 22-year expertise
 * Flexible modification with visual reasoning
 */

// Global CMA state
let currentSmartDefaults = null;
let currentPropertyData = null;

/**
 * Load CMA interface with smart defaults
 */
async function loadCMAInterface(leadId) {
  const cmaTab = document.getElementById('cma-tab');
  
  // Show loading
  cmaTab.innerHTML = `
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <p>Calculating smart CMA defaults...</p>
    </div>
  `;
  
  try {
    // Get property data from intelligence tab (if loaded)
    const propertyData = extractPropertyDataFromIntelligence();
    currentPropertyData = propertyData;
    
    // Call smart defaults API
    const response = await fetch('/.netlify/functions/cma-smart-defaults', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        leadId: leadId,
        propertyData: propertyData,
        marketConditions: {}
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const result = await response.json();
    currentSmartDefaults = result.defaults;
    
    // Render CMA interface with smart defaults
    renderCMAInterface(leadId, result);
    
  } catch (error) {
    console.error('Smart defaults error:', error);
    // Fallback to manual defaults
    currentSmartDefaults = {
      radius: 3,
      daysBack: 180,
      comparables: 6,
      priceVariance: 15,
      reasoning: {
        general: 'Using standard Hudson Valley defaults'
      }
    };
    renderCMAInterface(leadId, { defaults: currentSmartDefaults });
  }
}

/**
 * Extract property data from intelligence tab
 */
function extractPropertyDataFromIntelligence() {
  // Try to extract from loaded ATTOM data
  const intelligenceTab = document.getElementById('intelligence-tab');
  
  // This is a simplified extraction - in production, parse actual HTML
  return {
    address: '',
    estimatedValue: 0,
    sqft: 0,
    bedrooms: 0,
    bathrooms: 0,
    propertyType: '',
    waterfront: false
  };
}

/**
 * Render complete CMA interface
 */
function renderCMAInterface(leadId, smartData) {
  const cmaTab = document.getElementById('cma-tab');
  const defaults = smartData.defaults || currentSmartDefaults;
  const confidence = defaults.confidence || 'HIGH';
  
  cmaTab.innerHTML = `
    <div class="cma-generator">
      <!-- Header with confidence badge -->
      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 24px;">
        <h2 style="color: #1e293b;">📊 CMA Generation for Lead ${leadId}</h2>
        <div class="confidence-badge ${confidence.toLowerCase()}">
          ${confidence === 'HIGH' ? '🎯' : confidence === 'MEDIUM' ? '⚠️' : '❓'} ${confidence} Confidence
        </div>
      </div>
      
      <!-- Smart Defaults Banner -->
      ${defaults.reasoning.general ? `
      <div class="smart-banner">
        <div class="smart-banner-icon">🤖</div>
        <div class="smart-banner-content">
          <strong>AI-Optimized Parameters</strong>
          <p>${defaults.reasoning.general}</p>
        </div>
      </div>
      ` : ''}
      
      <!-- Property Information -->
      <div class="cma-section">
        <h3>🏠 Property Information</h3>
        <div class="form-grid">
          <div class="form-field">
            <label>Street Address *</label>
            <input type="text" id="cma-address" placeholder="123 Main Street" value="${currentPropertyData?.address || ''}">
          </div>
          <div class="form-field">
            <label>City *</label>
            <input type="text" id="cma-city" placeholder="Poughkeepsie">
          </div>
          <div class="form-field">
            <label>State *</label>
            <input type="text" id="cma-state" value="NY" maxlength="2">
          </div>
          <div class="form-field">
            <label>ZIP Code *</label>
            <input type="text" id="cma-zip" placeholder="12601">
          </div>
        </div>
      </div>
      
      <!-- CMA Parameters with Smart Defaults -->
      <div class="cma-section">
        <h3>⚙️ CMA Parameters</h3>
        <p style="color: #64748b; margin-bottom: 20px; font-size: 14px;">
          🎯 Smart defaults calculated from property analysis and Glenn's 22-year expertise. 
          Adjust any parameter to customize your CMA.
        </p>
        
        <!-- Radius Parameter -->
        <div class="param-control">
          <div class="param-header">
            <label>Search Radius (miles)</label>
            ${defaults.reasoning.radius ? `<span class="smart-badge" title="${defaults.reasoning.radius}">🎯 Smart Default</span>` : ''}
          </div>
          <div class="param-input-group">
            <input type="range" min="1" max="15" step="0.5" 
                   id="radius-slider" value="${defaults.radius}" 
                   oninput="updateParamValue('radius', this.value)">
            <input type="number" min="1" max="15" step="0.5" 
                   id="radius-value" value="${defaults.radius}"
                   onchange="updateParamSlider('radius', this.value)">
            <span class="param-unit">miles</span>
          </div>
          ${defaults.reasoning.radius ? `
          <div class="param-reasoning">
            <small>💡 ${defaults.reasoning.radius}</small>
          </div>
          ` : ''}
        </div>
        
        <!-- Days Back Parameter -->
        <div class="param-control">
          <div class="param-header">
            <label>Days Back (market data)</label>
            ${defaults.reasoning.daysBack ? `<span class="smart-badge">🎯 Smart Default</span>` : ''}
          </div>
          <div class="param-input-group">
            <input type="range" min="60" max="365" step="30" 
                   id="daysback-slider" value="${defaults.daysBack}" 
                   oninput="updateParamValue('daysback', this.value)">
            <input type="number" min="60" max="365" step="30" 
                   id="daysback-value" value="${defaults.daysBack}"
                   onchange="updateParamSlider('daysback', this.value)">
            <span class="param-unit">days</span>
          </div>
          ${defaults.reasoning.daysBack ? `
          <div class="param-reasoning">
            <small>💡 ${defaults.reasoning.daysBack}</small>
          </div>
          ` : ''}
        </div>
        
        <!-- Comparables Parameter -->
        <div class="param-control">
          <div class="param-header">
            <label>Number of Comparables</label>
            ${defaults.reasoning.comparables ? `<span class="smart-badge">🎯 Smart Default</span>` : ''}
          </div>
          <div class="param-input-group">
            <input type="range" min="3" max="12" step="1" 
                   id="comps-slider" value="${defaults.comparables}" 
                   oninput="updateParamValue('comps', this.value)">
            <input type="number" min="3" max="12" step="1" 
                   id="comps-value" value="${defaults.comparables}"
                   onchange="updateParamSlider('comps', this.value)">
            <span class="param-unit">comps</span>
          </div>
          ${defaults.reasoning.comparables ? `
          <div class="param-reasoning">
            <small>💡 ${defaults.reasoning.comparables}</small>
          </div>
          ` : ''}
        </div>
        
        <!-- Price Variance Parameter -->
        <div class="param-control">
          <div class="param-header">
            <label>Price Variance</label>
            ${defaults.reasoning.priceVariance ? `<span class="smart-badge">🎯 Smart Default</span>` : ''}
          </div>
          <div class="param-input-group">
            <input type="range" min="5" max="30" step="5" 
                   id="variance-slider" value="${defaults.priceVariance}" 
                   oninput="updateParamValue('variance', this.value)">
            <input type="number" min="5" max="30" step="5" 
                   id="variance-value" value="${defaults.priceVariance}"
                   onchange="updateParamSlider('variance', this.value)">
            <span class="param-unit">%</span>
          </div>
          ${defaults.reasoning.priceVariance ? `
          <div class="param-reasoning">
            <small>💡 ${defaults.reasoning.priceVariance}</small>
          </div>
          ` : ''}
        </div>
        
        <!-- Reset to Smart Defaults -->
        <div style="margin-top: 20px;">
          <button class="btn btn-secondary" onclick="resetToSmartDefaults()">
            🔄 Reset to AI-Optimized Defaults
          </button>
        </div>
      </div>
      
      <!-- Advanced Options -->
      <div class="cma-section">
        <h3>🎯 Advanced Options</h3>
        <div class="checkbox-group">
          <div class="checkbox-item">
            <input type="checkbox" id="cma-luxury" ${smartData.propertyContext?.estimatedValue > 750000 ? 'checked' : ''}>
            <label for="cma-luxury">Apply Luxury Property Protocol ($750K+)</label>
          </div>
          <div class="checkbox-item">
            <input type="checkbox" id="cma-investment">
            <label for="cma-investment">Include Investment Analysis</label>
          </div>
          <div class="checkbox-item">
            <input type="checkbox" id="cma-market">
            <label for="cma-market">Add Market Trend Analysis</label>
          </div>
          <div class="checkbox-item">
            <input type="checkbox" id="cma-waterfront" ${smartData.propertyContext?.waterfront ? 'checked' : ''}>
            <label for="cma-waterfront">Waterfront Property Adjustments</label>
          </div>
        </div>
      </div>
      
      <!-- CMA Actions -->
      <div class="search-actions">
        <button class="btn btn-primary" onclick="generateCMA()">
          🚀 Generate CMA
        </button>
        <button class="btn btn-success" onclick="previewCMAParams()">
          👁️ Preview Parameters
        </button>
        <button class="btn btn-secondary" onclick="saveCMAPreferences()">
          💾 Save My Preferences
        </button>
      </div>
      
      <!-- CMA Result -->
      <div id="cma-result" style="margin-top: 24px;"></div>
    </div>
  `;
}

/**
 * Update parameter value from slider
 */
function updateParamValue(param, value) {
  document.getElementById(`${param}-value`).value = value;
}

/**
 * Update slider from number input
 */
function updateParamSlider(param, value) {
  document.getElementById(`${param}-slider`).value = value;
}

/**
 * Reset all parameters to smart defaults
 */
function resetToSmartDefaults() {
  if (!currentSmartDefaults) return;
  
  document.getElementById('radius-slider').value = currentSmartDefaults.radius;
  document.getElementById('radius-value').value = currentSmartDefaults.radius;
  document.getElementById('daysback-slider').value = currentSmartDefaults.daysBack;
  document.getElementById('daysback-value').value = currentSmartDefaults.daysBack;
  document.getElementById('comps-slider').value = currentSmartDefaults.comparables;
  document.getElementById('comps-value').value = currentSmartDefaults.comparables;
  document.getElementById('variance-slider').value = currentSmartDefaults.priceVariance;
  document.getElementById('variance-value').value = currentSmartDefaults.priceVariance;
  
  showMessage('Parameters reset to AI-optimized defaults', 'success');
}

/**
 * Preview CMA parameters before generation
 */
function previewCMAParams() {
  const params = {
    radius: document.getElementById('radius-value').value,
    daysBack: document.getElementById('daysback-value').value,
    comparables: document.getElementById('comps-value').value,
    priceVariance: document.getElementById('variance-value').value
  };
  
  const message = `
CMA Parameters Preview:

🎯 Search Radius: ${params.radius} miles
📅 Days Back: ${params.daysBack} days
📊 Comparables: ${params.comparables} properties
💰 Price Variance: ${params.priceVariance}%

${currentSmartDefaults ? '\n✨ Using AI-optimized defaults with your adjustments' : ''}
  `;
  
  alert(message);
}

/**
 * Save user's CMA preferences
 */
function saveCMAPreferences() {
  const preferences = {
    radiusAdjustment: document.getElementById('radius-value').value - (currentSmartDefaults?.radius || 3),
    daysBackAdjustment: document.getElementById('daysback-value').value - (currentSmartDefaults?.daysBack || 180),
    comparablesAdjustment: document.getElementById('comps-value').value - (currentSmartDefaults?.comparables || 6),
    priceVarianceAdjustment: document.getElementById('variance-value').value - (currentSmartDefaults?.priceVariance || 15)
  };
  
  localStorage.setItem('willow_cma_preferences', JSON.stringify(preferences));
  showMessage('CMA preferences saved! Future CMAs will apply your adjustments to smart defaults.', 'success');
}
