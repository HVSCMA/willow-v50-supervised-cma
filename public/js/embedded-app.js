// WILLOW V50 Embedded App Controller
// For FUB sidebar integration

// Enhanced error logging
console.log('🎯 WILLOW Embedded App - Initializing...');

// Global state
let currentContext = null;
let currentLeadId = null;
let currentIntelligence = null;
let smartDefaults = null;

// Show error state
function showError(title, message) {
  console.error('❌ WILLOW Error:', title, message);
  
  document.getElementById('loading').style.display = 'none';
  document.getElementById('app').style.display = 'none';
  
  const errorEl = document.getElementById('error');
  errorEl.style.display = 'block';
  
  document.getElementById('error-title').textContent = title;
  document.getElementById('error-message').textContent = message;
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', async () => {
  console.log('✅ DOM Content Loaded');
  
  try {
    // Log current URL for debugging
    console.log('📍 Current URL:', window.location.href);
    
    // Get FUB context from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const contextParam = urlParams.get('context');
    const signatureParam = urlParams.get('signature');
    
    console.log('🔑 Context param present:', !!contextParam);
    console.log('🔑 Signature param present:', !!signatureParam);
    
    if (!contextParam || !signatureParam) {
      console.warn('⚠️ Missing FUB parameters - showing error');
      showError('Missing FUB Parameters', 'This app must be loaded from Follow Up Boss with context and signature parameters.');
      return;
    }
    
    console.log('🔐 Verifying FUB context...');
    
    // Verify FUB signature and parse context
    const verification = await verifyFUBContext(contextParam, signatureParam);
    
    console.log('✅ Verification result:', verification);
    
    if (!verification.valid) {
      showError('Security Verification Failed', 'Invalid signature from Follow Up Boss. Please contact support.');
      return;
    }
    
    currentContext = verification.context;
    currentLeadId = currentContext.person?.id;
    
    console.log('👤 Lead ID extracted:', currentLeadId);
    
    if (!currentLeadId) {
      showError('No Lead Data', 'Could not identify lead from Follow Up Boss context.');
      return;
    }
    
    console.log('📊 Loading intelligence data...');
    
    // Load intelligence data
    await loadIntelligence();
    
    console.log('✅ Intelligence loaded successfully');
    
    // Show app
    document.getElementById('loading').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    
    console.log('✅ App UI displayed');
    
    // Initialize parameter sliders
    initializeSliders();
    
    // Update sync status
    updateSyncStatus();
    
    console.log('🎉 WILLOW Embedded App initialized successfully!');
    
  } catch (error) {
    console.error('💥 Initialization error:', error);
    console.error('Stack trace:', error.stack);
    showError('Initialization Failed', `${error.message} - Check browser console for details.`);
  }
});

// Verify FUB signature and parse context
async function verifyFUBContext(contextB64, signature) {
  console.log('🔐 Calling verify-fub-signature function...');
  
  try {
    const response = await fetch('/.netlify/functions/verify-fub-signature', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: contextB64,
        signature: signature
      })
    });
    
    console.log('📡 Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Verification failed:', errorText);
      throw new Error(`Signature verification failed: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('✅ Verification result:', result);
    
    if (!result.valid) {
      throw new Error('Invalid signature');
    }
    
    // Decode context
    console.log('📦 Decoding base64 context...');
    const contextJSON = atob(contextB64.replace(/-/g, '+').replace(/_/g, '/'));
    const context = JSON.parse(contextJSON);
    
    console.log('✅ Context decoded:', context);
    
    return {
      valid: true,
      context: context
    };
  } catch (error) {
    console.error('💥 verifyFUBContext error:', error);
    throw error;
  }
}

// Load intelligence data for current lead
async function loadIntelligence() {
  console.log('📊 Loading intelligence for lead:', currentLeadId);
  
  try {
    // Fetch behavioral scoring
    console.log('📡 Fetching behavioral scoring...');
    const scoreResponse = await fetch(`/.netlify/functions/behavioral-scoring?personId=${currentLeadId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!scoreResponse.ok) {
      console.error('❌ Behavioral scoring failed:', scoreResponse.status);
      throw new Error('Failed to fetch behavioral scoring');
    }
    
    currentIntelligence = await scoreResponse.json();
    console.log('✅ Intelligence loaded:', currentIntelligence);
    
    // Update UI with scoring data
    updateScoreDisplay();
    updateTriggerDisplay();
    
    // Try to get address for smart defaults from multiple sources
    let address = null;
    
    // 1. Check FUB person data first
    if (currentContext.person?.address) {
      address = currentContext.person.address;
    }
    
    // 2. Check custom fields
    if (!address && currentIntelligence.customFields) {
      address = currentIntelligence.customFields.customWILLOWCMAAddress || 
                currentIntelligence.customFields.customAddress || null;
    }
    
    // 3. Try to fetch from FUB API
    if (!address) {
      address = await getLeadAddress(currentLeadId);
    }
    
    console.log('🏠 Address for smart defaults:', address);
    
    if (address) {
      console.log('🏠 Loading smart defaults for address:', address);
      await loadSmartDefaults(address);
    } else {
      console.warn('⚠️ No address found for smart defaults');
    }
    
  } catch (error) {
    console.error('💥 Error loading intelligence:', error);
    throw error;
  }
}

