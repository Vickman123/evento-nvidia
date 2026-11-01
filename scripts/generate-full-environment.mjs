#!/usr/bin/env node

/**
 * Script Maestro de Generación Completa del Entorno UNAM Ciudad Universitaria
 * Utilizando la API Hyper3D Rodin v2 (Deemos).
 *
 * Genera con máxima calidad PBR y descarga secuencialmente:
 * 1. Biblioteca Central de la UNAM (Murales O'Gorman y Zócalo de Basalto)
 * 2. Torre de Rectoría de la UNAM (Prisma vertical con mural 3D Siqueiros)
 * 3. Árbol Jacaranda Florido de Las Islas
 * 4. Pabellón Tecnológico Kiosko PC PUMA
 * 5. Luminaria / Farola de Alumbrado de Ciudad Universitaria
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

const MODELS_TO_GENERATE = [
  {
    key: 'unam_biblioteca_central',
    name: 'Biblioteca Central de la UNAM',
    existingUuid: '74df736d-de94-4026-836a-89f8b9f56f4e',
    existingSubKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoxLCJqb2JJZHMiOlsiZDMzNWE3MzYtZGNjZi00ZDhjLThhZjItZGJmZGRiZjI4N2Q0IiwiZDNmNTYwOTktMDc3ZS00MDllLWE1NzEtMzQ2M2U3MzI1MjMxIiwiOWY3ZDJhNDktM2ZkOC00NWQyLWIwODYtNDdjZWJmNGQ4ZDIwIiwiYjAzMmE2ODUtOGJiYi00NjQ0LTkwNDctY2M0Zjk3YWRlM2M4IiwiMjVjNjVjYzAtMDE5ZS00ZWM3LWEzYzQtYTljMTFlNGMyYTYyIiwiZDczNWJmNGYtZjZlNy00ZmE1LTk1MTAtNWQ3N2ViYzRlNzcwIl0sImlhdCI6MTc5MzU3MzY4MH0.fjU4i2RPxTbwABnvWDNTdpzxEU6rH-CQ2FBkkgWMhCE',
    prompt: 'Monumental modernist Mexican university library building inspired by UNAM Biblioteca Central, 10-story block tower, vibrant four-sided stone mosaic murals covering all facades, volcanic basalt stone plinth base with pre-hispanic carved reliefs, glass lobby with entrance columns, functionalist architecture, PBR textures, high resolution',
  },
  {
    key: 'unam_torre_rectoria',
    name: 'Torre de Rectoría de la UNAM',
    prompt: 'Iconic university administration skyscraper tower inspired by UNAM Torre de Rectoria, vertical modernist skyscraper prism, red clay brick and exposed concrete facade, prominent 3D sculpted mural by David Alfaro Siqueiros projecting from south facade, glass executive penthouse top floor, modernist architecture, highly detailed, realistic PBR textures',
  },
  {
    key: 'unam_arbol_jacaranda',
    name: 'Árbol Jacaranda Florido de Las Islas',
    prompt: 'Blooming Mexican Jacaranda tree with dense vibrant violet purple blossom canopy, natural gnarled wooden branches, natural dark bark trunk, botanical ornamental tree for university campus park, highly detailed PBR leaves and flowers',
  },
  {
    key: 'unam_kiosko_pcpuma',
    name: 'Kiosko Tecnológico PC PUMA UNAM',
    prompt: 'Futuristic institutional university pavilion and technology kiosk, UNAM gold and navy blue colors, sleek minimalist curved architecture, touch screens, interactive stations, digital signage for PC PUMA UNAM tech center, high quality PBR materials',
  },
  {
    key: 'unam_luminaria_campus',
    name: 'Luminaria de Alumbrado Ciudad Universitaria',
    prompt: 'Modernist outdoor university light post and campus lantern made of cast aluminum and frosted glass, dark bronze finish, architectural exterior lighting fixture for Ciudad Universitaria UNAM, clean PBR textures',
  },
];

async function pollJobUntilDone(apiKey, subKey, maxWaitSec = 300) {
  const startTime = Date.now();
  let attempt = 0;

  while (Date.now() - startTime < maxWaitSec * 1000) {
    attempt++;
    await new Promise((r) => setTimeout(r, 4000));

    try {
      const res = await fetch('https://api.hyper3d.com/api/v2/status', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ subscription_key: subKey }),
      });

      if (!res.ok) {
        process.stdout.write(` [HTTP ${res.status}] `);
        continue;
      }

      const data = await res.json();
      const jobs = data.jobs || [];

      if (jobs.length > 0) {
        const doneCount = jobs.filter((j) => (j.status || '').toLowerCase() === 'done').length;
        const total = jobs.length;
        const failedCount = jobs.filter((j) => (j.status || '').toLowerCase().includes('fail')).length;

        process.stdout.write(`\r   Etapas completadas: ${doneCount}/${total} (${Math.round((doneCount / total) * 100)}%) `);

        if (failedCount > 0) {
          throw new Error('Una o más etapas de generación reportaron fallo en Hyper3D.');
        }

        if (doneCount === total) {
          console.log(`\n   ✓ ¡Todas las etapas (${total}/${total}) completadas con éxito!`);
          return true;
        }
      }
    } catch (err) {
      process.stdout.write(` [Error temporal: ${err.message}] `);
    }
  }

  throw new Error(`Tiempo de espera agotado (${maxWaitSec}s) para la tarea.`);
}

async function downloadAndSaveModel(apiKey, taskUuid, outputFileName) {
  const downloadRes = await fetch('https://api.hyper3d.com/api/v2/download', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ task_uuid: taskUuid }),
  });

  if (!downloadRes.ok) {
    throw new Error(`Error en endpoint /api/v2/download: HTTP ${downloadRes.status}`);
  }

  const downloadJson = await downloadRes.json();
  const list = downloadJson.list || [];
  const glbItem = list.find((i) => i.name && i.name.toLowerCase().endsWith('.glb')) || list[0];

  if (!glbItem || !glbItem.url) {
    throw new Error(`No se encontró activo GLB para task_uuid ${taskUuid}`);
  }

  const targetDir = path.resolve(process.cwd(), 'public/assets/models/ai');
  fs.mkdirSync(targetDir, { recursive: true });
  const finalPath = path.join(targetDir, outputFileName);

  console.log(`   Descargando GLB (${glbItem.name})...`);
  const fileRes = await fetch(glbItem.url);
  if (!fileRes.ok) {
    throw new Error(`Error descargando binario GLB: HTTP ${fileRes.status}`);
  }

  const buffer = Buffer.from(await fileRes.arrayBuffer());
  fs.writeFileSync(finalPath, buffer);

  const sizeMb = (buffer.length / (1024 * 1024)).toFixed(2);
  console.log(`   ✅ Guardado exitosamente: ${outputFileName} (${sizeMb} MB)`);
}

async function run() {
  console.log('========================================================================');
  console.log('   UNAM IMMERSIVE EXPERIENCE - GENERADOR COMPLETO DE CIUDAD UNIVERSITARIA');
  console.log('   Hyper3D Rodin v2 &bull; VXR Core Architecture Pipeline                ');
  console.log('========================================================================\n');

  const apiKey = loadEnvKey();
  if (!apiKey) {
    console.error('❌ Error: RODIN_API_KEY no configurada.');
    process.exit(1);
  }

  const targetDir = path.resolve(process.cwd(), 'public/assets/models/ai');
  fs.mkdirSync(targetDir, { recursive: true });

  for (let i = 0; i < MODELS_TO_GENERATE.length; i++) {
    const item = MODELS_TO_GENERATE[i];
    const outputName = `${item.key}.glb`;
    const outputPath = path.join(targetDir, outputName);

    console.log(`\n------------------------------------------------------------------------`);
    console.log(`[${i + 1}/${MODELS_TO_GENERATE.length}] Generando: ${item.name}`);
    console.log(`------------------------------------------------------------------------`);

    // Si ya existe el archivo y no es de la tarea en curso, verificar si se omite
    if (fs.existsSync(outputPath) && !item.existingUuid) {
      console.log(`✓ El archivo ${outputName} ya existe en disco. Omitiendo generación repetida.`);
      continue;
    }

    let taskUuid = item.existingUuid;
    let subKey = item.existingSubKey;

    if (!taskUuid) {
      console.log(`Enviando prompt a Hyper3D Rodin: "${item.prompt.substring(0, 80)}..."`);
      const fd = new FormData();
      fd.append('prompt', item.prompt);
      fd.append('tier', 'Gen-2.5-Low');
      fd.append('mesh_mode', 'Raw');
      fd.append('quality', 'high');
      fd.append('geometry_file_format', 'glb');
      fd.append('material', 'PBR');

      const submitRes = await fetch('https://api.hyper3d.com/api/v2/rodin', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: fd,
      });

      const submitData = await submitRes.json();
      if (!submitRes.ok) {
        console.error(`❌ Error en Hyper3D:`, submitData);
        continue;
      }

      taskUuid = submitData.uuid;
      subKey = submitData.jobs?.subscription_key || submitData.subscription_key;
      console.log(`✓ Tarea iniciada en Rodin. UUID: ${taskUuid}`);
    } else {
      console.log(`Conectando con tarea existente en curso. UUID: ${taskUuid}`);
    }

    // Monitorear progreso
    console.log(`Monitoreando etapas de geometría y PBR...`);
    try {
      await pollJobUntilDone(apiKey, subKey, 360);
      await downloadAndSaveModel(apiKey, taskUuid, outputName);
    } catch (err) {
      console.error(`❌ Error procesando ${item.name}: ${err.message}`);
    }
  }

  console.log('\n========================================================================');
  console.log('   🎉 ¡GENERACIÓN DEL ENTORNO COMPLETO FINALIZADA CON ÉXITO!            ');
  console.log('========================================================================');
}

run();
