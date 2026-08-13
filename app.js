
HD.App={
  canvas:null,renderer:null,scene:null,camera:null,raycaster:new THREE.Raycaster(),pointer:new THREE.Vector2(),orbitYaw:0,orbitPitch:0,
  init(){
    this.canvas=document.getElementById("viewport");
    this.renderer=new THREE.WebGLRenderer({canvas:this.canvas,antialias:true,alpha:false});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.setSize(innerWidth,innerHeight);this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0x111216);
    this.camera=new THREE.PerspectiveCamera(38,innerWidth/innerHeight,.01,100);this.camera.position.set(0,0.3,4.2);
    this.scene.add(new THREE.HemisphereLight(0xffffff,0x303038,2.2));
    const d=new THREE.DirectionalLight(0xffffff,2.4);d.position.set(2,3,4);this.scene.add(d);
    HD.Body.init(this.scene);HD.Nodes.init(this.scene);HD.Straps.init(this.scene);HD.Panels.init(this.scene);
    HD.Interaction.init(this.canvas);HD.UI.init();
    addEventListener("resize",()=>this.resize());this.loop();
  },
  updateCamera(){
    const r=4.2,cp=Math.cos(this.orbitPitch),sp=Math.sin(this.orbitPitch),cy=Math.cos(this.orbitYaw),sy=Math.sin(this.orbitYaw);
    this.camera.position.set(r*sy*cp,.4+r*sp,r*cy*cp);this.camera.lookAt(0,.4,0);
  },
  resize(){this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();this.renderer.setSize(innerWidth,innerHeight)},
  loop(){requestAnimationFrame(()=>this.loop());this.renderer.render(this.scene,this.camera)},
  async loadBody(url){HD.Body.currentModel=url;await HD.Body.load(url)},
  clearSceneData(){
    for(const p of [...HD.State.panels.keys()])HD.Panels.remove(p);
    for(const s of [...HD.State.straps.keys()])HD.Straps.remove(s);
    for(const n of [...HD.State.nodes.keys()])HD.Nodes.removeBare(n);
    HD.State.selected=null;HD.State.connectStart=null;HD.State.panelBuild=[];
  },
  async start(){
    await this.loadBody(HD.State.bodyModel);
    try{
      const raw=localStorage.getItem(HD.CFG.storageKey);
      if(raw){const snap=JSON.parse(raw);HD.State.undo=[{sig:raw,snap}];await HD.History.restore(snap)}
      else HD.History.commit();
    }catch{HD.History.commit()}
    HD.UI.refresh();
  }
};

