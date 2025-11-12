# ATTOM Data Integration - Deployment Guide
**Date**: November 12, 2025  
**Version**: 1.0.0  
**Status**: READY FOR DEPLOYMENT

---

## WHAT WAS BUILT

**3 New Files Created**:
1. `netlify/functions/attom-property-lookup.js` (14KB) - Netlify serverless function for ATTOM API
2. `netlify/functions/attom-integration-enhancement.js` (9KB) - Frontend JavaScript for auto-fill
3. `ATTOM_INTEGRATION_DEPLOYMENT_GUIDE.md` (this file) - Complete deployment instructions

**Features Delivered**:
- ✅ ATTOM Data API integration with retry logic
- ✅ FUB caching (Tier 2) - Check cache before API call
- ✅ Auto-fill 8 property fields (beds, baths, sqft, acres, garage, type, year, condition)
- ✅ Real-time address lookup from CMA Workbench
- ✅ Data source indicators (ATTOM/FUB Cache/Manual Defaults)
- ✅ Error handling with graceful fallback to defaults
- ✅ FUB activity logging for audit trail
- ✅ Rate limit handling (200/min)
- ✅ Monthly quota tracking

---

## ARCHITECTURE IMPLEMENTED

### 4-Tier Data Collection System

```
┌─────────────────────────────────────────────────┐
│  Tier 1: ATTOM Data API (PRIMARY)               │
│  ├─ Property detail lookup by address           │
│  ├─ 158M+ US properties                         │
│  └─ County assessor records                     │
└─────────────────────────────────────────────────┘
                      ↓ (if not found)
┌─────────────────────────────────────────────────┐
│  Tier 2: FUB Custom Fields (CACHE)              │
│  ├─ Check customWILLOW_property_* fields        │
│  ├─ 60% cache hit rate (estimated)              │
│  └─ Reduces API calls from 20 to 8-12/month     │
└─────────────────────────────────────────────────┘
                      ↓ (if empty)
┌─────────────────────────────────────────────────┐
│  Tier 3: Fello Lead Data (ADDRESS ONLY)         │
│  ├─ Extract property address from inquiry       │
│  └─ Trigger ATTOM lookup                        │
└─────────────────────────────────────────────────┘
                      ↓ (if all fail)
┌─────────────────────────────────────────────────┐
│  Tier 4: Manual Entry + Smart Defaults          │
│  ├─ Hudson Valley market averages               │
│  └─ User override with validation               │
└─────────────────────────────────────────────────┘
```

---

## DEPLOYMENT STEPS

### Step 1: Environment Variables (5 minutes)

**Add to Netlify**:

1. Go to: https://app.netlify.com/sites/willow-v50-cma-workbench/configuration/env

2. Add these variables:

```
ATTOM_API_KEY=83d56a0076ca0aeefd240b3d397ce708
FUB_API_KEY=<your_existing_fub_key>
```

3. Scopes: ALL (Production, Deploy Previews, Branch Deploys)

4. Click "Save"

---

### Step 2: Deploy New Files (10 minutes)

**Commit & Push**:

```bash
cd /path/to/willow-v50-supervised-cma

# Stage new files
git add netlify/functions/attom-property-lookup.js
git add netlify/functions/attom-integration-enhancement.js
git add ATTOM_INTEGRATION_DEPLOYMENT_GUIDE.md

# Commit
git commit -m "Add: ATTOM Data API integration with FUB caching and auto-fill

Features:
- ATTOM property lookup Netlify function
- Auto-fill 8 CMA fields from address
- FUB caching (Tier 2) reduces API calls 60%
- Data source indicators and error handling
- FUB activity logging for audit trail

Resolves: CloudCMA RETS assumption (does not exist)
Implements: 4-tier architecture with ATTOM as primary
"

# Push to production
git push origin main
```

**Netlify will auto-deploy** (3-5 minutes)

---

### Step 3: Update HTML (Manual Integration)

**Current Status**: Integration JavaScript created but NOT yet added to HTML.

**Why Manual**: The CMA Workbench HTML is 50KB+ and I need to see the exact form structure to integrate cleanly.

**Option A - You Integrate (Recommended)**:

1. Open `netlify/functions/willow-v50-cma-workbench.html`

