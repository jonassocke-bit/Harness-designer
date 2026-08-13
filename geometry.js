
HD.G={};
HD.G.v3=a=>new THREE.Vector3().fromArray(a);
HD.G.arr=v=>[v.x,v.y,v.z];
HD.G.worldNormalFromHit=hit=>{
  const n=hit.face?.normal?.clone()||new THREE.Vector3(0,0,1);
  return n.transformDirection(hit.object.matrixWorld).normalize();
};
HD.G.ringMajor=n=>Math.max(.003,HD.mm(n.diameterMM)*.5);
HD.G.ringTube=n=>Math.max(.001,HD.mm(n.thicknessMM)*.5);
HD.G.nodePos=n=>HD.G.v3(n.position);
HD.G.nodeNormal=n=>HD.G.v3(n.normal).normalize();
HD.G.mirrorPoint=p=>new THREE.Vector3(-p.x,p.y,p.z);
HD.G.mirrorNormal=n=>new THREE.Vector3(-n.x,n.y,n.z).normalize();
HD.G.closestPointSegment=(p,a,b)=>{
  const ab=b.clone().sub(a),l2=ab.lengthSq()||1e-12;
  const t=THREE.MathUtils.clamp(p.clone().sub(a).dot(ab)/l2,0,1);
  return {t,p:a.clone().addScaledVector(ab,t)};
};
HD.G.poly2D=(pts,normal)=>{
  const origin=pts.reduce((a,p)=>a.add(p),new THREE.Vector3()).multiplyScalar(1/Math.max(1,pts.length));
  let n=normal.clone().normalize();
  let u=(pts[1]||origin.clone().add(new THREE.Vector3(1,0,0))).clone().sub(pts[0]||origin);
  u.addScaledVector(n,-u.dot(n)); if(u.lengthSq()<1e-8)u.set(1,0,0).addScaledVector(n,-n.x);u.normalize();
  const v=new THREE.Vector3().crossVectors(n,u).normalize();
  const to2=p=>{const d=p.clone().sub(origin);return new THREE.Vector2(d.dot(u),d.dot(v))};
  return {origin,n,u,v,to2};
};
HD.G.pointInPoly=(p,poly)=>{
  let inside=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const a=poly[i],b=poly[j];
    if(((a.y>p.y)!=(b.y>p.y)) && p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y+1e-12)+a.x)inside=!inside;
  }
  return inside;
};
HD.G.bary2=(p,a,b,c)=>{
  const v0=b.clone().sub(a),v1=c.clone().sub(a),v2=p.clone().sub(a);
  const den=v0.x*v1.y-v1.x*v0.y;
  if(Math.abs(den)<1e-12)return {u:1,v:0,w:0};
  const v=(v2.x*v1.y-v1.x*v2.y)/den,w=(v0.x*v2.y-v2.x*v0.y)/den;
  return {u:1-v-w,v,w};
};
