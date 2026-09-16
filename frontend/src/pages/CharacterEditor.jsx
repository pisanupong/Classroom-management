import React, { useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';

/* ===== SPRITE ENGINE (96×96 per frame) ===== */
const S = 96;
const DIRS = ['down','left','right','up'];
const WALK = [0,1,2,1];

function shade(hex,amt){
  try{
    const n=parseInt(hex.slice(1),16),r=(n>>16)&255,g=(n>>8)&255,b=n&255,f=amt/100;
    const m=v=>Math.max(0,Math.min(255,Math.round(f<0?v*(1+f):v+(255-v)*f)));
    return '#'+[m(r),m(g),m(b)].map(v=>v.toString(16).padStart(2,'0')).join('');
  }catch{return hex;}
}
function mix(a,b,t){
  try{
    const A=parseInt(a.slice(1),16),B=parseInt(b.slice(1),16);
    const c=i=>Math.round((((A>>i)&255)*(1-t))+(((B>>i)&255)*t));
    return '#'+[c(16),c(8),c(0)].map(v=>v.toString(16).padStart(2,'0')).join('');
  }catch{return a;}
}

const POSE={
  front:[
    {head:2,arm:[2,-2],legs:[{dx:0,dh:0},{dx:0,dh:-2}]},
    {head:0,arm:[0,0], legs:[{dx:0,dh:0},{dx:0,dh:0}]},
    {head:2,arm:[-2,2],legs:[{dx:0,dh:-2},{dx:0,dh:0}]}
  ],
  side:[
    {head:2,arm:[5], legs:[{dx:-6,dh:0},{dx:6,dh:-2}]},
    {head:0,arm:[0], legs:[{dx:0,dh:0},{dx:0,dh:0}]},
    {head:2,arm:[-5],legs:[{dx:6,dh:-2},{dx:-6,dh:0}]}
  ]
};

function geom(view,p){
  const side=view==='side';
  const G={view,side,back:view==='back',
    hx:28+(side?2:0),hy:16+p.head,hw:40,hh:38,
    tx:side?36:34,ty:54,tw:side?24:28,th:24};
  G.arms=side
    ?[{x:G.tx+7+p.arm[0],y:56,w:10,h:18,solo:true}]
    :[{x:26,y:56+p.arm[0],w:8,h:18},{x:62,y:56+p.arm[1],w:8,h:18}];
  G.legs=side
    ?[{x:42+p.legs[0].dx,y:78,w:12,h:14+p.legs[0].dh,far:true},
      {x:42+p.legs[1].dx,y:78,w:12,h:14+p.legs[1].dh}]
    :[{x:36+p.legs[0].dx,y:78,w:12,h:14+p.legs[0].dh},
      {x:48+p.legs[1].dx,y:78,w:12,h:14+p.legs[1].dh}];
  return G;
}

function buildFrame(c,dir,f){
  const view=dir===0?'front':dir===3?'back':'side';
  const p=(view==='side'?POSE.side:POSE.front)[f];
  const G=geom(view,p);
  const g=[];
  for(let y=0;y<S;y++) g.push(new Array(S).fill(null));
  function P(x,y,w,h,col){
    if(!col) return;
    for(let j=y;j<y+h;j++){if(j<0||j>=S) continue;
      for(let i=x;i<x+w;i++){if(i<0||i>=S) continue; g[j][i]=col;}}
  }
  drawCape(P,c,G,'back');
  drawBody(P,c,G);
  if(!G.back) drawFace(P,c,G);
  drawBottom(P,c,G);
  drawTop(P,c,G);
  drawShoes(P,c,G);
  drawHair(P,c,G);
  drawCape(P,c,G,'front');
  drawHeadGear(P,c,G);
  drawWeapon(P,c,G);
  outline(g);
  if(dir===1){for(let y=0;y<S;y++) g[y].reverse();}
  return g;
}

function outline(g){
  const add=[];
  for(let y=0;y<S;y++) for(let x=0;x<S;x++){
    if(g[y][x]) continue;
    const n=(y>0&&g[y-1][x])||(y<S-1&&g[y+1][x])||(x>0&&g[y][x-1])||(x<S-1&&g[y][x+1]);
    if(n) add.push([x,y,mix(shade(n,-62),'#150f22',.45)]);
  }
  add.forEach(a=>{ g[a[1]][a[0]]=a[2]; });
}

function drawBody(P,c,G){
  const s=c.skin,d=shade(s,-12),d2=shade(s,-24),hi=shade(s,14);
  G.legs.forEach(L=>{
    const col=L.far?d2:s;
    P(L.x,L.y,L.w,L.h,col);
    P(L.x,L.y,2,L.h,shade(col,-14));
  });
  P(G.tx,G.ty,G.tw,G.th,s);
  P(G.tx+G.tw-3,G.ty,3,G.th,d);
  G.arms.forEach(A=>{
    P(A.x,A.y,A.w,A.h,s);
    P(A.x,A.y+A.h,A.w,6,s);
    P(A.x,A.y,1,A.h+6,shade(s,-18));
    P(A.x+A.w-1,A.y,1,A.h+6,d);
    P(A.x,A.y+A.h+5,1,1,null); P(A.x+A.w-1,A.y+A.h+5,1,1,null);
  });
  P(G.hx,G.hy,G.hw,G.hh,s);
  P(G.hx+G.hw-4,G.hy+2,4,G.hh-4,d);
  P(G.hx+2,G.hy+G.hh-2,G.hw-4,2,d);
  P(G.hx+4,G.hy+2,12,3,hi);
  [[0,0],[1,0],[0,1]].forEach(o=>{
    P(G.hx+o[0],G.hy+o[1],1,1,null); P(G.hx+G.hw-1-o[0],G.hy+o[1],1,1,null);
    P(G.hx+o[0],G.hy+G.hh-1-o[1],1,1,null); P(G.hx+G.hw-1-o[0],G.hy+G.hh-1-o[1],1,1,null);
  });
  if(G.side){
    P(G.hx+G.hw,G.hy+18,2,4,s);
    P(G.hx+12,G.hy+18,4,8,d);
    P(G.hx+13,G.hy+20,2,4,d2);
  }else{
    P(G.hx-2,G.hy+18,2,8,s); P(G.hx+G.hw,G.hy+18,2,8,d);
    P(G.hx-1,G.hy+20,1,4,d2); P(G.hx+G.hw,G.hy+20,1,4,d2);
  }
}

function drawFace(P,c,G){
  const s=c.skin,hx=G.hx,hy=G.hy;
  const lash=mix(shade(c.hairC,-50),'#1a1320',.5);
  const white='#fdfdff',iris=c.eye,irisD=shade(iris,-34),irisL=shade(iris,30);
  const blush=mix(s,'#ff5f6d',.30);
  function eye(ex,ey,look){
    P(ex,ey,10,2,lash);
    P(ex-1,ey+1,1,3,lash); P(ex+10,ey+1,1,3,lash);
    P(ex,ey+2,10,11,white);
    P(ex+2+look,ey+3,6,9,iris);
    P(ex+2+look,ey+3,6,3,irisD);
    P(ex+2+look,ey+9,6,3,irisL);
    P(ex+4+look,ey+5,3,6,'#171021');
    P(ex+2+look,ey+4,3,3,'#ffffff');
    P(ex+6+look,ey+10,2,2,mix(white,iris,.4));
    P(ex,ey+13,10,1,shade(s,-26));
  }
  if(G.side){
    P(hx+16,hy+8,8,2,lash); P(hx+27,hy+8,8,2,lash);
    eye(hx+16,hy+16,2); eye(hx+27,hy+16,2);
    P(hx+28,hy+32,5,2,shade(s,-42)); P(hx+29,hy+34,3,1,mix(shade(s,-42),'#ff8a8a',.35));
    P(hx+12,hy+28,5,4,blush);
  }else{
    P(hx+7,hy+9,9,2,lash); P(hx+24,hy+9,9,2,lash);
    eye(hx+7,hy+16,0); eye(hx+23,hy+16,0);
    P(hx+18,hy+27,3,2,shade(s,-20));
    P(hx+16,hy+31,8,2,shade(s,-42));
    P(hx+18,hy+33,4,1,mix(shade(s,-42),'#ff8a8a',.4));
    P(hx+1,hy+26,5,4,blush); P(hx+34,hy+26,5,4,blush);
  }
}

function drawHair(P,c,G){
  const h=c.hairC,hi=shade(h,26),lo=shade(h,-26),lo2=shade(h,-42);
  const hx=G.hx,hy=G.hy,hw=G.hw,hh=G.hh;
  if(c.hair==='bald'){
    P(hx,hy-3,hw,8,shade(h,-4)); P(hx+4,hy-3,14,2,shade(h,16));
    if(G.back) P(hx-1,hy-3,hw+2,hh,shade(h,-4));
    return;
  }
  if(G.back){
    P(hx-2,hy-9,hw+4,hh+8,h);
    P(hx-2,hy+hh-4,hw+4,5,lo);
    P(hx+5,hy-6,15,4,hi);
    switch(c.hair){
      case 'long': case 'wavy':
        P(hx-5,hy+4,hw+10,50,h); P(hx-5,hy+50,hw+10,5,lo); P(hx+5,hy+55,hw-10,4,lo2); break;
      case 'hime':
        P(hx-5,hy+4,hw+10,42,h); P(hx-5,hy+44,hw+10,4,lo); break;
      case 'twin':
        P(hx-12,hy+10,10,32,lo); P(hx+hw+2,hy+10,10,32,lo);
        P(hx-12,hy+38,10,5,lo2); P(hx+hw+2,hy+38,10,5,lo2); break;
      case 'pony':
        P(hx+14,hy+26,13,36,lo); P(hx+16,hy+58,9,7,lo2); break;
      case 'braid':
        P(hx+15,hy+26,11,10,lo); P(hx+16,hy+35,9,9,lo2);
        P(hx+15,hy+43,11,9,lo); P(hx+17,hy+51,7,8,lo2); break;
      case 'bun':
        P(hx+10,hy-24,20,14,h); P(hx+13,hy-22,8,4,hi); P(hx+8,hy-13,24,5,lo); break;
      case 'mohawk':
        P(hx+13,hy-24,14,28,h); P(hx+16,hy-22,5,13,hi); break;
      case 'spiky':
        P(hx+1,hy-16,8,9,h); P(hx+11,hy-20,10,13,h); P(hx+23,hy-20,10,13,h); P(hx+33,hy-15,7,8,h); break;
      case 'messy':
        P(hx-4,hy-6,7,9,h); P(hx+hw-3,hy-8,8,10,h); P(hx+8,hy-15,9,8,h); P(hx+24,hy-14,8,7,h); break;
    }
    return;
  }
  const napeX=G.side?hx-11:hx+hw-3;
  function cap(top,thick){ P(hx-2,hy-top,hw+4,thick,h); }
  function fringe(){
    P(hx,hy+10,hw,4,h);
    P(hx+2,hy+14,9,5,h); P(hx+15,hy+14,10,7,h); P(hx+29,hy+14,9,5,h);
  }
  function sides(len){ P(hx-2,hy+8,5,len,lo); P(hx+hw-3,hy+8,5,len,lo); }
  function gloss(){ P(hx+4,hy-6,15,3,hi); P(hx+24,hy-5,8,2,hi); }
  function longStrands(len,wide){
    P(hx-6,hy+8,wide,len,lo); P(hx+hw-wide+6,hy+8,wide,len,lo);
    P(hx-6,hy+8+len-4,wide,4,lo2); P(hx+hw-wide+6,hy+8+len-4,wide,4,lo2);
  }
  switch(c.hair){
    case 'short':  cap(9,22); fringe(); sides(14); gloss(); break;
    case 'spiky':
      cap(8,20);
      P(hx+1,hy-16,8,9,h); P(hx+11,hy-20,10,13,h); P(hx+23,hy-20,10,13,h); P(hx+33,hy-15,7,8,h);
      P(hx+13,hy-19,4,7,hi); fringe(); sides(12); break;
    case 'messy':
      cap(10,23);
      P(hx-4,hy-6,7,9,h); P(hx+hw-3,hy-8,8,10,h); P(hx+8,hy-15,9,8,h); P(hx+24,hy-14,8,7,h);
      P(hx,hy+10,hw,5,h); P(hx+3,hy+15,8,7,h); P(hx+16,hy+15,9,5,h); P(hx+28,hy+15,9,8,h);
      sides(15); gloss(); break;
    case 'long':   cap(10,24); fringe(); longStrands(46,8); gloss(); break;
    case 'wavy':
      cap(11,25); P(hx,hy+10,hw,5,h);
      P(hx+2,hy+15,11,6,h); P(hx+17,hy+15,9,8,h); P(hx+28,hy+15,10,6,h);
      longStrands(42,9); P(hx-8,hy+34,9,10,lo); P(hx+hw-1,hy+34,9,10,lo); gloss(); break;
    case 'twin':
      cap(9,22); fringe();
      P(hx-12,hy+12,10,28,lo); P(hx+hw+2,hy+12,10,28,lo);
      P(hx-12,hy+36,10,4,lo2); P(hx+hw+2,hy+36,10,4,lo2);
      P(hx-4,hy+6,7,8,lo); P(hx+hw-3,hy+6,7,8,lo); gloss(); break;
    case 'bun':
      P(hx+10,hy-24,20,14,h); P(hx+13,hy-22,8,4,hi); P(hx+8,hy-13,24,5,lo);
      cap(9,21); fringe(); sides(12); break;
    case 'hime':
      cap(10,24); P(hx,hy+10,hw,7,h); longStrands(40,7); gloss(); break;
    case 'pony':
      cap(9,22); fringe(); sides(12); gloss();
      P(napeX,hy+6,11,30,lo); P(napeX+2,hy+32,8,8,lo2); break;
    case 'braid':
      cap(9,22); fringe(); sides(13); gloss();
      P(napeX,hy+10,10,10,lo); P(napeX+1,hy+19,8,9,lo2);
      P(napeX,hy+27,10,9,lo); P(napeX+2,hy+35,6,8,lo2); break;
    case 'mohawk':
      P(hx+13,hy-24,14,32,h); P(hx+16,hy-22,5,13,hi);
      P(hx+11,hy-4,18,14,h);
      P(hx,hy+2,hw,8,shade(h,-14)); P(hx,hy+10,hw,3,lo); break;
  }
}

function drawTop(P,c,G){
  const a=c.topC,a2=shade(a,-24),a3=shade(a,-40),ah=shade(a,18),b=c.topC2;
  const T=(x,y,w,h,col)=>P(G.tx+x,G.ty+y,w,h,col);
  const SL=(len,col,pad)=>{ pad=pad||0; G.arms.forEach(A=>P(A.x-pad,A.y,A.w+pad*2,len,col||a)); };
  const seam=()=>G.arms.forEach(A=>P(A.x+(A.x<G.tx?A.w-1:0),A.y,1,A.h,a3));
  const fold=y=>T(2,y,G.tw-4,1,a2);
  const mid=Math.floor(G.tw/2);
  switch(c.top){
    case 'tunic':
      T(0,0,G.tw,24,a); T(0,0,2,24,ah); T(G.tw-3,0,3,24,a2); SL(13); seam(); fold(17);
      if(!G.back){ T(mid-4,0,8,7,b); T(mid-1,0,2,9,a2); } break;
    case 'adv':
      T(0,0,G.tw,24,a); T(G.tw-3,0,3,24,a2); SL(16); seam();
      T(4,0,4,24,b); T(G.tw-8,0,4,24,b);
      T(0,16,G.tw,4,shade(b,-22)); T(mid-2,16,4,4,shade(b,26));
      if(!G.back) T(mid-3,0,6,5,a2); break;
    case 'plate':
      T(0,0,G.tw,24,a); T(0,0,2,24,ah); T(G.tw-3,0,3,24,a2); SL(18);
      G.arms.forEach(A=>{ P(A.x-2,A.y-2,A.w+4,9,ah); P(A.x-2,A.y+5,A.w+4,2,a2); });
      if(!G.back){ T(mid-2,2,4,20,b); T(2,3,G.tw-4,2,ah); T(3,10,3,2,ah); T(G.tw-6,10,3,2,ah); }
      T(0,20,G.tw,2,a3); break;
    case 'robe':
      P(G.tx-3,G.ty,G.tw+6,30,a); P(G.tx-3,G.ty,2,30,ah); P(G.tx+G.tw+1,G.ty,2,30,a2);
      SL(22,a,3);
      if(!G.back){ T(mid-2,0,4,30,b); T(mid-2,0,4,2,shade(b,30)); }
      T(-2,26,G.tw+4,4,a2); fold(14); break;
    case 'rogue':
      T(0,0,G.tw,24,a); SL(20); seam();
      T(3,1,G.tw-6,23,b); T(3,1,2,23,shade(b,-26)); T(G.tw-5,1,2,23,shade(b,-30));
      T(0,17,G.tw,3,a3);
      if(!G.back) T(mid-1,5,3,3,shade(b,30)); break;
    case 'priest':
      P(G.tx-2,G.ty,G.tw+4,27,a); SL(20,a,2);
      if(!G.back){ T(2,0,4,27,b); T(G.tw-6,0,4,27,b); T(mid-3,0,6,4,shade(a,-16)); }
      T(-2,24,G.tw+4,3,a2); break;
    case 'noble':
      T(0,0,G.tw,25,a); T(G.tw-3,0,3,25,a2); SL(17); seam();
      if(!G.back){ T(mid-5,0,10,25,b); T(mid-1,3,2,2,shade(b,40)); T(mid-1,10,2,2,shade(b,40)); T(mid-1,17,2,2,shade(b,40)); }
      G.arms.forEach(A=>P(A.x,A.y+14,A.w,3,b));
      T(0,0,G.tw,2,ah); break;
    case 'ninja':
      T(0,0,G.tw,24,a); SL(21); seam();
      T(0,14,G.tw,5,b); T(mid-2,14,4,5,shade(b,-28));
      G.arms.forEach(A=>P(A.x,A.y+12,A.w,5,b));
      if(!G.back) T(mid-4,0,8,14,a2); break;
    case 'kimono':
      P(G.tx-2,G.ty,G.tw+4,28,a); SL(23,a,3);
      if(!G.back){ T(mid-10,0,10,20,shade(a,10)); T(mid,0,10,20,a2); T(mid-1,0,3,20,b); }
      T(-2,20,G.tw+4,6,b); T(-2,25,G.tw+4,2,shade(b,-28)); break;
    case 'pirate':
      T(0,0,G.tw,24,a); T(G.tw-3,0,3,24,a2); SL(19); seam();
      if(!G.back){ T(mid-4,0,8,13,'#f2ead6'); T(mid-1,2,2,11,shade('#f2ead6',-22)); }
      T(0,16,G.tw,4,b); T(mid-2,16,4,4,shade(b,30));
      G.arms.forEach(A=>P(A.x-1,A.y+13,A.w+2,4,'#f2ead6')); break;
  }
}

function drawBottom(P,c,G){
  const p=c.botC,p2=shade(p,-26),ph=shade(p,16),bl=c.beltC;
  P(G.tx,74,G.tw,5,bl); P(G.tx,78,G.tw,1,shade(bl,-30));
  P(G.tx+Math.floor(G.tw/2)-3,73,6,6,shade(bl,26));
  P(G.tx+Math.floor(G.tw/2)-2,75,4,3,shade(bl,-34));
  function legs(len){
    G.legs.forEach(L=>{
      const col=L.far?p2:p;
      const hgt=len===undefined?L.h+1:Math.min(len,L.h+1);
      P(L.x,78,L.w,hgt,col);
      P(L.x,78,2,hgt,L.far?shade(p2,-12):ph);
      P(L.x+L.w-1,78,1,hgt,shade(col,-22));
    });
  }
  switch(c.bottom){
    case 'pants': legs(); break;
    case 'shorts': legs(8); break;
    case 'skirt':
      P(G.tx-2,76,G.tw+4,8,p); P(G.tx-5,81,G.tw+10,6,p);
      P(G.tx-5,85,G.tw+10,2,p2); P(G.tx-2,77,3,9,ph); break;
    case 'hakama':
      P(G.tx-3,76,G.tw+6,8,p);
      G.legs.forEach(L=>P(L.x-2,82,L.w+4,L.h-2,L.far?p2:p));
      P(G.tx-3,76,G.tw+6,2,ph); break;
    case 'greaves':
      legs();
      G.legs.forEach(L=>{
        const m=L.far?shade(bl,-24):shade(bl,-6);
        P(L.x-1,84,L.w+2,L.h-6,m); P(L.x-1,84,L.w+2,2,shade(m,30));
        P(L.x-1,90,L.w+2,1,shade(m,-30));
      }); break;
    case 'sash':
      legs(); P(G.tx-1,72,G.tw+2,7,bl); P(G.tx-1,77,G.tw+2,2,shade(bl,-28));
      if(!G.back) P(G.tx+3,79,6,14,shade(bl,-10)); break;
  }
}

function drawShoes(P,c,G){
  const s=c.shoeC;
  G.legs.forEach(L=>{
    const by=L.y+L.h,col=L.far?shade(s,-26):s;
    const hi=shade(col,24),dk=shade(col,-34);
    if(c.shoes==='boot'){ P(L.x-2,by-7,L.w+4,9,col); P(L.x-2,by-7,L.w+4,2,hi); P(L.x-2,by+1,L.w+4,1,dk); }
    if(c.shoes==='tall'){ P(L.x-2,by-16,L.w+4,18,col); P(L.x-2,by-16,L.w+4,2,hi);
      P(L.x-2,by-6,L.w+4,2,shade(col,-18)); P(L.x-2,by+1,L.w+4,1,dk); }
    if(c.shoes==='iron'){ P(L.x-3,by-11,L.w+6,13,col); P(L.x-3,by-11,L.w+6,2,hi);
      P(L.x-3,by-5,L.w+6,2,hi); P(L.x-3,by+1,L.w+6,1,dk); }
    if(c.shoes==='cloth'){ P(L.x-1,by-5,L.w+2,7,col); P(L.x-1,by-5,L.w+2,1,hi); }
    if(c.shoes==='sandal'){ P(L.x-1,by-1,L.w+2,3,col); P(L.x+2,by-6,3,6,col); }
  });
}

function drawHeadGear(P,c,G){
  if(c.head==='none') return;
  const a=c.headC,a2=shade(a,-28),hi=shade(a,26);
  const hx=G.hx,hy=G.hy,hw=G.hw,mid=Math.floor(hw/2);
  switch(c.head){
    case 'helm':
      P(hx-3,hy-10,hw+6,24,a); P(hx+3,hy-9,14,3,hi);
      P(hx-3,hy+12,6,20,a); P(hx+hw-3,hy+12,6,20,a);
      P(hx-3,hy+11,hw+6,3,a2);
      if(!G.back) P(hx+mid-2,hy-14,4,26,hi);
      if(G.back) P(hx-3,hy-10,hw+6,44,a); break;
    case 'hood':
      P(hx-5,hy-11,hw+10,26,a); P(hx-5,hy+13,8,26,a); P(hx+hw-3,hy+13,8,26,a);
      P(hx-5,hy+11,hw+10,3,a2);
      P(G.tx-4,G.ty-4,G.tw+8,11,a); P(G.tx-4,G.ty+5,G.tw+8,2,a2);
      if(G.back) P(hx-5,hy-11,hw+10,50,a); break;
    case 'crown':
      P(hx+2,hy-14,hw-4,7,a); P(hx+2,hy-14,hw-4,2,hi);
      P(hx+4,hy-21,5,8,a); P(hx+mid-3,hy-24,6,11,a); P(hx+hw-9,hy-21,5,8,a);
      P(hx+mid-2,hy-11,4,4,'#e8465e'); P(hx+mid-2,hy-11,2,2,'#ff97a6'); break;
    case 'wizhat':
      P(hx-13,hy-6,hw+26,6,a); P(hx-13,hy-1,hw+26,2,a2);
      P(hx+3,hy-14,34,9,a); P(hx+7,hy-24,26,11,a); P(hx+12,hy-33,17,10,a);
      P(hx+16,hy-40,10,8,a); P(hx+19,hy-44,6,5,a);
      P(hx+3,hy-14,34,2,hi); P(hx+9,hy-22,5,8,hi);
      P(hx-13,hy-8,hw+26,3,shade(a,-14)); break;
    case 'band':
      P(hx-3,hy+7,hw+6,6,a); P(hx-3,hy+7,hw+6,2,hi);
      if(!G.back){ P(hx+hw+2,hy+9,6,16,a); P(hx+hw+4,hy+9,2,20,a2); } break;
    case 'straw':
      P(hx-15,hy-4,hw+30,7,a); P(hx-15,hy+2,hw+30,2,a2);
      P(hx-4,hy-14,hw+8,11,a); P(hx+2,hy-13,12,3,hi);
      P(hx-15,hy-1,hw+30,1,shade(a,-16)); break;
    case 'horn':
      P(hx-3,hy-9,hw+6,20,a); P(hx-3,hy+9,hw+6,3,a2);
      P(hx-10,hy-18,7,14,'#efe6d2'); P(hx-12,hy-24,6,8,'#efe6d2');
      P(hx+hw+3,hy-18,7,14,'#efe6d2'); P(hx+hw+6,hy-24,6,8,'#efe6d2');
      P(hx+3,hy-8,12,3,hi); break;
    case 'mask':
      if(G.back) break;
      P(hx+2,hy+26,hw-4,14,a); P(hx+2,hy+26,hw-4,2,hi);
      P(hx,hy+28,3,6,a2); P(hx+hw-3,hy+28,3,6,a2); break;
  }
}

function drawCape(P,c,G,layer){
  if(c.cape==='none') return;
  const a=c.capeC,a2=shade(a,-26),hi=shade(a,20);
  const wantBack=!G.back;
  if((layer==='back')!==wantBack) return;
  if(c.cape==='cape'){
    P(G.tx-6,G.ty-2,G.tw+12,34,a);
    P(G.tx-6,G.ty-2,G.tw+12,4,hi);
    P(G.tx-6,G.ty+28,G.tw+12,4,a2);
    P(G.tx-3,G.ty+32,G.tw+6,4,a2);
    P(G.tx+2,G.ty+36,G.tw-4,3,shade(a,-38));
    P(G.tx+Math.floor(G.tw/2)-1,G.ty+2,2,30,a2);
  }else if(c.cape==='mantle'){
    P(G.tx-6,G.ty-2,G.tw+12,15,a);
    P(G.tx-6,G.ty-2,G.tw+12,3,hi);
    P(G.tx-6,G.ty+11,G.tw+12,3,a2);
  }else{
    P(G.tx-3,G.ty-4,G.tw+6,8,a); P(G.tx-3,G.ty-4,G.tw+6,2,hi);
    if(!G.back) P(G.tx+G.tw-4,G.ty+4,7,20,a2);
  }
}

function drawWeapon(P,c,G){
  if(c.weapon==='none') return;
  const steel='#d3dae8',steelD='#8a94a9',steelH='#f2f5fb',wood='#6b4227',woodD='#4a2c19';
  const w=c.wepC;
  const A=G.arms[G.arms.length-1];
  const rx=A.x+Math.floor(A.w/2),ry=A.y+A.h+3;
  const L=G.arms[0];
  const lx=L.x+Math.floor(L.w/2);
  switch(c.weapon){
    case 'sword':
      P(rx+3,ry-40,7,40,steel); P(rx+3,ry-40,2,40,steelH); P(rx+8,ry-38,2,38,steelD);
      P(rx+4,ry-44,5,5,steel);
      P(rx-2,ry-3,17,4,w); P(rx-2,ry-3,17,2,shade(w,26));
      P(rx+4,ry+1,5,11,woodD); P(rx+3,ry+12,7,4,w); break;
    case 'katana':
      P(rx+3,ry-42,5,42,steel); P(rx+3,ry-42,2,42,steelH);
      P(rx+1,ry-3,9,3,shade(w,-20));
      P(rx+4,ry,4,14,'#1c1a24'); P(rx+4,ry+4,4,2,w); P(rx+4,ry+9,4,2,w); break;
    case 'dagger':
      P(rx+3,ry-18,6,18,steel); P(rx+3,ry-18,2,18,steelH);
      P(rx,ry-2,12,3,w); P(rx+4,ry+1,4,9,woodD); break;
    case 'spear':
      P(rx+4,ry-46,4,58,wood); P(rx+4,ry-46,1,58,shade(wood,22));
      P(rx+2,ry-58,8,13,steel); P(rx+4,ry-62,4,5,steel); P(rx+2,ry-58,2,13,steelH);
      P(rx+1,ry-46,10,3,w); break;
    case 'axe':
      P(rx+4,ry-38,5,50,wood); P(rx+4,ry-38,1,50,shade(wood,20));
      P(rx-4,ry-40,18,14,steel); P(rx-4,ry-40,18,3,steelH);
      P(rx-6,ry-36,3,7,steel); P(rx+9,ry-30,5,4,steelD);
      P(rx+2,ry-40,9,14,steelD); break;
    case 'staff':
      P(rx+4,ry-50,5,62,wood); P(rx+4,ry-50,1,62,shade(wood,22));
      P(rx+1,ry-58,11,10,shade(w,-18)); P(rx+2,ry-62,9,6,w);
      P(rx+3,ry-60,4,4,shade(w,48)); P(rx+2,ry-49,9,3,shade(w,-34)); break;
    case 'bow':
      P(rx+8,ry-38,5,46,wood); P(rx+8,ry-38,2,46,shade(wood,20));
      P(rx+4,ry-44,6,7,wood); P(rx+4,ry+7,6,7,wood);
      P(rx+3,ry-42,2,52,'#e8e2cf'); break;
    case 'tome':
      P(rx-2,ry-14,16,20,w); P(rx-2,ry-14,16,3,shade(w,26));
      P(rx+1,ry-11,10,14,'#f2ead6'); P(rx+5,ry-11,2,14,shade('#f2ead6',-24));
      P(rx+11,ry-14,3,20,shade(w,-30)); break;
    case 'shield':
      P(lx-12,G.ty+2,17,28,w); P(lx-12,G.ty+2,17,4,shade(w,28));
      P(lx-12,G.ty+26,17,4,shade(w,-26));
      P(lx-8,G.ty+9,9,12,shade(w,-34)); P(lx-6,G.ty+11,5,8,shade(w,20));
      P(lx-12,G.ty+2,3,28,shade(w,14)); break;
  }
}

function paintGrid(ctx,grid,scale,ox,oy,cropx,cropy,cw,ch){
  ox=ox||0;oy=oy||0;cropx=cropx||0;cropy=cropy||0;
  cw=cw||grid[0].length;ch=ch||grid.length;
  for(let y=0;y<ch;y++){
    const row=grid[cropy+y]; if(!row) continue;
    for(let x=0;x<cw;x++){
      const col=row[cropx+x]; if(!col) continue;
      ctx.fillStyle=col; ctx.fillRect(ox+x*scale,oy+y*scale,scale,scale);
    }
  }
}

function frameCanvas(cv,grid,scale,crop){
  crop=crop||{x:0,y:0,w:S,h:S};
  cv.width=crop.w*scale; cv.height=crop.h*scale;
  const ctx=cv.getContext('2d');
  ctx.imageSmoothingEnabled=false;
  ctx.clearRect(0,0,cv.width,cv.height);
  paintGrid(ctx,grid,scale,0,0,crop.x,crop.y,crop.w,crop.h);
}

function sheetGrid(c){
  const g=[];
  for(let y=0;y<S*4;y++) g.push(new Array(S*3).fill(null));
  for(let d=0;d<4;d++) for(let f=0;f<3;f++){
    const fr=buildFrame(c,d,f);
    for(let y=0;y<S;y++) for(let x=0;x<S;x++) g[d*S+y][f*S+x]=fr[y][x];
  }
  return g;
}

function gridToCanvas(grid,scale){
  const cv=document.createElement('canvas');
  cv.width=grid[0].length*scale; cv.height=grid.length*scale;
  const ctx=cv.getContext('2d'); ctx.imageSmoothingEnabled=false;
  paintGrid(ctx,grid,scale);
  return cv;
}

function safeName(n){ return String(n||'actor').replace(/[^\w฀-๿-]/g,'_'); }
function download(cv,name){
  const a=document.createElement('a');
  a.download=name; a.href=cv.toDataURL('image/png'); a.click();
}
function hashId(c){
  const s=JSON.stringify(c),h=s.split('').reduce((a,ch)=>(a*31+ch.charCodeAt(0))>>>0,0);
  return String(h%1000000).padStart(6,'0');
}

/* ===== CONSTANTS ===== */
const PARTS={
  hair:[['short','สั้น'],['spiky','หนามตั้ง'],['messy','รุงรัง'],['long','ยาวสลวย'],['wavy','ลอนสลวย'],['twin','ทวินเทล'],
        ['pony','หางม้า'],['braid','ผมเปีย'],['bun','มวยผม'],['hime','ผมม้าตรง'],['mohawk','โมฮอว์ก'],['bald','โล้น']],
  top:[['tunic','เสื้อชาวบ้าน'],['adv','ชุดผจญภัย'],['plate','เกราะอัศวิน'],['robe','คลุมนักเวท'],['rogue','ชุดโจร'],
       ['priest','ชุดนักบวช'],['noble','ชุดขุนนาง'],['ninja','ชุดนินจา'],['kimono','กิโมโน'],['pirate','ชุดโจรสลัด']],
  bottom:[['pants','กางเกงผ้า'],['shorts','ขาสั้น'],['skirt','กระโปรง'],['hakama','ฮากามะ'],['greaves','เกราะขา'],['sash','ผ้าคาดเอว']],
  shoes:[['boot','บูทหนัง'],['tall','บูทยาว'],['iron','รองเท้าเหล็ก'],['cloth','รองเท้าผ้า'],['sandal','รองเท้าแตะ']],
  head:[['none','ไม่สวม'],['helm','หมวกเหล็ก'],['hood','ฮู้ด'],['crown','มงกุฎ'],['wizhat','หมวกพ่อมด'],
        ['band','ผ้าคาดหัว'],['straw','หมวกฟาง'],['horn','หมวกเขา'],['mask','ผ้าปิดหน้า']],
  weapon:[['none','มือเปล่า'],['sword','ดาบยาว'],['katana','คาตานะ'],['dagger','มีดสั้น'],['spear','หอก'],
          ['axe','ขวานรบ'],['staff','ไม้เท้า'],['bow','ธนู'],['tome','ตำราเวท'],['shield','โล่']],
  cape:[['none','ไม่สวม'],['cape','ผ้าคลุมยาว'],['mantle','ผ้าคลุมไหล่'],['scarf','ผ้าพันคอ']]
};
const SKIN_TONES=['#ffe0c0','#f8cda2','#eab98d','#dba272','#c68a55','#a86b3d','#87512e','#5f3520'];
const HAIR_TONES=['#171620','#2c1f19','#46291a','#6b4227','#8d5c30','#b3823f','#dcb96d','#f3e5b8',
                  '#8f2020','#c3462b','#26406e','#3f7fc4','#1f7d5c','#5f2f9c','#dfe3ee','#ef79b4'];
const EYE_TONES=['#3a2414','#5a3a1e','#1f5a96','#2c7d5e','#6c3fbf','#8a1f1f','#3f4350','#0e8f92'];
const CLOTH=['#f2ead6','#d9c9a3','#b99a63','#8d6a3c','#664325','#432a17',
             '#dfe3ee','#98a2b8','#6a7488','#414a5e','#252b3b','#12141d',
             '#2f5fa8','#1c3f7a','#2f8f8a','#2e7d4f','#4f8f2a','#7f2a2a',
             '#a63030','#d97a1e','#e2b53c','#6b2fa0','#a45cd4','#c0567f'];
const CROP={
  hair:{x:12,y:0,w:72,h:62},head:{x:10,y:0,w:76,h:62},
  top:{x:10,y:38,w:76,h:50},cape:{x:8,y:36,w:80,h:56},
  bottom:{x:20,y:60,w:56,h:36},shoes:{x:20,y:68,w:56,h:28},
  weapon:{x:16,y:12,w:80,h:84}
};
const CATS=[
  {id:'face', ic:'🙂',name:'ผิว·ตา', part:null,   pal:[['skin','สีผิว',SKIN_TONES],['eye','สีดวงตา',EYE_TONES]]},
  {id:'hair', ic:'💇',name:'ทรงผม',  part:'hair',  pal:[['hairC','สีผม',HAIR_TONES]]},
  {id:'top',  ic:'👕',name:'ชุด',    part:'top',   pal:[['topC','สีหลัก',CLOTH],['topC2','สีรอง',CLOTH]]},
  {id:'bottom',ic:'👖',name:'ท่อนล่าง',part:'bottom',pal:[['botC','สีท่อนล่าง',CLOTH],['beltC','สีเข็มขัด',CLOTH]]},
  {id:'shoes',ic:'👢',name:'รองเท้า',part:'shoes', pal:[['shoeC','สีรองเท้า',CLOTH]]},
  {id:'head', ic:'⛑️',name:'สวมหัว', part:'head',  pal:[['headC','สีของสวมหัว',CLOTH]]},
  {id:'weapon',ic:'⚔️',name:'อาวุธ', part:'weapon',pal:[['wepC','สีด้าม·คริสตัล',CLOTH]]},
  {id:'cape', ic:'🧣',name:'ผ้าคลุม',part:'cape',  pal:[['capeC','สีผ้าคลุม',CLOTH]]}
];
const DEFAULT_CFG={
  name:'ตัวละครใหม่',skin:'#f8cda2',eye:'#3a2414',
  hair:'short',hairC:'#46291a',
  top:'tunic',topC:'#2e7d4f',topC2:'#d9c9a3',
  bottom:'pants',botC:'#664325',beltC:'#432a17',
  shoes:'boot',shoeC:'#432a17',
  head:'none',headC:'#98a2b8',
  weapon:'none',wepC:'#8d6a3c',
  cape:'none',capeC:'#7f2a2a',
  anim:'walk',dir:0,zoom:3,speed:6
};
const PRESETS=[
  ['🗡️','นักดาบ',{hair:'spiky',hairC:'#46291a',top:'adv',topC:'#8d6a3c',topC2:'#a63030',bottom:'pants',botC:'#432a17',beltC:'#252b3b',shoes:'boot',shoeC:'#432a17',head:'band',headC:'#a63030',weapon:'sword',wepC:'#8d6a3c',cape:'none'}],
  ['🛡️','อัศวิน',{skin:'#eab98d',hair:'short',hairC:'#171620',top:'plate',topC:'#98a2b8',topC2:'#2f5fa8',bottom:'greaves',botC:'#414a5e',beltC:'#b99a63',shoes:'iron',shoeC:'#6a7488',head:'helm',headC:'#98a2b8',weapon:'shield',wepC:'#2f5fa8',cape:'cape',capeC:'#1c3f7a'}],
  ['🔮','นักเวท',{skin:'#ffe0c0',hair:'long',hairC:'#5f2f9c',top:'robe',topC:'#6b2fa0',topC2:'#e2b53c',bottom:'skirt',botC:'#6b2fa0',beltC:'#e2b53c',shoes:'cloth',shoeC:'#432a17',head:'wizhat',headC:'#6b2fa0',weapon:'staff',wepC:'#2f8f8a',cape:'none'}],
  ['🏹','นักธนู',{skin:'#dba272',hair:'twin',hairC:'#8d5c30',top:'adv',topC:'#2e7d4f',topC2:'#664325',bottom:'pants',botC:'#664325',beltC:'#432a17',shoes:'boot',shoeC:'#432a17',head:'hood',headC:'#2e7d4f',weapon:'bow',wepC:'#8d6a3c',cape:'mantle',capeC:'#2e7d4f'}],
  ['🥷','นินจา',{skin:'#c68a55',hair:'messy',hairC:'#171620',top:'ninja',topC:'#252b3b',topC2:'#7f2a2a',bottom:'pants',botC:'#12141d',beltC:'#7f2a2a',shoes:'cloth',shoeC:'#12141d',head:'mask',headC:'#252b3b',weapon:'dagger',wepC:'#7f2a2a',cape:'scarf',capeC:'#7f2a2a'}],
  ['✨','นักบวช',{skin:'#ffe0c0',hair:'hime',hairC:'#dcb96d',top:'priest',topC:'#f2ead6',topC2:'#2f5fa8',bottom:'skirt',botC:'#f2ead6',beltC:'#e2b53c',shoes:'cloth',shoeC:'#d9c9a3',head:'none',headC:'#98a2b8',weapon:'tome',wepC:'#e2b53c',cape:'none'}],
  ['⛩️','ซามูไร',{skin:'#eab98d',hair:'bun',hairC:'#2c1f19',top:'kimono',topC:'#7f2a2a',topC2:'#b99a63',bottom:'hakama',botC:'#252b3b',beltC:'#b99a63',shoes:'sandal',shoeC:'#664325',head:'none',headC:'#98a2b8',weapon:'katana',wepC:'#e2b53c',cape:'none'}],
  ['👑','เจ้าหญิง',{skin:'#ffe0c0',hair:'wavy',hairC:'#b3823f',top:'noble',topC:'#c0567f',topC2:'#f2ead6',bottom:'skirt',botC:'#c0567f',beltC:'#e2b53c',shoes:'cloth',shoeC:'#f2ead6',head:'crown',headC:'#e2b53c',weapon:'none',wepC:'#e2b53c',cape:'cape',capeC:'#a45cd4'}],
  ['🏴‍☠️','โจรสลัด',{skin:'#c68a55',hair:'mohawk',hairC:'#c3462b',top:'pirate',topC:'#7f2a2a',topC2:'#e2b53c',bottom:'shorts',botC:'#252b3b',beltC:'#432a17',shoes:'tall',shoeC:'#432a17',head:'straw',headC:'#b99a63',weapon:'axe',wepC:'#664325',cape:'none'}],
  ['🐗','นักรบเผ่า',{skin:'#a86b3d',hair:'braid',hairC:'#dfe3ee',top:'tunic',topC:'#664325',topC2:'#b99a63',bottom:'sash',botC:'#432a17',beltC:'#b99a63',shoes:'boot',shoeC:'#432a17',head:'horn',headC:'#98a2b8',weapon:'spear',wepC:'#664325',cape:'mantle',capeC:'#8d6a3c'}],
  ['🌾','ชาวบ้าน',{skin:'#dba272',hair:'short',hairC:'#8d5c30',top:'tunic',topC:'#d9c9a3',topC2:'#8d6a3c',bottom:'pants',botC:'#8d6a3c',beltC:'#664325',shoes:'cloth',shoeC:'#664325',head:'straw',headC:'#d9c9a3',weapon:'none',wepC:'#8d6a3c',cape:'none'}],
  ['🎩','ขุนนาง',{skin:'#f8cda2',hair:'pony',hairC:'#171620',top:'noble',topC:'#252b3b',topC2:'#e2b53c',bottom:'pants',botC:'#252b3b',beltC:'#e2b53c',shoes:'tall',shoeC:'#12141d',head:'none',headC:'#98a2b8',weapon:'dagger',wepC:'#e2b53c',cape:'cape',capeC:'#7f2a2a'}]
];

/* ===== Sub-components ===== */
const ItemPreview = React.memo(function ItemPreview({cfg, part, value, crop}){
  const ref = useRef(null);
  useEffect(()=>{
    if(!ref.current) return;
    try{
      const prev={...cfg,[part]:value};
      frameCanvas(ref.current, buildFrame(prev,0,1), 1, crop);
    }catch{}
  },[cfg,part,value]);
  return <canvas ref={ref} style={{imageRendering:'pixelated',display:'block',maxWidth:'100%'}} />;
});

const SlotPreview = React.memo(function SlotPreview({c}){
  const ref = useRef(null);
  useEffect(()=>{
    if(!ref.current||!c) return;
    try{ frameCanvas(ref.current, buildFrame(c,0,1), 1); }catch{}
  },[c]);
  return <canvas ref={ref} style={{imageRendering:'pixelated',display:'block',width:72,height:72}} />;
});

/* ===== MAIN COMPONENT ===== */
const CharacterEditor = () => {
  const { user, updateUser } = useContext(AuthContext);
  const navigate = useNavigate();

  const [cfg, setCfg] = useState(()=>({...DEFAULT_CFG}));
  const [cat, setCat] = useState('hair');
  const [tick, setTick] = useState(0);
  const [roster, setRoster] = useState([]);
  const [saving, setSaving] = useState(false);
  const [flashMsg, setFlashMsg] = useState('');

  const heroRef = useRef(null);
  const sheetRef = useRef(null);
  const tickRef = useRef(0);
  const loopRef = useRef(null);

  // โหลดตัวละครที่บันทึกไว้ครั้งเดียวตอนที่ข้อมูลผู้ใช้มาถึง
  // (ถ้าผูกกับ user ทั้งก้อน การอัปเดต context หลังบันทึกจะเขียนทับสิ่งที่กำลังแก้อยู่)
  const loadedCfg = useRef(false);
  useEffect(()=>{
    if(loadedCfg.current) return;
    if(user?.character_data && user.character_data.skin){
      loadedCfg.current = true;
      setCfg(prev=>({...DEFAULT_CFG,...user.character_data,anim:prev.anim,dir:prev.dir,zoom:prev.zoom,speed:prev.speed}));
    }
  },[user]);

  useEffect(()=>{
    if(!heroRef.current) return;
    try{
      const frame = cfg.anim==='walk' ? WALK[tick%4] : 1;
      frameCanvas(heroRef.current, buildFrame(cfg,cfg.dir,frame), cfg.zoom);
    }catch{}
  },[cfg,tick]);

  useEffect(()=>{
    if(!sheetRef.current) return;
    try{
      const g=sheetGrid(cfg);
      sheetRef.current.width=S*3; sheetRef.current.height=S*4;
      const ctx=sheetRef.current.getContext('2d');
      ctx.imageSmoothingEnabled=false;
      ctx.clearRect(0,0,sheetRef.current.width,sheetRef.current.height);
      paintGrid(ctx,g,1);
      ctx.strokeStyle='rgba(146,118,224,.30)'; ctx.lineWidth=1;
      for(let i=1;i<3;i++){ ctx.beginPath();ctx.moveTo(i*S+.5,0);ctx.lineTo(i*S+.5,sheetRef.current.height);ctx.stroke(); }
      for(let j=1;j<4;j++){ ctx.beginPath();ctx.moveTo(0,j*S+.5);ctx.lineTo(sheetRef.current.width,j*S+.5);ctx.stroke(); }
    }catch{}
  },[cfg]);

  useEffect(()=>{
    if(loopRef.current) clearInterval(loopRef.current);
    if(cfg.anim!=='walk') return;
    loopRef.current=setInterval(()=>{ tickRef.current++; setTick(tickRef.current); },1000/cfg.speed);
    return ()=>clearInterval(loopRef.current);
  },[cfg.anim,cfg.speed]);

  useEffect(()=>{
    const map={ArrowDown:0,ArrowLeft:1,ArrowRight:2,ArrowUp:3};
    const handler=e=>{
      if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA') return;
      if(map[e.key]!==undefined){ e.preventDefault(); setCfg(c=>({...c,dir:map[e.key]})); }
    };
    window.addEventListener('keydown',handler);
    return ()=>window.removeEventListener('keydown',handler);
  },[]);

  const update = useCallback((key,val)=>setCfg(c=>({...c,[key]:val})),[]);

  const showFlash = (msg,ms=2000)=>{ setFlashMsg(msg); setTimeout(()=>setFlashMsg(''),ms); };

  const handleSave = async ()=>{
    setSaving(true);
    try{
      const payload={...cfg};
      delete payload.anim; delete payload.dir; delete payload.zoom; delete payload.speed;
      const res = await api.put('/users/me/character', payload);
      // อัปเดต user ใน context ทันที เพื่อให้หน้าอื่น (แดชบอร์ด/แชท/อันดับ) เห็นตัวละครใหม่เลย
      loadedCfg.current = true;
      updateUser?.({ character_data: res?.data?.character_data ?? payload });
      showFlash('บันทึกสำเร็จ ✅');
    }catch(err){
      console.error('save character failed:', err);
      const st = err?.response?.status;
      const msg = st === 401 || st === 403 ? 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่ ❌'
        : st ? `บันทึกไม่สำเร็จ (${st}) ${err?.response?.data?.message || ''} ❌`
        : `เชื่อมต่อเซิร์ฟเวอร์ไม่ได้: ${err?.message || 'unknown'} ❌`;
      showFlash(msg, 6000);
    }
    finally{ setSaving(false); }
  };

  const activeCat = CATS.find(c=>c.id===cat);

  const css=`
    .ce-root{--void:#0a0812;--panel-a:rgba(37,30,66,.86);--panel-b:rgba(16,12,32,.92);--line:rgba(146,118,224,.20);--ink:#eee8ff;--muted:#8d83bc;--dim:#6d6499;--brass:#d9a441;--ember:#c96a2b;color:var(--ink);font-family:"Noto Sans Thai","Sarabun",system-ui,sans-serif;min-height:100vh;background:radial-gradient(900px 620px at 16% -8%,rgba(168,85,247,.18),transparent 62%),radial-gradient(760px 480px at 90% 6%,rgba(217,164,65,.12),transparent 64%),var(--void);}
    .ce-topbar{display:flex;align-items:center;gap:18px;padding:13px 22px;border-bottom:1px solid var(--line);background:linear-gradient(180deg,rgba(22,17,48,.96),rgba(12,9,26,.72));position:sticky;top:0;z-index:20;backdrop-filter:blur(8px);}
    .ce-back{color:var(--muted);font-size:13px;background:none;border:none;cursor:pointer;}
    .ce-back:hover{color:var(--ink);}
    .ce-brand-mark{font-weight:800;font-size:17px;letter-spacing:.13em;text-transform:uppercase;background:linear-gradient(92deg,var(--brass),var(--ember));-webkit-background-clip:text;background-clip:text;color:transparent;}
    .ce-brand-sub{font-size:12.5px;color:var(--muted);margin-left:10px;}
    .ce-btn{border:0;cursor:pointer;font-family:inherit;font-size:13px;font-weight:700;padding:10px 18px;color:#1d1204;background:linear-gradient(96deg,var(--brass),var(--ember));clip-path:polygon(9px 0,100% 0,calc(100% - 9px) 100%,0 100%);transition:filter .15s,transform .15s;}
    .ce-btn:hover{filter:brightness(1.12);}
    .ce-btn:active{transform:translateY(1px);}
    .ce-btn:disabled{opacity:.4;cursor:not-allowed;}
    .ce-ghost{background:rgba(255,255,255,.05);color:var(--ink);border:1px solid var(--line);clip-path:none;border-radius:3px;font-weight:600;}
    .ce-ghost:hover{background:rgba(255,255,255,.10);}
    .ce-wrap{display:grid;gap:16px;padding:16px 22px 44px;grid-template-columns:262px minmax(0,1fr) 386px;align-items:start;max-width:1720px;margin:0 auto;}
    .ce-panel{background:linear-gradient(158deg,var(--panel-a),var(--panel-b));border:1px solid var(--line);padding:16px;clip-path:polygon(0 0,calc(100% - 13px) 0,100% 13px,100% 100%,13px 100%,0 calc(100% - 13px));margin-bottom:14px;}
    .ce-ttl{display:flex;align-items:center;gap:9px;font-size:11px;font-weight:800;letter-spacing:.15em;text-transform:uppercase;color:var(--muted);margin:0 0 12px;}
    .ce-ttl::before{content:"";width:3px;height:13px;background:var(--brass);}
    .ce-ttl .hint{margin-left:auto;letter-spacing:0;text-transform:none;font-weight:600;color:var(--dim);}
    .ce-presets{display:grid;grid-template-columns:1fr 1fr;gap:6px;}
    .ce-preset{display:flex;align-items:center;gap:7px;background:rgba(255,255,255,.04);border:1px solid transparent;border-left:3px solid rgba(168,85,247,.5);color:var(--ink);font-family:inherit;font-size:12px;padding:8px;cursor:pointer;text-align:left;transition:.14s;}
    .ce-preset:hover{background:rgba(217,164,65,.14);border-left-color:var(--brass);transform:translateX(2px);}
    .ce-field{margin-bottom:12px;}
    .ce-field label{display:block;font-size:11px;color:var(--muted);margin-bottom:6px;}
    .ce-seg{display:grid;grid-template-columns:repeat(2,1fr);gap:6px;}
    .ce-seg button{background:rgba(8,6,20,.6);border:1px solid var(--line);color:var(--muted);font-family:inherit;font-size:12px;padding:8px 0;cursor:pointer;border-radius:3px;transition:.14s;}
    .ce-seg button.on{background:linear-gradient(180deg,rgba(217,164,65,.24),rgba(201,106,43,.12));border-color:var(--brass);color:#ffe0a6;font-weight:700;}
    .ce-range{width:100%;accent-color:var(--brass);}
    .ce-stage{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px 20px 20px;min-height:470px;background:radial-gradient(360px 280px at 50% 44%,rgba(168,85,247,.16),transparent 72%),linear-gradient(158deg,rgba(32,25,68,.72),rgba(11,8,28,.94));border:1px solid var(--line);clip-path:polygon(0 0,calc(100% - 17px) 0,100% 17px,100% 100%,17px 100%,0 calc(100% - 17px));overflow:hidden;}
    .ce-stage::before{content:"";position:absolute;inset:0;background-image:linear-gradient(rgba(146,118,224,.13) 1px,transparent 1px),linear-gradient(90deg,rgba(146,118,224,.13) 1px,transparent 1px);background-size:48px 48px;mask-image:radial-gradient(330px 270px at 50% 50%,#000 30%,transparent 78%);-webkit-mask-image:radial-gradient(330px 270px at 50% 50%,#000 30%,transparent 78%);}
    .ce-stage::after{content:"";position:absolute;left:50%;bottom:106px;transform:translateX(-50%);width:230px;height:46px;border-radius:50%;background:radial-gradient(ellipse at center,rgba(217,164,65,.32),rgba(201,106,43,.10) 48%,transparent 72%);}
    .ce-hero{position:relative;image-rendering:pixelated;filter:drop-shadow(0 12px 14px rgba(0,0,0,.6));}
    .ce-dirpad{display:grid;grid-template-columns:repeat(3,34px);grid-template-rows:repeat(2,34px);gap:5px;margin-top:14px;}
    .ce-dir{background:rgba(8,6,20,.7);border:1px solid var(--line);color:var(--muted);font-size:15px;cursor:pointer;border-radius:3px;transition:.14s;font-family:inherit;}
    .ce-dir:hover{color:var(--ink);border-color:rgba(217,164,65,.6);}
    .ce-dir.on{background:linear-gradient(180deg,rgba(217,164,65,.26),transparent);border-color:var(--brass);color:#ffe0a6;}
    .ce-namecard{margin-top:12px;text-align:center;}
    .ce-name{font-size:19px;font-weight:800;}
    .ce-id{font-size:11px;color:var(--muted);letter-spacing:.2em;margin-top:3px;}
    .ce-sheetbox{display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap;}
    .ce-sheetframe{padding:8px;background:rgba(6,5,16,.72);border:1px solid var(--line);border-radius:3px;}
    .ce-rowkey{font-size:11.5px;color:var(--muted);line-height:1.8;}
    .ce-team{display:grid;grid-template-columns:repeat(8,1fr);gap:8px;}
    .ce-slot{position:relative;background:rgba(8,6,20,.6);border:1px solid var(--line);border-radius:3px;padding:6px 4px 5px;display:flex;flex-direction:column;align-items:center;gap:3px;cursor:pointer;transition:.14s;min-height:100px;justify-content:center;}
    .ce-slot:hover{border-color:var(--brass);background:rgba(217,164,65,.10);}
    .ce-slot.empty{border-style:dashed;cursor:default;}
    .ce-slot.empty:hover{border-color:var(--line);background:rgba(8,6,20,.6);}
    .ce-slot .sname{font-size:10px;color:var(--muted);text-align:center;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    .ce-slot .plus{font-size:22px;color:var(--dim);}
    .ce-del{position:absolute;top:2px;right:2px;width:18px;height:18px;line-height:1;border:0;border-radius:3px;background:rgba(0,0,0,.55);color:#ffb9b9;font-size:14px;cursor:pointer;padding:0;}
    .ce-del:hover{background:#a63030;color:#fff;}
    .ce-tabs{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:14px;}
    .ce-tab{background:rgba(8,6,20,.55);border:1px solid var(--line);color:var(--muted);font-family:inherit;font-size:11.5px;padding:8px 2px;cursor:pointer;border-radius:3px;display:flex;flex-direction:column;align-items:center;gap:3px;transition:.14s;}
    .ce-tab:hover{background:rgba(168,85,247,.14);color:var(--ink);}
    .ce-tab.on{background:linear-gradient(180deg,rgba(217,164,65,.22),rgba(201,106,43,.08));border-color:var(--brass);color:#ffe0a6;font-weight:700;}
    .ce-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;}
    .ce-cell{position:relative;background:rgba(8,6,20,.6);border:1px solid var(--line);padding:4px 2px 5px;cursor:pointer;border-radius:3px;transition:.14s;display:flex;flex-direction:column;align-items:center;gap:2px;font-family:inherit;overflow:hidden;}
    .ce-cell:hover{border-color:rgba(168,85,247,.7);background:rgba(168,85,247,.12);}
    .ce-cell.on{border-color:var(--brass);background:linear-gradient(180deg,rgba(217,164,65,.16),transparent);box-shadow:0 0 0 1px rgba(217,164,65,.35);}
    .ce-cell.on::after{content:"";position:absolute;top:-1px;right:-1px;border:6px solid transparent;border-top-color:var(--brass);border-right-color:var(--brass);}
    .ce-lb{font-size:10px;color:var(--muted);text-align:center;line-height:1.25;}
    .ce-cell.on .ce-lb{color:#ffe0a6;}
    .ce-swrap{margin-top:16px;}
    .ce-sws{display:flex;flex-wrap:wrap;gap:6px;}
    .ce-sw{width:26px;height:26px;border:1px solid rgba(255,255,255,.16);cursor:pointer;padding:0;border-radius:3px;transition:transform .12s;}
    .ce-sw:hover{transform:scale(1.12);}
    .ce-sw.on{box-shadow:0 0 0 2px var(--brass),0 0 10px rgba(217,164,65,.45);border-color:#fff;}
    .ce-custom{display:flex;align-items:center;gap:8px;margin-top:9px;font-size:11px;color:var(--muted);}
    .ce-custom input[type=color]{width:34px;height:26px;border:1px solid var(--line);background:transparent;padding:0;cursor:pointer;border-radius:3px;}
    .ce-exp{display:flex;gap:8px;flex-wrap:wrap;}
    .ce-out{width:100%;height:120px;margin-top:10px;background:rgba(6,5,16,.9);border:1px solid var(--line);color:#a9f5d0;font-family:ui-monospace,monospace;font-size:11px;padding:9px;border-radius:3px;resize:vertical;}
    .ce-note{font-size:11px;color:var(--dim);margin-top:9px;line-height:1.65;}
    @media(max-width:1300px){.ce-wrap{grid-template-columns:242px minmax(0,1fr)}.ce-col-right{grid-column:1 / -1}}
    @media(max-width:860px){.ce-wrap{grid-template-columns:1fr;padding:12px}.ce-team{grid-template-columns:repeat(4,1fr)}}
  `;

  return (
    <div className="ce-root">
      <style>{css}</style>

      <div className="ce-topbar">
        <button className="ce-back" onClick={()=>navigate('/dashboard')}>← Dashboard</button>
        <div>
          <span className="ce-brand-mark">Character Sheet Forge</span>
          <span className="ce-brand-sub">RPG · 96×96 HD · 4 ทิศ × 3 เฟรม</span>
        </div>
        <div style={{flex:1}}/>
        {flashMsg && <span style={{fontSize:13,color:'#3fbf94',fontWeight:700}}>{flashMsg}</span>}
        <button className="ce-btn ce-ghost" onClick={()=>{
          const pick=a=>a[Math.floor(Math.random()*a.length)];
          setCfg(c=>({...c,
            skin:pick(SKIN_TONES),eye:pick(EYE_TONES),
            hair:pick(PARTS.hair)[0],hairC:pick(HAIR_TONES),
            top:pick(PARTS.top)[0],topC:pick(CLOTH),topC2:pick(CLOTH),
            bottom:pick(PARTS.bottom)[0],botC:pick(CLOTH),beltC:pick(CLOTH),
            shoes:pick(PARTS.shoes)[0],shoeC:pick(CLOTH),
            head:pick(PARTS.head)[0],headC:pick(CLOTH),
            weapon:pick(PARTS.weapon)[0],wepC:pick(CLOTH),
            cape:pick(PARTS.cape)[0],capeC:pick(CLOTH),
          }));
        }}>🎲 สุ่มตัวละคร</button>
        <button className="ce-btn" onClick={handleSave} disabled={saving}>
          {saving?'กำลังบันทึก...':'💾 บันทึกตัวละคร'}
        </button>
      </div>

      <div className="ce-wrap">
        {/* LEFT */}
        <div>
          <div className="ce-panel">
            <h2 className="ce-ttl">คลาสสำเร็จรูป <span className="hint">{PRESETS.length}</span></h2>
            <div className="ce-presets">
              {PRESETS.map(([em,name,data])=>(
                <button key={name} className="ce-preset" onClick={()=>setCfg(c=>({...c,...data,name}))}>
                  <span style={{fontSize:14}}>{em}</span><span>{name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="ce-panel">
            <h2 className="ce-ttl">ข้อมูลตัวละคร</h2>
            <div className="ce-field">
              <label>ชื่อที่แสดง</label>
              <input type="text" value={cfg.name} maxLength={20}
                onChange={e=>update('name',e.target.value)}
                style={{width:'100%',background:'rgba(8,6,20,.75)',border:'1px solid rgba(146,118,224,.20)',color:'#eee8ff',fontFamily:'inherit',fontSize:13,padding:'9px 10px',borderRadius:3}} />
            </div>
            <div className="ce-field">
              <label>การเคลื่อนไหว</label>
              <div className="ce-seg">
                {[['stand','ยืนนิ่ง'],['walk','เดิน']].map(([a,l])=>(
                  <button key={a} className={cfg.anim===a?'on':''} onClick={()=>update('anim',a)}>{l}</button>
                ))}
              </div>
            </div>
            <div className="ce-field">
              <label>ขนาดพรีวิว {cfg.zoom}×</label>
              <input className="ce-range" type="range" min={1} max={5} value={cfg.zoom}
                onChange={e=>update('zoom',+e.target.value)} />
            </div>
            <div className="ce-field">
              <label>ความเร็วเดิน {cfg.speed} เฟรม/วิ</label>
              <input className="ce-range" type="range" min={2} max={12} value={cfg.speed}
                onChange={e=>update('speed',+e.target.value)} />
            </div>
          </div>

          <div className="ce-panel">
            <h2 className="ce-ttl">รีเซ็ต</h2>
            <button className="ce-btn ce-ghost" style={{width:'100%'}} onClick={()=>setCfg({...DEFAULT_CFG})}>คืนค่าเริ่มต้น</button>
            <p className="ce-note">กดลูกศรบนคีย์บอร์ดเพื่อหมุนตัวละครได้ ทุกพิกเซลวาดจากโค้ด ไม่ได้ใช้ไฟล์สไปรท์จากแหล่งอื่น</p>
          </div>
        </div>

        {/* CENTER */}
        <div>
          <div className="ce-stage">
            <canvas ref={heroRef} className="ce-hero" style={{imageRendering:'pixelated'}} />
            <div className="ce-dirpad">
              <div />
              <button className={`ce-dir${cfg.dir===3?' on':''}`} style={{gridColumn:2}} onClick={()=>update('dir',3)}>↑</button>
              <div />
              <button className={`ce-dir${cfg.dir===1?' on':''}`} onClick={()=>update('dir',1)}>←</button>
              <button className={`ce-dir${cfg.dir===0?' on':''}`} onClick={()=>update('dir',0)}>↓</button>
              <button className={`ce-dir${cfg.dir===2?' on':''}`} onClick={()=>update('dir',2)}>→</button>
            </div>
            <div className="ce-namecard">
              <div className="ce-name">{cfg.name||'ไม่มีชื่อ'}</div>
              <div className="ce-id">ID · {hashId(cfg)}</div>
            </div>
          </div>

          <div className="ce-panel">
            <h2 className="ce-ttl">ทีมตัวละคร <span className="hint">{roster.length}/8</span></h2>
            <div className="ce-team">
              {Array.from({length:8}).map((_,i)=>{
                const member=roster[i];
                return member ? (
                  <div key={i} className="ce-slot" onClick={()=>{
                    setCfg(c=>({...c,...member,anim:c.anim,dir:c.dir,zoom:c.zoom,speed:c.speed}));
                  }}>
                    <SlotPreview c={member} />
                    <span className="sname">{member.name||'-'}</span>
                    <button className="ce-del" onClick={e=>{e.stopPropagation();setRoster(r=>r.filter((_,j)=>j!==i));}}>×</button>
                  </div>
                ) : (
                  <div key={i} className="ce-slot empty">
                    <span className="plus">+</span>
                    <span className="sname">ช่องว่าง</span>
                  </div>
                );
              })}
            </div>
            <div className="ce-exp" style={{marginTop:12}}>
              <button className="ce-btn ce-ghost" onClick={()=>{
                if(roster.length>=8){ showFlash('ทีมเต็มแล้ว'); return; }
                const c={...cfg}; delete c.anim; delete c.dir; delete c.zoom; delete c.speed;
                setRoster(r=>[...r,c]); showFlash('เพิ่มแล้ว');
              }}>＋ เพิ่มตัวนี้เข้าทีม</button>
              <button className="ce-btn ce-ghost" disabled={roster.length===0} onClick={()=>{
                if(!roster.length) return;
                const W=S*12,H=S*8;
                const g=[];
                for(let y=0;y<H;y++) g.push(new Array(W).fill(null));
                roster.forEach((c,i)=>{
                  const bx=(i%4)*S*3,by=Math.floor(i/4)*S*4;
                  const sg=sheetGrid(c);
                  for(let y=0;y<S*4;y++) for(let x=0;x<S*3;x++) g[by+y][bx+x]=sg[y][x];
                });
                download(gridToCanvas(g,1),`party_${roster.length}_chars.png`);
              }}>ดาวน์โหลดชีตรวมทีม</button>
            </div>
          </div>

          <div className="ce-panel">
            <h2 className="ce-ttl">Character Sheet <span className="hint">288×384 px</span></h2>
            <div className="ce-sheetbox">
              <div className="ce-sheetframe">
                <canvas ref={sheetRef} style={{imageRendering:'pixelated',display:'block'}} />
              </div>
              <div className="ce-rowkey">
                <div><strong>แถว 1</strong> · หันลง</div>
                <div><strong>แถว 2</strong> · หันซ้าย</div>
                <div><strong>แถว 3</strong> · หันขวา</div>
                <div><strong>แถว 4</strong> · หันขึ้น</div>
                <div style={{marginTop:8,color:'var(--dim)',fontSize:11}}>คอลัมน์ = เฟรมเดิน 1·2·3<br/>เฟรมยืน = คอลัมน์กลาง</div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="ce-col-right">
          <div className="ce-panel">
            <h2 className="ce-ttl">แต่งตัวละคร <span className="hint">{activeCat?.part ? PARTS[activeCat.part].length+' แบบ' : 'ปรับสีอย่างเดียว'}</span></h2>
            <div className="ce-tabs">
              {CATS.map(c=>(
                <button key={c.id} className={`ce-tab${cat===c.id?' on':''}`} onClick={()=>setCat(c.id)}>
                  <span style={{fontSize:15}}>{c.ic}</span>{c.name}
                </button>
              ))}
            </div>
            {activeCat?.part && (
              <div className="ce-grid">
                {PARTS[activeCat.part].map(([val,label])=>(
                  <button key={val} className={`ce-cell${cfg[activeCat.part]===val?' on':''}`}
                    onClick={()=>update(activeCat.part,val)}>
                    <ItemPreview cfg={cfg} part={activeCat.part} value={val} crop={CROP[activeCat.part]} />
                    <span className="ce-lb">{label}</span>
                  </button>
                ))}
              </div>
            )}
            {activeCat?.pal.map(([key,label,list])=>(
              <div className="ce-swrap" key={key}>
                <h2 className="ce-ttl">{label}</h2>
                <div className="ce-sws">
                  {list.map(col=>(
                    <button key={col} className={`ce-sw${(cfg[key]||'').toLowerCase()===col.toLowerCase()?' on':''}`}
                      style={{background:col}} title={col}
                      onClick={()=>update(key,col)} />
                  ))}
                </div>
                <div className="ce-custom">
                  <input type="color" value={cfg[key]||'#ffffff'}
                    onChange={e=>update(key,e.target.value)} />
                  <span>เลือกสีเอง</span>
                </div>
              </div>
            ))}
          </div>

          <div className="ce-panel">
            <h2 className="ce-ttl">ส่งออก</h2>
            <div className="ce-exp">
              <button className="ce-btn ce-ghost" onClick={()=>{
                download(gridToCanvas(sheetGrid(cfg),1),'$'+safeName(cfg.name)+'.png');
              }}>Sheet 96px</button>
              <button className="ce-btn ce-ghost" onClick={()=>{
                const src=gridToCanvas(sheetGrid(cfg),1);
                const cv=document.createElement('canvas');
                cv.width=src.width/2; cv.height=src.height/2;
                const ctx=cv.getContext('2d'); ctx.imageSmoothingEnabled=false;
                ctx.drawImage(src,0,0,cv.width,cv.height);
                download(cv,'$'+safeName(cfg.name)+'_48.png');
              }}>Sheet 48px</button>
              <button className="ce-btn ce-ghost" onClick={()=>{
                download(gridToCanvas(buildFrame(cfg,cfg.dir,1),2),safeName(cfg.name)+'_'+DIRS[cfg.dir]+'_x2.png');
              }}>เฟรมเดียว</button>
              <button className="ce-btn ce-ghost" onClick={()=>{
                const payload=JSON.stringify({
                  engine:'rpgmaker-mv-compatible',frameSize:[S,S],columns:3,rows:4,
                  rowOrder:DIRS,standFrame:1,walkPattern:[0,1,2,1],
                  current:{id:hashId(cfg),file:'$'+safeName(cfg.name)+'.png',config:cfg},
                  party:roster.map(c=>({id:hashId(c),config:c}))
                },null,2);
                const ta=document.getElementById('ce-out-ta');
                if(ta) ta.value=payload;
              }}>JSON</button>
            </div>
            <textarea id="ce-out-ta" className="ce-out" spellCheck={false}
              placeholder="กด JSON เพื่อดูค่าตัวละครและทีมทั้งหมด" />
            <p className="ce-note"><strong>96px</strong> ความละเอียดเต็ม · <strong>48px</strong> ย่อครึ่ง ใช้กับ RPG Maker ขนาดมาตรฐาน</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CharacterEditor;

/* ใช้ซ้ำโดยหน้าอื่น (เช่น GamePlay) เพื่อวาดตัวละครจริงของผู้เล่น */
export { buildFrame, paintGrid, S as SPRITE_SIZE, DEFAULT_CFG as DEFAULT_CHAR_CFG };
