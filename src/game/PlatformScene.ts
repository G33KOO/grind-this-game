import Phaser from 'phaser';
import { BALANCE, ENEMIES, ZONES } from './content';
import { bossSvg } from '../ui/bossSvg';
import {
  BOSS_BLOCK_RADIUS, BOSS_POSITIONS, SECRET_POSITIONS, WORLD_HEIGHT, WORLD_START, WORLD_WIDTH, clearance, generateDecor, isWalkable, noise, zoneScores,
  type Decor,
} from './world';

export type MapEvent = 'encounter' | 'secret-one' | 'secret-two' | `boss:${string}`;
export interface MapCallbacks {
  moved(x: number, y: number, distance: number): void;
  event(event: MapEvent): void;
  control(device: 'keyboard' | 'gamepad'): void;
  travel?(pendingDistance: number): void;
  isBossDefeated?(bossId: string): boolean;
  ready?(scene: PlatformScene): void;
}

const PLAYER_SPEED = 175;
interface BossEntry { id: string; body: Phaser.GameObjects.Zone; art?: Phaser.GameObjects.Image }
const SOLID_KINDS: Partial<Record<Decor['kind'], number>> = {
  tree: 0.4, rock: 0.45, pond: 0.48, pillar: 0.45, tombstone: 0.4, lava: 0.45, obsidian: 0.42, 'dead-tree': 0.3, log: 0.3,
};

const css =  (color: number): string => `#${color.toString(16).padStart(6, '0')}`;
const VOID = 0x04070c;
const NEON: Record<string, number> = { meadow: 0x2ee6c8, forest: 0x58ff6e, marsh: 0x35a7ff, crypt: 0xb36bff, ashen: 0xff6a2e };
const neonOf = (zoneId: string): number => NEON[zoneId] ?? 0x2ee6c8;
export const HERO_NEON: Record<string, number> = { warrior: 0x3db8ff, assassin: 0xff8a4d };

export class PlatformScene extends Phaser.Scene {
  private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private held = new Set<string>();
  private moveKeys = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' };
  private walls!: Phaser.Physics.Arcade.StaticGroup;
  private bosses: BossEntry[] = [];
  private trail!: Phaser.GameObjects.Graphics;
  private trailPoints: { x: number; y: number }[] = [];
  private callbacks: MapCallbacks;
  private lastReport = 0;
  private traveled = 0;
  private lastX = 0;
  private lastY = 0;
  private seenSecrets = new Set<string>();
  private lastDevice: 'keyboard' | 'gamepad' = 'keyboard';

  constructor(
    callbacks: MapCallbacks,
    private startPosition: { x: number; y: number },
    private readonly playerColor: number,
  ) {
    super('world');
    this.callbacks = callbacks;
  }

  private cameraZoom(height: number): number {
    return Math.max(1.25, Math.min(2.2, height / 480));
  }

