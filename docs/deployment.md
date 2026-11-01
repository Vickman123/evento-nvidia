# Guía de Despliegue en GitHub Pages y Servidores Estáticos
## UNAM Immersive Experience – PC PUMA

La aplicación está diseñada para ser 100% estática (*Zero-Backend Architecture*), lo que permite alojarla sin costo en **GitHub Pages**, Vercel, Netlify o cualquier servidor web Apache/Nginx con HTTPS.

---

## 1. Despliegue Automatizado con GitHub Actions (Recomendado)

El repositorio incluye el archivo de flujo de trabajo `.github/workflows/deploy.yml`. Cada vez que realices un `push` a la rama `main`, GitHub compilará automáticamente el proyecto y lo publicará.

### Pasos para configurar GitHub Pages en tu repositorio:
1. Sube tu proyecto a GitHub:
   ```bash
   git init
   git add .
   git commit -m "feat: UNAM Immersive Experience PC PUMA WebXR"
   git branch -M main
   git remote add origin https://github.com/<tu-usuario>/<tu-repositorio>.git
   git push -u origin main
   ```
2. En GitHub, ingresa a **Settings** ➔ **Pages**.
3. En la sección **Build and deployment**:
   - En **Source**, selecciona **GitHub Actions**.
4. ¡Listo! En unos segundos tu experiencia estará en línea con HTTPS obligatorio en:
   `https://<tu-usuario>.github.io/<tu-repositorio>/`

---

## 2. Despliegue Manual a la Rama `gh-pages`

Si prefieres compilar localmente y subir únicamente la carpeta `dist`:

```bash
# 1. Compilar artefactos
npm run build

# 2. Publicar dist con git subtree o npx gh-pages
npx gh-pages -d dist
```

---

## 3. Requisito Fundamental: HTTPS para WebXR

El estándar **WebXR Device API** requiere estrictamente un contexto seguro (**HTTPS**).
- **GitHub Pages** proporciona certificados SSL/TLS automáticamente para todos los subdominios `github.io`.
- Si hospedas en un servidor local para un stand sin conexión a internet, utiliza un certificado autofirmado o herramientas como `mkcert` para habilitar HTTPS local (`https://192.168.x.x`).

---

## 4. Configuración de Rutas Relativas en Vite

El archivo `vite.config.ts` tiene configurado:

```typescript
export default defineConfig({
  base: './', // Garantiza que los archivos JS, modelos y videos se carguen con rutas relativas
  // ...
});
```

Esto asegura que sin importar si el proyecto está en la raíz de un dominio o en un subdirectorio (`/mi-proyecto/`), todos los recursos multimedia funcionarán de inmediato.