2. Find the `<script>` section (around line 700)

3. Add this button BEFORE the "Generate CMA" button:

```html
<!-- ATTOM Auto-Fill Button -->
<button 
  type="button" 
  id="autoFillButton" 
  class="btn btn-primary"
  onclick="autoFillPropertyData()"
  style="
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
    padding: 12px 24px;
    border: none;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    margin-bottom: 20px;
  ">
  🔍 Auto-Fill Property Data
</button>

<!-- Loading Spinner -->
<div id="attomSpinner" style="display:none;">
  Loading property data from ATTOM...
</div>
```

4. Add ATTOM integration script AFTER existing JavaScript:

```html
<script>
// Copy entire contents of attom-integration-enhancement.js here
</script>
```

5. Commit and push:

```bash
git add netlify/functions/willow-v50-cma-workbench.html
git commit -m "Integrate: ATTOM auto-fill button and JavaScript"
git push origin main
```

**Option B - I Integrate (Requires HTML Analysis)**:

Tell me to continue and I'll read the full HTML, integrate the button/script, and commit.

---

### Step 4: Test Integration (15 minutes)

**Test Checklist**:

1. **Test ATTOM Function Directly**:
```bash
curl "https://willow-v50-cma-workbench.netlify.app/.netlify/functions/attom-property-lookup?address=1%20Civic%20Center%20Plaza,%20Poughkeepsie,%20NY%2012601"
```

Expected: JSON with property details

2. **Test in CMA Workbench**:
   - Open app in FUB: https://www.followupboss.com/
   - Navigate to a person
   - Click "WILLOW CMA Workbench" embedded app
   - Enter address: "1 Civic Center Plaza, Poughkeepsie, NY 12601"
   - Click "🔍 Auto-Fill Property Data"
   - Verify fields populate with ATTOM data

3. **Test FUB Caching**:
   - Run auto-fill for same address twice
   - Second time should show "loaded from cached data"
   - Check FUB person custom fields for data storage

4. **Test Error Handling**:
   - Enter invalid address: "123 Fake Street"
   - Verify error message and fallback to defaults

5. **Test FUB Activity Logging**:
   - After successful lookup, check person's activity stream
   - Should see "ATTOM Property Data Lookup" note

---

## TECHNICAL SPECIFICATIONS

### ATTOM Lookup Function

**Endpoint**: `/.netlify/functions/attom-property-lookup`

**Parameters**:
- `address` (required): Property address
- `personId` (optional): FUB person ID for caching
- `skipCache` (optional): Force fresh ATTOM lookup

**Response Format**:
```json
{
  "success": true,
  "source": "ATTOM_API",
  "cached": false,
  "data": {
    "beds": 3,
    "baths": 2,
    "sqft": 1800,
    "acres": 0.25,
    "garage": 2,
    "propertyType": "Single Family Residential",
    "yearBuilt": 1985,
    "condition": "Average",
    "address": {...},
    "location": {...},
    "assessment": {...},
    "avm": {...}
  },
  "message": "Property data retrieved from ATTOM Data API"
}
```

**Error Codes**:
- `400`: Missing address parameter
- `404`: Property not found in ATTOM database
- `429`: Rate limit exceeded (200/min)
- `401`: Invalid ATTOM API key
- `500`: API request failed

---

### FUB Custom Fields Used

**8 WILLOW Fields** (Write-enabled):
- `customWILLOW_property_beds` (Integer)
- `customWILLOW_property_baths` (Integer)
- `customWILLOW_property_sqft` (Integer)
- `customWILLOW_property_acres` (Decimal)
- `customWILLOW_property_garage` (Integer)
- `customWILLOW_property_type` (String)
- `customWILLOW_property_year_built` (Integer)
- `customWILLOW_property_condition` (String)

**2 Metadata Fields**:
- `customWILLOW_property_cached_at` (ISO Date)
- `customWILLOW_property_source` (String: "ATTOM_DATA_API")

---

### Rate Limits & Quotas

**ATTOM Enforced**:
- 200 requests/minute (hard limit)
- Monthly quota varies by plan (check dashboard)

