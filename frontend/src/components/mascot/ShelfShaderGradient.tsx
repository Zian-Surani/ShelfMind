import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface ShelfShaderGradientProps {
  className?: string;
  speed?: number;
  strength?: number;
}

export const ShelfShaderGradient: React.FC<ShelfShaderGradientProps> = ({
  className = '',
  speed = 0.6,
  strength = 1.0,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || 450;

    // Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 3.5);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    container.appendChild(renderer.domElement);

    // Custom Fluid Shader Material
    const vertexShader = `
      uniform float uTime;
      uniform float uSpeed;
      uniform float uStrength;
      varying vec2 vUv;
      varying float vElevation;

      void main() {
        vUv = uv;
        vec3 pos = position;

        float elevation = sin(pos.x * 2.2 + uTime * uSpeed) * cos(pos.y * 1.8 + uTime * uSpeed * 0.8) * 0.28 * uStrength;
        elevation += sin(pos.x * 4.0 - uTime * uSpeed * 0.5) * 0.08 * uStrength;

        pos.z += elevation;
        vElevation = elevation;

        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `;

    const fragmentShader = `
      uniform vec3 uColor1;
      uniform vec3 uColor2;
      uniform vec3 uColor3;
      varying vec2 vUv;
      varying float vElevation;

      // Simple pseudo-random noise for subtle film grain
      float random(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
      }

      void main() {
        // Base color interpolation
        vec3 color = mix(uColor1, uColor2, vUv.x + vElevation * 0.8);
        color = mix(color, uColor3, vUv.y + vElevation * 0.5);

        // Add soft organic lighting highlights
        color += vec3(vElevation * 0.35);

        // Subtle film grain
        float grain = (random(vUv * 50.0) - 0.5) * 0.025;
        color += grain;

        gl_FragColor = vec4(color, 0.85);
      }
    `;

    const uniforms = {
      uTime: { value: 0 },
      uSpeed: { value: speed },
      uStrength: { value: strength },
      uColor1: { value: new THREE.Color('#F6F5F0') },
      uColor2: { value: new THREE.Color('#E2ECE0') },
      uColor3: { value: new THREE.Color('#C5DAC3') },
    };

    const geometry = new THREE.PlaneGeometry(6, 4, 64, 64);
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
      transparent: true,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -0.3;
    scene.add(mesh);

    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      uniforms.uTime.value = clock.getElapsedTime();
      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || 450;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, [speed, strength]);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Background CSS mesh fallback */}
      <div 
        className="absolute inset-0 z-0 opacity-80"
        style={{
          background: 'radial-gradient(ellipse at 30% 20%, #E3EBDD 0%, transparent 60%), radial-gradient(ellipse at 80% 80%, #C4D7C2 0%, transparent 50%), #F6F5F0',
        }}
      />

      {/* 3D WebGL Fluid Surface */}
      <div ref={mountRef} className="absolute inset-0 z-0 opacity-85 pointer-events-none" />
    </div>
  );
};
