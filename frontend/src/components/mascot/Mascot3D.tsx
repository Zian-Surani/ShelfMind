import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface Mascot3DProps {
  className?: string;
  mood?: 'calm' | 'thinking' | 'attention' | 'success' | 'critical';
  onClick?: () => void;
}

export const Mascot3D: React.FC<Mascot3DProps> = ({
  className = '',
  mood = 'calm',
  onClick,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const mascotGroupRef = useRef<THREE.Group | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 220;
    const height = container.clientHeight || 220;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 0.2, 3.8);

    // 3. Renderer with transparency and high pixel ratio
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    // 4. Lights (Soft Claymorphism lighting)
    const ambientLight = new THREE.AmbientLight(0xfff8f0, 1.2);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.5);
    keyLight.position.set(3, 4, 3);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xd2e8d4, 0.8);
    fillLight.position.set(-3, -1, 2);
    scene.add(fillLight);

    // 5. Build 3D Clay Sprout Mascot Model
    const mascotGroup = new THREE.Group();
    mascotGroupRef.current = mascotGroup;

    // Materials with clay look (high roughness, soft sheen)
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xfdfaf5,
      roughness: 0.45,
      metalness: 0.05,
    });

    const leafMat = new THREE.MeshStandardMaterial({
      color: 0x4a8258,
      roughness: 0.35,
      metalness: 0.1,
    });

    const cheekMat = new THREE.MeshStandardMaterial({
      color: 0xfca5a5,
      roughness: 0.6,
      transparent: true,
      opacity: 0.65,
    });

    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0x19211d,
      roughness: 0.2,
    });

    const pupilMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    // Head (cute round sphere)
    const headGeo = new THREE.SphereGeometry(0.72, 32, 32);
    const head = new THREE.Mesh(headGeo, bodyMat);
    head.position.y = 0.1;
    mascotGroup.add(head);

    // Left Eye
    const eyeGeo = new THREE.SphereGeometry(0.09, 16, 16);
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.25, 0.16, 0.64);
    mascotGroup.add(leftEye);

    const pupilGeo = new THREE.SphereGeometry(0.032, 8, 8);
    const leftPupil = new THREE.Mesh(pupilGeo, pupilMat);
    leftPupil.position.set(-0.23, 0.19, 0.71);
    mascotGroup.add(leftPupil);

    // Right Eye
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.25, 0.16, 0.64);
    mascotGroup.add(rightEye);

    const rightPupil = new THREE.Mesh(pupilGeo, pupilMat);
    rightPupil.position.set(0.27, 0.19, 0.71);
    mascotGroup.add(rightPupil);

    // Cheeks
    const cheekGeo = new THREE.CircleGeometry(0.09, 16);
    const leftCheek = new THREE.Mesh(cheekGeo, cheekMat);
    leftCheek.position.set(-0.38, 0.04, 0.62);
    leftCheek.rotation.y = -0.35;
    mascotGroup.add(leftCheek);

    const rightCheek = new THREE.Mesh(cheekGeo, cheekMat);
    rightCheek.position.set(0.38, 0.04, 0.62);
    rightCheek.rotation.y = 0.35;
    mascotGroup.add(rightCheek);

    // Leaf Sprouts on top
    const leafGeo = new THREE.ConeGeometry(0.24, 0.6, 16);
    leafGeo.rotateZ(0.2);

    const leftLeaf = new THREE.Mesh(leafGeo, leafMat);
    leftLeaf.position.set(-0.16, 0.88, 0);
    leftLeaf.rotation.z = -0.45;
    leftLeaf.scale.set(1, 1, 0.35);
    mascotGroup.add(leftLeaf);

    const rightLeaf = new THREE.Mesh(leafGeo, leafMat);
    rightLeaf.position.set(0.16, 0.88, 0);
    rightLeaf.rotation.z = 0.45;
    rightLeaf.scale.set(1, 1, 0.35);
    mascotGroup.add(rightLeaf);

    scene.add(mascotGroup);

    // 6. Animation and mouse tracking
    let targetRotX = 0;
    let targetRotY = 0;
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      targetRotY = x * 0.45;
      targetRotX = -y * 0.25;
    };

    window.addEventListener('mousemove', handleMouseMove);

    const animate = () => {
      const elapsedTime = clock.getElapsedTime();

      if (mascotGroup) {
        // Floating gentle breathing bob
        mascotGroup.position.y = Math.sin(elapsedTime * 2.2) * 0.06;

        // Smooth rotation toward cursor
        mascotGroup.rotation.y += (targetRotY - mascotGroup.rotation.y) * 0.08;
        mascotGroup.rotation.x += (targetRotX - mascotGroup.rotation.x) * 0.08;

        // Leaf waving
        leftLeaf.rotation.z = -0.45 + Math.sin(elapsedTime * 3) * 0.05;
        rightLeaf.rotation.z = 0.45 - Math.sin(elapsedTime * 3) * 0.05;
      }

      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 220;
      const h = container.clientHeight || 220;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      onClick={onClick}
      className={`relative cursor-pointer transition-transform hover:scale-105 active:scale-95 ${className}`}
      title="ShelfMind 3D Mascot — Click to chat"
    />
  );
};
