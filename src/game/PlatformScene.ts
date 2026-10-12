import Phaser from 'phaser';
import { BALANCE } from './content';
import {
  BOSS_POSITION, SECRET_POSITIONS, SHRINE_POSITION, WORLD_HEIGHT, WORLD_WIDTH, generateDecor, noise, zoneAt, zoneScores,
  type Decor,
} from './world';

export type MapEvent = 'encounter' | 'boss' | 'shrine' | 'secret-one' | 'secret-two' | 'locked-zone';
export interface MapCallbacks {
  moved(x: number, y: number, distance: number): void;
  event(event: MapEvent): void;
  control(device: 'keyboard' | 'gamepad'): void;
  canEnterZone(zoneId: string): boolean;
  explored?(data: string): void;
  ready?(scene: PlatformScene): void;
}

const PLAYER_SPEED = 175;
const FOG_CELL = 40;
const FOG_COLUMNS = Math.ceil(WORLD_WIDTH / FOG_CELL);
const FOG_ROWS = Math.ceil(WORLD_HEIGHT / FOG_CELL);
const REVEAL_RADIUS = 6.5;
const SOLID_KINDS: Partial<Record<Decor['kind'], number>> = {
  tree: 0.4, rock: 0.45, pond: 0.48, pillar: 0.45, tombstone: 0.4, lava: 0.45, obsidian: 0.42, 'dead-tree': 0.3, log: 0.3,
};

const tint = (color: number, amount: number): number => {
  const channel = (shift: number) => Phaser.Math.Clamp(Math.round(((color >> shift) & 255) * amount), 0, 255);
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
};
const css = (color: number): string => `#${color.toString(16).padStart(6, '0')}`;

export class PlatformScene extends Phaser.Scene {
  private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private walls!: Phaser.Physics.Arcade.StaticGroup;
  private boss!: Phaser.GameObjects.Arc;
  private callbacks: MapCallbacks;
  private lastReport = 0;
  private traveled = 0;
  private lastX = 0;
  private lastY = 0;
  private shrineReady = true;
  private seenSecrets = new Set<string>();
  private zoneLockNotified = false;
  private lastDevice: 'keyboard' | 'gamepad' = 'keyboard';
  private explored = new Uint8Array(FOG_COLUMNS * FOG_ROWS);
  private fog!: Phaser.Textures.CanvasTexture;
  private fogDirty = true;
  private lastFogCell = -1;
  private lastExploredSave = 0;

  constructor(
    callbacks: MapCallbacks,
    private readonly startPosition: { x: number; y: number },
    private readonly playerColor: number,
    exploredData?: string,
  ) {
    super('world');
    this.callbacks = callbacks;
    if (exploredData?.length === this.explored.length) {
      for (let index = 0; index < exploredData.length; index++) this.explored[index] = exploredData[index] === '1' ? 1 : 0;
    }
  }

  private cameraZoom(height: number): number {
    return Math.max(1.25, Math.min(2.2, height / 480));
  }

