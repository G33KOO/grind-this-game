import Phaser from 'phaser';
import { BALANCE, FINAL_BOSS_POSITION, ZONES } from './content';

export type MapEvent = 'encounter' | 'boss' | 'shrine' | 'secret-one' | 'secret-two' | 'locked-zone';
export interface MapCallbacks {
  moved(x: number, y: number, distance: number): void;
  event(event: MapEvent): void;
  control(device: 'keyboard' | 'gamepad'): void;
  canEnterZone(zoneId: string): boolean;
}

const WORLD_WIDTH = 1040;
const WORLD_HEIGHT = 720;
const PLAYER_SPEED = 175;

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

  constructor(callbacks: MapCallbacks, private readonly startPosition: { x: number; y: number }, private readonly playerColor: number) {
    super('world');
    this.callbacks = callbacks;
  }

  create(): void {
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    for (const zone of ZONES) {
      const bounds = zone.bounds;
      this.add.rectangle(bounds.x + bounds.w / 2, bounds.y + bounds.h / 2, bounds.w, bounds.h, zone.color)
        .setStrokeStyle(2, 0x789079, 0.45);
      this.add.text(bounds.x + 18, bounds.y + 14, `${zone.level} • ${zone.name}`, {
        fontFamily: 'monospace', fontSize: '17px', color: '#e8e5d7', backgroundColor: '#10182099', padding: { x: 7, y: 4 },
      });
    }
    this.walls = this.physics.add.staticGroup();
    const obstacles = [[260, 130, 70, 42], [360, 265, 90, 35], [665, 120, 80, 70], [795, 335, 115, 38], [250, 495, 120, 45], [590, 555, 75, 75]];
    for (const [x, y, width, height] of obstacles) {
      const object = this.add.rectangle(x, y, width, height, 0x222d31).setStrokeStyle(2, 0x8e9b88);
      this.physics.add.existing(object, true);
      this.walls.add(object);
    }
    this.add.circle(470, 185, 17, 0x77d3a8).setStrokeStyle(3, 0xf0f1df);
    this.add.text(440, 207, 'Sanctuaire', { fontSize: '12px', color: '#fff' });
    this.add.circle(150, 550, 10, 0xd8ce92).setStrokeStyle(2, 0xfff5bd);
    this.add.text(112, 566, 'Secret I', { fontSize: '12px', color: '#fff' });
    this.add.circle(675, 463, 10, 0xd8ce92).setStrokeStyle(2, 0xfff5bd);
    this.add.text(642, 480, 'Secret II', { fontSize: '12px', color: '#fff' });
    this.boss = this.add.circle(FINAL_BOSS_POSITION.x, FINAL_BOSS_POSITION.y, 28, 0xd14f55).setStrokeStyle(4, 0xffd479);
    this.add.text(FINAL_BOSS_POSITION.x - 53, FINAL_BOSS_POSITION.y + 34, 'GARDIEN', { fontSize: '13px', color: '#fff' });
    this.add.line(0, 0, 520, 0, 520, 360, 0xe1c477, 0.62).setOrigin(0);
    this.add.text(525, 177, 'PORTAIL · NIVEAU 4', { fontSize: '12px', color: '#f1d38c', backgroundColor: '#101820cc', padding: { x: 6, y: 4 } });
    this.add.line(0, 0, 0, 360, 1040, 360, 0xe1c477, 0.62).setOrigin(0);
    this.add.text(405, 365, 'TERRES CENDRÉES · NIVEAU 8 / CHEMIN PERMANENT', { fontSize: '12px', color: '#f1d38c', backgroundColor: '#101820cc', padding: { x: 6, y: 4 } });
    const playerGraphic = this.make.graphics({ x: 0, y: 0 });
    playerGraphic.fillStyle(this.playerColor);
    playerGraphic.fillCircle(16, 16, 13);
    playerGraphic.lineStyle(3, 0xf0f1df);
    playerGraphic.strokeCircle(16, 16, 13);
    playerGraphic.generateTexture('player-dot', 32, 32);
    playerGraphic.destroy();
    this.player = this.physics.add.sprite(100, 160, 'player-dot');
    this.player.setCircle(13).setCollideWorldBounds(true).setBounce(0);
    this.physics.add.collider(this.player, this.walls);
    this.physics.add.overlap(this.player, this.boss, () => this.callbacks.event('boss'));
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,Z,Q,UP,DOWN,LEFT,RIGHT,SPACE') as Record<string, Phaser.Input.Keyboard.Key>;
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.setZoom(Math.min(this.scale.width / WORLD_WIDTH, this.scale.height / WORLD_HEIGHT));
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.scale.on('resize', (size: Phaser.Structs.Size) => {
      this.cameras.main.setZoom(Math.min(size.width / WORLD_WIDTH, size.height / WORLD_HEIGHT));
    });
    this.add.text(10, 10, 'WASD / ZQSD / flèches • Espace : pause', {
      fontFamily: 'monospace', fontSize: '13px', color: '#fff', backgroundColor: '#101820aa', padding: { x: 7, y: 5 },
    }).setScrollFactor(0).setDepth(20);
    this.input.keyboard?.on('keydown', () => this.setDevice('keyboard'));
    this.player.setPosition(this.startPosition.x, this.startPosition.y);
    this.lastX = this.startPosition.x;
    this.lastY = this.startPosition.y;
    this.events.on('resume-position', (x: number, y: number) => this.player.setPosition(x, y));
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
    const playerZone = ZONES.find((zone) =>
      this.player.x >= zone.bounds.x && this.player.x < zone.bounds.x + zone.bounds.w &&
      this.player.y >= zone.bounds.y && this.player.y < zone.bounds.y + zone.bounds.h);
    if (playerZone && !this.callbacks.canEnterZone(playerZone.id)) {
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
    if (this.shrineReady && Phaser.Math.Distance.Between(this.player.x, this.player.y, 470, 185) < 34) {
      this.shrineReady = false;
      this.callbacks.event('shrine');
    }
    if (!this.seenSecrets.has('one') && Phaser.Math.Distance.Between(this.player.x, this.player.y, 150, 550) < 26) {
      this.seenSecrets.add('one');
      this.callbacks.event('secret-one');
    }
    if (!this.seenSecrets.has('two') && Phaser.Math.Distance.Between(this.player.x, this.player.y, 675, 463) < 26) {
      this.seenSecrets.add('two');
      this.callbacks.event('secret-two');
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