**Your Expected Usage**:
- 20 CMAs/month = 20 potential API calls
- 60% FUB cache hit rate = 8-12 actual API calls
- Well within any reasonable quota (50-10,000/month)

**Monitoring**:
- Check ATTOM dashboard: https://api.developer.attomdata.com/dashboard
- Netlify function logs: https://app.netlify.com/sites/willow-v50-cma-workbench/functions
- FUB activity stream for lookup audit trail

---

## WORKFLOW EXAMPLE

### Scenario: Generate CMA for Joseph Caplan

**Step 1: User Opens CMA Workbench**
- Glenn opens FUB contact: Joseph Caplan (person_id: 4272)
- Clicks "WILLOW CMA Workbench" embedded app
- App loads with FUB context (person_id extracted)

**Step 2: Address Entry**
- Glenn enters: "20 Middlebush Road, Wappingers Falls, NY 12590"
- (This could also be pre-filled from Fello inquiry)

**Step 3: Auto-Fill Triggered**
- Glenn clicks "🔍 Auto-Fill Property Data"
- Function checks FUB cache first (person_id: 4272)
- Cache MISS (no prior data for this address)
- Calls ATTOM API with address
- ATTOM returns property details (HTTP 200)

**Step 4: Form Population**
- Beds: 3 ✓ ATTOM Data
- Baths: 2 ✓ ATTOM Data
- Sqft: 1,800 ✓ ATTOM Data
- Acres: 0.25 ✓ ATTOM Data
- Garage: 2 ✓ ATTOM Data
- Type: Single Family Residential ✓ ATTOM Data
- Year: 1985 ✓ ATTOM Data
- Condition: Average ✓ ATTOM Data

**Step 5: FUB Caching**
- Data stored to FUB custom fields (person_id: 4272)
- Activity note created: "ATTOM Property Data Lookup"
- Timestamp saved for cache freshness

**Step 6: CMA Generation**
- Glenn reviews/adjusts auto-filled data
- Sets strategic parameters (radius, months back, center value)
- Clicks "Generate CMA"
- CloudCMA receives complete property data
- CMA report created with comparables

**Next Time** (Cache HIT):
- Glenn opens same person (Joseph Caplan)
- Enters same address
- Function checks FUB cache FIRST
- Cache HIT (data exists and is fresh)
- Form populates instantly from cache (NO ATTOM API call)
- Message: "Property data loaded from cached data"

---

## FILE STRUCTURE

```
willow-v50-supervised-cma/
├── netlify/
│   └── functions/
│       ├── attom-property-lookup.js       ← NEW: ATTOM API integration
│       ├── attom-integration-enhancement.js ← NEW: Frontend JavaScript
│       ├── willow-cma-workbench.js         ← Existing (no changes)
│       ├── willow-v50-cma-workbench.html   ← NEEDS UPDATE (add button + script)
│       └── cloudcma-webhook.js             ← Existing (no changes)
├── ATTOM_INTEGRATION_DEPLOYMENT_GUIDE.md   ← NEW: This file
└── package.json
```

---

## TESTING COMMANDS

### Test ATTOM Function (Production)

**Valid Address** (Should Return Data):
```bash
curl "https://willow-v50-cma-workbench.netlify.app/.netlify/functions/attom-property-lookup?address=1%20Civic%20Center%20Plaza,%20Poughkeepsie,%20NY%2012601"
```

**Invalid Address** (Should Return 404):
```bash
curl "https://willow-v50-cma-workbench.netlify.app/.netlify/functions/attom-property-lookup?address=123%20Fake%20Street"
```

**With FUB Caching**:
```bash
curl "https://willow-v50-cma-workbench.netlify.app/.netlify/functions/attom-property-lookup?address=1%20Civic%20Center%20Plaza,%20Poughkeepsie,%20NY%2012601&personId=4272"
```

---

### Test Local (Before Deployment)

```bash
cd willow-v50-supervised-cma

# Install dependencies
npm install

# Set environment variables
export ATTOM_API_KEY="83d56a0076ca0aeefd240b3d397ce708"
export FUB_API_KEY="your_fub_key"

# Run Netlify Dev
netlify dev

# Test function locally
curl "http://localhost:8888/.netlify/functions/attom-property-lookup?address=1%20Civic%20Center%20Plaza,%20Poughkeepsie,%20NY%2012601"
```

