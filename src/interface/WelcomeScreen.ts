/**
 * Pantalla inicial de bienvenida en HTML/DOM (ESTADO 1: IDLE).
 * Diseñada para el stand del evento: presenta identidad institucional UNAM y PC PUMA,
 * y activa explícitamente la sesión WebXR y el audio tras el toque del visitante.
 */

export class WelcomeScreen {
  private container: HTMLElement;
  private onStartCallback: (() => void) | null = null;
  private isVisible: boolean = true;

  constructor() {
    this.container = this.buildDOM();
    document.body.appendChild(this.container);
  }

  private buildDOM(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.id = 'vxr-welcome-screen';
    wrap.style.position = 'fixed';
    wrap.style.inset = '0';
    wrap.style.display = 'flex';
    wrap.style.flexDirection = 'column';
    wrap.style.alignItems = 'center';
    wrap.style.justifyContent = 'center';
    wrap.style.background = 'radial-gradient(circle at center, rgba(0, 23, 45, 0.95) 0%, rgba(2, 11, 22, 0.98) 100%)';
    wrap.style.color = '#ffffff';
    wrap.style.zIndex = '9990';
    wrap.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    wrap.style.padding = '24px';
    wrap.style.textAlign = 'center';
    wrap.style.backdropFilter = 'blur(10px)';
    wrap.style.transition = 'opacity 0.8s ease, visibility 0.8s ease';

    wrap.innerHTML = `
      <div style="max-width: 680px; width: 100%; display: flex; flex-direction: column; align-items: center;">
        <!-- Escudo / Logos -->
        <div style="display: flex; align-items: center; justify-content: center; gap: 24px; margin-bottom: 24px;">
          <div style="text-align: center;">
            <div style="font-size: 14px; font-weight: 700; letter-spacing: 0.15em; color: #D4AF37; text-transform: uppercase;">
              Universidad Nacional Autónoma de México
            </div>
            <div style="font-size: 12px; letter-spacing: 0.25em; color: #94A3B8; text-transform: uppercase; margin-top: 4px;">
              Ciudad Universitaria
            </div>
          </div>
        </div>

        <!-- Título Principal -->
        <h1 style="font-size: clamp(28px, 5vw, 44px); font-weight: 800; letter-spacing: -0.02em; margin: 0 0 12px 0; background: linear-gradient(135deg, #FFFFFF 0%, #38BDF8 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
          UNAM IMMERSIVE EXPERIENCE
        </h1>

        <!-- Subtítulo Institucional PC PUMA -->
        <div style="display: inline-flex; align-items: center; gap: 10px; background: rgba(0, 240, 255, 0.08); border: 1px solid rgba(0, 240, 255, 0.25); border-radius: 9999px; padding: 6px 18px; margin-bottom: 20px;">
          <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #00F0FF; box-shadow: 0 0 12px #00F0FF;"></span>
          <span style="font-size: 14px; font-weight: 700; letter-spacing: 0.08em; color: #00F0FF;">PRESENTED BY PC PUMA</span>
        </div>

        <p style="font-size: clamp(16px, 2.5vw, 19px); line-height: 1.6; color: #CBD5E1; margin: 0 0 36px 0; max-width: 540px;">
          Bienvenido a una nueva experiencia de aprendizaje inmersivo. Explora Ciudad Universitaria en 360° y descubre cómo la tecnología transforma la educación universitaria.
        </p>

        <!-- Botón Principal de Inicio -->
        <button id="btn-start-experience" style="
          background: linear-gradient(135deg, #002B7A 0%, #0284C7 100%);
          color: #FFFFFF;
          border: 1px solid #38BDF8;
          border-radius: 9999px;
          padding: 18px 48px;
          font-size: 17px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          cursor: pointer;
          box-shadow: 0 12px 32px -4px rgba(14, 165, 233, 0.5);
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          outline: none;
          display: flex;
          align-items: center;
          gap: 12px;
        ">
          <span>🥽 INICIAR EXPERIENCIA</span>
        </button>

        <!-- Indicador de compatibilidad Meta Quest -->
        <div style="margin-top: 32px; font-size: 12px; color: #64748B; display: flex; align-items: center; gap: 8px;">
          <span>Optimizado para Meta Quest 3S, Meta Quest 3 y Meta Quest Browser</span>
          <span>•</span>
          <span style="color: #D4AF37;">Powered by VXR Core</span>
        </div>
      </div>
    `;

    const startBtn = wrap.querySelector('#btn-start-experience') as HTMLButtonElement;
    startBtn.addEventListener('mouseenter', () => {
      startBtn.style.transform = 'scale(1.05)';
      startBtn.style.boxShadow = '0 16px 40px -4px rgba(14, 165, 233, 0.7)';
    });
    startBtn.addEventListener('mouseleave', () => {
      startBtn.style.transform = 'scale(1.0)';
      startBtn.style.boxShadow = '0 12px 32px -4px rgba(14, 165, 233, 0.5)';
    });
    startBtn.addEventListener('click', () => {
      this.hide();
      if (this.onStartCallback) {
        this.onStartCallback();
      }
    });

    return wrap;
  }

  public onStart(callback: () => void): void {
    this.onStartCallback = callback;
  }

  public show(): void {
    this.isVisible = true;
    this.container.style.opacity = '1';
    this.container.style.visibility = 'visible';
    this.container.style.pointerEvents = 'auto';
  }

  public hide(): void {
    this.isVisible = false;
    this.container.style.opacity = '0';
    this.container.style.pointerEvents = 'none';
    setTimeout(() => {
      if (!this.isVisible) {
        this.container.style.visibility = 'hidden';
      }
    }, 800);
  }

  public dispose(): void {
    if (this.container.parentElement) {
      this.container.parentElement.removeChild(this.container);
    }
  }
}
