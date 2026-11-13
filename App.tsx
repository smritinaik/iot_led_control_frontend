import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView, StatusBar, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  useFonts, Inter_500Medium, Inter_700Bold, Inter_800ExtraBold,
} from '@expo-google-fonts/inter';

const ESP_BASE = 'http://192.168.4.1';
const SSID = 'ESP32_LED';
const POLL_MS = 2000;
const TIMEOUT_MS = 2000;

type Conn = 'checking' | 'connected' | 'disconnected';
type LedState = 'ON' | 'OFF';
type Mode = 'live' | 'simulated';

const C = {
  bg: '#D5E3F5', dark: '#232529', darkButton: '#3A3D44', darkButtonEdge: '#16171A',
  panel: '#F2F3F5', white: '#FFFFFF', lavender: '#E3DCF3', mint: '#D7EDDF',
  butter: '#F5ECCB', sky: '#DCE8F8', blueButton: '#B5D5F5', blueButtonEdge: '#5A78A3',
  green: '#2E9E68', amber: '#C58B14', red: '#E5584A', redTint: '#FBE0DC',
  text: '#1D1F23', muted: '#8A8F98',
};
const F = { medium: 'Inter_500Medium', bold: 'Inter_700Bold', heavy: 'Inter_800ExtraBold' };

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

export default function App() {
  const [fontsLoaded] = useFonts({ Inter_500Medium, Inter_700Bold, Inter_800ExtraBold });
  const [mode, setMode] = useState<Mode>('live');
  const [conn, setConn] = useState<Conn>('checking');
  const [led, setLed] = useState<LedState | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastReply, setLastReply] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);
  const simLed = useRef<LedState>('OFF');
  const polling = useRef(false);

  const request = useCallback(async (path: string): Promise<string> => {
    if (mode === 'simulated') {
      await new Promise((r) => setTimeout(r, 250));
      if (path === '/on') simLed.current = 'ON';
      if (path === '/off') simLed.current = 'OFF';
      return simLed.current;
    }
    return esp(path);
  }, [mode]);

  const applyReply = (text: string) => {
    setLed(text === 'ON' ? 'ON' : 'OFF');
    setConn('connected');
    setLastReply(Date.now());
    setError(null);
  };

  useEffect(() => {
    setConn('checking'); setLed(null); setLastReply(null); setError(null);
    let alive = true;
    const poll = async () => {
      if (polling.current) return;
      polling.current = true;
      try {
        const text = await request('/status');
        if (alive) applyReply(text);
      } catch {
        if (alive) { setConn('disconnected'); setLed(null); }
      } finally {
        polling.current = false;
      }
    };
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => { alive = false; clearInterval(id); };
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
      setConn('disconnected'); setLed(null);
      setError(mode === 'live'
        ? `Could not reach the ESP32. Join the ${SSID} Wi-Fi and try again.`
        : 'Simulated request failed.');
    } finally {
      setBusy(false);
    }
  };

  if (!fontsLoaded) return null;

  const disabled = conn === 'disconnected' || busy;
  const lastReplyText = lastReply === null ? '-'
    : `${Math.max(0, Math.round((now - lastReply) / 1000))} s ago`;

  const badge =
    conn === 'connected'
      ? { bg: C.mint, fg: C.green, label: mode === 'live' ? 'ESP32 connected' : 'Simulated link' }
      : conn === 'checking'
      ? { bg: C.butter, fg: C.amber, label: 'Checking link' }
      : { bg: C.redTint, fg: C.red, label: 'Not connected' };

  const heroTitle = led === 'ON' ? 'LED is on' : led === 'OFF' ? 'LED is off' : 'LED state unknown';
  const heroSub =
    conn === 'disconnected' ? `Join the ${SSID} Wi-Fi to take control.`
    : conn === 'checking' ? 'Looking for the ESP32.'
    : led === 'ON' ? 'Current is flowing to the LED.'
    : 'Tap LED ON to switch it on.';

  return (
    <View style={s.root}>
<StatusBar barStyle="dark-content" />      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <View style={s.logo}><Text style={s.logoText}>A</Text></View>
          <View style={[s.badge, { backgroundColor: badge.bg }]}>
            <View style={[s.dot, { backgroundColor: badge.fg }]} />
            <Text style={[s.badgeText, { color: badge.fg }]}>{badge.label}</Text>
          </View>
        </View>

        <Text style={s.title}>LED control</Text>

        <View style={s.hero}>
          <View style={s.heroTop}>
            <View style={s.tagRed}><Text style={s.tagRedText}>Manual control</Text></View>
            <View style={[s.bulbCircle, { backgroundColor: led === 'ON' ? C.butter : '#34373D' }]}>
              <Ionicons
                name={led === 'ON' ? 'bulb' : 'bulb-outline'}
                size={26}
                color={led === 'ON' ? C.amber : '#9AA0A8'}
              />
            </View>
          </View>

          <Text style={s.heroTitle}>{heroTitle}</Text>
          <Text style={s.heroSub}>{heroSub}</Text>

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

          {busy && (
            <View style={s.busyRow}>
              <ActivityIndicator size="small" color={C.blueButton} />
              <Text style={s.busyText}>Sending command</Text>
            </View>
          )}
          {error && <Text style={s.errorText}>{error}</Text>}
        </View>

        <View style={s.row}>
          <View style={[s.pastel, { backgroundColor: led === 'ON' ? C.butter : C.lavender }]}>
            <Text style={s.pastelValue}>{led ?? '-'}</Text>
            <Text style={s.pastelLabel}>LED state</Text>
          </View>
          <View style={[s.pastel, {
            backgroundColor: conn === 'connected' ? C.mint : conn === 'checking' ? C.sky : C.redTint,
          }]}>
            <Text style={s.pastelValue}>
              {conn === 'connected' ? 'Online' : conn === 'checking' ? 'Checking' : 'Offline'}
            </Text>
            <Text style={s.pastelLabel}>Connection</Text>
          </View>
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>Link details</Text>
          <DetailRow label="Device" value="ESP32 DevKit" />
          <DetailRow label="Network" value={SSID} />
          <DetailRow label="Address" value="192.168.4.1" />
          <DetailRow label="Last reply" value={lastReplyText} last />
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>Data mode</Text>
          <View style={s.segment}>
            <Pressable onPress={() => setMode('simulated')} style={[s.segItem, mode === 'simulated' && s.segActive]}>
              <Text style={[s.segText, mode === 'simulated' && s.segTextActive]}>Simulated</Text>
            </Pressable>
            <Pressable onPress={() => setMode('live')} style={[s.segItem, mode === 'live' && s.segActive]}>
              <Text style={[s.segText, mode === 'live' && s.segTextActive]}>Live ESP32</Text>
            </Pressable>
          </View>
          <Text style={s.hint}>
            Live mode sends commands to the ESP32 over its own Wi-Fi. Simulated mode tests the screen without hardware.
          </Text>
        </View>

        <Text style={s.footnote}>
          Connects directly to the ESP32 access point. No router or internet needed.
        </Text>
      </ScrollView>
    </View>
  );
}

function DetailRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[s.detailRow, !last && s.detailDivider]}>
      <Text style={s.detailLabel}>{label}</Text>
      <Text style={s.detailValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingTop: (StatusBar.currentHeight ?? 24) + 12, paddingHorizontal: 18, paddingBottom: 36 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  logo: { width: 44, height: 44, borderRadius: 14, backgroundColor: C.butter, alignItems: 'center', justifyContent: 'center' },
  logoText: { fontFamily: F.heavy, fontSize: 20, color: C.dark },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  badgeText: { fontFamily: F.bold, fontSize: 13 },

  title: { fontFamily: F.heavy, fontSize: 34, color: C.text, marginBottom: 16 },

  hero: { backgroundColor: C.dark, borderRadius: 30, padding: 22, marginBottom: 14 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  tagRed: { backgroundColor: C.red, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999 },
  tagRedText: { fontFamily: F.bold, fontSize: 13, color: C.white },
  bulbCircle: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontFamily: F.heavy, fontSize: 30, color: C.white, marginBottom: 6 },
  heroSub: { fontFamily: F.medium, fontSize: 15, color: '#A7ACB5', marginBottom: 22 },
  btnRow: { flexDirection: 'row', gap: 12 },
  btn: { flex: 1, height: 58, borderRadius: 999, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 5 },
  btnOn: { backgroundColor: C.blueButton, borderBottomColor: C.blueButtonEdge },
  btnOff: { backgroundColor: C.darkButton, borderBottomColor: C.darkButtonEdge },
  btnOnText: { fontFamily: F.heavy, fontSize: 17, color: C.dark },
  btnOffText: { fontFamily: F.heavy, fontSize: 17, color: C.white },
  btnDisabled: { opacity: 0.4 },
  btnPressed: { transform: [{ translateY: 2 }], borderBottomWidth: 3 },
  busyRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14, gap: 8 },
  busyText: { fontFamily: F.medium, fontSize: 13, color: '#A7ACB5' },
  errorText: { fontFamily: F.medium, fontSize: 13, color: '#FF8A7E', marginTop: 14 },

  row: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  pastel: { flex: 1, borderRadius: 26, padding: 18, minHeight: 104 },
  pastelValue: { fontFamily: F.heavy, fontSize: 24, color: C.text },
  pastelLabel: { fontFamily: F.medium, fontSize: 14, color: C.muted, marginTop: 4 },

  card: { backgroundColor: C.white, borderRadius: 28, padding: 20, marginBottom: 14 },
  cardTitle: { fontFamily: F.medium, fontSize: 16, color: C.muted, marginBottom: 10 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12 },
  detailDivider: { borderBottomWidth: 1, borderBottomColor: '#ECEEF1' },
  detailLabel: { fontFamily: F.medium, fontSize: 15, color: C.muted },
  detailValue: { fontFamily: F.bold, fontSize: 15, color: C.text },

  segment: { flexDirection: 'row', backgroundColor: C.panel, borderRadius: 999, padding: 4, marginBottom: 14 },
  segItem: { flex: 1, paddingVertical: 12, borderRadius: 999, alignItems: 'center' },
  segActive: { backgroundColor: C.dark },
  segText: { fontFamily: F.bold, fontSize: 14, color: C.muted },
  segTextActive: { color: C.white },
  hint: { fontFamily: F.medium, fontSize: 13, color: C.muted, lineHeight: 19 },

  footnote: { fontFamily: F.medium, fontSize: 12, color: '#6F7F96', textAlign: 'center', marginTop: 6 },
});