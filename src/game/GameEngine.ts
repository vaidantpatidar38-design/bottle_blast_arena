import Matter from "matter-js";

const { Engine, Render, Runner, Bodies, World, Events, Body, Vector } = Matter;

export interface GameCallbacks {
  onScoreChange: (score: number) => void;
  onShotsChange: (shots: number) => void;
  onGameOver: (finalScore: number) => void;
  onImpact: () => void;
  onAllDown: () => void;
}

export interface DragState {
  active: boolean;
  power: number; // 0-100
  angle: number;
  trajectory: Array<{ x: number; y: number }>;
}

const TOTAL_SHOTS = 5;
const BOTTLE_COUNT = 6;
const BOTTLE_SCORE = 10;
const ALL_DOWN_BONUS = 50;

// Canvas layout constants (relative to canvas size)
const CATAPULT_X_RATIO = 0.18;
const CATAPULT_Y_RATIO = 0.72;
const SHELF_X_RATIO = 0.62;
const SHELF_Y_RATIO = 0.70;

export class PitchPopGame {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private engine: Matter.Engine;
  private runner: Matter.Runner;
  private callbacks: GameCallbacks;
  private animFrameId: number | null = null;

  private score = 0;
  private shotsLeft = TOTAL_SHOTS;
  private gameOver = false;
  private bottlesDown = 0;

  // Catapult state
  private armAngle = -0.3; // resting angle
  private armSnapping = false;
  private armSnapProgress = 0;

  // Drag/aim state
  private isDragging = false;
  private dragStart: { x: number; y: number } | null = null;
  private dragCurrent: { x: number; y: number } | null = null;
  dragState: DragState = { active: false, power: 0, angle: 0, trajectory: [] };

  // Physics objects
  private ball: Matter.Body | null = null;
  private bottles: Matter.Body[] = [];
  private ground!: Matter.Body;
  private shelf!: Matter.Body;
  private leftWall!: Matter.Body;

  // Particles
  private particles: Array<{
    x: number; y: number; vx: number; vy: number;
    life: number; maxLife: number; color: string; size: number;
  }> = [];

  // Screen shake
  private shakeIntensity = 0;

  // Clouds
  private clouds: Array<{ x: number; y: number; speed: number; w: number; h: number }> = [];

  // Ball trail
  private ballTrail: Array<{ x: number; y: number; alpha: number }> = [];

  private bottlesKnockedThisShot = 0;
  private ballFired = false;
  private ballSettled = false;
  private ballSettleTimer = 0;

  constructor(canvas: HTMLCanvasElement, callbacks: GameCallbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.callbacks = callbacks;
    this.engine = Engine.create({ gravity: { y: 2.5 } });
    this.runner = Runner.create();

    this.initClouds();
    this.initPhysics();
    this.setupInput();
    this.loop();
  }

  private initClouds() {
    for (let i = 0; i < 4; i++) {
      this.clouds.push({
        x: Math.random() * this.canvas.width,
        y: 40 + Math.random() * 80,
        speed: 0.15 + Math.random() * 0.2,
        w: 80 + Math.random() * 60,
        h: 30 + Math.random() * 20,
      });
    }
  }

  private initPhysics() {
    const W = this.canvas.width;
    const H = this.canvas.height;

    // Ground
    this.ground = Bodies.rectangle(W / 2, H + 25, W * 2, 50, { isStatic: true, label: "ground" });
    // Shelf (where bottles sit)
    const shelfX = W * SHELF_X_RATIO;
    const shelfY = H * SHELF_Y_RATIO;
    this.shelf = Bodies.rectangle(shelfX, shelfY + 15, 200, 18, { isStatic: true, label: "shelf", friction: 0.8 });
    // Left wall (stop ball from going off-left)
    this.leftWall = Bodies.rectangle(-25, H / 2, 50, H * 2, { isStatic: true, label: "wall" });

    World.add(this.engine.world, [this.ground, this.shelf, this.leftWall]);
    this.spawnBottles();

    Events.on(this.engine, "collisionStart", (event) => {
      event.pairs.forEach((pair) => {
        const { bodyA, bodyB } = pair;
        const isBallCollision =
          (bodyA === this.ball || bodyB === this.ball) &&
          (bodyA.label === "bottle" || bodyB.label === "bottle");
        if (isBallCollision) {
          this.callbacks.onImpact();
          this.triggerShake(6);
          this.spawnParticles(
            (bodyA === this.ball ? bodyB : bodyA).position.x,
            (bodyA === this.ball ? bodyB : bodyA).position.y,
          );
        }
      });
    });
  }

