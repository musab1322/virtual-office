"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import type { Vec3 } from "./floorplan";

export function Desk({
  position,
  screenOn = false,
  exec = false,
  onClick,
}: {
  position: Vec3;
  screenOn?: boolean;
  exec?: boolean; // مكتب المدير الخشبي
  onClick?: () => void;
}) {
  const screen = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (!screen.current) return;
    screen.current.emissiveIntensity = screenOn
      ? 0.9 + Math.sin(clock.elapsedTime * 6) * 0.25
      : 0.35;
  });
  // المكتب أمام المقعد بـ 0.6م
  return (
    <group
      position={[position[0], 0, position[2] + (exec ? 0.7 : 0.62)]}
      scale={exec ? [1.35, 1, 1.15] : 1}
      onClick={
        onClick
          ? (e) => {
              e.stopPropagation();
              onClick();
            }
          : undefined
      }
    >
      <RoundedBox
        args={[1.6, 0.06, 0.8]}
        radius={0.02}
        position={[0, 0.75, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={exec ? "#5a3d2b" : "#e9e9ea"} />
      </RoundedBox>
      {/* لوح أمامي يشبه الصورة */}
      <mesh position={[0, 0.4, 0.38]} castShadow receiveShadow>
        <boxGeometry args={[1.58, 0.68, 0.04]} />
        <meshStandardMaterial color={exec ? "#4a3022" : "#9aa0a6"} />
      </mesh>
      {[-0.76, 0.76].map((x) => (
        <mesh key={x} position={[x, 0.37, 0]} castShadow>
          <boxGeometry args={[0.05, 0.74, 0.76]} />
          <meshStandardMaterial color={exec ? "#4a3022" : "#8b9096"} />
        </mesh>
      ))}
      {/* شاشة */}
      <group position={[0, 0.78, 0.18]}>
        <mesh position={[0, 0.06, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 0.12]} />
          <meshStandardMaterial color="#333" />
        </mesh>
        <mesh position={[0, 0.28, 0]} castShadow>
          <boxGeometry args={[0.62, 0.36, 0.03]} />
          <meshStandardMaterial color="#1f2328" />
        </mesh>
        <mesh position={[0, 0.28, -0.017]}>
          <planeGeometry args={[0.57, 0.31]} />
          <meshStandardMaterial
            ref={screen}
            color="#0b1e36"
            emissive={screenOn ? "#3b82f6" : "#1e3a5f"}
            emissiveIntensity={0.35}
            side={THREE.BackSide}
          />
        </mesh>
      </group>
      {/* لوحة مفاتيح */}
      <mesh position={[0, 0.79, -0.15]}>
        <boxGeometry args={[0.45, 0.02, 0.14]} />
        <meshStandardMaterial color="#2a2d31" />
      </mesh>
      {/* كوب */}
      <mesh position={[0.55, 0.83, -0.05]}>
        <cylinderGeometry args={[0.04, 0.035, 0.1, 12]} />
        <meshStandardMaterial color="#f97316" />
      </mesh>
    </group>
  );
}

export function Chair({
  position,
  rotation = 0,
  color = "#2e3238",
}: {
  position: Vec3;
  rotation?: number;
  color?: string;
}) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.45, 0]} castShadow>
        <boxGeometry args={[0.5, 0.08, 0.48]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 0.85, -0.24]} castShadow>
        <boxGeometry args={[0.48, 0.62, 0.07]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 0.22, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.42]} />
        <meshStandardMaterial color="#777" metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[0.28, 0.28, 0.04, 5]} />
        <meshStandardMaterial color="#555" />
      </mesh>
    </group>
  );
}

export function Plant({ position, scale = 1 }: { position: Vec3; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.22, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.15, 0.44, 16]} />
        <meshStandardMaterial color="#f3f0ea" />
      </mesh>
      {[
        [0, 0.75, 0, 0.32],
        [0.16, 0.95, 0.06, 0.24],
        [-0.14, 1.0, -0.05, 0.25],
        [0.02, 1.2, 0.02, 0.2],
      ].map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]} castShadow>
          <icosahedronGeometry args={[r, 0]} />
          <meshStandardMaterial
            color={i % 2 ? "#3f8f3a" : "#2f7a35"}
            flatShading
          />
        </mesh>
      ))}
    </group>
  );
}

export function PendantLamp({ position }: { position: Vec3 }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.005, 0.005, 1.2]} />
        <meshStandardMaterial color="#444" />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.28, 24, 16]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#fff6e0"
          emissiveIntensity={0.9}
        />
      </mesh>
    </group>
  );
}

