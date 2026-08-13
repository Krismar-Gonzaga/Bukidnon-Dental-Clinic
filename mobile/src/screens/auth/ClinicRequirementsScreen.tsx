// src/screens/auth/ClinicRequirementsScreen.tsx
import React, { useState, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    Platform,
    TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import * as DocumentPicker from 'expo-document-picker';
import { clinicVerificationService } from '../../services/api';
import {
    DocumentType,
    DocumentUpload,
    ClinicRequirementsData,
    buildClinicVerificationFormData,
} from '../../types/clinicVerification';

interface ClinicRequirementsScreenProps {
    navigation: any;
    route?: {
        params?: {
            // When true, this screen is step 1 of the clinic_admin sign-up flow (no
            // account/token exists yet), so documents are collected locally and handed
            // back to RegisterScreen instead of being uploaded here.
            fromRegister?: boolean;
            prefill?: Record<string, unknown>;
            existing?: ClinicRequirementsData;
        };
    };
}

const ClinicRequirementsScreen = ({ navigation, route }: ClinicRequirementsScreenProps) => {
    const params = route?.params ?? {};
    const fromRegister = !!params.fromRegister;

    const [submitting, setSubmitting] = useState(false);
    const [clinicName, setClinicName] = useState(params.existing?.clinicName ?? '');
    const [documents, setDocuments] = useState<Record<DocumentType, DocumentUpload | null>>(
        params.existing?.documents ?? {
            business_permit: null,
            doh_license: null,
            prc_id: null,
            bir_registration: null,
        }
    );
    const [errors, setErrors] = useState<Record<string, string>>({});

    const documentConfigs: Record<DocumentType, { label: string; icon: string; description: string }> = {
        business_permit: {
            label: 'Business Permit',
            icon: 'business-outline',
            description: "Current Mayor's or Business Permit for the clinic location.",
        },
        doh_license: {
            label: 'DOH License to Operate',
            icon: 'medical-outline',
            description: 'Department of Health accreditation certificate for dental services.',
        },
        prc_id: {
            label: 'PRC ID of Head Dentist',
            icon: 'id-card-outline',
            description: 'Valid professional ID card. Ensure both sides are visible if possible.',
        },
        bir_registration: {
            label: 'BIR Registration (Form 2303)',
            icon: 'business-outline',
            description: 'Certificate of Registration for tax purposes (Form 2303).',
        },
    };

    const pickDocument = async (type: DocumentType) => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'],
                copyToCacheDirectory: true,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const asset = result.assets[0];
                setDocuments(prev => ({
                    ...prev,
                    [type]: {
                        name: asset.name,
                        uri: asset.uri,
                        type: asset.mimeType || 'application/pdf',
                        size: asset.size || 0,
                    }
                }));
                if (errors[type]) {
                    setErrors(prev => ({ ...prev, [type]: '' }));
                }
            }
        } catch (error) {
            console.error('Error picking document:', error);
            Alert.alert('Error', 'Failed to pick document. Please try again.');
        }
    };

    const removeDocument = (type: DocumentType) => {
        setDocuments(prev => ({ ...prev, [type]: null }));
    };

    const validateForm = () => {
        const newErrors: Record<string, string> = {};

        if (!clinicName.trim()) {
            newErrors.clinic_name = 'Clinic name is required';
        }

        Object.keys(documentConfigs).forEach((key) => {
            const docType = key as DocumentType;
            if (!documents[docType]) {
                newErrors[docType] = `${documentConfigs[docType].label} is required`;
            }
        });

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async () => {
        if (!validateForm()) {
            return;
        }

        // Step 1 of sign-up: no account/token exists yet, so hand the collected
        // requirements back to RegisterScreen instead of calling the (auth-protected) API.
        if (fromRegister) {
            navigation.navigate('Register', {
                role: 'clinic_admin',
                prefill: params.prefill,
                clinicRequirements: { clinicName, documents },
            });
            return;
        }

        setSubmitting(true);

        try {
            const response = await clinicVerificationService.submitVerification(
                buildClinicVerificationFormData({ clinicName, documents })
            );

            if (response.data.success) {
                Alert.alert(
                    'Submission Successful',
                    'Your documents have been submitted successfully! We will notify you once the verification process is complete.',
                    [
                        {
                            text: 'OK',
                            onPress: () => navigation.navigate('Home'),
                        },
                    ]
                );
            }
        } catch (error: any) {
            console.error('Submission error:', error);
            const message = error.response?.data?.message || 'Failed to submit verification. Please try again.';
            Alert.alert('Submission Failed', message);
        } finally {
            setSubmitting(false);
        }
    };

    const renderDocumentUpload = (type: DocumentType) => {
        const config = documentConfigs[type];
        const doc = documents[type];
        const hasError = !!errors[type];

        return (
            <View style={[styles.uploadCard, hasError && styles.uploadCardError]}>
                <View style={styles.uploadHeader}>
                    <View style={styles.uploadIconContainer}>
                        <Icon name={config.icon as any} size={24} color="#003f87" />
                    </View>
                    <View style={styles.requiredBadge}>
                        <Text style={styles.requiredBadgeText}>Required</Text>
                    </View>
                </View>

                <Text style={styles.uploadTitle}>{config.label}</Text>
                <Text style={styles.uploadDescription}>{config.description}</Text>

                {doc ? (
                    <View style={styles.uploadedFileContainer}>
                        <View style={styles.uploadedFileInfo}>
                            <Icon name="document-text-outline" size={20} color="#006c4f" />
                            <Text style={styles.uploadedFileName} numberOfLines={1}>
                                {doc.name}
                            </Text>
                            <Text style={styles.uploadedFileSize}>
                                {(doc.size / 1024).toFixed(1)} KB
                            </Text>
                        </View>
                        <TouchableOpacity
                            style={styles.removeFileButton}
                            onPress={() => removeDocument(type)}
                        >
                            <Icon name="close-circle" size={20} color="#ba1a1a" />
                        </TouchableOpacity>
                    </View>
                ) : (
                    <TouchableOpacity
                        style={styles.uploadDropZone}
                        onPress={() => pickDocument(type)}
                        activeOpacity={0.7}
                    >
                        <Icon name="cloud-upload-outline" size={32} color="#727784" />
                        <Text style={styles.uploadDropZoneText}>Upload PDF or JPG</Text>
                    </TouchableOpacity>
                )}

                {hasError && <Text style={styles.errorText}>{errors[type]}</Text>}
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <Icon name="arrow-back" size={24} color="#003f87" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>BukidnonDental</Text>
                <View style={styles.headerRight} />
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Hero Section */}
                <View style={styles.heroSection}>
                    <View style={styles.heroOverlay}>
                        <Text style={styles.heroTitle}>Clinic Requirements</Text>
                        <Text style={styles.heroSubtitle}>
                            Please upload the following official documents to verify your practice.
                        </Text>
                    </View>
                </View>

                {/* Form Content */}
                <View style={styles.contentContainer}>
                    {/* Step Indicator */}
                    <View style={styles.stepIndicator}>
                        <Text style={styles.stepText}>
                            {fromRegister ? 'Step 1 of 2: Clinic Documents' : 'Verification Documents'}
                        </Text>
                        <View style={styles.progressBar}>
                            <View style={[styles.progressFill, { width: fromRegister ? '50%' : '100%' }]} />
                        </View>
                    </View>

                    {/* Clinic Name Input */}
                    <View style={styles.inputWrapper}>
                        <Text style={styles.inputLabel}>Clinic Name</Text>
                        <View style={[styles.inputContainer, errors.clinic_name && styles.inputError]}>
                            <Icon name="business-outline" size={20} color="#727784" style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Enter your clinic name"
                                placeholderTextColor="#a0aec0"
                                value={clinicName}
                                onChangeText={(text) => {
                                    setClinicName(text);
                                    if (errors.clinic_name) {
                                        setErrors(prev => ({ ...prev, clinic_name: '' }));
                                    }
                                }}
                            />
                        </View>
                        {errors.clinic_name && <Text style={styles.errorText}>{errors.clinic_name}</Text>}
                    </View>

                    {/* Document Upload Grid */}
                    <View style={styles.gridContainer}>
                        {Object.keys(documentConfigs).map((key) => (
                            <View key={key} style={styles.gridItem}>
                                {renderDocumentUpload(key as DocumentType)}
                            </View>
                        ))}
                    </View>

                    {/* Guidance Note */}
                    <View style={styles.guidanceNote}>
                        <Icon name="information-circle-outline" size={20} color="#006c4f" />
                        <Text style={styles.guidanceText}>
                            Verification typically takes 24-48 business hours. Ensure all documents are clear, uncropped, and currently valid. Expired documents will result in a delay.
                        </Text>
                    </View>

                    {/* Actions */}
                    <View style={styles.actionsContainer}>
                        {!fromRegister && (
                            <TouchableOpacity
                                style={styles.saveProgressButton}
                                onPress={() => Alert.alert('Progress Saved', 'Your progress has been saved.')}
                            >
                                <Text style={styles.saveProgressButtonText}>Save Progress</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
                            onPress={handleSubmit}
                            disabled={submitting}
                            activeOpacity={0.8}
                        >
                            {submitting ? (
                                <ActivityIndicator color="#ffffff" size="small" />
                            ) : fromRegister ? (
                                <>
                                    <Text style={styles.submitButtonText}>Continue to Your Details</Text>
                                    <Icon name="arrow-forward-outline" size={20} color="#ffffff" />
                                </>
                            ) : (
                                <>
                                    <Text style={styles.submitButtonText}>Submit for Verification</Text>
                                    <Icon name="checkmark-circle-outline" size={20} color="#ffffff" />
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>

            {/* Bottom Navigation (Mobile) */}
            <View style={styles.bottomNav}>
                <TouchableOpacity style={styles.bottomNavItem}>
                    <Icon name="help-circle-outline" size={24} color="#727784" />
                    <Text style={styles.bottomNavText}>Help</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.bottomNavItem}>
                    <Icon name="chatbubble-outline" size={24} color="#727784" />
                    <Text style={styles.bottomNavText}>Support</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f7f9ff',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#ffffff',
        borderBottomWidth: 1,
        borderBottomColor: '#c2c6d4',
    },
    backButton: {
        padding: 4,
        width: 40,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#003f87',
        fontFamily: Platform.OS === 'ios' ? 'Inter' : 'sans-serif',
    },
    headerRight: {
        width: 40,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 100,
    },
    heroSection: {
        height: 160,
        backgroundColor: '#003f87',
        position: 'relative',
        overflow: 'hidden',
    },
    heroOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 24,
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    heroTitle: {
        fontSize: 24,
        fontWeight: '600',
        color: '#ffffff',
        fontFamily: Platform.OS === 'ios' ? 'Inter' : 'sans-serif',
        marginBottom: 4,
    },
    heroSubtitle: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.9)',
        fontFamily: Platform.OS === 'ios' ? 'Inter' : 'sans-serif',
    },
    contentContainer: {
        backgroundColor: '#ffffff',
        marginHorizontal: 16,
        marginTop: -20,
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: '#c2c6d4',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 3,
    },
    stepIndicator: {
        marginBottom: 20,
    },
    stepText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#424752',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 8,
        fontFamily: Platform.OS === 'ios' ? 'Inter' : 'sans-serif',
    },
    progressBar: {
        height: 8,
        backgroundColor: '#e0e3e8',
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#003f87',
        borderRadius: 4,
    },
    inputWrapper: {
        marginBottom: 16,
    },
    inputLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#424752',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 4,
        paddingHorizontal: 4,
        fontFamily: Platform.OS === 'ios' ? 'Inter' : 'sans-serif',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#c2c6d4',
        borderRadius: 12,
        paddingHorizontal: 12,
        backgroundColor: '#ffffff',
        minHeight: 48,
    },
    inputError: {
        borderColor: '#ba1a1a',
        borderWidth: 2,
    },
    inputIcon: {
        marginRight: 8,
    },
    input: {
        flex: 1,
        paddingVertical: 12,
        fontSize: 16,
        color: '#181c20',
        fontFamily: Platform.OS === 'ios' ? 'Inter' : 'sans-serif',
    },
    errorText: {
        fontSize: 12,
        color: '#ba1a1a',
        marginTop: 4,
        paddingHorizontal: 4,
        fontFamily: Platform.OS === 'ios' ? 'Inter' : 'sans-serif',
    },
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginHorizontal: -8,
    },
    gridItem: {
        width: '50%',
        paddingHorizontal: 8,
        marginBottom: 16,
    },
    uploadCard: {
        borderWidth: 1,
        borderColor: '#c2c6d4',
        borderRadius: 12,
        padding: 12,
        backgroundColor: '#f1f4f9',
        minHeight: 180,
    },
    uploadCardError: {
        borderColor: '#ba1a1a',
        borderWidth: 2,
    },
    uploadHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    uploadIconContainer: {
        padding: 8,
        backgroundColor: '#d7e2ff',
        borderRadius: 8,
    },
    requiredBadge: {
        backgroundColor: '#e0e3e8',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
    },
    requiredBadgeText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#424752',
        fontFamily: Platform.OS === 'ios' ? 'Inter' : 'sans-serif',
    },
    uploadTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#003f87',
        fontFamily: Platform.OS === 'ios' ? 'Inter' : 'sans-serif',
        marginBottom: 4,
    },
    uploadDescription: {
        fontSize: 12,
        color: '#424752',
        fontFamily: Platform.OS === 'ios' ? 'Inter' : 'sans-serif',
        marginBottom: 12,
        flex: 1,
    },
    uploadDropZone: {
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: '#c2c6d4',
        borderRadius: 8,
        padding: 12,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 80,
    },
    uploadDropZoneText: {
        fontSize: 11,
        fontWeight: '500',
        color: '#424752',
        marginTop: 4,
        fontFamily: Platform.OS === 'ios' ? 'Inter' : 'sans-serif',
    },
    uploadedFileContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#e8f5e9',
        borderRadius: 8,
        padding: 8,
        borderWidth: 1,
        borderColor: '#006c4f',
    },
    uploadedFileInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    uploadedFileName: {
        fontSize: 12,
        color: '#006c4f',
        marginLeft: 8,
        flex: 1,
        fontFamily: Platform.OS === 'ios' ? 'Inter' : 'sans-serif',
    },
    uploadedFileSize: {
        fontSize: 10,
        color: '#727784',
        marginLeft: 8,
        fontFamily: Platform.OS === 'ios' ? 'Inter' : 'sans-serif',
    },
    removeFileButton: {
        padding: 4,
    },
    guidanceNote: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: 12,
        backgroundColor: 'rgba(0,108,79,0.1)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(0,108,79,0.2)',
        marginBottom: 20,
        gap: 8,
    },
    guidanceText: {
        flex: 1,
        fontSize: 13,
        color: '#181c20',
        lineHeight: 18,
        fontFamily: Platform.OS === 'ios' ? 'Inter' : 'sans-serif',
    },
    actionsContainer: {
        flexDirection: 'row',
        gap: 12,
    },
    saveProgressButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#003f87',
        alignItems: 'center',
    },
    saveProgressButtonText: {
        fontSize: 16,
        fontWeight: '500',
        color: '#003f87',
        fontFamily: Platform.OS === 'ios' ? 'Inter' : 'sans-serif',
    },
    submitButton: {
        flex: 2,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: '#003f87',
        gap: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    submitButtonDisabled: {
        opacity: 0.7,
    },
    submitButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#ffffff',
        fontFamily: Platform.OS === 'ios' ? 'Inter' : 'sans-serif',
    },
    bottomNav: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderTopWidth: 1,
        borderTopColor: '#c2c6d4',
        paddingVertical: 8,
        paddingBottom: Platform.OS === 'ios' ? 20 : 8,
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
    },
    bottomNavItem: {
        alignItems: 'center',
        paddingVertical: 4,
    },
    bottomNavText: {
        fontSize: 10,
        color: '#727784',
        marginTop: 2,
        fontFamily: Platform.OS === 'ios' ? 'Inter' : 'sans-serif',
    },
});

export default ClinicRequirementsScreen;