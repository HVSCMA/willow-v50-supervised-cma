#!/usr/bin/env node
// Build script: Inline HTML files into Netlify functions
const fs = require('fs');
const path = require('path');

const FUNCTIONS_DIR = './netlify/functions';
const SOURCE_FUNCTION = path.join(FUNCTIONS_DIR, 'willow-cma-workbench.js');
const HTML_FILE = path.join(FUNCTIONS_DIR, 'willow-v50-cma-workbench.html');
const OUTPUT_FUNCTION = path.join(FUNCTIONS_DIR, 'willow-cma-workbench.js');

console.log('🔨 Building WILLOW V50 Functions...');

// Read source files
const functionCode = fs.readFileSync(SOURCE_FUNCTION, 'utf8');
const htmlContent = fs.readFileSync(HTML_FILE, 'utf8');

// Escape backticks and ${ } in HTML for template literal
const escapedHtml = htmlContent
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${');

// Replace the file reading code with inline HTML
const modifiedCode = functionCode.replace(
    /const htmlPath = path\.join\(__dirname, 'willow-v50-cma-workbench\.html'\);[\s\S]*?const html = fs\.readFileSync\(htmlPath, 'utf8'\);/,
    `// HTML inlined during build (see build-functions.js)
            const html = \`${escapedHtml}\`;`
);

// Write output
fs.writeFileSync(OUTPUT_FUNCTION, modifiedCode);

console.log('✅ Function built successfully!');
console.log(`   Input: ${SOURCE_FUNCTION} (${functionCode.length} bytes)`);
console.log(`   HTML: ${HTML_FILE} (${htmlContent.length} bytes)`);
console.log(`   Output: ${OUTPUT_FUNCTION} (${modifiedCode.length} bytes)`);
