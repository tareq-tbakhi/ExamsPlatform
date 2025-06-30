/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// tslint:disable:organize-imports
// tslint:disable:ban-malformed-import-paths
// tslint:disable:no-new-decorators

import { useEffect, useRef } from 'react';
import { Analyser } from '@/lib/analyser';

import * as THREE from 'three';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { fs as backdropFS, vs as backdropVS } from '@/lib/backdrop-shader';
import { vs as sphereVS } from '@/lib/sphere-shader';

interface GdmLiveAudioVisuals3DProps {
  inputNode?: AudioNode;
  outputNode?: AudioNode;
}

/**
 * 3D live audio visual.
 */
export default function GdmLiveAudioVisuals3D({ inputNode, outputNode }: GdmLiveAudioVisuals3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputAnalyserRef = useRef<Analyser>();
  const outputAnalyserRef = useRef<Analyser>();
  const cameraRef = useRef<THREE.PerspectiveCamera>();
  const backdropRef = useRef<THREE.Mesh>();
  const composerRef = useRef<EffectComposer>();
  const sphereRef = useRef<THREE.Mesh>();
  const prevTimeRef = useRef(0);
  const rotationRef = useRef(new THREE.Vector3(0, 0, 0));
  const animationIdRef = useRef<number>();

  useEffect(() => {
    if (!canvasRef.current) return;

    if (inputNode) {
      inputAnalyserRef.current = new Analyser(inputNode);
    }
    if (outputNode) {
      outputAnalyserRef.current = new Analyser(outputNode);
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x100c14);

    const backdrop = new THREE.Mesh(
      new THREE.IcosahedronGeometry(10, 5),
      new THREE.RawShaderMaterial({
        uniforms: {
          resolution: { value: new THREE.Vector2(1, 1) },
          rand: { value: 0 },
        },
        vertexShader: backdropVS,
        fragmentShader: backdropFS,
        glslVersion: THREE.GLSL3,
      }),
    );
    backdrop.material.side = THREE.BackSide;
    scene.add(backdrop);
    backdropRef.current = backdrop;

    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000,
    );
    camera.position.set(2, -2, 5);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: !true,
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio / 1);

    const geometry = new THREE.IcosahedronGeometry(1, 10);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();

    const sphereMaterial = new THREE.MeshStandardMaterial({
      color: 0x000010,
      metalness: 0.5,
      roughness: 0.1,
      emissive: 0x000010,
      emissiveIntensity: 1.5,
    });

    sphereMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.time = { value: 0 };
      shader.uniforms.inputData = { value: new THREE.Vector4() };
      shader.uniforms.outputData = { value: new THREE.Vector4() };

      sphereMaterial.userData.shader = shader;

      shader.vertexShader = sphereVS;
    };

    const sphere = new THREE.Mesh(geometry, sphereMaterial);
    scene.add(sphere);
    sphere.visible = true; // Always visible for now

    sphereRef.current = sphere;

    const renderPass = new RenderPass(scene, camera);

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      5,
      0.5,
      0,
    );

    const fxaaPass = new ShaderPass(FXAAShader);

    const composer = new EffectComposer(renderer);
    composer.addPass(renderPass);
    composer.addPass(bloomPass);
    composerRef.current = composer;

    function onWindowResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      const dPR = renderer.getPixelRatio();
      const w = window.innerWidth;
      const h = window.innerHeight;
      backdrop.material.uniforms.resolution.value.set(w * dPR, h * dPR);
      renderer.setSize(w, h);
      composer.setSize(w, h);
      fxaaPass.material.uniforms['resolution'].value.set(
        1 / (w * dPR),
        1 / (h * dPR),
      );
    }

    window.addEventListener('resize', onWindowResize);
    onWindowResize();

    const animation = () => {
      animationIdRef.current = requestAnimationFrame(animation);

      if (inputAnalyserRef.current) {
        inputAnalyserRef.current.update();
      }
      if (outputAnalyserRef.current) {
        outputAnalyserRef.current.update();
      }

      const t = performance.now();
      const dt = (t - prevTimeRef.current) / (1000 / 60);
      prevTimeRef.current = t;
      const backdropMaterial = backdropRef.current?.material as THREE.RawShaderMaterial;
      const sphereMaterial = sphereRef.current?.material as THREE.MeshStandardMaterial;

      if (backdropMaterial) {
        backdropMaterial.uniforms.rand.value = Math.random() * 10000;
      }

      if (sphereMaterial?.userData.shader && sphereRef.current) {
        const outputData = outputAnalyserRef.current?.data || new Uint8Array(16);
        const inputData = inputAnalyserRef.current?.data || new Uint8Array(16);

        sphereRef.current.scale.setScalar(
          1 + (0.2 * outputData[1]) / 255,
        );

        const f = 0.001;
        rotationRef.current.x += (dt * f * 0.5 * outputData[1]) / 255;
        rotationRef.current.z += (dt * f * 0.5 * inputData[1]) / 255;
        rotationRef.current.y += (dt * f * 0.25 * inputData[2]) / 255;
        rotationRef.current.y += (dt * f * 0.25 * outputData[2]) / 255;

        const euler = new THREE.Euler(
          rotationRef.current.x,
          rotationRef.current.y,
          rotationRef.current.z,
        );
        const quaternion = new THREE.Quaternion().setFromEuler(euler);
        const vector = new THREE.Vector3(0, 0, 5);
        vector.applyQuaternion(quaternion);
        cameraRef.current?.position.copy(vector);
        cameraRef.current?.lookAt(sphereRef.current.position);

        sphereMaterial.userData.shader.uniforms.time.value +=
          (dt * 0.1 * outputData[0]) / 255;
        sphereMaterial.userData.shader.uniforms.inputData.value.set(
          (1 * inputData[0]) / 255,
          (0.1 * inputData[1]) / 255,
          (10 * inputData[2]) / 255,
          0,
        );
        sphereMaterial.userData.shader.uniforms.outputData.value.set(
          (2 * outputData[0]) / 255,
          (0.1 * outputData[1]) / 255,
          (10 * outputData[2]) / 255,
          0,
        );
      }

      composerRef.current?.render();
    };

    animation();

    return () => {
      window.removeEventListener('resize', onWindowResize);
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      renderer.dispose();
      pmremGenerator.dispose();
    };
  }, [inputNode, outputNode]);

  return (
    <canvas 
      ref={canvasRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'absolute',
        inset: 0,
        imageRendering: 'pixelated'
      }}
    />
  );
} 