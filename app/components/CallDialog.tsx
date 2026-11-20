"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { appendChat, getOffice, teamPayload } from "@/lib/officeStore";
import Avatar from "./Avatar";
import { speechChunks, splitForSpeech, voiceFor } from "@/lib/voice";
import { postJSON } from "./ui";
import type { Person } from "./office/Character";

function pickVoice(gender: "m" | "f") {
  const voices = window.speechSynthesis?.getVoices() ?? [];
  const ar = voices.filter((v) => v.lang.toLowerCase().startsWith("ar"));
  if (!ar.length) return null;
  const female = /female|zariyah|salma|hoda|laila|amira|mariam|fatima|sana|hala/i;
  const male = /male|naayf|hamed|shakir|maged|tarik|fahed|omar|hamdan/i;
  return (
    ar.find((v) => (gender === "f" ? female : male).test(v.name) && v.lang.toLowerCase().includes("sa")) ??
    ar.find((v) => (gender === "f" ? female : male).test(v.name)) ??
    ar.find((v) => v.lang.toLowerCase().includes("sa")) ??
    ar[0]
  );
}

type Phase = "idle" | "listening" | "thinking" | "speaking";

/** حركة الوجه: فتح الفم أثناء الكلام، ورمش طبيعي، وحركة رأس خفيفة */
function useTalkingFace(speaking: boolean) {
  const [face, setFace] = useState({ mouth: 0, blink: false, bob: 0, tilt: 0 });
  useEffect(() => {
    let raf = 0;
    let last = 0;
    let nextBlink = performance.now() + 2500;
    let blinkUntil = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - last < 50) return; // ~20 إطار في الثانية يكفي
      last = now;
      const t = now / 1000;
      if (now > nextBlink) {
        blinkUntil = now + 140;
        nextBlink = now + 2200 + Math.random() * 2800;
      }
      const pause = Math.sin(t * 2.3) > 0.82; // وقفات قصيرة بين الكلمات
      const mouth = speaking && !pause ? Math.abs(Math.sin(t * 11)) * (0.55 + 0.45 * Math.sin(t * 3.7 + 1)) : 0;
      setFace({
        mouth,
        blink: now < blinkUntil,
        bob: Math.sin(t * (speaking ? 2.4 : 1.1)) * (speaking ? 3 : 1.5),
        tilt: Math.sin(t * 0.9) * (speaking ? 2.5 : 1),
      });
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [speaking]);
  return face;
}

