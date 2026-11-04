import { useEffect, useId, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Icon from '../Icon';
import { PHOTO_MAX_BYTES, PHOTO_TYPES } from '../../config/profile';
import { getErrorMessage } from '../../services/apiErrors';
import { getProfilePhoto, uploadProfilePhoto } from '../../services/patientApi';
import { PATIENT_PROFILE_KEY } from '../../pages/profileKeys';
import './ProfileAvatar.css';

export const checkPhoto = (file) => {
  if (!PHOTO_TYPES.includes(file.type)) return 'Choose a JPG, PNG or WebP image.';
  if (file.size > PHOTO_MAX_BYTES) return 'Choose an image smaller than 2 MB.';
  return '';
};

// The photo is private, so it is fetched with the session rather than from a public URL.
function usePhotoUrl(version) {
  const photo = useQuery({
    queryKey: ['patient', 'photo', version],
    queryFn: getProfilePhoto,
    enabled: Boolean(version),
    staleTime: Infinity,
  });
  const [url, setUrl] = useState(null);

  useEffect(() => {
    if (!photo.data) return undefined;
    const objectUrl = URL.createObjectURL(photo.data);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [photo.data]);

  return version ? url : null;
}

/**
 * Square avatar with the initial, or the patient's photo. `action` chooses how a new photo
 * is offered: the camera badge (My Profile) or an "Upload new photo" link (Edit Profile).
 */
function ProfileAvatar({ name, photoVersion, action = 'badge' }) {
  const inputId = useId();
  const queryClient = useQueryClient();
  const url = usePhotoUrl(photoVersion);
  const [problem, setProblem] = useState('');

  const upload = useMutation({
    mutationFn: uploadProfilePhoto,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PATIENT_PROFILE_KEY }),
  });

  const handleFile = (event) => {
    const file = event.target.files?.[0];
    // Choosing the same file again must still fire a change event.
    event.target.value = '';
    if (!file) return;
    const issue = checkPhoto(file);
    setProblem(issue);
    if (!issue) upload.mutate(file);
  };

  const message = problem || (upload.isError ? getErrorMessage(upload.error) : '');

  return (
    <div className={`profile-avatar-wrap is-${action}`}>
      <div className="profile-avatar">
        {url ? <img src={url} alt="" /> : <span aria-hidden="true">{name.charAt(0).toUpperCase()}</span>}
        <input
          id={inputId}
          type="file"
          accept={PHOTO_TYPES.join(',')}
          className="visually-hidden"
          onChange={handleFile}
          disabled={upload.isPending}
          aria-label="Upload new photo"
        />
        {action === 'badge' && (
          <label htmlFor={inputId} className="profile-avatar-badge" title="Upload new photo">
            <Icon name="camera" size={15} />
          </label>
        )}
      </div>
      {action === 'link' && (
        <div>
          <p className="profile-avatar-title">Profile Photo</p>
          <label htmlFor={inputId} className="profile-avatar-link">
            <Icon name="camera" size={15} />
            {upload.isPending ? 'Uploading…' : 'Upload new photo'}
          </label>
        </div>
      )}
      {message && (
        <p className="profile-avatar-error" role="alert">
          {message}
        </p>
      )}
    </div>
  );
}

export default ProfileAvatar;