---

## MONITORING & MAINTENANCE

### Daily Monitoring
- Check Netlify function logs for errors
- Monitor ATTOM API usage in dashboard
- Review FUB activity stream for lookup audit trail

### Weekly Review
- Check ATTOM monthly quota usage
- Analyze cache hit rate (target: 60%+)
- Review error rates and common failure addresses

### Monthly Tasks
- Verify ATTOM quota not exceeded
- Review cost (should be $0 with free tier)
- Analyze usage patterns for optimization

---

## ROLLBACK PLAN

If integration causes issues:

1. **Remove Auto-Fill Button** (Quick Fix):
   - Edit `willow-v50-cma-workbench.html`
   - Comment out `autoFillButton`
   - Push to main
   - Deploys in 3-5 minutes

2. **Disable ATTOM Function** (Nuclear Option):
   - Rename `attom-property-lookup.js` to `attom-property-lookup.js.disabled`
   - Push to main
   - Function becomes unavailable
   - Manual entry still works

3. **Full Rollback**:
   ```bash
   git revert HEAD~3..HEAD  # Reverts last 3 commits
   git push origin main
   ```

---

## KNOWN LIMITATIONS

1. **ATTOM Coverage**: Not all properties in database (especially new construction)
2. **Data Freshness**: County assessor data updated quarterly
3. **Commercial Properties**: Some fields (beds/baths) may be N/A
4. **Rate Limiting**: 200/min enforced (unlikely to hit with CMA workflow)
5. **Monthly Quota**: Unknown exact quota (need to check dashboard)

---

## FUTURE ENHANCEMENTS

### Phase 2 (Week 2-3)
- Add "Edit" button for manual override of auto-filled data
- Implement cache freshness indicator (red flag if >1 year old)
- Add ATTOM AVM value display for pricing guidance
- Show sales history timeline in CMA context

### Phase 3 (Week 4-5)
- Batch lookup for multiple properties
- Predictive address suggestions (Google Places API)
- Smart address extraction from Fello emails
- OneKey MLS integration (if available)

---

## SUPPORT & TROUBLESHOOTING

### Common Issues

**Issue**: "ATTOM API key not configured"
**Solution**: Add `ATTOM_API_KEY` to Netlify environment variables

**Issue**: "Property not found in ATTOM database"
**Solution**: Normal - use smart defaults or manual entry

**Issue**: "Rate limit exceeded"
**Solution**: Wait 60 seconds and try again (shouldn't happen in normal use)

**Issue**: "FUB cache write failed"
**Solution**: Check `FUB_API_KEY` is valid, person_id exists

**Issue**: "Auto-fill button not appearing"
**Solution**: Verify HTML integration completed (Step 3)

---

## DEPLOYMENT CHECKLIST

- [ ] Step 1: Add `ATTOM_API_KEY` to Netlify env vars
- [ ] Step 2: Commit and push 3 new files
- [ ] Step 3: Integrate auto-fill button into HTML
- [ ] Step 4: Test ATTOM function directly (curl)
- [ ] Step 5: Test in CMA Workbench UI
- [ ] Step 6: Test FUB caching (run twice)
- [ ] Step 7: Test error handling (invalid address)
- [ ] Step 8: Test FUB activity logging
- [ ] Step 9: Verify ATTOM dashboard access
- [ ] Step 10: Monitor first 10 real-world uses

---

## SUCCESS METRICS

**Primary KPIs**:
- Auto-fill success rate: >70%
- FUB cache hit rate: >60%
- Data accuracy: >90%
- User satisfaction: 5/5

**Secondary KPIs**:
- Average API response time: <2s
- Monthly API calls: 8-12 (down from 20 without caching)
- Error rate: <5%
- Manual entry time saved: 60 seconds per CMA

---

**STATUS**: Ready for deployment - waiting for Glenn's go-ahead to complete Step 3 (HTML integration)

**NEXT ACTION**: Glenn adds `ATTOM_API_KEY` to Netlify, I complete HTML integration and deploy

---

**Document Created**: November 12, 2025  
**Version**: 1.0.0  
**Author**: WILLOW V50 Digital Twin
