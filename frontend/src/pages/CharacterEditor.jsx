import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

/* ─── Constants ─────────────────────────────────────────────────────────────── */
const W = 32, H = 48;
const SCALE = 10; // display px per cell
const TRANSPARENT = null;

const PALETTE = [
  // Skin tones
  '#FDDBB4','#F8C090','#E8A87C','#C68642','#8D5524',
  // Hair
  '#F5DEB3','#D4A056','#8B4513','#4A2C00','#1C0A00','#0A0A0A',
  '#C0C0C0','#808080','#FF4500','#8B0000',
  // Clothes
  '#1C3D7A','#2B4A8C','#4169E1','#000080',
  '#1A4A2A','#228B22','#006400',
  '#8B0000','#C00000','#FF0000',
  '#4A2870','#800080','#9932CC',
  '#C68000','#DAA520','#FFD700',
  '#2F4F4F','#696969','#A9A9A9','#D3D3D3','#FFFFFF',
  '#1C1C1C','#2D2D2D','#3C3C3C',
  // Accessories
  '#FF69B4','#FF1493','#00CED1','#20B2AA','#FF8C00',
];

/* ─── Default starter template (school uniform) ───────────────────────────── */
const mkGrid = () => Array(W * H).fill(TRANSPARENT);

const STARTER_TEMPLATES = {
  'นักเรียนชาย': () => {
    const g = mkGrid();
    const p = (x, y, c) => { if (x>=0&&x<W&&y>=0&&y<H) g[y*W+x]=c; };
    const rect = (x1,y1,x2,y2,c) => { for(let y=y1;y<=y2;y++) for(let x=x1;x<=x2;x++) p(x,y,c); };

    // ── Hair ──
    rect(11,1,20,2,'#1C0A00');
    rect(10,3,21,4,'#1C0A00');
    p(10,2,'#1C0A00'); p(21,2,'#1C0A00');
    // hair sides
    for(let y=3;y<=8;y++) { p(9,y,'#1C0A00'); p(22,y,'#1C0A00'); }
    // hair top detail
    for(let x=11;x<=20;x++) p(x,0,'#1C0A00');

    // ── Head/Face ──
    rect(10,3,21,11,'#F8C090');
    // forehead shadow
    for(let x=10;x<=21;x++) p(x,3,'#F0B878');
    // ears
    p(9,6,'#F8C090'); p(9,7,'#F8C090'); p(22,6,'#F8C090'); p(22,7,'#F8C090');
    p(9,8,'#E8A870'); p(22,8,'#E8A870');

    // ── Eyes ──
    // left eye
    rect(11,5,13,5,'#C0D8FF'); // white
    rect(11,6,13,7,'#C0D8FF');
    p(12,6,'#1C1C1C'); p(12,7,'#1C1C1C'); // pupil
    p(13,5,'#1C1C1C'); p(11,5,'#1C1C1C'); // eyelid top
    p(11,8,'#1C0A00'); p(12,8,'#1C0A00'); p(13,8,'#1C0A00'); // lashes
    // right eye
    rect(18,5,20,5,'#C0D8FF');
    rect(18,6,20,7,'#C0D8FF');
    p(19,6,'#1C1C1C'); p(19,7,'#1C1C1C');
    p(18,5,'#1C1C1C'); p(20,5,'#1C1C1C');
    p(18,8,'#1C0A00'); p(19,8,'#1C0A00'); p(20,8,'#1C0A00');
    // eyebrows
    for(let x=11;x<=13;x++) p(x,4,'#2C1808');
    for(let x=18;x<=20;x++) p(x,4,'#2C1808');
    // nose
    p(15,8,'#D8907A'); p(16,8,'#D8907A');
    p(14,9,'#C07060'); p(17,9,'#C07060');
    // mouth
    rect(14,10,17,10,'#C87060');
    p(14,11,'#E09080'); p(17,11,'#E09080');
    rect(14,11,17,11,'#E09080');

    // ── Neck ──
    rect(14,12,17,13,'#F0B878');

    // ── Shirt collar ──
    p(13,13,'#FFFFFF'); p(14,13,'#FFFFFF');
    p(17,13,'#FFFFFF'); p(18,13,'#FFFFFF');

    // ── Blazer/Jacket ──
    rect(9,14,22,25,'#1C3D7A');
    // lapels
    rect(14,14,15,20,'#FFFFFF');
    rect(16,14,17,20,'#FFFFFF');
    p(15,14,'#1C3D7A'); // V-neck
    // buttons
    p(15,17,'#D4B000'); p(15,19,'#D4B000'); p(15,21,'#D4B000');
    // pocket
    rect(10,18,13,20,'#162F60');
    p(11,19,'#FFFFFF');
    // jacket shading
    for(let y=14;y<=25;y++) { p(9,y,'#162F60'); p(22,y,'#162F60'); }
    // tie
    rect(15,15,16,24,'#8B0000');
    p(15,15,'#B00000'); p(16,15,'#B00000');
    p(14,16,'#8B0000'); p(17,16,'#8B0000');

    // ── Arms ──
    // left arm
    rect(7,14,9,24,'#1C3D7A');
    rect(7,25,9,27,'#F0B878'); // hand
    // right arm
    rect(22,14,24,24,'#1C3D7A');
    rect(22,25,24,27,'#F0B878');
    // arm shading
    for(let y=14;y<=24;y++) { p(7,y,'#162F60'); p(24,y,'#162F60'); }

    // ── Belt ──
    rect(9,26,22,27,'#2C1C0A');
    p(15,26,'#C8A000'); p(16,26,'#C8A000'); // buckle

    // ── Pants ──
    rect(9,28,15,40,'#1A1A30');
    rect(16,28,22,40,'#1A1A30');
    p(15,28,'#0A0A18'); p(16,28,'#0A0A18'); // center crease
    // shading
    for(let y=28;y<=40;y++) { p(9,y,'#101020'); p(22,y,'#101020'); }
    // knee highlight
    for(let x=10;x<=14;x++) p(x,34,'#222240');
    for(let x=17;x<=21;x++) p(x,34,'#222240');

    // ── Socks ──
    rect(10,41,15,42,'#E8E8E8');
    rect(16,41,21,42,'#E8E8E8');
    // sock stripe
    for(let x=10;x<=15;x++) p(x,41,'#C0C0C0');
    for(let x=16;x<=21;x++) p(x,41,'#C0C0C0');

    // ── Shoes ──
    rect(8,43,16,45,'#1C1C1C');
    rect(15,43,23,45,'#1C1C1C');
    // highlight
    p(9,43,'#3C3C3C'); p(10,43,'#3C3C3C');
    p(16,43,'#3C3C3C'); p(17,43,'#3C3C3C');
    // toe
    rect(8,44,10,46,'#252525');
    rect(21,44,23,46,'#252525');

    return g;
  },

  'นักเรียนหญิง': () => {
    const g = mkGrid();
    const p = (x, y, c) => { if (x>=0&&x<W&&y>=0&&y<H) g[y*W+x]=c; };
    const rect = (x1,y1,x2,y2,c) => { for(let y=y1;y<=y2;y++) for(let x=x1;x<=x2;x++) p(x,y,c); };

    // ── Hair (long) ──
    rect(10,0,21,2,'#1C0A00');
    rect(9,3,22,5,'#1C0A00');
    // long side hair
    for(let y=0;y<=22;y++) { p(8,y,'#1C0A00'); p(9,y,'#1C0A00'); p(22,y,'#1C0A00'); p(23,y,'#1C0A00'); }
    // inner hair highlight
    for(let y=2;y<=5;y++) for(let x=11;x<=13;x++) p(x,y,'#3C1A08');

    // ── Head/Face ──
    rect(10,3,21,12,'#F8C090');
    // cheeks
    p(10,8,'#F0A0A0'); p(11,8,'#F0A0A0'); p(20,8,'#F0A0A0'); p(21,8,'#F0A0A0');
    p(10,9,'#F0A0A0'); p(21,9,'#F0A0A0');
    // ears
    p(9,7,'#F8C090'); p(22,7,'#F8C090');

    // ── Eyes (bigger, cuter) ──
    rect(11,5,14,8,'#C8E8FF');
    p(12,6,'#1C1C1C'); p(13,6,'#1C1C1C');
    p(12,7,'#2850A0'); p(13,7,'#2850A0');
    p(11,5,'#1C0A00'); p(12,5,'#1C0A00'); p(13,5,'#1C0A00'); p(14,5,'#1C0A00');
    p(11,9,'#1C0A00'); p(14,9,'#1C0A00');
    p(13,5,'#FFFFFF'); // sparkle
    // right eye
    rect(17,5,20,8,'#C8E8FF');
    p(18,6,'#1C1C1C'); p(19,6,'#1C1C1C');
    p(18,7,'#2850A0'); p(19,7,'#2850A0');
    p(17,5,'#1C0A00'); p(18,5,'#1C0A00'); p(19,5,'#1C0A00'); p(20,5,'#1C0A00');
    p(17,9,'#1C0A00'); p(20,9,'#1C0A00');
    p(18,5,'#FFFFFF');
    // eyelashes
    p(10,5,'#1C0A00'); p(15,5,'#1C0A00'); p(16,5,'#1C0A00'); p(21,5,'#1C0A00');
    // eyebrows (arched)
    for(let x=11;x<=14;x++) p(x,4,'#2C1008');
    for(let x=17;x<=20;x++) p(x,4,'#2C1008');
    // nose (tiny)
    p(16,9,'#D8907A');
    // mouth (smile)
    p(14,11,'#C87060'); p(15,11,'#D88070'); p(16,11,'#D88070'); p(17,11,'#C87060');
    p(14,12,'#E0A090'); p(17,12,'#E0A090');

    // ── Neck ──
    rect(14,13,17,14,'#F0B878');

    // ── Sailor collar ──
    rect(9,14,22,16,'#1C3D7A'); // base
    for(let x=9;x<=22;x++) p(x,15,'#FFFFFF'); // white stripe
    for(let x=9;x<=22;x++) p(x,16,'#FFFFFF');
    // V collar
    p(14,17,'#FFFFFF'); p(15,17,'#FFFFFF');
    p(14,18,'#FFFFFF'); p(15,18,'#FFFFFF');
    // ribbon
    rect(14,19,17,21,'#C00000');
    p(13,19,'#C00000'); p(18,19,'#C00000');
    p(15,21,'#C00000'); p(16,21,'#C00000');

    // ── Blouse body ──
    rect(9,17,22,25,'#FFFFFF');
    // shading
    for(let y=17;y<=25;y++) { p(9,y,'#E8E8F0'); p(22,y,'#E8E8F0'); }

    // ── Arms ──
    rect(6,14,9,25,'#1C3D7A');
    rect(22,14,25,25,'#1C3D7A');
    rect(6,26,9,28,'#F8C090');
    rect(22,26,25,28,'#F8C090');
    for(let y=14;y<=25;y++) { p(6,y,'#162F60'); p(25,y,'#162F60'); }

    // ── Skirt ──
    rect(9,26,22,32,'#1C3D7A');
    rect(8,33,23,36,'#1C3D7A'); // flare
    rect(7,37,24,38,'#162F60'); // hem
    for(let y=26;y<=38;y++) { p(9,y,'#162F60'); p(22,y,'#162F60'); }
    // pleat lines
    for(let y=26;y<=38;y++) { p(13,y,'#162F60'); p(18,y,'#162F60'); }
    // waist band
    rect(9,26,22,27,'#2840A0');

    // ── Legs ──
    rect(10,39,15,42,'#F8E0D0');
    rect(16,39,21,42,'#F8E0D0');

    // ── Knee socks ──
    rect(10,42,15,45,'#FFFFFF');
    rect(16,42,21,45,'#FFFFFF');
    for(let x=10;x<=15;x++) { p(x,42,'#E0E0F0'); p(x,43,'#E8E8F8'); }
    for(let x=16;x<=21;x++) { p(x,42,'#E0E0F0'); p(x,43,'#E8E8F8'); }

    // ── Shoes ──
    rect(9,46,15,47,'#1C1C1C');
    rect(16,46,22,47,'#1C1C1C');
    p(10,46,'#3C3C3C'); p(17,46,'#3C3C3C');
    // strap
    rect(9,45,12,45,'#2C2C2C');
    rect(19,45,22,45,'#2C2C2C');

    return g;
  },

  'ว่าง': () => mkGrid(),
};

