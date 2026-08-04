// src/components/navigation/BottomNav.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';

interface BottomNavProps {
  activeTab: 'Home' | 'Clinics' | 'Appointments' | 'Profile';
}

const BottomNav = ({ activeTab }: BottomNavProps) => {
  const navigation = useNavigation();

  const goTo = (route: string) => {
    if (route !== activeTab) {
      navigation.navigate(route as never);
    }
  };

  return (
    <View style={styles.bottomNav}>
      <TouchableOpacity style={styles.navItem} onPress={() => goTo('Home')}>
        <Icon
          name={activeTab === 'Home' ? 'home' : 'home-outline'}
          size={24}
          color={activeTab === 'Home' ? '#003f87' : '#727784'}
        />
        <Text style={[styles.navLabel, activeTab === 'Home' && styles.navLabelActive]}>Home</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.navItem} onPress={() => goTo('Clinics')}>
        <Icon
          name={activeTab === 'Clinics' ? 'location' : 'location-outline'}
          size={24}
          color={activeTab === 'Clinics' ? '#003f87' : '#727784'}
        />
        <Text style={[styles.navLabel, activeTab === 'Clinics' && styles.navLabelActive]}>Clinics</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('BookAppointment' as never)}>
        <View style={styles.navBookButton}>
          <Icon name="add-circle" size={32} color="#fff" />
        </View>
        <Text style={styles.navLabel}>Book</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.navItem} onPress={() => goTo('Appointments')}>
        <Icon
          name={activeTab === 'Appointments' ? 'calendar' : 'calendar-outline'}
          size={24}
          color={activeTab === 'Appointments' ? '#003f87' : '#727784'}
        />
        <Text style={[styles.navLabel, activeTab === 'Appointments' && styles.navLabelActive]}>
          Appointments
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.navItem} onPress={() => goTo('Profile')}>
        <Icon
          name={activeTab === 'Profile' ? 'person' : 'person-outline'}
          size={24}
          color={activeTab === 'Profile' ? '#003f87' : '#727784'}
        />
        <Text style={[styles.navLabel, activeTab === 'Profile' && styles.navLabelActive]}>Profile</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#c2c6d4',
    paddingHorizontal: 8,
    paddingVertical: 8,
    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 4,
  },
  navItem: {
    alignItems: 'center',
    paddingVertical: 4,
    flex: 1,
  },
  navLabel: {
    fontSize: 10,
    color: '#727784',
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Inter' : 'sans-serif',
  },
  navLabelActive: {
    color: '#003f87',
    fontWeight: '600',
  },
  navBookButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#003f87',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
});

export default BottomNav;
