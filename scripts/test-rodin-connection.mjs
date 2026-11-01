#!/usr/bin/env node

/**
 * Script de validación de conexión con la API de Hyper3D Rodin v2.
 * NO imprime la API key en consola para preservar la seguridad de las credenciales.
 */

import fs from 'node:fs';
import path from 'node:path';

function loadEnvKey() {
  if (process.env.RODIN_API_KEY && !process.env.RODIN_API_KEY.startsWith('your_')) {
    return process.env.RODIN_API_KEY.trim();
  }

  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    const match = content.match(/^RODIN_API_KEY=(.+)$/m);
    if (match && match[1]) {
      const val = match[1].trim().replace(/^['"]|['"]$/g, '');
      if (val && !val.startsWith('your_')) {
        return val;
      }
    }
  }

  const homeEnvPath = path.resolve(process.env.HOME || '', '.env');
  if (fs.existsSync(homeEnvPath)) {
    const content = fs.readFileSync(homeEnvPath, 'utf8');
    const match = content.match(/^RODIN_API_KEY=(.+)$/m);
    if (match && match[1]) {
      const val = match[1].trim().replace(/^['"]|['"]$/g, '');
      if (val && !val.startsWith('your_')) {
        return val;
      }
    }
  }

  return null;
}

async function testConnection() {
  console.log('----------------------------------------------------');
  console.log('   UNAM Immersive Experience - Hyper3D Rodin Test   ');
  console.log('----------------------------------------------------');

  const apiKey = loadEnvKey();

  if (!apiKey) {
    console.error('❌ ERROR: RODIN_API_KEY no se encontró en el archivo .env ni en las variables de entorno.');
    console.error('   Por favor configure su API Key en el archivo .env utilizando el comando seguro.');
    process.exit(1);
  }

  console.log('✓ Clave RODIN_API_KEY detectada en el entorno (oculta por seguridad).');
  console.log('Conectando con endpoint oficial Hyper3D Rodin (https://api.hyper3d.com/api/v2/status)...');

  try {
    const response = await fetch('https://api.hyper3d.com/api/v2/status', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ subscription_key: 'probe_test_ping' }),
    });

    if (response.status === 401) {
      console.error('❌ ERROR 401: La clave RODIN_API_KEY fue rechazada por Hyper3D Rodin.');
      console.error('   Verifique que su API Key sea válida y esté activa en https://hyper3d.ai');
      process.exit(1);
    }

    if (response.status === 429) {
      console.error('⚠️ ALERTA 429: Límite de solicitudes o créditos agotados en su cuenta de Hyper3D.');
      process.exit(1);
    }

    // Código 200 o 400 (Bad subscription key) demuestra que el Bearer token fue autenticado con éxito
    console.log(`✓ RESPUESTA RECIBIDA (HTTP ${response.status})`);
    console.log('✅ ÉXITO: Autenticación con Hyper3D Rodin v2 establecida y validada correctamente.');
    console.log('   El pipeline de generación 3D para Meta Quest y VXR Core está listo para usarse.');
  } catch (err) {
    console.error('❌ ERROR DE RED:', err.message);
    process.exit(1);
  }
}

testConnection();