export default function CallDialog({
  person,
  withVideo,
  onClose,
}: {
  person: Person;
  withVideo: boolean;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [muted, setMuted] = useState(false);
  const [camOn, setCamOn] = useState(withVideo);
  const [heard, setHeard] = useState("");
  const [lastReply, setLastReply] = useState("");
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const video = useRef<HTMLVideoElement>(null);
  const active = useRef(true);
  const mutedRef = useRef(false);
  const history = useRef<{ role: "user" | "assistant"; content: string }[]>(
    (getOffice().chats[person.id] ?? []).slice(-10).map((m) => ({ role: m.role, content: m.content }))
  );

  // مؤقت المكالمة
  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // الكاميرا (معاينة ذاتية)
  useEffect(() => {
    if (!camOn) return;
    let stream: MediaStream | null = null;
    navigator.mediaDevices
      ?.getUserMedia({ video: true, audio: false })
      .then((s) => {
        stream = s;
        if (video.current) video.current.srcObject = s;
      })
      .catch(() => setError("تعذّر تشغيل الكاميرا. تأكد من السماح للمتصفح باستخدامها."));
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, [camOn]);

  // ─── النطق: صوت سعودي من الخادم أولاً، ثم أصوات المتصفح كبديل ───
  const audio = useRef<HTMLAudioElement | null>(null);
  const serverTts = useRef(true);
  const tapResolve = useRef<(() => void) | null>(null);
  const [needTap, setNeedTap] = useState(false);
  const [voiceNote, setVoiceNote] = useState<string | null>(null);

  const fetchClip = useCallback(
    async (text: string) => {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice: voiceFor({ id: person.id, gender: person.gender }) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `TTS ${res.status}`);
      }
      return URL.createObjectURL(await res.blob());
    },
    [person.id, person.gender]
  );

  const playUrl = useCallback(async (url: string) => {
    const a = (audio.current ??= new Audio());
    a.src = url;
    try {
      await a.play();
    } catch (e) {
      if ((e as DOMException).name !== "NotAllowedError") throw e;
      // المتصفح منع التشغيل التلقائي: نطلب ضغطة من المستخدم
      setNeedTap(true);
      await new Promise<void>((r) => (tapResolve.current = r));
      setNeedTap(false);
      await a.play();
    }
    await new Promise<void>((resolve) => {
      a.onended = () => resolve();
      a.onerror = () => resolve();
      a.onpause = () => resolve();
    });
  }, []);

  const browserSpeak = useCallback(
    async (text: string) => {
      const synth = window.speechSynthesis;
      if (!synth) {
        setVoiceNote("متصفحك لا يدعم النطق الصوتي.");
        return;
      }
      if (!synth.getVoices().length) {
        await new Promise<void>((r) => {
          synth.onvoiceschanged = () => r();
          setTimeout(r, 1200);
        });
      }
      const v = pickVoice(person.gender);
      if (!v) setVoiceNote("لا يوجد صوت عربي مثبت في جهازك، لذلك قد لا تسمع الرد. أضف اللغة العربية لنظام التشغيل أو استخدم Edge.");
      for (const chunk of splitForSpeech(text)) {
        if (!active.current) return;
        await new Promise<void>((resolve) => {
          synth.cancel();
          const u = new SpeechSynthesisUtterance(chunk);
          u.lang = "ar-SA";
          if (v) u.voice = v;
          u.onend = () => resolve();
          u.onerror = () => resolve();
          synth.speak(u);
        });
      }
    },
    [person.gender]
  );

  // صوت ثابت: بعد أن ينجح الصوت السعودي مرة، لا نبدّله أبداً بصوت المتصفح خلال المكالمة
  const serverWorked = useRef(false);
  const speak = useCallback(
    async (text: string) => {
      if (serverTts.current) {
        const chunks = speechChunks(text);
        const clip = async (t: string): Promise<string | Error> => {
          for (let attempt = 0; ; attempt++) {
            try {
              return await fetchClip(t);
            } catch (e) {
              if (attempt >= 2) return e as Error;
              await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
            }
          }
        };
        let next = chunks.length ? clip(chunks[0]) : null;
        for (let i = 0; i < chunks.length && next; i++) {
          const r = await next;
          next = i + 1 < chunks.length ? clip(chunks[i + 1]) : null;
          if (!active.current) return;
          if (r instanceof Error) {
            if (!serverWorked.current) {
              serverTts.current = false;
              setVoiceNote(`الصوت السعودي غير متاح الآن، نستخدم صوت المتصفح. (${r.message})`);
              await browserSpeak(chunks.slice(i).join(" "));
              return;
            }
            setVoiceNote("تعذّر نطق جزء من الرد، تجده مكتوباً بالأسفل.");
            continue;
          }
          serverWorked.current = true;
          await playUrl(r);
          URL.revokeObjectURL(r);
        }
        return;
      }
      await browserSpeak(text);
    },
    [fetchClip, playUrl, browserSpeak]
  );

  const listenRef = useRef<() => void>(() => {});
  const speakRef = useRef(speak);
  const respondRef = useRef<(text: string) => Promise<void>>(async () => {});

  const respond = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      setHeard(text);
      setPhase("thinking");
      history.current = [...history.current, { role: "user" as const, content: text }].slice(-20);
      try {
        const { reply } = await postJSON<{ reply: string }>("/api/employee", {
          action: "chat",
          mode: "call",
          employeeId: person.id,
          employees: teamPayload(),
          messages: history.current,
        });
        if (!active.current) return;
        history.current = [...history.current, { role: "assistant" as const, content: reply }];
        appendChat(person.id, [
          { role: "user", content: text, via: "call" },
          { role: "assistant", content: reply, via: "call" },
        ]);
        setLastReply(reply);
        setPhase("speaking");
        await speak(reply);
      } catch (e) {
        setError((e as Error).message);
      }
      if (active.current) listenRef.current();
    },
    [person.id, speak]
  );

  // ─── الاستماع: نسجّل صوتك من الميكروفون، ونكشف بداية كلامك ونهايته، ثم نحوّله لنص من الخادم ───
  const mic = useRef<MediaStream | null>(null);
  const meter = useRef<{ ctx: AudioContext; an: AnalyserNode; buf: Float32Array<ArrayBuffer> } | null>(null);
  const stopListen = useRef<(() => void) | null>(null);
  const [level, setLevel] = useState(0);
  const [micState, setMicState] = useState<"pending" | "ok" | "denied">("pending");

  const ensureMic = useCallback(async () => {
    if (mic.current && meter.current) {
      await meter.current.ctx.resume().catch(() => {});
      return true;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setMicState("denied");
      setError("متصفحك لا يدعم تسجيل الصوت. استخدم Chrome أو Edge أو Safari حديث، أو اكتب رسالتك.");
      return false;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      mic.current = s;
      const ctx = new AudioContext();
      const an = ctx.createAnalyser();
      an.fftSize = 1024;
      ctx.createMediaStreamSource(s).connect(an);
      await ctx.resume().catch(() => {});
      meter.current = { ctx, an, buf: new Float32Array(an.fftSize) };
      setMicState("ok");
      return true;
    } catch {
      setMicState("denied");
      setError("لم يُسمح باستخدام الميكروفون. اضغط على رمز القفل بجانب عنوان الموقع واسمح بالميكروفون، ثم أعد الاتصال.");
      return false;
    }
  }, []);

  const listen = useCallback(async () => {
    if (!active.current) return;
    if (mutedRef.current || !(await ensureMic())) {
      setPhase("idle");
      return;
    }
    if (!active.current || mutedRef.current || stopListen.current) return;
    const m = meter.current!;
    const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"].find((t) =>
      MediaRecorder.isTypeSupported?.(t)
    );
    const rec = new MediaRecorder(mic.current!, mime ? { mimeType: mime } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    rec.start(250); // نبدأ التسجيل فوراً حتى لا تضيع أول كلمة
    setPhase("listening");

    const startedAt = performance.now();
    let noise = 0.008;
    let speechAt = 0;
    let lastVoice = 0;
    let done = false;

    const finish = (send: boolean) => {
      if (done) return;
      done = true;
      clearInterval(timer);
      stopListen.current = null;
      setLevel(0);
      rec.onstop = async () => {
        if (!send || !active.current) return;
        setPhase("thinking");
        try {
          const fd = new FormData();
          fd.append("audio", new Blob(chunks, { type: rec.mimeType || mime || "audio/webm" }), "speech");
          fd.append(
            "names",
            [person.name, "مصعب", "سلطان", "نورة", "عبدالعزيز", ...getOffice().employees.map((e) => e.name)].join(",")
          );
          const res = await fetch("/api/stt", { method: "POST", body: fd });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || "تعذّر فهم الصوت");
          const text = String(data.text ?? "").trim();
          if (!active.current) return;
          if (text) void respondRef.current(text);
          else listenRef.current();
        } catch (e) {
          setError((e as Error).message);
          if (active.current) setTimeout(() => listenRef.current(), 1500);
        }
      };
      if (rec.state !== "inactive") rec.stop();
    };
    stopListen.current = () => finish(false);

    const timer = setInterval(() => {
      m.an.getFloatTimeDomainData(m.buf);
      let sum = 0;
      for (const v of m.buf) sum += v * v;
      const rms = Math.sqrt(sum / m.buf.length);
      setLevel(Math.min(1, rms * 14));
      const now = performance.now();
      const threshold = Math.max(0.012, noise * 2.5);
      if (!speechAt) {
        if (rms >= threshold && now - startedAt > 250) {
          speechAt = now;
          lastVoice = now;
          setError(null);
        } else {
          noise = noise * 0.95 + rms * 0.05; // نتعلم مستوى الضجيج في الغرفة
          if (now - startedAt > 15000) {
            // لا كلام: نعيد التسجيل من جديد حتى لا يكبر الملف
            finish(false);
            listenRef.current();
          }
        }
        return;
      }
      if (rms >= threshold) lastVoice = now;
      if (now - lastVoice > 1100 || now - speechAt > 25000) finish(now - speechAt > 300);
    }, 60);
  }, [ensureMic, person.name]);

  useEffect(() => {
    listenRef.current = () => void listen();
    speakRef.current = speak;
    respondRef.current = respond;
  }, [listen, respond, speak]);

  // بداية المكالمة: الموظف يرد بالتحية
  useEffect(() => {
    active.current = true;
    const greet = `هلا والله، معك ${person.name}. تفضل، وش تبي؟`;
    const t = setTimeout(async () => {
      setLastReply(greet);
      setPhase("speaking");
      await speakRef.current(greet);
      if (active.current) listenRef.current();
    }, 600);
    return () => {
      active.current = false;
      clearTimeout(t);
      stopListen.current?.();
      mic.current?.getTracks().forEach((t) => t.stop());
      void meter.current?.ctx.close().catch(() => {});
      mic.current = null;
      meter.current = null;
      window.speechSynthesis?.cancel();
      audio.current?.pause();
      tapResolve.current?.();
    };
    // التحية مرة واحدة فقط عند بداية المكالمة
  }, [person.name]);

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    mutedRef.current = next;
    if (next) {
      stopListen.current?.();
      setPhase("idle");
    } else if (phase === "idle") void listen();
  }

  const face = useTalkingFace(phase === "speaking");
  const faceStyle = { transform: `translateY(${face.bob}px) rotate(${face.tilt}deg)`, transition: "transform 80ms linear" };
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  const phaseText: Record<Phase, string> = {
    idle: muted ? "الميكروفون مكتوم" : "جاهز",
    listening: "🎙️ أسمعك… تكلّم",
    thinking: `${person.name} يفكر…`,
    speaking: `${person.name} يتكلم`,
  };

  return (
    <div className="fixed inset-0 z-[2100] grid place-items-center bg-black/70 p-4">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl bg-zinc-900 text-white shadow-2xl">
        <div className="flex items-center justify-between px-5 py-3 text-sm opacity-80">
          <span>📞 مكالمة {withVideo ? "فيديو" : "صوتية"} مع {person.name}</span>
          <span dir="ltr">{mm}:{ss}</span>
        </div>
        {withVideo ? (
          // مكالمة فيديو: صورة الموظف الحية تملأ الشاشة، ومعاينتك في الزاوية
          <div
            className="relative aspect-video w-full overflow-hidden"
            style={{ background: `radial-gradient(circle at 50% 35%, ${person.color}55, #1f2937 55%, #0b0f17)` }}
          >
            <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute inset-0 grid place-items-center pt-6">
              <div style={faceStyle}>
                <Avatar person={person} size={230} mouth={face.mouth} blink={face.blink} ring={false} speaking={phase === "speaking"} />
              </div>
            </div>
            <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-red-600/90 px-2 py-0.5 text-xs font-semibold">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-white" /> مباشر
            </span>
            <div className="absolute bottom-3 right-3 text-start">
              <div className="text-lg font-bold">{person.name}</div>
              <div className="text-xs opacity-75">{person.role} • <span className="text-emerald-300">{phaseText[phase]}</span></div>
            </div>
            {camOn ? (
              <video
                ref={video}
                autoPlay
                muted
                playsInline
                className="absolute bottom-3 left-3 h-24 w-36 rounded-xl border border-white/25 object-cover shadow-lg sm:h-28 sm:w-44"
                style={{ transform: "scaleX(-1)" }}
              />
            ) : (
              <div className="absolute bottom-3 left-3 grid h-24 w-36 place-items-center rounded-xl border border-white/25 bg-black/50 text-xs sm:h-28 sm:w-44">
                كاميرتك مغلقة
              </div>
            )}
          </div>
        ) : (
          <div className="relative grid min-h-[300px] place-items-center bg-gradient-to-b from-zinc-800 to-zinc-900 px-6 pb-6">
            <div className="flex flex-col items-center gap-3 text-center">
              <div style={faceStyle}>
                <Avatar person={person} size={150} mouth={face.mouth} blink={face.blink} speaking={phase === "speaking"} />
              </div>
              <div className="text-xl font-bold">{person.name}</div>
              <div className="text-sm opacity-70">{person.role}</div>
              <div className="text-sm text-emerald-300">{phaseText[phase]}</div>
            </div>
            {camOn && (
              <video
                ref={video}
                autoPlay
                muted
                playsInline
                className="absolute bottom-4 left-4 h-28 w-40 rounded-xl border border-white/20 object-cover"
                style={{ transform: "scaleX(-1)" }}
              />
            )}
          </div>
        )}
        <div className="space-y-2 px-5 py-3 text-sm">
          {heard && (
            <p className="opacity-70">
              <b>أنت:</b> {heard}
            </p>
          )}
          {lastReply && (
            <p>
              <b>{person.name}:</b> {lastReply}
            </p>
          )}
          {phase === "listening" && (
            <div className="flex items-center gap-2 text-xs opacity-80">
              <span>🎙️ صوتك</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-emerald-400 transition-[width] duration-75" style={{ width: `${Math.round(level * 100)}%` }} />
              </div>
              <span>تكلّم ثم توقّف لحظة ليرد عليك</span>
            </div>
          )}
          {needTap && (
            <button
              className="w-full rounded-lg bg-emerald-600 px-4 py-2 font-semibold"
              onClick={() => tapResolve.current?.()}
            >
              🔊 اضغط هنا لتشغيل الصوت
            </button>
          )}
          {voiceNote && <p className="text-xs text-amber-300">{voiceNote}</p>}
          {error && <p className="text-red-300">{error}</p>}
          {(micState === "denied" || muted) && (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const t = typed;
                setTyped("");
                void respond(t);
              }}
            >
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder="اكتب ما تريد قوله…"
                className="flex-1 rounded-lg bg-white/10 px-3 py-2 outline-none"
              />
              <button className="rounded-lg bg-emerald-600 px-4">إرسال</button>
            </form>
          )}
        </div>
        <div className="flex justify-center gap-3 pb-5">
          <button onClick={toggleMute} className={`call-btn ${muted ? "bg-white text-zinc-900" : "bg-white/15"}`} title="كتم">
            {muted ? "🔇" : "🎙️"}
          </button>
          <button onClick={() => setCamOn((c) => !c)} className={`call-btn ${camOn ? "bg-white/15" : "bg-white text-zinc-900"}`} title="الكاميرا">
            {camOn ? "📹" : "🚫"}
          </button>
          <button onClick={onClose} className="call-btn bg-red-600" title="إنهاء">
            📵
          </button>
        </div>
      </div>
    </div>
  );
}
