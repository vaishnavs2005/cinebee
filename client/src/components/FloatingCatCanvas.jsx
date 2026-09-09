import React, { useEffect, useRef } from 'react';
import { getPreloadedCatImages, NUM_UNIQUE_CATS } from '../services/assetPreloader';

const COPIES_PER_CAT = 2; // Each head duplicated twice = 24 cats in total
const TOTAL_CATS = NUM_UNIQUE_CATS * COPIES_PER_CAT;

export default function FloatingCatCanvas({ paused = false }) {
  const canvasRef = useRef(null);
  const pausedRef = useRef(paused);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Obtain preloaded and decoded cat images
    const images = getPreloadedCatImages();

    // Particle sparks for collisions
    let sparks = [];

    function addSparks(x, y, count = 4) {
      const colors = ['#E8402C', '#E5A93C', '#2A7B62', '#1A1A1A', '#FFFDF7'];
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 4.5;
        sparks.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 3 + Math.random() * 3.5,
          color: colors[Math.floor(Math.random() * colors.length)],
          alpha: 1,
          life: 22 + Math.random() * 15,
          maxLife: 37,
          isStar: Math.random() > 0.35,
        });
      }
    }

    // Shockwaves on clicks
    let shockwaves = [];

    // Initialize 24 cats
    const cats = [];
    const sizes = [42, 46, 48, 52, 54, 58]; // Crisp sticker sizes

    for (let i = 0; i < TOTAL_CATS; i++) {
      const radius = (sizes[i % sizes.length] || 48) / 2;

      cats.push({
        id: i,
        img: null, // Assigned dynamically in computeHomePositions to maximize duplicate separation
        x: 0,
        y: 0,
        homeX: 0,
        homeY: 0,
        radius,
        mass: radius * radius,
        vx: 0,
        vy: 0,
        angle: (Math.random() - 0.5) * 0.3,
        vAngle: 0,
        squish: 0,
        squishV: 0,
        currentScale: 1.0,
        isHovered: false,
        isDragging: false,
        dragOffsetX: 0,
        dragOffsetY: 0,
        history: [],
        phase: (i * 1.618) % (Math.PI * 2),
        floatSpeed: 0.0008 + (i % 4) * 0.0002,
        idleRadiusX: 8 + (i % 3) * 3,
        idleRadiusY: 7 + (i % 3) * 2,
      });
    }

    // Function to compute 24 evenly, randomly distributed, non-touching positions
    // and assign duplicated cats so they are maximally far apart from each other
    function computeHomePositions(snapToHome = false) {
      const cardEl = document.querySelector('.landing-order-card');
      const heroEl = document.querySelector('.landing-hero');
      let centerLeft = width * 0.33;
      let centerRight = width * 0.67;

      if (cardEl || heroEl) {
        const cr = cardEl ? cardEl.getBoundingClientRect() : null;
        const hr = heroEl ? heroEl.getBoundingClientRect() : null;
        centerLeft = Math.min(cr ? cr.left : Infinity, hr ? hr.left : Infinity);
        centerRight = Math.max(cr ? cr.right : -Infinity, hr ? hr.right : -Infinity);
      }

      // Safe outer margins from all 4 screen edges
      const edgePadX = Math.max(85, width * 0.065);
      const edgePadY = Math.max(75, height * 0.10);
      const wingTop = edgePadY;
      const wingBottom = height - edgePadY;
      const wingH = wingBottom - wingTop;

      // Define Left Wing and Right Wing arenas (leaving safe margins from card and screen borders)
      const leftWingLeft = edgePadX;
      const leftWingRight = Math.max(leftWingLeft + 120, centerLeft - 32);
      const leftWingW = leftWingRight - leftWingLeft;

      const rightWingLeft = Math.min(width - edgePadX - 120, centerRight + 32);
      const rightWingRight = width - edgePadX;
      const rightWingW = rightWingRight - rightWingLeft;

      // 1. Generate 12 stratified random points in Left Wing, 12 in Right Wing
      const positions = [];
      const wingCols = 3;
      const wingRows = 4;
      const cellH = wingH / wingRows;

      // Left Wing: 12 cats (3 cols x 4 rows)
      const leftCellW = leftWingW / wingCols;
      for (let r = 0; r < wingRows; r++) {
        for (let c = 0; c < wingCols; c++) {
          const px = leftWingLeft + (c + 0.18 + Math.random() * 0.64) * leftCellW;
          const py = wingTop + (r + 0.18 + Math.random() * 0.64) * cellH;
          positions.push({ x: px, y: py, radius: cats[positions.length]?.radius || 24, wing: 'left' });
        }
      }

      // Right Wing: 12 cats (3 cols x 4 rows)
      const rightCellW = rightWingW / wingCols;
      for (let r = 0; r < wingRows; r++) {
        for (let c = 0; c < wingCols; c++) {
          const px = rightWingLeft + (c + 0.18 + Math.random() * 0.64) * rightCellW;
          const py = wingTop + (r + 0.18 + Math.random() * 0.64) * cellH;
          positions.push({ x: px, y: py, radius: cats[positions.length]?.radius || 24, wing: 'right' });
        }
      }

      // 2. Multi-pass repulsive relaxation to ensure NO TWO CATS TOUCH (min buffer of 44px)
      // and keep them strictly inside their designated wings away from screen borders
      const iterations = 45;
      for (let iter = 0; iter < iterations; iter++) {
        // Inter-cat repulsion
        for (let i = 0; i < positions.length; i++) {
          for (let j = i + 1; j < positions.length; j++) {
            const p1 = positions[i];
            const p2 = positions[j];
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const dist = Math.hypot(dx, dy);
            const minDist = p1.radius + p2.radius + 44;

            if (dist < minDist && dist > 0) {
              const overlap = (minDist - dist) * 0.5;
              const nx = dx / dist;
              const ny = dy / dist;
              p1.x -= nx * overlap;
              p1.y -= ny * overlap;
              p2.x += nx * overlap;
              p2.y += ny * overlap;
            } else if (dist === 0) {
              p1.x -= 12;
              p2.x += 12;
            }
          }
        }

        // Clamp each point within its respective wing boundaries
        for (const p of positions) {
          if (p.wing === 'left') {
            p.x = Math.max(leftWingLeft, Math.min(leftWingRight, p.x));
          } else {
            p.x = Math.max(rightWingLeft, Math.min(rightWingRight, p.x));
          }
          p.y = Math.max(wingTop, Math.min(wingBottom, p.y));
        }
      }

      // 3. Duplicate Separation: 12 unique images
      // Copy 1 is ALWAYS in Left Wing (positions 0..11)
      // Copy 2 is ALWAYS in Right Wing (positions 12..23)
      for (let imgIdx = 0; imgIdx < NUM_UNIQUE_CATS; imgIdx++) {
        const p1 = positions[imgIdx];
        const p2 = positions[12 + ((imgIdx * 7 + 4) % 12)];

        const cat1 = cats[2 * imgIdx];
        cat1.img = images[imgIdx];
        cat1.homeX = p1.x;
        cat1.homeY = p1.y;

        const cat2 = cats[2 * imgIdx + 1];
        cat2.img = images[imgIdx];
        cat2.homeX = p2.x;
        cat2.homeY = p2.y;

        if (snapToHome) {
          // On page load: cats drop in gracefully from above the screen with downward momentum
          cat1.x = p1.x + (Math.random() - 0.5) * 24;
          cat1.y = -cat1.radius - 40 - (imgIdx * 32 + Math.random() * 50);
          cat1.vx = (Math.random() - 0.5) * 1.5;
          cat1.vy = 3.2 + Math.random() * 3.6;
          cat1.squish = 0.3;

          cat2.x = p2.x + (Math.random() - 0.5) * 24;
          cat2.y = -cat2.radius - 40 - (imgIdx * 32 + 20 + Math.random() * 50);
          cat2.vx = (Math.random() - 0.5) * 1.5;
          cat2.vy = 3.2 + Math.random() * 3.6;
          cat2.squish = 0.3;
        }
      }
    }

    let dropStarted = false;
    const startEntranceDrop = () => {
      if (dropStarted) return;
      dropStarted = true;
      computeHomePositions(true);
      setTimeout(() => computeHomePositions(false), 150);
      setTimeout(() => computeHomePositions(false), 600);
    };

    const allImagesReady = images.every((img) => img.complete && img.naturalWidth > 0);
    if (allImagesReady) {
      startEntranceDrop();
    } else {
      images.forEach((img) => {
        if (!img.complete) {
          img.addEventListener('load', () => {
            if (images.every((i) => i.complete && i.naturalWidth > 0)) {
              startEntranceDrop();
            }
          }, { once: true });
        }
      });
      // Safety fallback to guarantee drop starts even if an image fails
      setTimeout(startEntranceDrop, 800);
    }

    // Mouse tracking state
    const mouse = {
      x: -1000,
      y: -1000,
      prevX: -1000,
      prevY: -1000,
      vx: 0,
      vy: 0,
      isDown: false,
      draggedCat: null,
      active: false,
    };

    const handlePointerMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;

      if (mouse.prevX !== -1000) {
        mouse.vx = currentX - mouse.prevX;
        mouse.vy = currentY - mouse.prevY;
      }
      mouse.x = currentX;
      mouse.y = currentY;
      mouse.prevX = currentX;
      mouse.prevY = currentY;
      mouse.active = true;

      // Handle dragging
      if (mouse.draggedCat) {
        mouse.draggedCat.x = currentX - mouse.draggedCat.dragOffsetX;
        mouse.draggedCat.y = currentY - mouse.draggedCat.dragOffsetY;
        mouse.draggedCat.history.push({ x: mouse.draggedCat.x, y: mouse.draggedCat.y, t: Date.now() });
        if (mouse.draggedCat.history.length > 5) mouse.draggedCat.history.shift();
      }

      // Check hover for any cat (generous hit radius)
      let anyHovered = false;
      for (const cat of cats) {
        const d = Math.hypot(cat.x - currentX, cat.y - currentY);
        const hitRadius = Math.max(38, cat.radius * 1.5);
        if (d <= hitRadius) {
          cat.isHovered = true;
          anyHovered = true;
        } else {
          cat.isHovered = false;
        }
      }

      canvas.style.cursor = anyHovered || mouse.draggedCat ? 'grab' : 'default';
      if (mouse.draggedCat) canvas.style.cursor = 'grabbing';
    };

    const handlePointerDown = (e) => {
      // Don't intercept clicks inside actual form controls (inputs, buttons)
      const target = e.target;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'BUTTON' || target.closest('form') || target.closest('.landing-order-card'))) {
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      mouse.isDown = true;

      // Check if clicking a cat (generous hit radius)
      let clickedCat = null;
      let minD = Infinity;

      for (const cat of cats) {
        const d = Math.hypot(cat.x - cx, cat.y - cy);
        const hitRadius = Math.max(40, cat.radius * 1.55);
        if (d <= hitRadius && d < minD) {
          minD = d;
          clickedCat = cat;
        }
      }

      if (clickedCat) {
        mouse.draggedCat = clickedCat;
        clickedCat.isDragging = true;
        clickedCat.dragOffsetX = cx - clickedCat.x;
        clickedCat.dragOffsetY = cy - clickedCat.y;
        clickedCat.squish = 0.35;
        clickedCat.history = [{ x: clickedCat.x, y: clickedCat.y, t: Date.now() }];
        canvas.style.cursor = 'grabbing';
        addSparks(clickedCat.x, clickedCat.y, 6);
      } else {
        // Shockwave blast from click
        shockwaves.push({
          x: cx,
          y: cy,
          r: 12,
          maxR: 220,
          strength: 22,
          alpha: 0.85,
        });
        addSparks(cx, cy, 6);
      }
    };

    const handlePointerUp = () => {
      if (mouse.draggedCat) {
        const cat = mouse.draggedCat;
        cat.isDragging = false;
        canvas.style.cursor = 'grab';

        // Fling velocity from drag history
        if (cat.history.length >= 2) {
          const first = cat.history[0];
          const last = cat.history[cat.history.length - 1];
          const dt = Math.max(1, (last.t - first.t) / 16.6);
          cat.vx = ((last.x - first.x) / dt) * 0.95;
          cat.vy = ((last.y - first.y) / dt) * 0.95;
          const maxThrow = 20;
          cat.vx = Math.max(-maxThrow, Math.min(maxThrow, cat.vx));
          cat.vy = Math.max(-maxThrow, Math.min(maxThrow, cat.vy));
          cat.vAngle = cat.vx * 0.05 + (Math.random() - 0.5) * 0.15;
          cat.squish = 0.3;
        }
        cat.history = [];
        mouse.draggedCat = null;
      }
      mouse.isDown = false;
    };

    const handlePointerLeave = () => {
      mouse.active = false;
      mouse.x = -1000;
      mouse.y = -1000;
      mouse.prevX = -1000;
      mouse.prevY = -1000;
      if (mouse.draggedCat) {
        mouse.draggedCat.isDragging = false;
        mouse.draggedCat = null;
      }
      for (const cat of cats) cat.isHovered = false;
    };

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      computeHomePositions(false);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointerleave', handlePointerLeave);

    // Physics Loop
    function updatePhysics() {
      // Find card area to keep cats from bunching underneath it
      const cardEl = document.querySelector('.landing-order-card');
      let cardBox = null;
      if (cardEl) {
        const cr = cardEl.getBoundingClientRect();
        cardBox = {
          left: cr.left - 24,
          right: cr.right + 24,
          top: cr.top - 20,
          bottom: cr.bottom + 20,
          cx: cr.left + cr.width / 2,
          cy: cr.top + cr.height / 2,
        };
      }

      // 1. Direct Physical Cursor Collision & Proximity Push
      if (mouse.active && !mouse.draggedCat) {
        const cursorRadius = 36; // Physical paddle
        const mouseSpeed = Math.hypot(mouse.vx, mouse.vy);

        for (const cat of cats) {
          const dx = cat.x - mouse.x;
          const dy = cat.y - mouse.y;
          const dist = Math.hypot(dx, dy);
          const touchDist = cat.radius + cursorRadius;

          // Direct hit / touch: energetic bounce!
          if (dist < touchDist && dist > 0) {
            const nx = dx / dist;
            const ny = dy / dist;
            const impulse = Math.max(6.0, Math.min(18, 6.0 + mouseSpeed * 0.85));

            cat.vx = nx * impulse + mouse.vx * 0.45;
            cat.vy = ny * impulse + mouse.vy * 0.45;
            cat.vAngle += (nx * mouse.vy - ny * mouse.vx) * 0.005 + (Math.random() - 0.5) * 0.12;
            cat.squish = 0.4;
            addSparks(cat.x, cat.y, 4);
          } else if (dist < 180 && dist > 0) {
            // Proximity wind: smoothly push cats away from cursor trajectory
            const forceRatio = Math.pow(1 - dist / 180, 1.4);
            const force = forceRatio * 2.6;
            cat.vx += (dx / dist) * force;
            cat.vy += (dy / dist) * force;
          }
        }

        // Decay mouse momentum
        mouse.vx *= 0.65;
        mouse.vy *= 0.65;
      }

      // 2. Shockwaves Blast
      for (let i = shockwaves.length - 1; i >= 0; i--) {
        const sw = shockwaves[i];
        sw.r += 8;
        sw.alpha = Math.max(0, 0.85 * (1 - sw.r / sw.maxR));

        for (const cat of cats) {
          if (cat.isDragging) continue;
          const dx = cat.x - sw.x;
          const dy = cat.y - sw.y;
          const d = Math.hypot(dx, dy);

          if (Math.abs(d - sw.r) < 32 && d > 0) {
            const push = (sw.strength * (1 - sw.r / sw.maxR)) / Math.max(1, d * 0.025);
            cat.vx += (dx / d) * push;
            cat.vy += (dy / d) * push;
            cat.vAngle += (Math.random() - 0.5) * 0.12;
            cat.squish = 0.32;
            addSparks(cat.x, cat.y, 2);
          }
        }

        if (sw.r >= sw.maxR) shockwaves.splice(i, 1);
      }

      // 3. Cat-to-Cat Elastic Collisions
      for (let i = 0; i < cats.length; i++) {
        for (let j = i + 1; j < cats.length; j++) {
          const c1 = cats[i];
          const c2 = cats[j];

          const dx = c2.x - c1.x;
          const dy = c2.y - c1.y;
          const dist = Math.hypot(dx, dy);
          const minDist = c1.radius + c2.radius;

          if (dist < minDist && dist > 0) {
            const overlap = minDist - dist;
            const nx = dx / dist;
            const ny = dy / dist;

            // Separate
            if (!c1.isDragging && !c2.isDragging) {
              c1.x -= nx * overlap * 0.5;
              c1.y -= ny * overlap * 0.5;
              c2.x += nx * overlap * 0.5;
              c2.y += ny * overlap * 0.5;
            } else if (c1.isDragging) {
              c2.x += nx * overlap;
              c2.y += ny * overlap;
            } else if (c2.isDragging) {
              c1.x -= nx * overlap;
              c1.y -= ny * overlap;
            }

            // Normal relative velocity
            const kx = c1.vx - c2.vx;
            const ky = c1.vy - c2.vy;
            const p = (2 * (nx * kx + ny * ky)) / (c1.mass + c2.mass);
            const restitution = 0.92;

            if (!c1.isDragging) {
              c1.vx -= p * c2.mass * nx * restitution;
              c1.vy -= p * c2.mass * ny * restitution;
              c1.vAngle += (Math.random() - 0.5) * 0.08;
              c1.squish = Math.min(0.4, c1.squish + 0.24);
            }
            if (!c2.isDragging) {
              c2.vx += p * c1.mass * nx * restitution;
              c2.vy += p * c1.mass * ny * restitution;
              c2.vAngle += (Math.random() - 0.5) * 0.08;
              c2.squish = Math.min(0.4, c2.squish + 0.24);
            }

            // Pop sparks
            addSparks((c1.x + c2.x) / 2, (c1.y + c2.y) / 2, 2);
          }
        }
      }

      // 4. Update Position, Restoring Elastic Physics to Home Position, Bounds Bounce
      for (const cat of cats) {
        if (!cat.isDragging) {
          // Repulsion from card if pushed inside
          if (cardBox) {
            if (
              cat.x > cardBox.left &&
              cat.x < cardBox.right &&
              cat.y > cardBox.top &&
              cat.y < cardBox.bottom
            ) {
              const dx = cat.x - cardBox.cx;
              const dy = cat.y - cardBox.cy;
              const d = Math.hypot(dx, dy) || 1;
              cat.vx += (dx / d) * 0.85;
              cat.vy += (dy / d) * 0.85;
            }
          }

          // Gentle breathing float oscillation around home position
          const t = Date.now() * cat.floatSpeed + cat.phase;
          const targetX = cat.homeX + Math.sin(t) * cat.idleRadiusX;
          const targetY = cat.homeY + Math.cos(t * 0.88) * cat.idleRadiusY;

          // Restoring spring pulling cat slowly and smoothly back to its home place
          const dx = targetX - cat.x;
          const dy = targetY - cat.y;
          const distToHome = Math.hypot(dx, dy);

          // Loose, relaxed spring return: smooth floaty return without snapping
          const springK = 0.0026;
          cat.vx += dx * springK;
          cat.vy += dy * springK;

          // Loose air damping for fluid, organic drift
          cat.vx *= 0.958;
          cat.vy *= 0.958;

          // When settled very close to target, softly calm any micro-jitter
          if (distToHome < 6) {
            cat.vx *= 0.97;
            cat.vy *= 0.97;
          }

          // Speed limit
          const speed = Math.hypot(cat.vx, cat.vy);
          const maxSpeed = 16;
          if (speed > maxSpeed) {
            cat.vx = (cat.vx / speed) * maxSpeed;
            cat.vy = (cat.vy / speed) * maxSpeed;
          }

          cat.x += cat.vx;
          cat.y += cat.vy;

          // Loose upright rotation restoration
          const targetAngle = Math.sin(t * 0.5) * 0.05;
          cat.angle += (targetAngle - cat.angle) * 0.03;
          cat.vAngle *= 0.95;

          // Wall bounces
          const wallPadX = 32;
          const wallPadY = 28;
          if (cat.x - cat.radius < wallPadX) {
            cat.x = wallPadX + cat.radius;
            cat.vx = Math.abs(cat.vx) * 0.82;
            cat.vAngle += (Math.random() - 0.5) * 0.07;
            cat.squish = 0.25;
            addSparks(cat.x - cat.radius, cat.y, 2);
          } else if (cat.x + cat.radius > width - wallPadX) {
            cat.x = width - wallPadX - cat.radius;
            cat.vx = -Math.abs(cat.vx) * 0.82;
            cat.vAngle += (Math.random() - 0.5) * 0.07;
            cat.squish = 0.25;
            addSparks(cat.x + cat.radius, cat.y, 2);
          }

          if (cat.y > wallPadY && cat.y - cat.radius < wallPadY && cat.vy < 0) {
            cat.y = wallPadY + cat.radius;
            cat.vy = Math.abs(cat.vy) * 0.82;
            cat.vAngle += (Math.random() - 0.5) * 0.07;
            cat.squish = 0.25;
            addSparks(cat.x, cat.y - cat.radius, 2);
          } else if (cat.y + cat.radius > height - wallPadY) {
            cat.y = height - wallPadY - cat.radius;
            cat.vy = -Math.abs(cat.vy) * 0.82;
            cat.vAngle += (Math.random() - 0.5) * 0.07;
            cat.squish = 0.25;
            addSparks(cat.x, cat.y + cat.radius, 2);
          }
        }

        // Squish spring oscillation
        cat.squishV += (0 - cat.squish) * 0.2;
        cat.squishV *= 0.76;
        cat.squish += cat.squishV;

        // Smooth scale interpolation for hover & drag
        const targetScale = cat.isDragging ? 1.35 : (cat.isHovered ? 1.25 : 1.0);
        cat.currentScale += (targetScale - cat.currentScale) * 0.2;
      }

      // 5. Sparks Lifecycle
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.x += s.vx;
        s.y += s.vy;
        s.vx *= 0.94;
        s.vy *= 0.94;
        s.life--;
        s.alpha = s.life / s.maxLife;
        if (s.life <= 0) sparks.splice(i, 1);
      }
    }

    // Render Loop
    function draw() {
      ctx.clearRect(0, 0, width, height);

      // 1. Draw Shockwave Rings
      for (const sw of shockwaves) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(232, 64, 44, ${sw.alpha * 0.6})`;
        ctx.lineWidth = 3.5;
        ctx.setLineDash([10, 6]);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(sw.x, sw.y, Math.max(0, sw.r - 10), 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(229, 169, 60, ${sw.alpha * 0.5})`;
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.restore();
      }

      // 2. Draw Sparks
      for (const s of sparks) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, s.alpha);
        ctx.fillStyle = s.color;
        ctx.strokeStyle = '#1A1A1A';
        ctx.lineWidth = 1;

        if (s.isStar) {
          const sz = s.size * 1.5;
          ctx.beginPath();
          ctx.moveTo(s.x, s.y - sz);
          ctx.quadraticCurveTo(s.x, s.y, s.x + sz, s.y);
          ctx.quadraticCurveTo(s.x, s.y, s.x, s.y + sz);
          ctx.quadraticCurveTo(s.x, s.y, s.x - sz, s.y);
          ctx.quadraticCurveTo(s.x, s.y, s.x, s.y - sz);
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
        ctx.restore();
      }

      // 3. Draw Cats
      for (const cat of cats) {
        if (!cat.img.complete || cat.img.naturalWidth === 0) continue;

        ctx.save();
        ctx.translate(cat.x, cat.y);
        ctx.rotate(cat.angle);

        // Hover & dragging scale + collision squish
        const s = cat.currentScale;
        const sx = s * (1 + cat.squish);
        const sy = s * (1 - cat.squish);
        ctx.scale(sx, sy);

        const size = cat.radius * 2;

        // Hover Comic Halo Ring
        if (cat.isHovered || cat.isDragging) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(0, 0, cat.radius + 5, 0, Math.PI * 2);
          ctx.strokeStyle = cat.isDragging ? '#E8402C' : '#E5A93C';
          ctx.lineWidth = 3;
          ctx.setLineDash([6, 4]);
          ctx.stroke();
          ctx.restore();
        }

        // Retro sticker die-cut drop shadow
        ctx.shadowColor = cat.isDragging ? 'rgba(232, 64, 44, 0.45)' : 'rgba(26, 26, 26, 0.28)';
        ctx.shadowBlur = cat.isHovered ? 4 : 0;
        ctx.shadowOffsetX = cat.isDragging ? 5 : 2.5;
        ctx.shadowOffsetY = cat.isDragging ? 7 : 3.5;

        if (cat.img && cat.img.complete && cat.img.naturalWidth > 0) {
          ctx.drawImage(cat.img, -cat.radius, -cat.radius, size, size);
        }
        ctx.restore();
      }
    }

    function loop() {
      if (pausedRef.current) {
        animationFrameId = requestAnimationFrame(loop);
        return;
      }
      updatePhysics();
      draw();
      animationFrameId = requestAnimationFrame(loop);
    }

    loop();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointerleave', handlePointerLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 1,
        pointerEvents: 'auto',
      }}
    />
  );
}
