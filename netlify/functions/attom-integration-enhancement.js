/**
 * ATTOM Data Integration Enhancement
 * Add this JavaScript to willow-v50-cma-workbench.html
 * 
 * Features:
 * - Auto-fill property data from ATTOM API
 * - FUB caching integration
 * - Real-time address lookup
 * - Data source indicators
 * - Error handling with fallback
 */

// ATTOM Integration State
const AttomState = {
  loading: false,
  lastLookup: null,
  cacheEnabled: true
};

/**
 * Auto-fill property data from ATTOM API
 */
async function autoFillPropertyData() {
  const addressInput = document.getElementById('propertyAddress');
  const address = addressInput?.value?.trim();

  if (!address) {
    showNotification('Please enter a property address first', 'warning');
    return;
  }

  // Show loading state
  setLoadingState(true);
  showNotification('Looking up property details...', 'info');

  try {
    // Get person ID from FUB context (if available)
    let personId = null;
    if (typeof EmbeddedApps !== 'undefined') {
      try {
        const context = await EmbeddedApps.getContext();
        personId = context?.person?.id;
      } catch (e) {
        console.warn('Could not get FUB context:', e);
      }
    }

    // Call ATTOM lookup function
    const params = new URLSearchParams({
      address: address,
      ...(personId && { personId: personId })
    });

    const response = await fetch(`/.netlify/functions/attom-property-lookup?${params}`);
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Property lookup failed');
    }

    if (result.success && result.data) {
      // Fill form fields with ATTOM data
      fillPropertyFields(result.data, result.source);
      
      // Show success message
      const sourceLabel = result.cached ? 'cached data' : 'ATTOM Data API';
      showNotification(`Property data loaded from ${sourceLabel}`, 'success');
      
      // Log to FUB activity (if personId available)
      if (personId) {
        logAttomLookupToFUB(personId, address, result.data, result.source);
      }
    }

  } catch (error) {
    console.error('ATTOM lookup error:', error);
    showNotification(`Property lookup failed: ${error.message}. Try manual entry.`, 'error');
    
    // Fall back to smart defaults
    if (confirm('Property not found in ATTOM database. Would you like to use Hudson Valley market defaults?')) {
      fillPropertyFields(getHudsonValleyDefaults(), 'MANUAL_DEFAULTS');
    }
  } finally {
    setLoadingState(false);
  }
}

/**
 * Fill form fields with property data
 */
function fillPropertyFields(data, source) {
  // Property Characteristics
  setFieldValue('beds', data.beds);
  setFieldValue('baths', data.baths);
  setFieldValue('sqft', data.sqft);
  setFieldValue('acres', data.acres);
  setFieldValue('garage', data.garage);
  setFieldValue('propertyType', data.propertyType);
  setFieldValue('yearBuilt', data.yearBuilt);
  setFieldValue('condition', data.condition);

  // Add data source indicators
  addDataSourceBadges(source);
  
  // Store metadata for later use
  AttomState.lastLookup = {
    data,
    source,
    timestamp: new Date().toISOString()
  };

  // Enable form fields (they might have been disabled)
  enableFormFields();
}

/**
 * Set field value with validation
 */
