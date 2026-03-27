// src/lib/stores/ui.svelte.ts

class UIStore {
    // Hue (0-360) da cor predominante do pôster do filme que está em hover
    // Se for null, o background volta para a cor padrão (ex: Dourado/Azul)
    activeHue = $state<number | null>(null);

    // Multiplicador de velocidade das partículas (1 = normal, 3 = "Warp Speed" ao clicar)
    intensity = $state<number>(1);

    // Registra o último clique global para criar uma onda de choque épica no Canvas
    lastClick = $state<{ x: number, y: number, time: number } | null>(null);

    // When true, background switches to the geometric detail-page pattern
    detailMode = $state(false);

    // Métodos utilitários
    triggerClickPulse(x: number, y: number) {
        this.lastClick = { x, y, time: Date.now() };
        
        // Aumenta a intensidade da animação temporariamente
        this.intensity = 3;
        setTimeout(() => {
            this.intensity = 1;
        }, 800);
    }

    setHoverHue(hue: number | null) {
        this.activeHue = hue;
    }
}

export const ui = new UIStore();