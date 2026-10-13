import Phaser from 'phaser';
import { BALANCE, ENEMIES, ZONES } from './content';
import { bossSvg } from '../ui/bossSvg';
import { drawDecorArt } from './decorArt';
import { moveWithSliding, obstacleField, PLAYER_RADIUS, type ClearanceField, type CircleObstacle } from './movement';
import { heroSvg } from '../ui/heroSvg';
import type { HeroId } from './types';
import {
  BOSS_BLOCK_RADIUS, BOSS_POSITIONS, SECRET_POSITIONS, WORLD_HEIGHT, WORLD_START, WORLD_WIDTH, PATHS, ZONE_ROUTES, clearance, generateDecor, isWalkable, noise, zoneScores,
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
  tree: 0.4, rock: 0.45, pond: 0.48, pillar: 0.45, tombstone: 0.4, lava: 0.45, obsidian: 0.42, 'dead-tree': 0.3, log: 0.3, house: 0.5, well: 0.4, cart: 0.4,
};

const css =  (color: number): string => `#${color.toString(16).padStart(6, '0')}`;
const NEON: Record<string, number> = { meadow: 0x2ee6c8, forest: 0x58ff6e, marsh: 0x35a7ff, crypt: 0xb36bff, ashen: 0xff6a2e };
const BIOME_GROUND: Record<string, number> = { meadow: 0x0a1510, forest: 0x06140c, marsh: 0x082330, crypt: 0x070812, ashen: 0x24100c };
const neonOf = (zoneId: string): number => NEON[zoneId] ?? 0x2ee6c8;
export const HERO_NEON: Record<string, number> = { warrior: 0x3db8ff, assassin: 0xff8a4d };