  private paintGround(): void {
    const cell = 12;
    const columns = Math.ceil(WORLD_WIDTH / cell);
    const rows = Math.ceil(WORLD_HEIGHT / cell);
    const ground = this.textures.createCanvas('ground', columns, rows)!;
    const context = ground.getContext();
    for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
      const x = column * cell + cell / 2;
      const y = row * cell + cell / 2;
      const [first, second] = zoneScores(x, y);
      let color = tint(first.zone.color, 0.82 + noise(x / 90, y / 90) * 0.32 + (noise(x / 25, y / 25) - 0.5) * 0.1);
      const edge = (second.score - first.score) / 55;
      if (edge < 1) color = this.blend(color, 0x0b100f, (1 - edge) * 0.38);
      context.fillStyle = css(color);
      context.fillRect(column, row, 1, 1);
    }
    ground.refresh();
    this.add.image(0, 0, 'ground').setOrigin(0).setDisplaySize(columns * cell, rows * cell).setDepth(0);
  }

  private blend(from: number, to: number, ratio: number): number {
    const mix = (shift: number) => Math.round(((from >> shift) & 255) * (1 - ratio) + ((to >> shift) & 255) * ratio);
    return (mix(16) << 16) | (mix(8) << 8) | mix(0);
  }

  private drawDecor(graphics: Phaser.GameObjects.Graphics, decor: Decor): void {
    const { x, y, size: s, variant: v } = decor;
    const shade = (color: number) => tint(color, 0.85 + v * 0.3);
    switch (decor.kind) {
      case 'tree':
        graphics.fillStyle(0x000000, 0.28).fillEllipse(x + s * 0.2, y + s * 0.35, s * 1.05, s * 0.55);
        graphics.fillStyle(0x4a3524).fillRect(x - s * 0.07, y, s * 0.14, s * 0.35);
        graphics.fillStyle(shade(0x1f5a32)).fillCircle(x, y - s * 0.15, s * 0.5);
        graphics.fillStyle(shade(0x2f7a40)).fillCircle(x - s * 0.12, y - s * 0.28, s * 0.32);
        break;
      case 'dead-tree':
        graphics.lineStyle(Math.max(2, s * 0.1), 0x3a2f2a);
        graphics.lineBetween(x, y + s * 0.3, x, y - s * 0.3).lineBetween(x, y - s * 0.05, x + s * 0.3, y - s * 0.35).lineBetween(x, y - s * 0.15, x - s * 0.28, y - s * 0.4);
        break;
      case 'bush':
        graphics.fillStyle(shade(0x2d6b3a)).fillCircle(x, y, s * 0.5).fillCircle(x + s * 0.4, y + s * 0.1, s * 0.38).fillCircle(x - s * 0.38, y + s * 0.1, s * 0.34);
        break;
      case 'flower':
        graphics.fillStyle([0xf2d16b, 0xe58fb4, 0xf4f0e0, 0x9bb7f0][Math.floor(v * 4)]).fillCircle(x, y, s * 0.5);
        break;
      case 'rock': case 'obsidian':
        graphics.fillStyle(0x000000, 0.25).fillEllipse(x + 2, y + s * 0.3, s * 0.95, s * 0.4);
        graphics.fillStyle(decor.kind === 'rock' ? shade(0x7c8179) : shade(0x23202c)).fillEllipse(x, y, s * 0.9, s * 0.7);
        graphics.fillStyle(0xffffff, decor.kind === 'rock' ? 0.14 : 0.2).fillEllipse(x - s * 0.15, y - s * 0.15, s * 0.35, s * 0.2);
        break;
      case 'pond':
        graphics.fillStyle(0x1d4a55).fillEllipse(x, y, s * 1.1, s * 0.75);
        graphics.fillStyle(0x3b8ca0).fillEllipse(x, y, s * 0.96, s * 0.62);
        graphics.fillStyle(0xffffff, 0.2).fillEllipse(x - s * 0.2, y - s * 0.1, s * 0.3, s * 0.1);
        break;
      case 'mushroom':
        graphics.fillStyle(0xe8dccb).fillRect(x - s * 0.1, y, s * 0.2, s * 0.4);
        graphics.fillStyle(0xc4483f).fillEllipse(x, y, s * 0.9, s * 0.6);
        break;
      case 'log':
        graphics.fillStyle(0x5a3f2a).fillRoundedRect(x - s * 0.5, y - s * 0.14, s, s * 0.28, 4);
        graphics.fillStyle(0xb48a5c).fillCircle(x + s * 0.5, y, s * 0.13);
        break;
      case 'reed':
        graphics.lineStyle(2, 0x6f8f4d);
        for (let blade = -1; blade <= 1; blade++) graphics.lineBetween(x + blade * 3, y + s * 0.4, x + blade * 5, y - s * 0.5);
        graphics.fillStyle(0x6a4a2f).fillRect(x - 1, y - s * 0.55, 3, 5);
        break;
      case 'tombstone':
        graphics.fillStyle(0x000000, 0.25).fillEllipse(x + 2, y + s * 0.45, s, s * 0.3);
        graphics.fillStyle(shade(0x8d90a8)).fillRoundedRect(x - s * 0.35, y - s * 0.5, s * 0.7, s, { tl: s * 0.35, tr: s * 0.35, bl: 2, br: 2 });
        graphics.fillStyle(0x4a4d63).fillRect(x - 1, y - s * 0.3, 2, s * 0.4).fillRect(x - s * 0.15, y - s * 0.18, s * 0.3, 2);
        break;
      case 'pillar':
        graphics.fillStyle(0x000000, 0.25).fillEllipse(x + 3, y + s * 0.5, s, s * 0.3);
        graphics.fillStyle(shade(0x9fa1b8)).fillRect(x - s * 0.3, y - s * 0.5, s * 0.6, s);
        graphics.fillStyle(0x6b6e86).fillRect(x - s * 0.38, y - s * 0.55, s * 0.76, s * 0.14).fillRect(x - s * 0.38, y + s * 0.42, s * 0.76, s * 0.14);
        break;
      case 'bones':
        graphics.lineStyle(2, 0xd9d4c2).lineBetween(x - s * 0.4, y - s * 0.2, x + s * 0.4, y + s * 0.2).lineBetween(x - s * 0.4, y + s * 0.2, x + s * 0.4, y - s * 0.2);
        graphics.fillStyle(0xd9d4c2).fillCircle(x, y, s * 0.22);
        break;
      case 'brazier':
        graphics.fillStyle(0x3d3a45).fillRect(x - s * 0.3, y, s * 0.6, s * 0.5);
        graphics.fillStyle(0xf08a2f).fillCircle(x, y - s * 0.1, s * 0.4);
        graphics.fillStyle(0xffd36b).fillCircle(x, y - s * 0.15, s * 0.2);
        break;
      case 'lava':
        graphics.fillStyle(0x2a1210).fillEllipse(x, y, s * 1.15, s * 0.8);
        graphics.fillStyle(0xe2561f).fillEllipse(x, y, s * 0.95, s * 0.62);
        graphics.fillStyle(0xffb347).fillEllipse(x - s * 0.1, y - s * 0.05, s * 0.5, s * 0.25);
        break;
      case 'ember':
        graphics.fillStyle(v > 0.5 ? 0xf0833a : 0xffcf70, 0.9).fillCircle(x, y, s * 0.5);
        break;
    }
  }

  private buildWorld(): void {
    this.paintGround();
    const decor = generateDecor();
    const graphics = this.make.graphics({ x: 0, y: 0 }, false);
    decor.sort((a, b) => a.y - b.y);
    for (const entry of decor) this.drawDecor(graphics, entry);
    const layer = this.add.renderTexture(0, 0, WORLD_WIDTH, WORLD_HEIGHT).setOrigin(0).setDepth(1);
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

  private buildFog(): void {
    this.fog = this.textures.createCanvas('fog', FOG_COLUMNS, FOG_ROWS)!;
    this.add.image(0, 0, 'fog').setOrigin(0).setDisplaySize(FOG_COLUMNS * FOG_CELL, FOG_ROWS * FOG_CELL).setDepth(20);
  }

  private revealAround(x: number, y: number): void {
    const column = Math.floor(x / FOG_CELL);
    const row = Math.floor(y / FOG_CELL);
    const key = row * FOG_COLUMNS + column;
    if (key === this.lastFogCell) return;
    this.lastFogCell = key;
    const reach = Math.ceil(REVEAL_RADIUS);
    for (let dy = -reach; dy <= reach; dy++) for (let dx = -reach; dx <= reach; dx++) {
      const cx = column + dx;
      const cy = row + dy;
      if (cx < 0 || cy < 0 || cx >= FOG_COLUMNS || cy >= FOG_ROWS || dx * dx + dy * dy > REVEAL_RADIUS * REVEAL_RADIUS) continue;
      const index = cy * FOG_COLUMNS + cx;
      if (!this.explored[index]) { this.explored[index] = 1; this.fogDirty = true; }
    }
  }

  private paintFog(): void {
    const context = this.fog.getContext();
    const image = context.createImageData(FOG_COLUMNS, FOG_ROWS);
    for (let index = 0; index < this.explored.length; index++) {
      const offset = index * 4;
      image.data[offset] = 6;
      image.data[offset + 1] = 9;
      image.data[offset + 2] = 13;
      image.data[offset + 3] = this.explored[index] ? 0 : 255;
    }
    context.putImageData(image, 0, 0);
    this.fog.refresh();
    this.fogDirty = false;
  }

  private saveExplored(): void {
    this.callbacks.explored?.(Array.from(this.explored, (value) => (value ? '1' : '0')).join(''));
  }

  create(): void {
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.buildWorld();
    this.add.circle(SHRINE_POSITION.x, SHRINE_POSITION.y, 17, 0x77d3a8).setStrokeStyle(3, 0xf0f1df).setDepth(2);
    this.add.circle(SHRINE_POSITION.x, SHRINE_POSITION.y, 30, 0x77d3a8, 0.18).setDepth(2);
    for (const position of Object.values(SECRET_POSITIONS)) {
      this.add.circle(position.x, position.y, 10, 0xd8ce92).setStrokeStyle(2, 0xfff5bd).setDepth(2);
    }
    this.boss = this.add.circle(BOSS_POSITION.x, BOSS_POSITION.y, 28, 0xd14f55).setStrokeStyle(4, 0xffd479).setDepth(2);
    this.add.circle(BOSS_POSITION.x, BOSS_POSITION.y, 60, 0xd14f55, 0.15).setDepth(2);
    const playerGraphic = this.make.graphics({ x: 0, y: 0 });
    playerGraphic.fillStyle(this.playerColor);
    playerGraphic.fillCircle(16, 16, 13);
    playerGraphic.lineStyle(3, 0xf0f1df);
    playerGraphic.strokeCircle(16, 16, 13);
    playerGraphic.generateTexture('player-dot', 32, 32);
    playerGraphic.destroy();
    this.player = this.physics.add.sprite(this.startPosition.x, this.startPosition.y, 'player-dot').setDepth(5);
    this.player.setCircle(13).setCollideWorldBounds(true).setBounce(0);
    this.physics.add.collider(this.player, this.walls);
    this.physics.add.overlap(this.player, this.boss, () => this.callbacks.event('boss'));
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,Z,Q,UP,DOWN,LEFT,RIGHT,SPACE') as Record<string, Phaser.Input.Keyboard.Key>;
    this.buildFog();
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.setZoom(this.cameraZoom(this.scale.height));
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setBackgroundColor(0x06090d);
    this.scale.on('resize', (size: Phaser.Structs.Size) => this.cameras.main.setZoom(this.cameraZoom(size.height)));
    this.input.keyboard?.on('keydown', () => this.setDevice('keyboard'));
    this.lastX = this.startPosition.x;
    this.lastY = this.startPosition.y;
    this.revealAround(this.lastX, this.lastY);
    this.paintFog();
    this.events.on('resume-position', (x: number, y: number) => this.player.setPosition(x, y));
    this.events.once('shutdown', () => this.saveExplored());
    this.callbacks.ready?.(this);
  }

  private setDevice(device: 'keyboard' | 'gamepad'): void {
    if (this.lastDevice === device) return;
    this.lastDevice = device;
    this.callbacks.control(device);
  }

  update(_time: number): void {
    const controller = navigator.getGamepads?.().find((gamepad) => gamepad?.connected) ?? null;
    let x = Number(this.keys.D.isDown) - Number(this.keys.A.isDown || this.keys.Q.isDown);
    let y = Number(this.keys.S.isDown) - Number(this.keys.W.isDown || this.keys.Z.isDown);
    x += Number(this.keys.RIGHT.isDown) - Number(this.keys.LEFT.isDown);
    y += Number(this.keys.DOWN.isDown) - Number(this.keys.UP.isDown);
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
    this.player.setVelocity(x * PLAYER_SPEED, y * PLAYER_SPEED);
    const playerZone = zoneAt(this.player.x, this.player.y);
    if (!this.callbacks.canEnterZone(playerZone.id)) {
      this.player.setPosition(this.lastX, this.lastY);
      this.player.setVelocity(0, 0);
      if (!this.zoneLockNotified) this.callbacks.event('locked-zone');
      this.zoneLockNotified = true;
      return;
    }
    this.zoneLockNotified = false;
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
    if (_time - this.lastReport > 250) {
      this.lastReport = _time;
      this.callbacks.moved(this.player.x, this.player.y, 0);
    }
    if (this.shrineReady && Phaser.Math.Distance.Between(this.player.x, this.player.y, SHRINE_POSITION.x, SHRINE_POSITION.y) < 34) {
      this.shrineReady = false;
      this.callbacks.event('shrine');
    }
    if (!this.seenSecrets.has('one') && Phaser.Math.Distance.Between(this.player.x, this.player.y, SECRET_POSITIONS['secret-one'].x, SECRET_POSITIONS['secret-one'].y) < 26) {
      this.seenSecrets.add('one');
      this.callbacks.event('secret-one');
    }
    if (!this.seenSecrets.has('two') && Phaser.Math.Distance.Between(this.player.x, this.player.y, SECRET_POSITIONS['secret-two'].x, SECRET_POSITIONS['secret-two'].y) < 26) {
      this.seenSecrets.add('two');
      this.callbacks.event('secret-two');
    }
    this.revealAround(this.player.x, this.player.y);
    if (this.fogDirty) this.paintFog();
    if (_time - this.lastExploredSave > 3000) {
      this.lastExploredSave = _time;
      this.saveExplored();
    }
  }

  togglePause(paused: boolean): void {
    if (paused) {
      this.physics.world.pause();
      this.player.setVelocity(0, 0);
      for (const key of Object.values(this.keys)) key.reset();
    }
    else this.physics.world.resume();
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