export function WindowWall({
  position,
  rotation = 0,
  width,
  panes,
}: {
  position: Vec3;
  rotation?: number;
  width: number;
  panes: number;
}) {
  const paneW = width / panes;
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* الجدار */}
      <mesh position={[0, 1.9, -0.06]} receiveShadow>
        <boxGeometry args={[width + 0.4, 3.8, 0.1]} />
        <meshStandardMaterial color="#eceae6" />
      </mesh>
      {Array.from({ length: panes }).map((_, i) => {
        const x = -width / 2 + paneW * (i + 0.5);
        return (
          <group key={i} position={[x, 1.85, 0]}>
            <mesh>
              <planeGeometry args={[paneW - 0.35, 2.6]} />
              <meshStandardMaterial
                color="#9cc6ef"
                emissive="#b9dcff"
                emissiveIntensity={0.45}
              />
            </mesh>
            {/* إطار النافذة */}
            {[
              [0, 1.3, paneW - 0.3, 0.07],
              [0, -1.3, paneW - 0.3, 0.07],
              [0, 0.35, paneW - 0.3, 0.05],
              [-(paneW - 0.35) / 2, 0, 0.07, 2.66],
              [(paneW - 0.35) / 2, 0, 0.07, 2.66],
              [0, 0, 0.05, 2.6],
            ].map(([fx, fy, fw, fh], j) => (
              <mesh key={j} position={[fx, fy, 0.02]}>
                <boxGeometry args={[fw, fh, 0.05]} />
                <meshStandardMaterial color="#3d4248" />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
}

export function Bookshelf({
  position,
  rotation = 0,
}: {
  position: Vec3;
  rotation?: number;
}) {
  const books = useMemo(
    () =>
      Array.from({ length: 4 }).flatMap((_, row) =>
        Array.from({ length: 6 }).map((__, i) => ({
          x: -0.45 + i * 0.17,
          y: 0.35 + row * 0.5,
          h: 0.22 + ((i * 7 + row * 3) % 5) * 0.03,
          c: ["#b45309", "#1d4ed8", "#15803d", "#be123c", "#6b7280", "#a16207"][
            (i + row) % 6
          ],
        })),
      ),
    [],
  );
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 1.1, 0]} castShadow>
        <boxGeometry args={[1.2, 2.2, 0.35]} />
        <meshStandardMaterial color="#6b4f3a" />
      </mesh>
      {books.map((b, i) => (
        <mesh key={i} position={[b.x, b.y + b.h / 2 - 0.1, 0.12]}>
          <boxGeometry args={[0.12, b.h, 0.2]} />
          <meshStandardMaterial color={b.c} />
        </mesh>
      ))}
    </group>
  );
}

export function Sofa({
  position,
  rotation = 0,
}: {
  position: Vec3;
  rotation?: number;
}) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <RoundedBox
        args={[2.2, 0.4, 0.9]}
        radius={0.08}
        position={[0, 0.3, 0]}
        castShadow
      >
        <meshStandardMaterial color="#5b6b7c" />
      </RoundedBox>
      <RoundedBox
        args={[2.2, 0.6, 0.22]}
        radius={0.08}
        position={[0, 0.65, -0.36]}
        castShadow
      >
        <meshStandardMaterial color="#5b6b7c" />
      </RoundedBox>
      {[-1.05, 1.05].map((x) => (
        <RoundedBox
          key={x}
          args={[0.2, 0.55, 0.9]}
          radius={0.06}
          position={[x, 0.45, 0]}
          castShadow
        >
          <meshStandardMaterial color="#4b5a6a" />
        </RoundedBox>
      ))}
    </group>
  );
}


/** جدار زجاجي مستقيم من نقطة إلى نقطة (بإطار علوي وقوائم) */
export function GlassWall({ from, to }: { from: [number, number]; to: [number, number] }) {
  const [x1, z1] = from;
  const [x2, z2] = to;
  const len = Math.hypot(x2 - x1, z2 - z1);
  const rot = -Math.atan2(z2 - z1, x2 - x1);
  return (
    <group position={[(x1 + x2) / 2, 0, (z1 + z2) / 2]} rotation={[0, rot, 0]}>
      <mesh position={[0, 1.35, 0]}>
        <boxGeometry args={[len, 2.7, 0.04]} />
        <meshStandardMaterial color="#cfe6f7" transparent opacity={0.2} depthWrite={false} />
      </mesh>
      <mesh position={[0, 2.7, 0]}>
        <boxGeometry args={[len, 0.07, 0.08]} />
        <meshStandardMaterial color="#3d4248" />
      </mesh>
      <mesh position={[0, 0.03, 0]}>
        <boxGeometry args={[len, 0.06, 0.08]} />
        <meshStandardMaterial color="#3d4248" />
      </mesh>
      {[-len / 2, len / 2].map((x) => (
        <mesh key={x} position={[x, 1.35, 0]}>
          <boxGeometry args={[0.07, 2.7, 0.08]} />
          <meshStandardMaterial color="#3d4248" />
        </mesh>
      ))}
    </group>
  );
}

/** أرضية مميزة لغرفة */
export function RoomFloor({
  x,
  z,
  color,
}: {
  x: [number, number];
  z: [number, number];
  color: string;
}) {
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[(x[0] + x[1]) / 2, 0.004, (z[0] + z[1]) / 2]}
      receiveShadow
    >
      <planeGeometry args={[x[1] - x[0], z[1] - z[0]]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

/** شاشة عرض (Teams) معلّقة */
export function WallScreen({
  position,
  rotation = 0,
  width = 2.4,
}: {
  position: Vec3;
  rotation?: number;
  width?: number;
}) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh>
        <boxGeometry args={[width, width * 0.56, 0.06]} />
        <meshStandardMaterial color="#1f2328" />
      </mesh>
      <mesh position={[0, 0, 0.035]}>
        <planeGeometry args={[width - 0.14, width * 0.56 - 0.14]} />
        <meshStandardMaterial color="#5b5fc7" emissive="#5b5fc7" emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
}

export function CoffeeTable({ position, radius = 0.45 }: { position: Vec3; radius?: number }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.42, 0]} castShadow>
        <cylinderGeometry args={[radius, radius, 0.05, 28]} />
        <meshStandardMaterial color="#e9e9ea" />
      </mesh>
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.05, 0.18, 0.4, 12]} />
        <meshStandardMaterial color="#3d4248" />
      </mesh>
    </group>
  );
}

export function Rug({
  position,
  size,
  color,
}: {
  position: Vec3;
  size: [number, number];
  color: string;
}) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[position[0], 0.008, position[2]]} receiveShadow>
      <planeGeometry args={size} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}