  private paintGround(): void {
    const cell = 2;
    const columns = Math.ceil(WORLD_WIDTH / cell);
    const rows = Math.ceil(WORLD_HEIGHT / cell);
    const ground = this.textures.createCanvas('ground', columns, rows)!;
    const context = ground.getContext();
    if (this.textures.exists('wall-mask')) this.textures.remove('wall-mask');
    const wallTexture = this.textures.createCanvas('wall-mask', columns, rows)!;
    const wallContext = wallTexture.getContext();
    for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
      const x = column * cell + cell / 2;
      const y = row * cell + cell / 2;
      const [first, second] = zoneScores(x, y);
      const depth = clearance(x, y);
      const neon = neonOf(first.zone.id);
      // Mur : plein et mat, bord anticrénelé par alpha, halo qui s'éteint vers l'intérieur de la roche
      const coverage = Math.min(1, Math.max(0, 0.5 - depth / cell));
      if (coverage > 0) {
        const halo = Math.max(0, 1 - -depth / 26);
        wallContext.fillStyle = css(this.blend(0x010204, neon, halo * 0.12));
        wallContext.globalAlpha = coverage;
        wallContext.fillRect(column, row, 1, 1);
        wallContext.globalAlpha = 1;
      }
      if (depth <= 0) {
        context.fillStyle = css(this.blend(0x05080d, neon, 1));
        context.fillRect(column, row, 1, 1);
        continue;
      }
      let color = this.blend(0x05080d, neon, 0.05 + noise(x / 160, y / 160) * 0.07);
      const gap = Math.abs(second.score - first.score);
      if (gap < 7) color = this.blend(color, this.blend(neon, neonOf(second.zone.id), 0.5), (1 - gap / 7) * 0.85);
      else if (gap < 38) color = this.blend(color, neon, ((38 - gap) / 38) * 0.1);
      if (depth < 14) color = this.blend(color, neon, ((14 - depth) / 14) * 0.35);
      context.fillStyle = css(color);
      context.fillRect(column, row, 1, 1);
    }
    ground.refresh();
    wallTexture.refresh();
    this.add.image(0, 0, 'ground').setOrigin(0).setDisplaySize(columns * cell, rows * cell).setDepth(0);
    const tile = this.make.graphics({ x: 0, y: 0 }, false);
    tile.lineStyle(1, 0x7fe9ff, 1).lineBetween(0.5, 0, 0.5, 64).lineBetween(0, 0.5, 64, 0.5);
    tile.fillStyle(0xbff6ff, 1).fillRect(0, 0, 2, 2);
    tile.generateTexture('grid', 64, 64);
    tile.destroy();
    this.add.tileSprite(0, 0, WORLD_WIDTH, WORLD_HEIGHT, 'grid').setOrigin(0).setAlpha(0.09).setDepth(0.5);
    this.add.image(0, 0, 'wall-mask').setOrigin(0).setDisplaySize(columns * cell, rows * cell).setDepth(0.6);
  }

  private blend(from: number, to: number, ratio: number): number {
    const mix = (shift: number) => Math.round(((from >> shift) & 255) * (1 - ratio) + ((to >> shift) & 255) * ratio);
    return (mix(16) << 16) | (mix(8) << 8) | mix(0);
  }

  private drawDecor(graphics: Phaser.GameObjects.Graphics, decor: Decor): void {
    const { x, y, size: s, variant: v } = decor;
    const accent = NEON[decor.zone];
    const solid = !!SOLID_KINDS[decor.kind];
    const k = solid ? 1 : 0.14;
    const glow = (color: number, draw: () => void) => {
      const passes = solid ? [[5, 0.06], [2.4, 0.16], [1.1, 1]] : [[1, k]];
      for (const [width, alpha] of passes) { graphics.lineStyle(width, color, alpha); draw(); }
    };
    const poly = (points: { x: number; y: number }[], color: number, fill = 0.9) => {
      graphics.fillStyle(VOID, solid ? fill : 0.3).fillPoints(points, true);
      glow(color, () => graphics.strokePoints(points, true));
    };
    const ring = (count: number, rx: number, ry: number, offset = 0) => Array.from({ length: count }, (_, index) => {
      const angle = offset + (index / count) * Math.PI * 2;
      return { x: x + Math.cos(angle) * rx, y: y + Math.sin(angle) * ry };
    });
    const dot = (px: number, py: number, radius: number, color: number) => {
      if (solid) {
        graphics.fillStyle(color, 0.12).fillCircle(px, py, radius * 3.2);
        graphics.fillStyle(color, 0.3).fillCircle(px, py, radius * 1.8);
      }
      graphics.fillStyle(color, solid ? 1 : k * 1.4).fillCircle(px, py, solid ? radius : radius * 0.8);
    };
    switch (decor.kind) {
      case 'tree':
        glow(accent, () => graphics.lineBetween(x, y + s * 0.2, x, y + s * 0.45));
        graphics.fillStyle(VOID, 0.92).fillTriangle(x, y - s * 0.62, x + s * 0.42, y + s * 0.22, x - s * 0.42, y + s * 0.22);
        glow(accent, () => graphics.strokeTriangle(x, y - s * 0.62, x + s * 0.42, y + s * 0.22, x - s * 0.42, y + s * 0.22));
        glow(accent, () => graphics.strokeTriangle(x, y - s * 0.34, x + s * 0.22, y + s * 0.02, x - s * 0.22, y + s * 0.02));
        break;
      case 'dead-tree':
        glow(accent, () => {
          graphics.lineBetween(x, y + s * 0.3, x, y - s * 0.3).lineBetween(x, y - s * 0.05, x + s * 0.3, y - s * 0.35).lineBetween(x, y - s * 0.15, x - s * 0.28, y - s * 0.4);
        });
        break;
      case 'bush':
        dot(x, y, Math.max(1.2, s * 0.08), accent);
        break;
      case 'flower':
        dot(x, y, Math.max(1.3, s * 0.2), [0xff5fd0, 0x5ff0ff, 0xfff36b, 0xb36bff][Math.floor(v * 4)]);
        break;
      case 'rock':
        poly(ring(6, s * 0.46, s * 0.38, 0.3), 0x8fa3b8);
        break;
      case 'obsidian':
        poly([{ x, y: y - s * 0.5 }, { x: x + s * 0.34, y }, { x, y: y + s * 0.42 }, { x: x - s * 0.34, y }], 0x9b6bff);
        break;
      case 'pond':
        graphics.fillStyle(0x0a4a66, 0.55).fillEllipse(x, y, s * 1.1, s * 0.75);
        glow(0x35c8ff, () => graphics.strokeEllipse(x, y, s * 1.1, s * 0.75));
        graphics.lineStyle(1, 0x35c8ff, 0.5).strokeEllipse(x, y, s * 0.62, s * 0.4);
        break;
      case 'mushroom':
        glow(0xff4fd8, () => {
          graphics.lineBetween(x, y, x, y + s * 0.38);
          graphics.beginPath().arc(x, y, s * 0.4, Math.PI, 0).closePath().strokePath();
        });
        break;
      case 'log':
        graphics.fillStyle(VOID, 0.85).fillRoundedRect(x - s * 0.5, y - s * 0.14, s, s * 0.28, 4);
        glow(0xffa23a, () => { graphics.strokeRoundedRect(x - s * 0.5, y - s * 0.14, s, s * 0.28, 4); graphics.strokeCircle(x + s * 0.5, y, s * 0.1); });
        break;
      case 'reed':
        glow(0x58ffa8, () => { for (let blade = -1; blade <= 1; blade++) graphics.lineBetween(x + blade * 3, y + s * 0.4, x + blade * 5, y - s * 0.5); });
        dot(x, y - s * 0.52, 1.4, 0x58ffa8);
        break;
      case 'tombstone': {
        const w = s * 0.34;
        const top = y - s * 0.5 + w;
        const points = [{ x: x - w, y: y + s * 0.5 }, { x: x - w, y: top }];
        for (let step = 1; step < 8; step++) { const a = Math.PI + (step / 8) * Math.PI; points.push({ x: x + Math.cos(a) * w, y: top + Math.sin(a) * w }); }
        points.push({ x: x + w, y: top }, { x: x + w, y: y + s * 0.5 });
        poly(points, 0xb36bff);
        glow(0xb36bff, () => graphics.lineBetween(x, y - s * 0.22, x, y + s * 0.12).lineBetween(x - s * 0.12, y - s * 0.1, x + s * 0.12, y - s * 0.1));
        break;
      }
      case 'pillar':
        graphics.fillStyle(VOID, 0.9).fillRect(x - s * 0.28, y - s * 0.5, s * 0.56, s);
        glow(0x8f7bff, () => {
          graphics.strokeRect(x - s * 0.28, y - s * 0.5, s * 0.56, s);
          graphics.lineBetween(x - s * 0.4, y - s * 0.5, x + s * 0.4, y - s * 0.5).lineBetween(x - s * 0.4, y + s * 0.5, x + s * 0.4, y + s * 0.5);
        });
        break;
      case 'bones':
        glow(0xc9d6ff, () => { graphics.lineBetween(x - s * 0.4, y - s * 0.2, x + s * 0.4, y + s * 0.2).lineBetween(x - s * 0.4, y + s * 0.2, x + s * 0.4, y - s * 0.2); graphics.strokeCircle(x, y, s * 0.2); });
        break;
      case 'brazier':
        poly([{ x: x - s * 0.3, y }, { x: x + s * 0.3, y }, { x: x + s * 0.18, y: y + s * 0.4 }, { x: x - s * 0.18, y: y + s * 0.4 }], 0xff8a2e);
        graphics.fillStyle(0xff8a2e, 0.18 * k).fillCircle(x, y - s * 0.2, s * 0.6);
        glow(0xffb347, () => graphics.strokeTriangle(x - s * 0.2, y, x + s * 0.2, y, x, y - s * 0.5));
        break;
      case 'lava':
        graphics.fillStyle(0xff3a14, 0.3).fillEllipse(x, y, s * 1.15, s * 0.8);
        glow(0xff4a1c, () => graphics.strokeEllipse(x, y, s * 1.15, s * 0.8));
        graphics.lineStyle(1, 0xffb347, 0.7).strokeEllipse(x, y, s * 0.6, s * 0.4);
        break;
      case 'ember':
        dot(x, y, Math.max(1.2, s * 0.14), v > 0.5 ? 0xff6a2e : 0xffc46b);
        break;
    }
  }

  private contourLoops(step = 4): { x: number; y: number }[][] {
    const columns = Math.ceil(WORLD_WIDTH / step) + 1;
    const rows = Math.ceil(WORLD_HEIGHT / step) + 1;
    const values = new Float32Array(columns * rows);
    for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) values[row * columns + column] = clearance(column * step, row * step);
    const points = new Map<number, { x: number; y: number }>();
    const links = new Map<number, number[]>();
    // Un point de croisement est identifié par son arête : 2 * index du coin + (0 horizontale, 1 verticale)
    const crossing = (column: number, row: number, vertical: boolean): number | null => {
      const from = values[row * columns + column];
      const to = vertical ? values[(row + 1) * columns + column] : values[row * columns + column + 1];
      if ((from > 0) === (to > 0)) return null;
      const id = (row * columns + column) * 2 + (vertical ? 1 : 0);
      if (!points.has(id)) {
        const t = from / (from - to);
        points.set(id, vertical ? { x: column * step, y: (row + t) * step } : { x: (column + t) * step, y: row * step });
      }
      return id;
    };
    const link = (a: number, b: number) => {
      links.set(a, [...(links.get(a) ?? []), b]);
      links.set(b, [...(links.get(b) ?? []), a]);
    };
    for (let row = 0; row < rows - 1; row++) for (let column = 0; column < columns - 1; column++) {
      const top = crossing(column, row, false);
      const bottom = crossing(column, row + 1, false);
      const left = crossing(column, row, true);
      const right = crossing(column + 1, row, true);
      const hit = [top, right, bottom, left].filter((id): id is number => id !== null);
      if (hit.length === 2) link(hit[0], hit[1]);
      else if (hit.length === 4) { link(top!, left!); link(right!, bottom!); }
    }
    const visited = new Set<number>();
    const loops: { x: number; y: number }[][] = [];
    for (const start of links.keys()) {
      if (visited.has(start)) continue;
      const loop: { x: number; y: number }[] = [];
      let previous = -1;
      let current: number | undefined = start;
      while (current !== undefined && !visited.has(current)) {
        visited.add(current);
        loop.push(points.get(current)!);
        const next: number | undefined = links.get(current)!.find((candidate) => candidate !== previous && !visited.has(candidate));
        previous = current;
        current = next;
      }
      if (loop.length > 2) loops.push(loop);
    }
    return loops;
  }

  private drawContour(graphics: Phaser.GameObjects.Graphics): void {
    for (const loop of this.contourLoops()) {
      const zoneOf = (point: { x: number; y: number }) => zoneScores(point.x, point.y)[0].zone.id;
      let run = [loop[0]];
      let zone = zoneOf(loop[0]);
      const flush = (closing: { x: number; y: number }) => {
        const path = [...run, closing];
        for (const [width, alpha] of [[7, 0.06], [3.2, 0.18], [1.4, 1]]) graphics.lineStyle(width, neonOf(zone), alpha).strokePoints(path, false);
      };
      for (let index = 1; index <= loop.length; index++) {
        const point = loop[index % loop.length];
        const pointZone = zoneOf(point);
        if (pointZone !== zone || index === loop.length) {
          flush(point);
          run = [point];
          zone = pointZone;
        } else run.push(point);
      }
    }
  }

  private buildWorld(): void {
    this.paintGround();
    const decor = generateDecor();
    const graphics = this.make.graphics({ x: 0, y: 0 }, false);
    this.drawContour(graphics);
    decor.sort((a, b) => Number(!!SOLID_KINDS[a.kind]) - Number(!!SOLID_KINDS[b.kind]) || a.y - b.y);
    for (const entry of decor) this.drawDecor(graphics, entry);
    const layer = this.add.renderTexture(0, 0, WORLD_WIDTH * 2, WORLD_HEIGHT * 2).setOrigin(0).setScale(0.5).setDepth(1);
    graphics.setScale(2);
    layer.draw(graphics);
    graphics.destroy();
    this.walls = this.physics.add.staticGroup();
    for (const entry of decor) {
      const ratio = SOLID_KINDS[entry.kind];
      if (!ratio) continue;
      const radius = Math.max(5, entry.size * ratio);
      const blocker = this.add.zone(entry.x, entry.y + (entry.kind === 'tree' ? entry.size * 0.2 : 0), radius * 2, radius * 2);
      this.physics.add.existing(blocker, true);
      (blocker.body as Phaser.Physics.Arcade.StaticBody).setCircle(radius);
      this.walls.add(blocker);
    }
  }

  private loadBossArt(entry: BossEntry, position: { x: number; y: number }, color: number): void {
    const key = `boss-art-${entry.id}`;
    const image = new Image();
    image.onload = () => {
      if (!this.sys?.isActive()) return;
      if (!this.textures.exists(key)) this.textures.addImage(key, image);
      const offset = this.contentOffset(image);
      entry.art = this.add.image(position.x - offset.x * 0.4, position.y - offset.y * 0.4, key).setDisplaySize(128, 128).setDepth(2.1);
      entry.art.setVisible(!this.callbacks.isBossDefeated?.(entry.id));
      this.tweens.add({ targets: entry.art, y: entry.art.y - 4, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    };
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(bossSvg(entry.id, color))}`;
  }

  // Écart (en pixels de l'image source) entre le centre du dessin visible et le centre de l'image.
  private contentOffset(image: HTMLImageElement): { x: number; y: number } {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    if (!context) return { x: 0, y: 0 };
    context.drawImage(image, 0, 0, size, size);
    const data = context.getImageData(0, 0, size, size).data;
    let minX = size, minY = size, maxX = -1, maxY = -1;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      if (data[(y * size + x) * 4 + 3] > 40) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    }
    if (maxX < 0) return { x: 0, y: 0 };
    return { x: ((minX + maxX) / 2 - size / 2) * (320 / size), y: ((minY + maxY) / 2 - size / 2) * (320 / size) };
  }

  private drawTrail(): void {
    const last = this.trailPoints[this.trailPoints.length - 1];
    if (!last || Math.hypot(last.x - this.player.x, last.y - this.player.y) > 3) this.trailPoints.push({ x: this.player.x, y: this.player.y });
    if (this.trailPoints.length > 26 || (this.trailPoints.length > 0 && last && Math.hypot(last.x - this.player.x, last.y - this.player.y) <= 3)) this.trailPoints.shift();
    this.trail.clear();
    for (let index = 1; index < this.trailPoints.length; index++) {
      const ratio = index / this.trailPoints.length;
      const from = this.trailPoints[index - 1];
      const to = this.trailPoints[index];
      this.trail.lineStyle(7 * ratio, this.playerColor, 0.12 * ratio).lineBetween(from.x, from.y, to.x, to.y);
      this.trail.lineStyle(2 * ratio, this.playerColor, 0.9 * ratio).lineBetween(from.x, from.y, to.x, to.y);
    }
  }

  create(): void {
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.bosses = [];
    this.buildWorld();
    for (const zone of ZONES) {
      const position = BOSS_POSITIONS[zone.boss];
      const body = this.add.zone(position.x, position.y, BOSS_BLOCK_RADIUS * 2, BOSS_BLOCK_RADIUS * 2).setDepth(2);
      this.physics.add.existing(body, true);
      (body.body as Phaser.Physics.Arcade.StaticBody).setCircle(BOSS_BLOCK_RADIUS);
      const entry: BossEntry = { id: zone.boss, body };
      this.bosses.push(entry);
      this.loadBossArt(entry, position, ENEMIES.find((enemy) => enemy.id === zone.boss)?.color ?? 0xffffff);
    }
    const playerGraphic = this.make.graphics({ x: 0, y: 0 });
    const diamond = (half: number, tall: number): Phaser.Geom.Point[] => [
      new Phaser.Geom.Point(48, 48 - tall), new Phaser.Geom.Point(48 + half, 48), new Phaser.Geom.Point(48, 48 + tall), new Phaser.Geom.Point(48 - half, 48),
    ];
    for (const [half, tall, alpha] of [[36, 44, 0.05], [30, 38, 0.1], [25, 32, 0.18]]) playerGraphic.fillStyle(this.playerColor, alpha).fillPoints(diamond(half, tall), true);
    playerGraphic.fillStyle(VOID, 0.95).fillPoints(diamond(17, 24), true);
    playerGraphic.lineStyle(6, this.playerColor, 0.22).strokePoints(diamond(17, 24), true);
    playerGraphic.lineStyle(2, this.playerColor, 1).strokePoints(diamond(17, 24), true);
    playerGraphic.fillStyle(0xffffff, 1).fillPoints(diamond(5, 7), true);
    playerGraphic.generateTexture('player-dot', 96, 96);
    playerGraphic.destroy();
    this.trail = this.add.graphics().setDepth(4);
    const spawn = isWalkable(this.startPosition.x, this.startPosition.y, 12) ? this.startPosition : WORLD_START;
    this.startPosition = { ...spawn };
    this.player = this.physics.add.sprite(spawn.x, spawn.y, 'player-dot').setScale(0.5).setDepth(5);
    this.player.setCircle(18, 30, 30).setCollideWorldBounds(true).setBounce(0);
    this.physics.add.collider(this.player, this.walls);
    for (const boss of this.bosses) {
      this.physics.add.collider(
        this.player, boss.body,
        () => this.callbacks.event(`boss:${boss.id}`),
        () => !this.callbacks.isBossDefeated?.(boss.id),
      );
    }
    this.input.keyboard!.on('keydown', (event: KeyboardEvent) => this.held.add(event.code));
    this.input.keyboard!.on('keyup', (event: KeyboardEvent) => this.held.delete(event.code));
    this.game.events.on(Phaser.Core.Events.BLUR, () => this.held.clear());
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.setZoom(this.cameraZoom(this.scale.height));
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setBackgroundColor(0x06090d);
    this.scale.on('resize', (size: Phaser.Structs.Size) => this.cameras.main.setZoom(this.cameraZoom(size.height)));
    this.input.keyboard?.on('keydown', () => this.setDevice('keyboard'));
    this.lastX = this.startPosition.x;
    this.lastY = this.startPosition.y;
    this.events.on('resume-position', (x: number, y: number) => this.player.setPosition(x, y));
    this.callbacks.ready?.(this);
  }

  private setDevice(device: 'keyboard' | 'gamepad'): void {
    if (this.lastDevice === device) return;
    this.lastDevice = device;
    this.callbacks.control(device);
  }

  update(_time: number, delta: number): void {
    const controller = navigator.getGamepads?.().find((gamepad) => gamepad?.connected) ?? null;
    const down = (code: string, alt: string) => Number(this.held.has(code) || this.held.has(alt));
    let x = down(this.moveKeys.right, 'ArrowRight') - down(this.moveKeys.left, 'ArrowLeft');
    let y = down(this.moveKeys.down, 'ArrowDown') - down(this.moveKeys.up, 'ArrowUp');
    if (controller) {
      const axisX = controller.axes[0] ?? 0;
      const axisY = controller.axes[1] ?? 0;
      const deadZone = 0.2;
      const padX = Math.abs(axisX) > deadZone ? axisX : Number(!!controller.buttons[15]?.pressed) - Number(!!controller.buttons[14]?.pressed);
      const padY = Math.abs(axisY) > deadZone ? axisY : Number(!!controller.buttons[13]?.pressed) - Number(!!controller.buttons[12]?.pressed);
      if (Math.abs(padX) + Math.abs(padY) > 0.15) this.setDevice('gamepad');
      x = padX;
      y = padY;
    }
    const magnitude = Math.hypot(x, y);
    if (magnitude > 1) { x /= magnitude; y /= magnitude; }
    const dt = delta / 1000;
    const margin = 9;
    if (!isWalkable(this.player.x + x * PLAYER_SPEED * dt, this.player.y, margin)) x = 0;
    if (!isWalkable(this.player.x, this.player.y + y * PLAYER_SPEED * dt, margin)) y = 0;
    this.player.setVelocity(x * PLAYER_SPEED, y * PLAYER_SPEED);
    const actualDistance = Math.hypot(this.player.x - this.lastX, this.player.y - this.lastY);
    this.lastX = this.player.x;
    this.lastY = this.player.y;
    if (actualDistance > 0) {
      this.traveled += actualDistance;
      if (this.traveled >= BALANCE.encounterCheckDistance) {
        const actual = this.traveled;
        this.traveled = 0;
        this.callbacks.moved(this.player.x, this.player.y, actual);
      }
    }
    this.callbacks.travel?.(this.traveled);
    for (const boss of this.bosses) {
      const alive = !this.callbacks.isBossDefeated?.(boss.id);
      boss.art?.setVisible(alive);
    }
    this.drawTrail();
    if (_time - this.lastReport > 250) {
      this.lastReport = _time;
      this.callbacks.moved(this.player.x, this.player.y, 0);
    }
    if (!this.seenSecrets.has('one') && Phaser.Math.Distance.Between(this.player.x, this.player.y, SECRET_POSITIONS['secret-one'].x, SECRET_POSITIONS['secret-one'].y) < 26) {
      this.seenSecrets.add('one');
      this.callbacks.event('secret-one');
    }
    if (!this.seenSecrets.has('two') && Phaser.Math.Distance.Between(this.player.x, this.player.y, SECRET_POSITIONS['secret-two'].x, SECRET_POSITIONS['secret-two'].y) < 26) {
      this.seenSecrets.add('two');
      this.callbacks.event('secret-two');
    }
  }

  togglePause(paused: boolean): void {
    if (paused) {
      this.physics.world.pause();
      this.player.setVelocity(0, 0);
      this.held.clear();
    }
    else this.physics.world.resume();
  }

  setMoveKeys(keys: { up: string; down: string; left: string; right: string }): void {
    this.moveKeys = keys;
    this.held.clear();
  }

  teleport(x: number, y: number): void {
    this.player.setPosition(x, y);
    this.player.setVelocity(0, 0);
    this.lastX = x;
    this.lastY = y;
    this.traveled = 0;
    this.callbacks.moved(x, y, 0);
  }
}
