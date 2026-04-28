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
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  useFonts,
  LaBelleAurore_400Regular,
} from "@expo-google-fonts/la-belle-aurore";

const STORAGE_KEY = "@vic_probationary_licence_v1";

type Licence = {
  firstName: string;
  middle: string;
  lastName: string;
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
};

const DEFAULT_DATA: Licence = {
  firstName: "QUAYDE",
  middle: "A",
  lastName: "BURNHAM",
  permitNumber: "873 361 653",
  expiry: "04 Jul 2026",
  licenceType: "Car",
  dob: "04 Jul 2007",
  addressLine1: "9 SHARPES RD",
  addressLine2: "MINERS REST 3352 VIC",
  signatureName: "Quayde",
  permitStatus: "Current",
  proficiency: "Probationary",
  issueDate: "27 Jul 2023",
  cardNumber: "P3497519",
};

function formatRefreshed(d: Date) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const day = days[d.getDay()];
  const date = String(d.getDate()).padStart(2, "0");
  const mon = months[d.getMonth()];
  const yr = d.getFullYear();
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "pm" : "am";
  h = h % 12 || 12;
  return `${day}, ${date} ${mon} ${yr} at ${String(h).padStart(2, "0")}:${m} ${ampm}`;
}

export default function Index() {
  const insets = useSafeAreaInsets();
  const [fontsLoaded] = useFonts({ LaBelleAurore_400Regular });
  const [data, setData] = useState<Licence>(DEFAULT_DATA);
  const [activeTab, setActiveTab] = useState<"permit" | "identity" | "age">("permit");
  const [editVisible, setEditVisible] = useState(false);
  const [draft, setDraft] = useState<Licence>(DEFAULT_DATA);
  const [refreshedAt, setRefreshedAt] = useState<Date>(new Date());

  // Load persisted
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) setData({ ...DEFAULT_DATA, ...JSON.parse(raw) });
      } catch (e) {
        console.log("load error", e);
      }
    })();
  }, []);

  const openEdit = () => {
    setDraft(data);
    setEditVisible(true);
  };

  const saveEdit = useCallback(async () => {
    setData(draft);
    setRefreshedAt(new Date());
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch (e) {
      console.log("save error", e);
    }
    setEditVisible(false);
  }, [draft]);

  const resetData = () => {
    Alert.alert("Reset licence", "Restore default placeholder details?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reset",
        style: "destructive",
        onPress: async () => {
          setData(DEFAULT_DATA);
          setRefreshedAt(new Date());
          await AsyncStorage.removeItem(STORAGE_KEY);
        },
      },
    ]);
  };

  const fullName = [data.firstName, data.middle, data.lastName]
    .filter(Boolean)
    .join(" ");

  const initials =
    (data.firstName?.[0] || "") + (data.lastName?.[0] || "");

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <SafeAreaView style={styles.safe} edges={["top"]}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.iconBtn}
            testID="back-button"
            onPress={() => Alert.alert("Back", "This is the licence detail screen.")}
          >
            <Ionicons name="arrow-back" size={26} color="#0f1722" />
          </TouchableOpacity>
          <Text style={styles.topTitle} testID="screen-title">View details</Text>
          <View style={styles.iconBtn} />
        </View>
        <Text style={styles.refreshed} testID="last-refreshed">
          Last refreshed: {formatRefreshed(refreshedAt)}
        </Text>

        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Header strip */}
          <View style={styles.headerStrip} testID="header-strip">
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>PROBATIONARY DRIVER LICENCE</Text>
              <Text style={styles.headerSub}>Victoria Australia</Text>
            </View>
            <View style={styles.logoBox}>
              <Text style={styles.logoTick}>✓</Text>
              <Text style={styles.logoText}>vic<Text style={{ fontWeight: "800" }}>roads</Text></Text>
            </View>
          </View>

          {/* Photo + QR consent */}
          <View style={styles.greenBlock}>
            <View style={styles.photoWrap} testID="portrait-photo">
              <View style={styles.photoBg}>
                <Text style={styles.photoInitials}>{initials || "?"}</Text>
              </View>
              {/* watermark overlay - diagonal VICROADS + crowns, like a security pattern */}
              <View style={styles.watermarkOverlay}>
                {Array.from({ length: 14 }).map((_, i) => (
                  <Text
                    key={i}
                    style={[
                      styles.watermarkText,
                      {
                        top: i * 26 - 30,
                        left: (i % 2 === 0 ? -20 : -60),
                        right: -60,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {"VICROADS  ★  VICROADS  ★  VICROADS"}
                  </Text>
                ))}
              </View>
            </View>

            <View style={styles.qrPanel}>
              <Text style={styles.qrText}>
                Presenting a QR code allows your driver licence information to be scanned and shared.
              </Text>
              <Text style={styles.qrPrompt}>Do you consent to share your information?</Text>
              <TouchableOpacity
                style={styles.qrButton}
                onPress={openEdit}
                testID="reveal-qr-button"
              >
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
                  testID={`tab-${t}`}
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
            <View style={styles.detailsBlock} testID="permit-content">
              <Text
                style={styles.bigName}
                testID="full-name"
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.6}
              >
                {fullName}
              </Text>

              <View style={styles.row}>
                <Field label="Permit number" value={data.permitNumber} testID="permit-number" />
                <Field label="Expiry" value={data.expiry} testID="permit-expiry" />
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
                <Field label="Date of birth" value={data.dob} testID="dob" />
              </View>
              <View style={styles.hairline} />

              <View style={styles.col}>
                <Text style={styles.fieldLabel}>Address</Text>
                <Text style={styles.fieldValue} testID="address-line-1">{data.addressLine1}</Text>
                <Text style={styles.fieldValue} testID="address-line-2">{data.addressLine2}</Text>
              </View>
              <View style={styles.hairline} />

              <View style={styles.col}>
                <Text style={styles.fieldLabel}>Signature</Text>
                <Text
                  style={[
                    styles.signature,
                    { fontFamily: fontsLoaded ? "LaBelleAurore_400Regular" : undefined },
                  ]}
                  testID="signature"
                >
                  {data.signatureName}
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
                <Field label="Issue date" value={data.issueDate} testID="issue-date" />
                <Field label="Expiry" value={data.expiry} testID="expiry-date-2" />
              </View>
              <View style={styles.hairline} />

              <Text style={styles.sectionTitle}>Other details</Text>
              <Field label="Card number" value={data.cardNumber} testID="card-number" />

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

              <TouchableOpacity
                style={styles.resetBtn}
                onPress={resetData}
                testID="reset-button"
              >
                <Ionicons name="refresh" size={16} color="#6b7280" />
                <Text style={styles.resetText}>Reset to defaults</Text>
              </TouchableOpacity>
            </View>
          )}

          {activeTab === "identity" && (
            <EmptyTab
              icon="card-account-details-outline"
              title="Identity"
              testID="identity-content"
            />
          )}
          {activeTab === "age" && (
            <EmptyTab icon="cake-variant-outline" title="Age" testID="age-content" />
          )}
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
              <TouchableOpacity onPress={() => setEditVisible(false)} testID="cancel-edit">
                <Text style={styles.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Edit licence</Text>
              <TouchableOpacity onPress={saveEdit} testID="save-edit">
                <Text style={styles.modalSave}>Save</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
              <EditField label="First name" value={draft.firstName}
                onChange={(v) => setDraft({ ...draft, firstName: v.toUpperCase() })} testID="input-firstName" />
              <EditField label="Middle initial" value={draft.middle}
                onChange={(v) => setDraft({ ...draft, middle: v.toUpperCase() })} testID="input-middle" />
              <EditField label="Last name" value={draft.lastName}
                onChange={(v) => setDraft({ ...draft, lastName: v.toUpperCase() })} testID="input-lastName" />
              <EditField label="Permit number" value={draft.permitNumber}
                onChange={(v) => setDraft({ ...draft, permitNumber: v })} testID="input-permitNumber" />
              <EditField label="Expiry" value={draft.expiry}
                onChange={(v) => setDraft({ ...draft, expiry: v })} testID="input-expiry" />
              <EditField label="Licence type" value={draft.licenceType}
                onChange={(v) => setDraft({ ...draft, licenceType: v })} testID="input-licenceType" />
              <EditField label="Date of birth" value={draft.dob}
                onChange={(v) => setDraft({ ...draft, dob: v })} testID="input-dob" />
              <EditField label="Address line 1" value={draft.addressLine1}
                onChange={(v) => setDraft({ ...draft, addressLine1: v.toUpperCase() })} testID="input-addr1" />
              <EditField label="Address line 2" value={draft.addressLine2}
                onChange={(v) => setDraft({ ...draft, addressLine2: v.toUpperCase() })} testID="input-addr2" />
              <EditField label="Signature name" value={draft.signatureName}
                onChange={(v) => setDraft({ ...draft, signatureName: v })} testID="input-signature" />
              <EditField label="Permit status" value={draft.permitStatus}
                onChange={(v) => setDraft({ ...draft, permitStatus: v })} testID="input-status" />
              <EditField label="Proficiency" value={draft.proficiency}
                onChange={(v) => setDraft({ ...draft, proficiency: v })} testID="input-proficiency" />
              <EditField label="Issue date" value={draft.issueDate}
                onChange={(v) => setDraft({ ...draft, issueDate: v })} testID="input-issueDate" />
              <EditField label="Card number" value={draft.cardNumber}
                onChange={(v) => setDraft({ ...draft, cardNumber: v })} testID="input-cardNumber" />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* QR modal */}
    </View>
  );
}

