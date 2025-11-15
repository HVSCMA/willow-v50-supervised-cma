// WILLOW V50 Embedded App Controller
// For FUB sidebar integration

// Global state
let currentContext = null;
let currentLeadId = null;
let currentIntelligence = null;
let smartDefaults = null;

// Initialize on page load
window.addEventListener('DOMContentLoaded', async () => {
  try {
    // Get FUB context from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const contextParam = urlParams.get('context');
    const signatureParam = urlParams.get('signature');
    
    if (!contextParam || !signatureParam) {
      showError('Missing FUB Parameters', 'This app must be loaded from Follow Up Boss.');
      return;
    }
    
    // Verify FUB signature and parse context
    const verification = await verifyFUBContext(contextParam, signatureParam);
    
    if (!verification.valid) {
      showError('Security Verification Failed', 'Invalid signature from Follow Up Boss. Please contact support.');
      return;
    }
    
    currentContext = verification.context;
    currentLeadId = currentContext.person?.id;
    
    if (!currentLeadId) {
      showError('No Lead Data', 'Could not identify lead from Follow Up Boss context.');
      return;
    }
    
    // Load intelligence data
    await loadIntelligence();
    
    // Show app
    document.getElementById('loading').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    
    // Initialize parameter sliders
    initializeSliders();
    
    // Update sync status
    updateSyncStatus();
    
  } catch (error) {
    console.error('Initialization error:', error);
    showError('Initialization Failed', error.message);
  }
});

// Verify FUB signature and parse context
async function verifyFUBContext(contextB64, signature) {
  const response = await fetch('/.netlify/functions/verify-fub-signature', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      context: contextB64,
      signature: signature
    })
  });
  
  if (!response.ok) {
    throw new Error('Signature verification failed');
  }
  
  const result = await response.json();
  
  if (!result.valid) {
    throw new Error('Invalid signature');
  }
  
  // Decode context
  const contextJSON = atob(contextB64.replace(/-/g, '+').replace(/_/g, '/'));
  const context = JSON.parse(contextJSON);
  
  return {
    valid: true,
    context: context
  };
}

// Load intelligence data for current lead
async function loadIntelligence() {
  try {
    // Fetch behavioral scoring
    const scoreResponse = await fetch('/.netlify/functions/behavioral-scoring', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId: currentLeadId })
    });
    
    if (!scoreResponse.ok) {
      throw new Error('Failed to fetch behavioral scoring');
    }
    
    currentIntelligence = await scoreResponse.json();
    
    // Update UI with scoring data
    updateScoreDisplay();
    updateTriggerDisplay();
    
    // Fetch smart CMA defaults
    const address = currentContext.person?.address || 
                   (currentContext.person?.emails?.[0]?.value ? 
                    await getLeadAddress(currentLeadId) : null);
    
    if (address) {
      await loadSmartDefaults(address);
    }
    
  } catch (error) {
    console.error('Error loading intelligence:', error);
    throw error;
  }
}

// Update score display
function updateScoreDisplay() {
  if (!currentIntelligence) return;
  
  const { overallScore, priority, breakdown } = currentIntelligence;
  
  // Overall score
  document.getElementById('score-value').textContent = overallScore;
  
  // Priority badge
  const badge = document.getElementById('priority-badge');
  badge.textContent = priority;
  badge.className = `priority-badge priority-${priority.toLowerCase().replace('_', '-')}`;
  
  // Source breakdown
  document.getElementById('fello-score').textContent = breakdown.fello?.score || '--';
  document.getElementById('cloudcma-score').textContent = breakdown.cloudcma?.score || '--';
  document.getElementById('willow-score').textContent = breakdown.willow?.score || '--';
  document.getElementById('sierra-score').textContent = breakdown.sierra?.score || '--';
}