function setFieldValue(fieldId, value) {
  const field = document.getElementById(fieldId);
  if (field && value !== null && value !== undefined) {
    field.value = value;
    field.classList.add('auto-filled');
    
    // Trigger change event for any listeners
    field.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

/**
 * Add visual indicators showing data source
 */
function addDataSourceBadges(source) {
  const fields = ['beds', 'baths', 'sqft', 'acres', 'garage', 'propertyType', 'yearBuilt', 'condition'];
  
  const sourceLabels = {
    'ATTOM_API': '✓ ATTOM Data',
    'FUB_CACHE': '✓ Cached',
    'MANUAL_DEFAULTS': '⚠ Default Value'
  };

  const sourceLabel = sourceLabels[source] || source;
  const badgeClass = source === 'MANUAL_DEFAULTS' ? 'badge-warning' : 'badge-success';

  fields.forEach(fieldId => {
    const field = document.getElementById(fieldId);
    if (field && field.value) {
      // Remove existing badge
      const existingBadge = field.parentElement.querySelector('.data-source-badge');
      if (existingBadge) existingBadge.remove();

      // Add new badge
      const badge = document.createElement('span');
      badge.className = `data-source-badge ${badgeClass}`;
      badge.textContent = sourceLabel;
      badge.style.cssText = `
        display: inline-block;
        margin-left: 10px;
        padding: 2px 8px;
        font-size: 11px;
        border-radius: 4px;
        background: ${source === 'MANUAL_DEFAULTS' ? '#fbbf24' : '#10b981'};
        color: white;
        font-weight: 600;
      `;
      
      field.parentElement.querySelector('.form-label')?.appendChild(badge);
    }
  });
}

/**
 * Hudson Valley market defaults
 */
function getHudsonValleyDefaults() {
  return {
    beds: 3,
    baths: 2,
    sqft: 1800,
    acres: 0.25,
    garage: 2,
    propertyType: 'Single Family Residential',
    yearBuilt: 1985,
    condition: 'Average'
  };
}

/**
 * Set loading state
 */
function setLoadingState(loading) {
  AttomState.loading = loading;
  
  const lookupButton = document.getElementById('autoFillButton');
  if (lookupButton) {
    lookupButton.disabled = loading;
    lookupButton.textContent = loading ? '🔍 Looking up...' : '🔍 Auto-Fill Property Data';
    lookupButton.style.opacity = loading ? '0.6' : '1';
  }

  // Show/hide loading spinner
  const spinner = document.getElementById('attomSpinner');
  if (spinner) {
    spinner.style.display = loading ? 'block' : 'none';
  }
}

/**
 * Show notification message
 */
function showNotification(message, type = 'info') {
  const notification = document.getElementById('attomNotification');
  if (!notification) {
    // Create notification element if it doesn't exist
    const div = document.createElement('div');
    div.id = 'attomNotification';
    div.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      max-width: 400px;
      padding: 15px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      font-size: 14px;
      z-index: 10000;
      display: none;
    `;
    document.body.appendChild(div);
  }

  const notif = document.getElementById('attomNotification');
  
  const colors = {
    info: { bg: '#3b82f6', text: 'white' },
    success: { bg: '#10b981', text: 'white' },
    warning: { bg: '#f59e0b', text: 'white' },
    error: { bg: '#ef4444', text: 'white' }
  };

  const color = colors[type] || colors.info;
  notif.style.backgroundColor = color.bg;
  notif.style.color = color.text;
  notif.textContent = message;
  notif.style.display = 'block';

  // Auto-hide after 5 seconds
  setTimeout(() => {
    notif.style.display = 'none';
  }, 5000);
}

/**
 * Enable all form fields
 */
function enableFormFields() {
  const fields = ['beds', 'baths', 'sqft', 'acres', 'garage', 'propertyType', 'yearBuilt', 'condition'];
  fields.forEach(fieldId => {
    const field = document.getElementById(fieldId);
    if (field) field.disabled = false;
  });
}

/**
 * Log ATTOM lookup to FUB activity stream
 */
async function logAttomLookupToFUB(personId, address, data, source) {
  try {
    const noteContent = `
🏠 Property Data Auto-Fill (WILLOW V50)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Address: ${address}
Source: ${source}

Property Details:
• Bedrooms: ${data.beds || 'N/A'}
• Bathrooms: ${data.baths || 'N/A'}
• Square Feet: ${data.sqft ? data.sqft.toLocaleString() : 'N/A'}
• Lot Size: ${data.acres ? data.acres + ' acres' : 'N/A'}
• Year Built: ${data.yearBuilt || 'N/A'}
• Property Type: ${data.propertyType || 'N/A'}

Generated: ${new Date().toLocaleString()}
    `.trim();

    // Create FUB note via API
    await fetch(`https://api.followupboss.com/v1/people/${personId}/notes`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(FUB_API_KEY + ':')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        body: noteContent,
        subject: 'ATTOM Property Data Lookup'
      })
    });

    console.log('Logged ATTOM lookup to FUB activity');
  } catch (error) {
    console.warn('Failed to log to FUB:', error);
  }
}

// Export for use in HTML
if (typeof window !== 'undefined') {
  window.autoFillPropertyData = autoFillPropertyData;
  window.AttomState = AttomState;
}
