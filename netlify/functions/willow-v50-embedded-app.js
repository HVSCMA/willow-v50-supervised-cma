/**
 * WILLOW V50 FUB Embedded App Function
 * Serves the embedded app HTML with proper FUB iframe compatibility
 */

const fs = require('fs');
const path = require('path');

exports.handler = async (event, context) => {
  try {
    // Set FUB-compatible headers (critical for iframe loading)
    const headers = {
      'Content-Type': 'text/html; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      // CRITICAL: Do NOT set X-Frame-Options to allow FUB iframe embedding
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    };

    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 200, headers, body: '' };
    }

    // Read the embedded app HTML file
    const htmlPath = path.join(__dirname, 'willow-v50-embedded-app.html');
    let htmlContent;
    
    try {
      htmlContent = fs.readFileSync(htmlPath, 'utf8');
    } catch (error) {
      // Fallback: serve inline HTML if file not found
      console.log('HTML file not found, serving inline content');
      htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WILLOW V50 Intelligence System</title>
  <!-- CRITICAL: No X-Frame-Options header for FUB compliance -->
  <style>
    :root {
      --fub-primary: #2563eb;
      --fub-secondary: #64748b;
      --fub-success: #16a34a;
      --fub-warning: #eab308;
      --fub-danger: #dc2626;
      --fub-background: #f8fafc;
      --fub-card: #ffffff;
      --fub-border: #e2e8f0;
      --fub-text: #0f172a;
      --fub-text-muted: #64748b;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--fub-background);
      color: var(--fub-text);
      font-size: 14px;
      line-height: 1.5;
      padding: 20px;
    }

    .willow-container {
      background: var(--fub-card);
      min-height: 500px;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      padding: 20px;
      text-align: center;
    }

    .loading-message {
      color: var(--fub-text-muted);
      font-size: 16px;
      margin-bottom: 20px;
    }

    .cma-generator {
      margin-top: 20px;
      padding: 20px;
      border: 1px solid var(--fub-border);
      border-radius: 8px;
      background: var(--fub-background);
    }

    .address-input {
      width: 100%;
      padding: 12px;
      border: 1px solid var(--fub-border);
      border-radius: 4px;
      margin-bottom: 15px;
      font-size: 14px;
    }

    .cma-button {
      background: var(--fub-primary);
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 4px;
      font-size: 14px;
      cursor: pointer;
      transition: background 0.2s;
    }

    .cma-button:hover {
      background: #1d4ed8;
    }

    .protocol-info {
      margin-top: 15px;
      padding: 10px;
      background: var(--fub-background);
      border-radius: 4px;
      font-size: 12px;
      color: var(--fub-text-muted);
    }
  </style>
</head>
<body>
  <!-- REQUIRED FUB Integration -->
  <script type="text/javascript" src="https://eia.followupboss.com/embeddedApps-v1.0.0.js"></script>

  <div class="willow-container">
    <h2>🎯 WILLOW V50 Intelligence System</h2>
    <p class="loading-message">Loading CMA Generator with Center Range Value Protocol...</p>
    
    <div class="cma-generator">
      <h4>Generate Professional CMA</h4>
      
      <input 
        type="text" 
        id="cma-address" 
        class="address-input"
        placeholder="Property address will auto-populate from FUB contact..."
        value="30 Arlmont St, Kingston, NY 12401"
      />
      
      <button class="cma-button" onclick="generateCMA()">
        🚀 Generate CMA
      </button>
      
      <div class="protocol-info">
        <strong>CMA Parameters:</strong> 
        0.75 mile radius • 12 months back • 15 closest comparables<br>
        <strong>Center Range Protocol:</strong> 
        Zillow Zestimate × 1.024 → Round up to next $5,000
      </div>
    </div>
  </div>

  <script>
    // Initialize FUB integration
    let fubPerson = null;
    
    // FUB callback when person data is available
    if (typeof window !== 'undefined' && window.EIA) {
      window.EIA.onReady(function(person) {
        console.log('FUB person data received:', person);
        fubPerson = person;
        
        // Auto-populate address from FUB data
        const addressInput = document.getElementById('cma-address');
        if (addressInput && person) {
          const address = getBestAddress(person);
          if (address) {
            addressInput.value = address;
          }
        }
      });
    }
    
    function getBestAddress(person) {
      if (!person) return '';
      
      // Priority order for address detection
      if (person.customWILLOWCMAAddress) {
        return person.customWILLOWCMAAddress;
      }
      
      if (person.customFelloPropertyAddress) {
        return person.customFelloPropertyAddress;
      }
      
      if (person.addresses && person.addresses.length > 0) {
        const primaryAddress = person.addresses.find(addr => addr.isPrimary);
        if (primaryAddress) {
          return \`\${primaryAddress.street}, \${primaryAddress.city}, \${primaryAddress.state} \${primaryAddress.zip}\`;
        }
        
        const firstAddr = person.addresses[0];
        return \`\${firstAddr.street}, \${firstAddr.city}, \${firstAddr.state} \${firstAddr.zip}\`;
      }
      
      const parts = [];
      if (person.street) parts.push(person.street);
      if (person.city) parts.push(person.city);
      if (person.state) parts.push(person.state);
      if (person.zip) parts.push(person.zip);
      
      return parts.join(', ');
    }

    async function generateCMA() {
      const address = document.getElementById('cma-address').value;
      
      if (!address) {
        alert('Please enter a property address');
        return;
      }
      
      try {
        console.log('Generating CMA for:', address);
        
        const button = document.querySelector('.cma-button');
        const originalText = button.innerHTML;
        button.innerHTML = '⏳ Generating...';
        button.disabled = true;
        
        // Get Zillow Zestimate and calculate center range value
        let centerRangeValue = null;
        try {
          const zillowResponse = await fetch('/.netlify/functions/zillow-zestimate-enhanced', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address: address })
          });
          
          if (zillowResponse.ok) {
            const zillowData = await zillowResponse.json();
            if (zillowData.zestimate) {
              centerRangeValue = zillowData.centerRangeValue;
              console.log(\`Center Range Value: $\${centerRangeValue.toLocaleString()}\`);
            }
          }
        } catch (error) {
          console.log('Zillow lookup failed:', error);
        }
        
        // Call the real CMA workbench function
        const response = await fetch('/.netlify/functions/willow-cma-workbench', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'generateCMA',
            personId: fubPerson?.id,
            address: address,
            template: 'Enhanced CMA with Behavioral Intelligence',
            radius: '0.75',
            monthsBack: '12',
            minListings: '15',
            centerRangeValue: centerRangeValue
          })
        });
        
        const result = await response.json();
        
        if (result.success) {
          let successMessage = \`✅ CMA Generated Successfully!\\n\\nCMA Link: \${result.cmaUrl}\\nJob ID: \${result.jobId}\`;
          
          if (centerRangeValue) {
            successMessage += \`\\n\\n🎯 Glenn's Center Range Value Protocol Applied:\\nZillow Zestimate × 1.024 → Rounded to $5K = $\${centerRangeValue.toLocaleString()}\`;
          }
          
          successMessage += \`\\n\\nThe CMA has been saved to your FUB contact record and CloudCMA webhook will capture the deliverables.\`;
          alert(successMessage);
        } else {
          alert(\`❌ CMA Generation Failed: \${result.error}\`);
        }
        
        button.innerHTML = originalText;
        button.disabled = false;
        
      } catch (error) {
        console.error('CMA Generation Error:', error);
        alert(\`❌ CMA Generation Error: \${error.message}\`);
        
        const button = document.querySelector('.cma-button');
        button.innerHTML = '🚀 Generate CMA';
        button.disabled = false;
      }
    }
  </script>
</body>
</html>`;
    }

    return {
      statusCode: 200,
      headers,
      body: htmlContent
    };

  } catch (error) {
    console.error('Embedded App Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Failed to load WILLOW V50 embedded app',
        details: error.message
      })
    };
  }
};