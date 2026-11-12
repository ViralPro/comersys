const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

describe('Integridad de Recursos Frontend ComerSys', () => {
  function extractLocalAssets(htmlContent) {
    const cssMatches = [...htmlContent.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["']/gi)]
      .map(m => m[1])
      .filter(href => !href.startsWith('http') && !href.startsWith('//') && !href.startsWith('data:'));

    const jsMatches = [...htmlContent.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)]
      .map(m => m[1])
      .filter(src => !src.startsWith('http') && !src.startsWith('//') && !src.startsWith('data:'));

    return { cssMatches, jsMatches };
  }

  function extractGetElementById(jsContent) {
    const regex = /getElementById\(['"]([a-zA-Z0-9_-]+)['"]\)/g;
    const ids = [];
    let match;
    while ((match = regex.exec(jsContent)) !== null) {
      ids.push(match[1]);
    }
    return [...new Set(ids)];
  }

  it('index.html (ComerSys Cliente) debe existir y todos sus assets locales deben estar en disco', () => {
    const indexPath = path.join(ROOT_DIR, 'index.html');
    assert.strictEqual(fs.existsSync(indexPath), true);
    const content = fs.readFileSync(indexPath, 'utf8');

    const { cssMatches, jsMatches } = extractLocalAssets(content);
    assert.ok(cssMatches.length > 0, 'Debe haber enlaces a hojas de estilo CSS');
    assert.ok(jsMatches.length > 0, 'Debe haber enlaces a scripts JS');

    for (const cssFile of cssMatches) {
      const cleanPath = cssFile.replace(/^\/+/, '').split('?')[0];
      const fullPath = path.join(ROOT_DIR, cleanPath);
      assert.strictEqual(fs.existsSync(fullPath), true, `El archivo CSS referenciado ${cssFile} no existe en ${fullPath}`);
    }

    for (const jsFile of jsMatches) {
      const cleanPath = jsFile.replace(/^\/+/, '').split('?')[0];
      const fullPath = path.join(ROOT_DIR, cleanPath);
      assert.strictEqual(fs.existsSync(fullPath), true, `El archivo JS referenciado ${jsFile} no existe en ${fullPath}`);
    }
  });

  it('admin-central/index.html debe existir y todos sus assets locales deben estar en disco', () => {
    const adminPath = path.join(ROOT_DIR, 'admin-central', 'index.html');
    assert.strictEqual(fs.existsSync(adminPath), true);
    const content = fs.readFileSync(adminPath, 'utf8');

    const { cssMatches, jsMatches } = extractLocalAssets(content);
    assert.ok(cssMatches.length > 0, 'Debe haber enlaces a hojas de estilo CSS en Admin');
    assert.ok(jsMatches.length > 0, 'Debe haber enlaces a scripts JS en Admin');

    const adminDir = path.join(ROOT_DIR, 'admin-central');
    for (const cssFile of cssMatches) {
      const cleanPath = cssFile.replace(/^\/+/, '').split('?')[0];
      const fullPathAdmin = path.join(adminDir, cleanPath);
      const fullPathRoot = path.join(ROOT_DIR, cleanPath);
      const exists = fs.existsSync(fullPathAdmin) || fs.existsSync(fullPathRoot);
      assert.strictEqual(exists, true, `El archivo CSS referenciado en Admin ${cssFile} no existe`);
    }

    for (const jsFile of jsMatches) {
      const cleanPath = jsFile.replace(/^\/+/, '').split('?')[0];
      const fullPathAdmin = path.join(adminDir, cleanPath);
      const fullPathRoot = path.join(ROOT_DIR, cleanPath);
      const exists = fs.existsSync(fullPathAdmin) || fs.existsSync(fullPathRoot);
      assert.strictEqual(exists, true, `El archivo JS referenciado en Admin ${jsFile} no existe`);
    }
  });

  it('todos los IDs de elementos DOM referenciados en admin-central/js/admin.js deben existir en admin-central/index.html', () => {
    const adminHtmlPath = path.join(ROOT_DIR, 'admin-central', 'index.html');
    const adminJsPath = path.join(ROOT_DIR, 'admin-central', 'js', 'admin.js');
    const html = fs.readFileSync(adminHtmlPath, 'utf8');
    const js = fs.readFileSync(adminJsPath, 'utf8');

    const ids = extractGetElementById(js);
    assert.ok(ids.length > 0, 'Debe haber IDs en admin.js');

    const missing = ids.filter(id => !html.includes(`id="${id}"`) && !html.includes(`id='${id}'`));
    assert.deepStrictEqual(missing, [], `Los siguientes IDs referenciados en admin.js faltan en admin-central/index.html: ${missing.join(', ')}`);
  });

  it('todos los IDs de elementos DOM estructurales referenciados en js/app.js deben existir en index.html', () => {
    const indexPath = path.join(ROOT_DIR, 'index.html');
    const appJsPath = path.join(ROOT_DIR, 'js', 'app.js');
    const html = fs.readFileSync(indexPath, 'utf8');
    const js = fs.readFileSync(appJsPath, 'utf8');

    const ids = extractGetElementById(js);
    assert.ok(ids.length > 0, 'Debe haber IDs en app.js');

    // IDs dinámicos generados por módulos o plantillas pueden no estar estáticamente en el HTML base,
    // pero los IDs directos de app.js (vistas, modales base, contenedores) deben estar presentes.
    const missing = ids.filter(id => !html.includes(`id="${id}"`) && !html.includes(`id='${id}'`));
    assert.deepStrictEqual(missing, [], `Los siguientes IDs referenciados en js/app.js faltan en index.html: ${missing.join(', ')}`);
  });

  it('los favicons del sistema deben existir en raíz y admin-central', () => {
    assert.strictEqual(fs.existsSync(path.join(ROOT_DIR, 'favicon.svg')), true);
    assert.strictEqual(fs.existsSync(path.join(ROOT_DIR, 'favicon.ico')), true);
    assert.strictEqual(fs.existsSync(path.join(ROOT_DIR, 'admin-central', 'favicon.svg')), true);
    assert.strictEqual(fs.existsSync(path.join(ROOT_DIR, 'admin-central', 'favicon.ico')), true);
  });
});
