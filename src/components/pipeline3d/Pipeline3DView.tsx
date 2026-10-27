import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SimulationState, StageName } from '../../simulator/types';
import {
  RotateCcw,
  Eye,
  Layers,
  Sparkles,
  Zap,
  Info,
  Maximize2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface Pipeline3DViewProps {
  state: SimulationState | null;
  selectedStage: StageName | null;
  onSelectStage: (stage: StageName | null) => void;
  onSelectInstruction: (id: number | null) => void;
}

const STAGE_POSITIONS: Record<StageName, number> = {
  IF: -14,
  ID: -7,
  EX: 0,
  MEM: 7,
  WB: 14,
};

const STAGE_COLORS: Record<StageName, number> = {
  IF: 0x3b82f6,  // Blue
  ID: 0x8b5cf6,  // Purple
  EX: 0x06b6d4,  // Cyan
  MEM: 0x10b981, // Emerald
  WB: 0xf59e0b,  // Amber
};

export const Pipeline3DView: React.FC<Pipeline3DViewProps> = ({
  state,
  selectedStage,
  onSelectStage,
  onSelectInstruction,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [hudCollapsed, setHudCollapsed] = useState(false);
  const [cameraPreset, setCameraPreset] = useState<'hero' | 'top' | 'focus'>('hero');
  const [hoveredStage, setHoveredStage] = useState<StageName | null>(null);

  // References to keep Three.js scene alive without re-instantiation
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  // Meshes mapped to stages
  const stageGroupsRef = useRef<Record<StageName, THREE.Group | null>>({
    IF: null,
    ID: null,
    EX: null,
    MEM: null,
    WB: null,
  });

  // Animated instruction token meshes
  const tokenMeshesRef = useRef<Record<StageName, THREE.Group | null>>({
    IF: null,
    ID: null,
    EX: null,
    MEM: null,
    WB: null,
  });

  // Forwarding conduit lines
  const forwardingLineExMemRef = useRef<THREE.Line | null>(null);
  const forwardingLineMemWbRef = useRef<THREE.Line | null>(null);
  const branchFeedbackLineRef = useRef<THREE.Line | null>(null);

  // Initialize Three.js scene
  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;

    // Detect software WebGL
    const isSoftwareGl = (() => {
      try {
        const gl = document.createElement('canvas').getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    // 1. Scene & Fog
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0f17);
    scene.fog = new THREE.FogExp2(0x0b0f17, 0.015);
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 14, 28);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 4. Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2 - 0.05; // Prevent flipping below floor
    controls.minDistance = 8;
    controls.maxDistance = 60;
    controls.target.set(0, 1.5, 0);
    controlsRef.current = controls;

    // 5. Studio Lighting Rig
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x0f172a, 0.6);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
    keyLight.position.set(10, 20, 15);
    keyLight.castShadow = !isSoftwareGl;
    if (keyLight.castShadow) {
      keyLight.shadow.mapSize.width = 1024;
      keyLight.shadow.mapSize.height = 1024;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x06b6d4, 0.8);
    rimLight.position.set(-15, 12, -10);
    scene.add(rimLight);

    // 6. Architectural Datapath Floor Grid
    const gridHelper = new THREE.GridHelper(50, 50, 0x1e293b, 0x0f172a);
    gridHelper.position.y = -0.02;
    scene.add(gridHelper);

    // Datapath bus ribbon on floor
    const busGeometry = new THREE.PlaneGeometry(34, 1.8);
    const busMaterial = new THREE.MeshBasicMaterial({
      color: 0x1e293b,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    });
    const busMesh = new THREE.Mesh(busGeometry, busMaterial);
    busMesh.rotation.x = -Math.PI / 2;
    busMesh.position.set(0, 0.01, 0);
    scene.add(busMesh);

    // Golden bus traces
    for (let i = -0.6; i <= 0.6; i += 0.4) {
      const traceGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-16, 0.02, i),
        new THREE.Vector3(16, 0.02, i),
      ]);
      const traceMat = new THREE.LineBasicMaterial({
        color: 0x334155,
        transparent: true,
        opacity: 0.8,
      });
      scene.add(new THREE.Line(traceGeo, traceMat));
    }

    // 7. Build Procedural 3D Stage Units
    const stages: StageName[] = ['IF', 'ID', 'EX', 'MEM', 'WB'];
    stages.forEach((stage) => {
      const group = new THREE.Group();
      const posX = STAGE_POSITIONS[stage];
      group.position.set(posX, 0, 0);
      group.userData = { stageName: stage };

      const baseColor = STAGE_COLORS[stage];

      // Stage Base Pedestal (Layer 1)
      const baseGeo = new THREE.BoxGeometry(4.2, 0.5, 4.2);
      const baseMat = new THREE.MeshStandardMaterial({
        color: 0x111827,
        roughness: 0.5,
        metalness: 0.8,
      });
      const base = new THREE.Mesh(baseGeo, baseMat);
      base.position.y = 0.25;
      base.castShadow = true;
      base.receiveShadow = true;
      group.add(base);

      // Glowing Perimeter Ring (Layer 2)
      const ringGeo = new THREE.BoxGeometry(4.24, 0.08, 4.24);
      const ringMat = new THREE.MeshBasicMaterial({
        color: baseColor,
        transparent: true,
        opacity: 0.8,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.y = 0.52;
      group.add(ring);

      // Architectural Stage Core (Layer 3 - specific to stage type)
      if (stage === 'IF') {
        // Instruction Cache Tower + PC Register
        const towerGeo = new THREE.BoxGeometry(2.4, 2.8, 2.4);
        const towerMat = new THREE.MeshStandardMaterial({
          color: 0x1e293b,
          roughness: 0.3,
          metalness: 0.7,
        });
        const tower = new THREE.Mesh(towerGeo, towerMat);
        tower.position.y = 1.9;
        tower.castShadow = true;
        group.add(tower);

        // PC Adder cylinder
        const adderGeo = new THREE.CylinderGeometry(0.5, 0.5, 1.2, 16);
        const adderMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, metalness: 0.8 });
        const adder = new THREE.Mesh(adderGeo, adderMat);
        adder.position.set(1.1, 1.1, 1.1);
        group.add(adder);
      } else if (stage === 'ID') {
        // 32-Register File Dual Bank + Decode Chip
        const bank1Geo = new THREE.BoxGeometry(1.2, 2.2, 2.8);
        const bankMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.7 });
        const bank1 = new THREE.Mesh(bank1Geo, bankMat);
        bank1.position.set(-0.8, 1.6, 0);
        group.add(bank1);

        const bank2 = bank1.clone();
        bank2.position.set(0.8, 1.6, 0);
        group.add(bank2);

        // Decoder Core
        const chipGeo = new THREE.BoxGeometry(1.0, 0.4, 1.0);
        const chipMat = new THREE.MeshStandardMaterial({ color: 0x8b5cf6, metalness: 0.9, roughness: 0.2 });
        const chip = new THREE.Mesh(chipGeo, chipMat);
        chip.position.set(0, 2.8, 0);
        group.add(chip);
      } else if (stage === 'EX') {
        // Iconic ALU Chevron / V-Shape Block
        const aluGroup = new THREE.Group();
        const aluArm1Geo = new THREE.BoxGeometry(1.4, 2.2, 1.4);
        const aluMat = new THREE.MeshStandardMaterial({
          color: 0x0f172a,
          roughness: 0.2,
          metalness: 0.85,
        });
        const arm1 = new THREE.Mesh(aluArm1Geo, aluMat);
        arm1.position.set(-0.8, 1.8, 0.4);
        arm1.rotation.y = 0.2;
        aluGroup.add(arm1);

        const arm2 = new THREE.Mesh(aluArm1Geo, aluMat);
        arm2.position.set(0.8, 1.8, 0.4);
        arm2.rotation.y = -0.2;
        aluGroup.add(arm2);

        // ALU glowing compute core
        const coreGeo = new THREE.BoxGeometry(1.6, 1.4, 1.6);
        const coreMat = new THREE.MeshStandardMaterial({
          color: 0x06b6d4,
          emissive: 0x0891b2,
          emissiveIntensity: 0.6,
          metalness: 0.5,
        });
        const core = new THREE.Mesh(coreGeo, coreMat);
        core.position.set(0, 1.5, -0.4);
        aluGroup.add(core);

        group.add(aluGroup);
      } else if (stage === 'MEM') {
        // High-Density Data RAM Matrix
        const ramGeo = new THREE.BoxGeometry(2.8, 2.4, 2.8);
        const ramMat = new THREE.MeshStandardMaterial({
          color: 0x132a24,
          roughness: 0.3,
          metalness: 0.8,
        });
        const ram = new THREE.Mesh(ramGeo, ramMat);
        ram.position.y = 1.7;
        ram.castShadow = true;
        group.add(ram);

        // Memory cell fins
        for (let f = -1; f <= 1; f += 0.5) {
          const finGeo = new THREE.BoxGeometry(2.9, 0.1, 0.15);
          const finMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
          const fin = new THREE.Mesh(finGeo, finMat);
          fin.position.set(0, 1.7 + f * 0.8, 1.45);
          group.add(fin);
        }
      } else if (stage === 'WB') {
        // Writeback Multiplexer & Return Conduit
        const wbGeo = new THREE.CylinderGeometry(1.4, 1.6, 2.2, 8);
        const wbMat = new THREE.MeshStandardMaterial({
          color: 0x241d13,
          roughness: 0.35,
          metalness: 0.8,
        });
        const wb = new THREE.Mesh(wbGeo, wbMat);
        wb.position.y = 1.6;
        wb.castShadow = true;
        group.add(wb);

        // Top cap selector
        const capGeo = new THREE.CylinderGeometry(0.8, 0.8, 0.5, 16);
        const capMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.9 });
        const cap = new THREE.Mesh(capGeo, capMat);
        cap.position.y = 2.8;
        group.add(cap);
      }

      // Stage Title Canvas Label in 3D
      const labelCanvas = document.createElement('canvas');
      labelCanvas.width = 256;
      labelCanvas.height = 128;
      const ctx = labelCanvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, 256, 128);
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 4;
        ctx.strokeRect(4, 4, 248, 120);
        ctx.font = 'bold 54px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(stage, 128, 64);
      }
      const labelTex = new THREE.CanvasTexture(labelCanvas);
      labelTex.colorSpace = THREE.SRGBColorSpace;
      const labelMat = new THREE.SpriteMaterial({ map: labelTex, transparent: true, opacity: 0.95 });
      const labelSprite = new THREE.Sprite(labelMat);
      labelSprite.position.set(0, 4.4, 0);
      labelSprite.scale.set(2.8, 1.4, 1);
      group.add(labelSprite);

      scene.add(group);
      stageGroupsRef.current[stage] = group;

      // Create animated instruction token placeholder for this stage
      const tokenGroup = new THREE.Group();
      tokenGroup.position.set(posX, 5.5, 0);
      tokenGroup.visible = false;

      // Token Capsule Mesh
      const tokenGeo = new THREE.BoxGeometry(2.4, 0.8, 1.2);
      const tokenMat = new THREE.MeshStandardMaterial({
        color: baseColor,
        emissive: baseColor,
        emissiveIntensity: 0.4,
        roughness: 0.2,
        metalness: 0.8,
      });
      const tokenMesh = new THREE.Mesh(tokenGeo, tokenMat);
      tokenGroup.add(tokenMesh);

      // Token text sprite placeholder
      const tokenCanvas = document.createElement('canvas');
      tokenCanvas.width = 256;
      tokenCanvas.height = 64;
      const tCtx = tokenCanvas.getContext('2d');
      if (tCtx) {
        tCtx.fillStyle = '#ffffff';
        tCtx.font = 'bold 36px "JetBrains Mono", monospace';
        tCtx.textAlign = 'center';
        tCtx.textBaseline = 'middle';
        tCtx.fillText('NOP', 128, 32);
      }
      const tokenTex = new THREE.CanvasTexture(tokenCanvas);
      tokenTex.colorSpace = THREE.SRGBColorSpace;
      const tokenSpriteMat = new THREE.SpriteMaterial({ map: tokenTex, transparent: true });
      const tokenSprite = new THREE.Sprite(tokenSpriteMat);
      tokenSprite.position.set(0, 0, 0.7);
      tokenSprite.scale.set(2.2, 0.6, 1);
      tokenSprite.name = 'tokenTextSprite';
      tokenGroup.add(tokenSprite);

      scene.add(tokenGroup);
      tokenMeshesRef.current[stage] = tokenGroup;
    });

    // 8. 3D Forwarding Arcs (Curves arching backwards from MEM and WB to EX)
    // EX/MEM -> EX bypass arc
    const curve1 = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(STAGE_POSITIONS.MEM, 3.2, 1.2),
      new THREE.Vector3((STAGE_POSITIONS.MEM + STAGE_POSITIONS.EX) / 2, 7.5, 3.5),
      new THREE.Vector3(STAGE_POSITIONS.EX, 3.2, 1.2)
    );
    const points1 = curve1.getPoints(32);
    const geo1 = new THREE.BufferGeometry().setFromPoints(points1);
    const mat1 = new THREE.LineBasicMaterial({
      color: 0x10b981,
      linewidth: 3,
      transparent: true,
      opacity: 0.2,
    });
    const line1 = new THREE.Line(geo1, mat1);
    scene.add(line1);
    forwardingLineExMemRef.current = line1;

    // MEM/WB -> EX bypass arc
    const curve2 = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(STAGE_POSITIONS.WB, 3.2, 1.5),
      new THREE.Vector3((STAGE_POSITIONS.WB + STAGE_POSITIONS.EX) / 2, 9.5, 5.0),
      new THREE.Vector3(STAGE_POSITIONS.EX, 3.2, 1.5)
    );
    const points2 = curve2.getPoints(32);
    const geo2 = new THREE.BufferGeometry().setFromPoints(points2);
    const mat2 = new THREE.LineBasicMaterial({
      color: 0x34d399,
      linewidth: 3,
      transparent: true,
      opacity: 0.2,
    });
    const line2 = new THREE.Line(geo2, mat2);
    scene.add(line2);
    forwardingLineMemWbRef.current = line2;

    // Branch Redirect conduit (EX -> IF)
    const curve3 = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(STAGE_POSITIONS.EX, 3.0, -1.5),
      new THREE.Vector3((STAGE_POSITIONS.EX + STAGE_POSITIONS.IF) / 2, 8.0, -4.5),
      new THREE.Vector3(STAGE_POSITIONS.IF, 3.0, -1.5)
    );
    const points3 = curve3.getPoints(32);
    const geo3 = new THREE.BufferGeometry().setFromPoints(points3);
    const mat3 = new THREE.LineBasicMaterial({
      color: 0xef4444,
      linewidth: 3,
      transparent: true,
      opacity: 0.2,
    });
    const line3 = new THREE.Line(geo3, mat3);
    scene.add(line3);
    branchFeedbackLineRef.current = line3;

    // 9. Raycasting for Stage Clicking & Hovering
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerMove = (evt: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((evt.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((evt.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const stageMeshes = Object.values(stageGroupsRef.current).filter(Boolean) as THREE.Group[];
      const intersects = raycaster.intersectObjects(stageMeshes, true);

      if (intersects.length > 0) {
        let rootGroup: THREE.Object3D | null = intersects[0].object;
        while (rootGroup && !rootGroup.userData.stageName) {
          rootGroup = rootGroup.parent;
        }
        if (rootGroup && rootGroup.userData.stageName) {
          setHoveredStage(rootGroup.userData.stageName);
          renderer.domElement.style.cursor = 'pointer';
          return;
        }
      }
      setHoveredStage(null);
      renderer.domElement.style.cursor = 'default';
    };

    const handleClick = () => {
      raycaster.setFromCamera(mouse, camera);
      const stageMeshes = Object.values(stageGroupsRef.current).filter(Boolean) as THREE.Group[];
      const intersects = raycaster.intersectObjects(stageMeshes, true);

      if (intersects.length > 0) {
        let rootGroup: THREE.Object3D | null = intersects[0].object;
        while (rootGroup && !rootGroup.userData.stageName) {
          rootGroup = rootGroup.parent;
        }
        if (rootGroup && rootGroup.userData.stageName) {
          onSelectStage(rootGroup.userData.stageName);
        }
      }
    };

    renderer.domElement.addEventListener('pointermove', handlePointerMove);
    renderer.domElement.addEventListener('click', handleClick);

    // 10. Animation Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Gentle floating animation for instruction tokens
      stages.forEach((stage, idx) => {
        const token = tokenMeshesRef.current[stage];
        if (token && token.visible) {
          token.position.y = 5.2 + Math.sin(elapsedTime * 2.5 + idx) * 0.15;
        }
      });

      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    // 11. Handle Resizing
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('click', handleClick);
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Update visual state when simulation state changes
  useEffect(() => {
    if (!state) return;

    const stages: StageName[] = ['IF', 'ID', 'EX', 'MEM', 'WB'];

    stages.forEach((stage) => {
      const stageState = state.stages[stage];
      const tokenGroup = tokenMeshesRef.current[stage];
      const group = stageGroupsRef.current[stage];

      if (!tokenGroup || !group) return;

      const hasInstruction = stageState && stageState.instruction !== null;
      tokenGroup.visible = hasInstruction;

      if (hasInstruction && stageState.instruction) {
        const inst = stageState.instruction;
        const textSprite = tokenGroup.getObjectByName('tokenTextSprite') as THREE.Sprite;
        const tokenMesh = tokenGroup.children[0] as THREE.Mesh;

        if (textSprite && tokenMesh) {
          // Update text canvas
          const canvas = document.createElement('canvas');
          canvas.width = 256;
          canvas.height = 64;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 32px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const labelText = `${inst.opcode} ${inst.rd !== undefined ? `R${inst.rd}` : ''}`;
            ctx.fillText(labelText.trim(), 128, 32);
          }
          const tex = new THREE.CanvasTexture(canvas);
          tex.colorSpace = THREE.SRGBColorSpace;
          textSprite.material.map?.dispose();
          textSprite.material.map = tex;

          // Material styling based on status
          const meshMat = tokenMesh.material as THREE.MeshStandardMaterial;
          if (stageState.status === 'stalled') {
            meshMat.color.setHex(0xf59e0b); // Amber
            meshMat.emissive.setHex(0xd97706);
            meshMat.emissiveIntensity = 0.8;
          } else if (stageState.status === 'flushed') {
            meshMat.color.setHex(0xef4444); // Red
            meshMat.emissive.setHex(0xb91c1c);
            meshMat.emissiveIntensity = 0.8;
          } else {
            // Normal active
            const c = STAGE_COLORS[stage];
            meshMat.color.setHex(c);
            meshMat.emissive.setHex(c);
            meshMat.emissiveIntensity = 0.4;
          }
        }
      }

      // Highlight selected stage
      const isSelected = selectedStage === stage;
      const isHovered = hoveredStage === stage;
      group.position.y = isSelected ? 0.4 : isHovered ? 0.2 : 0;
    });

    // Animate Forwarding bypass conduits
    const hasForwardingExMem = state.activeForwardings.some((f) => f.fromStage === 'EX/MEM');
    const hasForwardingMemWb = state.activeForwardings.some((f) => f.fromStage === 'MEM/WB');

    if (forwardingLineExMemRef.current) {
      const mat = forwardingLineExMemRef.current.material as THREE.LineBasicMaterial;
      mat.opacity = hasForwardingExMem ? 1.0 : 0.2;
      mat.color.setHex(hasForwardingExMem ? 0x10b981 : 0x059669);
    }

    if (forwardingLineMemWbRef.current) {
      const mat = forwardingLineMemWbRef.current.material as THREE.LineBasicMaterial;
      mat.opacity = hasForwardingMemWb ? 1.0 : 0.2;
      mat.color.setHex(hasForwardingMemWb ? 0x34d399 : 0x059669);
    }

    // Animate Branch Feedback conduit
    const hasBranchFlush = state.activeHazards.some((h) => h.type === 'BRANCH_TAKEN');
    if (branchFeedbackLineRef.current) {
      const mat = branchFeedbackLineRef.current.material as THREE.LineBasicMaterial;
      mat.opacity = hasBranchFlush ? 1.0 : 0.2;
      mat.color.setHex(hasBranchFlush ? 0xef4444 : 0x7f1d1d);
    }
  }, [state, selectedStage, hoveredStage]);

  // Camera Presets
  const setCameraView = (preset: 'hero' | 'top' | 'focus') => {
    setCameraPreset(preset);
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    if (preset === 'hero') {
      camera.position.set(0, 14, 28);
      controls.target.set(0, 1.5, 0);
    } else if (preset === 'top') {
      camera.position.set(0, 36, 0.1);
      controls.target.set(0, 0, 0);
    } else if (preset === 'focus') {
      const targetX = selectedStage ? STAGE_POSITIONS[selectedStage] : 0;
      camera.position.set(targetX, 6, 12);
      controls.target.set(targetX, 2, 0);
    }
    controls.update();
  };

  return (
    <div className="relative w-full h-full min-h-[480px] bg-slate-950 overflow-hidden select-none">
      {/* 3D WebGL Canvas Container */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top Left Spec / State Badge */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-3 bg-slate-900/80 backdrop-blur-md px-3.5 py-2 rounded-lg border border-slate-800 text-xs text-slate-300">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-100">RISC 5-Stage Datapath</span>
          <span className="text-slate-500">·</span>
          <span className="tabular-nums font-mono text-cyan-400">Cycle {state?.cycle ?? 0}</span>
        </div>
        {state?.isStalled && (
          <span className="text-amber-400 font-medium">· STALL ACTIVE</span>
        )}
        {state?.activeHazards.some((h) => h.type === 'BRANCH_TAKEN') && (
          <span className="text-rose-400 font-medium">· BRANCH FLUSH</span>
        )}
      </div>

      {/* Top Right Camera Presets */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-md p-1 rounded-lg border border-slate-800">
        <button
          onClick={() => setCameraView('hero')}
          className={`px-2.5 py-1 text-xs rounded transition-colors ${
            cameraPreset === 'hero' ? 'bg-cyan-500/20 text-cyan-300 font-medium' : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Perspective View"
        >
          Perspective
        </button>
        <button
          onClick={() => setCameraView('top')}
          className={`px-2.5 py-1 text-xs rounded transition-colors ${
            cameraPreset === 'top' ? 'bg-cyan-500/20 text-cyan-300 font-medium' : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Top-Down Datapath View"
        >
          Datapath
        </button>
        <button
          onClick={() => setCameraView('focus')}
          className={`px-2.5 py-1 text-xs rounded transition-colors ${
            cameraPreset === 'focus' ? 'bg-cyan-500/20 text-cyan-300 font-medium' : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Stage Zoom"
        >
          Stage Focus
        </button>
        <button
          onClick={() => setCameraView('hero')}
          className="p-1 text-slate-400 hover:text-slate-200 rounded transition-colors"
          title="Reset Camera"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Unified Bottom Dock (Collapsible, Zero Viewport Occlusion) */}
      <div
        className={`absolute bottom-4 left-1/2 -translate-x-1/2 z-10 w-[94%] max-w-4xl transition-all duration-300 ease-out ${
          hudCollapsed ? 'translate-y-[calc(100%-28px)]' : 'translate-y-0'
        }`}
      >
        {/* Collapse toggle tab */}
        <div className="flex justify-center mb-1">
          <button
            onClick={() => setHudCollapsed((prev) => !prev)}
            className="flex items-center gap-1.5 px-3 py-1 bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-[11px] font-medium text-slate-300 rounded-t-md transition-colors"
          >
            {hudCollapsed ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            <span>{hudCollapsed ? 'Show Stage HUD' : 'Collapse HUD'}</span>
          </button>
        </div>

        {/* Dock Surface */}
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800/80 rounded-xl p-3.5 shadow-2xl text-xs">
          <div className="grid grid-cols-5 gap-2.5">
            {(['IF', 'ID', 'EX', 'MEM', 'WB'] as StageName[]).map((stg) => {
              const stageData = state?.stages[stg];
              const inst = stageData?.instruction;
              const isSelected = selectedStage === stg;
              const isStalled = stageData?.status === 'stalled';
              const isFlushed = stageData?.status === 'flushed';

              return (
                <div
                  key={stg}
                  onClick={() => onSelectStage(isSelected ? null : stg)}
                  className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
                    isSelected
                      ? 'border-cyan-500 bg-cyan-950/30'
                      : 'border-slate-800/90 bg-slate-950/60 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-200">{stg}</span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                        isStalled
                          ? 'bg-amber-950/70 text-amber-400'
                          : isFlushed
                          ? 'bg-rose-950/70 text-rose-400'
                          : inst
                          ? 'bg-cyan-950/70 text-cyan-400'
                          : 'text-slate-600'
                      }`}
                    >
                      {isStalled ? 'STALL' : isFlushed ? 'FLUSH' : inst ? 'OCCUPIED' : 'IDLE'}
                    </span>
                  </div>

                  <div className="truncate font-mono text-slate-300 text-[11px] h-4">
                    {inst ? inst.raw : '—'}
                  </div>

                  <div className="mt-1 text-[10px] text-slate-500 flex justify-between">
                    <span>{stg === 'IF' ? 'PC Fetch' : stg === 'ID' ? 'Decode/Reg' : stg === 'EX' ? 'ALU' : stg === 'MEM' ? 'RAM Access' : 'Writeback'}</span>
                    {inst && <span>#{inst.id + 1}</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Active Forwarding / Hazard Banner inside Dock */}
          {(state?.activeForwardings.length ?? 0) > 0 && (
            <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center gap-2 text-emerald-400 text-[11px]">
              <Zap className="w-3.5 h-3.5 shrink-0" />
              <div className="truncate">
                <span className="font-semibold">Forwarding Active: </span>
                {state?.activeForwardings.map((f) => f.description).join(' · ')}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
