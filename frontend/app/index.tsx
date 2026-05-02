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
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
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

const ADMIN_DIGITS = "9999";
const ADMIN_LETTERS = "VICADM";

const KEY_ACCOUNTS = "@vic_accounts_v1";
const KEY_CURRENT = "@vic_current_id";

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

  // Load persisted state
  useEffect(() => {
    (async () => {
      try {
        const a = await AsyncStorage.getItem(KEY_ACCOUNTS);
        const c = await AsyncStorage.getItem(KEY_CURRENT);
        if (a) setAccounts(JSON.parse(a));
        if (c) {
          setCurrentId(c);
          setScreen("licence");
        }
      } catch {}
    })();
  }, []);

  const saveAccounts = async (list: Account[]) => {
    setAccounts(list);
    await AsyncStorage.setItem(KEY_ACCOUNTS, JSON.stringify(list));
  };

  const currentAccount = accounts.find((x) => x.id === currentId) || null;

  const updateCurrentLicence = async (l: Licence) => {
    if (!currentAccount) return;
    const next = accounts.map((a) =>
      a.id === currentAccount.id ? { ...a, licence: l } : a
    );
    await saveAccounts(next);
  };

  const logout = async () => {
    setCurrentId(null);
    await AsyncStorage.removeItem(KEY_CURRENT);
    setScreen("login");
  };

  if (screen === "login") {
    return (
      <LoginScreen
        accounts={accounts}
        onLogin={async (acc) => {
          setCurrentId(acc.id);
          await AsyncStorage.setItem(KEY_CURRENT, acc.id);
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
        onSaveAccounts={saveAccounts}
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
  const insets = useSafeAreaInsets();

  const tryLogin = () => {
    if (digits.length !== 6 || letters.length !== 3) {
      Alert.alert("Invalid", "Enter your 6-digit code and 3-letter code.");
      return;
    }
    const acc = accounts.find(
      (a) => a.digits === digits && a.letters.toUpperCase() === letters.toUpperCase()
    );
    if (!acc) {
      Alert.alert("Login failed", "No account matches those codes.");
      return;
    }
    if (acc.locked) {
      Alert.alert("Account locked", "Contact admin to unlock this account.");
      return;
    }
    onLogin(acc);
  };

  return (
    <SafeAreaView style={authStyles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <TouchableOpacity
        style={[authStyles.adminBtn, { top: insets.top + 8 }]}
        onPress={onAdmin}
        testID="admin-button"
      >
        <Ionicons name="settings-outline" size={20} color="#fff" />
        <Text style={authStyles.adminBtnText}>Admin</Text>
      </TouchableOpacity>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={authStyles.center}>
          <View style={authStyles.logoBig}>
            <MaterialCommunityIcons name="card-account-details" size={56} color={ORANGE} />
          </View>
          <Text style={authStyles.title}>VicRoads Licence</Text>
          <Text style={authStyles.sub}>Sign in with your codes</Text>

          <Text style={authStyles.label}>6-digit code</Text>
          <TextInput
            style={authStyles.input}
            value={digits}
            onChangeText={(v) => setDigits(v.replace(/\D/g, "").slice(0, 6))}
            keyboardType="number-pad"
            maxLength={6}
            placeholder="000000"
            placeholderTextColor="#aaa"
            testID="login-digits"
          />
          <Text style={authStyles.label}>3-letter code</Text>
          <TextInput
            style={authStyles.input}
            value={letters}
            onChangeText={(v) => setLetters(v.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase())}
            autoCapitalize="characters"
            maxLength={3}
            placeholder="ABC"
            placeholderTextColor="#aaa"
            testID="login-letters"
          />

          <TouchableOpacity style={authStyles.primaryBtn} onPress={tryLogin} testID="login-submit">
            <Text style={authStyles.primaryBtnText}>Sign in</Text>
          </TouchableOpacity>

          {accounts.length === 0 && (
            <Text style={authStyles.hint}>
              No accounts yet. Tap Admin (top-left) to create one.
            </Text>
          )}
        </View>
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
  return (
    <SafeAreaView style={authStyles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={authStyles.topRow}>
        <TouchableOpacity onPress={onBack} style={authStyles.backBtn} testID="admin-back">
          <Ionicons name="arrow-back" size={26} color={DARK} />
        </TouchableOpacity>
        <Text style={authStyles.topTitle}>Admin sign-in</Text>
        <View style={{ width: 40 }} />
      </View>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={authStyles.center}>
          <Ionicons name="shield-checkmark" size={56} color={ORANGE} />
          <Text style={authStyles.title}>Admin console</Text>
          <Text style={authStyles.sub}>Enter the admin codes</Text>

          <Text style={authStyles.label}>4-digit code</Text>
          <TextInput
            style={authStyles.input}
            value={digits}
            onChangeText={(v) => setDigits(v.replace(/\D/g, "").slice(0, 4))}
            keyboardType="number-pad"
            maxLength={4}
            placeholder="0000"
            placeholderTextColor="#aaa"
            testID="admin-digits"
          />
          <Text style={authStyles.label}>6-letter code</Text>
          <TextInput
            style={authStyles.input}
            value={letters}
            onChangeText={(v) => setLetters(v.replace(/[^A-Za-z]/g, "").slice(0, 6).toUpperCase())}
            autoCapitalize="characters"
            maxLength={6}
            placeholder="ABCDEF"
            placeholderTextColor="#aaa"
            testID="admin-letters"
          />

          <TouchableOpacity
            style={authStyles.primaryBtn}
            onPress={() => {
              if (digits === ADMIN_DIGITS && letters.toUpperCase() === ADMIN_LETTERS) {
                onSuccess();
              } else {
                Alert.alert("Access denied", "Wrong admin codes.");
              }
            }}
            testID="admin-submit"
          >
            <Text style={authStyles.primaryBtnText}>Enter admin</Text>
          </TouchableOpacity>
          <Text style={authStyles.hint}>Default: {ADMIN_DIGITS} / {ADMIN_LETTERS}</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ---------- Admin Screen ----------
function AdminScreen({
  accounts,
  onSaveAccounts,
  onBack,
}: {
  accounts: Account[];
  onSaveAccounts: (a: Account[]) => Promise<void>;
  onBack: () => void;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [digits, setDigits] = useState("");
  const [letters, setLetters] = useState("");

  const randomize = () => {
    setDigits(randomDigits(6));
    setLetters(randomLetters(3));
  };

  const create = async () => {
    if (!name.trim()) {
      Alert.alert("Missing", "Enter a name for the account.");
      return;
    }
    if (digits.length !== 6 || letters.length !== 3) {
      Alert.alert("Missing", "Need a 6-digit code and 3-letter code.");
      return;
    }
    if (accounts.some((a) => a.digits === digits && a.letters.toUpperCase() === letters.toUpperCase())) {
      Alert.alert("Duplicate", "Those codes are already in use.");
      return;
    }
    const acc: Account = {
      id: newId(),
      name: name.trim(),
      digits,
      letters: letters.toUpperCase(),
      locked: false,
      licence: {
        ...DEFAULT_LICENCE,
        permitNumber: formatPermit(randomDigits(9)),
        cardNumber: "P" + randomDigits(7),
      },
    };
    await onSaveAccounts([...accounts, acc]);
    setName("");
    setDigits("");
    setLetters("");
    setCreateOpen(false);
  };

  const toggleLock = async (id: string) => {
    await onSaveAccounts(
      accounts.map((a) => (a.id === id ? { ...a, locked: !a.locked } : a))
    );
  };

  const remove = (id: string) => {
    Alert.alert("Delete account?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await onSaveAccounts(accounts.filter((a) => a.id !== id));
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={authStyles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={authStyles.topRow}>
        <TouchableOpacity onPress={onBack} style={authStyles.backBtn} testID="admin-exit">
          <Ionicons name="arrow-back" size={26} color={DARK} />
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
          <Ionicons name="add" size={28} color={ORANGE} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {accounts.length === 0 && (
          <Text style={[authStyles.hint, { marginTop: 40 }]}>
            No accounts yet. Tap + to create one.
          </Text>
        )}
        {accounts.map((a) => (
          <View key={a.id} style={adminStyles.row} testID={`account-${a.id}`}>
            <View style={{ flex: 1 }}>
              <Text style={adminStyles.name}>{a.name}</Text>
              <Text style={adminStyles.codes}>
                {a.digits}  ·  {a.letters}
                {a.locked ? "  ·  LOCKED" : ""}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => toggleLock(a.id)}
              style={adminStyles.iconBtn}
              testID={`lock-${a.id}`}
            >
              <Ionicons
                name={a.locked ? "lock-closed" : "lock-open"}
                size={22}
                color={a.locked ? ORANGE : MUTED}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => remove(a.id)}
              style={adminStyles.iconBtn}
              testID={`delete-${a.id}`}
            >
              <Ionicons name="trash-outline" size={22} color="#c0392b" />
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      {/* Create modal */}
      <Modal visible={createOpen} animationType="slide" onRequestClose={() => setCreateOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View style={authStyles.topRow}>
              <TouchableOpacity onPress={() => setCreateOpen(false)} style={authStyles.backBtn}>
                <Text style={{ fontSize: 16, color: MUTED }}>Cancel</Text>
              </TouchableOpacity>
              <Text style={authStyles.topTitle}>New account</Text>
              <TouchableOpacity onPress={create} style={authStyles.backBtn} testID="create-save">
                <Text style={{ fontSize: 16, color: ORANGE, fontWeight: "700" }}>Save</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 20 }}>
              <Text style={authStyles.label}>Full name</Text>
              <TextInput
                style={authStyles.input}
                value={name}
                onChangeText={setName}
                placeholder="e.g. Quayde A Burnham"
                placeholderTextColor="#aaa"
                testID="create-name"
              />

              <TouchableOpacity
                style={adminStyles.randomBtn}
                onPress={randomize}
                testID="randomize-btn"
              >
                <Ionicons name="shuffle" size={18} color="#fff" />
                <Text style={adminStyles.randomBtnText}>Randomize codes</Text>
              </TouchableOpacity>

              <Text style={authStyles.label}>6-digit code</Text>
              <TextInput
                style={authStyles.input}
                value={digits}
                onChangeText={(v) => setDigits(v.replace(/\D/g, "").slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
                placeholder="000000"
                placeholderTextColor="#aaa"
                testID="create-digits"
              />
              <Text style={authStyles.label}>3-letter code</Text>
              <TextInput
                style={authStyles.input}
                value={letters}
                onChangeText={(v) => setLetters(v.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase())}
                autoCapitalize="characters"
                maxLength={3}
                placeholder="ABC"
                placeholderTextColor="#aaa"
                testID="create-letters"
              />
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
    await onUpdateLicence(draft);
    setRefreshedAt(new Date());
    setEditVisible(false);
  }, [draft, onUpdateLicence]);

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Please allow photo access to change your picture.");
      return;
    }
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
            <Ionicons name="log-out-outline" size={26} color={DARK} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>View details</Text>
          <TouchableOpacity style={styles.iconBtn} onPress={openEdit} testID="open-edit">
            <Ionicons name="create-outline" size={24} color={DARK} />
          </TouchableOpacity>
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
                  { top: -8, left: -8 },
                  { top: 75, right: -8 },
                  { bottom: -8, left: -8 },
                ].map((pos, i) => (
                  <Image
                    key={i}
                    source={{
                      uri: "https://customer-assets.emergentagent.com/job_permit-wallet/artifacts/0jf1o4bk_a96ebfcc-b707-47d6-bc40-05891cd936dc_removalai_preview.png",
                    }}
                    style={[
                      { position: "absolute", width: 110, height: 110, opacity: 0.45 },
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
              return (
                <TouchableOpacity
                  key={t}
                  onPress={() => setActiveTab(t)}
                  style={[styles.tabBtn, active && styles.tabBtnActive]}
                >
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
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
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setEditVisible(false)}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Edit licence</Text>
              <TouchableOpacity onPress={saveEdit} testID="save-edit">
                <Text style={styles.modalSave}>Save</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
              <View style={{ alignItems: "center", marginBottom: 20 }}>
                {draft.photoUri ? (
                  <Image
                    source={{ uri: draft.photoUri }}
                    style={{ width: 140, height: 180, borderRadius: 10, backgroundColor: "#eee" }}
                  />
                ) : (
                  <View style={{ width: 140, height: 180, borderRadius: 10, backgroundColor: "#eee", alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="person" size={60} color="#aaa" />
                  </View>
                )}
                <TouchableOpacity
                  onPress={pickPhoto}
                  style={{ marginTop: 10, backgroundColor: ORANGE, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999 }}
                  testID="pick-photo"
                >
                  <Text style={{ color: "#fff", fontWeight: "700" }}>Change profile picture</Text>
                </TouchableOpacity>
              </View>

              <View style={{ marginBottom: 16, padding: 12, backgroundColor: "#f3f4f6", borderRadius: 10 }}>
                <Text style={styles.editLabel}>Name (locked)</Text>
                <Text style={{ fontSize: 16, color: DARK, fontWeight: "600" }}>{account.name}</Text>
              </View>

              <EditField label="Expiry (e.g. 15 Jan 2026)" value={draft.expiry}
                onChange={(v) => setDraft({ ...draft, expiry: v })} />
              <EditField label="Licence type" value={draft.licenceType}
                onChange={(v) => setDraft({ ...draft, licenceType: v })} />
              <EditField label="Date of birth (e.g. 01 Jan 2008)" value={draft.dob}
                onChange={(v) => setDraft({ ...draft, dob: v })} />
              <EditField label="Address line 1" value={draft.addressLine1}
                onChange={(v) => setDraft({ ...draft, addressLine1: v.toUpperCase() })} />
              <EditField label="Address line 2" value={draft.addressLine2}
                onChange={(v) => setDraft({ ...draft, addressLine2: v.toUpperCase() })} />
              <EditField label="Signature name" value={draft.signatureName}
                onChange={(v) => setDraft({ ...draft, signatureName: v })} />
              <EditField label="Permit status" value={draft.permitStatus}
                onChange={(v) => setDraft({ ...draft, permitStatus: v })} />
              <EditField label="Proficiency" value={draft.proficiency}
                onChange={(v) => setDraft({ ...draft, proficiency: v })} />
              <EditField label="Issue date (e.g. 15 Jan 2027)" value={draft.issueDate}
                onChange={(v) => setDraft({ ...draft, issueDate: v })} />

              <View style={{ marginBottom: 16, padding: 12, backgroundColor: "#f3f4f6", borderRadius: 10 }}>
                <Text style={styles.editLabel}>Permit number (locked)</Text>
                <Text style={{ fontSize: 16, color: DARK, fontWeight: "600" }}>{draft.permitNumber}</Text>
              </View>
              <View style={{ marginBottom: 16, padding: 12, backgroundColor: "#f3f4f6", borderRadius: 10 }}>
                <Text style={styles.editLabel}>Card number (locked)</Text>
                <Text style={{ fontSize: 16, color: DARK, fontWeight: "600" }}>{draft.cardNumber}</Text>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

// ---------- Small components ----------
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
    <View style={{ marginBottom: 16 }}>
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
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eceef2",
  },
  topTitle: { fontSize: 18, fontWeight: "700", color: DARK },
  backBtn: { padding: 8, minWidth: 40, alignItems: "center" },
  adminBtn: {
    position: "absolute",
    left: 16,
    backgroundColor: DARK,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    zIndex: 10,
  },
  adminBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  center: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  logoBig: {
    alignSelf: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: DARK,
    textAlign: "center",
  },
  sub: {
    fontSize: 14,
    color: MUTED,
    textAlign: "center",
    marginTop: 6,
    marginBottom: 28,
  },
  label: { color: MUTED, fontSize: 13, marginBottom: 6, marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: "#e6e8ec",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 18,
    color: DARK,
    backgroundColor: "#fafbfc",
    letterSpacing: 2,
    marginBottom: 8,
  },
  primaryBtn: {
    backgroundColor: ORANGE,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 16,
  },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  hint: { textAlign: "center", color: MUTED, marginTop: 16, fontSize: 13 },
});

const adminStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#f7f8fa",
    marginBottom: 10,
  },
  name: { fontSize: 16, fontWeight: "700", color: DARK },
  codes: { color: MUTED, fontSize: 13, marginTop: 2 },
  iconBtn: { padding: 8, marginLeft: 4 },
  randomBtn: {
    flexDirection: "row",
    alignSelf: "flex-start",
    alignItems: "center",
    gap: 6,
    backgroundColor: DARK,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    marginVertical: 12,
  },
  randomBtnText: { color: "#fff", fontWeight: "700" },
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
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 999,
  },
  tabBtnActive: { backgroundColor: DARK },
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
    backgroundColor: ORANGE,
    borderRadius: 6,
    paddingHorizontal: 9,
    paddingVertical: 3,
    minWidth: 26,
    alignItems: "center",
  },
  pBadgeText: { color: "#fff", fontWeight: "800", fontSize: 14 },

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
  modalTitle: { fontSize: 17, fontWeight: "700", color: DARK },
  modalCancel: { fontSize: 16, color: MUTED },
  modalSave: { fontSize: 16, color: ORANGE, fontWeight: "700" },
  editLabel: { color: MUTED, fontSize: 13, marginBottom: 6 },
  editInput: {
    borderWidth: 1,
    borderColor: "#e6e8ec",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: DARK,
    backgroundColor: "#fafbfc",
  },
});
