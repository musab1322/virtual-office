"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { routeBetween, type Seat } from "./floorplan";
import { personLook } from "../look";

export type AgentStatus = "idle" | "working" | "done";

export interface Person {
  id: string;
  name: string;
  role: string;
  color: string;
  gender: "m" | "f";
  manager?: boolean;
  voice?: string; // صوت المكالمات إن اختاره صاحب العمل
  department?: string; // مكانه في الهيكل التنظيمي
  photo?: string; // صورة مرفوعة تُجسَّد على وجه الشخصية
}

/** وجه من الصورة المرفوعة: قرص دائري على مقدمة الرأس */
function PhotoFace({ src }: { src: string }) {
  const tex = useMemo(() => {
    const t = new THREE.TextureLoader().load(src);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [src]);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <mesh position={[0, 0.095, 0.172]}>
      <circleGeometry args={[0.125, 32]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  );
}

const THOBE = "#f7f7f4";
const ABAYA = "#16161a";
const SIT_HIP = 0.5;
const STAND_HIP = 0.92;
const WALK_SPEED = 3.6;

// نقشة الشماغ الأحمر (مربعات حمراء وبيضاء) مرسومة مرة واحدة
let shemaghTex: THREE.CanvasTexture | null = null;
function getShemaghTexture() {
  if (shemaghTex) return shemaghTex;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = "#c4161c";
  for (let i = 0; i < 64; i += 8) {
    ctx.fillRect(i, 0, 5, 64);
    ctx.fillRect(0, i, 64, 5);
  }
  shemaghTex = new THREE.CanvasTexture(c);
  shemaghTex.wrapS = shemaghTex.wrapT = THREE.RepeatWrapping;
  shemaghTex.repeat.set(3, 3);
  shemaghTex.magFilter = THREE.NearestFilter;
  shemaghTex.colorSpace = THREE.SRGBColorSpace;
  return shemaghTex;
}


function lerpAngle(a: number, b: number, t: number) {
  let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

/** غطاء الرأس السعودي: شماغ/غترة مع عقال للرجال، وطرحة للنساء */
function Headwear({ gender, redShemagh }: { gender: "m" | "f"; redShemagh: boolean }) {
  const tex = useMemo(() => (redShemagh ? getShemaghTexture() : null), [redShemagh]);
  if (gender === "f") {
    return (
      <group>
        {/* طرحة سوداء تحيط بالوجه */}
        <mesh position={[0, 0.115, -0.05]} castShadow>
          <sphereGeometry args={[0.168, 22, 18]} />
          <meshStandardMaterial color={ABAYA} />
        </mesh>
        <mesh position={[0, -0.07, -0.04]} castShadow>
          <cylinderGeometry args={[0.13, 0.22, 0.22, 18]} />
          <meshStandardMaterial color={ABAYA} />
        </mesh>
      </group>
    );
  }
  const mat = tex ? (
    <meshStandardMaterial map={tex} />
  ) : (
    <meshStandardMaterial color="#ffffff" />
  );
  return (
    <group>
      {/* الغترة/الشماغ فوق الرأس */}
      <mesh position={[0, 0.15, -0.01]} scale={[1.08, 0.95, 1.08]} castShadow>
        <sphereGeometry args={[0.15, 22, 16, 0, Math.PI * 2, 0, Math.PI / 1.9]} />
        {mat}
      </mesh>
      {/* الطرف المتدلي خلف الرأس وعلى الكتفين */}
      <mesh position={[0, -0.02, -0.11]} rotation={[0.12, 0, 0]} castShadow>
        <boxGeometry args={[0.34, 0.36, 0.05]} />
        {mat}
      </mesh>
      {[-0.15, 0.15].map((x) => (
        <mesh key={x} position={[x, -0.01, 0.0]} rotation={[0, 0, x > 0 ? -0.12 : 0.12]} castShadow>
          <boxGeometry args={[0.04, 0.32, 0.2]} />
          {mat}
        </mesh>
      ))}
      {/* العقال */}
      <mesh position={[0, 0.215, -0.01]} rotation={[Math.PI / 2 - 0.15, 0, 0]}>
        <torusGeometry args={[0.105, 0.017, 8, 28]} />
        <meshStandardMaterial color="#111111" />
      </mesh>
    </group>
  );
}

export function Character({
  person,
  seat,
  status,
  selected,
  onSelect,
  registerAnchor,
}: {
  person: Person;
  seat: Seat;
  status: AgentStatus;
  selected: boolean;
  onSelect: (id: string) => void;
  registerAnchor: (id: string, el: THREE.Object3D | null) => void;
}) {
  const { id, gender } = person;
  const { hash: h, skin, redShemagh } = personLook(person);
  // البشت للمدير العام للوكلاء فقط
  const bisht = !!person.manager;
  const hasBeard = gender === "m";

  const [initialSeat] = useState(seat); // الموضع الأولي فقط؛ الحركة بعدها تتم في useFrame
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const legs = useRef<(THREE.Group | null)[]>([]);
  const knees = useRef<(THREE.Group | null)[]>([]);
  const arms = useRef<(THREE.Group | null)[]>([]);
  const elbows = useRef<(THREE.Group | null)[]>([]);
  const sit = useRef(1); // 1 = جالس، 0 = واقف/يمشي

  // المسار عبر الممرات والأبواب بدل اختراق الجدران
  const lastSeat = useRef<Seat | null>(null);
  const path = useRef<THREE.Vector3[]>([]);
  const leg = useRef(0);
  const finalRot = useRef(seat.rot);
  useEffect(() => {
    const pts = routeBetween(lastSeat.current, seat);
    path.current = pts.map((p) => new THREE.Vector3(...p));
    leg.current = 0;
    finalRot.current = seat.rot;
    lastSeat.current = seat;
  }, [seat]);

  useFrame(({ clock }, dt) => {
    const g = root.current;
    if (!g) return;
    const t = clock.elapsedTime + (h % 100) / 10;
    const d = Math.min(dt, 0.1);

    const pts = path.current;
    let walking = false;
    if (pts.length) {
      const isLast = leg.current >= pts.length - 1;
      const to = pts[Math.min(leg.current, pts.length - 1)].clone().sub(g.position);
      to.y = 0;
      const dist = to.length();
      if (!isLast && dist < 0.12) {
        leg.current++;
        walking = true;
      } else if (dist > 0.03) {
        walking = true;
        g.position.addScaledVector(to.normalize(), Math.min(dist, WALK_SPEED * d));
        g.rotation.y = lerpAngle(g.rotation.y, Math.atan2(to.x, to.z), 1 - Math.pow(0.00001, d));
      }
    }
    if (!walking) {
      g.rotation.y = lerpAngle(g.rotation.y, finalRot.current, 1 - Math.pow(0.001, d));
      sit.current = Math.min(1, sit.current + d * 2.5);
    } else {
      sit.current = Math.max(0, sit.current - d * 4);
    }
    const s = sit.current;
    const swing = walking ? Math.sin(t * 10) * 0.55 : 0;

    if (body.current) body.current.position.y = THREE.MathUtils.lerp(STAND_HIP, SIT_HIP, s);

    const typing = status === "working" && !walking && s > 0.95;
    legs.current.forEach((l, i) => {
      if (l) l.rotation.x = THREE.MathUtils.lerp(swing * (i ? 1 : -1), -Math.PI / 2, s);
    });
    knees.current.forEach((k, i) => {
      if (k)
        k.rotation.x = THREE.MathUtils.lerp(
          walking ? Math.max(0, -swing * (i ? 1 : -1)) : 0,
          Math.PI / 2,
          s
        );
    });
    arms.current.forEach((a, i) => {
      if (!a) return;
      const tap = typing ? Math.sin(t * 18 + i * Math.PI) * 0.08 : 0;
      a.rotation.x = THREE.MathUtils.lerp(-swing * (i ? 1 : -1) * 0.8, -0.45 + tap, s);
    });
    elbows.current.forEach((el) => {
      if (el) el.rotation.x = THREE.MathUtils.lerp(-0.2, -1.05, s);
    });
    if (head.current) {
      head.current.rotation.x = typing ? Math.sin(t * 2.5) * 0.06 + 0.12 : 0;
      head.current.rotation.y = !typing && !walking ? Math.sin(t * 0.4) * 0.25 : 0;
    }
  });

  const robe = gender === "f" ? ABAYA : THOBE;
  const sleeves = bisht ? "#2a1f17" : robe;

  return (
    <group
      ref={root}
      position={initialSeat.pos}
      rotation={[0, initialSeat.rot, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(id);
      }}
      onPointerOver={() => (document.body.style.cursor = "pointer")}
      onPointerOut={() => (document.body.style.cursor = "")}
    >
      <group ref={body} position={[0, SIT_HIP, 0]}>
        {/* الساقان (الثوب/العباية حتى الكاحل) */}
        {[-0.095, 0.095].map((x, i) => (
          <group key={x} position={[x, 0, 0]} ref={(el) => void (legs.current[i] = el)}>
            <mesh position={[0, -0.22, 0]} castShadow>
              <boxGeometry args={[0.18, 0.46, 0.19]} />
              <meshStandardMaterial color={robe} />
            </mesh>
            <group position={[0, -0.45, 0]} ref={(el) => void (knees.current[i] = el)}>
              <mesh position={[0, -0.2, 0]} castShadow>
                <boxGeometry args={[0.17, 0.42, 0.17]} />
                <meshStandardMaterial color={robe} />
              </mesh>
              <mesh position={[0, -0.43, 0.05]} castShadow>
                <boxGeometry args={[0.12, 0.05, 0.25]} />
                <meshStandardMaterial color={gender === "f" ? "#2b2b2b" : "#6b4a2f"} />
              </mesh>
            </group>
          </group>
        ))}
        {/* الجذع */}
        <RoundedBox args={[0.44, 0.58, 0.25]} radius={0.06} position={[0, 0.3, 0]} castShadow>
          <meshStandardMaterial color={robe} />
        </RoundedBox>
        {gender === "m" && (
          // أزرار الثوب
          <mesh position={[0, 0.48, 0.127]}>
            <boxGeometry args={[0.035, 0.18, 0.01]} />
            <meshStandardMaterial color="#e3e3dd" />
          </mesh>
        )}
        {/* البشت الأسود بحاشية ذهبية للمدير */}
        {bisht && (
          <group>
            <mesh position={[0, 0.27, -0.14]} castShadow>
              <boxGeometry args={[0.54, 0.66, 0.04]} />
              <meshStandardMaterial color="#2a1f17" />
            </mesh>
            {[-0.2, 0.2].map((x) => (
              <group key={x}>
                <mesh position={[x, 0.27, 0.13]} castShadow>
                  <boxGeometry args={[0.1, 0.66, 0.03]} />
                  <meshStandardMaterial color="#2a1f17" />
                </mesh>
                <mesh position={[x + (x > 0 ? -0.05 : 0.05), 0.27, 0.147]}>
                  <boxGeometry args={[0.022, 0.66, 0.01]} />
                  <meshStandardMaterial color="#d4a72c" metalness={0.6} roughness={0.35} />
                </mesh>
              </group>
            ))}
          </group>
        )}
        {/* الذراعان */}
        {[-0.27, 0.27].map((x, i) => (
          <group key={x} position={[x, 0.52, 0]} ref={(el) => void (arms.current[i] = el)}>
            <mesh position={[0, -0.15, 0]} castShadow>
              <boxGeometry args={[0.12, 0.3, 0.13]} />
              <meshStandardMaterial color={sleeves} />
            </mesh>
            <group position={[0, -0.29, 0]} ref={(el) => void (elbows.current[i] = el)}>
              <mesh position={[0, -0.13, 0]} castShadow>
                <boxGeometry args={[0.11, 0.27, 0.11]} />
                <meshStandardMaterial color={sleeves} />
              </mesh>
              <mesh position={[0, -0.29, 0]}>
                <sphereGeometry args={[0.055, 10, 8]} />
                <meshStandardMaterial color={skin} />
              </mesh>
            </group>
          </group>
        ))}
        {/* الرأس */}
        <group ref={head} position={[0, 0.66, 0]}>
          <mesh position={[0, -0.06, 0]}>
            <cylinderGeometry args={[0.055, 0.06, 0.1, 10]} />
            <meshStandardMaterial color={skin} />
          </mesh>
          <mesh position={[0, 0.1, 0]} castShadow>
            <sphereGeometry args={[0.14, 20, 16]} />
            <meshStandardMaterial color={skin} />
          </mesh>
          {person.photo && <PhotoFace src={person.photo} />}
          {/* عينان */}
          {!person.photo && [-0.05, 0.05].map((x) => (
            <mesh key={x} position={[x, 0.12, 0.13]}>
              <sphereGeometry args={[0.016, 8, 6]} />
              <meshStandardMaterial color="#111" />
            </mesh>
          ))}
          {/* لحية وشارب */}
          {hasBeard && !person.photo && (
            <group>
              <mesh position={[0, 0.02, 0.105]} rotation={[0.35, 0, 0]}>
                <boxGeometry args={[0.17, 0.09, 0.07]} />
                <meshStandardMaterial color="#1c1612" />
              </mesh>
              <mesh position={[0, 0.07, 0.133]}>
                <boxGeometry args={[0.09, 0.022, 0.02]} />
                <meshStandardMaterial color="#1c1612" />
              </mesh>
            </group>
          )}
          <Headwear gender={gender} redShemagh={redShemagh} />
          {/* نقطة تثبيت لافتة الاسم العائمة */}
          <group position={[0, 0.5, 0]} ref={(el) => registerAnchor(id, el)} />
        </group>
      </group>
      {selected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0.1]}>
          <ringGeometry args={[0.45, 0.55, 40]} />
          <meshBasicMaterial color={person.color} transparent opacity={0.8} />
        </mesh>
      )}
    </group>
  );
}