/* ─── Image to Pixel Art converter (Canvas API) ─────────────────────────────── */
/* ─── Median Cut color quantization ─────────────────────────────────────────── */
const medianCut = (pixels, depth = 4) => {
  if (depth === 0 || pixels.length === 0) {
    // Average color of bucket
    const avg = [0, 0, 0];
    pixels.forEach(([r,g,b]) => { avg[0]+=r; avg[1]+=g; avg[2]+=b; });
    const n = pixels.length || 1;
    return [[Math.round(avg[0]/n), Math.round(avg[1]/n), Math.round(avg[2]/n)]];
  }
  // Find channel with largest range
  let minR=255,maxR=0,minG=255,maxG=0,minB=255,maxB=0;
  pixels.forEach(([r,g,b]) => {
    minR=Math.min(minR,r); maxR=Math.max(maxR,r);
    minG=Math.min(minG,g); maxG=Math.max(maxG,g);
    minB=Math.min(minB,b); maxB=Math.max(maxB,b);
  });
  const rR=maxR-minR, rG=maxG-minG, rB=maxB-minB;
  const ch = rR>=rG && rR>=rB ? 0 : rG>=rB ? 1 : 2;
  pixels.sort((a,b) => a[ch]-b[ch]);
  const mid = Math.floor(pixels.length/2);
  return [
    ...medianCut(pixels.slice(0, mid), depth-1),
    ...medianCut(pixels.slice(mid), depth-1),
  ];
};

