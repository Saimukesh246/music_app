import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useAuthStore, DEFAULT_API_BASE_URL } from "../store/authStore";

interface AuthModalProps {
  visible: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ visible, onClose }) => {
  const {
    apiBaseUrl,
    setApiBaseUrl,
    login,
    register,
    isLoading,
    error,
    clearError,
  } = useAuthStore();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [serverUrlInput, setServerUrlInput] = useState(apiBaseUrl);

  const handleSubmit = async () => {
    clearError();
    if (!email.trim() || !password.trim()) {
      return;
    }

    if (serverUrlInput.trim() !== apiBaseUrl) {
      await setApiBaseUrl(serverUrlInput.trim());
    }

    const success =
      mode === "login"
        ? await login(email.trim(), password)
        : await register(email.trim(), password);

    if (success) {
      setEmail("");
      setPassword("");
      onClose();
    }
  };

  const handleResetServerUrl = async () => {
    setServerUrlInput(DEFAULT_API_BASE_URL);
    await setApiBaseUrl(DEFAULT_API_BASE_URL);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.backdrop}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.title}>AURA Cloud</Text>
              <Text style={styles.subtitle}>
                Hi-Res Lossless Streaming & Cloud Library Sync
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Mode Switcher */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, mode === "login" && styles.activeTab]}
              onPress={() => {
                clearError();
                setMode("login");
              }}
            >
              <Text
                style={[
                  styles.tabText,
                  mode === "login" && styles.activeTabText,
                ]}
              >
                Sign In
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, mode === "register" && styles.activeTab]}
              onPress={() => {
                clearError();
                setMode("register");
              }}
            >
              <Text
                style={[
                  styles.tabText,
                  mode === "register" && styles.activeTabText,
                ]}
              >
                Create Account
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.bodyScroll}
            keyboardShouldPersistTaps="handled"
          >
            {/* Error banner */}
            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Email Field */}
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="audiophile@aura.io"
              placeholderTextColor="#555"
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
            />

            {/* Password Field */}
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••••••"
              placeholderTextColor="#555"
              secureTextEntry
              autoCapitalize="none"
            />

            {/* Server URL toggle */}
            <TouchableOpacity
              onPress={() => setShowServerConfig((v) => !v)}
              style={styles.serverToggle}
            >
              <Text style={styles.serverToggleText}>
                {showServerConfig ? "▲ Hide Server Settings" : "▼ Configure Server URL"}
              </Text>
            </TouchableOpacity>

            {showServerConfig && (
              <View style={styles.serverConfigBox}>
                <Text style={styles.serverLabel}>Backend Host URL</Text>
                <TextInput
                  style={styles.serverInput}
                  value={serverUrlInput}
                  onChangeText={setServerUrlInput}
                  placeholder="http://10.0.2.2:8000"
                  placeholderTextColor="#555"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  onPress={handleResetServerUrl}
                  style={styles.resetButton}
                >
                  <Text style={styles.resetButtonText}>Reset to Default</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Submit Button */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                (!email.trim() || !password.trim() || isLoading) &&
                  styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!email.trim() || !password.trim() || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#0f0f14" />
              ) : (
                <Text style={styles.submitButtonText}>
                  {mode === "login" ? "Sign In" : "Create Account"}
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: "#13131a",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: "#252532",
    padding: 24,
    maxHeight: "85%",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#f5f5f7",
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 12,
    color: "#c8a96e",
    marginTop: 4,
  },
  closeButton: {
    padding: 6,
  },
  closeButtonText: {
    fontSize: 20,
    color: "#888",
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#1c1c24",
    borderRadius: 10,
    padding: 4,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: "#2a2a38",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#777",
  },
  activeTabText: {
    color: "#f5f5f7",
  },
  bodyScroll: {
    marginBottom: 10,
  },
  errorBox: {
    backgroundColor: "rgba(235, 87, 87, 0.15)",
    borderColor: "#eb5757",
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  errorText: {
    color: "#ff6b6b",
    fontSize: 13,
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
    color: "#aaa",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#1a1a24",
    borderWidth: 1,
    borderColor: "#2c2c3d",
    borderRadius: 10,
    color: "#f5f5f7",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 16,
  },
  serverToggle: {
    alignSelf: "flex-start",
    paddingVertical: 6,
    marginBottom: 12,
  },
  serverToggleText: {
    fontSize: 12,
    color: "#888",
  },
  serverConfigBox: {
    backgroundColor: "#181822",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#282836",
  },
  serverLabel: {
    fontSize: 11,
    color: "#888",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  serverInput: {
    backgroundColor: "#121218",
    borderWidth: 1,
    borderColor: "#262634",
    borderRadius: 8,
    color: "#ccc",
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    marginBottom: 8,
  },
  resetButton: {
    alignSelf: "flex-end",
  },
  resetButtonText: {
    fontSize: 11,
    color: "#c8a96e",
  },
  submitButton: {
    backgroundColor: "#c8a96e",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: "#0f0f14",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});
