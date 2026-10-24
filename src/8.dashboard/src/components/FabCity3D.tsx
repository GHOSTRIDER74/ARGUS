import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { StatusBadge } from "./StatusBadge";
import { Eye, RotateCw, Compass, Maximize2, Package, AlertOctagon, Activity, Radio } from "lucide-react";

/* ── Interfaces ── */
interface MachineState {
  machine_id: string; stage: string; health: string; drift_pattern: string;
  drift_severity: number; records_processed: number; hybrid_score: number;
  parameters: Record<string, number>; root_causes?: string[];
}
interface FabCity3DProps {
  machines: MachineState[]; selectedMachineId?: string;
  onSelectMachine?: (id: string) => void; height?: number | string;
}
interface LiveWaferPacket {
  waferId: number; path: string[]; currentStep: number; progress: number; speed: number;
  mesh: THREE.Mesh; glowMesh: THREE.Mesh; defectStatus: "healthy"|"warning"|"critical";
}
interface DataPulseOrb { curve: THREE.CatmullRomCurve3; progress: number; speed: number; mesh: THREE.Mesh; }
interface CritRing { mesh: THREE.Mesh; progress: number; }

/* ── Constants ── */
const TOWER_COORDS: Record<string, { x: number; z: number; color: number; label: string; stage: string }> = {
  "INTAKE":   { x:-28, z:-4, color:0x3B82F6, label:"DATA INTAKE",      stage:"Ingestion Stream" },
  "DEP-01":   { x:-18, z:-4, color:0x10B981, label:"DEP-01",           stage:"Deposition" },
  "LITHO-01": { x:-8,  z:-4, color:0x6366F1, label:"LITHO-01",         stage:"Lithography" },
  "ETCH-01":  { x:3,   z:-9, color:0xEC4899, label:"ETCH-01",          stage:"Plasma Etch A" },
  "ETCH-02":  { x:3,   z:1,  color:0xF43F5E, label:"ETCH-02",          stage:"Plasma Etch B" },
  "CMP-01":   { x:14,  z:-4, color:0x8B5CF6, label:"CMP-01",           stage:"CMP Polish" },
  "CLEAN-01": { x:24,  z:-4, color:0x06B6D4, label:"CLEAN-01",         stage:"Wet Clean" },
  "AI-CORE":  { x:3,   z:14, color:0xF59E0B, label:"ARGUS AI CITADEL", stage:"Drift Core" },
};
const VALID = ["DEP-01","LITHO-01","ETCH-01","ETCH-02","CMP-01","CLEAN-01"];
const SEGS  = [
  ["INTAKE","DEP-01"],["DEP-01","LITHO-01"],["LITHO-01","ETCH-01"],["LITHO-01","ETCH-02"],
  ["ETCH-01","CMP-01"],["ETCH-02","CMP-01"],["CMP-01","CLEAN-01"],["CLEAN-01","AI-CORE"],
];