const rgbToHex = (r,g,b) => '#' + [r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');

const colorDistPerceptual = (r1,g1,b1,r2,g2,b2) => {
  // Weighted Euclidean (human eye is more sensitive to green)
  return 2*(r1-r2)**2 + 4*(g1-g2)**2 + 3*(b1-b2)**2;
};

/* ─── Progressive downscale (better quality than direct) ──────────────────── */
const progressiveDownscale = (srcCanvas, tw, th) => {
  let cur = srcCanvas;
  while (cur.width > tw*2 || cur.height > th*2) {
    const half = document.createElement('canvas');
    half.width  = Math.max(tw, Math.ceil(cur.width/2));
    half.height = Math.max(th, Math.ceil(cur.height/2));
    const ctx = half.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(cur, 0, 0, half.width, half.height);
    cur = half;
  }
  const dst = document.createElement('canvas');
  dst.width = tw; dst.height = th;
  const ctx = dst.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(cur, 0, 0, tw, th);
  return dst;
};

/* ─── Background color detection (corner sampling) ──────────────────────── */
const detectBgColor = (data, w, h) => {
  const corners = [
    [0,0],[1,0],[0,1],[w-1,0],[w-2,0],[w-1,1],
    [0,h-1],[0,h-2],[1,h-1],[w-1,h-1],[w-2,h-1],[w-1,h-2],
  ];
  const samples = corners.map(([x,y]) => {
    const i = (y*w+x)*4;
    return [data[i],data[i+1],data[i+2],data[i+3]];
  }).filter(([,,,a]) => a > 128);
  if (!samples.length) return null;
  const avg = samples.reduce(([r,g,b],[cr,cg,cb]) => [r+cr,g+cg,b+cb], [0,0,0]);
  return avg.map(v => v/samples.length);
};

/* ─── Main converter — returns { grid, palette } ─────────────────────────── */
const imageToPixelArt = (file, options = {}) => new Promise((resolve, reject) => {
  const { removeBg = true, numColors = 24 } = options;
  const reader = new FileReader();
  reader.onerror = reject;
  reader.onload = (e) => {
    const img = new Image();
    img.onerror = reject;
    img.onload = () => {
      try {
        // 1. Draw to canvas
        const srcCanvas = document.createElement('canvas');
        srcCanvas.width = img.width; srcCanvas.height = img.height;
        const srcCtx = srcCanvas.getContext('2d');
        srcCtx.drawImage(img, 0, 0);

        // 2. Center-crop to aspect ratio W:H
        const srcAR = img.width / img.height;
        const dstAR = W / H;
        let sx, sy, sw, sh;
        if (srcAR > dstAR) {
          sh = img.height; sw = sh * dstAR;
          sx = (img.width - sw) / 2; sy = 0;
        } else {
          sw = img.width; sh = sw / dstAR;
          sx = 0; sy = (img.height - sh) / 2;
        }

        // 3. Crop canvas
        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = Math.round(sw); cropCanvas.height = Math.round(sh);
        cropCanvas.getContext('2d').drawImage(srcCanvas, sx, sy, sw, sh, 0, 0, cropCanvas.width, cropCanvas.height);

        // 4. Progressive downscale to W×H
        const smallCanvas = progressiveDownscale(cropCanvas, W, H);
        const rawData = smallCanvas.getContext('2d').getImageData(0, 0, W, H).data;

        // 5. Detect background color
        const bgRGB = removeBg ? detectBgColor(rawData, W, H) : null;

        // 6. Collect visible pixels for Median Cut
        const visiblePixels = [];
        for (let i = 0; i < W * H; i++) {
          const r=rawData[i*4], g=rawData[i*4+1], b=rawData[i*4+2], a=rawData[i*4+3];
          if (a < 40) continue;
          // Skip bg-colored pixels
          if (bgRGB) {
            const d = colorDistPerceptual(r,g,b,...bgRGB,0);
            if (d < 1200) continue;
          }
          visiblePixels.push([r,g,b]);
        }

        // 7. Build adaptive palette via Median Cut
        const depth = Math.ceil(Math.log2(numColors));
        const adaptivePalette = visiblePixels.length > 0
          ? medianCut(visiblePixels, depth).map(([r,g,b]) => rgbToHex(r,g,b))
          : PALETTE.slice(0, numColors);

        // 8. Map each pixel to nearest adaptive palette color
        const grid = [];
        for (let i = 0; i < W * H; i++) {
          const r=rawData[i*4], g=rawData[i*4+1], b=rawData[i*4+2], a=rawData[i*4+3];
          // Transparent
          if (a < 40) { grid.push(TRANSPARENT); continue; }
          // Background removal
          if (bgRGB) {
            const d = colorDistPerceptual(r,g,b,...bgRGB,0);
            if (d < 1200) { grid.push(TRANSPARENT); continue; }
          }
          // Find nearest in adaptive palette
          let best = adaptivePalette[0], bestD = Infinity;
          for (const hex of adaptivePalette) {
            const n = parseInt(hex.slice(1),16);
            const pr=n>>16&255, pg=n>>8&255, pb=n&255;
            const d = colorDistPerceptual(r,g,b,pr,pg,pb);
            if (d < bestD) { bestD=d; best=hex; }
          }
          grid.push(best);
        }

        resolve({ grid, palette: adaptivePalette });
      } catch(err) { reject(err); }
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
});

/* ─── Preview SVG (static or animated) ─────────────────────────────────────── */
const PreviewSprite = ({ grid, scale = 3, animating = false }) => {
  const [aFrame, setAFrame] = useState(0);

  useEffect(() => {
    if (!animating) return;
    const t = setInterval(() => setAFrame(f => (f+1)%4), 200);
    return () => clearInterval(t);
  }, [animating]);

  // Simple walk offset for animation
  const offsets = [[0,0],[0,-1],[0,0],[0,1]];
  const [ox, oy] = animating ? offsets[aFrame] : [0,0];

  return (
    <svg width={W*scale} height={H*scale} style={{ imageRendering:'pixelated', display:'block' }}>
      {grid.map((c, i) => {
        if (!c) return null;
        const x = i % W, y = Math.floor(i / W);
        return <rect key={i} x={(x+ox)*scale} y={(y+oy)*scale} width={scale} height={scale} fill={c} />;
      })}
    </svg>
  );
};

/* ─── Main Editor ───────────────────────────────────────────────────────────── */
const CharacterEditor = () => {
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const fileRef = useRef(null);

  const [grid, setGrid] = useState(() => STARTER_TEMPLATES['นักเรียนชาย']());
  const [tool, setTool] = useState('paint'); // 'paint'|'erase'|'fill'
  const [color, setColor] = useState('#F8C090');
  const [isDrawing, setIsDrawing] = useState(false);
  const [history, setHistory] = useState([]);
  const [redo, setRedo]       = useState([]);
  const [saving, setSaving]   = useState(false);
  const [converting, setConverting] = useState(false);
  const [saved, setSaved]     = useState(false);
  const [previewModal, setPreviewModal] = useState(null); // { grid, palette, removeBg, numColors }
  const [bgRemove, setBgRemove] = useState(true);
  const [numColors, setNumColors] = useState(24);
  const [pendingFile, setPendingFile] = useState(null);
  const [zoom, setZoom]       = useState(SCALE);
  const [showGrid, setShowGrid] = useState(true);

  /* ── Canvas render ── */
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Checkerboard background (transparent indicator)
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? '#3a3a4a' : '#2a2a3a';
      ctx.fillRect(x*zoom, y*zoom, zoom, zoom);
    }

    // Pixels
    grid.forEach((c, i) => {
      if (!c) return;
      const x = i%W, y = Math.floor(i/W);
      ctx.fillStyle = c;
      ctx.fillRect(x*zoom, y*zoom, zoom, zoom);
    });

    // Grid lines
    if (showGrid && zoom >= 8) {
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 0.5;
      for (let x = 0; x <= W; x++) { ctx.beginPath(); ctx.moveTo(x*zoom,0); ctx.lineTo(x*zoom,H*zoom); ctx.stroke(); }
      for (let y = 0; y <= H; y++) { ctx.beginPath(); ctx.moveTo(0,y*zoom); ctx.lineTo(W*zoom,y*zoom); ctx.stroke(); }
    }
  }, [grid, zoom, showGrid]);

  const pushHistory = useCallback((g) => {
    setHistory(h => [...h.slice(-29), g]);
    setRedo([]);
  }, []);

  const getCell = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return [Math.floor((e.clientX - rect.left) / zoom), Math.floor((e.clientY - rect.top) / zoom)];
  };

  const paintCell = useCallback((x, y, g) => {
    if (x<0||x>=W||y<0||y>=H) return g;
    const ng = [...g];
    ng[y*W+x] = tool==='erase' ? TRANSPARENT : color;
    return ng;
  }, [tool, color]);

  const floodFill = useCallback((x, y, g) => {
    const target = g[y*W+x];
    const replacement = tool==='erase' ? TRANSPARENT : color;
    if (target === replacement) return g;
    const ng = [...g];
    const stack = [[x,y]];
    while (stack.length) {
      const [cx,cy] = stack.pop();
      if (cx<0||cx>=W||cy<0||cy>=H) continue;
      if (ng[cy*W+cx] !== target) continue;
      ng[cy*W+cx] = replacement;
      stack.push([cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]);
    }
    return ng;
  }, [tool, color]);

  const handleMouseDown = (e) => {
    e.preventDefault();
    const [x,y] = getCell(e);
    if (x<0||x>=W||y<0||y>=H) return;
    pushHistory(grid);
    if (tool === 'fill') {
      setGrid(g => floodFill(x,y,g));
    } else {
      setIsDrawing(true);
      setGrid(g => paintCell(x,y,g));
    }
  };
  const handleMouseMove = (e) => {
    if (!isDrawing) return;
    const [x,y] = getCell(e);
    setGrid(g => paintCell(x,y,g));
  };
  const handleMouseUp = () => setIsDrawing(false);

  const handleUndo = () => {
    if (!history.length) return;
    setRedo(r => [...r, grid]);
    setGrid(history[history.length-1]);
    setHistory(h => h.slice(0,-1));
  };
  const handleRedo = () => {
    if (!redo.length) return;
    setHistory(h => [...h, grid]);
    setGrid(redo[redo.length-1]);
    setRedo(r => r.slice(0,-1));
  };

  const handleTemplate = (name) => {
    pushHistory(grid);
    setGrid(STARTER_TEMPLATES[name]());
  };

  const runConvert = useCallback(async (file, opts) => {
    setConverting(true);
    try {
      const result = await imageToPixelArt(file, opts);
      setPreviewModal({ grid: result.grid, palette: result.palette, file, opts });
    } catch (err) {
      alert('แปลงรูปไม่สำเร็จ: ' + (err.message || err));
    }
    setConverting(false);
  }, []);

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setPendingFile(file);
    await runConvert(file, { removeBg: bgRemove, numColors });
    e.target.value = '';
  };

  const handlePreviewApply = () => {
    if (!previewModal) return;
    pushHistory(grid);
    setGrid(previewModal.grid);
    setPreviewModal(null);
  };

  const handlePreviewReconvert = async (newOpts) => {
    if (!previewModal?.file && !pendingFile) return;
    const file = previewModal?.file || pendingFile;
    setPreviewModal(null);
    await runConvert(file, newOpts);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/users/me/character', { grid, width: W, height: H });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert(err.response?.data?.message || 'บันทึกไม่ได้');
    }
    setSaving(false);
  };

  return (
    <div className="min-h-screen text-white" style={{ background: 'linear-gradient(135deg, #0f0c29 0%, #1a1a2e 50%, #16213e 100%)' }}>
      <div className="fixed top-0 left-0 w-80 h-80 rounded-full opacity-10 pointer-events-none"
        style={{ background: 'radial-gradient(circle,#7c3aed,transparent)', filter:'blur(80px)' }}/>

      {/* Nav */}
      <nav className="px-6 py-4 flex justify-between items-center border-b border-white/10 sticky top-0 z-30"
        style={{ background:'rgba(15,12,41,0.9)', backdropFilter:'blur(10px)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="text-white/60 hover:text-white text-sm">← Dashboard</button>
          <span className="text-white/30">|</span>
          <h1 className="text-lg font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            🎨 สร้างตัวละคร 16-bit
          </h1>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 hover:scale-105 transition-all"
          style={{ background: saved ? 'linear-gradient(135deg,#10b981,#059669)' : 'linear-gradient(135deg,#7c3aed,#db2777)' }}>
          {saved ? '✅ บันทึกแล้ว!' : saving ? 'กำลังบันทึก...' : '💾 บันทึกตัวละคร'}
        </button>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-12 gap-5">

          {/* ─── Left: Palette + Tools ─── */}
          <div className="col-span-12 lg:col-span-3 space-y-4">

            {/* Templates */}
            <div className="rounded-2xl p-4 border border-white/10" style={{ background:'rgba(255,255,255,0.07)' }}>
              <p className="text-xs text-white/50 mb-3 font-medium">เทมเพลต</p>
              <div className="space-y-2">
                {Object.keys(STARTER_TEMPLATES).map(name => (
                  <button key={name} onClick={() => handleTemplate(name)}
                    className="w-full py-2 rounded-xl text-xs border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all">
                    {name === 'ว่าง' ? '🗑️' : name === 'นักเรียนชาย' ? '👦' : '👧'} {name}
                  </button>
                ))}
              </div>
            </div>

            {/* AI Image Convert */}
            <div className="rounded-2xl p-4 border border-purple-500/30" style={{ background:'rgba(124,58,237,0.08)' }}>
              <p className="text-xs text-purple-300 mb-1 font-medium">🤖 AI แปลงรูปเป็น Pixel Art</p>
              <p className="text-xs text-white/30 mb-3">อัปโหลดรูปภาพ → 32×48 pixel art</p>

              <div className="space-y-2 mb-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-white/50">ลบพื้นหลัง</label>
                  <button onClick={() => setBgRemove(v=>!v)}
                    className="w-10 h-5 rounded-full transition-all relative flex-shrink-0"
                    style={{ background: bgRemove ? '#7c3aed' : 'rgba(255,255,255,0.15)' }}>
                    <span className="absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all"
                      style={{ left: bgRemove ? '1.25rem' : '0.125rem' }} />
                  </button>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-xs text-white/50">จำนวนสี</label>
                    <span className="text-xs text-purple-300">{numColors} สี</span>
                  </div>
                  <input type="range" min={8} max={32} value={numColors}
                    onChange={e=>setNumColors(parseInt(e.target.value))}
                    className="w-full accent-purple-500"/>
                </div>
              </div>

              <input ref={fileRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              <button onClick={() => fileRef.current?.click()} disabled={converting}
                className="w-full py-2.5 rounded-xl text-xs font-semibold text-white transition-all disabled:opacity-50 hover:scale-[1.02]"
                style={{ background: converting ? 'rgba(124,58,237,0.3)' : 'linear-gradient(135deg,#7c3aed,#db2777)' }}>
                {converting ? '⚙️ กำลังประมวลผล...' : '📸 เลือกรูปภาพ'}
              </button>
            </div>

            {/* Tools */}
            <div className="rounded-2xl p-4 border border-white/10" style={{ background:'rgba(255,255,255,0.07)' }}>
              <p className="text-xs text-white/50 mb-3 font-medium">เครื่องมือ</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id:'paint', icon:'🖌️', label:'วาด' },
                  { id:'erase', icon:'⬜', label:'ยางลบ' },
                  { id:'fill',  icon:'🪣', label:'เติม' },
                ].map(t => (
                  <button key={t.id} onClick={() => setTool(t.id)}
                    className="py-2 rounded-xl text-xs transition-all border"
                    style={{
                      background: tool===t.id ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.05)',
                      borderColor: tool===t.id ? '#7c3aed' : 'transparent',
                      color: tool===t.id ? '#fff' : 'rgba(255,255,255,0.5)',
                    }}>
                    <div>{t.icon}</div>
                    <div style={{ fontSize:9, marginTop:1 }}>{t.label}</div>
                  </button>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <button onClick={handleUndo} disabled={!history.length}
                  className="flex-1 py-2 rounded-xl text-xs border border-white/10 text-white/40 hover:text-white disabled:opacity-20 transition-colors">
                  ↩ Undo
                </button>
                <button onClick={handleRedo} disabled={!redo.length}
                  className="flex-1 py-2 rounded-xl text-xs border border-white/10 text-white/40 hover:text-white disabled:opacity-20 transition-colors">
                  ↪ Redo
                </button>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <input type="checkbox" id="showgrid" checked={showGrid} onChange={e=>setShowGrid(e.target.checked)} className="accent-purple-500"/>
                <label htmlFor="showgrid" className="text-xs text-white/40 select-none">แสดง grid</label>
              </div>
            </div>

            {/* Zoom */}
            <div className="rounded-2xl p-4 border border-white/10" style={{ background:'rgba(255,255,255,0.07)' }}>
              <p className="text-xs text-white/50 mb-2 font-medium">Zoom: {zoom}px/cell</p>
              <input type="range" min={4} max={16} value={zoom} onChange={e=>setZoom(parseInt(e.target.value))}
                className="w-full accent-purple-500"/>
            </div>
          </div>

          {/* ─── Center: Canvas ─── */}
          <div className="col-span-12 lg:col-span-6 flex flex-col items-center gap-4">
            <div className="rounded-2xl p-4 border border-white/10" style={{ background:'rgba(255,255,255,0.05)' }}>
              <canvas
                ref={canvasRef}
                width={W * zoom}
                height={H * zoom}
                style={{ cursor: tool==='erase'?'crosshair':tool==='fill'?'cell':'crosshair', display:'block', borderRadius:4 }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              />
            </div>
            <p className="text-xs text-white/30">คลิกหรือลากเพื่อวาด · {W}×{H} pixels</p>

            {/* Color Palette */}
            <div className="w-full rounded-2xl p-4 border border-white/10" style={{ background:'rgba(255,255,255,0.07)' }}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-white/50 font-medium">Palette</p>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded border-2 border-white/30" style={{ background: color }} />
                  <input type="color" value={color} onChange={e => setColor(e.target.value)}
                    className="w-8 h-7 rounded cursor-pointer border-0 bg-transparent" title="Custom color"/>
                  <span className="text-xs text-white/30">Custom</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PALETTE.map((c, i) => (
                  <button key={i} onClick={() => { setColor(c); setTool('paint'); }}
                    className="rounded transition-all hover:scale-125"
                    style={{
                      width:18, height:18,
                      background:c,
                      border: color===c ? '2px solid white' : '1px solid rgba(255,255,255,0.15)',
                      boxShadow: color===c ? '0 0 6px rgba(255,255,255,0.5)' : 'none',
                    }}/>
                ))}
              </div>
            </div>
          </div>

          {/* ─── Right: Preview ─── */}
          <div className="col-span-12 lg:col-span-3 space-y-4">

            {/* Static previews */}
            {[['1×',1],['2×',2],['3×',3],['4×',4]].map(([label,s]) => (
              <div key={label} className="rounded-2xl p-3 border border-white/10 text-center"
                style={{ background:'rgba(255,255,255,0.07)' }}>
                <p className="text-xs text-white/40 mb-2">{label}</p>
                <div className="flex justify-center">
                  <PreviewSprite grid={grid} scale={s}/>
                </div>
              </div>
            ))}

            {/* Animated preview */}
            <div className="rounded-2xl p-4 border border-purple-500/30 text-center"
              style={{ background:'rgba(124,58,237,0.1)' }}>
              <p className="text-xs text-purple-300 mb-3">🏃 Animation Preview</p>
              <div className="flex justify-center items-center" style={{ minHeight:120, background:'rgba(0,0,20,0.5)', borderRadius:8, padding:16 }}>
                <PreviewSprite grid={grid} scale={3} animating/>
              </div>
            </div>

            {/* Info */}
            <div className="rounded-2xl p-3 border border-white/5 text-xs text-white/25"
              style={{ background:'rgba(255,255,255,0.03)' }}>
              <p className="font-medium text-white/40 mb-1">💡 Tips</p>
              <p>• คลิก 🪣 Fill แล้วคลิกพื้นที่เพื่อเติมสีทั้งก้อน</p>
              <p className="mt-1">• อัปโหลดรูปหน้าตัวเองให้ AI แปลงเป็น pixel art</p>
              <p className="mt-1">• ตัวละครจะแสดงใน Leaderboard แทน sprite default</p>
            </div>
          </div>
        </div>
      </main>

      {/* ── AI Preview Modal ── */}
      {previewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background:'rgba(0,0,0,0.8)', backdropFilter:'blur(8px)' }}
          onClick={e => e.target===e.currentTarget && setPreviewModal(null)}>
          <div className="rounded-3xl p-6 border border-white/10 w-full max-w-lg text-white"
            style={{ background:'rgba(15,12,41,0.98)', backdropFilter:'blur(20px)' }}>

            <h3 className="font-bold text-lg mb-1">🤖 ผลลัพธ์การแปลง</h3>
            <p className="text-white/40 text-xs mb-5">ดูตัวอย่างก่อนนำไปใช้</p>

            {/* Previews at multiple scales */}
            <div className="flex items-end justify-center gap-6 mb-5 p-5 rounded-2xl"
              style={{ background:'rgba(0,0,20,0.6)' }}>
              {[['1×',1],['2×',2],['4×',4],['6×',6]].map(([label,s]) => (
                <div key={label} className="text-center">
                  <PreviewSprite grid={previewModal.grid} scale={s} />
                  <p className="text-xs text-white/30 mt-1">{label}</p>
                </div>
              ))}
              <div className="text-center">
                <PreviewSprite grid={previewModal.grid} scale={4} animating />
                <p className="text-xs text-purple-300 mt-1">animate</p>
              </div>
            </div>

            {/* Detected palette */}
            {previewModal.palette && (
              <div className="mb-5">
                <p className="text-xs text-white/40 mb-2">สีที่ตรวจพบ ({previewModal.palette.length} สี)</p>
                <div className="flex flex-wrap gap-1.5">
                  {previewModal.palette.map((c, i) => (
                    <div key={i} title={c}
                      className="rounded border border-white/10"
                      style={{ width:18, height:18, background:c }} />
                  ))}
                </div>
              </div>
            )}

            {/* Re-convert options */}
            <div className="grid grid-cols-2 gap-3 mb-5 p-3 rounded-xl border border-white/10"
              style={{ background:'rgba(255,255,255,0.04)' }}>
              <div className="flex items-center justify-between col-span-2">
                <label className="text-xs text-white/50">ลบพื้นหลัง</label>
                <button onClick={() => {
                    const newOpts = { removeBg: !previewModal.opts.removeBg, numColors: previewModal.opts.numColors };
                    handlePreviewReconvert(newOpts);
                  }}
                  className="w-10 h-5 rounded-full transition-all relative"
                  style={{ background: previewModal.opts.removeBg ? '#7c3aed' : 'rgba(255,255,255,0.15)' }}>
                  <span className="absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all"
                    style={{ left: previewModal.opts.removeBg ? '1.25rem' : '0.125rem' }} />
                </button>
              </div>
              <div className="col-span-2">
                <div className="flex justify-between mb-1">
                  <label className="text-xs text-white/50">จำนวนสี</label>
                  <span className="text-xs text-purple-300">{previewModal.opts.numColors} สี</span>
                </div>
                <input type="range" min={8} max={32}
                  value={previewModal.opts.numColors}
                  onChange={e => handlePreviewReconvert({ ...previewModal.opts, numColors: parseInt(e.target.value) })}
                  className="w-full accent-purple-500" />
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setPreviewModal(null)}
                className="flex-1 py-3 rounded-xl border border-white/10 text-white/50 hover:text-white text-sm transition-colors">
                ❌ ยกเลิก
              </button>
              <button onClick={handlePreviewApply}
                className="flex-1 py-3 rounded-xl font-semibold text-white text-sm hover:scale-[1.02] transition-all"
                style={{ background:'linear-gradient(135deg,#10b981,#059669)' }}>
                ✅ ใช้ตัวละครนี้
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CharacterEditor;
