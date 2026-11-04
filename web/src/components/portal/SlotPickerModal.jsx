import { Modal, Field, FormError } from './PortalUi';
import BookingSchedulePicker from '../patient/BookingSchedulePicker';
import { LoadingState } from '../StatusMessage';
import { useScheduleSelection } from '../../hooks/useScheduleSelection';
import { getErrorMessage } from '../../services/apiErrors';
import { useState } from 'react';

/**
 * Picks an open slot for a clinic/dentist/service from live availability
 * (same rules the server applies when saving). onConfirm(slot, reason).
 */
function SlotPickerModal({ title, clinicId, dentistId, serviceRateId, askReason = false, confirmLabel = 'Save', isSaving, error, onConfirm, onClose }) {
  const schedule = useScheduleSelection({ clinicId, dentistId, serviceRateId });
  const [reason, setReason] = useState('');

  return (
    <Modal title={title} onClose={onClose} wide>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onConfirm(schedule.selectedSlot, reason.trim());
        }}
      >
        {schedule.isLoadingDates ? (
          <LoadingState label="Checking the schedule…" />
        ) : (
          <BookingSchedulePicker
            dates={schedule.dates}
            isDateOpen={schedule.isDateOpen}
            timeSlots={schedule.timeSlots}
            selectedDateKey={schedule.dateKey}
            selectedTime={schedule.time}
            onDateSelect={schedule.selectDate}
            onTimeSelect={schedule.selectTime}
            isLoadingSlots={schedule.isLoadingSlots}
            slotsMessage={
              schedule.datesError || schedule.slotsError
                ? `${getErrorMessage(schedule.datesError || schedule.slotsError)} (Online availability needs the clinic to be published.)`
                : ''
            }
          />
        )}
        {askReason && (
          <Field label="Reason (shared with the patient)" as="textarea" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} className="portal-spaced-top" />
        )}
        <FormError error={error} />
        <div className="portal-form-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={!schedule.isComplete || isSaving}>
            {isSaving ? 'Saving…' : confirmLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default SlotPickerModal;
