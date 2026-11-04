import { copyFileSync, cpSync, mkdirSync, existsSync } from 'fs';
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
  copyFileSync(operadorHtml, resolve(distDir, 'operator.html'));
  copyFileSync(operadorHtml, resolve(rootDir, 'operator.html'));
  
  // dist/operator/index.html y root/operator/index.html
  mkdirSync(resolve(distDir, 'operator'), { recursive: true });
  copyFileSync(operadorHtml, resolve(distDir, 'operator/index.html'));

  mkdirSync(resolve(rootDir, 'operator'), { recursive: true });
  copyFileSync(operadorHtml, resolve(rootDir, 'operator/index.html'));

  console.log('[Postbuild] Rutas /operador y /operator sincronizadas exitosamente.');
}

// 4. Sincronizar bundles precompilados y recursos de dist/assets hacia assets/ en root
// Garantiza funcionamiento inmediato si GitHub Pages está configurado en 'Deploy from branch main'
const distAssetsDir = resolve(distDir, 'assets');
const rootAssetsDir = resolve(rootDir, 'assets');
if (existsSync(distAssetsDir)) {
  mkdirSync(rootAssetsDir, { recursive: true });
  cpSync(distAssetsDir, rootAssetsDir, { recursive: true });
  console.log('[Postbuild] Bundles y assets sincronizados a assets/ en root para compatibilidad total con GitHub Pages.');
}

// 5. Sincronizar Service Worker para modo offline en root y dist
const publicSw = resolve(rootDir, 'public/sw.js');
if (existsSync(publicSw)) {
  copyFileSync(publicSw, resolve(distDir, 'sw.js'));
  copyFileSync(publicSw, resolve(rootDir, 'sw.js'));
  console.log('[Postbuild] sw.js (Service Worker) sincronizado para modo Offline.');
}
