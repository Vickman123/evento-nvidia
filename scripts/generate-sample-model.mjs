#!/usr/bin/env node

/**
 * Script de generación y validación real con la API Hyper3D Rodin v2.
 * Solicita la generación de un modelo 3D institucional para UNAM Immersive Experience,
 * sondea el estado de la tarea y descarga el activo .glb final.
 */

import fs from 'node:fs';
import path from 'node:path';

function loadEnvKey() {
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
  return process.env.RODIN_API_KEY || null;
}

async function runRealGenerationTest() {
  console.log('====================================================');
  console.log('   UNAM 3D AI Studio - Generación Real Hyper3D Rodin ');
  console.log('====================================================');

  const apiKey = loadEnvKey();
  if (!apiKey) {
    console.error('❌ Error: RODIN_API_KEY no encontrada.');
    process.exit(1);
  }

  // 1. Preparar parámetros de generación para un modelo de Ciudad Universitaria
  const prompt = 'Modernist outdoor university bench made of dark volcanic basalt stone and Mexican cantera stone with wooden seat slats, minimalist architectural campus furniture, UNAM Ciudad Universitaria, realistic PBR';

  console.log(`\n[Paso 1/4] Creando tarea de generación 3D con IA...`);
  console.log(`Prompt: "${prompt}"`);

  const formData = new FormData();
  formData.append('prompt', prompt);
  formData.append('tier', 'Gen-2.5-Medium');
  formData.append('mesh_mode', 'Raw');
  formData.append('quality', 'medium');
  formData.append('geometry_file_format', 'glb');
  formData.append('material', 'PBR');

  let taskUuid = null;
  let subscriptionKey = null;

  try {
    const res = await fetch('https://api.hyper3d.com/api/v2/rodin', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    const resJson = await res.json();

    if (!res.ok) {
      console.error(`❌ Error en respuesta de Hyper3D (HTTP ${res.status}):`, resJson);
      process.exit(1);
    }

    console.log('✓ Tarea enviada exitosamente a la cola de Hyper3D.');
    console.log(`  Mensaje: ${resJson.message || 'Submitted.'}`);
    console.log(`  UUID de tarea: ${resJson.uuid}`);
    console.log(`  Créditos consumidos: ${resJson.consumed ?? 'N/A'}`);

    taskUuid = resJson.uuid;
    subscriptionKey = resJson.jobs?.subscription_key || resJson.subscription_key;

    if (!subscriptionKey) {
      console.warn('⚠️ No se recibió subscription_key explícita en jobs. Estructura de respuesta:', resJson);
    }
  } catch (err) {
    console.error('❌ Excepción al conectar con endpoint de generación:', err.message);
    process.exit(1);
  }

  // 2. Monitorear progreso
  console.log(`\n[Paso 2/4] Sondeando estado de la tarea en Hyper3D Rodin...`);

  const maxAttempts = 60; // 60 * 5s = hasta 5 minutos
  let attempt = 0;
  let completed = false;

  while (attempt < maxAttempts && !completed) {
    attempt++;
    await new Promise((resolve) => setTimeout(resolve, 5000));

    try {
      const statusRes = await fetch('https://api.hyper3d.com/api/v2/status', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ subscription_key: subscriptionKey }),
      });

      if (!statusRes.ok) {
        console.warn(`[Intento ${attempt}] HTTP ${statusRes.status} al consultar estado.`);
        continue;
      }

      const statusData = await statusRes.json();
      const state = (statusData.status || statusData.state || '').toUpperCase();
      const progress = statusData.progress ?? (statusData.jobs && statusData.jobs[0]?.progress) ?? (attempt * 2);

      process.stdout.write(`\r   Progreso estimado: ${progress}% (Estado: ${state || 'PROCESANDO'}) [${attempt}/${maxAttempts}] `);

      if (state.includes('SUCCEED') || state === 'COMPLETED' || state === 'SUCCESS') {
        completed = true;
        console.log(`\n✓ ¡Generación tridimensional completada con éxito por Hyper3D Rodin!`);
        break;
      } else if (state.includes('FAIL') || state.includes('ERR')) {
        console.log(`\n❌ La tarea falló en los servidores de Hyper3D.`);
        process.exit(1);
      }
    } catch (pollErr) {
      console.warn(`\nError en sondeo: ${pollErr.message}`);
    }
  }

  if (!completed) {
    console.log(`\n⏳ La tarea sigue procesándose en segundo plano (UUID: ${taskUuid}).`);
    console.log('   Puedes monitorearla y cargarla en cualquier momento desde: http://localhost:3001/generator.html');
    process.exit(0);
  }

  // 3. Obtener enlace de descarga del GLB
  console.log(`\n[Paso 3/4] Solicitando enlace de descarga oficial para task_uuid: ${taskUuid}...`);

  try {
    const downloadRes = await fetch('https://api.hyper3d.com/api/v2/download', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ task_uuid: taskUuid }),
    });

    if (!downloadRes.ok) {
      console.error(`❌ Error solicitando descarga (HTTP ${downloadRes.status}):`, await downloadRes.text());
      process.exit(1);
    }

    const downloadJson = await downloadRes.json();
    const list = downloadJson.list || [];
    const glbItem = list.find((item) => item.name && item.name.toLowerCase().endsWith('.glb')) || list[0];

    if (!glbItem || !glbItem.url) {
      console.error('❌ No se encontró archivo GLB en el listado de resultados:', downloadJson);
      process.exit(1);
    }

    console.log(`✓ Archivo GLB disponible: ${glbItem.name}`);

    // 4. Descargar y almacenar en public/assets/models/ai/
    console.log(`\n[Paso 4/4] Descargando modelo GLB en assets locales...`);
    const modelTargetDir = path.resolve(process.cwd(), 'public/assets/models/ai');
    fs.mkdirSync(modelTargetDir, { recursive: true });

    const localFileName = 'unam_banca_cantera.glb';
    const localFilePath = path.join(modelTargetDir, localFileName);

    const fileRes = await fetch(glbItem.url);
    if (!fileRes.ok) {
      console.error(`❌ Error descargando archivo binario (HTTP ${fileRes.status})`);
      process.exit(1);
    }

    const arrayBuffer = await fileRes.arrayBuffer();
    fs.writeFileSync(localFilePath, Buffer.from(arrayBuffer));

    const sizeKb = Math.round(arrayBuffer.byteLength / 1024);
    console.log(`✅ ¡Modelo descargado e integrado exitosamente!`);
    console.log(`   Ubicación: public/assets/models/ai/${localFileName}`);
    console.log(`   Tamaño del archivo: ${sizeKb} KB`);
    console.log(`   Listo para renderizarse en Three.js, VXR Core y Meta Quest.`);
  } catch (downloadErr) {
    console.error('❌ Excepción durante la descarga del modelo:', downloadErr.message);
    process.exit(1);
  }
}

runRealGenerationTest();
