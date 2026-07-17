#!/usr/bin/env node

/**
 * Toggle between test mode (HLS test page) and production mode (full app)
 * Usage: node scripts/toggle-test-mode.mjs [test|prod]
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packagePath = join(__dirname, '..', 'package.json');

const modes = {
  test: 'app/hls-test.html',
  prod: 'app/index.html'
};

function getCurrentMode(pkg) {
  const currentPath = pkg.appPath;
  if (currentPath === modes.test) return 'test';
  if (currentPath === modes.prod) return 'prod';
  return 'unknown';
}

function toggleMode(targetMode) {
  try {
    // Read package.json
    const content = readFileSync(packagePath, 'utf-8');
    const pkg = JSON.parse(content);
    
    const currentMode = getCurrentMode(pkg);
    
    // Determine target mode
    let newMode;
    if (targetMode) {
      newMode = targetMode;
    } else {
      // Toggle
      newMode = currentMode === 'test' ? 'prod' : 'test';
    }
    
    if (!modes[newMode]) {
      console.error(`❌ Invalid mode: ${newMode}`);
      console.error(`   Valid modes: test, prod`);
      process.exit(1);
    }
    
    if (currentMode === newMode) {
      console.log(`✅ Already in ${newMode} mode`);
      console.log(`   appPath: ${modes[newMode]}`);
      process.exit(0);
    }
    
    // Update appPath
    pkg.appPath = modes[newMode];
    
    // Write back with pretty formatting
    const newContent = JSON.stringify(pkg, null, 2) + '\n';
    writeFileSync(packagePath, newContent, 'utf-8');
    
    console.log(`✅ Switched from ${currentMode} → ${newMode} mode`);
    console.log(`   appPath: ${modes[newMode]}`);
    console.log('');
    console.log('🔨 Run "npm run build" to rebuild');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

// Parse arguments
const arg = process.argv[2];
const validArgs = ['test', 'prod', 'production'];

if (arg && !validArgs.includes(arg)) {
  console.error(`❌ Invalid argument: ${arg}`);
  console.error(`   Usage: node toggle-test-mode.mjs [test|prod]`);
  console.error(`   Or just run without arguments to toggle`);
  process.exit(1);
}

const targetMode = arg === 'production' ? 'prod' : arg;
toggleMode(targetMode);