// Update score display
function updateScoreDisplay() {
  console.log('📊 Updating score display...');
  
  if (!currentIntelligence) {
    console.warn('⚠️ No intelligence data to display');
    return;
  }
  
  // behavioral-scoring returns: enhancedBehavioralScore, priority, breakdown
  const score = currentIntelligence.enhancedBehavioralScore;
  const priority = currentIntelligence.priority;
  const breakdown = currentIntelligence.breakdown;
  
  // Overall score
  document.getElementById('score-value').textContent = score || '--';
  
  // Priority badge
  const badge = document.getElementById('priority-badge');
  badge.textContent = priority || 'UNKNOWN';
  badge.className = `priority-badge priority-${(priority || 'unknown').toLowerCase().replace('_', '-')}`;
  
  // Source breakdown (breakdown has: fello, cloudCMA, willow, sierra)
  document.getElementById('fello-score').textContent = breakdown?.fello || '--';
  document.getElementById('cloudcma-score').textContent = breakdown?.cloudCMA || '--';
  document.getElementById('willow-score').textContent = breakdown?.willow || '--';
  document.getElementById('sierra-score').textContent = breakdown?.sierra || '--';
  
  console.log('✅ Score display updated');
}

// Update trigger display
function updateTriggerDisplay() {
  console.log('🎯 Updating trigger display...');
  
  // behavioral-scoring returns activeTriggers as an array of strings
  const triggers = currentIntelligence?.activeTriggers || [];
  const triggerCount = triggers.length;
  
  console.log(`Found ${triggerCount} active triggers`);
  
  document.getElementById('trigger-count').textContent = triggerCount;
  
  const listEl = document.getElementById('trigger-list');
  
  if (triggerCount === 0) {
    listEl.innerHTML = '<div class="trigger-empty">No active triggers detected</div>';
    return;
  }
  
  // activeTriggers is an array of strings like ['High Fello Engagement', 'Recent CMA View']
  listEl.innerHTML = triggers.slice(0, 3).map(triggerName => `
    <div class="trigger-item">
      <div class="trigger-icon">${getTriggerIcon(triggerName)}</div>
      <div class="trigger-content">
        <div class="trigger-title">${triggerName}</div>
      </div>
    </div>
  `).join('');
  
  console.log('✅ Trigger display updated');
}

// Get icon for trigger name
function getTriggerIcon(triggerName) {
  // Match trigger names to icons
  if (triggerName.includes('Fello') || triggerName.includes('Engagement')) return '🔥';
  if (triggerName.includes('CMA') || triggerName.includes('Homebeat')) return '📊';
  if (triggerName.includes('Luxury') || triggerName.includes('Property')) return '💎';
  if (triggerName.includes('View') || triggerName.includes('Showing')) return '👁️';
  return '⚡'; // default icon
  
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
  console.log('🎛️ Loading smart defaults for:', address);
  
  try {
    const response = await fetch('/.netlify/functions/cma-smart-defaults-embedded', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leadId: currentLeadId,
        address: address
      })
    });
    
    if (!response.ok) {
      console.error('❌ Smart defaults failed:', response.status);
      return;
    }
    
    const data = await response.json();
    console.log('✅ Smart defaults loaded:', data);
    
    smartDefaults = data;
    
    // Update UI with property data
    if (data.property && data.property.address) {
      updatePropertyDisplay(data.property);
    }
    
    // Apply defaults to sliders
    if (data.defaults) {
      applyDefaultsToSliders(data.defaults);
    }
    
    // Update reasoning text
    if (data.defaults && data.defaults.reasoning) {
      updateReasoningDisplay(data.defaults.reasoning);
    }
    
  } catch (error) {
    console.error('💥 Error loading smart defaults:', error);
  }
}

