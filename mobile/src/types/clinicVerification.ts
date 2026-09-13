export type DocumentType = 'business_permit' | 'doh_license' | 'prc_id' | 'bir_registration';

export interface DocumentUpload {
  name: string;
  uri: string;
  type: string;
  size: number;
}

export interface ClinicRequirementsData {
  clinicName: string;
  documents: Record<DocumentType, DocumentUpload | null>;
}

export const buildClinicVerificationFormData = (data: ClinicRequirementsData): FormData => {
  const formData = new FormData();
  formData.append('clinic_name', data.clinicName);

  Object.entries(data.documents).forEach(([key, doc]) => {
    if (doc) {
      formData.append(key, {
        uri: doc.uri,
        type: doc.type,
        name: doc.name,
      } as any);
    }
  });

  return formData;
};
