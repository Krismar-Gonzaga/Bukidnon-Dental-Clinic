// src/screens/ClinicDetailsScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Linking,
  Share,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { homeService } from '../../services/api';

type Clinic = {
  id: number | string;
  name: string;
  contact_number?: string;
  email?: string;
  latitude?: number;
  longitude?: number;
  cover_image?: string;
  is_verified?: boolean;
  logo?: string;
  rating?: number;
  review_count?: number;
  full_address?: string;
  description?: string;
  operating_hours?: string;
  specializations?: Array<{ name: string }>;
  services?: Array<{ name: string; description?: string; price_range?: string }>;
  dentists?: Array<{ name: string; specialization?: string; avatar?: string }>;
  reviews?: Array<{ patient?: { name?: string }; rating?: number; comment?: string; created_at?: string }>;
  [key: string]: unknown;
};

const ClinicDetailsScreen = ({ route, navigation }: { route: any; navigation: any }) => {
  const { id } = route.params;
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('about');

  useEffect(() => {
    fetchClinicDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchClinicDetails = async () => {
    try {
      const response = await homeService.getClinicDetails(id);
      setClinic(response.data.data);
    } catch (error) {
      console.error('Error fetching clinic details:', error);
      Alert.alert('Error', 'Failed to load clinic details');
    } finally {
      setLoading(false);
    }
  };

  const handleCall = () => {
    if (clinic?.contact_number) {
      Linking.openURL(`tel:${clinic.contact_number}`);
    }
  };

  const handleEmail = () => {
    if (clinic?.email) {
      Linking.openURL(`mailto:${clinic.email}`);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out ${clinic?.name} on Bukidnon Dental Portal!`,
        url: `https://bukidnondental.ph/clinics/${id}`,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleBookAppointment = () => {
    navigation.navigate('BookAppointment', { clinicId: id });
  };

  const handleViewMap = () => {
    if (clinic?.latitude && clinic?.longitude) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${clinic.latitude},${clinic.longitude}`;
      Linking.openURL(url);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
      </View>
    );
  }

  if (!clinic) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Clinic not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header Image */}
      <View style={styles.headerContainer}>
        {clinic.cover_image ? (
          <Image source={{ uri: clinic.cover_image }} style={styles.coverImage} />
        ) : (
          <View style={[styles.coverImage, styles.coverImagePlaceholder]}>
            <Icon name="business-outline" size={48} color="#cbd5e0" />
          </View>
        )}
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
          <Icon name="share-outline" size={24} color="#fff" />
        </TouchableOpacity>
        {clinic.is_verified && (
          <View style={styles.verifiedBadge}>
            <Icon name="checkmark-circle" size={16} color="#fff" />
            <Text style={styles.verifiedText}>Verified</Text>
          </View>
        )}
      </View>

      {/* Clinic Info */}
      <View style={styles.infoContainer}>
        <View style={styles.clinicHeader}>
          <View style={styles.clinicLogo}>
            {clinic.logo ? (
              <Image source={{ uri: clinic.logo }} style={styles.logoImage} />
            ) : (
              <Text style={styles.logoText}>{clinic.name.charAt(0)}</Text>
            )}
          </View>
          <View style={styles.clinicNameContainer}>
            <Text style={styles.clinicName}>{clinic.name}</Text>
            <View style={styles.ratingContainer}>
              <Icon name="star" size={16} color="#f6ad55" />
              <Text style={styles.ratingText}>{clinic.rating || '4.8'}</Text>
              <Text style={styles.reviewCount}>({clinic.review_count || 0} reviews)</Text>
            </View>
          </View>
        </View>

        <View style={styles.contactContainer}>
          <TouchableOpacity style={styles.contactButton} onPress={handleCall}>
            <Icon name="call-outline" size={20} color="#667eea" />
            <Text style={styles.contactButtonText}>Call</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.contactButton} onPress={handleEmail}>
            <Icon name="mail-outline" size={20} color="#667eea" />
            <Text style={styles.contactButtonText}>Email</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.contactButton} onPress={handleViewMap}>
            <Icon name="navigate-outline" size={20} color="#667eea" />
            <Text style={styles.contactButtonText}>Directions</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.addressContainer}>
          <Icon name="location-outline" size={20} color="#718096" />
          <Text style={styles.addressText}>{clinic.full_address}</Text>
        </View>

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          {['about', 'services', 'dentists', 'reviews'].map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.activeTab]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab Content */}
        <View style={styles.tabContent}>
          {activeTab === 'about' && (
            <View>
              <Text style={styles.sectionTitle}>About</Text>
              <Text style={styles.description}>
                {clinic.description || 'No description available.'}
              </Text>
              {clinic.specializations && clinic.specializations.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Specializations</Text>
                  <View style={styles.specializationsContainer}>
                    {clinic.specializations.map((spec, index) => (
                      <View key={index} style={styles.specializationTag}>
                        <Text style={styles.specializationText}>{spec.name}</Text>
                      </View>
                    ))}
                  </View>
                </>
              )}
              <Text style={styles.sectionTitle}>Operating Hours</Text>
              <Text style={styles.hoursText}>
                {clinic.operating_hours || 'Mon-Fri: 8:00 AM - 6:00 PM'}
              </Text>
            </View>
          )}

          {activeTab === 'services' && (
            <View>
              {clinic.services && clinic.services.length > 0 ? (
                clinic.services.map((service, index) => (
                  <View key={index} style={styles.serviceCard}>
                    <Text style={styles.serviceName}>{service.name}</Text>
                    <Text style={styles.serviceDescription}>{service.description}</Text>
                    <Text style={styles.servicePrice}>{service.price_range}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.noDataText}>No services available</Text>
              )}
            </View>
          )}

          {activeTab === 'dentists' && (
            <View>
              {clinic.dentists && clinic.dentists.length > 0 ? (
                clinic.dentists.map((dentist, index) => (
                  <View key={index} style={styles.dentistCard}>
                    <View style={styles.dentistAvatar}>
                      {dentist.avatar ? (
                        <Image source={{ uri: dentist.avatar }} style={styles.dentistImage} />
                      ) : (
                        <Text style={styles.dentistInitials}>{dentist.name.charAt(0)}</Text>
                      )}
                    </View>
                    <View style={styles.dentistInfo}>
                      <Text style={styles.dentistName}>{dentist.name}</Text>
                      <Text style={styles.dentistSpecialization}>
                        {dentist.specialization || 'General Dentist'}
                      </Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.noDataText}>No dentists listed</Text>
              )}
            </View>
          )}

          {activeTab === 'reviews' && (
            <View>
              {clinic.reviews && clinic.reviews.length > 0 ? (
                clinic.reviews.map((review, index) => (
                  <View key={index} style={styles.reviewCard}>
                    <View style={styles.reviewHeader}>
                      <Text style={styles.reviewerName}>{review.patient?.name || 'Anonymous'}</Text>
                      <View style={styles.reviewStars}>
                        {[...Array(5)].map((_, i) => (
                          <Icon
                            key={i}
                            name="star"
                            size={14}
                            color={i < (review.rating ?? 0) ? '#f6ad55' : '#e2e8f0'}
                          />
                        ))}
                      </View>
                    </View>
                    <Text style={styles.reviewComment}>{review.comment}</Text>
                    <Text style={styles.reviewDate}>
                      {review.created_at ? new Date(review.created_at).toLocaleDateString() : ''}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.noDataText}>No reviews yet</Text>
              )}
            </View>
          )}
        </View>

        {/* Book Appointment Button */}
        <TouchableOpacity style={styles.bookButton} onPress={handleBookAppointment}>
          <Icon name="calendar-outline" size={24} color="#fff" />
          <Text style={styles.bookButtonText}>Book Appointment</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 18,
    color: '#e53e3e',
  },
  headerContainer: {
    position: 'relative',
    height: 220,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverImagePlaceholder: {
    backgroundColor: '#edf2f7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButton: {
    position: 'absolute',
    top: 40,
    left: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 8,
  },
  shareButton: {
    position: 'absolute',
    top: 40,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 8,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    backgroundColor: '#48bb78',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  verifiedText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  infoContainer: {
    flex: 1,
    backgroundColor: '#fff',
    marginTop: -20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  clinicHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  clinicLogo: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  logoImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  logoText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  clinicNameContainer: {
    flex: 1,
  },
  clinicName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2d3748',
    marginLeft: 4,
  },
  reviewCount: {
    fontSize: 12,
    color: '#a0aec0',
    marginLeft: 4,
  },
  contactContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
  },
  contactButton: {
    alignItems: 'center',
  },
  contactButtonText: {
    fontSize: 12,
    color: '#667eea',
    marginTop: 4,
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  addressText: {
    fontSize: 14,
    color: '#718096',
    marginLeft: 8,
    flex: 1,
  },
  tabsContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 3,
    borderBottomColor: '#667eea',
  },
  tabText: {
    fontSize: 14,
    color: '#a0aec0',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#667eea',
  },
  tabContent: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2d3748',
    marginTop: 16,
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#4a5568',
    lineHeight: 22,
  },
  specializationsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  specializationTag: {
    backgroundColor: '#ebf8ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
  },
  specializationText: {
    fontSize: 12,
    color: '#2b6cb0',
    fontWeight: '500',
  },
  hoursText: {
    fontSize: 14,
    color: '#4a5568',
  },
  serviceCard: {
    backgroundColor: '#f7fafc',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2d3748',
  },
  serviceDescription: {
    fontSize: 14,
    color: '#718096',
    marginVertical: 4,
  },
  servicePrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#667eea',
  },
  dentistCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f7fafc',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  dentistAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  dentistImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  dentistInitials: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  dentistInfo: {
    flex: 1,
  },
  dentistName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2d3748',
  },
  dentistSpecialization: {
    fontSize: 14,
    color: '#718096',
  },
  reviewCard: {
    backgroundColor: '#f7fafc',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2d3748',
  },
  reviewStars: {
    flexDirection: 'row',
  },
  reviewComment: {
    fontSize: 14,
    color: '#4a5568',
    lineHeight: 20,
    marginBottom: 4,
  },
  reviewDate: {
    fontSize: 12,
    color: '#a0aec0',
  },
  noDataText: {
    fontSize: 14,
    color: '#a0aec0',
    textAlign: 'center',
    paddingVertical: 20,
  },
  bookButton: {
    backgroundColor: '#667eea',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  bookButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});

export default ClinicDetailsScreen;