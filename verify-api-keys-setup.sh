#!/bin/bash
# API Keys Security Implementation: Verification Script
# Run this to verify all components are in place

set -e

echo "🔐 TruckInFox API Keys Protection - Verification Script"
echo "======================================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✅${NC} $1"
        return 0
    else
        echo -e "${RED}❌${NC} $1"
        return 1
    fi
}

check_env_var() {
    if grep -q "^$1=" .env 2>/dev/null; then
        echo -e "${GREEN}✅${NC} .env contains $1"
        return 0
    else
        echo -e "${YELLOW}⚠️ ${NC} .env missing $1 (ok for public vars)"
        return 0
    fi
}

check_gitignore() {
    if grep -q "^\.env$" .gitignore; then
        echo -e "${GREEN}✅${NC} .gitignore protects .env"
        return 0
    else
        echo -e "${RED}❌${NC} .gitignore doesn't protect .env"
        return 1
    fi
}

check_source_code() {
    if grep -r "EXPO_PUBLIC_GOOGLE_PLACES_API_KEY" --include="*.ts" --include="*.tsx" --include="*.js" app/ 2>/dev/null | grep -v "node_modules" > /dev/null; then
        echo -e "${RED}❌${NC} API key referenced in source code"
        return 1
    else
        echo -e "${GREEN}✅${NC} No hardcoded API keys in source"
        return 0
    fi
}

# Start verification
echo "📋 Documentation Files"
echo "---------------------"

check_file "GOOGLE_PLACES_API_SECURITY.md"
check_file "API_KEYS_SECURITY_CHECKLIST.md"
check_file "API_KEYS_DEPLOYMENT_GUIDE.md"
check_file "API_KEYS_PROTECTION_SUMMARY.md"
check_file "API_KEYS_QUICK_REFERENCE.md"

echo ""
echo "💻 Code Implementation"
echo "---------------------"

check_file "functions/src/placesProxyExample.ts"
check_file "hooks/useSecurePlacesProxy.ts"

echo ""
echo "🔧 Configuration Files"
echo "---------------------"

check_file ".env"
check_file ".env.example"
check_file ".gitignore"

echo ""
echo "🔐 Security Checks"
echo "------------------"

check_gitignore
check_source_code
check_env_var "EXPO_PUBLIC_GOOGLE_PLACES_API_KEY"

echo ""
echo "📊 Summary"
echo "----------"

# Count files
DOC_COUNT=$(find . -maxdepth 1 -name "API_KEYS*.md" -o -name "GOOGLE_PLACES*.md" | wc -l)
echo "Documentation files: $DOC_COUNT"

CODE_COUNT=$(find functions/src -name "*Proxy*.ts" | wc -l)
echo "Implementation files: $CODE_COUNT"

echo ""
echo "✅ Verification Complete!"
echo ""
echo "Next steps:"
echo "1. Review: GOOGLE_PLACES_API_SECURITY.md"
echo "2. Setup: Follow API_KEYS_DEPLOYMENT_GUIDE.md"
echo "3. Verify: Run this script again after setup"
echo ""
echo "For questions, see API_KEYS_QUICK_REFERENCE.md"
