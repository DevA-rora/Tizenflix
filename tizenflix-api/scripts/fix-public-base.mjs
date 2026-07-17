#!/usr/bin/env node
/**
 * Automatically detect local IP and update PUBLIC_BASE in .env
 */

import { networkInterfaces } from 'os';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '../.env');

function getLocalIP() {
  const nets = networkInterfaces();
  const results = [];

  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Skip internal (loopback) addresses
      // Skip IPv6 addresses
      // We want IPv4 addresses that are not internal
      if (net.family === 'IPv4' && !net.internal) {
        results.push({
          name,
          address: net.address,
          // Prioritize common local network prefixes
          priority: 
            net.address.startsWith('192.168.') ? 3 :
            net.address.startsWith('10.') ? 2 :
            net.address.startsWith('172.') ? 1 : 0
        });
      }
    }
  }

  // Sort by priority (highest first)
  results.sort((a, b) => b.priority - a.priority);

  if (results.length === 0) {
    throw new Error('No local IP address found');
  }

  return results[0];
}

try {
  const localNet = getLocalIP();
  const ip = localNet.address;
  const port = 8790;
  const publicBase = `http://${ip}:${port}`;

  console.log('✓ Detected local network interface:');
  console.log(`  Interface: ${localNet.name}`);
  console.log(`  IP Address: ${ip}`);
  console.log('');

  // Read current .env file
  let envContent = readFileSync(envPath, 'utf8');

  // Check if PUBLIC_BASE is already set correctly
  const currentMatch = envContent.match(/^PUBLIC_BASE=(.+)$/m);
  if (currentMatch && currentMatch[1] === publicBase) {
    console.log('✓ .env already configured correctly:');
    console.log(`  PUBLIC_BASE=${publicBase}`);
    console.log('');
    console.log('No changes needed. Restart the API server:');
    console.log('  npm run api');
    process.exit(0);
  }

  // Update or add PUBLIC_BASE
  if (envContent.includes('PUBLIC_BASE=')) {
    // Replace existing PUBLIC_BASE (commented or uncommented)
    envContent = envContent.replace(
      /^#?\s*PUBLIC_BASE=.*$/m,
      `PUBLIC_BASE=${publicBase}`
    );
  } else {
    // Add PUBLIC_BASE at the end
    envContent += `\n# Auto-configured by fix-public-base.mjs\nPUBLIC_BASE=${publicBase}\n`;
  }

  // Write updated .env file
  writeFileSync(envPath, envContent, 'utf8');

  console.log('✓ Updated .env file:');
  console.log(`  PUBLIC_BASE=${publicBase}`);
  console.log('');
  console.log('⚠️  IMPORTANT: Restart the API server for changes to take effect:');
  console.log('  1. Stop the current server (Ctrl+C)');
  console.log('  2. Run: npm run api');
  console.log('');
  console.log('The API will be accessible at:');
  console.log(`  ${publicBase}`);
  console.log('');
  console.log('Make sure your TV is on the same network and can reach this address!');

} catch (err) {
  console.error('❌ Error:', err.message);
  console.error('');
  console.error('Please manually set PUBLIC_BASE in .env:');
  console.error('  1. Find your IP: ip addr show (or ifconfig)');
  console.error('  2. Edit tizenflix-api/.env');
  console.error('  3. Set: PUBLIC_BASE=http://YOUR_IP:8790');
  process.exit(1);
}