// Update property display
function updatePropertyDisplay(property) {
  console.log('🏠 Updating property display', property);
  
  const section = document.getElementById('property-section');
  section.style.display = 'block';
  
  document.getElementById('property-address').textContent = property.address || 'No address available';
  document.getElementById('property-value').textContent = formatCurrency(property.estimatedValue || property.value);
  document.getElementById('property-type').textContent = property.propertyType || property.type || 'Residential';
}

// Apply defaults to sliders
function applyDefaultsToSliders(defaults) {
  console.log('🎛️ Applying defaults to sliders:', defaults);
  
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
  const text = `${reasoning.type || 'Smart defaults applied'}: ${reasoning.explanation || 'Optimized for your property type'}`;
  document.getElementById('reasoning-text').textContent = text;
}

// Initialize parameter sliders
function initializeSliders() {
  console.log('🎛️ Initializing parameter sliders...');
  
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
  
  console.log('✅ Sliders initialized');
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
  console.log('📊 Generating CMA...');
  
  const btn = document.getElementById('generate-cma-btn');
  const btnText = document.getElementById('cma-btn-text');
  
  try {
    // Disable button
    btn.disabled = true;
    btnText.textContent = 'Generating...';
    
    // Get current parameter values
    const property = smartDefaults?.property || {};
    const params = {
      // Required by cloudcma-generate.js
      address: property.address || currentContext.person?.address || '',
      centerValue: property.value || null,
      beds: property.beds || null,
      baths: property.baths || null,
      sqft: property.sqft || null,
      propertyType: property.type || null,
      radius: parseFloat(document.getElementById('radius-slider').value),
      daysBack: parseInt(document.getElementById('days-slider').value),
      comparableCount: parseInt(document.getElementById('comps-slider').value),
      title: `CMA Report - ${property.address || currentContext.person?.name || 'Property'}`,
      notes: `Generated from WILLOW V50 for ${currentContext.person?.name || 'Lead'} | Variance: ${parseFloat(document.getElementById('variance-slider').value)}%`,
      // Also pass FUB data for sync
      leadId: currentLeadId,
      variance: parseFloat(document.getElementById('variance-slider').value)
    };
    
    console.log('📤 CMA parameters:', params);
    
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
    console.log('✅ CMA generated:', result);
    
    // Open CloudCMA in new tab
    if (result.cma && result.cma.editUrl) {
      window.open(result.cma.editUrl, '_blank');
    }
    
    // Success!
    btnText.innerHTML = '✓ CMA Generated';
    btn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
    
    // Sync to FUB
    await syncToFUB({
      cmaUrl: result.cma?.editUrl || '',
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
    console.error('💥 CMA generation error:', error);
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
  console.log('🔄 Syncing to FUB...', data);
  
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
    console.log('✅ FUB sync complete');
  } catch (error) {
    console.error('💥 FUB sync error:', error);
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
  console.log('🚀 Opening full window...');
  
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
    
    console.log('🌐 Opening:', standaloneUrl);
    
    // Open in new window
    window.open(standaloneUrl, '_blank', 'width=1400,height=900,menubar=no,toolbar=no,location=no,status=no');
    
  } catch (error) {
    console.error('💥 Failed to open full window:', error);
    alert('Failed to open full window. Please try again.');
  }
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

// Global error handler
window.addEventListener('error', (event) => {
  console.error('💥 Global error:', event.error);
  console.error('Error details:', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno
  });
});

console.log('✅ WILLOW Embedded App script loaded');