  private spawnBottles() {
    const W = this.canvas.width;
    const H = this.canvas.height;
    const shelfX = W * SHELF_X_RATIO;
    const shelfY = H * SHELF_Y_RATIO;

    // Pyramid: row 3 (bottom), row 2, row 1 (top)
    const bW = 22, bH = 44;
    const gap = 4;
    const arrangements = [
      // bottom row: 3 bottles
      { x: shelfX - (bW + gap), y: shelfY - bH / 2 - 8 },
      { x: shelfX, y: shelfY - bH / 2 - 8 },
      { x: shelfX + (bW + gap), y: shelfY - bH / 2 - 8 },
      // middle row: 2 bottles
      { x: shelfX - (bW + gap) / 2, y: shelfY - bH * 1.5 - 8 - gap },
      { x: shelfX + (bW + gap) / 2, y: shelfY - bH * 1.5 - 8 - gap },
      // top row: 1 bottle
      { x: shelfX, y: shelfY - bH * 2.5 - 8 - gap * 2 },
    ];

    this.bottles = arrangements.map((pos) => {
      const b = Bodies.rectangle(pos.x, pos.y, bW, bH, {
        label: "bottle",
        restitution: 0.3,
        friction: 0.5,
        density: 0.003,
      });
      return b;
    });
    World.add(this.engine.world, this.bottles);
  }

  private pouchPosition(): { x: number; y: number } {
    const W = this.canvas.width;
    const H = this.canvas.height;
    const cx = W * CATAPULT_X_RATIO;
    const cy = H * CATAPULT_Y_RATIO;
    const armLen = H * 0.22;
    return {
      x: cx + Math.cos(this.armAngle - Math.PI / 2) * armLen,
      y: cy + Math.sin(this.armAngle - Math.PI / 2) * armLen,
    };
  }

  private setupInput() {
    const getPos = (e: MouseEvent | TouchEvent): { x: number; y: number } => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      if (e instanceof TouchEvent) {
        return {
          x: (e.touches[0].clientX - rect.left) * scaleX,
          y: (e.touches[0].clientY - rect.top) * scaleY,
        };
      }
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    };

