import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';

const distDir = resolve(process.cwd(), 'dist');

// 1. Asegurar archivo .nojekyll en dist para GitHub Pages
try {
  copyFileSync(resolve(distDir, '../public/.nojekyll'), resolve(distDir, '.nojekyll'));
} catch (e) {
  // Ignorar si ya existe
}

// 2. Crear 404.html desde index.html para fallback de rutas en GitHub Pages
if (existsSync(resolve(distDir, 'index.html'))) {
  copyFileSync(resolve(distDir, 'index.html'), resolve(distDir, '404.html'));
  console.log('[Postbuild] 404.html creado para GitHub Pages.');
}

// 3. Replicar operador para todas las variantes posibles de URL
const operadorHtml = resolve(distDir, 'operador/index.html');
if (existsSync(operadorHtml)) {
  // dist/operador.html
  copyFileSync(operadorHtml, resolve(distDir, 'operador.html'));
  
  // dist/operator/index.html
  mkdirSync(resolve(distDir, 'operator'), { recursive: true });
  copyFileSync(operadorHtml, resolve(distDir, 'operator/index.html'));

  console.log('[Postbuild] Rutas /operador y /operator sincronizadas exitosamente.');
}
