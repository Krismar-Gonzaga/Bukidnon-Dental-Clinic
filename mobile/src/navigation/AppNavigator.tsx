// src/navigation/AppNavigator.tsx
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

// Import Screens
import PatientHomeScreen from '../screens/patient/PatientHomeScreen';
import ClinicsScreen from '../screens/patient/ClinicsScreen';
import ClinicDetailsScreen from '../screens/patient/ClinicDetailsScreen';
import AppointmentsScreen from '../screens/patient/AppointmentsScreen';
import BookAppointmentScreen from '../screens/patient/BookAppointmentScreen';
import ProfileScreen from '../screens/patient/ProfileScreen';
import FeedbackScreen from '../screens/patient/FeedbackScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';

// Import Context
import { useAuth } from '../context/AuthContext';

const Stack = createStackNavigator();

// Main App Navigator
export default function AppNavigator() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#003f87" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: '#003f87' },
          headerTintColor: '#ffffff',
          headerTitleStyle: { fontWeight: 'bold' },
          headerBackTitle: 'Back',
        }}
      >
        {isAuthenticated ? (
          <>
            {/* Main patient pages — each renders its own AppHeader/BottomNav/SideDrawer */}
            <Stack.Screen name="Home" component={PatientHomeScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Clinics" component={ClinicsScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Appointments" component={AppointmentsScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Profile" component={ProfileScreen} options={{ headerShown: false }} />

            {/* Detail / form screens use the default Stack header with a back button */}
            <Stack.Screen
              name="ClinicDetails"
              component={ClinicDetailsScreen}
              options={{ title: 'Clinic Details' }}
            />
            <Stack.Screen
              name="BookAppointment"
              component={BookAppointmentScreen}
              options={{ title: 'Book Appointment' }}
            />
            <Stack.Screen
              name="Feedback"
              component={FeedbackScreen}
              options={{ title: 'Submit Feedback' }}
            />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: false }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
