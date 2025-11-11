#!/usr/bin/env node
// Build script V2: Inline HTML files into Netlify functions using Base64
const fs = require('fs');
const path = require('path');

const FUNCTIONS_DIR = './netlify/functions';
const HTML_FILE = path.join(FUNCTIONS_DIR, 'willow-v50-cma-workbench.html');
const TEMPLATE_FILE = path.join(FUNCTIONS_DIR, 'willow-cma-workbench-template.js');
const OUTPUT_FUNCTION = path.join(FUNCTIONS_DIR, 'willow-cma-workbench.js');

console.log('🔨 Building WILLOW V50 Functions (Base64 approach)...');

// Read HTML and encode as Base64
const htmlContent = fs.readFileSync(HTML_FILE, 'utf8');
const htmlBase64 = Buffer.from(htmlContent).toString('base64');

// Read template function
const templateCode = fs.readFileSync(TEMPLATE_FILE, 'utf8');

// Replace placeholder with Base64 HTML
const finalCode = templateCode.replace(
    '/* HTML_BASE64_PLACEHOLDER */',
    `'${htmlBase64}'`
);

// Write output
fs.writeFileSync(OUTPUT_FUNCTION, finalCode);

console.log('✅ Function built successfully!');
console.log(`   HTML: ${HTML_FILE} (${htmlContent.length} bytes)`);
console.log(`   Base64: ${htmlBase64.length} bytes`);
console.log(`   Template: ${TEMPLATE_FILE} (${templateCode.length} bytes)`);
console.log(`   Output: ${OUTPUT_FUNCTION} (${finalCode.length} bytes)`);
