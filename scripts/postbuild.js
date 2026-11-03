import { copyFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { resolve } from 'path';

const rootDir = process.cwd();
const distDir = resolve(rootDir, 'dist');

// 1. Asegurar archivo .nojekyll en dist y en root para GitHub Pages
try {
  copyFileSync(resolve(distDir, '../public/.nojekyll'), resolve(distDir, '.nojekyll'));
  copyFileSync(resolve(distDir, '../public/.nojekyll'), resolve(rootDir, '.nojekyll'));
} catch (e) {
  // Ignorar si ya existe
}

// 2. Crear 404.html desde index.html para fallback de rutas en GitHub Pages (en dist y en root)
if (existsSync(resolve(distDir, 'index.html'))) {
  copyFileSync(resolve(distDir, 'index.html'), resolve(distDir, '404.html'));
  copyFileSync(resolve(distDir, 'index.html'), resolve(rootDir, '404.html'));
  console.log('[Postbuild] 404.html creado para GitHub Pages.');
}

// 3. Replicar operador para todas las variantes posibles de URL
const operadorHtml = resolve(distDir, 'operador/index.html');
if (existsSync(operadorHtml)) {
  // dist/operador.html y root/operador.html
  copyFileSync(operadorHtml, resolve(distDir, 'operador.html'));
  copyFileSync(operadorHtml, resolve(rootDir, 'operador.html'));
  
  // dist/operator/index.html y root/operator/index.html
  mkdirSync(resolve(distDir, 'operator'), { recursive: true });
  copyFileSync(operadorHtml, resolve(distDir, 'operator/index.html'));

  mkdirSync(resolve(rootDir, 'operator'), { recursive: true });
  copyFileSync(operadorHtml, resolve(rootDir, 'operator/index.html'));

  console.log('[Postbuild] Rutas /operador y /operator sincronizadas exitosamente.');
}

// 4. Sincronizar bundles precompilados de dist/assets hacia assets/ en root
// Garantiza funcionamiento inmediato si GitHub Pages está configurado en 'Deploy from branch main'
const distAssetsDir = resolve(distDir, 'assets');
const rootAssetsDir = resolve(rootDir, 'assets');
if (existsSync(distAssetsDir)) {
  mkdirSync(rootAssetsDir, { recursive: true });
  const files = readdirSync(distAssetsDir);
  for (const f of files) {
    const srcFile = resolve(distAssetsDir, f);
    const destFile = resolve(rootAssetsDir, f);
    try {
      copyFileSync(srcFile, destFile);
    } catch (e) {}
  }
  console.log('[Postbuild] Bundles sincronizados a assets/ en root para compatibilidad total con GitHub Pages.');
}