// Update trigger display
function updateTriggerDisplay() {
  if (!currentIntelligence?.triggers) return;
  
  const triggers = currentIntelligence.triggers.filter(t => t.triggered);
  const triggerCount = triggers.length;
  
  document.getElementById('trigger-count').textContent = triggerCount;
  
  const listEl = document.getElementById('trigger-list');
  
  if (triggerCount === 0) {
    listEl.innerHTML = '<div class="trigger-empty">No active triggers detected</div>';
    return;
  }
  
  listEl.innerHTML = triggers.slice(0, 3).map(trigger => `
    <div class="trigger-item">
      <div class="trigger-icon">${getTriggerIcon(trigger.pattern)}</div>
      <div class="trigger-content">
        <div class="trigger-title">${trigger.name}</div>
        <div class="trigger-detail">${trigger.detail || trigger.source}</div>
      </div>
    </div>
  `).join('');
}

// Get icon for trigger pattern
function getTriggerIcon(pattern) {
  const icons = {
    'cma_request': '📊',
    'property_view': '👁️',
    'saved_search': '🔖',
    'email_open': '📧',
    'form_submission': '📝',
    'showing_scheduled': '🏠',
    'high_engagement': '🔥',
    'geographic_focus': '📍'
  };
  return icons[pattern] || '🎯';
}

// Load smart CMA defaults
async function loadSmartDefaults(address) {
  try {
    const response = await fetch('/.netlify/functions/cma-smart-defaults', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: address,
        propertyValue: currentIntelligence?.propertyValue || null,
        leadId: currentLeadId
      })
    });
    
    if (!response.ok) {
      console.error('Failed to fetch smart defaults');
      return;
    }
    
    smartDefaults = await response.json();
    
    // Update UI
    if (smartDefaults.property) {
      updatePropertyDisplay(smartDefaults.property);
    }
    
    // Apply defaults to sliders
    applyDefaultsToSliders(smartDefaults.defaults);
    
    // Update reasoning text
    updateReasoningDisplay(smartDefaults.reasoning);
    
  } catch (error) {
    console.error('Error loading smart defaults:', error);
  }
}

// Update property display
function updatePropertyDisplay(property) {
  const section = document.getElementById('property-section');
  section.style.display = 'block';
  
  document.getElementById('property-address').textContent = property.address;
  document.getElementById('property-value').textContent = formatCurrency(property.value);
  document.getElementById('property-type').textContent = property.type;
}

// Apply defaults to sliders
function applyDefaultsToSliders(defaults) {
  if (!defaults) return;
  
  // Set slider values
  if (defaults.radius) {
    const slider = document.getElementById('radius-slider');
    slider.value = defaults.radius;
    updateSliderValue('radius', defaults.radius);
  }
  
  if (defaults.daysBack) {
    const slider = document.getElementById('days-slider');
    slider.value = defaults.daysBack;
    updateSliderValue('days', defaults.daysBack);
  }
  
  if (defaults.comps) {
    const slider = document.getElementById('comps-slider');
    slider.value = defaults.comps;
    updateSliderValue('comps', defaults.comps);
  }
  
  if (defaults.variance) {
    const slider = document.getElementById('variance-slider');
    slider.value = defaults.variance;
    updateSliderValue('variance', defaults.variance);
  }
}

// Update reasoning display
function updateReasoningDisplay(reasoning) {
  if (!reasoning) return;
  
  const text = `${reasoning.type || 'Smart defaults applied'}: ${reasoning.explanation || 'Optimized for your property type'}`;
  document.getElementById('reasoning-text').textContent = text;
}

// Initialize parameter sliders
function initializeSliders() {
  // Radius slider
  document.getElementById('radius-slider').addEventListener('input', (e) => {
    updateSliderValue('radius', e.target.value);
  });
  
  // Days slider
  document.getElementById('days-slider').addEventListener('input', (e) => {
    updateSliderValue('days', e.target.value);
  });
  
  // Comps slider
  document.getElementById('comps-slider').addEventListener('input', (e) => {
    updateSliderValue('comps', e.target.value);
  });
  
  // Variance slider
  document.getElementById('variance-slider').addEventListener('input', (e) => {
    updateSliderValue('variance', e.target.value);
  });
}

