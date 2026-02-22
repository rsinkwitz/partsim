#!/bin/bash
# Test-Script um zu zeigen, wie build-and-deploy.sh ohne python3 funktioniert

echo "🧪 Testing build-and-deploy.sh WITHOUT python3..."
echo ""

# Simuliere fehlenden python3 durch temporäres PATH override
export PATH="/usr/bin:/bin:/usr/sbin:/sbin"

# Prüfe ob python3 wirklich nicht gefunden wird
if command -v python3 &> /dev/null; then
    echo "⚠️  python3 is still available in PATH, test not accurate"
    echo "   python3 location: $(which python3)"
    echo ""
    echo "To truly test without python3, temporarily rename it:"
    echo "  sudo mv /opt/homebrew/bin/python3 /opt/homebrew/bin/python3.bak"
    echo "  # run build"
    echo "  sudo mv /opt/homebrew/bin/python3.bak /opt/homebrew/bin/python3"
    exit 1
else
    echo "✅ python3 not found in PATH (as expected)"
    echo ""
    echo "Expected output from build-and-deploy.sh:"
    echo "  ⚠️  python3 not found - copied without cache-busting (Metro may use cached version)"
    echo ""
fi

# Run the actual build
bash scripts/build-and-deploy.sh

