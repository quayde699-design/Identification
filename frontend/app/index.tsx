import React, { useEffect, useState, useCallback } from "react";
import {
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Alert,
  Image,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  useFonts,
  LaBelleAurore_400Regular,
} from "@expo-google-fonts/la-belle-aurore";

// ---------- Constants ----------
const ORANGE = "#BB4E3A";
const GREEN = "#cfe6cb";
const PANEL = "#eef0f1";
const DARK = "#0f1722";
const MUTED = "#6b7280";

const ADMIN_DIGITS = "4095";
const ADMIN_LETTERS = "QUAYDE";

const KEY_ACCOUNTS = "@vic_accounts_v1";
const KEY_CURRENT = "@vic_current_id";

const API_BASE = (process.env.EXPO_PUBLIC_BACKEND_URL || "") + "/api";

// ---------- Types ----------
type Licence = {
  permitNumber: string;
  expiry: string;
  licenceType: string;
  dob: string;
  addressLine1: string;
  addressLine2: string;
  signatureName: string;
  permitStatus: string;
  proficiency: string;
  issueDate: string;
  cardNumber: string;
  photoUri: string;
};

type Account = {
  id: string;
  name: string;       // e.g. "Quayde A Burnham"
  digits: string;     // 6-digit
  letters: string;    // 3-letter
  locked: boolean;
  licence: Licence;
};

const DEFAULT_LICENCE: Licence = {
  permitNumber: "",
  expiry: "15 Jan 2026",
  licenceType: "Car",
  dob: "01 Jan 2008",
  addressLine1: "",
  addressLine2: "",
  signatureName: "",
  permitStatus: "Current",
  proficiency: "Probationary",
  issueDate: "15 Jan 2027",
  cardNumber: "",
  photoUri: "",
};

// ---------- Helpers ----------
function randomDigits(n: number) {
  let s = "";
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10);
  return s;
}
function randomLetters(n: number) {
  const a = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let s = "";
  for (let i = 0; i < n; i++) s += a[Math.floor(Math.random() * 26)];
  return s;
}
function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
function formatPermit(d: string) {
  // Format 9 digits as "NNN NNN NNN"
  return d.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3");
}
function formatRefreshed(d: Date) {
  const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  let h = d.getHours();
  const ampm = h >= 12 ? "pm" : "am";
  h = h % 12 || 12;
  return `${days[d.getDay()]}, ${String(d.getDate()).padStart(2,"0")} ${months[d.getMonth()]} ${d.getFullYear()} at ${String(h).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")} ${ampm}`;
}

// ---------- Main ----------
type Screen = "login" | "admin-login" | "admin" | "licence";