// Update slider value display
function updateSliderValue(param, value) {
  const displays = {
    'radius': () => `${value} mi`,
    'days': () => `${value} days`,
    'comps': () => value,
    'variance': () => `${value}%`
  };
  
  document.getElementById(`${param}-value`).textContent = displays[param]();
}

// Generate CMA
async function generateCMA() {
  const btn = document.getElementById('generate-cma-btn');
  const btnText = document.getElementById('cma-btn-text');
  
  try {
    // Disable button
    btn.disabled = true;
    btnText.textContent = 'Generating...';
    
    // Get current parameter values
    const params = {
      leadId: currentLeadId,
      address: smartDefaults?.property?.address || currentContext.person?.address,
      radius: parseFloat(document.getElementById('radius-slider').value),
      daysBack: parseInt(document.getElementById('days-slider').value),
      comps: parseInt(document.getElementById('comps-slider').value),
      variance: parseFloat(document.getElementById('variance-slider').value)
    };
    
    // Call CMA generation function
    const response = await fetch('/.netlify/functions/cloudcma-generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    
    if (!response.ok) {
      throw new Error('CMA generation failed');
    }
    
    const result = await response.json();
    
    // Success!
    btnText.innerHTML = '✓ CMA Generated';
    btn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
    
    // Sync to FUB
    await syncToFUB({
      cmaUrl: result.url,
      cmaDate: new Date().toISOString(),
      parameters: params
    });
    
    // Update sync status
    updateSyncStatus();
    
    // Reset button after 3 seconds
    setTimeout(() => {
      btnText.textContent = 'Generate CMA';
      btn.style.background = '';
      btn.disabled = false;
    }, 3000);
    
  } catch (error) {
    console.error('CMA generation error:', error);
    btnText.textContent = 'Generation Failed';
    btn.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
    
    setTimeout(() => {
      btnText.textContent = 'Generate CMA';
      btn.style.background = '';
      btn.disabled = false;
    }, 3000);
  }
}

// Sync to FUB
async function syncToFUB(data) {
  try {
    await fetch('/.netlify/functions/fub-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leadId: currentLeadId,
        updates: {
          customWillowLastCMADate: data.cmaDate,
          customWillowLastCMAUrl: data.cmaUrl,
          customWillowCMAParameters: JSON.stringify(data.parameters)
        }
      })
    });
  } catch (error) {
    console.error('FUB sync error:', error);
  }
}

// Update sync status
function updateSyncStatus() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit'
  });
  document.getElementById('last-sync').textContent = timeStr;
}

// Open full window
async function openFullWindow() {
  try {
    // Generate transition token
    const response = await fetch('/.netlify/functions/generate-transition-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leadId: currentLeadId,
        userId: currentContext.user?.id,
        context: 'embedded_transition'
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to generate transition token');
    }
    
    const { token } = await response.json();
    
    // Construct standalone URL
    const baseUrl = window.location.origin;
    const standaloneUrl = `${baseUrl}/dashboard.html?leadId=${currentLeadId}&token=${token}`;
    
    // Open in new window
    window.open(standaloneUrl, '_blank', 'width=1400,height=900,menubar=no,toolbar=no,location=no,status=no');
    
  } catch (error) {
    console.error('Failed to open full window:', error);
    alert('Failed to open full window. Please try again.');
  }
}

// Show error state
function showError(title, message) {
  document.getElementById('loading').style.display = 'none';
  document.getElementById('app').style.display = 'none';
  
  const errorEl = document.getElementById('error');
  errorEl.style.display = 'block';
  
  document.getElementById('error-title').textContent = title;
  document.getElementById('error-message').textContent = message;
}

// Utility: Format currency
function formatCurrency(value) {
  if (!value) return '--';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
}

// Utility: Get lead address from FUB API
async function getLeadAddress(leadId) {
  try {
    const response = await fetch(`/.netlify/functions/lead-search?id=${leadId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) return null;
    
    const lead = await response.json();
    return lead.address || lead.customFieldAddress || null;
  } catch (error) {
    console.error('Error fetching lead address:', error);
    return null;
  }
}
