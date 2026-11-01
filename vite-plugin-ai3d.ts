import type { Plugin } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Carga variables de entorno desde el archivo .env si existen
 */
function getRodinApiKey(): string | null {
  if (process.env.RODIN_API_KEY && !process.env.RODIN_API_KEY.startsWith('your_')) {
    return process.env.RODIN_API_KEY.trim();
  }

  // Leer directamente desde .env en la raíz del proyecto
  try {
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
  } catch (err) {
    console.warn('[AI3D Proxy] Error leyendo .env:', err);
  }

  // Comprobar también en ~/.env si aplica
  try {
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
  } catch {}

  return null;
}

/**
 * Lee el cuerpo de una petición Node.js como Buffer
 */
function readRequestBody(req: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/**
 * Vite Plugin que proporciona un proxy backend seguro para la API Hyper3D Rodin v2.
 * Previene que la API Key se envíe o exponga en el navegador web o en Meta Quest.
 */
export function ai3dProxyPlugin(): Plugin {
  return {
    name: 'vite-plugin-ai3d-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '';

        if (!url.startsWith('/api/ai3d/')) {
          return next();
        }

        const apiKey = getRodinApiKey();

        // 1. Endpoint: GET /api/ai3d/auth-check
        if (url.startsWith('/api/ai3d/auth-check') && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          if (!apiKey) {
            res.statusCode = 401;
            res.end(
              JSON.stringify({
                authenticated: false,
                message: 'RODIN_API_KEY no encontrada o no configurada en .env.',
              })
            );
            return;
          }

          // Verificar validez contra Hyper3D
          try {
            const probeRes = await fetch('https://api.hyper3d.com/api/v2/status', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ subscription_key: 'probe_test_ping' }),
            });

            if (probeRes.status === 401) {
              res.statusCode = 401;
              res.end(
                JSON.stringify({
                  authenticated: false,
                  message: 'API Key rechazada por Hyper3D Rodin (401 Unauthorized). Verifique su credencial.',
                })
              );
              return;
            }

            if (probeRes.status === 429) {
              res.statusCode = 429;
              res.end(
                JSON.stringify({
                  authenticated: false,
                  message: 'Límite de solicitudes de Hyper3D alcanzado (429 Rate Limit).',
                })
              );
              return;
            }

            // Si responde 200 o 400 (Bad subscription key), significa que la autenticación Bearer fue aceptada
            res.statusCode = 200;
            res.end(
              JSON.stringify({
                authenticated: true,
                message: 'Conexión con Hyper3D Rodin v2 validada correctamente.',
              })
            );
          } catch (probeErr: any) {
            res.statusCode = 502;
            res.end(
              JSON.stringify({
                authenticated: false,
                message: `Error de red contactando Hyper3D Rodin: ${probeErr.message}`,
              })
            );
          }
          return;
        }

        // Para los demás endpoints se requiere API Key válida
        if (!apiKey) {
          res.statusCode = 401;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              error: 'RODIN_API_KEY no configurada en el servidor. Configure la variable en su archivo .env.',
            })
          );
          return;
        }

        // 2. Endpoint: POST /api/ai3d/generate
        if (url.startsWith('/api/ai3d/generate') && req.method === 'POST') {
          try {
            const bodyBuffer = await readRequestBody(req);
            const contentType = req.headers['content-type'] || 'application/json';

            const rodinRes = await fetch('https://api.hyper3d.com/api/v2/rodin', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': contentType,
              },
              body: bodyBuffer,
            });

            const rodinData = await rodinRes.text();
            res.statusCode = rodinRes.status;
            res.setHeader('Content-Type', 'application/json');
            res.end(rodinData);
          } catch (err: any) {
            console.error('[AI3D Proxy] Error en generación:', err);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message || 'Error interno en proxy de generación' }));
          }
          return;
        }

        // 3. Endpoint: POST /api/ai3d/status
        if (url.startsWith('/api/ai3d/status') && req.method === 'POST') {
          try {
            const bodyBuffer = await readRequestBody(req);
            const rodinRes = await fetch('https://api.hyper3d.com/api/v2/status', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              },
              body: bodyBuffer,
            });

            const rodinData = await rodinRes.text();
            res.statusCode = rodinRes.status;
            res.setHeader('Content-Type', 'application/json');
            res.end(rodinData);
          } catch (err: any) {
            console.error('[AI3D Proxy] Error consultando estado:', err);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message || 'Error consultando estado en Rodin' }));
          }
          return;
        }

        // 4. Endpoint: POST /api/ai3d/download
        if (url.startsWith('/api/ai3d/download') && req.method === 'POST') {
          try {
            const bodyBuffer = await readRequestBody(req);
            const reqJson = JSON.parse(bodyBuffer.toString('utf8'));
            const taskUuid = reqJson.task_uuid;
            const saveName = reqJson.save_name || `model_${taskUuid}`;

            if (!taskUuid) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'task_uuid es requerido' }));
              return;
            }

            // Consultar enlaces de descarga en Hyper3D
            const downloadLinksRes = await fetch('https://api.hyper3d.com/api/v2/download', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ task_uuid: taskUuid }),
            });

            if (!downloadLinksRes.ok) {
              const errText = await downloadLinksRes.text();
              res.statusCode = downloadLinksRes.status;
              res.setHeader('Content-Type', 'application/json');
              res.end(errText);
              return;
            }

            const linksData: any = await downloadLinksRes.json();
            const list = linksData.list || [];
            // Buscar archivo GLB
            const glbItem = list.find((item: any) => item.name && item.name.toLowerCase().endsWith('.glb')) || list[0];

            if (!glbItem || !glbItem.url) {
              res.statusCode = 404;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'No se encontró archivo GLB en los resultados de Hyper3D' }));
              return;
            }

            // Descargar y almacenar localmente en public/assets/models/ai/
            const targetDir = path.resolve(process.cwd(), 'public/assets/models/ai');
            if (!fs.existsSync(targetDir)) {
              fs.mkdirSync(targetDir, { recursive: true });
            }

            const cleanFileName = `${saveName.replace(/[^a-zA-Z0-9_-]/g, '_')}.glb`;
            const filePath = path.join(targetDir, cleanFileName);

            const fileRes = await fetch(glbItem.url);
            if (!fileRes.ok) {
              throw new Error(`Error descargando binario GLB: HTTP ${fileRes.status}`);
            }

            const arrayBuffer = await fileRes.arrayBuffer();
            fs.writeFileSync(filePath, Buffer.from(arrayBuffer));

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                success: true,
                task_uuid: taskUuid,
                fileName: cleanFileName,
                localUrl: `assets/models/ai/${cleanFileName}`,
                downloadUrl: glbItem.url,
                fileSizeBytes: arrayBuffer.byteLength,
              })
            );
          } catch (err: any) {
            console.error('[AI3D Proxy] Error procesando descarga:', err);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message || 'Error procesando descarga' }));
          }
          return;
        }

        // Endpoint no reconocido dentro de /api/ai3d/
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Endpoint AI 3D no encontrado' }));
      });
    },
  };
}
