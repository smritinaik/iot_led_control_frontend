import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView, StatusBar,
  Animated, Easing, Linking, Platform,
} from 'react-native';
import {
  useFonts, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold,
} from '@expo-google-fonts/nunito';

// ---------- Config ----------
const ESP_BASE = 'http://192.168.4.1';
const SSID = 'ESP32_LED';
const POLL_MS = 2000;
const TIMEOUT_MS = 2000;

type Conn = 'checking' | 'connected' | 'disconnected';
type LedState = 'ON' | 'OFF';
type Mode = 'live' | 'simulated';
type Mood = 'happy' | 'sleepy' | 'lost' | 'looking';

// ---------- Theme ----------
const C = {
  bg: '#E4F5D0', lime: '#A8CF4B', limeDeep: '#7FA52E', limeFrame: '#CDE79A',
  limeSoft: '#C9E58F', ink: '#16181A', white: '#FFFFFF', muted: '#6E7F58',
  mutedDark: '#A9B39A', yellow: '#FFE45C', periwinkle: '#9DB8F2',
  gray: '#C7CCC0', red: '#FF6B5B', pink: '#FF9EAA',
};
const F = { semi: 'Nunito_600SemiBold', bold: 'Nunito_700Bold', heavy: 'Nunito_800ExtraBold' };

async function esp(path: string): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ESP_BASE + path, { signal: ctrl.signal });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return (await res.text()).trim();
  } finally {
    clearTimeout(timer);
  }
}

// ---------- Animated googly-eyed bot ----------
function Eye({ px, py, blink }: { px: Animated.Value; py: Animated.Value; blink: Animated.Value }) {
  return (
    <Animated.View style={[b.eye, { transform: [{ scaleY: blink }] }]}>
      <Animated.View style={[b.pupil, { transform: [{ translateX: px }, { translateY: py }] }]}>
        <View style={b.glint} />
      </Animated.View>
    </Animated.View>
  );
}

