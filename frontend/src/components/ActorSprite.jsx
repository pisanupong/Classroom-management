import React, { useEffect, useRef, useMemo } from 'react';
import { buildFrame, paintGrid, SPRITE_SIZE, DEFAULT_CHAR_CFG } from '../pages/CharacterEditor';

/**
 * วาดตัวละครพิกเซลจริงของผู้เล่น (จาก character_data ที่สร้างใน CharacterEditor)
 *
 * dir: 0=หน้า 1=ซ้าย 2=ขวา 3=หลัง
 * walking: เดินย่ำอยู่กับที่
 * attack: ท่าโจมตี (พุ่งไปข้างหน้าแล้วเด้งกลับ)
 */
const WALK_FRAMES = [0, 1, 2, 1];

export default function ActorSprite({
  character,
  size = 72,
  dir = 0,
  walking = false,
  attack = false,
  hit = false,
  dead = false,
  faceRight = false,
}) {
  const ref = useRef(null);
  const frameRef = useRef(1);

  // character_data อาจว่าง/ไม่ครบ → เติมค่าเริ่มต้นให้เสมอ
  const cfg = useMemo(() => {
    const base = { ...DEFAULT_CHAR_CFG, ...(character && character.skin ? character : {}) };
    delete base.anim; delete base.dir; delete base.zoom; delete base.speed;
    return base;
  }, [character]);

  const facing = faceRight ? 2 : dir;

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    const draw = (f) => {
      ctx.clearRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
      try { paintGrid(ctx, buildFrame(cfg, facing, f), 1); } catch { /* cfg ไม่ถูกต้อง */ }
    };

    draw(walking ? WALK_FRAMES[frameRef.current % WALK_FRAMES.length] : 1);
    if (!walking) return;

    const id = setInterval(() => {
      frameRef.current = (frameRef.current + 1) % WALK_FRAMES.length;
      draw(WALK_FRAMES[frameRef.current]);
    }, 170);
    return () => clearInterval(id);
  }, [cfg, facing, walking]);

  return (
    <canvas
      ref={ref}
      width={SPRITE_SIZE}
      height={SPRITE_SIZE}
      style={{
        width: size, height: size, display: 'block',
        imageRendering: 'pixelated',
        filter: hit ? 'brightness(2.6)' : dead ? 'grayscale(1)' : 'none',
        opacity: dead ? 0.45 : 1,
        transform: dead ? 'rotate(90deg) scale(.85)' : 'none',
        animation: attack ? `${facing === 1 ? 'actorLungeL' : 'actorLunge'} .45s cubic-bezier(.3,1.4,.4,1)` : 'none',
        transition: 'filter .2s, opacity .3s, transform .4s',
      }}
    />
  );
}
