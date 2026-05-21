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
  Linking,
  Animated,
  Easing,
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
  bannerLogoUri: string;
};

type Receipt = {
  number: string;
  createdAt: string;
  description: string;
  qty: number;
  unitPrice: number;
  discountPercent: number;
  paymentMethod: string;
};

type Account = {
  id: string;
  name: string;       // e.g. "Quayde A Burnham"
  digits: string;     // 6-digit
  letters: string;    // 3-letter
  locked: boolean;
  licence: Licence;
  receipt?: Receipt | null;
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
  bannerLogoUri: "",
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
  const [supportOpen, setSupportOpen] = useState(false);
  const [supportStep, setSupportStep] = useState<"reason" | "channel">("reason");
  const [supportReason, setSupportReason] = useState("");
  const [supportError, setSupportError] = useState("");
  const [supportSubmitting, setSupportSubmitting] = useState<null | "snapchat" | "email">(null);
  const insets = useSafeAreaInsets();
  const snapScale = React.useRef(new Animated.Value(1)).current;
  const emailScale = React.useRef(new Animated.Value(1)).current;

  const closeSupport = () => {
    setSupportOpen(false);
    setSupportStep("reason");
    setSupportError("");
    setSupportReason("");
    setSupportSubmitting(null);
  };

  const openSupport = () => {
    setSupportStep("reason");
    setSupportError("");
    setSupportReason("");
    setSupportOpen(true);
  };

  const goToChannelStep = () => {
    const reason = supportReason.trim();
    if (reason.length < 3) {
      setSupportError("Please type a short reason first (at least 3 characters).");
      return;
    }
    setSupportError("");
    setSupportStep("channel");
  };

  const submitSupport = async (channel: "snapchat" | "email") => {
    const reason = supportReason.trim();
    if (reason.length < 3) {
      setSupportStep("reason");
      setSupportError("Please type a short reason first (at least 3 characters).");
      return;
    }
    setSupportError("");
    setSupportSubmitting(channel);

    // 1. Log it to the backend so the owner sees every request
    fetch(`${API_BASE}/support`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason, channel }),
    }).catch(() => {});

    // 2. Fire the channel synchronously (keep iOS Safari gesture chain)
    if (channel === "email") {
      const email = "quaydeburnham67@gmail.com";
      const subject = encodeURIComponent("FID — support request");
      const body = encodeURIComponent(reason + "\n\n— Sent from FID app");
      const url = `mailto:${email}?subject=${subject}&body=${body}`;
      if (Platform.OS === "web") {
        window.location.href = url;
      } else {
        Linking.openURL(url).catch(() => {});
      }
    } else {
      // Snapchat: copy reason to clipboard so the user can paste in chat,
      // then open the Add-Friend page.
      const username = "quayde_burnham";
      const webUrl = `https://www.snapchat.com/add/${username}`;
      try {
        if (Platform.OS === "web" && (navigator as any)?.clipboard?.writeText) {
          (navigator as any).clipboard.writeText(reason).catch(() => {});
        }
      } catch {}
      if (Platform.OS === "web") {
        try {
          const w = window.open(webUrl, "_blank");
          if (!w) window.location.href = webUrl;
        } catch {
          window.location.href = webUrl;
        }
      } else {
        Linking.openURL(`snapchat://add/${username}`).catch(() =>
          Linking.openURL(webUrl).catch(() => {})
        );
      }
    }

    // Close after the press animation has played
    setTimeout(() => {
      closeSupport();
    }, 350);
  };

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
    <SafeAreaView style={authStyles.root} edges={[]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <TouchableOpacity
        style={[authStyles.adminBtn, { top: 8 }]}
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
          <View style={[authStyles.hero, { marginTop: 0 }]}>
            <View style={authStyles.heroBadge}>
              <MaterialCommunityIcons name="card-account-details" size={42} color={ORANGE} />
            </View>
            <Text style={authStyles.title}>FID</Text>
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

            <TouchableOpacity
              style={authStyles.supportBtn}
              onPress={openSupport}
              testID="contact-support-btn"
              activeOpacity={0.6}
            >
              <Text style={authStyles.supportBtnText}>Contact support</Text>
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

      {/* Contact support modal */}
      <Modal
        visible={supportOpen}
        transparent
        animationType="fade"
        onRequestClose={closeSupport}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={authStyles.supportBackdrop}
          onPress={closeSupport}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ width: "100%", alignItems: "center" }}
          >
            <TouchableOpacity activeOpacity={1} style={authStyles.supportCard}>
              <View style={authStyles.supportIconBubble}>
                <Ionicons
                  name={supportStep === "reason" ? "help-buoy" : "send"}
                  size={28}
                  color={ORANGE}
                />
              </View>
              <Text style={authStyles.supportTitle}>
                {supportStep === "reason" ? "Contact support" : "Pick a channel"}
              </Text>
              <Text style={authStyles.supportBody}>
                {supportStep === "reason"
                  ? "Tell us what's going on, then tap Next to contact support."
                  : "Choose how you'd like to send your message."}
              </Text>

              {supportStep === "reason" ? (
                <>
                  <Text style={authStyles.supportFieldLabel}>Reason</Text>
                  <TextInput
                    style={authStyles.supportInput}
                    value={supportReason}
                    onChangeText={(v) => {
                      setSupportReason(v);
                      if (supportError) setSupportError("");
                    }}
                    placeholder="e.g. Can't sign in with my code, my licence photo won't save…"
                    placeholderTextColor="#9aa1ad"
                    multiline
                    maxLength={1000}
                    textAlignVertical="top"
                    testID="support-reason"
                    autoFocus
                  />
                  <Text style={authStyles.supportCounter}>{supportReason.length}/1000</Text>

                  {supportError ? (
                    <View style={authStyles.supportErrorBox} testID="support-error-box">
                      <Ionicons name="alert-circle" size={16} color="#B42318" />
                      <Text style={authStyles.supportErrorText}>{supportError}</Text>
                    </View>
                  ) : null}

                  <TouchableOpacity
                    style={authStyles.supportNextBtn}
                    onPress={goToChannelStep}
                    testID="support-next"
                    activeOpacity={0.85}
                  >
                    <Text style={authStyles.supportNextBtnText}>Next</Text>
                    <Ionicons name="arrow-forward" size={18} color="#fff" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={authStyles.supportClose}
                    onPress={closeSupport}
                    testID="support-close"
                  >
                    <Text style={authStyles.supportCloseText}>Cancel</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View style={authStyles.supportReasonPreview}>
                    <Text style={authStyles.supportReasonPreviewLabel}>Your message</Text>
                    <Text style={authStyles.supportReasonPreviewText} numberOfLines={4}>
                      {supportReason.trim()}
                    </Text>
                  </View>

                  <Animated.View style={{ transform: [{ scale: snapScale }] }}>
                    <TouchableOpacity
                      style={[
                        authStyles.snapBtn,
                        supportSubmitting && supportSubmitting !== "snapchat" && { opacity: 0.5 },
                      ]}
                      disabled={!!supportSubmitting}
                      onPressIn={() => {
                        Animated.timing(snapScale, {
                          toValue: 0.92,
                          duration: 90,
                          easing: Easing.out(Easing.quad),
                          useNativeDriver: true,
                        }).start();
                      }}
                      onPressOut={() => {
                        Animated.spring(snapScale, {
                          toValue: 1,
                          friction: 4,
                          tension: 160,
                          useNativeDriver: true,
                        }).start();
                      }}
                      onPress={() => submitSupport("snapchat")}
                      testID="support-snapchat"
                      activeOpacity={0.9}
                    >
                      <View style={authStyles.snapLogo}>
                        <Ionicons name="logo-snapchat" size={22} color="#FFFC00" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={authStyles.snapBtnLabel}>Send via Snapchat</Text>
                        <Text style={authStyles.snapBtnHandle}>quayde_burnham · reason copied to clipboard</Text>
                      </View>
                      {supportSubmitting === "snapchat" ? (
                        <ActivityIndicator size="small" color={DARK} />
                      ) : (
                        <Ionicons name="chevron-forward" size={20} color="#cbd0d8" />
                      )}
                    </TouchableOpacity>
                  </Animated.View>

                  <Animated.View style={{ transform: [{ scale: emailScale }] }}>
                    <TouchableOpacity
                      style={[
                        authStyles.emailBtn,
                        supportSubmitting && supportSubmitting !== "email" && { opacity: 0.5 },
                      ]}
                      disabled={!!supportSubmitting}
                      onPressIn={() => {
                        Animated.timing(emailScale, {
                          toValue: 0.92,
                          duration: 90,
                          easing: Easing.out(Easing.quad),
                          useNativeDriver: true,
                        }).start();
                      }}
                      onPressOut={() => {
                        Animated.spring(emailScale, {
                          toValue: 1,
                          friction: 4,
                          tension: 160,
                          useNativeDriver: true,
                        }).start();
                      }}
                      onPress={() => submitSupport("email")}
                      testID="support-email"
                      activeOpacity={0.9}
                    >
                      <View style={authStyles.emailLogo}>
                        <Ionicons name="mail" size={22} color="#fff" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={authStyles.emailBtnLabel}>Send via Email</Text>
                        <Text style={authStyles.emailBtnHandle}>quaydeburnham67@gmail.com</Text>
                      </View>
                      {supportSubmitting === "email" ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Ionicons name="chevron-forward" size={20} color="#cbd0d8" />
                      )}
                    </TouchableOpacity>
                  </Animated.View>

                  <TouchableOpacity
                    style={authStyles.supportClose}
                    onPress={() => {
                      setSupportStep("reason");
                      setSupportError("");
                    }}
                    testID="support-back"
                    disabled={!!supportSubmitting}
                  >
                    <Text style={authStyles.supportCloseText}>← Back</Text>
                  </TouchableOpacity>
                </>
              )}
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>
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
    <SafeAreaView style={authStyles.root} edges={[]}>
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

  // ----- Create flow state -----
  const [createError, setCreateError] = useState("");
  const [products, setProducts] = useState<{ id: string; name: string; price: number }[]>([]);

  // Pricing-manager modal (admin can change product prices here)
  const [pricesOpen, setPricesOpen] = useState(false);
  const [draftPrices, setDraftPrices] = useState<Record<string, string>>({});
  const [savingPrices, setSavingPrices] = useState(false);
  const [pricesError, setPricesError] = useState("");

  // Receipt viewer (post-creation + for existing accounts)
  const [receiptAccount, setReceiptAccount] = useState<Account | null>(null);

  // Admin edit-account modal
  const [editAccount, setEditAccount] = useState<Account | null>(null);

  const loadProducts = React.useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/products`);
      if (r.ok) {
        const data = await r.json();
        setProducts(data);
      }
    } catch {}
  }, []);

  React.useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const resetCreateForm = () => {
    setName("");
    setDigits("");
    setLetters("");
    setCreateError("");
  };
  const [supportRequests, setSupportRequests] = useState<
    { id: string; reason: string; channel: string; createdAt: string; seen: boolean }[]
  >([]);
  const [deletingSupportId, setDeletingSupportId] = useState<string | null>(null);

  const loadSupport = React.useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/support`);
      if (r.ok) setSupportRequests(await r.json());
    } catch {}
  }, []);

  React.useEffect(() => {
    loadSupport();
    const t = setInterval(loadSupport, 6000);
    return () => clearInterval(t);
  }, [loadSupport]);

  const markSupportSeen = async (id: string) => {
    try {
      await fetch(`${API_BASE}/support/${id}/seen`, { method: "PUT" });
      setSupportRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, seen: true } : r))
      );
    } catch {}
  };
  const deleteSupport = async (id: string) => {
    if (deletingSupportId) return;
    setDeletingSupportId(id);
    try {
      await fetch(`${API_BASE}/support/${id}`, { method: "DELETE" });
      setSupportRequests((prev) => prev.filter((r) => r.id !== id));
    } catch {}
    setDeletingSupportId(null);
  };

  const formatTs = (iso: string) => {
    try {
      const d = new Date(iso);
      const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      let h = d.getHours();
      const ampm = h >= 12 ? "pm" : "am";
      h = h % 12 || 12;
      return `${String(d.getDate()).padStart(2,"0")} ${months[d.getMonth()]} ${d.getFullYear()} · ${String(h).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")} ${ampm}`;
    } catch {
      return iso;
    }
  };
  const unseenCount = supportRequests.filter((r) => !r.seen).length;

  const randomize = () => {
    setDigits(randomDigits(6));
    setLetters(randomLetters(3));
  };

  const create = async () => {
    if (creating) return;
    setCreateError("");
    if (!name.trim()) {
      setCreateError("Enter a name for the account.");
      return;
    }
    if (digits.length !== 6 || letters.length !== 3) {
      setCreateError("Need a 6-digit code and 3-letter code.");
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
            bannerLogoUri: "",
          },
        }),
      });
      if (res.status === 409) {
        setCreateError("Those codes are already in use.");
        return;
      }
      if (!res.ok) {
        setCreateError("Could not create account. Please try again.");
        return;
      }
      await onRefresh();
      setCreateOpen(false);
      resetCreateForm();
    } catch (e) {
      setCreateError("Could not reach the server. Check your connection.");
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
    <SafeAreaView style={authStyles.root} edges={[]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={authStyles.topRow}>
        <TouchableOpacity onPress={onBack} style={authStyles.backBtn} testID="admin-exit">
          <Ionicons name="arrow-back" size={24} color={DARK} />
        </TouchableOpacity>
        <Text style={authStyles.topTitle}>Admin console</Text>
        <TouchableOpacity
          onPress={() => {
            resetCreateForm();
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
        {(() => {
          const visibleAccounts = accounts.filter(
            (a) => a.name.trim().toLowerCase() !== "test a user"
          );
          return <>
        <View style={adminStyles.sectionHead}>
          <Text style={adminStyles.sectionTitle}>Accounts</Text>
          <View style={adminStyles.countChip}>
            <Text style={adminStyles.countChipText}>{visibleAccounts.length}</Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              setDraftPrices(
                products.reduce((acc, p) => {
                  acc[p.id] = String(p.price);
                  return acc;
                }, {} as Record<string, string>)
              );
              setPricesError("");
              setPricesOpen(true);
            }}
            style={adminStyles.managePricesBtn}
            testID="manage-prices-btn"
            activeOpacity={0.85}
          >
            <Ionicons name="pricetags" size={14} color={ORANGE} />
            <Text style={adminStyles.managePricesText}>Manage prices</Text>
          </TouchableOpacity>
        </View>

        {visibleAccounts.length === 0 && (
          <View style={adminStyles.emptyWrap}>
            <View style={adminStyles.emptyIconBubble}>
              <Ionicons name="people-outline" size={36} color={MUTED} />
            </View>
            <Text style={adminStyles.emptyTitle}>No accounts yet</Text>
            <Text style={adminStyles.emptySub}>Tap the + button above to create your first licence holder.</Text>
          </View>
        )}

        {visibleAccounts.map((a) => (
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
              onPress={() => setEditAccount(a)}
              style={adminStyles.iconBtn}
              testID={`edit-${a.id}`}
            >
              <Ionicons name="create-outline" size={20} color={ORANGE} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setReceiptAccount(a)}
              style={adminStyles.iconBtn}
              testID={`receipt-${a.id}`}
            >
              <Ionicons name="receipt-outline" size={20} color={ORANGE} />
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

        {/* ---------- Support requests ---------- */}
        <View style={[adminStyles.sectionHead, { marginTop: 18 }]}>
          <Text style={adminStyles.sectionTitle}>Support requests</Text>
          <View style={adminStyles.countChip}>
            <Text style={adminStyles.countChipText}>
              {unseenCount > 0 ? `${unseenCount} new` : supportRequests.length}
            </Text>
          </View>
        </View>

        {supportRequests.length === 0 && (
          <View style={adminStyles.emptyWrap}>
            <View style={adminStyles.emptyIconBubble}>
              <Ionicons name="chatbubble-ellipses-outline" size={32} color={MUTED} />
            </View>
            <Text style={adminStyles.emptyTitle}>No support requests</Text>
            <Text style={adminStyles.emptySub}>
              When someone contacts support from the login screen, their message will appear here.
            </Text>
          </View>
        )}

        {supportRequests.map((r) => {
          const isSnap = r.channel === "snapchat";
          return (
            <View key={r.id} style={adminStyles.supportRow} testID={`support-row-${r.id}`}>
              <View
                style={[
                  adminStyles.supportChannelBubble,
                  isSnap
                    ? { backgroundColor: "#FFFC00" }
                    : { backgroundColor: ORANGE },
                ]}
              >
                <Ionicons
                  name={isSnap ? "logo-snapchat" : "mail"}
                  size={18}
                  color={isSnap ? DARK : "#fff"}
                />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={adminStyles.supportRowHead}>
                  <Text style={adminStyles.supportChannelLabel}>
                    {isSnap ? "Snapchat" : "Email"}
                  </Text>
                  {!r.seen && <View style={adminStyles.supportDot} />}
                  <Text style={adminStyles.supportTime}>{formatTs(r.createdAt)}</Text>
                </View>
                <Text style={adminStyles.supportReason}>{r.reason}</Text>
                <View style={adminStyles.supportActionRow}>
                  {!r.seen && (
                    <TouchableOpacity
                      onPress={() => markSupportSeen(r.id)}
                      testID={`support-seen-${r.id}`}
                    >
                      <Text style={adminStyles.supportActionPrimary}>Mark as read</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={() => deleteSupport(r.id)}
                    disabled={deletingSupportId === r.id}
                    testID={`support-delete-${r.id}`}
                  >
                    {deletingSupportId === r.id ? (
                      <ActivityIndicator size="small" color="#c0392b" />
                    ) : (
                      <Text style={adminStyles.supportActionDanger}>Delete</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })}
          </>;
        })()}
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

      {/* Create modal — single step (details) */}
      <Modal
        visible={createOpen}
        animationType="slide"
        onRequestClose={() => {
          setCreateOpen(false);
          resetCreateForm();
        }}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View style={authStyles.topRow}>
              <TouchableOpacity
                onPress={() => {
                  setCreateOpen(false);
                  resetCreateForm();
                }}
                style={authStyles.backBtn}
                testID="create-back"
              >
                <Text style={{ fontSize: 15, color: MUTED, fontWeight: "600" }}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <Text style={authStyles.topTitle}>New account</Text>
              <TouchableOpacity
                onPress={create}
                style={authStyles.backBtn}
                disabled={creating}
                testID="create-save"
              >
                {creating ? (
                  <ActivityIndicator size="small" color={ORANGE} />
                ) : (
                  <Text style={{ fontSize: 15, color: ORANGE, fontWeight: "800" }}>Create</Text>
                )}
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 50 }} keyboardShouldPersistTaps="handled">
              <View style={[authStyles.hero, { paddingTop: 4, paddingBottom: 18 }]}>
                <View style={authStyles.heroBadge}>
                  <Ionicons name="person-add" size={32} color={ORANGE} />
                </View>
                <Text style={[authStyles.title, { fontSize: 22 }]}>Create account</Text>
                <Text style={authStyles.sub}>
                  Give a name and login codes for this licence holder
                </Text>
              </View>

              <View style={authStyles.formCard}>
                <View style={authStyles.fieldGroup}>
                  <Text style={authStyles.label}>Full name</Text>
                  <View style={authStyles.inputWrap}>
                    <Ionicons name="person-outline" size={18} color={MUTED} style={authStyles.inputIcon} />
                    <TextInput
                      style={[authStyles.input, { letterSpacing: 0, fontWeight: "600" }]}
                      value={name}
                      onChangeText={(v) => {
                        setName(v);
                        if (createError) setCreateError("");
                      }}
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
                      onChangeText={(v) => {
                        setDigits(v.replace(/\D/g, "").slice(0, 6));
                        if (createError) setCreateError("");
                      }}
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
                      onChangeText={(v) => {
                        setLetters(v.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase());
                        if (createError) setCreateError("");
                      }}
                      autoCapitalize="characters"
                      maxLength={3}
                      placeholder="ABC"
                      placeholderTextColor="#bdc1c8"
                      testID="create-letters"
                    />
                  </View>
                </View>

                {createError ? (
                  <View style={authStyles.errorBox}>
                    <Ionicons name="alert-circle" size={18} color="#B42318" />
                    <Text style={authStyles.errorText}>{createError}</Text>
                  </View>
                ) : null}

                <TouchableOpacity
                  style={[authStyles.primaryBtn, { marginTop: 18 }, creating && { opacity: 0.9 }]}
                  onPress={create}
                  disabled={creating}
                  testID="create-submit"
                  activeOpacity={0.85}
                >
                  {creating ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={authStyles.primaryBtnText}>Create account</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Receipt viewer */}
      <ReceiptModal
        account={receiptAccount}
        onClose={() => setReceiptAccount(null)}
      />

      {/* Admin edit account modal */}
      <AdminEditModal
        account={editAccount}
        accounts={accounts}
        onClose={() => setEditAccount(null)}
        onSaved={async () => {
          await onRefresh();
          setEditAccount(null);
        }}
      />

      {/* Pricing manager modal */}
      <Modal
        visible={pricesOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPricesOpen(false)}
      >
        <View style={adminStyles.keypadBackdrop}>
          <View style={[adminStyles.keypadCard, { paddingBottom: 22 }]}>
            <Text style={[adminStyles.keypadHint, { marginBottom: 4 }]}>Manage prices</Text>
            <Text style={{ color: DARK, fontSize: 22, fontWeight: "900", marginBottom: 14 }}>
              Product pricing
            </Text>

            {products.map((p) => (
              <View key={p.id} style={{ marginBottom: 12 }}>
                <Text style={[authStyles.label, { marginBottom: 6 }]}>{p.name}</Text>
                <View style={authStyles.inputWrap}>
                  <Text style={{ marginLeft: 4, marginRight: 6, color: MUTED, fontWeight: "800", fontSize: 16 }}>$</Text>
                  <TextInput
                    style={[authStyles.input, { letterSpacing: 0, fontWeight: "700" }]}
                    value={draftPrices[p.id] ?? String(p.price)}
                    onChangeText={(v) => {
                      const cleaned = v.replace(/[^0-9.]/g, "").slice(0, 10);
                      setDraftPrices((prev) => ({ ...prev, [p.id]: cleaned }));
                      if (pricesError) setPricesError("");
                    }}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor="#bdc1c8"
                    testID={`price-input-${p.id}`}
                  />
                </View>
              </View>
            ))}

            {pricesError ? (
              <View style={[authStyles.errorBox, { marginTop: 4 }]}>
                <Ionicons name="alert-circle" size={16} color="#B42318" />
                <Text style={authStyles.errorText}>{pricesError}</Text>
              </View>
            ) : null}

            <View style={{ flexDirection: "row", gap: 10, marginTop: 6 }}>
              <TouchableOpacity
                style={[adminStyles.keypadAction, { backgroundColor: "#F2F4F7" }]}
                onPress={() => {
                  setPricesOpen(false);
                  setDraftPrices({});
                  setPricesError("");
                }}
                disabled={savingPrices}
                testID="prices-cancel"
              >
                <Text style={[adminStyles.keypadActionText, { color: DARK }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[adminStyles.keypadAction, { backgroundColor: ORANGE }, savingPrices && { opacity: 0.85 }]}
                disabled={savingPrices}
                onPress={async () => {
                  // Validate
                  const merged = products.map((p) => {
                    const raw = draftPrices[p.id];
                    const n = raw === undefined ? p.price : parseFloat(raw || "0");
                    return { id: p.id, name: p.name, price: isNaN(n) ? p.price : n };
                  });
                  if (merged.some((m) => m.price < 0)) {
                    setPricesError("Prices can't be negative.");
                    return;
                  }
                  setSavingPrices(true);
                  try {
                    const res = await fetch(`${API_BASE}/products`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ products: merged }),
                    });
                    if (res.ok) {
                      const data = await res.json();
                      setProducts(data);
                      setDraftPrices({});
                      setPricesOpen(false);
                    } else {
                      setPricesError("Couldn't save prices. Please try again.");
                    }
                  } catch {
                    setPricesError("Couldn't reach the server.");
                  } finally {
                    setSavingPrices(false);
                  }
                }}
                testID="prices-save"
              >
                {savingPrices ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={[adminStyles.keypadActionText, { color: "#fff" }]}>Save prices</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ---------- Receipt Modal ----------
function ReceiptModal({
  account,
  onClose,
}: {
  account: Account | null;
  onClose: () => void;
}) {
  if (!account) return null;
  const r = account.receipt;
  const fmt = (n: number) => {
    const sign = n < 0 ? "-" : "";
    const v = Math.abs(n);
    return `${sign}$${v.toFixed(2)}`;
  };
  const subtotal = r ? r.unitPrice * Math.max(1, r.qty) : 0;
  const discount = r ? subtotal * (r.discountPercent || 0) / 100 : 0;
  const total = Math.max(0, subtotal - discount);
  const date = (() => {
    try {
      const d = new Date(r?.createdAt || Date.now());
      const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      let h = d.getHours();
      const ampm = h >= 12 ? "pm" : "am";
      h = h % 12 || 12;
      return `${String(d.getDate()).padStart(2,"0")} ${months[d.getMonth()]} ${d.getFullYear()} · ${String(h).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")} ${ampm}`;
    } catch {
      return "—";
    }
  })();

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={receiptStyles.backdrop}>
        <View style={receiptStyles.sheet}>
          <View style={receiptStyles.handle} />
          <ScrollView
            contentContainerStyle={{ padding: 22, paddingTop: 4, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
          >
            <View style={receiptStyles.logoRow}>
              <View style={receiptStyles.logoMark}>
                <MaterialCommunityIcons name="card-account-details" size={28} color="#fff" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={receiptStyles.bizName}>FID</Text>
                <Text style={receiptStyles.bizSub}>Probationary licence wallet · Victoria</Text>
              </View>
            </View>

            <Text style={receiptStyles.meta}>Receipt #: {r?.number || "—"}</Text>
            <Text style={receiptStyles.meta}>Date: {date}</Text>
            <Text style={receiptStyles.meta}>Customer: {account.name}</Text>

            <View style={receiptStyles.hr} />

            <View style={receiptStyles.headerRow}>
              <Text style={[receiptStyles.col, receiptStyles.colDesc]}>Description</Text>
              <Text style={[receiptStyles.col, receiptStyles.colQty]}>Qty</Text>
              <Text style={[receiptStyles.col, receiptStyles.colPrice]}>U/Price</Text>
              <Text style={[receiptStyles.col, receiptStyles.colTotal]}>Total</Text>
            </View>

            {r ? (
              <View style={receiptStyles.row}>
                <Text style={[receiptStyles.col, receiptStyles.colDesc]} numberOfLines={2}>
                  {r.description || "—"}
                </Text>
                <Text style={[receiptStyles.col, receiptStyles.colQty]}>{r.qty}</Text>
                <Text style={[receiptStyles.col, receiptStyles.colPrice]}>{fmt(r.unitPrice)}</Text>
                <Text style={[receiptStyles.col, receiptStyles.colTotal]}>{fmt(r.unitPrice * r.qty)}</Text>
              </View>
            ) : (
              <Text style={[receiptStyles.meta, { textAlign: "center", marginTop: 20 }]}>
                No receipt was recorded for this account.
              </Text>
            )}

            {r && (
              <>
                <View style={receiptStyles.hr} />
                <View style={receiptStyles.totalsRow}>
                  <Text style={receiptStyles.totalsLabel}>Sub Total:</Text>
                  <Text style={receiptStyles.totalsVal}>{fmt(subtotal)}</Text>
                </View>
                {r.discountPercent > 0 && (
                  <View style={receiptStyles.totalsRow}>
                    <Text style={receiptStyles.totalsLabel}>
                      Discount ({r.discountPercent}%):
                    </Text>
                    <Text style={[receiptStyles.totalsVal, { color: "#1f9d55" }]}>
                      -{fmt(discount)}
                    </Text>
                  </View>
                )}
                <View style={receiptStyles.totalsRow}>
                  <Text style={[receiptStyles.totalsLabel, { fontWeight: "900" }]}>Total:</Text>
                  <Text style={[receiptStyles.totalsVal, { fontWeight: "900", fontSize: 18 }]}>
                    {fmt(total)}
                  </Text>
                </View>
                <View style={[receiptStyles.totalsRow, { marginTop: 6 }]}>
                  <Text style={receiptStyles.totalsLabel}>Paid via:</Text>
                  <Text style={receiptStyles.totalsVal}>{r.paymentMethod}</Text>
                </View>

                <View style={receiptStyles.hr} />
                <Text style={receiptStyles.thanks}>Thank you for shopping with us!</Text>
              </>
            )}

            <TouchableOpacity
              style={receiptStyles.doneBtn}
              onPress={onClose}
              testID="receipt-done"
              activeOpacity={0.85}
            >
              <Text style={receiptStyles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
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
  const [pickingBannerLogo, setPickingBannerLogo] = useState(false);

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

  // Master read-only switch — the "Test A User" demo account is fully locked:
  // nothing on the licence (including the photo) can be edited from any device.
  const isReadOnly = account.name.trim().toLowerCase() === "test a user";

  const openEdit = () => {
    if (isReadOnly) return;
    setDraft(data);
    setEditVisible(true);
  };
  const saveEdit = useCallback(async () => {
    if (isReadOnly) {
      setEditVisible(false);
      return;
    }
    if (saving) return;
    setSaving(true);
    try {
      await onUpdateLicence(draft);
      setRefreshedAt(new Date());
      setEditVisible(false);
    } finally {
      setSaving(false);
    }
  }, [draft, onUpdateLicence, saving, isReadOnly]);

  const pickPhoto = async () => {
    if (isReadOnly) return;
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

  const pickBannerLogo = async () => {
    if (isReadOnly) return;
    if (pickingBannerLogo) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Please allow photo access to change the banner logo.");
      return;
    }
    setPickingBannerLogo(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        base64: true,
      });
      if (!result.canceled && result.assets?.[0]) {
        const a = result.assets[0];
        const uri = a.base64 ? `data:image/jpeg;base64,${a.base64}` : a.uri;
        setDraft({ ...draft, bannerLogoUri: uri });
      }
    } finally {
      setPickingBannerLogo(false);
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
      <SafeAreaView style={styles.safe} edges={[]}>
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
                uri:
                  data.bannerLogoUri ||
                  "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==",
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
              <TouchableOpacity
                style={[styles.qrButton, isReadOnly && { backgroundColor: "#6b7280" }]}
                onPress={() => { /* disabled — details can only be edited from the admin console */ }}
                disabled
                testID="reveal-qr"
              >
                {isReadOnly ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Ionicons name="lock-closed" size={14} color="#fff" />
                    <Text style={styles.qrButtonText}>Read-only account</Text>
                  </View>
                ) : (
                  <Text style={styles.qrButtonText}>Reveal QR code</Text>
                )}
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

              {/* Banner logo card */}
              <View style={styles.editPhotoCard}>
                <View style={[styles.editPhotoFrame, { backgroundColor: ORANGE, padding: 10 }]}>
                  {draft.bannerLogoUri ? (
                    <Image
                      source={{ uri: draft.bannerLogoUri }}
                      style={styles.editLogoImg}
                      resizeMode="contain"
                    />
                  ) : (
                    <View style={[styles.editLogoImg, { alignItems: "center", justifyContent: "center" }]}>
                      <Ionicons name="image-outline" size={26} color="#ffffff99" />
                    </View>
                  )}
                </View>
                <Text style={styles.editPhotoTitle}>Banner logo</Text>
                <Text style={styles.editPhotoSub}>Shown on the red banner. Tap to upload.</Text>
                <TouchableOpacity
                  onPress={pickBannerLogo}
                  disabled={pickingBannerLogo}
                  style={[styles.editPhotoBtn, pickingBannerLogo && { opacity: 0.85 }]}
                  testID="pick-banner-logo"
                  activeOpacity={0.85}
                >
                  {pickingBannerLogo ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="image" size={16} color="#fff" />
                      <Text style={styles.editPhotoBtnText}>
                        {draft.bannerLogoUri ? "Change logo" : "Upload logo"}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
                {draft.bannerLogoUri ? (
                  <TouchableOpacity
                    onPress={() => setDraft({ ...draft, bannerLogoUri: "" })}
                    style={styles.editLogoRemoveBtn}
                    testID="remove-banner-logo"
                    activeOpacity={0.7}
                  >
                    <Text style={styles.editLogoRemoveText}>Remove logo</Text>
                  </TouchableOpacity>
                ) : null}
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

// ---------- Admin: edit account modal ----------
function AdminEditModal({
  account,
  accounts,
  onClose,
  onSaved,
}: {
  account: Account | null;
  accounts: Account[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [name, setName] = useState("");
  const [digits, setDigits] = useState("");
  const [letters, setLetters] = useState("");
  const [draft, setDraft] = useState<Licence>(DEFAULT_LICENCE);
  const [datePickerField, setDatePickerField] = useState<null | "dob" | "expiry" | "issueDate">(null);
  const [dateBackup, setDateBackup] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [pickingPhoto, setPickingPhoto] = useState(false);
  const [pickingBannerLogo, setPickingBannerLogo] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (account) {
      setName(account.name);
      setDigits(account.digits);
      setLetters(account.letters);
      setDraft(account.licence);
      setError("");
    }
  }, [account?.id]);

  if (!account) return null;

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

  const pickImage = async (
    field: "photoUri" | "bannerLogoUri",
    setBusy: (v: boolean) => void,
    aspect?: [number, number],
  ) => {
    setBusy(true);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission needed", "Please allow photo access to change this image.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect,
        quality: 0.7,
        base64: true,
      });
      if (!result.canceled && result.assets?.[0]) {
        const a = result.assets[0];
        const uri = a.base64 ? `data:image/jpeg;base64,${a.base64}` : a.uri;
        setDraft((prev) => ({ ...prev, [field]: uri }));
      }
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (saving) return;
    setError("");
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Name is required.");
      return;
    }
    if (digits.length !== 6) {
      setError("6-digit code must be 6 digits.");
      return;
    }
    if (letters.length !== 3) {
      setError("3-letter code must be 3 letters.");
      return;
    }
    // Prevent collisions with other accounts' codes
    const codeUpper = letters.toUpperCase();
    const conflict = accounts.find(
      (a) => a.id !== account.id && a.digits === digits && a.letters === codeUpper,
    );
    if (conflict) {
      setError("Those codes are already used by another account.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/accounts/${account.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          digits,
          letters: codeUpper,
          licence: draft,
        }),
      });
      if (!res.ok) {
        setError("Could not save changes. Please try again.");
        return;
      }
      await onSaved();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.editHeader}>
            <TouchableOpacity onPress={onClose} style={styles.editHeaderBtn} testID="admin-edit-cancel">
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Edit account</Text>
            <TouchableOpacity onPress={save} disabled={saving} style={styles.editHeaderBtn} testID="admin-edit-save">
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
            {/* Profile picture */}
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
                onPress={() => pickImage("photoUri", setPickingPhoto, [3, 4])}
                disabled={pickingPhoto}
                style={[styles.editPhotoBtn, pickingPhoto && { opacity: 0.85 }]}
                testID="admin-pick-photo"
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

            {/* Banner logo */}
            <View style={styles.editPhotoCard}>
              <View style={[styles.editPhotoFrame, { backgroundColor: ORANGE, padding: 10 }]}>
                {draft.bannerLogoUri ? (
                  <Image source={{ uri: draft.bannerLogoUri }} style={styles.editLogoImg} resizeMode="contain" />
                ) : (
                  <View style={[styles.editLogoImg, { alignItems: "center", justifyContent: "center" }]}>
                    <Ionicons name="image-outline" size={26} color="#ffffff99" />
                  </View>
                )}
              </View>
              <Text style={styles.editPhotoTitle}>Banner logo</Text>
              <Text style={styles.editPhotoSub}>Shown on the red banner. Tap to upload.</Text>
              <TouchableOpacity
                onPress={() => pickImage("bannerLogoUri", setPickingBannerLogo)}
                disabled={pickingBannerLogo}
                style={[styles.editPhotoBtn, pickingBannerLogo && { opacity: 0.85 }]}
                testID="admin-pick-banner-logo"
                activeOpacity={0.85}
              >
                {pickingBannerLogo ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="image" size={16} color="#fff" />
                    <Text style={styles.editPhotoBtnText}>
                      {draft.bannerLogoUri ? "Change logo" : "Upload logo"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
              {draft.bannerLogoUri ? (
                <TouchableOpacity
                  onPress={() => setDraft({ ...draft, bannerLogoUri: "" })}
                  style={styles.editLogoRemoveBtn}
                  testID="admin-remove-banner-logo"
                  activeOpacity={0.7}
                >
                  <Text style={styles.editLogoRemoveText}>Remove logo</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Account & PINs */}
            <Text style={styles.editSection}>Account & sign-in</Text>
            <View style={styles.editGroup}>
              <EditField label="Full name" value={name} onChange={setName} />
              <View style={styles.editDivider} />
              <EditField
                label="6-digit code"
                value={digits}
                onChange={(v) => setDigits(v.replace(/\D/g, "").slice(0, 6))}
              />
              <View style={styles.editDivider} />
              <EditField
                label="3-letter code"
                value={letters}
                onChange={(v) => setLetters(v.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase())}
              />
            </View>

            {/* Identity */}
            <Text style={styles.editSection}>Identity</Text>
            <View style={styles.editGroup}>
              <DateField label="Date of birth" value={draft.dob} onPress={() => openDatePicker("dob")} />
              <View style={styles.editDivider} />
              <EditField
                label="Signature name"
                value={draft.signatureName}
                onChange={(v) => setDraft({ ...draft, signatureName: v })}
              />
            </View>

            {/* Address */}
            <Text style={styles.editSection}>Address</Text>
            <View style={styles.editGroup}>
              <EditField
                label="Address line 1"
                value={draft.addressLine1}
                onChange={(v) => setDraft({ ...draft, addressLine1: v.toUpperCase() })}
              />
              <View style={styles.editDivider} />
              <EditField
                label="Address line 2"
                value={draft.addressLine2}
                onChange={(v) => setDraft({ ...draft, addressLine2: v.toUpperCase() })}
              />
            </View>

            {/* Licence */}
            <Text style={styles.editSection}>Licence</Text>
            <View style={styles.editGroup}>
              <EditField
                label="Licence type"
                value={draft.licenceType}
                onChange={(v) => setDraft({ ...draft, licenceType: v })}
              />
              <View style={styles.editDivider} />
              <EditField
                label="Permit status"
                value={draft.permitStatus}
                onChange={(v) => setDraft({ ...draft, permitStatus: v })}
              />
              <View style={styles.editDivider} />
              <EditField
                label="Proficiency"
                value={draft.proficiency}
                onChange={(v) => setDraft({ ...draft, proficiency: v })}
              />
              <View style={styles.editDivider} />
              <DateField label="Issue date" value={draft.issueDate} onPress={() => openDatePicker("issueDate")} />
              <View style={styles.editDivider} />
              <DateField label="Expiry" value={draft.expiry} onPress={() => openDatePicker("expiry")} />
            </View>

            {/* System */}
            <Text style={styles.editSection}>System</Text>
            <View style={styles.editGroup}>
              <EditField
                label="Permit number"
                value={draft.permitNumber}
                onChange={(v) => setDraft({ ...draft, permitNumber: v })}
              />
              <View style={styles.editDivider} />
              <EditField
                label="Card number"
                value={draft.cardNumber}
                onChange={(v) => setDraft({ ...draft, cardNumber: v })}
              />
            </View>

            {error ? (
              <View style={[authStyles.errorBox, { marginTop: 14 }]}>
                <Ionicons name="alert-circle" size={18} color="#B42318" />
                <Text style={authStyles.errorText}>{error}</Text>
              </View>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

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
                onChange={(d) => setDraft({ ...draft, [datePickerField]: formatDate(d) })}
              />
            )}
            <View style={styles.dateBtnRow}>
              <TouchableOpacity
                style={styles.dateCancelBtn}
                onPress={cancelDatePicker}
                testID="admin-edit-date-cancel"
              >
                <Text style={styles.dateCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.dateDoneBtn}
                onPress={() => setDatePickerField(null)}
                testID="admin-edit-date-done"
              >
                <Text style={styles.dateDoneText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
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
    marginTop: 24,
  },
  topTitle: { fontSize: 17, fontWeight: "700", color: DARK },
  backBtn: { padding: 10, minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },

  // Hero section at top of auth screens
  hero: {
    paddingTop: 0,
    paddingBottom: 14,
    paddingHorizontal: 28,
    alignItems: "center",
  },
  heroBadge: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: "#FFF1EC",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
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

  // Contact-support text link (sits under Sign in button)
  supportBtn: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
    paddingVertical: 8,
    backgroundColor: "transparent",
  },
  supportBtnText: { color: "#000", fontWeight: "800", fontSize: 15, letterSpacing: 0.2 },

  // Support modal
  supportBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,34,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  supportCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 22,
    alignItems: "stretch",
  },
  supportIconBubble: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "#FFF1EC",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 12,
  },
  supportTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: DARK,
    textAlign: "center",
    marginBottom: 4,
  },
  supportBody: {
    fontSize: 13,
    color: MUTED,
    textAlign: "center",
    marginBottom: 18,
    lineHeight: 18,
  },
  supportFieldLabel: {
    color: DARK,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  supportInput: {
    minHeight: 90,
    maxHeight: 160,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    backgroundColor: "#FAFBFC",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: DARK,
    fontWeight: "500",
    lineHeight: 19,
  },
  supportCounter: {
    fontSize: 11,
    color: MUTED,
    textAlign: "right",
    marginTop: 4,
    marginBottom: 14,
  },
  supportErrorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FDECEC",
    borderColor: "#F5C2C7",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 12,
  },
  supportErrorText: { color: "#B42318", fontSize: 13, fontWeight: "700", flex: 1 },
  supportNextBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: ORANGE,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 4,
    shadowColor: ORANGE,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  supportNextBtnText: { color: "#fff", fontSize: 15, fontWeight: "800", letterSpacing: 0.3 },
  supportReasonPreview: {
    backgroundColor: "#F7F8FA",
    borderWidth: 1,
    borderColor: "#EEF0F3",
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  supportReasonPreviewLabel: {
    color: MUTED,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  supportReasonPreviewText: {
    color: DARK,
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
  },
  snapBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: "#FFFC00",
    marginBottom: 10,
  },
  snapLogo: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#0F1722",
    alignItems: "center",
    justifyContent: "center",
  },
  snapBtnLabel: { color: DARK, fontWeight: "800", fontSize: 15 },
  snapBtnHandle: { color: "#4a4406", fontWeight: "600", fontSize: 12, marginTop: 2 },
  emailBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: "#F7F8FA",
    borderWidth: 1,
    borderColor: "#EEF0F3",
  },
  emailLogo: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: ORANGE,
    alignItems: "center",
    justifyContent: "center",
  },
  emailBtnLabel: { color: DARK, fontWeight: "800", fontSize: 15 },
  emailBtnHandle: { color: MUTED, fontWeight: "600", fontSize: 12, marginTop: 2 },
  supportClose: {
    marginTop: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  supportCloseText: { color: MUTED, fontWeight: "700", fontSize: 14 },
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

  // Support requests rows in admin
  supportRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: "#fff",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#EEF0F3",
    gap: 10,
  },
  supportChannelBubble: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  supportRowHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  supportChannelLabel: { color: DARK, fontWeight: "800", fontSize: 13 },
  supportDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: ORANGE,
    marginLeft: 2,
  },
  supportTime: { color: MUTED, fontSize: 11, marginLeft: "auto" },
  supportReason: {
    color: DARK,
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 19,
    marginTop: 4,
  },
  supportActionRow: {
    flexDirection: "row",
    gap: 16,
    marginTop: 8,
  },
  supportActionPrimary: {
    color: ORANGE,
    fontWeight: "800",
    fontSize: 13,
  },
  supportActionDanger: {
    color: "#c0392b",
    fontWeight: "800",
    fontSize: 13,
  },

  // Product option cards (in payment step)
  productCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    backgroundColor: "#fff",
  },
  productCardActive: {
    backgroundColor: DARK,
    borderColor: DARK,
  },
  productRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#cbd0d8",
    alignItems: "center",
    justifyContent: "center",
  },
  productRadioActive: {
    borderColor: "#fff",
  },
  productRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#fff",
  },
  productName: { color: DARK, fontWeight: "800", fontSize: 14 },
  productPrice: { color: DARK, fontWeight: "900", fontSize: 18, letterSpacing: -0.3 },

  // "Manage prices" pill next to Accounts header
  managePricesBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#FFF1EC",
    borderWidth: 1,
    borderColor: "#FFD9C8",
    marginLeft: 8,
  },
  managePricesText: { color: ORANGE, fontWeight: "800", fontSize: 12 },

  // Quantity stepper
  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F2F4F7",
    borderRadius: 999,
    padding: 4,
    gap: 4,
  },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  qtyVal: {
    minWidth: 32,
    textAlign: "center",
    fontWeight: "800",
    color: DARK,
    fontSize: 15,
  },

  // Price tile
  priceTile: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFF7F3",
    borderWidth: 1.5,
    borderColor: "#FFD9C8",
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
    marginBottom: 4,
  },
  priceTileHint: {
    color: ORANGE,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  priceTileVal: {
    color: DARK,
    fontSize: 30,
    fontWeight: "900",
    marginTop: 2,
    letterSpacing: -0.5,
  },

  // Chips (discount / payment)
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    backgroundColor: "#fff",
  },
  chipActive: {
    backgroundColor: DARK,
    borderColor: DARK,
  },
  chipText: { color: DARK, fontWeight: "700", fontSize: 13 },
  chipTextActive: { color: "#fff" },

  // Totals box (live preview on payment step)
  totalsBox: {
    marginTop: 18,
    backgroundColor: "#F7F8FA",
    borderWidth: 1,
    borderColor: "#EEF0F3",
    borderRadius: 14,
    padding: 14,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  totalsLabel: { color: MUTED, fontWeight: "700", fontSize: 13 },
  totalsVal: { color: DARK, fontWeight: "700", fontSize: 14 },
  totalsLabelBig: { color: DARK, fontWeight: "800", fontSize: 15 },
  totalsValBig: { color: DARK, fontWeight: "900", fontSize: 18 },

  // Keypad
  keypadBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,34,0.55)",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  keypadCard: {
    width: "100%",
    maxWidth: 460,
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 22,
    paddingBottom: 28,
  },
  keypadHint: {
    color: MUTED,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  keypadDisplay: {
    color: DARK,
    fontSize: 44,
    fontWeight: "900",
    letterSpacing: -0.5,
    marginTop: 4,
    marginBottom: 16,
  },
  keypadGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  keypadKey: {
    width: "31.5%",
    aspectRatio: 1.7,
    backgroundColor: "#F2F4F7",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  keypadKeyText: {
    color: DARK,
    fontWeight: "800",
    fontSize: 22,
  },
  keypadAction: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  keypadActionText: { fontWeight: "800", fontSize: 15 },
});