function Bot({ mood }: { mood: Mood }) {
  const float = useRef(new Animated.Value(0)).current;
  const blink = useRef(new Animated.Value(1)).current;
  const pxL = useRef(new Animated.Value(0)).current;
  const pxR = useRef(new Animated.Value(0)).current;
  const py = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const tilt = useRef(new Animated.Value(0)).current;

  // Floating / bouncing
  useEffect(() => {
    const amp = mood === 'happy' ? 12 : mood === 'sleepy' ? 3 : 6;
    const dur = mood === 'happy' ? 500 : mood === 'sleepy' ? 1800 : 1000;
    float.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: -amp, duration: dur, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: dur, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [mood, float]);

  // Blinking (double blink every few seconds)
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(2400),
        Animated.timing(blink, { toValue: 0.1, duration: 90, useNativeDriver: true }),
        Animated.timing(blink, { toValue: 1, duration: 120, useNativeDriver: true }),
        Animated.delay(250),
        Animated.timing(blink, { toValue: 0.1, duration: 90, useNativeDriver: true }),
        Animated.timing(blink, { toValue: 1, duration: 120, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [blink]);

  // Where the pupils look
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    const move = (x: number, d: number) =>
      Animated.parallel([
        Animated.timing(pxL, { toValue: x, duration: d, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pxR, { toValue: x, duration: d, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]);

    if (mood === 'looking') {
      Animated.timing(py, { toValue: 0, duration: 200, useNativeDriver: true }).start();
      loop = Animated.loop(Animated.sequence([move(8, 500), move(-8, 1000), move(0, 500)]));
      loop.start();
    } else {
      const t =
        mood === 'happy' ? { l: 0, r: 0, y: -5 }
        : mood === 'sleepy' ? { l: 0, r: 0, y: 6 }
        : { l: 6, r: -6, y: 0 }; // lost = cross-eyed
      Animated.parallel([
        Animated.timing(pxL, { toValue: t.l, duration: 250, useNativeDriver: true }),
        Animated.timing(pxR, { toValue: t.r, duration: 250, useNativeDriver: true }),
        Animated.timing(py, { toValue: t.y, duration: 250, useNativeDriver: true }),
      ]).start();
    }
    return () => loop?.stop();
  }, [mood, pxL, pxR, py]);

  // Tap the bot to make it giggle
  const poke = () => {
    Animated.sequence([
      Animated.timing(pop, { toValue: 0.88, duration: 90, useNativeDriver: true }),
      Animated.spring(pop, { toValue: 1, friction: 3, useNativeDriver: true }),
    ]).start();
    Animated.sequence([
      Animated.timing(tilt, { toValue: 1, duration: 80, useNativeDriver: true }),
      Animated.timing(tilt, { toValue: -1, duration: 140, useNativeDriver: true }),
      Animated.timing(tilt, { toValue: 0, duration: 80, useNativeDriver: true }),
    ]).start();
  };

  const rotate = tilt.interpolate({ inputRange: [-1, 1], outputRange: ['-8deg', '8deg'] });
  const bodyColor =
    mood === 'happy' ? C.yellow : mood === 'sleepy' ? C.periwinkle : mood === 'lost' ? C.gray : C.limeSoft;

  return (
    <Pressable onPress={poke} style={b.wrap}>
      <Animated.View
        style={[b.floatBox, { transform: [{ translateY: float }, { scale: pop }, { rotate }] }]}
      >
        {/* Decorations */}
        {mood === 'happy' && (
          <>
            <View style={[b.ray, { left: 64, top: 16, transform: [{ rotate: '-35deg' }] }]} />
            <View style={[b.ray, { left: 96, top: 4 }]} />
            <View style={[b.ray, { left: 128, top: 16, transform: [{ rotate: '35deg' }] }]} />
          </>
        )}
        {mood === 'sleepy' && (
          <>
            <View style={b.moon}><View style={b.moonCut} /></View>
            <Text style={[b.z, { left: 20, top: 26, fontSize: 20 }]}>z</Text>
            <Text style={[b.z, { left: 38, top: 8, fontSize: 28 }]}>Z</Text>
          </>
        )}
        {mood === 'lost' && <Text style={b.question}>?</Text>}

        {/* Body */}
        <View style={[b.body, { backgroundColor: bodyColor }]}>
          <View style={b.eyes}>
            <Eye px={pxL} py={py} blink={blink} />
            <Eye px={pxR} py={py} blink={blink} />
          </View>

          {mood === 'happy' && (
            <>
              <View style={[b.cheek, { left: 22 }]} />
              <View style={[b.cheek, { right: 22 }]} />
              <View style={b.smile} />
            </>
          )}
          {mood === 'sleepy' && <View style={b.flat} />}
          {mood === 'lost' && <View style={[b.flat, { width: 30 }]} />}
          {mood === 'looking' && <View style={b.oh} />}
        </View>
      </Animated.View>
    </Pressable>
  );
}

// ---------- App ----------
export default function App() {
  const [fontsLoaded] = useFonts({ Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold });

  const [mode, setMode] = useState<Mode>('live');
  const [conn, setConn] = useState<Conn>('checking');
  const [led, setLed] = useState<LedState | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastReply, setLastReply] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);

  const simLed = useRef<LedState>('OFF');
  const polling = useRef(false);

  const request = useCallback(
    async (path: string): Promise<string> => {
      if (mode === 'simulated') {
        await new Promise((r) => setTimeout(r, 250));
        if (path === '/on') simLed.current = 'ON';
        if (path === '/off') simLed.current = 'OFF';
        return simLed.current;
      }
      return esp(path);
    },
    [mode]
  );

  const applyReply = (text: string) => {
    setLed(text === 'ON' ? 'ON' : 'OFF');
    setConn('connected');
    setLastReply(Date.now());
    setError(null);
  };

  // Poll /status so we always know if the ESP32 is reachable
  useEffect(() => {
    setConn('checking');
    setLed(null);
    setLastReply(null);
    setError(null);
    let alive = true;

    const poll = async () => {
      if (polling.current) return;
      polling.current = true;
      try {
        const text = await request('/status');
        if (alive) applyReply(text);
      } catch {
        if (alive) {
          setConn('disconnected');
          setLed(null);
        }
      } finally {
        polling.current = false;
      }
    };

    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [request]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const send = async (target: LedState) => {
    setBusy(true);
    try {
      applyReply(await request(target === 'ON' ? '/on' : '/off'));
    } catch {
      setConn('disconnected');
      setLed(null);
      setError(
        mode === 'live'
          ? `Could not reach the ESP32. Join the ${SSID} Wi-Fi and try again.`
          : 'Simulated request failed.'
      );
    } finally {
      setBusy(false);
    }
  };

  const openWifi = () => {
    Linking.sendIntent('android.settings.WIFI_SETTINGS').catch(() => Linking.openSettings());
  };

  if (!fontsLoaded) return null;

  const disabled = conn === 'disconnected' || busy;
  const mood: Mood =
    conn === 'disconnected' ? 'lost' : conn === 'checking' ? 'looking' : led === 'ON' ? 'happy' : 'sleepy';

  const lastReplyText =
    lastReply === null ? '-' : `${Math.max(0, Math.round((now - lastReply) / 1000))} s ago`;

  const pill =
    conn === 'connected'
      ? { dot: C.lime, label: mode === 'live' ? 'ESP32 connected' : 'Practice link' }
      : conn === 'checking'
      ? { dot: C.yellow, label: 'Checking link' }
      : { dot: C.red, label: 'Not connected' };

  const title =
    mood === 'happy' ? "I'm glowing!"
    : mood === 'sleepy' ? 'Nap time...'
    : mood === 'looking' ? 'Looking for you'
    : "I can't find you";
  const sub =
    mood === 'happy' ? 'The LED is on.'
    : mood === 'sleepy' ? 'The LED is off. Tap LED ON to wake me.'
    : mood === 'looking' ? 'Searching for the ESP32...'
    : `Join the ${SSID} Wi-Fi, then come back.`;

  const showWifi = mode === 'live' && conn === 'disconnected' && Platform.OS === 'android';

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.title}>Blinky</Text>
            <Text style={s.subtitle}>Your ESP32 LED remote</Text>
          </View>
          <View style={s.pill}>
            <View style={[s.dot, { backgroundColor: pill.dot }]} />
            <Text style={s.pillText}>{pill.label}</Text>
          </View>
        </View>

        {/* Hero */}
        <View style={s.hero}>
          <View style={s.tag}>
            <Text style={s.tagText}>{mode === 'live' ? 'Live control' : 'Practice mode'}</Text>
          </View>

          <Bot mood={mood} />

          <Text style={s.heroTitle}>{title}</Text>
          <Text style={s.heroSub}>{sub}</Text>

          <View style={s.btnRow}>
            <Pressable
              disabled={disabled}
              onPress={() => send('ON')}
              style={({ pressed }) => [s.btn, s.btnOn, disabled && s.btnDisabled, pressed && s.btnPressed]}
            >
              <Text style={s.btnOnText}>LED ON</Text>
            </Pressable>
            <Pressable
              disabled={disabled}
              onPress={() => send('OFF')}
              style={({ pressed }) => [s.btn, s.btnOff, disabled && s.btnDisabled, pressed && s.btnPressed]}
            >
              <Text style={s.btnOffText}>LED OFF</Text>
            </Pressable>
          </View>

          {busy && <Text style={s.busy}>Sending...</Text>}
          {error && <Text style={s.error}>{error}</Text>}

          {showWifi && (
            <>
              <Pressable onPress={openWifi} style={s.wifiBtn}>
                <Text style={s.wifiBtnText}>Open Wi-Fi settings</Text>
              </Pressable>
              <Text style={s.tip}>
                Tip: turn off mobile data, and tap "Keep Wi-Fi" if Android says there is no internet.
              </Text>
            </>
          )}
        </View>

        {/* Stat cards */}
        <View style={s.row}>
          <View style={[s.stat, { backgroundColor: C.lime }]}>
            <Text style={s.statValue}>{led ?? '-'}</Text>
            <Text style={[s.statLabel, { color: C.ink }]}>LED state</Text>
          </View>
          <View style={[s.stat, { backgroundColor: C.white }]}>
            <Text style={s.statValue}>
              {conn === 'connected' ? 'Online' : conn === 'checking' ? 'Checking' : 'Offline'}
            </Text>
            <Text style={s.statLabel}>Connection</Text>
          </View>
        </View>

        <Text style={s.footnote}>No router or internet needed. Tap the bot to say hi.</Text>
      </ScrollView>
    </View>
  );
}

// ---------- Bot styles ----------
const b = StyleSheet.create({
  wrap: { alignSelf: 'center', marginVertical: 6 },
  floatBox: { width: 200, height: 190, alignItems: 'center' },
  body: {
    position: 'absolute', top: 42, width: 170, height: 140, borderRadius: 60,
    alignItems: 'center',
  },
  eyes: { flexDirection: 'row', gap: 16, marginTop: 30 },
  eye: {
    width: 54, height: 54, borderRadius: 27, backgroundColor: C.white,
    alignItems: 'center', justifyContent: 'center',
  },
  pupil: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: C.ink,
    alignItems: 'flex-end',
  },
  glint: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.white, marginTop: 4, marginRight: 4 },
  cheek: {
    position: 'absolute', top: 88, width: 22, height: 14, borderRadius: 8,
    backgroundColor: C.pink, opacity: 0.8,
  },
  smile: {
    position: 'absolute', top: 88, width: 34, height: 18, borderBottomWidth: 5,
    borderLeftWidth: 5, borderRightWidth: 5, borderColor: C.ink, borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  flat: { position: 'absolute', top: 102, width: 20, height: 5, borderRadius: 3, backgroundColor: C.ink },
  oh: {
    position: 'absolute', top: 94, width: 16, height: 16, borderRadius: 8,
    borderWidth: 4, borderColor: C.ink,
  },
  ray: { position: 'absolute', width: 9, height: 24, borderRadius: 5, backgroundColor: C.yellow },
  moon: {
    position: 'absolute', right: 14, top: 2, width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#E9E6FF',
  },
  moonCut: {
    position: 'absolute', top: -6, left: 12, width: 34, height: 34, borderRadius: 17,
    backgroundColor: C.ink,
  },
  z: { position: 'absolute', color: C.periwinkle, fontFamily: F.heavy },
  question: {
    position: 'absolute', top: -2, right: 40, fontSize: 40, color: C.lime, fontFamily: F.heavy,
  },
});

