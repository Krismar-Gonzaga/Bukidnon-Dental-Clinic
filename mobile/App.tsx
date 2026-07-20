/**
 * Bukidnon Dental Portal - React Native App
 * 
 * @format
 */

import React from 'react';
import {
  ActivityIndicator,
  StatusBar,
  StyleSheet,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/Ionicons';

// Import Screens
import HomeScreen from './src/screens/HomeScreen';
import ClinicsScreen from './src/screens/ClinicsScreen';
import ClinicDetailsScreen from './src/screens/ClinicDetailsScreen';
import AppointmentsScreen from './src/screens/AppointmentsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import LoginScreen from './src/screens/auth/LoginScreen';
import RegisterScreen from './src/screens/auth/RegisterScreen';
import BookAppointmentScreen from './src/screens/BookAppointmentScreen';
import FeedbackScreen from './src/screens/FeedbackScreen';

// Import Context Providers
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ThemeProvider } from './src/context/ThemeContext';

// Navigation Setup
const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Main Tab Navigator for authenticated users
function MainTabs() {
  const isDarkMode = useColorScheme() === 'dark';
  const tabBarStyle = {
    backgroundColor: isDarkMode ? '#1a202c' : '#ffffff',
    borderTopColor: isDarkMode ? '#2d3748' : '#e2e8f0',
    paddingBottom: 8,
    paddingTop: 8,
    height: 60,
  };

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          switch (route.name) {
            case 'Home':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'Clinics':
              iconName = focused ? 'search' : 'search-outline';
              break;
            case 'Appointments':
              iconName = focused ? 'calendar' : 'calendar-outline';
              break;
            case 'Profile':
              iconName = focused ? 'person' : 'person-outline';
              break;
            default:
              iconName = 'home-outline';
          }
          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#667eea',
        tabBarInactiveTintColor: '#a0aec0',
        tabBarStyle: tabBarStyle,
        headerStyle: {
          backgroundColor: isDarkMode ? '#1a202c' : '#ffffff',
        },
        headerTintColor: isDarkMode ? '#ffffff' : '#2d3748',
        headerTitleStyle: {
          fontWeight: '600',
        },
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen} 
        options={{ title: 'Home' }}
      />
      <Tab.Screen 
        name="Clinics" 
        component={ClinicsScreen} 
        options={{ title: 'Find Clinics' }}
      />
      <Tab.Screen 
        name="Appointments" 
        component={AppointmentsScreen} 
        options={{ title: 'Appointments' }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen} 
        options={{ title: 'Profile' }}
      />
    </Tab.Navigator>
  );
}

// Main App Component
function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <StatusBar 
            barStyle={isDarkMode ? 'light-content' : 'dark-content'} 
            backgroundColor={isDarkMode ? '#1a202c' : '#ffffff'}
          />
          <AppNavigator />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

// Navigation Configuration
function AppNavigator() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: '#667eea',
          },
          headerTintColor: '#ffffff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          headerBackTitle: 'Back',
        }}
      >
        {isAuthenticated ? (
          <>
            {/* Main App Screens */}
            <Stack.Screen
              name="MainTabs"
              component={MainTabs}
              options={{ headerShown: false }}
            />

            {/* Protected Screens */}
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
            {/* Auth Screens */}
            <Stack.Screen
              name="Login"
              component={LoginScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Register"
              component={RegisterScreen}
              options={{ headerShown: false }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default App;