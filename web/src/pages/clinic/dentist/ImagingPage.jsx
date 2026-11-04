import { useEffect, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import ClinicLayout, { useClinicAccess } from '../../../layouts/ClinicLayout';
import Icon from '../../../components/Icon';
import { TableFooter } from '../../../components/admin/AdminData';
import { FilterSelect } from '../../../components/clinic/ClinicUi';
import { Field, FormError, Modal } from '../../../components/portal/PortalUi';
import { LoadingState, QueryState } from '../../../components/StatusMessage';
import { downloadPatientFile } from '../../../services/clinicPortalApi';
import { getClinicFiles, getFileViewUrl, getPatientFileList, uploadClinicalFile } from '../../../services/dentistApi';
import { formatDate } from '../../../utils/dateTime';
import { FILE_CATEGORIES, fileSize, fileTitle, isImageFile, PatientSelect, usePatientOptions } from './dentistUi';
import '../../../components/clinic/ClinicAdminUi.css';
import './Dentist.css';

const PAGE_SIZE = 30;
const fileIcon = (file) => (isImageFile(file) ? 'camera' : 'fileText');

function ViewModal({ clinicId, file, patientId, patientName, onClose, onDownload }) {
  const link = useQuery({
    queryKey: ['clinic', clinicId, 'file-link', file.id],
    queryFn: () => getFileViewUrl(clinicId, patientId, file.id),
    enabled: isImageFile(file),
    staleTime: 0,
    gcTime: 0,
  });
  return (
    <Modal title={fileTitle(file)} onClose={onClose}>
      <div className="dentist-file-preview">
        {isImageFile(file) && link.isPending && <LoadingState label="Loading image…" />}
        {isImageFile(file) && link.data ? <img src={link.data} alt={fileTitle(file)} /> : !isImageFile(file) && <Icon name={fileIcon(file)} size={56} />}
      </div>
      <FormError error={link.error} />
      {patientName && <p className="dentist-snapshot-line"><strong>Patient:</strong> {patientName}</p>}
      <p className="dentist-snapshot-line"><strong>Date:</strong> {formatDate(file.uploaded_at)}</p>
      <p className="dentist-snapshot-line" style={{ overflowWrap: 'anywhere' }}><strong>File:</strong> {file.name}</p>
      {file.notes && <p className="dentist-snapshot-line"><strong>Notes:</strong> {file.notes}</p>}
      <div className="portal-form-actions">
        <button type="button" className="btn btn-primary" onClick={onDownload}>
          <Icon name="download" size={18} />
          Download
        </button>
        <button type="button" className="btn btn-outline" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
}

function FileCard({ file, patientName, onView, onDownload }) {
  return (
    <article className="dentist-file">
      <div className="dentist-file-thumb" aria-hidden="true">
        <Icon name={fileIcon(file)} size={32} />
      </div>
      <div className="dentist-file-body">
        <div className="dentist-file-head">
          <p className="dentist-row-title" style={{ fontSize: '0.875rem' }}>{fileTitle(file)}</p>
          <span className="dentist-file-size">{fileSize(file.size)}</span>
        </div>
        {patientName && <p className="dentist-row-sub">{patientName}</p>}
        <p className="dentist-muted">{formatDate(file.uploaded_at)}</p>
        {file.notes && <p className="dentist-row-sub" style={{ fontSize: '0.75rem' }}>{file.notes}</p>}
        <div className="dentist-file-foot">
          <button type="button" className="dentist-link" aria-label={`View ${fileTitle(file)}`} onClick={onView}>
            <Icon name="eye" size={15} />
            View
          </button>
          <button type="button" className="dentist-link is-plain" aria-label={`Download ${fileTitle(file)}`} onClick={onDownload}>
            <Icon name="download" size={15} />
            Download
          </button>
        </div>
      </div>
    </article>
  );
}

function useFileActions(clinicId) {
  const [viewing, setViewing] = useState(null);
  const download = useMutation({ mutationFn: ({ file, patientId }) => downloadPatientFile(clinicId, patientId, file) });
  return { viewing, setViewing, download };
}

/** One patient's files, for their profile. */
export function FileGallery({ clinicId, patientId }) {
  const query = useQuery({ queryKey: ['clinic', clinicId, 'files', 'patient', patientId], queryFn: () => getPatientFileList(clinicId, patientId) });
  const { viewing, setViewing, download } = useFileActions(clinicId);
  return (
    <QueryState query={query} loadingLabel="Loading files…">
      {(files) =>
        files.length === 0 ? (
          <p className="clinic-admin-card-sub">No images or files yet.</p>
        ) : (
          <>
            <FormError error={download.error} />
            <div className="dentist-file-grid is-two">
              {files.map((file) => (
                <FileCard key={file.id} file={file} onView={() => setViewing(file)} onDownload={() => download.mutate({ file, patientId })} />
              ))}
            </div>
            {viewing && <ViewModal clinicId={clinicId} file={viewing} patientId={patientId} onClose={() => setViewing(null)} onDownload={() => download.mutate({ file: viewing, patientId })} />}
          </>
        )
      }
    </QueryState>
  );
}

function UploadModal({ clinicId, initialPatient, onClose }) {
  const queryClient = useQueryClient();
  const [patientId, setPatientId] = useState(initialPatient ?? '');
  const [category, setCategory] = useState(FILE_CATEGORIES[0].value);
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState(null);
  const upload = useMutation({
    mutationFn: () => uploadClinicalFile(clinicId, patientId, { file, category, notes: notes.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinic', clinicId, 'files'] });
      onClose();
    },
  });
  return (
    <Modal title="Upload File" onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          upload.mutate();
        }}
      >
        <PatientSelect clinicId={clinicId} value={patientId} onChange={setPatientId} />
        <Field label="Type" as="select" value={category} onChange={(event) => setCategory(event.target.value)} options={FILE_CATEGORIES} />
        <Field label="File" type="file" required accept=".pdf,.jpg,.jpeg,.png,.webp" hint="PDF, JPG, PNG or WEBP, up to 10 MB." onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        <Field label="Notes" as="textarea" rows={2} maxLength={500} value={notes} onChange={(event) => setNotes(event.target.value)} />
        <FormError error={upload.error} />
        <div className="portal-form-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={!patientId || !file || upload.isPending}>
            {upload.isPending ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Imaging & Attachments: files across this dentist's patients. Every view is logged. */
function ImagingPage() {
  const { clinicId, can } = useClinicAccess();
  const [params] = useSearchParams();
  const [patient, setPatient] = useState(params.get('patient') ?? '');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [isUploading, setIsUploading] = useState(false);
  const { patients } = usePatientOptions(clinicId);
  const { viewing, setViewing, download } = useFileActions(clinicId);
  const query = useQuery({
    queryKey: ['clinic', clinicId, 'files', patient, category, page],
    queryFn: () => getClinicFiles(clinicId, { patient_id: patient || undefined, category: category || undefined, page, per_page: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });
  const total = query.data?.meta?.total;
  useEffect(() => setPage(1), [patient, category]);

  return (
    <ClinicLayout
      section="imaging"
      title="Imaging & Attachments"
      subtitle={total != null ? `${total} ${total === 1 ? 'file' : 'files'}` : null}
      requires={['records.view']}
      hideSearch
      headerActions={
        can('records.write') && (
          <button type="button" className="btn btn-primary clinic-header-button" onClick={() => setIsUploading(true)}>
            <Icon name="upload" size={18} />
            Upload File
          </button>
        )
      }
    >
      <div className="dentist-toolbar">
        <FilterSelect label="Filter by patient" value={patient} onChange={setPatient} options={[{ value: '', label: 'All Patients' }, ...patients.map((p) => ({ value: String(p.id), label: p.name }))]} />
        <FilterSelect label="Filter by type" value={category} onChange={setCategory} options={[{ value: '', label: 'All' }, ...FILE_CATEGORIES]} />
        {total != null && <span className="dentist-count">{total} {total === 1 ? 'file' : 'files'}</span>}
      </div>
      <FormError error={download.error} />
      <QueryState query={query} loadingLabel="Loading files…">
        {({ items, meta }) =>
          items.length === 0 ? (
            <p className="portal-empty">{patient || category ? 'No files match these filters.' : 'No images or files yet.'}</p>
          ) : (
            <>
              <div className="dentist-file-grid">
                {items.map((file) => (
                  <FileCard key={file.id} file={file} patientName={file.patient?.name} onView={() => setViewing(file)} onDownload={() => download.mutate({ file, patientId: file.patient?.id })} />
                ))}
              </div>
              <TableFooter meta={meta} perPage={PAGE_SIZE} onPageChange={setPage} noun="files" label="File pages" />
            </>
          )
        }
      </QueryState>
      {viewing && (
        <ViewModal
          clinicId={clinicId}
          file={viewing}
          patientId={viewing.patient?.id}
          patientName={viewing.patient?.name}
          onClose={() => setViewing(null)}
          onDownload={() => download.mutate({ file: viewing, patientId: viewing.patient?.id })}
        />
      )}
      {isUploading && <UploadModal clinicId={clinicId} initialPatient={patient} onClose={() => setIsUploading(false)} />}
    </ClinicLayout>
  );
}

export default ImagingPage;