// Receipt styles (used by ReceiptModal — defined here next to adminStyles)
const receiptStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,34,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    maxHeight: "92%",
  },
  handle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E5E7EB",
    alignSelf: "center",
    marginTop: 8,
    marginBottom: 4,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 16,
  },
  logoMark: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#0F1722",
    alignItems: "center",
    justifyContent: "center",
  },
  bizName: {
    fontSize: 22,
    fontWeight: "900",
    color: "#0F1722",
    letterSpacing: 1,
  },
  bizSub: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
  meta: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 13,
    color: "#0F1722",
    marginBottom: 4,
  },
  hr: {
    height: 1,
    backgroundColor: "#0F1722",
    marginVertical: 14,
  },
  headerRow: {
    flexDirection: "row",
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    paddingVertical: 6,
  },
  col: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 13,
    color: "#0F1722",
    fontWeight: "700",
  },
  colDesc: { flex: 3 },
  colQty: { flex: 0.6, textAlign: "center" },
  colPrice: { flex: 1.2, textAlign: "right" },
  colTotal: { flex: 1.2, textAlign: "right" },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "baseline",
    paddingVertical: 3,
    gap: 12,
  },
  totalsLabel: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 14,
    color: "#0F1722",
    fontWeight: "700",
  },
  totalsVal: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 14,
    color: "#0F1722",
    fontWeight: "700",
    minWidth: 90,
    textAlign: "right",
  },
  thanks: {
    textAlign: "center",
    color: "#6b7280",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 6,
  },
  doneBtn: {
    marginTop: 24,
    backgroundColor: "#0F1722",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  doneBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
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
  editLogoImg: {
    width: 110,
    height: 38,
    borderRadius: 4,
  },
  editLogoRemoveBtn: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  editLogoRemoveText: {
    color: MUTED,
    fontSize: 13,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
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
