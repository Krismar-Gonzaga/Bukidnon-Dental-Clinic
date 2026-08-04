// src/screens/ClinicsScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
  ScrollView,
  Modal,
  Keyboard,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { homeService } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';
import AppHeader from '../../components/navigation/AppHeader';
import SideDrawer from '../../components/navigation/SideDrawer';
import BottomNav from '../../components/navigation/BottomNav';

type ClinicListItem = {
  id: number | string;
  name: string;
  logo?: string;
  is_verified?: boolean;
  distance?: number;
  rating?: number;
  review_count?: number;
  address?: string;
  city?: string;
  contact_number?: string;
  email?: string;
  specializations?: string[];
  [key: string]: unknown;
};

type Specialization = { id: number | string; name: string };

const ClinicsScreen = ({ navigation, route }: { navigation: any; route: any }) => {
  const [clinics, setClinics] = useState<ClinicListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedSpecialization, setSelectedSpecialization] = useState<number | string>('');
  const [sortBy, setSortBy] = useState('rating');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [specializations, setSpecializations] = useState<Specialization[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [drawerVisible, setDrawerVisible] = useState(false);

  const { colors } = useTheme();
  const toggleDrawer = () => setDrawerVisible((v) => !v);

  // Get route params for initial search
  useEffect(() => {
    if (route.params?.search) {
      setSearchTerm(route.params.search);
    }
    if (route.params?.specialization) {
      setSelectedSpecialization(route.params.specialization);
    }
    if (route.params?.city) {
      setSelectedCity(route.params.city);
    }
  }, [route.params]);

  // Fetch clinics on mount and when filters change
  useEffect(() => {
    fetchClinics(true);
    fetchSpecializations();
    fetchCities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCity, selectedSpecialization, sortBy]);

  const fetchSpecializations = async () => {
    try {
      const response = await homeService.getSpecializations();
      setSpecializations(response.data.data || []);
    } catch (error) {
      console.error('Error fetching specializations:', error);
    }
  };

  const fetchCities = async () => {
    try {
      const response = await homeService.getCities();
      setCities(response.data.data || []);
    } catch (error) {
      console.error('Error fetching cities:', error);
    }
  };

  const fetchClinics = async (reset = false) => {
    try {
      if (reset) {
        setLoading(true);
        setPage(1);
      } else {
        setLoadingMore(true);
      }

      const response = await homeService.searchClinics({
        search: searchTerm,
        city: selectedCity,
        specialization_id: selectedSpecialization,
        sort: sortBy,
        page: reset ? 1 : page,
        per_page: 10,
      });

      const data = response.data.data;
      const newClinics = data.data || [];

      if (reset) {
        setClinics(newClinics);
      } else {
        setClinics(prev => [...prev, ...newClinics]);
      }

      setHasMore(newClinics.length > 0 && data.current_page < data.last_page);
      setPage(data.current_page + 1);
    } catch (error) {
      console.error('Error fetching clinics:', error);
      Alert.alert('Error', 'Failed to load clinics. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchClinics(true);
  };

  const loadMore = () => {
    if (hasMore && !loadingMore && !loading) {
      fetchClinics(false);
    }
  };

  const handleSearch = () => {
    Keyboard.dismiss();
    fetchClinics(true);
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    fetchClinics(true);
  };

  const applyFilters = () => {
    setShowFilters(false);
    fetchClinics(true);
  };

  const resetFilters = () => {
    setSelectedCity('');
    setSelectedSpecialization('');
    setSortBy('rating');
    setShowFilters(false);
    fetchClinics(true);
  };

  const renderClinicItem = ({ item }: { item: ClinicListItem }) => (
    <TouchableOpacity
      style={[styles.clinicCard, { backgroundColor: colors.card }]}
      onPress={() => navigation.navigate('ClinicDetails', { id: item.id })}
      activeOpacity={0.8}
    >
      <View style={styles.clinicCardContent}>
        <View style={styles.clinicLogoContainer}>
          {item.logo ? (
            <Image source={{ uri: item.logo }} style={styles.clinicLogo} />
          ) : (
            <View style={[styles.clinicLogoPlaceholder, { backgroundColor: '#667eea' }]}>
              <Text style={styles.clinicLogoText}>{item.name?.charAt(0) || 'C'}</Text>
            </View>
          )}
          {item.is_verified && (
            <View style={styles.verifiedBadge}>
              <Icon name="checkmark-circle" size={16} color="#48bb78" />
            </View>
          )}
        </View>

        <View style={styles.clinicInfo}>
          <View style={styles.clinicNameRow}>
            <Text style={[styles.clinicName, { color: colors.text }]} numberOfLines={1}>
              {item.name}
            </Text>
            {Boolean(item.distance) && (
              <Text style={styles.distanceText}>{item.distance} km</Text>
            )}
          </View>

          <View style={styles.ratingContainer}>
            <Icon name="star" size={14} color="#f6ad55" />
            <Text style={styles.ratingText}>{item.rating || '4.5'}</Text>
            <Text style={styles.reviewCount}>({item.review_count || 0} reviews)</Text>
          </View>

          <View style={styles.addressContainer}>
            <Icon name="location-outline" size={14} color="#718096" />
            <Text style={styles.addressText} numberOfLines={1}>
              {item.address || item.city || 'Address not available'}
            </Text>
          </View>

          {item.specializations && item.specializations.length > 0 && (
            <View style={styles.specializationsContainer}>
              {item.specializations.slice(0, 3).map((spec: string, index: number) => (
                <View key={index} style={styles.specializationTag}>
                  <Text style={styles.specializationText}>{spec}</Text>
                </View>
              ))}
              {item.specializations.length > 3 && (
                <Text style={styles.moreSpecializations}>
                  +{item.specializations.length - 3}
                </Text>
              )}
            </View>
          )}

          <View style={styles.clinicFooter}>
            <View style={styles.contactIcons}>
              {Boolean(item.contact_number) && (
                <TouchableOpacity 
                  style={styles.contactIcon}
                  onPress={() => {
                    // Handle call
                  }}
                >
                  <Icon name="call-outline" size={18} color="#667eea" />
                </TouchableOpacity>
              )}
              {Boolean(item.email) && (
                <TouchableOpacity 
                  style={styles.contactIcon}
                  onPress={() => {
                    // Handle email
                  }}
                >
                  <Icon name="mail-outline" size={18} color="#667eea" />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              style={styles.bookNowButton}
              onPress={() => navigation.navigate('BookAppointment', { clinicId: item.id })}
            >
              <Text style={styles.bookNowText}>Book Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderFilterModal = () => (
    <Modal
      visible={showFilters}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowFilters(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Filters</Text>
            <TouchableOpacity onPress={() => setShowFilters(false)}>
              <Icon name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Sort By */}
            <Text style={[styles.filterLabel, { color: colors.text }]}>Sort By</Text>
            <View style={styles.filterOptions}>
              {['rating', 'newest', 'distance'].map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.filterOption,
                    sortBy === option && styles.selectedFilterOption,
                  ]}
                  onPress={() => setSortBy(option)}
                >
                  <Text
                    style={[
                      styles.filterOptionText,
                      sortBy === option && styles.selectedFilterOptionText,
                    ]}
                  >
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* City Filter */}
            <Text style={[styles.filterLabel, { color: colors.text }]}>City</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cityScroll}>
              <TouchableOpacity
                style={[
                  styles.cityChip,
                  !selectedCity && styles.selectedCityChip,
                ]}
                onPress={() => setSelectedCity('')}
              >
                <Text style={[!selectedCity ? styles.selectedCityChipText : styles.cityChipText]}>
                  All Cities
                </Text>
              </TouchableOpacity>
              {cities.map((city) => (
                <TouchableOpacity
                  key={city}
                  style={[
                    styles.cityChip,
                    selectedCity === city && styles.selectedCityChip,
                  ]}
                  onPress={() => setSelectedCity(city)}
                >
                  <Text
                    style={[
                      selectedCity === city ? styles.selectedCityChipText : styles.cityChipText,
                    ]}
                  >
                    {city}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Specialization Filter */}
            <Text style={[styles.filterLabel, { color: colors.text }]}>Specialization</Text>
            <View style={styles.specializationGrid}>
              <TouchableOpacity
                style={[
                  styles.specializationChip,
                  !selectedSpecialization && styles.selectedSpecializationChip,
                ]}
                onPress={() => setSelectedSpecialization('')}
              >
                <Text
                  style={[
                    !selectedSpecialization 
                      ? styles.selectedSpecializationChipText 
                      : styles.specializationChipText,
                  ]}
                >
                  All
                </Text>
              </TouchableOpacity>
              {specializations.map((spec) => (
                <TouchableOpacity
                  key={spec.id}
                  style={[
                    styles.specializationChip,
                    selectedSpecialization === spec.id && styles.selectedSpecializationChip,
                  ]}
                  onPress={() => setSelectedSpecialization(spec.id)}
                >
                  <Text
                    style={[
                      selectedSpecialization === spec.id 
                        ? styles.selectedSpecializationChipText 
                        : styles.specializationChipText,
                    ]}
                  >
                    {spec.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.resetButton} onPress={resetFilters}>
              <Text style={styles.resetButtonText}>Reset All</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.applyButton} onPress={applyFilters}>
              <Text style={styles.applyButtonText}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Icon name="search-outline" size={60} color="#e2e8f0" />
      <Text style={styles.emptyTitle}>No Clinics Found</Text>
      <Text style={styles.emptyText}>
        Try adjusting your search or filters to find what you're looking for.
      </Text>
      <TouchableOpacity style={styles.clearFiltersButton} onPress={resetFilters}>
        <Text style={styles.clearFiltersButtonText}>Clear Filters</Text>
      </TouchableOpacity>
    </View>
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#667eea" />
      </View>
    );
  };

  return (
    <View style={styles.screenRoot}>
      <AppHeader onMenuPress={toggleDrawer} onAvatarPress={() => navigation.navigate('Profile')} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Search Header */}
      <View style={[styles.searchHeader, { backgroundColor: colors.card }]}>
        <View style={styles.searchContainer}>
          <Icon name="search-outline" size={20} color="#a0aec0" />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search clinics, dentists, services..."
            placeholderTextColor="#a0aec0"
            value={searchTerm}
            onChangeText={setSearchTerm}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          {searchTerm.length > 0 && (
            <TouchableOpacity onPress={handleClearSearch} style={styles.clearButton}>
              <Icon name="close-circle" size={20} color="#a0aec0" />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.filterButton, showFilters && styles.filterButtonActive]}
          onPress={() => setShowFilters(true)}
        >
          <Icon 
            name="options-outline" 
            size={24} 
            color={showFilters ? '#fff' : '#667eea'} 
          />
          {Boolean(selectedCity || selectedSpecialization) && (
            <View style={styles.filterBadge} />
          )}
        </TouchableOpacity>
      </View>

      {/* Active Filters */}
      {Boolean(selectedCity || selectedSpecialization) && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.activeFilters}>
          {Boolean(selectedCity) && (
            <View style={styles.activeFilterChip}>
              <Text style={styles.activeFilterText}>{selectedCity}</Text>
              <TouchableOpacity onPress={() => setSelectedCity('')}>
                <Icon name="close" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
          {Boolean(selectedSpecialization) && (
            <View style={styles.activeFilterChip}>
              <Text style={styles.activeFilterText}>
                {specializations.find(s => s.id === selectedSpecialization)?.name || 'Specialization'}
              </Text>
              <TouchableOpacity onPress={() => setSelectedSpecialization('')}>
                <Icon name="close" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}

      {/* Results Count */}
      <View style={styles.resultsHeader}>
        <Text style={[styles.resultsCount, { color: colors.text }]}>
          {clinics.length} clinics found
        </Text>
        <Text style={styles.sortByText}>
          Sort: {sortBy.charAt(0).toUpperCase() + sortBy.slice(1)}
        </Text>
      </View>

      {/* Clinic List */}
      <FlatList
        data={clinics}
        renderItem={renderClinicItem}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#667eea']} />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.1}
        ListFooterComponent={renderFooter}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={!loading ? renderEmptyState : null}
        showsVerticalScrollIndicator={false}
      />

      {/* Filter Modal */}
      {renderFilterModal()}
      </View>
      <BottomNav activeTab="Clinics" />
      <SideDrawer visible={drawerVisible} onClose={toggleDrawer} activeItem="Clinics" />
    </View>
  );
};

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f7fafc',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 16,
    color: '#2d3748',
    marginLeft: 8,
  },
  clearButton: {
    padding: 4,
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#ebf8ff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#667eea',
    position: 'relative',
  },
  filterButtonActive: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  filterBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fc8181',
  },
  activeFilters: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  activeFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#667eea',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  activeFilterText: {
    color: '#fff',
    fontSize: 13,
    marginRight: 6,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  resultsCount: {
    fontSize: 14,
    color: '#718096',
  },
  sortByText: {
    fontSize: 12,
    color: '#a0aec0',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 80,
  },
  clinicCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  clinicCardContent: {
    flexDirection: 'row',
  },
  clinicLogoContainer: {
    position: 'relative',
    marginRight: 14,
  },
  clinicLogo: {
    width: 64,
    height: 64,
    borderRadius: 12,
  },
  clinicLogoPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clinicLogoText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#fff',
    borderRadius: 10,
  },
  clinicInfo: {
    flex: 1,
  },
  clinicNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  clinicName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2d3748',
    flex: 1,
  },
  distanceText: {
    fontSize: 12,
    color: '#a0aec0',
    marginLeft: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2d3748',
    marginLeft: 4,
  },
  reviewCount: {
    fontSize: 12,
    color: '#a0aec0',
    marginLeft: 4,
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  addressText: {
    fontSize: 13,
    color: '#718096',
    marginLeft: 4,
    flex: 1,
  },
  specializationsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  specializationTag: {
    backgroundColor: '#ebf8ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginRight: 6,
    marginBottom: 4,
  },
  specializationText: {
    fontSize: 11,
    color: '#2b6cb0',
    fontWeight: '500',
  },
  moreSpecializations: {
    fontSize: 11,
    color: '#a0aec0',
    marginLeft: 4,
  },
  clinicFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  contactIcons: {
    flexDirection: 'row',
  },
  contactIcon: {
    padding: 4,
    marginRight: 8,
  },
  bookNowButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  bookNowText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2d3748',
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: 12,
    marginTop: 16,
  },
  filterOptions: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  filterOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginRight: 8,
    backgroundColor: '#fff',
  },
  selectedFilterOption: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  filterOptionText: {
    fontSize: 14,
    color: '#2d3748',
  },
  selectedFilterOptionText: {
    color: '#fff',
  },
  cityScroll: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  cityChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginRight: 8,
    backgroundColor: '#fff',
  },
  selectedCityChip: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  cityChipText: {
    fontSize: 14,
    color: '#2d3748',
  },
  selectedCityChipText: {
    color: '#fff',
  },
  specializationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  specializationChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  selectedSpecializationChip: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  specializationChipText: {
    fontSize: 14,
    color: '#2d3748',
  },
  selectedSpecializationChipText: {
    color: '#fff',
  },
  modalFooter: {
    flexDirection: 'row',
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  resetButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    marginRight: 8,
  },
  resetButtonText: {
    fontSize: 16,
    color: '#4a5568',
    fontWeight: '500',
  },
  applyButton: {
    flex: 2,
    backgroundColor: '#667eea',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginLeft: 8,
  },
  applyButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  // Empty State
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2d3748',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#a0aec0',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
    paddingHorizontal: 40,
  },
  clearFiltersButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  clearFiltersButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Footer Loader
  footerLoader: {
    paddingVertical: 16,
    alignItems: 'center',
  },
});

export default ClinicsScreen;