export default function Index() {
  const [fontsLoaded] = useFonts({ LaBelleAurore_400Regular });
  const [screen, setScreen] = useState<Screen>("login");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);

  // Load accounts from backend
  useEffect(() => {
    refresh();
  }, []);

  // Cross-device sync: poll the server every 4 seconds so that new accounts
  // created on one device appear on others, and edits made on one device
  // update the licence view on any other device viewing the same account.
  useEffect(() => {
    const id = setInterval(() => {
      refresh();
    }, 4000);
    return () => clearInterval(id);
  }, []);

  const refresh = async () => {
    try {
      const res = await fetch(`${API_BASE}/accounts`);
      if (res.ok) {
        const data = await res.json();
        setAccounts(data);
      }
    } catch (e) {
      console.log("load error", e);
    }
  };

  const currentAccount = accounts.find((x) => x.id === currentId) || null;

  const updateCurrentLicence = async (l: Licence) => {
    if (!currentAccount) return;
    try {
      const res = await fetch(`${API_BASE}/accounts/${currentAccount.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licence: l }),
      });
      if (res.ok) {
        const updated = await res.json();
        setAccounts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      }
    } catch (e) {
      console.log("save error", e);
    }
  };

  const saveAccounts = async (_list: Account[]) => {
    // Kept for compat in admin screen — actual writes happen via specific endpoints
    await refresh();
  };

  const logout = async () => {
    setCurrentId(null);
    setScreen("login");
  };

  if (screen === "login") {
    return (
      <LoginScreen
        accounts={accounts}
        onLogin={async (acc) => {
          setCurrentId(acc.id);
          setScreen("licence");
        }}
        onAdmin={() => setScreen("admin-login")}
      />
    );
  }
  if (screen === "admin-login") {
    return (
      <AdminLoginScreen
        onSuccess={() => setScreen("admin")}
        onBack={() => setScreen("login")}
      />
    );
  }
  if (screen === "admin") {
    return (
      <AdminScreen
        accounts={accounts}
        onRefresh={refresh}
        onBack={() => setScreen("login")}
      />
    );
  }
  // licence
  if (!currentAccount) {
    setScreen("login");
    return null;
  }
  return (
    <LicenceScreen
      account={currentAccount}
      fontsLoaded={fontsLoaded}
      onUpdateLicence={updateCurrentLicence}
      onLogout={logout}
    />
  );
}

// ---------- Login Screen ----------
function LoginScreen({
  accounts,
  onLogin,
  onAdmin,
}: {
  accounts: Account[];
  onLogin: (acc: Account) => void;
  onAdmin: () => void;
}) {
  const [digits, setDigits] = useState("");
  const [letters, setLetters] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const insets = useSafeAreaInsets();

  const tryLogin = async () => {
    if (loading) return;
    setError("");
    if (digits.length !== 6 || letters.length !== 3) {
      setError("Incorrect Credentials");
      return;
    }
    setLoading(true);
    // Fetch latest from server so newly-created accounts are seen instantly
    let latest: Account[] = accounts;
    try {
      const res = await fetch(`${API_BASE}/accounts`);
      if (res.ok) latest = await res.json();
    } catch {}
    const acc = latest.find(
      (a) => a.digits === digits && a.letters.toUpperCase() === letters.toUpperCase()
    );
    if (!acc) {
      setLoading(false);
      setError("Incorrect Credentials");
      return;
    }
    if (acc.locked) {
      setLoading(false);
      setError("Account Locked");
      return;
    }
    // Small delay so the spinner is visible while parent transitions
    setTimeout(() => {
      onLogin(acc);
      setLoading(false);
    }, 400);
  };

  return (
    <SafeAreaView style={authStyles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <TouchableOpacity
        style={[authStyles.adminBtn, { top: insets.top + 8 }]}
        onPress={onAdmin}
        testID="admin-button"
      >
        <Ionicons name="settings-outline" size={18} color="#fff" />
        <Text style={authStyles.adminBtnText}>Admin</Text>
      </TouchableOpacity>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={authStyles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[authStyles.hero, { marginTop: insets.top + 56 }]}>
            <View style={authStyles.heroBadge}>
              <MaterialCommunityIcons name="card-account-details" size={42} color={ORANGE} />
            </View>
            <Text style={authStyles.title}>VicRoads Licence</Text>
            <Text style={authStyles.sub}>Sign in with your codes to view your permit</Text>
          </View>

          <View style={authStyles.formCard}>
            <View style={authStyles.fieldGroup}>
              <Text style={authStyles.label}>6-digit code</Text>
              <View style={authStyles.inputWrap}>
                <Ionicons name="keypad-outline" size={18} color={MUTED} style={authStyles.inputIcon} />
                <TextInput
                  style={authStyles.input}
                  value={digits}
                  onChangeText={(v) => setDigits(v.replace(/\D/g, "").slice(0, 6))}
                  keyboardType="number-pad"
                  maxLength={6}
                  placeholder="000000"
                  placeholderTextColor="#bdc1c8"
                  testID="login-digits"
                />
              </View>
            </View>

            <View style={authStyles.fieldGroup}>
              <Text style={authStyles.label}>3-letter code</Text>
              <View style={authStyles.inputWrap}>
                <Ionicons name="text-outline" size={18} color={MUTED} style={authStyles.inputIcon} />
                <TextInput
                  style={authStyles.input}
                  value={letters}
                  onChangeText={(v) => setLetters(v.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase())}
                  autoCapitalize="characters"
                  maxLength={3}
                  placeholder="ABC"
                  placeholderTextColor="#bdc1c8"
                  testID="login-letters"
                />
              </View>
            </View>

            <TouchableOpacity
              style={[authStyles.primaryBtn, loading && { opacity: 0.9 }]}
              onPress={tryLogin}
              disabled={loading}
              testID="login-submit"
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={authStyles.primaryBtnText}>Sign in</Text>
              )}
            </TouchableOpacity>

            {error ? (
              <View style={authStyles.errorBox} testID="login-error-box">
                <Ionicons name="alert-circle" size={18} color="#B42318" />
                <Text style={authStyles.errorText} testID="login-error">{error}</Text>
              </View>
            ) : null}
          </View>

          <View style={authStyles.footer}>
            <Text style={authStyles.footerText}>Codes are provided by your administrator</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ---------- Admin login ----------
function AdminLoginScreen({
  onSuccess,
  onBack,
}: {
  onSuccess: () => void;
  onBack: () => void;
}) {
  const [digits, setDigits] = useState("");
  const [letters, setLetters] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const insets = useSafeAreaInsets();
  return (
    <SafeAreaView style={authStyles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={authStyles.topRow}>
        <TouchableOpacity onPress={onBack} style={authStyles.backBtn} testID="admin-back">
          <Ionicons name="arrow-back" size={24} color={DARK} />
        </TouchableOpacity>
        <Text style={authStyles.topTitle}>Admin sign-in</Text>
        <View style={{ width: 44 }} />
      </View>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={authStyles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[authStyles.hero, { marginTop: 12 }]}>
            <View style={authStyles.heroBadge}>
              <Ionicons name="shield-checkmark" size={42} color={ORANGE} />
            </View>
            <Text style={authStyles.title}>Admin console</Text>
            <Text style={authStyles.sub}>Restricted area. Enter the admin codes to continue</Text>
          </View>

          <View style={authStyles.formCard}>
            <View style={authStyles.fieldGroup}>
              <Text style={authStyles.label}>4-digit code</Text>
              <View style={authStyles.inputWrap}>
                <Ionicons name="keypad-outline" size={18} color={MUTED} style={authStyles.inputIcon} />
                <TextInput
                  style={authStyles.input}
                  value={digits}
                  onChangeText={(v) => setDigits(v.replace(/\D/g, "").slice(0, 4))}
                  keyboardType="number-pad"
                  maxLength={4}
                  placeholder="0000"
                  placeholderTextColor="#bdc1c8"
                  testID="admin-digits"
                />
              </View>
            </View>
            <View style={authStyles.fieldGroup}>
              <Text style={authStyles.label}>6-letter code</Text>
              <View style={authStyles.inputWrap}>
                <Ionicons name="text-outline" size={18} color={MUTED} style={authStyles.inputIcon} />
                <TextInput
                  style={authStyles.input}
                  value={letters}
                  onChangeText={(v) => setLetters(v.replace(/[^A-Za-z]/g, "").slice(0, 6).toUpperCase())}
                  autoCapitalize="characters"
                  maxLength={6}
                  placeholder="ABCDEF"
                  placeholderTextColor="#bdc1c8"
                  testID="admin-letters"
                />
              </View>
            </View>

            <TouchableOpacity
              style={[authStyles.primaryBtn, loading && { opacity: 0.9 }]}
              disabled={loading}
              activeOpacity={0.85}
              onPress={() => {
                if (loading) return;
                setError("");
                if (digits === ADMIN_DIGITS && letters.toUpperCase() === ADMIN_LETTERS) {
                  setLoading(true);
                  setTimeout(() => {
                    onSuccess();
                    setLoading(false);
                  }, 400);
                } else {
                  setError("Incorrect Credentials");
                }
              }}
              testID="admin-submit"
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={authStyles.primaryBtnText}>Enter admin</Text>
              )}
            </TouchableOpacity>

            {error ? (
              <View style={authStyles.errorBox} testID="admin-error-box">
                <Ionicons name="alert-circle" size={18} color="#B42318" />
                <Text style={authStyles.errorText} testID="admin-error">{error}</Text>
              </View>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ---------- Admin Screen ----------
function AdminScreen({
  accounts,
  onRefresh,
  onBack,
}: {
  accounts: Account[];
  onRefresh: () => Promise<void>;
  onBack: () => void;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [digits, setDigits] = useState("");
  const [letters, setLetters] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [lockingId, setLockingId] = useState<string | null>(null);

  const randomize = () => {
    setDigits(randomDigits(6));
    setLetters(randomLetters(3));
  };

  const create = async () => {
    if (creating) return;
    if (!name.trim()) {
      Alert.alert("Missing", "Enter a name for the account.");
      return;
    }
    if (digits.length !== 6 || letters.length !== 3) {
      Alert.alert("Missing", "Need a 6-digit code and 3-letter code.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch(`${API_BASE}/accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          digits,
          letters: letters.toUpperCase(),
          licence: {
            permitNumber: formatPermit(randomDigits(9)),
            cardNumber: "P" + randomDigits(7),
            expiry: "15 Jan 2026",
            licenceType: "Car",
            dob: "01 Jan 2008",
            addressLine1: "",
            addressLine2: "",
            signatureName: "",
            permitStatus: "Current",
            proficiency: "Probationary",
            issueDate: "15 Jan 2027",
            photoUri: "",
          },
        }),
      });
      if (res.status === 409) {
        Alert.alert("Duplicate", "Those codes are already in use.");
        return;
      }
      if (!res.ok) {
        Alert.alert("Error", "Could not create account.");
        return;
      }
      await onRefresh();
      setName("");
      setDigits("");
      setLetters("");
      setCreateOpen(false);
    } catch (e) {
      Alert.alert("Network error", "Could not reach server.");
    } finally {
      setCreating(false);
    }
  };

  const toggleLock = async (id: string) => {
    if (lockingId) return;
    const a = accounts.find((x) => x.id === id);
    if (!a) return;
    setLockingId(id);
    try {
      await fetch(`${API_BASE}/accounts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locked: !a.locked }),
      });
      await onRefresh();
    } catch {}
    setLockingId(null);
  };

  const remove = (id: string) => {
    setDeleteId(id);
  };
  const confirmDelete = async () => {
    if (!deleteId || deleting) return;
    setDeleting(true);
    try {
      await fetch(`${API_BASE}/accounts/${deleteId}`, { method: "DELETE" });
      await onRefresh();
    } catch {}
    setDeleting(false);
    setDeleteId(null);
  };

  const initials = (n: string) =>
    n
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join("");

  return (
    <SafeAreaView style={authStyles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={authStyles.topRow}>
        <TouchableOpacity onPress={onBack} style={authStyles.backBtn} testID="admin-exit">
          <Ionicons name="arrow-back" size={24} color={DARK} />
        </TouchableOpacity>
        <Text style={authStyles.topTitle}>Admin console</Text>
        <TouchableOpacity
          onPress={() => {
            setName("");
            randomize();
            setCreateOpen(true);
          }}
          style={authStyles.backBtn}
          testID="admin-create-open"
        >
          <View style={adminStyles.addBtn}>
            <Ionicons name="add" size={24} color="#fff" />
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingTop: 0, paddingBottom: 30 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={adminStyles.sectionHead}>
          <Text style={adminStyles.sectionTitle}>Accounts</Text>
          <View style={adminStyles.countChip}>
            <Text style={adminStyles.countChipText}>{accounts.length}</Text>
          </View>
        </View>

        {accounts.length === 0 && (
          <View style={adminStyles.emptyWrap}>
            <View style={adminStyles.emptyIconBubble}>
              <Ionicons name="people-outline" size={36} color={MUTED} />
            </View>
            <Text style={adminStyles.emptyTitle}>No accounts yet</Text>
            <Text style={adminStyles.emptySub}>Tap the + button above to create your first licence holder.</Text>
          </View>
        )}

        {accounts.map((a) => (
          <View key={a.id} style={adminStyles.card} testID={`account-${a.id}`}>
            <View style={adminStyles.avatar}>
              <Text style={adminStyles.avatarText}>{initials(a.name) || "?"}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={adminStyles.cardName} numberOfLines={1}>{a.name}</Text>
              <View style={adminStyles.codeRow}>
                <View style={adminStyles.codeChip}>
                  <Text style={adminStyles.codeChipText}>{a.digits}</Text>
                </View>
                <View style={adminStyles.codeChip}>
                  <Text style={adminStyles.codeChipText}>{a.letters}</Text>
                </View>
                {a.locked && (
                  <View style={adminStyles.lockedChip}>
                    <Text style={adminStyles.lockedChipText}>LOCKED</Text>
                  </View>
                )}
              </View>
            </View>
            <TouchableOpacity
              onPress={() => toggleLock(a.id)}
              style={adminStyles.iconBtn}
              disabled={lockingId === a.id}
              testID={`lock-${a.id}`}
            >
              {lockingId === a.id ? (
                <ActivityIndicator size="small" color={ORANGE} />
              ) : (
                <Ionicons
                  name={a.locked ? "lock-closed" : "lock-open"}
                  size={20}
                  color={a.locked ? ORANGE : MUTED}
                />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => remove(a.id)}
              style={adminStyles.iconBtn}
              testID={`delete-${a.id}`}
            >
              <Ionicons name="trash-outline" size={20} color="#c0392b" />
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      {/* Delete confirmation modal */}
      <Modal visible={!!deleteId} transparent animationType="fade" onRequestClose={() => setDeleteId(null)}>
        <View style={adminStyles.confirmBackdrop}>
          <View style={adminStyles.confirmCard}>
            <View style={adminStyles.confirmIcon}>
              <Ionicons name="trash" size={28} color="#c0392b" />
            </View>
            <Text style={adminStyles.confirmTitle}>Delete account?</Text>
            <Text style={adminStyles.confirmBody}>
              This will permanently remove the account and its licence. This cannot be undone.
            </Text>
            <View style={adminStyles.confirmRow}>
              <TouchableOpacity
                style={[adminStyles.confirmBtn, { backgroundColor: "#F2F4F7" }]}
                onPress={() => setDeleteId(null)}
                testID="delete-no"
              >
                <Text style={[adminStyles.confirmBtnText, { color: DARK }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[adminStyles.confirmBtn, { backgroundColor: "#c0392b" }, deleting && { opacity: 0.85 }]}
                onPress={confirmDelete}
                disabled={deleting}
                testID="delete-confirm"
              >
                {deleting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={[adminStyles.confirmBtnText, { color: "#fff" }]}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Create modal */}
      <Modal visible={createOpen} animationType="slide" onRequestClose={() => setCreateOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View style={authStyles.topRow}>
              <TouchableOpacity onPress={() => setCreateOpen(false)} style={authStyles.backBtn}>
                <Text style={{ fontSize: 15, color: MUTED, fontWeight: "600" }}>Cancel</Text>
              </TouchableOpacity>
              <Text style={authStyles.topTitle}>New account</Text>
              <TouchableOpacity onPress={create} style={authStyles.backBtn} disabled={creating} testID="create-save">
                {creating ? (
                  <ActivityIndicator size="small" color={ORANGE} />
                ) : (
                  <Text style={{ fontSize: 15, color: ORANGE, fontWeight: "800" }}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 50 }} keyboardShouldPersistTaps="handled">
              <View style={[authStyles.hero, { paddingTop: 4, paddingBottom: 18 }]}>
                <View style={authStyles.heroBadge}>
                  <Ionicons name="person-add" size={36} color={ORANGE} />
                </View>
                <Text style={[authStyles.title, { fontSize: 22 }]}>Create account</Text>
                <Text style={authStyles.sub}>Give a name and login codes for this licence holder</Text>
              </View>

              <View style={authStyles.formCard}>
                <View style={authStyles.fieldGroup}>
                  <Text style={authStyles.label}>Full name</Text>
                  <View style={authStyles.inputWrap}>
                    <Ionicons name="person-outline" size={18} color={MUTED} style={authStyles.inputIcon} />
                    <TextInput
                      style={[authStyles.input, { letterSpacing: 0, fontWeight: "600" }]}
                      value={name}
                      onChangeText={setName}
                      placeholder="e.g. Quayde A Burnham"
                      placeholderTextColor="#bdc1c8"
                      testID="create-name"
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={adminStyles.randomBtn}
                  onPress={randomize}
                  testID="randomize-btn"
                  activeOpacity={0.85}
                >
                  <Ionicons name="shuffle" size={16} color="#fff" />
                  <Text style={adminStyles.randomBtnText}>Randomize codes</Text>
                </TouchableOpacity>

                <View style={authStyles.fieldGroup}>
                  <Text style={authStyles.label}>6-digit code</Text>
                  <View style={authStyles.inputWrap}>
                    <Ionicons name="keypad-outline" size={18} color={MUTED} style={authStyles.inputIcon} />
                    <TextInput
                      style={authStyles.input}
                      value={digits}
                      onChangeText={(v) => setDigits(v.replace(/\D/g, "").slice(0, 6))}
                      keyboardType="number-pad"
                      maxLength={6}
                      placeholder="000000"
                      placeholderTextColor="#bdc1c8"
                      testID="create-digits"
                    />
                  </View>
                </View>
                <View style={authStyles.fieldGroup}>
                  <Text style={authStyles.label}>3-letter code</Text>
                  <View style={authStyles.inputWrap}>
                    <Ionicons name="text-outline" size={18} color={MUTED} style={authStyles.inputIcon} />
                    <TextInput
                      style={authStyles.input}
                      value={letters}
                      onChangeText={(v) => setLetters(v.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase())}
                      autoCapitalize="characters"
                      maxLength={3}
                      placeholder="ABC"
                      placeholderTextColor="#bdc1c8"
                      testID="create-letters"
                    />
                  </View>
                </View>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ---------- Licence Screen ----------
function LicenceScreen({
  account,
  fontsLoaded,
  onUpdateLicence,
  onLogout,
}: {
  account: Account;
  fontsLoaded: boolean;
  onUpdateLicence: (l: Licence) => void | Promise<void>;
  onLogout: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<"permit" | "identity" | "age">("permit");
  const [editVisible, setEditVisible] = useState(false);
  const [draft, setDraft] = useState<Licence>(account.licence);
  const [refreshedAt, setRefreshedAt] = useState<Date>(new Date());
  const [datePickerField, setDatePickerField] = useState<null | "dob" | "expiry" | "issueDate">(null);
  const [dateBackup, setDateBackup] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [dateSaving, setDateSaving] = useState(false);
  const [pickingPhoto, setPickingPhoto] = useState(false);

  const openDatePicker = (field: "dob" | "expiry" | "issueDate") => {
    setDateBackup(draft[field]);
    setDatePickerField(field);
  };
  const cancelDatePicker = () => {
    if (datePickerField) {
      setDraft({ ...draft, [datePickerField]: dateBackup });
    }
    setDatePickerField(null);
  };

  const parseDate = (s: string): Date => {
    const d = new Date(s);
    return isNaN(d.getTime()) ? new Date(2008, 0, 1) : d;
  };
  const formatDate = (d: Date) => {
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${String(d.getDate()).padStart(2,"0")} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  // Reset draft when account changes
  useEffect(() => {
    setDraft(account.licence);
  }, [account.id]);

  const data = account.licence;

  const openEdit = () => {
    setDraft(data);
    setEditVisible(true);
  };
  const saveEdit = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onUpdateLicence(draft);
      setRefreshedAt(new Date());
      setEditVisible(false);
    } finally {
      setSaving(false);
    }
  }, [draft, onUpdateLicence, saving]);

  const pickPhoto = async () => {
    if (pickingPhoto) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Please allow photo access to change your picture.");
      return;
    }
    setPickingPhoto(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.7,
        base64: true,
      });
      if (!result.canceled && result.assets?.[0]) {
        const a = result.assets[0];
        const uri = a.base64 ? `data:image/jpeg;base64,${a.base64}` : a.uri;
        setDraft({ ...draft, photoUri: uri });
      }
    } finally {
      setPickingPhoto(false);
    }
  };

  const fullName = account.name.toUpperCase();
  const initials = account.name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.iconBtn} onPress={onLogout} testID="logout-button">
            <Ionicons name="arrow-back" size={26} color={DARK} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>View details</Text>
          <View style={styles.iconBtn} />
        </View>
        <Text style={styles.refreshed}>
          Last refreshed: {formatRefreshed(refreshedAt)}
        </Text>

        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Header strip */}
          <View style={styles.headerStrip}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text
                style={styles.headerTitle}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                PROBATIONARY DRIVER LICENCE
              </Text>
              <Text style={styles.headerSub}>Victoria Australia</Text>
            </View>
            <Image
              source={{
                uri: "https://customer-assets.emergentagent.com/job_permit-wallet/artifacts/cogszfss_IMG_5144.jpeg",
              }}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>

          {/* Photo + QR consent */}
          <View style={styles.greenBlock}>
            <View style={styles.photoWrap}>
              {data.photoUri ? (
                <Image
                  source={{ uri: data.photoUri }}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.photoBg}>
                  <Text style={styles.photoInitials}>{initials || "?"}</Text>
                </View>
              )}
              <View pointerEvents="none" style={styles.watermarkOverlay}>
                {[
                  { top: -15, left: -15 },
                  { top: 60, right: -20 },
                  { bottom: -15, left: -25 },
                ].map((pos, i) => (
                  <Image
                    key={i}
                    source={require("../assets/watermark.png")}
                    style={[
                      { position: "absolute", width: 140, height: 140, opacity: 0.35 },
                      pos,
                    ]}
                    resizeMode="contain"
                  />
                ))}
              </View>
            </View>

            <View style={styles.qrPanel}>
              <Text style={styles.qrText}>
                Presenting a QR code allows your driver licence information to be scanned and shared.
              </Text>
              <Text style={styles.qrPrompt}>Do you consent to share your information?</Text>
              <TouchableOpacity style={styles.qrButton} onPress={openEdit} testID="reveal-qr">
                <Text style={styles.qrButtonText}>Reveal QR code</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Tabs */}
          <View style={styles.tabsRow}>
            {(["permit", "identity", "age"] as const).map((t) => {
              const active = activeTab === t;
              const labels: Record<typeof t, string> = {
                permit: "License",
                identity: "Identity",
                age: "Age",
              };
              return (
                <TouchableOpacity
                  key={t}
                  onPress={() => setActiveTab(t)}
                  style={[styles.tabBtn, active && styles.tabBtnActive]}
                >
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>
                    {labels[t]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={styles.divider} />

          {activeTab === "permit" && (
            <View style={styles.detailsBlock}>
              <Text
                style={styles.bigName}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.4}
                ellipsizeMode="clip"
              >
                {fullName}
              </Text>

              <View style={styles.row}>
                <Field label="Permit number" value={data.permitNumber || "—"} />
                <Field label="Expiry" value={data.expiry} />
              </View>
              <View style={styles.hairline} />

              <View style={styles.row}>
                <View style={styles.col}>
                  <Text style={styles.fieldLabel}>Licence type</Text>
                  <View style={styles.typeRow}>
                    <Text style={styles.fieldValue}>{data.licenceType}</Text>
                    <View style={styles.pBadge}>
                      <Text style={styles.pBadgeText}>P</Text>
                    </View>
                  </View>
                </View>
                <Field label="Date of birth" value={data.dob} />
              </View>
              <View style={styles.hairline} />

              <View style={styles.col}>
                <Text style={styles.fieldLabel}>Address</Text>
                <Text style={styles.fieldValue}>{data.addressLine1 || "—"}</Text>
                <Text style={styles.fieldValue}>{data.addressLine2 || ""}</Text>
              </View>
              <View style={styles.hairline} />

              <View style={styles.col}>
                <Text style={styles.fieldLabel}>Signature</Text>
                <Text
                  style={[
                    styles.signature,
                    { fontFamily: fontsLoaded ? "LaBelleAurore_400Regular" : undefined },
                  ]}
                >
                  {data.signatureName || "—"}
                </Text>
              </View>
              <View style={styles.hairline} />

              <View style={styles.col}>
                <Text style={styles.fieldLabel}>Permit status</Text>
                <View style={styles.statusRow}>
                  <Ionicons name="checkmark-circle" size={22} color="#1f9d55" />
                  <Text style={styles.fieldValue}>{data.permitStatus}</Text>
                </View>
              </View>
              <View style={styles.hairline} />

              <View style={styles.col}>
                <Text style={styles.fieldLabel}>Proficiency</Text>
                <View style={styles.statusRow}>
                  <View style={styles.pBadge}>
                    <Text style={styles.pBadgeText}>P</Text>
                  </View>
                  <Text style={styles.fieldValue}>{data.proficiency}</Text>
                </View>
              </View>
              <View style={styles.hairline} />

              <View style={styles.row}>
                <Field label="Issue date" value={data.issueDate} />
                <Field label="Expiry" value={data.expiry} />
              </View>
              <View style={styles.hairline} />

              <Text style={styles.sectionTitle}>Other details</Text>
              <Field label="Card number" value={data.cardNumber || "—"} />

              <View style={styles.col}>
                <Text style={styles.fieldLabel}>Victoria Police barcode</Text>
                <View style={styles.barcodeBox} testID="barcode">
                  {Array.from({ length: 60 }).map((_, i) => {
                    const w = (i * 7) % 5 + 1;
                    return (
                      <View
                        key={i}
                        style={{
                          width: w,
                          marginRight: ((i * 3) % 4) + 1,
                          height: 70,
                          backgroundColor: "#0f1722",
                        }}
                      />
                    );
                  })}
                </View>
              </View>
            </View>
          )}

          {activeTab === "identity" && <EmptyTab title="Identity" icon="card-account-details-outline" />}
          {activeTab === "age" && <EmptyTab title="Age" icon="cake-variant-outline" />}
        </ScrollView>
      </SafeAreaView>

      {/* Edit modal */}
      <Modal visible={editVisible} animationType="slide" onRequestClose={() => setEditVisible(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <View style={styles.editHeader}>
              <TouchableOpacity onPress={() => setEditVisible(false)} style={styles.editHeaderBtn}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Edit details</Text>
              <TouchableOpacity onPress={saveEdit} disabled={saving} style={styles.editHeaderBtn} testID="save-edit">
                {saving ? (
                  <ActivityIndicator size="small" color={ORANGE} />
                ) : (
                  <Text style={styles.modalSave}>Save</Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Photo card */}
              <View style={styles.editPhotoCard}>
                <View style={styles.editPhotoFrame}>
                  {draft.photoUri ? (
                    <Image source={{ uri: draft.photoUri }} style={styles.editPhotoImg} />
                  ) : (
                    <View style={[styles.editPhotoImg, { alignItems: "center", justifyContent: "center", backgroundColor: "#F2F4F7" }]}>
                      <Ionicons name="person" size={56} color="#A5ACBA" />
                    </View>
                  )}
                </View>
                <Text style={styles.editPhotoTitle}>Profile picture</Text>
                <Text style={styles.editPhotoSub}>Tap below to upload a new photo</Text>
                <TouchableOpacity
                  onPress={pickPhoto}
                  disabled={pickingPhoto}
                  style={[styles.editPhotoBtn, pickingPhoto && { opacity: 0.85 }]}
                  testID="pick-photo"
                  activeOpacity={0.85}
                >
                  {pickingPhoto ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="camera" size={16} color="#fff" />
                      <Text style={styles.editPhotoBtnText}>Change picture</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {/* Identity section */}
              <Text style={styles.editSection}>Identity</Text>
              <View style={styles.editGroup}>
                <LockedRow label="Name" value={account.name} icon="person-outline" />
                <View style={styles.editDivider} />
                <DateField
                  label="Date of birth"
                  value={draft.dob}
                  onPress={() => openDatePicker("dob")}
                />
                <View style={styles.editDivider} />
                <EditField label="Signature name" value={draft.signatureName}
                  onChange={(v) => setDraft({ ...draft, signatureName: v })} />
              </View>

              {/* Address section */}
              <Text style={styles.editSection}>Address</Text>
              <View style={styles.editGroup}>
                <EditField label="Address line 1" value={draft.addressLine1}
                  onChange={(v) => setDraft({ ...draft, addressLine1: v.toUpperCase() })} />
                <View style={styles.editDivider} />
                <EditField label="Address line 2" value={draft.addressLine2}
                  onChange={(v) => setDraft({ ...draft, addressLine2: v.toUpperCase() })} />
              </View>

              {/* Licence details section */}
              <Text style={styles.editSection}>Licence</Text>
              <View style={styles.editGroup}>
                <LockedRow label="Licence type" value={draft.licenceType} icon="car-outline" />
                <View style={styles.editDivider} />
                <LockedRow label="Permit status" value={draft.permitStatus} icon="checkmark-circle-outline" />
                <View style={styles.editDivider} />
                <LockedRow label="Proficiency" value={draft.proficiency} icon="ribbon-outline" />
                <View style={styles.editDivider} />
                <DateField
                  label="Issue date"
                  value={draft.issueDate}
                  onPress={() => openDatePicker("issueDate")}
                />
                <View style={styles.editDivider} />
                <DateField
                  label="Expiry"
                  value={draft.expiry}
                  onPress={() => openDatePicker("expiry")}
                />
              </View>

              {/* System fields (locked) */}
              <Text style={styles.editSection}>System</Text>
              <View style={styles.editGroup}>
                <LockedRow label="Permit number" value={draft.permitNumber} icon="document-text-outline" />
                <View style={styles.editDivider} />
                <LockedRow label="Card number" value={draft.cardNumber} icon="card-outline" />
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
      {/* Date picker overlay */}
      <Modal
        visible={!!datePickerField}
        transparent
        animationType="fade"
        onRequestClose={cancelDatePicker}
      >
        <View style={styles.dateBackdrop}>
          <View style={styles.dateCard}>
            <Text style={styles.dateTitle}>
              {datePickerField === "dob"
                ? "Date of birth"
                : datePickerField === "expiry"
                ? "Expiry"
                : "Issue date"}
            </Text>
            {datePickerField && (
              <WheelDatePicker
                value={parseDate(draft[datePickerField])}
                onChange={(d) =>
                  setDraft({ ...draft, [datePickerField]: formatDate(d) })
                }
              />
            )}
            <View style={styles.dateBtnRow}>
              <TouchableOpacity
                style={[styles.dateCancelBtn, dateSaving && { opacity: 0.6 }]}
                disabled={dateSaving}
                onPress={cancelDatePicker}
                testID="date-cancel"
              >
                <Text style={styles.dateCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dateDoneBtn, dateSaving && { opacity: 0.85 }]}
                disabled={dateSaving}
                onPress={async () => {
                  if (dateSaving) return;
                  setDateSaving(true);
                  try {
                    await onUpdateLicence(draft);
                    setRefreshedAt(new Date());
                    setDatePickerField(null);
                  } finally {
                    setDateSaving(false);
                  }
                }}
                testID="date-done"
              >
                {dateSaving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.dateDoneText}>Done</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
} 

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.col}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}
function EditField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.editRow}>
      <Text style={styles.editLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        style={styles.editInput}
        placeholderTextColor="#9aa1ad"
      />
    </View>
  );
}
function DateField({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.editRow}>
      <Text style={styles.editLabel}>{label}</Text>
      <TouchableOpacity onPress={onPress} style={styles.editDateBtn} testID={`date-${label}`} activeOpacity={0.7}>
        <Text style={styles.editDateText}>{value || "Select date"}</Text>
        <Ionicons name="calendar-outline" size={18} color={MUTED} />
      </TouchableOpacity>
    </View>
  );
}
function LockedRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: any;
}) {
  return (
    <View style={styles.editRow}>
      <Text style={styles.editLabel}>{label}</Text>
      <View style={styles.editLocked}>
        <Ionicons name={icon} size={16} color={MUTED} style={{ marginRight: 8 }} />
        <Text style={styles.editLockedText} numberOfLines={1}>{value || "—"}</Text>
        <Ionicons name="lock-closed" size={14} color={MUTED} style={{ marginLeft: "auto" }} />
      </View>
    </View>
  );
}

const ITEM_H = 44;
const VISIBLE = 5; // odd number so a row is centred
const PICKER_H = ITEM_H * VISIBLE;

function WheelColumn({
  data,
  initialIndex,
  onChange,
  width,
}: {
  data: string[];
  initialIndex: number;
  onChange: (i: number) => void;
  width: number;
}) {
  const ref = React.useRef<any>(null);
  const didInitial = React.useRef(false);

  React.useEffect(() => {
    if (didInitial.current) return;
    const t = setTimeout(() => {
      if (ref.current && initialIndex >= 0) {
        ref.current.scrollTo({ y: initialIndex * ITEM_H, animated: false });
      }
      didInitial.current = true;
    }, 30);
    return () => clearTimeout(t);
  }, [initialIndex]);

  const [centerIdx, setCenterIdx] = React.useState(initialIndex);

  const snapTo = (rawY: number) => {
    const idx = Math.round(rawY / ITEM_H);
    const clamped = Math.max(0, Math.min(data.length - 1, idx));
    // Programmatically snap to the locked row so the UI matches the value.
    if (ref.current) {
      ref.current.scrollTo({ y: clamped * ITEM_H, animated: true });
    }
    if (clamped !== centerIdx) {
      setCenterIdx(clamped);
    }
    onChange(clamped);
  };

  return (
    <View style={{ width, height: PICKER_H }}>
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum
        contentContainerStyle={{ paddingVertical: ITEM_H * Math.floor(VISIBLE / 2) }}
        onScroll={(e) => {
          // Update both the visual highlight AND the committed value live so
          // that pressing "Done" always saves what the user currently sees.
          const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
          const clamped = Math.max(0, Math.min(data.length - 1, idx));
          if (clamped !== centerIdx) {
            setCenterIdx(clamped);
            onChange(clamped);
          }
        }}
        scrollEventThrottle={16}
        onScrollEndDrag={(e) => snapTo(e.nativeEvent.contentOffset.y)}
        onMomentumScrollEnd={(e) => snapTo(e.nativeEvent.contentOffset.y)}
      >
        {data.map((item, i) => (
          <View
            key={i}
            style={{
              height: ITEM_H,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                color: i === centerIdx ? "#fff" : "rgba(255,255,255,0.45)",
                fontSize: i === centerIdx ? 22 : 18,
                fontWeight: i === centerIdx ? "800" : "500",
              }}
            >
              {item}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function WheelDatePicker({
  value,
  onChange,
}: {
  value: Date;
  onChange: (d: Date) => void;
}) {
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const years: string[] = [];
  for (let y = 1950; y <= 2050; y++) years.push(String(y));

  const dRef = React.useRef({
    day: value.getDate(),
    month: value.getMonth(),
    year: value.getFullYear(),
  });
  const [, force] = React.useState(0);

  const apply = (changes: Partial<{ day: number; month: number; year: number }>) => {
    dRef.current = { ...dRef.current, ...changes };
    const { year, month, day } = dRef.current;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const safeDay = Math.min(day, daysInMonth);
    if (safeDay !== day) dRef.current.day = safeDay;
    onChange(new Date(year, month, safeDay));
    force((n) => n + 1);
  };

  const { day, month, year } = dRef.current;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: string[] = [];
  for (let d = 1; d <= daysInMonth; d++) days.push(String(d).padStart(2, "0"));

  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginVertical: 6 }}>
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 8,
          right: 8,
          top: PICKER_H / 2 - ITEM_H / 2,
          height: ITEM_H,
          borderTopWidth: 1,
          borderBottomWidth: 1,
          borderColor: "rgba(255,255,255,0.18)",
          backgroundColor: "rgba(255,255,255,0.06)",
          borderRadius: 8,
          zIndex: 1,
        }}
      />
      <WheelColumn
        data={days}
        initialIndex={Math.min(day - 1, days.length - 1)}
        onChange={(i) => apply({ day: i + 1 })}
        width={70}
      />
      <WheelColumn
        data={months}
        initialIndex={month}
        onChange={(i) => apply({ month: i })}
        width={90}
      />
      <WheelColumn
        data={years}
        initialIndex={years.indexOf(String(year))}
        onChange={(i) => apply({ year: parseInt(years[i], 10) })}
        width={90}
      />
    </View>
  );
}

function EmptyTab({
  icon,
  title,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
}) {
  return (
    <View style={styles.emptyWrap}>
      <MaterialCommunityIcons name={icon} size={56} color="#c8cdd6" />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySub}>Nothing to display here yet.</Text>
    </View>
  );
}

// ---------- Styles ----------
const authStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  scroll: { flexGrow: 1, paddingBottom: 24 },

  // Top bar (back arrow / title / right action)
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  topTitle: { fontSize: 17, fontWeight: "700", color: DARK },
  backBtn: { padding: 10, minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },

  // Hero section at top of auth screens
  hero: {
    paddingTop: 8,
    paddingBottom: 28,
    paddingHorizontal: 28,
    alignItems: "center",
  },
  heroBadge: {
    width: 84,
    height: 84,
    borderRadius: 24,
    backgroundColor: "#FFF1EC",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
    shadowColor: ORANGE,
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: DARK,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  sub: {
    fontSize: 15,
    color: MUTED,
    textAlign: "center",
    marginTop: 8,
  },

  // Admin pill (top-left on login)
  adminBtn: {
    position: "absolute",
    left: 16,
    backgroundColor: "#0F1722",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    zIndex: 10,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  adminBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },

  // Form card
  formCard: {
    marginHorizontal: 22,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: "#EEF0F3",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },

  // Inputs
  fieldGroup: { marginBottom: 14 },
  label: {
    color: DARK,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    backgroundColor: "#FAFBFC",
    paddingHorizontal: 14,
    height: 54,
  },
  inputWrapFocused: { borderColor: ORANGE, backgroundColor: "#fff" },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1,
    fontSize: 18,
    color: DARK,
    letterSpacing: 4,
    fontWeight: "700",
    paddingVertical: 0,
  },
  inputHint: {
    fontSize: 12,
    color: MUTED,
    marginTop: 6,
    marginLeft: 4,
  },

  // Primary CTA
  primaryBtn: {
    backgroundColor: ORANGE,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 18,
    shadowColor: ORANGE,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.3,
  },

  hint: { textAlign: "center", color: MUTED, marginTop: 16, fontSize: 13 },

  // Error banner
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FDECEC",
    borderColor: "#F5C2C7",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 16,
    alignSelf: "center",
  },
  errorText: { color: "#B42318", fontSize: 14, fontWeight: "700" },

  // Footer caption (under form)
  footer: {
    marginTop: 18,
    alignItems: "center",
  },
  footerText: { color: MUTED, fontSize: 12 },
});

const adminStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff" },

  // Section header
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 12,
  },
  sectionTitle: { fontSize: 22, fontWeight: "800", color: DARK, letterSpacing: -0.2 },
  countChip: {
    backgroundColor: "#F1F2F5",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  countChipText: { color: MUTED, fontWeight: "700", fontSize: 12 },

  // Account row card
  card: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: "#fff",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#EEF0F3",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#FFF1EC",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: { color: ORANGE, fontWeight: "800", fontSize: 16 },
  cardName: { fontSize: 16, fontWeight: "800", color: DARK },
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 5,
    gap: 6,
    flexWrap: "wrap",
  },
  codeChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "#F2F4F7",
  },
  codeChipText: { color: DARK, fontSize: 12, fontWeight: "700", letterSpacing: 1 },
  lockedChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "#FEF3F2",
  },
  lockedChipText: { color: "#B42318", fontSize: 11, fontWeight: "800", letterSpacing: 0.6 },

  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F7F8FA",
    marginLeft: 6,
  },

  // Empty state
  emptyWrap: { alignItems: "center", paddingTop: 80, paddingHorizontal: 30 },
  emptyIconBubble: {
    width: 84,
    height: 84,
    borderRadius: 24,
    backgroundColor: "#F2F4F7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: { color: DARK, fontSize: 18, fontWeight: "800" },
  emptySub: { color: MUTED, fontSize: 14, marginTop: 6, textAlign: "center" },

  // Randomise pill
  randomBtn: {
    flexDirection: "row",
    alignSelf: "flex-start",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#0F1722",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    marginTop: 6,
    marginBottom: 14,
  },
  randomBtnText: { color: "#fff", fontWeight: "700" },

  // Add (+) FAB-like
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: ORANGE,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: ORANGE,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },

  // Confirm modal
  confirmBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,34,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  confirmCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 24,
    alignItems: "center",
  },
  confirmIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#FEF3F2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: DARK,
    textAlign: "center",
    marginBottom: 6,
  },
  confirmBody: {
    fontSize: 14,
    color: MUTED,
    textAlign: "center",
    marginBottom: 22,
    lineHeight: 20,
  },
  confirmRow: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  confirmBtnText: { fontWeight: "800", fontSize: 15 },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  safe: { flex: 1, backgroundColor: "#fff" },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 6,
  },
  iconBtn: { padding: 8, minWidth: 40, alignItems: "center" },
  topTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "700",
    color: DARK,
  },
  refreshed: {
    textAlign: "center",
    color: MUTED,
    fontSize: 13,
    marginTop: 2,
    marginBottom: 12,
  },

  headerStrip: {
    backgroundColor: ORANGE,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitle: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  headerSub: { color: "#fff", fontSize: 12, marginTop: 2, opacity: 0.95 },
  logoImage: { width: 110, height: 38 },

  greenBlock: {
    backgroundColor: GREEN,
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  photoWrap: {
    width: "48%",
    height: 260,
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: "#fce5c4",
    marginRight: "2%",
  },
  photoBg: {
    flex: 1,
    backgroundColor: "#fce5c4",
    alignItems: "center",
    justifyContent: "center",
  },
  photoInitials: {
    fontSize: 72,
    fontWeight: "800",
    color: "#8a5a2b",
    letterSpacing: 2,
  },
  watermarkOverlay: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  qrPanel: {
    width: "48%",
    height: 260,
    backgroundColor: PANEL,
    borderRadius: 4,
    padding: 14,
    justifyContent: "space-between",
    alignItems: "center",
    marginLeft: "2%",
  },
  qrText: { color: "#3b3f47", fontSize: 13, lineHeight: 18, textAlign: "center" },
  qrPrompt: { color: DARK, fontWeight: "700", fontSize: 14, marginTop: 8, textAlign: "center" },
  qrButton: {
    backgroundColor: DARK,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 12,
    alignSelf: "stretch",
  },
  qrButtonText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  tabsRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 12,
    alignItems: "center",
    justifyContent: "space-between",
  },
  tabBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
  },
  tabBtnActive: { backgroundColor: "#3A4656" },
  tabText: { color: MUTED, fontWeight: "600", fontSize: 15 },
  tabTextActive: { color: "#fff", fontWeight: "700" },

  divider: { height: 1, backgroundColor: "#e6e8ec" },

  detailsBlock: { paddingHorizontal: 20, paddingTop: 18 },
  bigName: {
    fontSize: 28,
    fontWeight: "800",
    color: DARK,
    letterSpacing: 0.2,
    marginBottom: 14,
  },
  row: { flexDirection: "row", gap: 16, marginBottom: 14 },
  col: { flex: 1, marginBottom: 14 },
  fieldLabel: { color: MUTED, fontSize: 14, marginBottom: 6 },
  fieldValue: { color: DARK, fontSize: 18, fontWeight: "700" },
  hairline: { height: 1, backgroundColor: "#eceef2", marginBottom: 8 },

  typeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  pBadge: {
    backgroundColor: "#E10600",
    borderRadius: 0,
    width: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  pBadgeText: { color: "#fff", fontWeight: "900", fontSize: 16, lineHeight: 18 },

  signature: {
    fontSize: 44,
    color: DARK,
    fontWeight: "400",
    marginTop: 6,
    lineHeight: 56,
  },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: DARK,
    marginTop: 8,
    marginBottom: 14,
  },
  barcodeBox: {
    flexDirection: "row",
    backgroundColor: "#fff",
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e6e8ec",
    marginTop: 6,
    overflow: "hidden",
  },

  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
    paddingHorizontal: 24,
  },
  emptyTitle: { fontSize: 20, fontWeight: "700", color: DARK, marginTop: 16 },
  emptySub: { color: MUTED, marginTop: 6, fontSize: 14 },

  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#eceef2",
  },
  modalTitle: { fontSize: 17, fontWeight: "800", color: DARK },
  modalCancel: { fontSize: 15, color: MUTED, fontWeight: "600" },
  modalSave: { fontSize: 15, color: ORANGE, fontWeight: "800" },

  // ----- Modern edit modal -----
  editHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF0F3",
    backgroundColor: "#fff",
  },
  editHeaderBtn: {
    minWidth: 60,
    paddingHorizontal: 10,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  editPhotoCard: {
    alignItems: "center",
    padding: 22,
    borderRadius: 22,
    backgroundColor: "#FAFBFC",
    borderWidth: 1,
    borderColor: "#EEF0F3",
    marginBottom: 22,
  },
  editPhotoFrame: {
    padding: 5,
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  editPhotoImg: {
    width: 130,
    height: 170,
    borderRadius: 10,
    backgroundColor: "#eee",
  },
  editPhotoTitle: {
    marginTop: 14,
    fontSize: 16,
    fontWeight: "800",
    color: DARK,
  },
  editPhotoSub: {
    fontSize: 13,
    color: MUTED,
    marginTop: 2,
    marginBottom: 12,
  },
  editPhotoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: ORANGE,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    minHeight: 40,
    shadowColor: ORANGE,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  editPhotoBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  editSection: {
    fontSize: 12,
    fontWeight: "800",
    color: MUTED,
    letterSpacing: 1.2,
    marginBottom: 8,
    marginLeft: 4,
  },
  editGroup: {
    borderRadius: 16,
    backgroundColor: "#FAFBFC",
    borderWidth: 1,
    borderColor: "#EEF0F3",
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 6,
    marginBottom: 22,
  },
  editDivider: {
    height: 1,
    backgroundColor: "#EEF0F3",
    marginVertical: 2,
  },
  editRow: { paddingVertical: 10 },
  editLabel: { color: MUTED, fontSize: 11, fontWeight: "700", marginBottom: 4, letterSpacing: 0.6 },
  editInput: {
    fontSize: 16,
    color: DARK,
    fontWeight: "600",
    paddingVertical: 4,
    paddingHorizontal: 0,
    backgroundColor: "transparent",
  },
  editDateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  editDateText: { fontSize: 16, color: DARK, fontWeight: "600" },
  editLocked: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
  },
  editLockedText: { fontSize: 16, color: DARK, fontWeight: "600", flexShrink: 1 },
  dateBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  dateCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#0f1722",
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  dateTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 6,
  },
  datePicker: {
    height: 220,
    width: "100%",
    backgroundColor: "#0f1722",
  },
  dateBtnRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    marginTop: 10,
  },
  dateCancelBtn: {
    backgroundColor: "#e5e7eb",
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 999,
    minWidth: 110,
    alignItems: "center",
  },
  dateCancelText: { color: DARK, fontWeight: "700", fontSize: 16 },
  dateDoneBtn: {
    backgroundColor: ORANGE,
    paddingHorizontal: 36,
    paddingVertical: 12,
    borderRadius: 999,
    minWidth: 110,
    alignItems: "center",
  },
  dateDoneText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
