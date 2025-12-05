#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';

const DIST = path.resolve(process.cwd(), 'dist');
const ASSETS_DIR = path.join(DIST, 'assets');
const INDEX_HTML = path.join(DIST, 'index.html');
const OUT_DIR = path.resolve(process.cwd(), 'out');
const OUT_FILE = path.join(OUT_DIR, 'playable.html');

function escapeForTemplate(s) {
  return s.replace(/`/g, '\\`').replace(/\\/g, '\\\\');
}

async function readAssets() {
  const files = await fs.readdir(ASSETS_DIR);
  const jsFiles = files.filter(f => f.endsWith('.js'));
  const map = {};
  for (const f of jsFiles) {
    const full = path.join(ASSETS_DIR, f);
    const txt = await fs.readFile(full, 'utf8');
    map[f] = txt;
  }
  return map;
}

// Replace import specifiers that look like './somefile.js' or './name' with placeholders
function placeholderizeModuleImports(text) {
  // Replace dynamic import(...) and static `from '...'` for local JS modules
  // We capture specifiers like './foo.js', '../bar.js', '/assets/foo.js', 'assets/foo.js'
  const replaceDynamic = (m, q, p) => {
    // normalize to basename (module filename inside dist/assets)
    const name = p.replace(/^(?:\.\/|\.\.\/|\/)*/,'').split('/').pop();
    return `import(${q}___MODULE___${name}___${q})`;
  };

  const replaceFrom = (m, q, p) => {
    const name = p.replace(/^(?:\.\/|\.\.\/|\/)*/,'').split('/').pop();
    return `from ${q}___MODULE___${name}___${q}`;
  };

  let out = text;
  out = out.replace(/import\((['"])([^'"\)]+\.js)\1\)/g, replaceDynamic);
  out = out.replace(/from\s+(['"])([^'"\)]+\.js)\1/g, replaceFrom);
  // Also handle imports without .js extension (e.g. import('./mod'))
  out = out.replace(/import\((['"])([^'"\)]+)\1\)/g, (m, q, p) => {
    if (/^(?:https?:|data:|blob:)/.test(p)) return m; // skip external
    const name = p.replace(/^(?:\.\/|\.\.\/|\/)*/,'').split('/').pop();
    return `import(${q}___MODULE___${name}___${q})`;
  });
  out = out.replace(/from\s+(['"])([^'"\)]+)\1/g, (m, q, p) => {
    if (/^(?:https?:|data:|blob:)/.test(p)) return m;
    const name = p.replace(/^(?:\.\/|\.\.\/|\/)*/,'').split('/').pop();
    return `from ${q}___MODULE___${name}___${q}`;
  });
  return out;
}

async function main() {
  try {
    const indexHtml = await fs.readFile(INDEX_HTML, 'utf8');
    const assets = await readAssets();

    // Determine entry script referenced in index.html
    const entryMatch = indexHtml.match(/<script[^>]+src=(?:"|')\/?assets\/(index-[^"']+)\.js(?:"|')[^>]*><\/script>/);
    const entryName = entryMatch ? `${entryMatch[1]}.js` : Object.keys(assets)[0];
    if (!entryName) throw new Error('Could not find entry script in dist/index.html');

    // Placeholderize all modules
    const modules = {};
    for (const [name, txt] of Object.entries(assets)) {
      modules[name] = placeholderizeModuleImports(txt);
    }

    // Build the single-file HTML
    const outLines = [];
    outLines.push('<!doctype html>');
    outLines.push('<html>');
    outLines.push('<head>');
    outLines.push('  <meta charset="utf-8">');
    outLines.push('  <meta name="viewport" content="width=device-width, initial-scale=1.0">');
    outLines.push('  <title>Playable - single file</title>');
    outLines.push('</head>');
    outLines.push('<body>');
    outLines.push('  <div id="app"></div>');
    outLines.push('  <script type="module">');

    // module texts object
    outLines.push('  const __MODULE_TEXTS = {};');
    for (const [name, txt] of Object.entries(modules)) {
      // Use JSON.stringify to safely embed the module text as a JS string literal
      outLines.push('  __MODULE_TEXTS[' + JSON.stringify(name) + '] = ' + JSON.stringify(txt) + ';');
    }

    // runtime code: create temp blobs, replace placeholders with temp urls, then recreate final blobs
    outLines.push(`
  (function(){
    const tempUrls = {};
    const finalTexts = {};
    const finalUrls = {};
    // create temp blobs with placeholder content
    for (const k of Object.keys(__MODULE_TEXTS)){
      const b = new Blob([__MODULE_TEXTS[k]], {type:'text/javascript'});
      tempUrls[k] = URL.createObjectURL(b);
    }
    // replace placeholders with tempUrls to compute final texts
    for (const k of Object.keys(__MODULE_TEXTS)){
      let t = __MODULE_TEXTS[k];
      // match placeholders even if they contain repeated underscores or extra 'MODULE' markers
      // extract the last ".js" filename from the placeholder string so nested placeholders still resolve
      t = t.replace(/___MODULE__+[^_]+?__+/g, (m) => {
        const idx = m.lastIndexOf('.js');
        let name = m;
        if (idx !== -1) {
          let start = idx;
          while (start > 0 && /[A-Za-z0-9_.-]/.test(m[start-1])) start--;
          name = m.substring(start, idx + 3);
        }
        return tempUrls[name] || name;
      });
      finalTexts[k] = t;
    }
    // revoke temp urls
    for (const k in tempUrls) URL.revokeObjectURL(tempUrls[k]);
    // create final blobs and urls
    for (const k of Object.keys(finalTexts)){
      const b = new Blob([finalTexts[k]], {type:'text/javascript'});
      finalUrls[k] = URL.createObjectURL(b);
    }
    // import entry
    import(finalUrls[${JSON.stringify(entryName)}]).catch(e=>{console.error('Failed to import entry module',e)});
  })();
`);

    outLines.push('  </script>');
    outLines.push('</body>');
    outLines.push('</html>');

    await fs.mkdir(OUT_DIR, { recursive: true });
    await fs.writeFile(OUT_FILE, outLines.join('\n'), 'utf8');
    console.log(`Wrote single-file playable to ${OUT_FILE}`);
    process.exit(0);
  } catch (err) {
    console.error('make-single-file failed:', err);
    process.exit(1);
  }
}

main();
