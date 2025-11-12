#!/bin/bash

# WILLOW V50 - Production Deployment Script
# Pushes 3 commits to trigger Netlify auto-deploy

echo "🚀 WILLOW V50 - Production Deployment"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📦 Commits to Deploy:"
echo "  1. 2473835 - Fix: /v1/events → /v1/notes API endpoint (3 locations)"
echo "  2. 98f3277 - Optimize: CloudCMA parameters per Glenn's specifications"
echo "  3. 4a0c5ca - Add: Property sub-type (Single Family Residence)"
echo ""
echo "🎯 Expected Result:"
echo "  ✓ Bug fixes deployed (Glenn's 400 error disappears)"
echo "  ✓ Parameter optimization live (20 listings, 12 months)"
echo "  ✓ Property sub-type filtering (SFR only, no condos/townhouses)"
echo "  ✓ Netlify auto-deploy completes in 2-3 minutes"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if we're in the right directory
if [ ! -d ".git" ]; then
    echo "❌ Error: Not in git repository"
    exit 1
fi

# Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    echo "⚠️  Warning: Uncommitted changes detected"
    git status --short
    echo ""
fi

# Show current branch
BRANCH=$(git branch --show-current)
echo "📍 Current branch: $BRANCH"
echo ""

# Show commits to push
UNPUSHED=$(git log origin/$BRANCH..$BRANCH --oneline 2>/dev/null)
if [ -z "$UNPUSHED" ]; then
    echo "✅ No commits to push (already deployed)"
    exit 0
fi

echo "📤 Commits to push:"
echo "$UNPUSHED"
echo ""

# Confirm deployment
read -p "🚀 Deploy to production? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "❌ Deployment cancelled"
    exit 0
fi

echo ""
echo "🔄 Pushing to GitHub..."

# Push to origin
git push origin $BRANCH

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ DEPLOYMENT SUCCESSFUL"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "🔄 Netlify auto-deploy in progress..."
    echo "   Monitor: https://app.netlify.com/sites/willow-v50-supervised-cma/deploys"
    echo ""
    echo "⏱️  Expected completion: 2-3 minutes"
    echo ""
    echo "🧪 After deployment, test in FUB:"
    echo "   1. Open lead: https://hudsonvalleysold.followupboss.com/2/people/view/1429"
    echo "   2. Click WILLOW V50 tab"
    echo "   3. Generate CMA with optimized parameters"
    echo "   4. Verify: Property sub-type = Single Family Residence"
    echo ""
    echo "✅ Production ready for Glenn's use"
else
    echo ""
    echo "❌ DEPLOYMENT FAILED"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Possible causes:"
    echo "  - GitHub authentication required"
    echo "  - Network connection issue"
    echo "  - Permission denied"
    echo ""
    echo "Manual deployment:"
    echo "  cd /path/to/willow-v50-supervised-cma"
    echo "  git push origin master"
    exit 1
fi