    const onStart = (e: MouseEvent | TouchEvent) => {
      if (this.gameOver || this.ballFired || this.armSnapping) return;
      e.preventDefault();
      const pos = getPos(e);
      const pouch = this.pouchPosition();
      const dist = Math.hypot(pos.x - pouch.x, pos.y - pouch.y);
      if (dist < 50) {
        this.isDragging = true;
        this.dragStart = pos;
        this.dragCurrent = pos;
      }
    };

    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!this.isDragging) return;
      e.preventDefault();
      this.dragCurrent = getPos(e);
      this.updateDragState();
    };

    const onEnd = (e: MouseEvent | TouchEvent) => {
      if (!this.isDragging) return;
      e.preventDefault();
      this.isDragging = false;
      if (this.dragState.power > 5) {
        this.fire();
      }
      this.dragState = { active: false, power: 0, angle: 0, trajectory: [] };
    };

    this.canvas.addEventListener("mousedown", onStart);
    this.canvas.addEventListener("mousemove", onMove);
    this.canvas.addEventListener("mouseup", onEnd);
    this.canvas.addEventListener("touchstart", onStart, { passive: false });
    this.canvas.addEventListener("touchmove", onMove, { passive: false });
    this.canvas.addEventListener("touchend", onEnd, { passive: false });
  }

  private updateDragState() {
    if (!this.dragStart || !this.dragCurrent) return;
    const pouch = this.pouchPosition();
    const dx = this.dragStart.x - this.dragCurrent.x;
    const dy = this.dragStart.y - this.dragCurrent.y;
    const dist = Math.min(Math.hypot(dx, dy), 120);
    const power = (dist / 120) * 100;
    const angle = Math.atan2(-dy, dx);

    // Trajectory preview (simple projectile motion, 30 steps)
    const speed = (dist / 120) * 22;
    const vx = Math.cos(angle) * speed;
    const vy = -Math.sin(angle) * speed;
    const gravity = 0.5;
    const trajectory: Array<{ x: number; y: number }> = [];
    for (let t = 0; t < 35; t++) {
      const tx = pouch.x + vx * t;
      const ty = pouch.y + vy * t + 0.5 * gravity * t * t;
      trajectory.push({ x: tx, y: ty });
      if (ty > this.canvas.height) break;
    }

    this.dragState = { active: true, power, angle, trajectory };

    // Adjust arm angle based on pull
    const pullRatio = dist / 120;
    this.armAngle = -0.3 - pullRatio * 0.8;
  }

  private fire() {
    if (this.shotsLeft <= 0 || this.gameOver) return;
    // Capture power/angle BEFORE snap (dragState still active here)
    if (this.dragState.active) {
      this._lastPower = this.dragState.power;
      this._lastAngle = this.dragState.angle;
    }
    this.shotsLeft--;
    this.callbacks.onShotsChange(this.shotsLeft);
    this.armSnapping = true;
    this.armSnapProgress = 0;
    this.bottlesKnockedThisShot = 0;
    this.ballFired = false;
    this.ballSettled = false;
    this.ballSettleTimer = 0;
  }

  private launchBall() {
    const pouch = this.pouchPosition();
    const { power, angle } = this.dragState.active
      ? this.dragState
      : { power: 60, angle: 0.5 };

    // Use stored drag state power/angle from before snap
    const storedPower = this._lastPower ?? 60;
    const storedAngle = this._lastAngle ?? 0.5;
    const speed = (storedPower / 100) * 22;
    const vx = Math.cos(storedAngle) * speed;
    const vy = -Math.sin(storedAngle) * speed;

    this.ball = Bodies.circle(pouch.x, pouch.y, 14, {
      label: "ball",
      restitution: 0.4,
      friction: 0.3,
      density: 0.006,
    });
    Body.setVelocity(this.ball, { x: vx, y: vy });
    World.add(this.engine.world, this.ball);
    this.ballFired = true;
    this.ballTrail = [];
  }

  private _lastPower = 60;
  private _lastAngle = 0.5;

  private updateDragStateCapture() {
    // power/angle captured in fire() before snap starts
  }

  private triggerShake(intensity: number) {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
  }

  private spawnParticles(x: number, y: number) {
    const colors = ["#ff4444", "#ff8800", "#ffcc00", "#ffffff", "#ff6699"];
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 5;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        life: 1, maxLife: 1,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 3 + Math.random() * 5,
      });
    }
  }

  private checkBottles() {
    const H = this.canvas.height;
    let newKnocks = 0;
    this.bottles.forEach((b) => {
      if (b.label === "bottle") {
        const angle = Math.abs(b.angle % (Math.PI * 2));
        const tipped = angle > 0.5 && angle < Math.PI * 2 - 0.5;
        const fallen = b.position.y > H * SHELF_Y_RATIO + 30;
        if ((tipped || fallen) && !(b as any)._counted) {
          (b as any)._counted = true;
          newKnocks++;
          this.bottlesKnockedThisShot++;
          this.bottlesDown++;
        }
      }
    });
    if (newKnocks > 0) {
      this.score += newKnocks * BOTTLE_SCORE;
      if (this.bottlesDown >= BOTTLE_COUNT) {
        this.score += ALL_DOWN_BONUS;
        this.callbacks.onAllDown();
      }
      this.callbacks.onScoreChange(this.score);
    }
  }

  private resetForNextShot() {
    // Remove old ball
    if (this.ball) {
      World.remove(this.engine.world, this.ball);
      this.ball = null;
    }
    this.ballFired = false;
    this.ballSettled = false;
    this.ballTrail = [];
    this.armAngle = -0.3;
    this.armSnapping = false;
    this.armSnapProgress = 0;

    if (this.shotsLeft <= 0) {
      setTimeout(() => {
        this.gameOver = true;
        this.callbacks.onGameOver(this.score);
      }, 1200);
    }
  }

  private loop() {
    this.animFrameId = requestAnimationFrame(() => this.loop());

    // Update physics
    Engine.update(this.engine, 1000 / 60);

    // Arm snap animation
    if (this.armSnapping) {
      this.armSnapProgress += 0.12;
      this.armAngle = -0.3 - (1 - this.armSnapProgress) * 0.8 * this._lastPower / 100;
      const snapTarget = 1.1;
      this.armAngle = -0.3 + (snapTarget * this.armSnapProgress);
      if (this.armSnapProgress >= 1) {
        this.armSnapping = false;
        this.armAngle = snapTarget - 0.3;
        this.launchBall();
      }
    }

    // Ball trail
    if (this.ball && this.ballFired) {
      this.ballTrail.unshift({ x: this.ball.position.x, y: this.ball.position.y, alpha: 0.6 });
      if (this.ballTrail.length > 12) this.ballTrail.pop();
      this.ballTrail.forEach((t, i) => { t.alpha = (0.6 * (1 - i / 12)); });
    }

    // Check bottles
    if (this.ballFired) this.checkBottles();

    // Ball settle detection
    if (this.ballFired && this.ball) {
      const speed = Math.hypot(this.ball.velocity.x, this.ball.velocity.y);
      const outOfBounds = this.ball.position.x > this.canvas.width + 100 ||
        this.ball.position.y > this.canvas.height + 100;
      if (speed < 0.5 || outOfBounds) {
        this.ballSettleTimer++;
        if (this.ballSettleTimer > 90) {
          this.resetForNextShot();
        }
      } else {
        this.ballSettleTimer = 0;
      }
    }

    // Decay shake
    this.shakeIntensity *= 0.85;

    // Update particles
    this.particles = this.particles.filter((p) => p.life > 0);
    this.particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.25;
      p.life -= 0.03;
    });

    // Move clouds
    this.clouds.forEach((c) => {
      c.x += c.speed;
      if (c.x > this.canvas.width + 100) c.x = -100;
    });

    this.draw();
  }

  private draw() {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;

    // Screen shake offset
    const shakeX = this.shakeIntensity > 0.5 ? (Math.random() - 0.5) * this.shakeIntensity : 0;
    const shakeY = this.shakeIntensity > 0.5 ? (Math.random() - 0.5) * this.shakeIntensity : 0;

    ctx.save();
    ctx.translate(shakeX, shakeY);

    // Sky gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, H * 0.7);
    skyGrad.addColorStop(0, "#87CEEB");
    skyGrad.addColorStop(1, "#C8E8F8");
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H);

    // Ground
    const groundGrad = ctx.createLinearGradient(0, H * 0.72, 0, H);
    groundGrad.addColorStop(0, "#8B6914");
    groundGrad.addColorStop(1, "#5C4A1A");
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, H * 0.72, W, H);

    // Ground detail line
    ctx.strokeStyle = "#6B4F10";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, H * 0.72);
    ctx.lineTo(W, H * 0.72);
    ctx.stroke();

    // Clouds
    this.drawClouds();

    // Carnival tent stripes in background
    this.drawTentStripes();

    // Shelf
    this.drawShelf();

    // Catapult
    this.drawCatapult();

    // Trajectory preview
    if (this.isDragging && this.dragState.active && this.dragState.power > 5) {
      this.drawTrajectory();
    }

    // Ball trail
    this.ballTrail.forEach((t) => {
      ctx.beginPath();
      ctx.arc(t.x, t.y, 10, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 120, 50, ${t.alpha})`;
      ctx.fill();
    });

    // Ball
    if (this.ball) this.drawBall();

    // Bottles
    this.bottles.forEach((b) => this.drawBottle(b));

    // Particles
    this.drawParticles();

    ctx.restore();
  }

  private drawClouds() {
    const ctx = this.ctx;
    this.clouds.forEach((c) => {
      ctx.save();
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, c.w / 2, c.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(c.x - c.w * 0.25, c.y + 5, c.w * 0.35, c.h * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(c.x + c.w * 0.25, c.y + 8, c.w * 0.3, c.h * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  private drawTentStripes() {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    // Carnival banner at top
    ctx.save();
    const stripeW = 30;
    for (let x = 0; x < W; x += stripeW * 2) {
      ctx.fillStyle = "rgba(220, 38, 38, 0.7)";
      ctx.fillRect(x, 0, stripeW, 18);
    }
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    ctx.fillRect(0, 18, W, 2);
    ctx.restore();

    // Tent peaks
    ctx.save();
    ctx.fillStyle = "rgba(220, 38, 38, 0.5)";
    const peakW = 60;
    const peakH = 40;
    for (let x = W * 0.4; x < W; x += peakW) {
      ctx.beginPath();
      ctx.moveTo(x, H * 0.45);
      ctx.lineTo(x + peakW / 2, H * 0.45 - peakH);
      ctx.lineTo(x + peakW, H * 0.45);
      ctx.closePath();
      ctx.fill();
    }
    // White alternating peaks
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    for (let x = W * 0.4 + peakW / 2; x < W; x += peakW) {
      ctx.beginPath();
      ctx.moveTo(x, H * 0.45);
      ctx.lineTo(x + peakW / 2, H * 0.45 - peakH);
      ctx.lineTo(x + peakW, H * 0.45);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  private drawShelf() {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const shelfX = W * SHELF_X_RATIO;
    const shelfY = H * SHELF_Y_RATIO;

    // Shelf body
    const sw = 200, sh = 18;
    ctx.save();
    const shelfGrad = ctx.createLinearGradient(shelfX - sw / 2, shelfY, shelfX - sw / 2, shelfY + sh);
    shelfGrad.addColorStop(0, "#C8A86B");
    shelfGrad.addColorStop(1, "#7A5C2E");
    ctx.fillStyle = shelfGrad;
    ctx.beginPath();
    ctx.roundRect(shelfX - sw / 2, shelfY + 6, sw, sh, 4);
    ctx.fill();
    // shelf highlight
    ctx.strokeStyle = "rgba(255,255,200,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(shelfX - sw / 2 + 6, shelfY + 8);
    ctx.lineTo(shelfX + sw / 2 - 6, shelfY + 8);
    ctx.stroke();

    // Support legs
    ctx.fillStyle = "#7A5C2E";
    ctx.fillRect(shelfX - sw / 2 + 10, shelfY + 24, 12, H - shelfY - 24);
    ctx.fillRect(shelfX + sw / 2 - 22, shelfY + 24, 12, H - shelfY - 24);
    ctx.restore();
  }

  private drawCatapult() {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const cx = W * CATAPULT_X_RATIO;
    const cy = H * CATAPULT_Y_RATIO;
    const armLen = H * 0.22;

    ctx.save();

    // Base/Wheels
    const baseW = 90, baseH = 22;
    const baseGrad = ctx.createLinearGradient(cx - baseW / 2, cy + 8, cx - baseW / 2, cy + 8 + baseH);
    baseGrad.addColorStop(0, "#8B5E3C");
    baseGrad.addColorStop(1, "#5C3D1E");
    ctx.fillStyle = baseGrad;
    ctx.beginPath();
    ctx.roundRect(cx - baseW / 2, cy + 8, baseW, baseH, 4);
    ctx.fill();
    ctx.strokeStyle = "#3D2710";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Wheels
    const wheelPositions = [cx - 30, cx + 30];
    wheelPositions.forEach((wx) => {
      ctx.beginPath();
      ctx.arc(wx, cy + 20, 14, 0, Math.PI * 2);
      ctx.fillStyle = "#3D2710";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(wx, cy + 20, 9, 0, Math.PI * 2);
      ctx.fillStyle = "#6B4226";
      ctx.fill();
      // spokes
      for (let s = 0; s < 6; s++) {
        const sa = (s / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(wx + Math.cos(sa) * 4, cy + 20 + Math.sin(sa) * 4);
        ctx.lineTo(wx + Math.cos(sa) * 12, cy + 20 + Math.sin(sa) * 12);
        ctx.strokeStyle = "#3D2710";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    });

    // Pivot frame
    ctx.fillStyle = "#6B4226";
    ctx.fillRect(cx - 6, cy - 18, 12, 28);
    ctx.beginPath();
    ctx.arc(cx, cy - 20, 8, 0, Math.PI * 2);
    ctx.fillStyle = "#8B5E3C";
    ctx.fill();

    // Arm
    const armAngle = this.armAngle;
    const armEndX = cx + Math.cos(armAngle - Math.PI / 2) * armLen;
    const armEndY = cy + Math.sin(armAngle - Math.PI / 2) * armLen;
    const armShortEnd = {
      x: cx - Math.cos(armAngle - Math.PI / 2) * armLen * 0.3,
      y: cy - Math.sin(armAngle - Math.PI / 2) * armLen * 0.3,
    };

    // Tension rope (if dragging)
    if (this.isDragging && this.dragCurrent) {
      ctx.beginPath();
      ctx.moveTo(armEndX, armEndY);
      ctx.lineTo(this.dragCurrent.x, this.dragCurrent.y);
      ctx.strokeStyle = "rgba(200,150,80,0.6)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Arm shadow
    ctx.beginPath();
    ctx.moveTo(armShortEnd.x + 2, armShortEnd.y + 2);
    ctx.lineTo(armEndX + 2, armEndY + 2);
    ctx.strokeStyle = "rgba(0,0,0,0.2)";
    ctx.lineWidth = 10;
    ctx.lineCap = "round";
    ctx.stroke();

    // Main arm
    const armGrad = ctx.createLinearGradient(armShortEnd.x, armShortEnd.y, armEndX, armEndY);
    armGrad.addColorStop(0, "#5C3D1E");
    armGrad.addColorStop(0.5, "#8B5E3C");
    armGrad.addColorStop(1, "#6B4226");
    ctx.beginPath();
    ctx.moveTo(armShortEnd.x, armShortEnd.y);
    ctx.lineTo(armEndX, armEndY);
    ctx.strokeStyle = armGrad;
    ctx.lineWidth = 9;
    ctx.lineCap = "round";
    ctx.stroke();

    // Pouch at arm tip (if not fired)
    if (!this.ballFired) {
      ctx.beginPath();
      ctx.arc(armEndX, armEndY, 15, 0, Math.PI * 2);
      ctx.fillStyle = this.isDragging ? "#c0392b" : "#8B5E3C";
      ctx.fill();
      ctx.strokeStyle = "#3D2710";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Ball in pouch
      const ballGrad = ctx.createRadialGradient(armEndX - 4, armEndY - 4, 2, armEndX, armEndY, 13);
      ballGrad.addColorStop(0, "#e74c3c");
      ballGrad.addColorStop(1, "#922b21");
      ctx.beginPath();
      ctx.arc(armEndX, armEndY, 13, 0, Math.PI * 2);
      ctx.fillStyle = ballGrad;
      ctx.fill();
    }

    // Counterweight at short end
    ctx.beginPath();
    ctx.arc(armShortEnd.x, armShortEnd.y, 12, 0, Math.PI * 2);
    ctx.fillStyle = "#3D2710";
    ctx.fill();

    ctx.restore();
  }

  private drawTrajectory() {
    const ctx = this.ctx;
    const pts = this.dragState.trajectory;
    if (pts.length < 2) return;

    ctx.save();
    ctx.setLineDash([5, 7]);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    pts.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();

    // Dots along trajectory
    ctx.setLineDash([]);
    pts.forEach((p, i) => {
      if (i % 4 === 0) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${0.8 - i * 0.02})`;
        ctx.fill();
      }
    });
    ctx.restore();
  }

  private drawBall() {
    if (!this.ball) return;
    const ctx = this.ctx;
    const { x, y } = this.ball.position;
    const r = 14;

    const ballGrad = ctx.createRadialGradient(x - 4, y - 4, 2, x, y, r);
    ballGrad.addColorStop(0, "#e74c3c");
    ballGrad.addColorStop(0.6, "#c0392b");
    ballGrad.addColorStop(1, "#7B241C");
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = ballGrad;
    ctx.fill();

    // Shine
    ctx.beginPath();
    ctx.arc(x - 4, y - 4, 4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fill();
  }

  private drawBottle(b: Matter.Body) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(b.position.x, b.position.y);
    ctx.rotate(b.angle);

    const bW = 22, bH = 44;
    const counted = (b as any)._counted;

    // Bottle body
    const bottleGrad = ctx.createLinearGradient(-bW / 2, -bH / 2, bW / 2, bH / 2);
    if (counted) {
      bottleGrad.addColorStop(0, "#6B6B6B");
      bottleGrad.addColorStop(1, "#3D3D3D");
    } else {
      bottleGrad.addColorStop(0, "#B8E8FF");
      bottleGrad.addColorStop(0.4, "#7EC8E3");
      bottleGrad.addColorStop(1, "#4A9DB5");
    }
    ctx.fillStyle = bottleGrad;

    // Bottle shape
    ctx.beginPath();
    ctx.roundRect(-bW / 2, -bH / 2 + 8, bW, bH - 8, [0, 0, 4, 4]);
    ctx.fill();

    // Neck
    ctx.beginPath();
    ctx.roundRect(-bW / 4, -bH / 2, bW / 2, 14, [3, 3, 0, 0]);
    ctx.fillStyle = counted ? "#555" : "#5A9CB2";
    ctx.fill();

    // Cap
    ctx.beginPath();
    ctx.roundRect(-bW / 4 - 1, -bH / 2 - 4, bW / 2 + 2, 8, 2);
    ctx.fillStyle = counted ? "#888" : "#e74c3c";
    ctx.fill();

    // Label
    if (!counted) {
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.fillRect(-bW / 2 + 3, -4, bW - 6, 14);
    }

    // Shine
    if (!counted) {
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      ctx.beginPath();
      ctx.ellipse(-bW / 4, -bH / 4, 4, 10, -0.3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private drawParticles() {
    const ctx = this.ctx;
    this.particles.forEach((p) => {
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  reset() {
    // Clear physics world
    World.clear(this.engine.world, false);
    Engine.clear(this.engine);

    // Reset state
    this.score = 0;
    this.shotsLeft = TOTAL_SHOTS;
    this.gameOver = false;
    this.bottlesDown = 0;
    this.ball = null;
    this.bottles = [];
    this.particles = [];
    this.ballTrail = [];
    this.armAngle = -0.3;
    this.armSnapping = false;
    this.armSnapProgress = 0;
    this.isDragging = false;
    this.dragState = { active: false, power: 0, angle: 0, trajectory: [] };
    this.ballFired = false;
    this.ballSettled = false;
    this.ballSettleTimer = 0;
    this.bottlesKnockedThisShot = 0;
    this.shakeIntensity = 0;

    this.initPhysics();
    this.callbacks.onScoreChange(0);
    this.callbacks.onShotsChange(TOTAL_SHOTS);
  }

  destroy() {
    if (this.animFrameId !== null) cancelAnimationFrame(this.animFrameId);
    World.clear(this.engine.world, false);
    Engine.clear(this.engine);
    Runner.stop(this.runner);
  }
}