/* ── Component ── */
export function FabCity3D({ machines, selectedMachineId="ETCH-01", onSelectMachine, height=540 }: FabCity3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredNode, setHoveredNode] = useState<string|null>(null);
  const [autoRotate, setAutoRotate]   = useState(false);
  const autoRotateRef = useRef(false);
  const [inTransit, setInTransit]     = useState(0);
  const [flagged, setFlagged]         = useState(0);

  const machinesRef  = useRef(machines); machinesRef.current = machines;
  const onSelRef     = useRef(onSelectMachine); onSelRef.current = onSelectMachine;
  const selIdRef     = useRef(selectedMachineId); selIdRef.current = selectedMachineId;

  const controlsRef  = useRef<OrbitControls|null>(null);
  const cameraRef    = useRef<THREE.PerspectiveCamera|null>(null);
  const sceneRef     = useRef<THREE.Scene|null>(null);
  const meshMap      = useRef<Map<string,THREE.Group>>(new Map());
  const selRingRef   = useRef<THREE.Mesh|null>(null);
  const curveMap     = useRef<Map<string,THREE.CatmullRomCurve3>>(new Map());
  const packets      = useRef<LiveWaferPacket[]>([]);
  const orbs         = useRef<DataPulseOrb[]>([]);
  const critRings    = useRef<CritRing[]>([]);
  const scanRings    = useRef<Map<string,THREE.Mesh>>(new Map());
  const flashMap     = useRef<Map<string,number>>(new Map());
  const serial       = useRef(1001);
  const prevTotal    = useRef(0);

  const focusOn = (x: number, z: number) => {
    if (!cameraRef.current || !controlsRef.current) return;
    controlsRef.current.target.set(x,4,z);
    cameraRef.current.position.set(x+12,20,z+22);
    controlsRef.current.update();
  };

  /* ── Scene Setup ── */
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const W  = el.clientWidth;
    const H  = typeof height==="number" ? height : el.clientHeight||540;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050810);
    scene.fog = new THREE.FogExp2(0x050810, 0.011);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, W/H, 0.5, 1000);
    camera.position.set(0,38,55);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias:true, powerPreference:"high-performance" });
    renderer.setSize(W,H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
    renderer.shadowMap.enabled = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    el.replaceChildren(renderer.domElement);

    const ctrl = new OrbitControls(camera, renderer.domElement);
    ctrl.enableDamping=true; ctrl.dampingFactor=0.05;
    ctrl.maxPolarAngle=Math.PI/2.05; ctrl.minDistance=10; ctrl.maxDistance=140;
    ctrl.target.set(0,4,0);
    controlsRef.current = ctrl;

    /* Lighting */
    scene.add(new THREE.AmbientLight(0xffffff,0.3));
    const sun = new THREE.DirectionalLight(0xB0C8FF,1.4);
    sun.position.set(30,70,40); sun.castShadow=true; sun.shadow.mapSize.set(2048,2048);
    scene.add(sun);
    const bl = new THREE.DirectionalLight(0x3B82F6,0.7); bl.position.set(-50,25,-30); scene.add(bl);
    const pl = new THREE.DirectionalLight(0xEC4899,0.35); pl.position.set(50,15,30); scene.add(pl);

    /* Grid + Floor */
    const grid = new THREE.GridHelper(120,60,0x1E3A5F,0x0F1E33); grid.position.y=-0.05; scene.add(grid);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(160,160),
      new THREE.MeshStandardMaterial({ color:0x030609, roughness:0.9, metalness:0.3 })
    );
    floor.rotation.x=-Math.PI/2; floor.position.y=-0.15; floor.receiveShadow=true; scene.add(floor);

    /* Starfield */
    const sPos = new Float32Array(2200*3);
    for (let i=0;i<2200;i++){
      const th=Math.random()*Math.PI*2, ph=Math.acos(2*Math.random()-1), r=350+Math.random()*200;
      sPos[i*3]=r*Math.sin(ph)*Math.cos(th); sPos[i*3+1]=r*Math.sin(ph)*Math.sin(th); sPos[i*3+2]=r*Math.cos(ph);
    }
    const sGeo = new THREE.BufferGeometry(); sGeo.setAttribute("position",new THREE.BufferAttribute(sPos,3));
    scene.add(new THREE.Points(sGeo, new THREE.PointsMaterial({ color:0xCCDDFF,size:0.8,sizeAttenuation:true,transparent:true,opacity:0.7 })));

    /* Selection hex ring */
    const selR = new THREE.Mesh(new THREE.RingGeometry(4.2,4.8,6),
      new THREE.MeshBasicMaterial({ color:0x38BDF8,side:THREE.DoubleSide,transparent:true,opacity:0.9 }));
    selR.rotation.x=-Math.PI/2; selR.position.y=0.08;
    const iM = TOWER_COORDS[selIdRef.current];
    if (iM){selR.position.x=iM.x; selR.position.z=iM.z;}
    scene.add(selR); selRingRef.current=selR;

    /* Towers */
    const bGroup = new THREE.Group(); scene.add(bGroup);
    meshMap.current.clear(); scanRings.current.clear();

    const mkLabel = (text:string, color:string) => {
      const cv=document.createElement("canvas"); cv.width=320; cv.height=72;
      const cx=cv.getContext("2d")!;
      cx.fillStyle="rgba(5,10,20,0.88)"; cx.roundRect(4,4,312,64,14); cx.fill();
      cx.strokeStyle=color; cx.lineWidth=2.5; cx.roundRect(4,4,312,64,14); cx.stroke();
      cx.font="bold 26px 'JetBrains Mono',monospace"; cx.fillStyle="#F8FAFC";
      cx.textAlign="center"; cx.textBaseline="middle"; cx.fillText(text,160,36);
      const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(cv),depthTest:false,transparent:true}));
      sp.scale.set(7,1.75,1); return sp;
    };

    Object.entries(TOWER_COORDS).forEach(([id,meta])=>{
      const tw=new THREE.Group(); tw.position.set(meta.x,0,meta.z); tw.name=id;
      const isCore=id==="AI-CORE", isEtch=id.startsWith("ETCH"), isIntake=id==="INTAKE";
      const hV=isCore?16:isEtch?12:isIntake?7:9;
      const col=meta.color;

      // ground glow disc
      const gd=new THREE.Mesh(new THREE.CylinderGeometry(5.2,5.2,0.05,6),
        new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:0.18}));
      tw.add(gd);

      // foundation hex pad
      const fd=new THREE.Mesh(new THREE.CylinderGeometry(4.0,4.2,0.35,6),
        new THREE.MeshStandardMaterial({color:0x0D1B2E,metalness:0.7,roughness:0.3,emissive:col,emissiveIntensity:0.12}));
      fd.position.y=0.18; fd.castShadow=true; tw.add(fd);

      // main hex prism
      const body=new THREE.Mesh(new THREE.CylinderGeometry(2.4,2.9,hV,6),
        new THREE.MeshStandardMaterial({color:0x080F1E,metalness:0.85,roughness:0.15,emissive:col,emissiveIntensity:0.07}));
      body.position.y=hV/2+0.36; body.castShadow=true; body.name=`${id}_BODY`; tw.add(body);

      // window glow layer
      const wn=new THREE.Mesh(new THREE.CylinderGeometry(2.42,2.92,hV*0.68,6),
        new THREE.MeshStandardMaterial({color:col,emissive:col,emissiveIntensity:0.35,transparent:true,opacity:0.22,roughness:0.05}));
      wn.position.y=hV/2+0.36; tw.add(wn);

      // accent belt
      const bl2=new THREE.Mesh(new THREE.CylinderGeometry(2.98,2.98,0.38,6),
        new THREE.MeshStandardMaterial({color:col,emissive:col,emissiveIntensity:0.7,roughness:0.1,metalness:0.6}));
      bl2.position.y=hV*0.52+0.36; tw.add(bl2);

      // hex spire
      const sp=new THREE.Mesh(new THREE.ConeGeometry(0.55,isCore?5:3.2,6),
        new THREE.MeshStandardMaterial({color:col,emissive:col,emissiveIntensity:0.9,roughness:0.05,metalness:0.9}));
      sp.position.y=hV+1.6+(isCore?2.5:1.6); tw.add(sp);

      // apex beacon
      const bec=new THREE.Mesh(new THREE.SphereGeometry(0.55,16,16),new THREE.MeshBasicMaterial({color:col}));
      bec.position.y=hV+(isCore?4.8:3.4); bec.name=`${id}_BEACON`; tw.add(bec);
      const ptL=new THREE.PointLight(col,1.5,18); ptL.position.y=hV+(isCore?5:3.6); tw.add(ptL);

      // scan ring (torus)
      const sr=new THREE.Mesh(new THREE.TorusGeometry(3.5,0.07,10,56),
        new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:0.75}));
      sr.position.y=hV*0.55+0.36; tw.add(sr); scanRings.current.set(id,sr);

      // label
      const lbl=mkLabel(meta.label,"#"+col.toString(16).padStart(6,"0"));
      lbl.position.y=hV+(isCore?7.5:5.8); tw.add(lbl);

      bGroup.add(tw); meshMap.current.set(id,tw);
    });

    /* Conduits + pulse orbs */
    const cGroup=new THREE.Group(); scene.add(cGroup);
    curveMap.current.clear(); orbs.current=[];

    SEGS.forEach(([fId,tId])=>{
      const fc=TOWER_COORDS[fId], tc=TOWER_COORDS[tId]; if(!fc||!tc) return;
      const curve=new THREE.CatmullRomCurve3([
        new THREE.Vector3(fc.x,2.2,fc.z),
        new THREE.Vector3((fc.x+tc.x)/2,5.5,(fc.z+tc.z)/2),
        new THREE.Vector3(tc.x,2.2,tc.z)
      ]);
      curveMap.current.set(`${fId}->${tId}`,curve);

      cGroup.add(new THREE.Mesh(new THREE.TubeGeometry(curve,36,0.18,8,false),
        new THREE.MeshStandardMaterial({color:0x0F2040,emissive:0x1E40AF,emissiveIntensity:0.4,transparent:true,opacity:0.5,roughness:0.2})));
      cGroup.add(new THREE.Mesh(new THREE.TubeGeometry(curve,36,0.38,8,false),
        new THREE.MeshBasicMaterial({color:0x1D4ED8,transparent:true,opacity:0.12})));

      for(let k=0;k<4;k++){
        const om=new THREE.Mesh(new THREE.SphereGeometry(0.22,8,8),
          new THREE.MeshBasicMaterial({color:0x7DD3FC,transparent:true,opacity:0.9}));
        scene.add(om);
        orbs.current.push({curve,progress:k/4,speed:0.016+Math.random()*0.010,mesh:om});
      }
    });

    /* Seed wafers */
    packets.current=[];
    for(let i=0;i<4;i++) spawnWafer(i*0.25);

    /* Raycaster */
    const rc=new THREE.Raycaster(), mouse=new THREE.Vector2();
    let pdPos={x:0,y:0}, pdT=0;

    const onMove=(e:MouseEvent)=>{
      const r=el.getBoundingClientRect();
      mouse.x=((e.clientX-r.left)/r.width)*2-1;
      mouse.y=-((e.clientY-r.top)/r.height)*2+1;
      rc.setFromCamera(mouse,camera);
      const hits=rc.intersectObjects(bGroup.children,true);
      if(hits.length>0){
        let o:THREE.Object3D|null=hits[0].object;
        while(o&&o.parent!==bGroup) o=o.parent;
        if(o?.name&&TOWER_COORDS[o.name]){el.style.cursor="pointer"; setHoveredNode(o.name); return;}
      }
      el.style.cursor="default"; setHoveredNode(null);
    };
    const onDown=(e:MouseEvent)=>{pdPos={x:e.clientX,y:e.clientY}; pdT=performance.now();};
    const onUp=(e:MouseEvent)=>{
      if(Math.hypot(e.clientX-pdPos.x,e.clientY-pdPos.y)>6||performance.now()-pdT>500) return;
      const r=el.getBoundingClientRect();
      mouse.x=((e.clientX-r.left)/r.width)*2-1;
      mouse.y=-((e.clientY-r.top)/r.height)*2+1;
      rc.setFromCamera(mouse,camera);
      const hits=rc.intersectObjects(bGroup.children,true);
      if(hits.length>0){
        let o:THREE.Object3D|null=hits[0].object;
        while(o&&o.parent!==bGroup) o=o.parent;
        if(o?.name){
          const cid=o.name;
          flashMap.current.set(cid,1.0);
          doShockwave(scene,TOWER_COORDS[cid]?.x??0,TOWER_COORDS[cid]?.z??0,TOWER_COORDS[cid]?.color??0xFFFFFF);
          if(VALID.includes(cid)){
            onSelRef.current?.(cid);
            const m=TOWER_COORDS[cid];
            if(m){ctrl.target.set(m.x,4,m.z); camera.position.set(m.x+12,20,m.z+22); ctrl.update();}
          }
        }
      }
    };
    el.addEventListener("mousemove",onMove);
    el.addEventListener("mousedown",onDown);
    el.addEventListener("mouseup",onUp);

    /* Animate */
    let animId:number;
    const clock=new THREE.Clock();
    const animate=()=>{
      animId=requestAnimationFrame(animate);
      const t=clock.getElapsedTime();
      ctrl.autoRotate=autoRotateRef.current; ctrl.autoRotateSpeed=0.6; ctrl.update();

      scanRings.current.forEach((sr,id)=>{
        sr.rotation.y+=id==="AI-CORE"?0.014:0.007+(id.charCodeAt(0)%5)*0.002;
        sr.rotation.x=Math.sin(t*0.4+id.charCodeAt(0))*0.2;
      });

      orbs.current.forEach(orb=>{
        orb.progress+=orb.speed; if(orb.progress>=1.0) orb.progress-=1.0;
        orb.mesh.position.copy(orb.curve.getPointAt(Math.min(orb.progress,0.999)));
        const s=0.8+Math.sin(t*14+orb.progress*20)*0.28; orb.mesh.scale.set(s,s,s);
      });

      const surv:LiveWaferPacket[]=[];  let fl=0;
      packets.current.forEach(pk=>{
        const from=pk.path[pk.currentStep], to=pk.path[pk.currentStep+1];
        const curve=curveMap.current.get(`${from}->${to}`);
        if(!curve){scene.remove(pk.mesh); scene.remove(pk.glowMesh); return;}
        pk.progress+=pk.speed;
        if(pk.progress>=1.0){
          pk.currentStep++; pk.progress=0.0;
          const mc=machinesRef.current.find(m=>m.machine_id===to);
          if(mc?.health==="critical"){pk.defectStatus="critical"; (pk.mesh.material as THREE.MeshBasicMaterial).color.setHex(0xEF4444); (pk.glowMesh.material as THREE.MeshBasicMaterial).color.setHex(0xEF4444);}
          else if(mc?.health==="warning"&&pk.defectStatus!=="critical"){pk.defectStatus="warning"; (pk.mesh.material as THREE.MeshBasicMaterial).color.setHex(0xF59E0B); (pk.glowMesh.material as THREE.MeshBasicMaterial).color.setHex(0xF59E0B);}
          if(pk.currentStep>=pk.path.length-1){scene.remove(pk.mesh); scene.remove(pk.glowMesh); return;}
        }
        const pt=curve.getPointAt(Math.min(pk.progress,0.999));
        pk.mesh.position.copy(pt); pk.glowMesh.position.copy(pt);
        if(pk.progress<0.998) pk.mesh.lookAt(curve.getPointAt(Math.min(pk.progress+0.01,0.999)));
        const pulse=1+Math.sin(t*8+pk.waferId)*0.25; pk.glowMesh.scale.set(pulse,pulse,pulse);
        if(pk.defectStatus!=="healthy") fl++;
        surv.push(pk);
      });
      packets.current=surv; setInTransit(surv.length); setFlagged(fl);

      meshMap.current.forEach((tw,id)=>{
        const bec=tw.getObjectByName(`${id}_BEACON`) as THREE.Mesh;
        if(bec){const s=1+Math.sin(t*4.5+id.charCodeAt(0))*0.18; bec.scale.set(s,s,s);}
        const bdy=tw.getObjectByName(`${id}_BODY`) as THREE.Mesh;
        if(bdy&&bdy.material instanceof THREE.MeshStandardMaterial){
          const f=flashMap.current.get(id)??0;
          if(f>0){bdy.material.emissiveIntensity=f*2+0.07; flashMap.current.set(id,f-0.04);}
        }
      });

      const alive:CritRing[]=[];
      critRings.current.forEach(cr=>{
        cr.progress+=0.018; const s=1+cr.progress*12; cr.mesh.scale.set(s,1,s);
        (cr.mesh.material as THREE.MeshBasicMaterial).opacity=(1-cr.progress)*0.7;
        if(cr.progress<1.0) alive.push(cr); else scene.remove(cr.mesh);
      });
      critRings.current=alive;

      if(Math.floor(t*1.2)!==Math.floor((t-1/60)*1.2)){
        machinesRef.current.forEach(m=>{
          if(m.health==="critical"){
            const meta=TOWER_COORDS[m.machine_id];
            if(meta){
              const mesh=new THREE.Mesh(new THREE.RingGeometry(0.4,0.7,32),
                new THREE.MeshBasicMaterial({color:0xEF4444,side:THREE.DoubleSide,transparent:true,opacity:0.7}));
              mesh.rotation.x=-Math.PI/2; mesh.position.set(meta.x,0.1,meta.z);
              scene.add(mesh); critRings.current.push({mesh,progress:0});
            }
          }
        });
      }

      const tot=machinesRef.current.reduce((a,m)=>a+(m.records_processed||0),0);
      if(tot>prevTotal.current){
        const d=Math.min(3,Math.max(1,tot-prevTotal.current));
        for(let i=0;i<d;i++) spawnWafer(0);
        prevTotal.current=tot;
      }
      renderer.render(scene,camera);
    };
    animate();

    const ro=new ResizeObserver(()=>{
      const nw=el.clientWidth, nh=typeof height==="number"?height:el.clientHeight||540;
      camera.aspect=nw/nh; camera.updateProjectionMatrix(); renderer.setSize(nw,nh);
    });
    ro.observe(el);

    return ()=>{
      cancelAnimationFrame(animId); ro.disconnect();
      el.removeEventListener("mousemove",onMove);
      el.removeEventListener("mousedown",onDown);
      el.removeEventListener("mouseup",onUp);
      packets.current.forEach(p=>{scene.remove(p.mesh); scene.remove(p.glowMesh);});
      orbs.current.forEach(o=>scene.remove(o.mesh));
      critRings.current.forEach(r=>scene.remove(r.mesh));
      renderer.dispose(); scene.clear();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[height]);

  const spawnWafer = (initP=0) => {
    if(!sceneRef.current) return;
    const s=sceneRef.current, n=serial.current++;
    const path=["INTAKE","DEP-01","LITHO-01",n%2===0?"ETCH-02":"ETCH-01","CMP-01","CLEAN-01","AI-CORE"];
    const core=new THREE.Mesh(new THREE.TorusGeometry(0.44,0.14,10,28),new THREE.MeshBasicMaterial({color:0x38BDF8}));
    const halo=new THREE.Mesh(new THREE.TorusGeometry(0.62,0.10,8,24),new THREE.MeshBasicMaterial({color:0x38BDF8,transparent:true,opacity:0.30}));
    s.add(core); s.add(halo);
    packets.current.push({waferId:n,path,currentStep:0,progress:initP,speed:0.0048+Math.random()*0.0022,mesh:core,glowMesh:halo,defectStatus:"healthy"});
  };

  useEffect(()=>{
    machines.forEach(m=>{
      const tw=meshMap.current.get(m.machine_id); if(!tw) return;
      const body=tw.getObjectByName(`${m.machine_id}_BODY`) as THREE.Mesh;
      const bec =tw.getObjectByName(`${m.machine_id}_BEACON`) as THREE.Mesh;
      const col=m.health==="critical"?0xEF4444:m.health==="warning"?0xF59E0B:0x10B981;
      const emit=m.health==="critical"?0.65:m.health==="warning"?0.35:0.08;
      if(body?.material instanceof THREE.MeshStandardMaterial){
        body.material.emissive.setHex(col);
        if((flashMap.current.get(m.machine_id)??0)<=0) body.material.emissiveIntensity=emit;
      }
      if(bec?.material instanceof THREE.MeshBasicMaterial) bec.material.color.setHex(col);
    });
  },[machines]);

  useEffect(()=>{
    if(!selRingRef.current||!selectedMachineId) return;
    const meta=TOWER_COORDS[selectedMachineId];
    if(meta) selRingRef.current.position.set(meta.x,0.08,meta.z);
  },[selectedMachineId]);

  const setCam=(type:"iso"|"top"|"focus")=>{
    if(!cameraRef.current||!controlsRef.current) return;
    const cam=cameraRef.current, ctrl=controlsRef.current;
    if(type==="iso"){cam.position.set(0,38,55); ctrl.target.set(0,4,0);}
    else if(type==="top"){cam.position.set(0,70,3); ctrl.target.set(0,0,0);}
    else if(type==="focus"&&selectedMachineId){
      const m=TOWER_COORDS[selectedMachineId];
      if(m){cam.position.set(m.x+12,20,m.z+22); ctrl.target.set(m.x,4,m.z);}
    }
    ctrl.update();
  };
  const handleSel=(id:string)=>{
    onSelectMachine?.(id);
    const m=TOWER_COORDS[id]; if(m) focusOn(m.x,m.z);
  };

  const sel=machines.find(m=>m.machine_id===selectedMachineId)??null;
  const hc=sel?.health==="critical"?"#EF4444":sel?.health==="warning"?"#F59E0B":"#10B981";

  return (
    <div style={{position:"relative",width:"100%",height,borderRadius:24,overflow:"hidden"}}>
      <div ref={containerRef} style={{width:"100%",height:"100%"}} />

      {/* TOP LEFT */}
      <div style={{position:"absolute",top:14,left:14,display:"flex",flexDirection:"column",gap:6,zIndex:10}}>
        <div style={{display:"flex",alignItems:"center",gap:8,background:"rgba(18,20,29,0.85)",backdropFilter:"blur(16px)",padding:"6px 14px",borderRadius:9999,border:"1px solid rgba(255,255,255,0.12)",boxShadow:"0 4px 20px rgba(0,0,0,0.3)"}}>
          <span style={{width:8,height:8,borderRadius:"50%",background:"#10B981",boxShadow:"0 0 10px #10B981"}}/>
          <span style={{fontSize:11,fontWeight:700,color:"#F8FAFC",fontFamily:"'Space Grotesk',sans-serif",letterSpacing:"0.06em"}}>ARGUS FABCITY 3D</span>
          <div style={{width:1,height:14,background:"rgba(255,255,255,0.15)",margin:"0 2px"}}/>
          <span style={{fontSize:10,color:"#94A3B8",fontFamily:"'JetBrains Mono',monospace",fontWeight:500}}>LIVE TELEMETRY</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10,background:"rgba(18,20,29,0.85)",backdropFilter:"blur(16px)",padding:"5px 12px",borderRadius:9999,border:"1px solid rgba(255,255,255,0.1)",fontSize:11,fontFamily:"'JetBrains Mono',monospace",color:"#E2E8F0"}}>
          <div style={{display:"flex",alignItems:"center",gap:5}}><Package size={12} style={{color:"#FB8D7E"}}/><span>In-Transit: <strong style={{color:"#FFF"}}>{inTransit}</strong></span></div>
          <div style={{width:1,height:12,background:"rgba(255,255,255,0.12)"}}/>
          <div style={{display:"flex",alignItems:"center",gap:5}}><AlertOctagon size={12} style={{color:flagged>0?"#F59E0B":"#10B981"}}/><span style={{color:flagged>0?"#F59E0B":"#10B981"}}>Flagged: <strong>{flagged}</strong></span></div>
          <div style={{width:1,height:12,background:"rgba(255,255,255,0.12)"}}/>
          <div style={{display:"flex",alignItems:"center",gap:5}}><Radio size={12} style={{color:"#34D399"}}/><span style={{color:"#34D399"}}>Pulses: <strong>LIVE</strong></span></div>
        </div>
      </div>

      {/* TOP RIGHT */}
      <div style={{position:"absolute",top:14,right:14,display:"flex",alignItems:"center",gap:4,background:"rgba(18,20,29,0.85)",backdropFilter:"blur(16px)",padding:"4px 6px",borderRadius:9999,border:"1px solid rgba(255,255,255,0.1)",zIndex:10}}>
        {([{t:"iso" as const,I:Compass,l:"ISO"},{t:"top" as const,I:Eye,l:"TOP"},{t:"focus" as const,I:Maximize2,l:"FOCUS"}]).map(({t,I,l})=>(
          <button key={t} onClick={()=>setCam(t)} style={{
            padding:"4px 10px",
            fontSize:11,
            borderRadius:9999,
            background:"transparent",
            color:"#CBD5E1",
            border:"none",
            cursor:"pointer",
            fontFamily:"'Space Grotesk',sans-serif",
            fontWeight:600,
            display:"flex",
            alignItems:"center",
            gap:4
          }}>
            <I size={12}/> {l}
          </button>
        ))}
        <div style={{width:1,height:14,background:"rgba(255,255,255,0.15)",margin:"0 2px"}}/>
        <button onClick={()=>{setAutoRotate(p=>{autoRotateRef.current=!p; return !p;});}}
          style={{
            padding:"4px 10px",
            fontSize:11,
            borderRadius:9999,
            cursor:"pointer",
            display:"flex",
            alignItems:"center",
            gap:4,
            fontFamily:"'Space Grotesk',sans-serif",
            fontWeight:600,
            background:autoRotate?"rgba(251,141,126,0.25)":"transparent",
            color:autoRotate?"#FB8D7E":"#CBD5E1",
            border:autoRotate?"1px solid #FB8D7E":"1px solid transparent"
          }}>
          <RotateCw size={12}/> ORBIT
        </button>
      </div>

      {/* TOP CENTER */}
      <div style={{position:"absolute",top:14,left:"50%",transform:"translateX(-50%)",display:"flex",alignItems:"center",gap:4,background:"rgba(18,20,29,0.85)",backdropFilter:"blur(16px)",padding:"4px 8px",borderRadius:9999,border:"1px solid rgba(255,255,255,0.1)",zIndex:10}}>
        {VALID.map(id=>{
          const m=machines.find(x=>x.machine_id===id), isSel=selectedMachineId===id;
          const sc=m?.health==="critical"?"#EF4444":m?.health==="warning"?"#F59E0B":"#10B981";
          return (
            <button key={id} onClick={()=>handleSel(id)} style={{
              padding:"4px 10px",
              fontSize:11,
              fontFamily:"'Space Grotesk',sans-serif",
              fontWeight:isSel?700:500,
              borderRadius:9999,
              cursor:"pointer",
              border:isSel?"1px solid #FB8D7E":"1px solid transparent",
              background:isSel?"rgba(251,141,126,0.2)":"transparent",
              color:isSel?"#FFF":"#94A3B8",
              display:"flex",
              alignItems:"center",
              gap:5,
              transition:"all 0.18s ease"
            }}>
              <span style={{width:6,height:6,borderRadius:"50%",background:sc,boxShadow:`0 0 6px ${sc}`}}/>{id}
            </button>
          );
        })}
      </div>

      {/* HOVER TOOLTIP */}
      {hoveredNode&&TOWER_COORDS[hoveredNode]&&(
        <div style={{position:"absolute",bottom:14,left:14,background:"rgba(18,20,29,0.92)",backdropFilter:"blur(16px)",border:"1px solid rgba(251,141,126,0.4)",padding:"8px 14px",borderRadius:16,color:"#F8FAFC",fontSize:12,fontFamily:"'JetBrains Mono',monospace",display:"flex",alignItems:"center",gap:8,zIndex:10,boxShadow:"0 4px 20px rgba(0,0,0,0.4)"}}>
          <span style={{color:"#FB8D7E",fontSize:14}}>◈</span>
          <span><strong style={{color:"#FFF"}}>{TOWER_COORDS[hoveredNode].label}</strong><span style={{color:"#94A3B8",marginLeft:6}}>— {TOWER_COORDS[hoveredNode].stage}</span></span>
          <span style={{fontSize:10,color:"#64748B"}}>Click to focus</span>
        </div>
      )}

      {/* HUD CARD */}
      {sel&&sel.machine_id&&(
        <div style={{
          position:"absolute",
          bottom:14,
          right:14,
          width:320,
          background:"rgba(18,20,29,0.88)",
          backdropFilter:"blur(20px)",
          border:`1px solid ${sel.health==="critical"?"rgba(239,68,68,0.5)":sel.health==="warning"?"rgba(245,158,11,0.5)":"rgba(255,255,255,0.12)"}`,
          borderRadius:24,
          padding:"16px 18px",
          color:"#F8FAFC",
          boxShadow:"0 12px 40px rgba(0,0,0,0.5)",
          zIndex:10
        }}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
            <div>
              <div style={{fontSize:10,color:"#94A3B8",fontFamily:"'JetBrains Mono',monospace",letterSpacing:"0.1em",textTransform:"uppercase"}}>{sel.stage}</div>
              <div style={{fontSize:20,fontWeight:700,fontFamily:"'Space Grotesk',sans-serif",color:"#FFFFFF",marginTop:2}}>{sel.machine_id}</div>
            </div>
            <StatusBadge status={sel.health}/>
          </div>
          <div style={{marginBottom:12}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:5,fontSize:10,color:"#94A3B8",fontFamily:"'JetBrains Mono',monospace",fontWeight:600}}>
              <span>DRIFT SEVERITY</span><span style={{color:hc,fontWeight:700}}>{(sel.drift_severity*100).toFixed(1)}%</span>
            </div>
            <div style={{background:"rgba(255,255,255,0.08)",borderRadius:9999,height:6,overflow:"hidden"}}>
              <div style={{height:"100%",borderRadius:9999,width:`${Math.min(100,sel.drift_severity*100).toFixed(1)}%`,background:`linear-gradient(90deg,${hc}99,${hc})`,transition:"width 0.6s ease"}}/>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
            {[{label:"Wafers Run",value:sel.records_processed.toLocaleString()},{label:"Anomaly Score",value:sel.hybrid_score.toFixed(3)}].map(({label,value})=>(
              <div key={label} style={{background:"rgba(255,255,255,0.05)",padding:"8px 12px",borderRadius:16,border:"1px solid rgba(255,255,255,0.08)"}}>
                <div style={{display:"flex",alignItems:"center",gap:4,fontSize:9,color:"#94A3B8",fontFamily:"'Space Grotesk',sans-serif",textTransform:"uppercase",marginBottom:3}}><Activity size={11}/>{label}</div>
                <div style={{fontFamily:"'JetBrains Mono',monospace",fontWeight:700,fontSize:14,color:"#FFF"}}>{value}</div>
              </div>
            ))}
          </div>
          <div style={{borderTop:"1px solid rgba(255,255,255,0.08)",paddingTop:10}}>
            <div style={{fontSize:9,color:"#94A3B8",fontFamily:"'JetBrains Mono',monospace",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:8}}>Live Chamber Readings</div>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {Object.entries(sel.parameters||{}).slice(0,4).map(([k,v])=>{
                const isRoot=sel.root_causes?.includes(k), bp=Math.min(100,Math.abs(v)*30);
                return (
                  <div key={k}>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:10,fontFamily:"'JetBrains Mono',monospace",marginBottom:2}}>
                      <span style={{color:isRoot?"#FCD34D":"#CBD5E1",textTransform:"capitalize",display:"flex",alignItems:"center",gap:4}}>{isRoot&&<span style={{color:"#F59E0B",fontSize:8}}>⚠</span>}{k.replace(/_/g," ")}</span>
                      <span style={{color:isRoot?"#FDE68A":"#FFFFFF",fontWeight:600}}>{typeof v==="number"?v.toFixed(3):v}</span>
                    </div>
                    <div style={{background:"rgba(255,255,255,0.06)",borderRadius:9999,height:3,overflow:"hidden"}}>
                      <div style={{height:"100%",borderRadius:9999,width:`${bp}%`,background:isRoot?"#F59E0B":"#FB8D7E",transition:"width 0.4s ease"}}/>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {sel.drift_pattern&&sel.drift_pattern!=="none"&&(
            <div style={{marginTop:10,borderTop:"1px solid rgba(255,255,255,0.08)",paddingTop:8,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <span style={{fontSize:9,color:"#94A3B8",fontFamily:"'JetBrains Mono',monospace",textTransform:"uppercase"}}>Drift Pattern</span>
              <span style={{fontSize:10,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",textTransform:"uppercase",padding:"2px 8px",borderRadius:9999,background:"rgba(245,158,11,0.15)",color:"#FCD34D",border:"1px solid rgba(245,158,11,0.35)"}}>{sel.drift_pattern}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function doShockwave(scene:THREE.Scene,x:number,z:number,color:number){
  const mat=new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,transparent:true,opacity:0.85});
  const mesh=new THREE.Mesh(new THREE.RingGeometry(0.5,0.9,32),mat);
  mesh.rotation.x=-Math.PI/2; mesh.position.set(x,0.12,z); scene.add(mesh);
  let p=0;
  const tick=()=>{p+=0.035; const s=1+p*10; mesh.scale.set(s,s,s); mat.opacity=(1-p)*0.85; if(p<1) requestAnimationFrame(tick); else scene.remove(mesh);};
  requestAnimationFrame(tick);
}
