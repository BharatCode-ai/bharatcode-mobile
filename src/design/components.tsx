import React, { PropsWithChildren } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Pressable,
  ScrollView,
  StyleProp,
  Text,
  TextStyle,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SvgXml } from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import { useReducedMotion } from "./motion";
import { C, styles as s } from "./tokens";
import { describeIssue } from "./issues";
import { useApp } from "../state/react";
// The exact licensed Desktop mark, bundled locally.
const mark =
  '<svg viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="#ff6b35" stroke-width="54" stroke-linecap="square" stroke-linejoin="miter"><path d="M194 142 84 256l110 114"/><path d="m318 142 110 114-110 114"/></g><path fill="#ff6b35" d="m256 221 35 35-35 35-35-35z"/></svg>\n';
export function Brand({ size = 32 }: { size?: number }) {
  return (
    <SvgXml
      xml={mark}
      width={size}
      height={size}
      accessibilityLabel="BharatCode"
    />
  );
}
export function Txt({
  children,
  muted = false,
  style,
  selectable = false,
}: {
  children: React.ReactNode;
  muted?: boolean;
  style?: StyleProp<TextStyle>;
  selectable?: boolean;
}) {
  return (
    <Text selectable={selectable} style={[muted ? s.muted : s.body, style]}>
      {children}
    </Text>
  );
}
export function Icon({
  name,
  size = 22,
  color = C.text,
}: {
  name: React.ComponentProps<typeof Ionicons>["name"];
  size?: number;
  color?: string;
}) {
  return <Ionicons name={name} size={size} color={color ?? C.text} />;
}
export function Button({
  title,
  onPress,
  icon,
  primary = false,
  disabled = false,
  compact = false,
  align = "center",
}: {
  title: string;
  onPress: () => void;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  primary?: boolean;
  disabled?: boolean;
  compact?: boolean;
  align?: "left" | "center";
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        minHeight: 48,
        minWidth: 48,
        paddingHorizontal: compact ? 10 : 16,
        paddingVertical: 10,
        borderRadius: primary ? 16 : 12,
        backgroundColor: primary
          ? C.orange
          : pressed
            ? C.raised
            : "transparent",
        borderWidth: primary || compact ? 0 : 1,
        borderColor: C.border,
        opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
        flexDirection: "row",
        gap: 8,
        alignItems: "center",
        justifyContent: align === "left" ? "flex-start" : "center",
      })}
    >
      {icon && <Icon name={icon} color={primary ? "#26160E" : C.text} />}
      <Txt
        style={{
          fontSize: 14,
          flexShrink: 1,
          color: primary ? "#26160E" : C.text,
          fontWeight: "600",
        }}
      >
        {title}
      </Txt>
    </Pressable>
  );
}
export function IconButton({
  label,
  color = C.text,
  onPress,
  icon,
  disabled = false,
}: {
  label: string;
  color?: string;
  onPress: () => void;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 48,
        height: 48,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 24,
        backgroundColor: pressed ? C.raised : "transparent",
        opacity: disabled ? 0.4 : 1,
      })}
    >
      <Icon name={icon} color={color} />
    </Pressable>
  );
}
export function ListRow({
  title,
  detail,
  icon,
  accent = C.muted,
  onPress,
  trailing,
}: {
  title: string;
  detail?: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  accent?: string;
  onPress: () => void;
  trailing?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [
        s.row,
        {
          minHeight: 60,
          paddingVertical: 10,
          paddingHorizontal: 6,
          backgroundColor: pressed ? C.raised : "transparent",
          borderBottomWidth: 1,
          borderBottomColor: C.border,
        },
      ]}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: C.surface,
        }}
      >
        <Icon name={icon} size={19} color={accent} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt style={{ fontWeight: "600" }}>{title}</Txt>
        {!!detail && <Txt muted>{detail}</Txt>}
      </View>
      {trailing && (
        <Txt muted style={{ color: accent }}>
          {trailing}
        </Txt>
      )}
      <Icon name="chevron-forward" size={15} color={C.faint} />
    </Pressable>
  );
}
export function Header({
  title,
  subtitle,
  large = false,
  left,
  right,
}: {
  title: string;
  subtitle?: string;
  large?: boolean;
  left?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <View
      style={[
        s.row,
        {
          paddingHorizontal: large ? 20 : 10,
          paddingTop: large ? 20 : 4,
          paddingBottom: large ? 12 : 4,
          borderBottomWidth: large ? 0 : 1,
          borderBottomColor: C.border,
        },
      ]}
    >
      {left}
      <View style={s.grow}>
        <Txt
          style={{
            fontSize: large ? 32 : 17,
            lineHeight: large ? 40 : 22,
            letterSpacing: large ? -1.3 : -0.4,
            fontWeight: "600",
          }}
        >
          {title}
        </Txt>
        {subtitle && <Txt muted>{subtitle}</Txt>}
      </View>
      {right}
    </View>
  );
}
export function Sheet({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const reduced = useReducedMotion();
  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduced ? "none" : "slide"}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "#0009",
        }}
      >
        <Pressable
          accessibilityLabel="Close sheet"
          onPress={onClose}
          style={{ flex: 1 }}
        />
        <SafeAreaView
          edges={["bottom"]}
          style={{
            backgroundColor: C.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            maxHeight: "85%",
          }}
        >
          <View
            style={{
              width: 34,
              height: 4,
              borderRadius: 2,
              marginTop: 10,
              alignSelf: "center",
              backgroundColor: C.faint,
            }}
          />
          <View style={[s.row, { paddingHorizontal: 20, paddingTop: 4 }]}>
            <Txt style={[s.title, { flex: 1 }]}>{title}</Txt>
            <IconButton icon="close" label="Close" onPress={onClose} />
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={s.content}
          >
            {children}
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
export function Empty({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: React.ReactNode;
}) {
  return (
    <View
      style={{
        padding: 32,
        gap: 16,
        alignItems: "center",
        justifyContent: "center",
        flex: 1,
      }}
    >
      <Brand />
      <Txt style={[s.title, { textAlign: "center" }]}>{title}</Txt>
      <Txt muted style={{ textAlign: "center" }}>
        {detail}
      </Txt>
      {action}
    </View>
  );
}
export function Busy() {
  return <ActivityIndicator color={C.orange} style={{ padding: 24 }} />;
}
export function Frame({
  children,
  wide = false,
}: PropsWithChildren<{ wide?: boolean }>) {
  return (
    <SafeAreaView edges={["top", "left", "right"]} style={s.page}>
      <View
        style={{
          width: "100%",
          maxWidth: wide ? 1200 : 720,
          alignSelf: "center",
          flex: 1,
        }}
      >
        {children}
      </View>
    </SafeAreaView>
  );
}
export function IssueCard({
  message,
  fallback,
  desktop,
  status,
  onAction,
  actionLabel,
  onDismiss,
  pending,
}: {
  message: string;
  fallback: string;
  desktop?: string;
  status?: number;
  onAction?: () => void;
  actionLabel?: string;
  onDismiss?: () => void;
  pending?: boolean;
}) {
  const issue = describeIssue(message, fallback, desktop, status);
  return (
    <View style={[s.panel, { gap: 6, padding: 16 }]}>
      <View style={[s.row, { alignItems: "flex-start" }]}>
        <View
          style={{ padding: 8, borderRadius: 12, backgroundColor: "#FFAB6418" }}
        >
          <Icon name="alert-circle-outline" size={20} color="#FFB278" />
        </View>
        <View accessibilityLiveRegion="polite" style={{ flex: 1, gap: 4 }}>
          <Txt style={{ fontWeight: "600" }}>{issue.title}</Txt>
          <Txt muted>{issue.detail}</Txt>
        </View>
        {onDismiss && (
          <IconButton
            label="Dismiss message"
            icon="close"
            onPress={onDismiss}
          />
        )}
      </View>
      {onAction && (
        <View style={{ alignSelf: "flex-start", marginLeft: 48 }}>
          <Button
            title={pending ? "Trying again…" : (actionLabel ?? "Try again")}
            disabled={pending}
            onPress={onAction}
          />
        </View>
      )}
    </View>
  );
}
export function Notices({
  hideError = false,
  hideNotice = false,
}: {
  hideError?: boolean;
  hideNotice?: boolean;
}) {
  const { store, state } = useApp();
  return (
    <>
      {state.preview && (
        <View
          style={{
            backgroundColor: "#FF693315",
            paddingHorizontal: 20,
            paddingVertical: 6,
          }}
        >
          <Txt muted style={{ color: C.orange }}>
            Preview workspace · Sample data
          </Txt>
        </View>
      )}
      {state.error && !hideError && (
        <View style={{ paddingHorizontal: 20, paddingVertical: 8 }}>
          <IssueCard
            message={state.error}
            status={state.errorStatus}
            desktop={state.device?.name}
            fallback="Couldn’t finish this action"
            onDismiss={store.clearError}
          />
        </View>
      )}
      {!hideNotice && !state.error && state.notice && (
        <View
          accessibilityLiveRegion="polite"
          style={{
            paddingHorizontal: 20,
            paddingVertical: 10,
            backgroundColor: C.surface,
          }}
        >
          <View style={s.row}>
            <Txt
              style={{
                flex: 1,
                fontSize: 13,
                color: C.muted,
              }}
            >
              {state.notice}
            </Txt>
            <IconButton
              label="Dismiss message"
              icon="close"
              onPress={store.clearError}
            />
          </View>
        </View>
      )}
    </>
  );
}