// ---------- Screen styles ----------
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: {
    paddingTop: (StatusBar.currentHeight ?? 24) + 12,
    paddingHorizontal: 18,
    paddingBottom: 40,
  },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontFamily: F.heavy, fontSize: 36, color: C.ink },
  subtitle: { fontFamily: F.semi, fontSize: 14, color: C.muted, marginTop: -2 },
  pill: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.ink,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999,
  },
  dot: { width: 9, height: 9, borderRadius: 5, marginRight: 8 },
  pillText: { fontFamily: F.bold, fontSize: 13, color: C.white },

  hero: {
    backgroundColor: C.ink, borderRadius: 38, padding: 22, marginBottom: 14,
    borderWidth: 6, borderColor: C.limeFrame,
  },
  tag: {
    alignSelf: 'flex-start', backgroundColor: C.lime, paddingHorizontal: 14,
    paddingVertical: 7, borderRadius: 999,
  },
  tagText: { fontFamily: F.heavy, fontSize: 13, color: C.ink },
  heroTitle: { fontFamily: F.heavy, fontSize: 30, color: C.white, textAlign: 'center', marginTop: 6 },
  heroSub: {
    fontFamily: F.semi, fontSize: 15, color: C.mutedDark, textAlign: 'center',
    marginTop: 4, marginBottom: 20,
  },
  btnRow: { flexDirection: 'row', gap: 12 },
  btn: {
    flex: 1, height: 60, borderRadius: 999, alignItems: 'center',
    justifyContent: 'center', borderBottomWidth: 5,
  },
  btnOn: { backgroundColor: C.lime, borderBottomColor: C.limeDeep },
  btnOff: { backgroundColor: C.white, borderBottomColor: '#BFC6B3' },
  btnOnText: { fontFamily: F.heavy, fontSize: 18, color: C.ink },
  btnOffText: { fontFamily: F.heavy, fontSize: 18, color: C.ink },
  btnDisabled: { opacity: 0.4 },
  btnPressed: { transform: [{ translateY: 2 }], borderBottomWidth: 3 },
  busy: { fontFamily: F.semi, fontSize: 13, color: C.mutedDark, textAlign: 'center', marginTop: 12 },
  error: { fontFamily: F.semi, fontSize: 13, color: '#FF8A7E', textAlign: 'center', marginTop: 12 },
  wifiBtn: {
    marginTop: 16, height: 50, borderRadius: 999, borderWidth: 3, borderColor: C.lime,
    alignItems: 'center', justifyContent: 'center',
  },
  wifiBtnText: { fontFamily: F.heavy, fontSize: 15, color: C.lime },
  tip: { fontFamily: F.semi, fontSize: 12, color: C.mutedDark, textAlign: 'center', marginTop: 10, lineHeight: 18 },

  row: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  stat: { flex: 1, borderRadius: 30, padding: 18, minHeight: 104, justifyContent: 'center' },
  statValue: { fontFamily: F.heavy, fontSize: 26, color: C.ink },
  statLabel: { fontFamily: F.semi, fontSize: 14, color: C.muted, marginTop: 2 },

  footnote: { fontFamily: F.semi, fontSize: 12, color: C.muted, textAlign: 'center', marginTop: 6 },
});