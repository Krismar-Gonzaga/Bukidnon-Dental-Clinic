import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
    TextInput,
    FlatList,
    ActivityIndicator,
    RefreshControl,
    Dimensions,
    type ListRenderItem,
    type NativeSyntheticEvent,
    type TextInputSubmitEditingEventData,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { homeService, normalizeHomeData, type HomeScreenData } from '../services/api';

const { width } = Dimensions.get('window');

type HomeScreenProps = {
    navigation?: {
        navigate: (routeName: string, params?: Record<string, unknown>) => void;
    };
};

type ClinicItem = {
    id: number | string;
    name: string;
    address?: string;
    rating?: number;
    review_count?: number;
    logo?: string;
    is_verified?: boolean;
    specializations?: Array<string>;
};

type SpecializationItem = {
    id: number | string;
    name: string;
    description?: string;
};

type ReviewItem = {
    id: number | string;
    patient_name?: string;
    clinic_name?: string;
    rating?: number;
    comment?: string;
    date?: string;
};

type ServiceItem = {
    id: number | string;
    name: string;
    description?: string;
    price_range?: string;
};

const HomeScreen = ({ navigation }: HomeScreenProps) => {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [featuredClinics, setFeaturedClinics] = useState<ClinicItem[]>([]);
    const [specializations, setSpecializations] = useState<SpecializationItem[]>([]);
    const [popularServices, setPopularServices] = useState<ServiceItem[]>([]);
    const [recentReviews, setRecentReviews] = useState<ReviewItem[]>([]);
    const [stats, setStats] = useState<HomeScreenData['stats']>({
        verifiedClinics: 0,
        totalReviews: 0,
        totalSpecializations: 0,
    });
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchHomeData();
    }, []);

    const fetchHomeData = async () => {
        try {
            const response = await homeService.getHomeData();
            const data = normalizeHomeData(response);
            setFeaturedClinics(data.featuredClinics as ClinicItem[]);
            setSpecializations(data.specializations as SpecializationItem[]);
            setPopularServices(data.popularServices as ServiceItem[]);
            setRecentReviews(data.recentReviews as ReviewItem[]);
            setStats(data.stats);
        } catch (error) {
            console.error('Error fetching home data:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchHomeData();
    };

    const handleSearch = () => {
        if (searchTerm.trim()) {
            navigation?.navigate?.('Clinics', { search: searchTerm });
        }
    };

    const handleSubmitEditing = (event: NativeSyntheticEvent<TextInputSubmitEditingEventData>) => {
        event?.preventDefault?.();
        handleSearch();
    };

    const renderClinicCard: ListRenderItem<ClinicItem> = ({ item }) => (
        <TouchableOpacity
            style={styles.clinicCard}
            onPress={() => navigation?.navigate?.('ClinicDetails', { id: item.id })}
        >
            {item.is_verified && (
                <View style={styles.verifiedBadge}>
                    <Icon name="checkmark-circle" size={16} color="#fff" />
                    <Text style={styles.verifiedText}>Verified</Text>
                </View>
            )}
            <View style={styles.clinicLogo}>
                {item.logo ? (
                    <Image source={{ uri: item.logo }} style={styles.logoImage} />
                ) : (
                    <View style={styles.logoPlaceholder}>
                        <Text style={styles.logoText}>{item.name.charAt(0)}</Text>
                    </View>
                )}
            </View>
            <Text style={styles.clinicName}>{item.name}</Text>
            <View style={styles.ratingContainer}>
                <Icon name="star" size={16} color="#f6ad55" />
                <Text style={styles.ratingText}>{item.rating}</Text>
                <Text style={styles.reviewCount}>({item.review_count} reviews)</Text>
            </View>
            <View style={styles.addressContainer}>
                <Icon name="location-outline" size={14} color="#718096" />
                <Text style={styles.addressText}>{item.address}</Text>
            </View>
            <View style={styles.specializationsContainer}>
                {(item.specializations ?? []).map((spec, index) => (
                    <View key={index} style={styles.specializationTag}>
                        <Text style={styles.specializationText}>{spec}</Text>
                    </View>
                ))}
            </View>
            <TouchableOpacity
                style={styles.bookButton}
                onPress={() => navigation?.navigate?.('BookAppointment', { clinicId: item.id })}
            >
                <Text style={styles.bookButtonText}>Book Appointment</Text>
            </TouchableOpacity>
        </TouchableOpacity>
    );

    const renderSpecializationCard: ListRenderItem<SpecializationItem> = ({ item }) => (
        <TouchableOpacity
            style={styles.specializationCard}
            onPress={() => navigation?.navigate?.('Clinics', { specialization: item.id })}
        >
            <View style={styles.specializationIconContainer}>
                <Icon name="medical-outline" size={30} color="#667eea" />
            </View>
            <Text style={styles.specializationName}>{item.name}</Text>
            <Text style={styles.specializationDescription}>{item.description}</Text>
        </TouchableOpacity>
    );

    const renderReviewCard: ListRenderItem<ReviewItem> = ({ item }) => (
        <View style={styles.reviewCard}>
            <View style={styles.reviewHeader}>
                <Text style={styles.reviewerName}>{item.patient_name}</Text>
                <View style={styles.reviewStars}>
                    {[...Array(5)].map((_, i) => (
                        <Icon
                            key={i}
                            name="star"
                            size={14}
                            color={i < (item.rating ?? 0) ? '#f6ad55' : '#e2e8f0'}
                        />
                    ))}
                </View>
            </View>
            <Text style={styles.reviewComment}>{item.comment}</Text>
            <View style={styles.reviewFooter}>
                <Text style={styles.reviewClinic}>{item.clinic_name}</Text>
                <Text style={styles.reviewDate}>{item.date}</Text>
            </View>
        </View>
    );

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#667eea" />
            </View>
        );
    }

    return (
        <ScrollView
            style={styles.container}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            showsVerticalScrollIndicator={false}
        >
            {/* Hero Section */}
            <View style={styles.heroSection}>
                <Text style={styles.heroTitle}>
                    Find Trusted Dental Clinics Across Bukidnon
                </Text>
                <Text style={styles.heroDescription}>
                    Search clinics, compare services, view dentists by specialization,
                    and book appointments online with the most reliable dental network.
                </Text>
                <View style={styles.heroButtons}>
                    <TouchableOpacity
                        style={styles.primaryButton}
                        onPress={() => navigation?.navigate?.('Clinics')}
                    >
                        <Text style={styles.primaryButtonText}>Find Clinics</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.secondaryButton}
                        onPress={() => navigation?.navigate?.('Register')}
                    >
                        <Text style={styles.secondaryButtonText}>Register Now</Text>
                    </TouchableOpacity>
                </View>
                <View style={styles.searchContainer}>
                    <Icon name="search-outline" size={20} color="#999" style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search clinics, dentists, or services..."
                        value={searchTerm}
                        onChangeText={setSearchTerm}
                        onSubmitEditing={handleSubmitEditing}
                        returnKeyType="search"
                    />
                    <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
                        <Text style={styles.searchButtonText}>Search</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Stats Section */}
            <View style={styles.statsSection}>
                <View style={styles.statsGrid}>
                    <View style={styles.statItem}>
                        <Text style={styles.statNumber}>{stats.verifiedClinics}+</Text>
                        <Text style={styles.statLabel}>Verified Clinics</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={styles.statNumber}>{stats.totalReviews}+</Text>
                        <Text style={styles.statLabel}>Patient Reviews</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={styles.statNumber}>{stats.totalSpecializations}+</Text>
                        <Text style={styles.statLabel}>Specializations</Text>
                    </View>
                </View>
            </View>

            {/* Featured Clinics */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Featured Clinics</Text>
                    <Text style={styles.sectionSubtitle}>
                        Highly rated dental care centers in your vicinity.
                    </Text>
                </View>
                <FlatList
                    data={featuredClinics}
                    renderItem={renderClinicCard}
                    keyExtractor={(item) => item.id.toString()}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.clinicsList}
                />
            </View>

            {/* Specializations */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Dental Specializations</Text>
                    <Text style={styles.sectionSubtitle}>
                        Whatever your need, we have the right specialist for you.
                    </Text>
                </View>
                <FlatList
                    data={specializations}
                    renderItem={renderSpecializationCard}
                    keyExtractor={(item) => item.id.toString()}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.specializationsList}
                />
            </View>

            {/* Popular Services */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Popular Services</Text>
                    <Text style={styles.sectionSubtitle}>
                        Affordable care with transparent pricing
                    </Text>
                </View>
                {popularServices.map((service) => (
                    <View key={String(service.id)} style={styles.serviceCard}>
                        <Text style={styles.serviceName}>{service.name}</Text>
                        <Text style={styles.serviceDescription}>{service.description}</Text>
                        <Text style={styles.servicePrice}>{service.price_range}</Text>
                    </View>
                ))}
            </View>

            {/* Why Choose Us */}
            <View style={styles.whyUsSection}>
                <Text style={styles.whyUsTitle}>Why Book Through BukidnonDental?</Text>
                <View style={styles.featuresGrid}>
                    <View style={styles.featureCard}>
                        <Icon name="shield-checkmark-outline" size={40} color="#fff" />
                        <Text style={styles.featureTitle}>Verified Clinics</Text>
                        <Text style={styles.featureDescription}>
                            Every clinic undergoes strict verification for license and safety.
                        </Text>
                    </View>
                    <View style={styles.featureCard}>
                        <Icon name="calendar-outline" size={40} color="#fff" />
                        <Text style={styles.featureTitle}>Instant Online Booking</Text>
                        <Text style={styles.featureDescription}>
                            Book your appointment in under 60 seconds.
                        </Text>
                    </View>
                    <View style={styles.featureCard}>
                        <Icon name="notifications-outline" size={40} color="#fff" />
                        <Text style={styles.featureTitle}>Smart Reminders</Text>
                        <Text style={styles.featureDescription}>
                            Get SMS and email reminders before your visit.
                        </Text>
                    </View>
                </View>
            </View>

            {/* Reviews */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>What Patients Say</Text>
                </View>
                <FlatList
                    data={recentReviews}
                    renderItem={renderReviewCard}
                    keyExtractor={(item) => item.id.toString()}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.reviewsList}
                />
            </View>

            {/* CTA Section */}
            <View style={styles.ctaSection}>
                <Text style={styles.ctaTitle}>Ready to Find Your Perfect Dental Clinic?</Text>
                <Text style={styles.ctaDescription}>
                    Join thousands of satisfied patients in Bukidnon who found their trusted
                    dental care provider through our platform.
                </Text>
                <TouchableOpacity
                    style={styles.ctaButton}
                    onPress={() => navigation?.navigate?.('Clinics')}
                >
                    <Text style={styles.ctaButtonText}>Find Clinics Now</Text>
                    <Icon name="arrow-forward" size={20} color="#fff" />
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
    heroSection: {
        backgroundColor: '#667eea',
        padding: 24,
        paddingBottom: 40,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
    },
    heroTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 12,
        textAlign: 'center',
    },
    heroDescription: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.9)',
        textAlign: 'center',
        marginBottom: 20,
        lineHeight: 24,
    },
    heroButtons: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 12,
        marginBottom: 20,
    },
    primaryButton: {
        backgroundColor: '#fff',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 25,
        flex: 1,
        maxWidth: 150,
    },
    primaryButtonText: {
        color: '#667eea',
        fontWeight: 'bold',
        textAlign: 'center',
    },
    secondaryButton: {
        borderWidth: 2,
        borderColor: '#fff',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 25,
        flex: 1,
        maxWidth: 150,
    },
    secondaryButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        textAlign: 'center',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 25,
        paddingHorizontal: 16,
        paddingVertical: 4,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        paddingVertical: 8,
        color: '#2d3748',
    },
    searchButton: {
        backgroundColor: '#667eea',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    searchButtonText: {
        color: '#fff',
        fontWeight: '600',
    },
    statsSection: {
        padding: 20,
        backgroundColor: '#fff',
        marginHorizontal: 16,
        marginTop: -20,
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5,
    },
    statsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    statItem: {
        alignItems: 'center',
    },
    statNumber: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#667eea',
    },
    statLabel: {
        fontSize: 12,
        color: '#718096',
        marginTop: 4,
    },
    section: {
        paddingHorizontal: 16,
        paddingVertical: 24,
    },
    sectionHeader: {
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#2d3748',
    },
    sectionSubtitle: {
        fontSize: 14,
        color: '#718096',
        marginTop: 4,
    },
    clinicsList: {
        paddingRight: 16,
    },
    clinicCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        width: width * 0.8,
        marginRight: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 3,
        position: 'relative',
    },
    verifiedBadge: {
        position: 'absolute',
        top: 12,
        right: 12,
        backgroundColor: '#48bb78',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    verifiedText: {
        color: '#fff',
        fontSize: 10,
        marginLeft: 4,
        fontWeight: '600',
    },
    clinicLogo: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#edf2f7',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    logoImage: {
        width: 60,
        height: 60,
        borderRadius: 30,
    },
    logoPlaceholder: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#667eea',
        justifyContent: 'center',
        alignItems: 'center',
    },
    logoText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
    },
    clinicName: {
        fontSize: 18,
        fontWeight: '600',
        color: '#2d3748',
        marginBottom: 4,
    },
    ratingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
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
    addressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    addressText: {
        fontSize: 12,
        color: '#718096',
        marginLeft: 4,
        flex: 1,
    },
    specializationsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 12,
        gap: 4,
    },
    specializationTag: {
        backgroundColor: '#ebf8ff',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        marginRight: 4,
        marginBottom: 4,
    },
    specializationText: {
        fontSize: 10,
        color: '#2b6cb0',
        fontWeight: '500',
    },
    bookButton: {
        backgroundColor: '#667eea',
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: 'center',
    },
    bookButtonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 14,
    },
    specializationsList: {
        paddingRight: 16,
    },
    specializationCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        width: 200,
        marginRight: 12,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 3,
    },
    specializationIconContainer: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#ebf8ff',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    specializationName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#2d3748',
        textAlign: 'center',
        marginBottom: 4,
    },
    specializationDescription: {
        fontSize: 12,
        color: '#718096',
        textAlign: 'center',
    },
    serviceCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
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
        fontSize: 16,
        fontWeight: '700',
        color: '#667eea',
    },
    whyUsSection: {
        backgroundColor: '#667eea',
        padding: 24,
        marginVertical: 16,
    },
    whyUsTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
        textAlign: 'center',
        marginBottom: 16,
    },
    featuresGrid: {
        gap: 16,
    },
    featureCard: {
        alignItems: 'center',
        padding: 16,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 12,
    },
    featureTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#fff',
        marginTop: 8,
        textAlign: 'center',
    },
    featureDescription: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.9)',
        textAlign: 'center',
        marginTop: 4,
    },
    reviewsList: {
        paddingRight: 16,
    },
    reviewCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        width: width * 0.75,
        marginRight: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 3,
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
        marginBottom: 8,
    },
    reviewFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    reviewClinic: {
        fontSize: 12,
        color: '#667eea',
        fontWeight: '500',
    },
    reviewDate: {
        fontSize: 12,
        color: '#a0aec0',
    },
    ctaSection: {
        padding: 24,
        backgroundColor: '#2d3748',
        marginTop: 16,
        alignItems: 'center',
    },
    ctaTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#fff',
        textAlign: 'center',
        marginBottom: 8,
    },
    ctaDescription: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.8)',
        textAlign: 'center',
        marginBottom: 20,
        lineHeight: 20,
    },
    ctaButton: {
        backgroundColor: '#667eea',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 32,
        paddingVertical: 14,
        borderRadius: 25,
        gap: 8,
    },
    ctaButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default HomeScreen;