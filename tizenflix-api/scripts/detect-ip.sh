#!/bin/bash
# Detect local network IP address for PUBLIC_BASE

echo "Detecting your local network IP address..."
echo ""

# Try multiple methods to get the IP
IP=""

# Method 1: ip route (most reliable)
if command -v ip &> /dev/null; then
    IP=$(ip route get 1.1.1.1 2>/dev/null | grep -oP 'src \K\S+')
fi

# Method 2: hostname -I (fallback)
if [ -z "$IP" ] && command -v hostname &> /dev/null; then
    IP=$(hostname -I | awk '{print $1}')
fi

# Method 3: ifconfig (older systems)
if [ -z "$IP" ] && command -v ifconfig &> /dev/null; then
    IP=$(ifconfig | grep -Eo 'inet (addr:)?([0-9]*\.){3}[0-9]*' | grep -Eo '([0-9]*\.){3}[0-9]*' | grep -v '127.0.0.1' | head -n1)
fi

if [ -z "$IP" ]; then
    echo "❌ Could not automatically detect IP address"
    echo ""
    echo "Please manually find your IP address:"
    echo "  Linux:   ip addr show"
    echo "  macOS:   ifconfig"
    echo "  Windows: ipconfig"
    echo ""
    echo "Then update tizenflix-api/.env:"
    echo "  PUBLIC_BASE=http://YOUR_IP:8790"
    exit 1
fi

echo "✓ Detected IP: $IP"
echo ""
echo "Update your .env file with:"
echo ""
echo "  PUBLIC_BASE=http://$IP:8790"
echo ""
echo "Or run this command:"
echo ""
echo "  sed -i 's|^PUBLIC_BASE=.*|PUBLIC_BASE=http://$IP:8790|' .env"
echo ""