function Field({ label, value, testID }: { label: string; value: string; testID?: string }) {
  return (
    <View style={styles.col}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue} testID={testID}>{value}</Text>
    </View>
  );
}

function EditField({
  label,
  value,
  onChange,
  testID,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  testID?: string;
}) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={styles.editLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        style={styles.editInput}
        placeholderTextColor="#9aa1ad"
        testID={testID}
      />
    </View>
  );
}

function EmptyTab({
  icon,
  title,
  testID,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  testID?: string;
}) {
  return (
    <View style={styles.emptyWrap} testID={testID}>
      <MaterialCommunityIcons name={icon} size={56} color="#c8cdd6" />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySub}>Nothing to display here yet.</Text>
    </View>
  );
}

const ORANGE = "#d8492b";
const GREEN = "#cfe6cb";
const PANEL = "#eef0f1";
const DARK = "#0f1722";
const MUTED = "#6b7280";

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

  // header
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
  logoBox: {
    backgroundColor: "#fff",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  logoTick: { color: ORANGE, fontWeight: "900", fontSize: 16, lineHeight: 18 },
  logoText: { color: ORANGE, fontWeight: "500", fontSize: 13 },

  // green block (photo + QR)
  greenBlock: {
    backgroundColor: GREEN,
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  photoWrap: {
    flex: 1,
    height: 280,
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: "#fce5c4",
    marginRight: 6,
  },
  photoBg: {
    flex: 1,
    backgroundColor: "#fce5c4",
    alignItems: "center",
    justifyContent: "center",
  },
  photoInitials: {
    fontSize: 84,
    fontWeight: "800",
    color: "#8a5a2b",
    letterSpacing: 2,
  },
  watermarkOverlay: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  watermarkText: {
    position: "absolute",
    color: "rgba(255,255,255,0.55)",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 2,
    transform: [{ rotate: "-30deg" }],
  },

  qrPanel: {
    flex: 1,
    height: 280,
    backgroundColor: PANEL,
    borderRadius: 4,
    padding: 14,
    justifyContent: "space-between",
    marginLeft: 6,
  },
  qrText: { color: "#3b3f47", fontSize: 13, lineHeight: 18 },
  qrPrompt: { color: DARK, fontWeight: "700", fontSize: 14, marginTop: 8 },
  qrButton: {
    backgroundColor: DARK,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 12,
  },
  qrButtonText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  // tabs
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

  // details
  detailsBlock: { paddingHorizontal: 20, paddingTop: 18 },
  bigName: {
    fontSize: 38,
    fontWeight: "800",
    color: DARK,
    letterSpacing: 0.3,
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

  resetBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 24,
    paddingVertical: 12,
  },
  resetText: { color: MUTED, fontSize: 14 },

  // empty tabs
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
    paddingHorizontal: 24,
  },
  emptyTitle: { fontSize: 20, fontWeight: "700", color: DARK, marginTop: 16 },
  emptySub: { color: MUTED, marginTop: 6, fontSize: 14 },

  // modal
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

  // qr modal
  qrBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  qrCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 24,
    alignItems: "center",
  },
  qrCardTitle: { fontSize: 18, fontWeight: "800", color: DARK },
  qrCodeWrap: {
    marginVertical: 18,
    padding: 12,
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#eceef2",
  },
  qrCardSub: {
    color: MUTED,
    textAlign: "center",
    fontSize: 13,
    lineHeight: 18,
  },
  qrDoneBtn: {
    backgroundColor: DARK,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 36,
    marginTop: 18,
  },
  qrDoneText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
