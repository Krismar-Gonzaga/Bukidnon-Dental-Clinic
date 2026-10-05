// Right-hand slide-in menu for guests (mobile drawer from the design).
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { palette, radius, spacing, type } from '../../theme/tokens';

export type GuestMenuKey = 'home' | 'clinics' | 'services' | 'rates' | 'about';

const MENU_ITEMS: Array<{ key: GuestMenuKey; label: string; icon: string }> = [
  { key: 'home', label: 'Home', icon: 'home-outline' },
  { key: 'clinics', label: 'Find Clinics', icon: 'search-outline' },
  { key: 'services', label: 'Services', icon: 'medical-outline' },
  { key: 'rates', label: 'Service Rates', icon: 'pricetag-outline' },
  { key: 'about', label: 'Why BukidnonDental', icon: 'information-circle-outline' },
];

type GuestDrawerProps = {
  visible: boolean;
  activeItem: GuestMenuKey;
  onClose: () => void;
  onSelect: (key: GuestMenuKey) => void;
  onLogin: () => void;
  onRegister: () => void;
};

const GuestDrawer = ({ visible, activeItem, onClose, onSelect, onLogin, onRegister }: GuestDrawerProps) => {
  const insets = useSafeAreaInsets();
  const drawerWidth = Math.min(Dimensions.get('window').width * 0.8, 360);
  const translateX = useRef(new Animated.Value(drawerWidth)).current;
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(translateX, { toValue: 0, duration: 250, useNativeDriver: true }).start();
    } else {
      Animated.timing(translateX, { toValue: drawerWidth, duration: 200, useNativeDriver: true }).start(
        () => setMounted(false),
      );
    }
  }, [visible, drawerWidth, translateX]);

  // Close first, then act, so the drawer isn't left open over the next screen.
  const run = (action: () => void) => () => {
    onClose();
    action();
  };

  return (
    <Modal visible={mounted} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close menu">
          <View style={styles.scrim} />
        </Pressable>
        <Animated.View
          style={[
            styles.drawer,
            {
              width: drawerWidth,
              paddingTop: insets.top + spacing.lg,
              paddingBottom: insets.bottom + spacing.lg,
              transform: [{ translateX }],
            },
          ]}
        >
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Menu</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityLabel="Close menu">
              <Icon name="close" size={26} color={palette.onSurface} />
            </TouchableOpacity>
          </View>

          <View style={styles.nav}>
            {MENU_ITEMS.map((item) => {
              const active = item.key === activeItem;
              return (
                <TouchableOpacity
                  key={item.key}
                  style={styles.navItem}
                  onPress={run(() => onSelect(item.key))}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Icon
                    name={item.icon}
                    size={22}
                    color={active ? palette.primary : palette.onSurfaceVariant}
                  />
                  <Text style={[styles.navText, active && styles.navTextActive]}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.primaryButton} onPress={run(onRegister)} activeOpacity={0.85}>
              <Text style={styles.primaryButtonText}>Register</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.outlineButton} onPress={run(onLogin)} activeOpacity={0.85}>
              <Text style={styles.outlineButtonText}>Login</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrim: { flex: 1, backgroundColor: palette.scrim },
  drawer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: palette.surfaceContainerLowest,
    paddingHorizontal: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  headerTitle: { ...type.headlineMd, fontWeight: '700', color: palette.primary },
  nav: { flex: 1, gap: spacing.xs },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  navText: { ...type.titleLg, fontSize: 18, color: palette.onSurfaceVariant },
  navTextActive: {
    color: palette.primary,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  actions: { gap: spacing.sm, marginTop: spacing.xl },
  primaryButton: {
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: palette.primary,
    alignItems: 'center',
  },
  primaryButtonText: { ...type.labelMd, fontSize: 14, color: palette.onPrimary },
  outlineButton: {
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.primary,
    alignItems: 'center',
  },
  outlineButtonText: { ...type.labelMd, fontSize: 14, color: palette.primary },
});

export default GuestDrawer;
