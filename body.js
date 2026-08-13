
HD.Body={
  root:new THREE.Group(),meshes:[],material:null,loader:null,
  init(scene){
    this.material=new THREE.MeshStandardMaterial({color:HD.State.bodyColor,roughness:.72,metalness:0});
    this.loader=new THREE.GLTFLoader();scene.add(this.root);
  },
  async load(url){
    this.root.clear();this.meshes=[];
    return new Promise((resolve,reject)=>{
      this.loader.load(url,gltf=>{
        gltf.scene.traverse(o=>{
          if(o.isMesh){
            o.material=this.material.clone();
            o.material.color.set(HD.State.bodyColor);
            o.castShadow=false;o.receiveShadow=true;
            this.meshes.push(o);
          }
        });
        this.root.add(gltf.scene); resolve();
      },undefined,reject);
    });
  },
  setColor(hex){
    HD.State.bodyColor=hex;
    this.material.color.set(hex);
    for(const m of this.meshes){m.material.color.set(hex);m.material.needsUpdate=true}
  },
  ray(raycaster){return raycaster.intersectObjects(this.meshes,true)[0]||null},
  vertexWorld(mesh,index,out=new THREE.Vector3()){
    if(typeof mesh.getVertexPosition==="function")mesh.getVertexPosition(index,out);
    else out.fromBufferAttribute(mesh.geometry.attributes.position,index);
    return out.applyMatrix4(mesh.matrixWorld);
  },
  normalWorld(mesh,index,out=new THREE.Vector3()){
    const na=mesh.geometry.attributes.normal;
    if(na)out.fromBufferAttribute(na,index); else out.set(0,0,1);
    return out.applyMatrix3(new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld)).normalize();
  }
};
