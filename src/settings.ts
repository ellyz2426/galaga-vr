/**
 * Settings menu overlay — audio volume, CRT toggle, difficulty select
 * Accessible from title screen and pause menu
 */
import {
  Mesh,
  Group,
  PlaneGeometry,
  BoxGeometry,
  MeshBasicMaterial,
  CanvasTexture,
  Color,
  AdditiveBlending,
  DoubleSide,
} from "@iwsdk/core";

export interface GameSettings {
  masterVolume: number;     // 0-1
  musicVolume: number;      // 0-1
  sfxVolume: number;        // 0-1
  crtEnabled: boolean;
  difficulty: 'easy' | 'normal' | 'hard' | 'nightmare';
  screenShake: boolean;
  showFPS: boolean;
}

const DEFAULT_SETTINGS: GameSettings = {
  masterVolume: 0.7,
  musicVolume: 0.5,
  sfxVolume: 0.8,
  crtEnabled: true,
  difficulty: 'normal',
  screenShake: true,
  showFPS: false,
};

// Persist settings to localStorage
function loadSettings(): GameSettings {
  try {
    const stored = localStorage.getItem('galaga-vr-settings');
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch {}
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(settings: GameSettings) {
  try {
    localStorage.setItem('galaga-vr-settings', JSON.stringify(settings));
  } catch {}
}

export function getSettings(): GameSettings {
  return loadSettings();
}

export function getDifficultyMultipliers(difficulty: string): {
  enemyHealthMult: number;
  enemySpeedMult: number;
  scoreMultiplier: number;
  startLives: number;
  enemyDamageMult: number;
} {
  switch (difficulty) {
    case 'easy':
      return { enemyHealthMult: 0.7, enemySpeedMult: 0.8, scoreMultiplier: 0.5, startLives: 5, enemyDamageMult: 0.5 };
    case 'normal':
      return { enemyHealthMult: 1.0, enemySpeedMult: 1.0, scoreMultiplier: 1.0, startLives: 3, enemyDamageMult: 1.0 };
    case 'hard':
      return { enemyHealthMult: 1.5, enemySpeedMult: 1.2, scoreMultiplier: 1.5, startLives: 2, enemyDamageMult: 1.5 };
    case 'nightmare':
      return { enemyHealthMult: 2.0, enemySpeedMult: 1.4, scoreMultiplier: 2.0, startLives: 1, enemyDamageMult: 2.0 };
    default:
      return { enemyHealthMult: 1.0, enemySpeedMult: 1.0, scoreMultiplier: 1.0, startLives: 3, enemyDamageMult: 1.0 };
  }
}

interface SettingsMenuItem {
  key: keyof GameSettings;
  label: string;
  type: 'slider' | 'toggle' | 'select';
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
}

const MENU_ITEMS: SettingsMenuItem[] = [
  { key: 'masterVolume', label: 'MASTER VOLUME', type: 'slider', min: 0, max: 1, step: 0.1 },
  { key: 'musicVolume', label: 'MUSIC VOLUME', type: 'slider', min: 0, max: 1, step: 0.1 },
  { key: 'sfxVolume', label: 'SFX VOLUME', type: 'slider', min: 0, max: 1, step: 0.1 },
  { key: 'crtEnabled', label: 'CRT SCANLINES', type: 'toggle' },
  { key: 'screenShake', label: 'SCREEN SHAKE', type: 'toggle' },
  { key: 'difficulty', label: 'DIFFICULTY', type: 'select', options: ['easy', 'normal', 'hard', 'nightmare'] },
  { key: 'showFPS', label: 'SHOW FPS', type: 'toggle' },
];

export function createSettingsMenu(): {
  group: Group;
  show: () => void;
  hide: () => void;
  isVisible: () => boolean;
  update: (delta: number, time: number) => void;
  handleKey: (key: string) => boolean;
  handleXRNav: (nav: { up: boolean; down: boolean; left: boolean; right: boolean; select: boolean; back: boolean }) => boolean;
  getSettings: () => GameSettings;
  onSettingsChanged: ((settings: GameSettings) => void) | null;
} {
  const group = new Group();
  group.position.set(0, 1.8, -2.5);
  group.visible = false;

  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 600;
  const ctx = canvas.getContext('2d')!;
  const texture = new CanvasTexture(canvas);

  const geo = new PlaneGeometry(2.8, 2.1);
  const mat = new MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: DoubleSide,
    depthWrite: false,
  });
  const mesh = new Mesh(geo, mat);
  group.add(mesh);

  // Border
  const borderMat = new MeshBasicMaterial({
    color: new Color(0x00ccff),
    transparent: true,
    opacity: 0.5,
    blending: AdditiveBlending,
  });
  [
    { w: 2.9, h: 0.006, x: 0, y: 1.06 },
    { w: 2.9, h: 0.006, x: 0, y: -1.06 },
    { w: 0.006, h: 2.12, x: -1.45, y: 0 },
    { w: 0.006, h: 2.12, x: 1.45, y: 0 },
  ].forEach(({ w, h, x, y }) => {
    const b = new Mesh(new BoxGeometry(w, h, 0.004), borderMat);
    b.position.set(x, y, -0.01);
    group.add(b);
  });

  let settings = loadSettings();
  let selectedIndex = 0;
  let onChanged: ((s: GameSettings) => void) | null = null;

  function render(time: number) {
    ctx.clearRect(0, 0, 800, 600);
    ctx.fillStyle = 'rgba(0, 5, 16, 0.97)';
    ctx.fillRect(0, 0, 800, 600);

    // Title
    ctx.fillStyle = '#00ccff';
    ctx.font = 'bold 36px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#00ccff';
    ctx.shadowBlur = 12;
    ctx.fillText('SETTINGS', 400, 40);
    ctx.shadowBlur = 0;

    // Separator
    ctx.strokeStyle = '#003366';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(50, 65);
    ctx.lineTo(750, 65);
    ctx.stroke();

    // Menu items
    MENU_ITEMS.forEach((item, i) => {
      const y = 110 + i * 65;
      const selected = i === selectedIndex;

      if (selected) {
        ctx.fillStyle = 'rgba(0, 100, 200, 0.1)';
        ctx.fillRect(30, y - 20, 740, 50);
        ctx.strokeStyle = '#00ccff';
        ctx.lineWidth = 1;
        ctx.strokeRect(30, y - 20, 740, 50);
      }

      // Label
      ctx.fillStyle = selected ? '#ffffff' : '#888899';
      ctx.font = 'bold 20px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(item.label, 50, y + 5);

      // Value
      const value = settings[item.key];
      ctx.textAlign = 'right';

      if (item.type === 'slider') {
        const numValue = value as number;
        const barWidth = 200;
        const barX = 530;
        const barY = y - 2;

        // Background bar
        ctx.fillStyle = '#222233';
        ctx.fillRect(barX, barY, barWidth, 12);

        // Fill bar
        ctx.fillStyle = selected ? '#00ccff' : '#006688';
        ctx.fillRect(barX, barY, barWidth * numValue, 12);

        // Border
        ctx.strokeStyle = '#444466';
        ctx.strokeRect(barX, barY, barWidth, 12);

        // Percentage text
        ctx.fillStyle = selected ? '#ffffff' : '#888899';
        ctx.font = '18px monospace';
        ctx.fillText(`${Math.round(numValue * 100)}%`, 760, y + 5);
      } else if (item.type === 'toggle') {
        const boolValue = value as boolean;
        ctx.fillStyle = boolValue ? '#00ff66' : '#ff4444';
        ctx.font = 'bold 20px monospace';
        ctx.fillText(boolValue ? 'ON' : 'OFF', 750, y + 5);
      } else if (item.type === 'select') {
        const strValue = value as string;
        const colorMap: Record<string, string> = {
          easy: '#00ff66', normal: '#ffcc00', hard: '#ff6600', nightmare: '#ff0044'
        };
        ctx.fillStyle = colorMap[strValue] || '#ffffff';
        ctx.font = 'bold 20px monospace';
        ctx.fillText(strValue.toUpperCase(), 750, y + 5);
      }
    });

    // Navigation help
    ctx.fillStyle = '#555566';
    ctx.font = '16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('↑↓ Navigate  |  ←→ Adjust  |  ESC/B Close', 400, 570);

    texture.needsUpdate = true;
  }

  function show() {
    settings = loadSettings();
    group.visible = true;
    selectedIndex = 0;
    render(0);
  }

  function hide() {
    group.visible = false;
    saveSettings(settings);
    if (onChanged) onChanged(settings);
  }

  function handleKey(key: string): boolean {
    if (!group.visible) return false;

    const item = MENU_ITEMS[selectedIndex];

    switch (key) {
      case 'ArrowUp':
      case 'KeyW':
        selectedIndex = Math.max(0, selectedIndex - 1);
        return true;
      case 'ArrowDown':
      case 'KeyS':
        selectedIndex = Math.min(MENU_ITEMS.length - 1, selectedIndex + 1);
        return true;
      case 'ArrowLeft':
      case 'KeyA':
        adjustValue(item, -1);
        return true;
      case 'ArrowRight':
      case 'KeyD':
        adjustValue(item, 1);
        return true;
      case 'Enter':
      case 'Space':
        if (item.type === 'toggle') {
          adjustValue(item, 1);
        }
        return true;
      case 'Escape':
        hide();
        return true;
    }
    return false;
  }

  function adjustValue(item: SettingsMenuItem, direction: number) {
    if (item.type === 'slider') {
      const step = item.step ?? 0.1;
      let val = (settings[item.key] as number) + direction * step;
      val = Math.max(item.min ?? 0, Math.min(item.max ?? 1, val));
      val = Math.round(val * 10) / 10;
      (settings as any)[item.key] = val;
    } else if (item.type === 'toggle') {
      (settings as any)[item.key] = !(settings[item.key] as boolean);
    } else if (item.type === 'select' && item.options) {
      const options = item.options;
      const currentIdx = options.indexOf(settings[item.key] as string);
      const newIdx = (currentIdx + direction + options.length) % options.length;
      (settings as any)[item.key] = options[newIdx];
    }

    saveSettings(settings);
    if (onChanged) onChanged(settings);
  }

  function update(delta: number, time: number) {
    if (!group.visible) return;
    render(time);
  }

  function handleXRNav(nav: { up: boolean; down: boolean; left: boolean; right: boolean; select: boolean; back: boolean }): boolean {
    if (!group.visible) return false;

    const item = MENU_ITEMS[selectedIndex];

    if (nav.back) {
      hide();
      return true;
    }
    if (nav.up) {
      selectedIndex = Math.max(0, selectedIndex - 1);
      return true;
    }
    if (nav.down) {
      selectedIndex = Math.min(MENU_ITEMS.length - 1, selectedIndex + 1);
      return true;
    }
    if (nav.left) {
      adjustValue(item, -1);
      return true;
    }
    if (nav.right) {
      adjustValue(item, 1);
      return true;
    }
    if (nav.select) {
      if (item.type === 'toggle') {
        adjustValue(item, 1);
      } else if (item.type === 'select') {
        adjustValue(item, 1);
      }
      return true;
    }
    return false;
  }

  return {
    group,
    show,
    hide,
    isVisible: () => group.visible,
    update,
    handleKey,
    handleXRNav,
    getSettings: () => ({ ...settings }),
    onSettingsChanged: null,
  };
}
