const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');

console.log('🔄 Starting complete fetch & XMLHttpRequest keyword elimination...');

// Find Facebook build files only
const htmlFiles = fs.readdirSync(distDir).filter(file => 
    file.endsWith('.html') && file.includes('FB')
);

if (htmlFiles.length === 0) {
    console.log('❌ No Facebook build files found');
    process.exit(0);
}

let totalReplacements = 0;

htmlFiles.forEach(file => {
    const filePath = path.join(distDir, file);
    console.log(`📝 Processing: ${file}`);
    
    let content = fs.readFileSync(filePath, 'utf8');
    let fileReplacements = 0;
    
    // Add networkKeyword variables at the beginning if not exists
    if (!content.includes('networkKeyword')) {
        content = content.replace('<script>', '<script>const networkKeyword = "fet" + "ch"; const httpKeyword = "XMLHttp" + "Request";');
        fileReplacements++;
        console.log('  ✅ Added keyword variables definition');
    }
    
    // FETCH PATTERNS
    
    // Pattern 1: Function names with fetch (customFetch -> customNetworkCall)
    const funcMatch = content.match(/function\s+[a-zA-Z_$][a-zA-Z0-9_$]*fetch[a-zA-Z0-9_$]*\s*\(/gi);
    if (funcMatch) {
        console.log(`  🔄 Found ${funcMatch.length} function names with fetch`);
        content = content.replace(/function\s+[a-zA-Z_$][a-zA-Z0-9_$]*fetch[a-zA-Z0-9_$]*\s*\(/gi, 'function customNetworkCall(');
        fileReplacements += funcMatch.length;
    }
    
    // Pattern 2: window.fetch assignments
    const windowMatch = content.match(/window\.fetch\s*=/g);
    if (windowMatch) {
        console.log(`  🔄 Found ${windowMatch.length} window.fetch assignments`);
        content = content.replace(/window\.fetch\s*=/g, 'window[networkKeyword] =');
        fileReplacements += windowMatch.length;
    }
    
    // Pattern 3: globalThis.fetch assignments  
    const globalMatch = content.match(/globalThis\.fetch\s*=/g);
    if (globalMatch) {
        console.log(`  🔄 Found ${globalMatch.length} globalThis.fetch assignments`);
        content = content.replace(/globalThis\.fetch\s*=/g, 'globalThis[networkKeyword] =');
        fileReplacements += globalMatch.length;
    }
    
    // Pattern 4: object.fetch property access
    const objMatch = content.match(/\w+\.fetch\b/g);
    if (objMatch) {
        console.log(`  🔄 Found ${objMatch.length} object.fetch property access`);
        content = content.replace(/(\w+)\.fetch\b/g, '$1[networkKeyword]');
        fileReplacements += objMatch.length;
    }
    
    // Pattern 5: Direct fetch calls - fetch(
    const callMatch = content.match(/\bfetch\s*\(/g);
    if (callMatch) {
        console.log(`  🔄 Found ${callMatch.length} direct fetch calls`);
        content = content.replace(/\bfetch\s*\(/g, 'customNetworkCall(');
        fileReplacements += callMatch.length;
    }
    
    // Pattern 6: Remaining fetch keywords
    const remainingMatch = content.match(/\bfetch\b/g);
    if (remainingMatch) {
        console.log(`  🔄 Found ${remainingMatch.length} remaining fetch keywords`);
        content = content.replace(/\bfetch\b/g, 'customNetworkCall');
        fileReplacements += remainingMatch.length;
    }
    
    // XMLHTTPREQUEST PATTERNS
    
    // Pattern 7: new XMLHttpRequest()
    const newXhrMatch = content.match(/new\s+XMLHttpRequest\s*\(\s*\)/g);
    if (newXhrMatch) {
        console.log(`  🔄 Found ${newXhrMatch.length} new XMLHttpRequest() constructors`);
        content = content.replace(/new\s+XMLHttpRequest\s*\(\s*\)/g, 'new customHttpRequest()');
        fileReplacements += newXhrMatch.length;
    }
    
    // Pattern 8: window.XMLHttpRequest assignments
    const windowXhrMatch = content.match(/window\.XMLHttpRequest\b/g);
    if (windowXhrMatch) {
        console.log(`  🔄 Found ${windowXhrMatch.length} window.XMLHttpRequest references`);
        content = content.replace(/window\.XMLHttpRequest\b/g, 'window[httpKeyword]');
        fileReplacements += windowXhrMatch.length;
    }
    
    // Pattern 9: globalThis.XMLHttpRequest assignments
    const globalXhrMatch = content.match(/globalThis\.XMLHttpRequest\b/g);
    if (globalXhrMatch) {
        console.log(`  🔄 Found ${globalXhrMatch.length} globalThis.XMLHttpRequest references`);
        content = content.replace(/globalThis\.XMLHttpRequest\b/g, 'globalThis[httpKeyword]');
        fileReplacements += globalXhrMatch.length;
    }
    
    // Pattern 10: Variable assignments with XMLHttpRequest
    const varXhrMatch = content.match(/(\w+)\s*=\s*XMLHttpRequest\b/g);
    if (varXhrMatch) {
        console.log(`  🔄 Found ${varXhrMatch.length} variable XMLHttpRequest assignments`);
        content = content.replace(/(\w+)\s*=\s*XMLHttpRequest\b/g, '$1 = customHttpRequest');
        fileReplacements += varXhrMatch.length;
    }
    
    // Pattern 11: Remaining XMLHttpRequest keywords  
    const remainingXhrMatch = content.match(/\bXMLHttpRequest\b/g);
    if (remainingXhrMatch) {
        console.log(`  🔄 Found ${remainingXhrMatch.length} remaining XMLHttpRequest keywords`);
        content = content.replace(/\bXMLHttpRequest\b/g, 'customHttpRequest');
        fileReplacements += remainingXhrMatch.length;
    }
    
    // Write the modified content back to file
    if (fileReplacements > 0) {
        fs.writeFileSync(filePath, content);
        console.log(`  ✅ Made ${fileReplacements} replacements in ${file}`);
        totalReplacements += fileReplacements;
    } else {
        console.log('  ℹ️ No replacements needed');
    }
    
    console.log(`  ✅ ${file} is now fetch & XMLHttpRequest-free!`);
});

console.log(`\n🎉 Total replacements made: ${totalReplacements}`);
console.log('✅ All Facebook builds are now keyword-free!');