export class PlatformScene extends Phaser.Scene {
  private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private playerArt!: Phaser.GameObjects.Image;
  private playerShadow!: Phaser.GameObjects.Ellipse;
  private facing = 1;
  private facingBlend = 1;
  private walkPhase = 0;
  private reduceMotion = false;
  private held = new Set<string>();
  private moveKeys = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' };
  private collisionField!: ClearanceField;
  private detailLayers: { graphics: Phaser.GameObjects.Graphics; x: number; y: number }[] = [];
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
    private readonly hero: HeroId,
  ) {
    super('world');
    this.callbacks = callbacks;
  }

  preload(): void {
    this.load.svg('player-class', `data:image/svg+xml;base64,${btoa(heroSvg(this.hero, this.playerColor))}`, { width: 200, height: 200 });
  }

  setReduceMotion(reduced: boolean): void { this.reduceMotion = reduced; }

  private animatePlayer(x: number, y: number, distance: number, delta: number): void {
    const moving = distance > 0.05;
    if (Math.abs(x) > 0.1) this.facing = x < 0 ? -1 : 1;
    const smoothing = 1 - Math.exp(-Math.min(delta, 100) / 65);
    this.facingBlend = this.reduceMotion ? this.facing : Phaser.Math.Linear(this.facingBlend, this.facing, smoothing);
    if (moving) this.walkPhase += distance * 0.16;
    const stride = this.reduceMotion || !moving ? 0 : Math.sin(this.walkPhase);
    const baseScale = 56 / 200;
    this.playerArt.setPosition(this.player.x, this.player.y - Math.abs(stride) * 1.8);
    this.playerArt.setScale(baseScale * this.facingBlend, baseScale * (1 + Math.abs(stride) * 0.015));
    this.playerArt.rotation = Phaser.Math.Linear(this.playerArt.rotation, this.reduceMotion || !moving ? 0 : x * 0.045 + y * 0.018 + stride * 0.025, smoothing);
    this.playerShadow.setPosition(this.player.x, this.player.y + 2).setScale(1 - Math.abs(stride) * 0.05);
  }

  private cameraZoom(height: number): number {
    return Math.max(1.25, Math.min(2.2, height / 480));
  }

  private paintGround(): void {
    const cell = 4;
    const columns = Math.ceil(WORLD_WIDTH / cell);
    const rows = Math.ceil(WORLD_HEIGHT / cell);
    const ground = this.textures.createCanvas('ground', columns, rows)!;
    const context = ground.getContext();
    for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
      const x = column * cell + cell / 2;
      const y = row * cell + cell / 2;
      const [first, second] = zoneScores(x, y);
      const depth = clearance(x, y);
      const neon = neonOf(first.zone.id);
      const borderBlend = Math.max(0, (100 - Math.abs(second.score - first.score)) / 200);
      const outside = this.blend(BIOME_GROUND[first.zone.id], BIOME_GROUND[second.zone.id], borderBlend);
      // Only broad colour gradients are rasterized; the terrain edge is vector art.
      let color = this.blend(0x05080d, neon, 0.05 + noise(x / 160, y / 160) * 0.07);
      const gap = Math.abs(second.score - first.score);
      if (gap < 7) color = this.blend(color, this.blend(neon, neonOf(second.zone.id), 0.5), (1 - gap / 7) * 0.85);
      else if (gap < 38) color = this.blend(color, neon, ((38 - gap) / 38) * 0.1);
      if (depth > 0 && depth < 14) color = this.blend(color, neon, ((14 - depth) / 14) * 0.35);
      const outsideColor = this.blend(outside, neon, Math.max(0, 1-Math.abs(depth)/26)*.12);
      const insideWeight = Phaser.Math.SmoothStep(depth, -8, 8);
      color = this.blend(outsideColor, color, insideWeight);
      context.fillStyle = css(color);
      context.fillRect(column, row, 1, 1);
    }
    ground.refresh();
    ground.setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.add.image(0, 0, 'ground').setOrigin(0).setDisplaySize(columns * cell, rows * cell).setDepth(0);
    const tile = this.make.graphics({ x: 0, y: 0 }, false);
    tile.lineStyle(1, 0x7fe9ff, 1).lineBetween(0.5, 0, 0.5, 64).lineBetween(0, 0.5, 64, 0.5);
    tile.fillStyle(0xbff6ff, 1).fillRect(0, 0, 2, 2);
    tile.generateTexture('grid', 64, 64);
    tile.destroy();
    this.add.tileSprite(0, 0, WORLD_WIDTH, WORLD_HEIGHT, 'grid').setOrigin(0).setAlpha(0.025).setDepth(0.5);
  }

  private blend(from: number, to: number, ratio: number): number {
    const mix = (shift: number) => Math.round(((from >> shift) & 255) * (1 - ratio) + ((to >> shift) & 255) * ratio);
    return (mix(16) << 16) | (mix(8) << 8) | mix(0);
  }

  private drawDecor(graphics: Phaser.GameObjects.Graphics, decor: Decor): void {
    drawDecorArt(graphics, decor);
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
    const graphics = this.add.graphics().setDepth(1);
    // Sols construits : chemins de terre, chaussées et galeries donnent un sens au parcours.
    for(const zone of ZONES) graphics.lineStyle(zone.id==='crypt'||zone.id==='marsh'?42:32,neonOf(zone.id),.045).strokePoints(ZONE_ROUTES[zone.id],false);
    for (const path of PATHS) {
      const built = path.zone === 'crypt' || path.zone === 'marsh';
      const main=ZONE_ROUTES[path.zone].some((point,index)=>point===path.from&&ZONE_ROUTES[path.zone][index+1]===path.to);
      if(!main) graphics.lineStyle(built?42:32,neonOf(path.zone),.045).lineBetween(path.from.x,path.from.y,path.to.x,path.to.y);
      if(built) {
        const length=Phaser.Math.Distance.Between(path.from.x,path.from.y,path.to.x,path.to.y);
        const nx=-(path.to.y-path.from.y)/length,ny=(path.to.x-path.from.x)/length;
        for(let d=0;d<length;d+=path.zone==='marsh'?18:30) {
          const x=path.from.x+(path.to.x-path.from.x)*d/length,y=path.from.y+(path.to.y-path.from.y)*d/length;
          graphics.lineStyle(1,neonOf(path.zone),.12).lineBetween(x+nx*20,y+ny*20,x-nx*20,y-ny*20);
        }
      }
    }
    this.drawContour(graphics);
    decor.sort((a, b) => Number(!!SOLID_KINDS[a.kind]) - Number(!!SOLID_KINDS[b.kind]) || a.y - b.y);
    // Keep the outlines vector-based at every camera zoom. Cull off-screen chunks
    // rather than baking the entire world into an enlarged low-resolution bitmap.
    const chunks = new Map<string, Phaser.GameObjects.Graphics>();
    this.detailLayers = [];
    for (const entry of decor) {
      const x = Math.floor(entry.x/512)*512, y = Math.floor(entry.y/512)*512;
      const key = `${x},${y}`;
      let detail = chunks.get(key);
      if (!detail) {
        detail = this.add.graphics({ x, y }).setDepth(1.1);
        chunks.set(key, detail);
        this.detailLayers.push({ graphics: detail, x, y });
      }
      this.drawDecor(detail, { ...entry, x: entry.x-x, y: entry.y-y });
    }
    const obstacles: CircleObstacle[] = [];
    for (const entry of decor) {
      const ratio = SOLID_KINDS[entry.kind];
      if (!ratio) continue;
      const radius = Math.max(5, entry.size * ratio);
      obstacles.push({ x: entry.x, y: entry.y + (entry.kind === 'tree' ? entry.size * 0.2 : 0), radius });
    }
    this.collisionField = obstacleField(clearance, obstacles);
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
    if (this.trailPoints.length > 10 || (this.trailPoints.length > 0 && last && Math.hypot(last.x - this.player.x, last.y - this.player.y) <= 3)) this.trailPoints.shift();
    this.trail.clear();
    for (let index = 1; index < this.trailPoints.length; index++) {
      const ratio = index / this.trailPoints.length;
      const from = this.trailPoints[index - 1];
      const to = this.trailPoints[index];
      this.trail.lineStyle(3 * ratio, this.playerColor, 0.06 * ratio).lineBetween(from.x, from.y, to.x, to.y);
      this.trail.lineStyle(1 * ratio, this.playerColor, 0.2 * ratio).lineBetween(from.x, from.y, to.x, to.y);
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
    // Corps de collision indépendant de l'illustration animée.
    const playerGraphic = this.make.graphics({ x: 0, y: 0 });
    playerGraphic.generateTexture('player-body', 96, 96);
    playerGraphic.destroy();
    this.trail = this.add.graphics().setDepth(4);
    const spawn = isWalkable(this.startPosition.x, this.startPosition.y, 12) ? this.startPosition : WORLD_START;
    this.startPosition = { ...spawn };
    this.player = this.physics.add.sprite(spawn.x, spawn.y, 'player-body').setScale(0.5).setDepth(5);
    this.player.setCircle(18, 30, 30).setCollideWorldBounds(true).setBounce(0);
    this.playerShadow = this.add.ellipse(spawn.x, spawn.y + 2, 26, 10, 0x000000, 0.45).setDepth(4.5);
    this.playerArt = this.add.image(spawn.x, spawn.y, 'player-class').setOrigin(0.5, 0.93).setScale(56 / 200).setDepth(5);
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
    const view = this.cameras.main.worldView;
    for (const layer of this.detailLayers) layer.graphics.setVisible(
      layer.x-128 < view.right && layer.x+640 > view.left &&
      layer.y-128 < view.bottom && layer.y+640 > view.top,
    );
    if (this.physics.world.isPaused) { this.animatePlayer(0, 0, 0, delta); return; }
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
    const dt = Math.min(delta, 100) / 1000;
    const aliveBosses = this.bosses.filter(boss => !this.callbacks.isBossDefeated?.(boss.id));
    const field: ClearanceField = (px,py) => aliveBosses.reduce((distance,boss) => Math.min(distance,Math.hypot(px-boss.body.x,py-boss.body.y)-BOSS_BLOCK_RADIUS),this.collisionField(px,py));
    const position = moveWithSliding({x:this.player.x,y:this.player.y},{x:x*PLAYER_SPEED*dt,y:y*PLAYER_SPEED*dt},field);
    this.player.body.reset(position.x,position.y);
    for(const boss of aliveBosses) {
      const dx=position.x-boss.body.x,dy=position.y-boss.body.y;
      if(Math.hypot(dx,dy)<=BOSS_BLOCK_RADIUS+PLAYER_RADIUS+.2 && x*dx+y*dy<0) {
        this.callbacks.event(`boss:${boss.id}`);
        break;
      }
    }
    const actualDistance = Math.hypot(this.player.x - this.lastX, this.player.y - this.lastY);
    this.animatePlayer(x, y, actualDistance, delta);
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
    this.trailPoints = [];
    this.trail.clear();
    this.animatePlayer(0, 0, 0, 100);
    this.lastX = x;
    this.lastY = y;
    this.traveled = 0;
    this.callbacks.moved(x, y, 0);
  }
}
