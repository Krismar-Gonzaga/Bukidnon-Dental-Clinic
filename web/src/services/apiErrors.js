// Helpers for reading Laravel API error responses, which look like
// { success: false, message } or { success: false, errors: { field: [msg] } }.

const NETWORK_ERROR =
  'Cannot reach the server. Check your connection and try again.';
const GENERIC_ERROR = 'Something went wrong. Please try again.';

// Validation errors keyed by backend field name, first message only.
export function getFieldErrors(error) {
  const errors = error?.response?.data?.errors ?? {};
  return Object.fromEntries(
    Object.entries(errors).map(([field, messages]) => [
      field,
      Array.isArray(messages) ? messages[0] : String(messages),
    ])
  );
}

// One user-facing sentence describing the failure.
export function getErrorMessage(error) {
  // Stopped on this device (e.g. a password confirmation was cancelled).
  if (error?.isCancelled) {
    return error.message;
  }
  if (!error?.response) {
    return NETWORK_ERROR;
  }
  const message = error.response.data?.message;
  if (message) {
    return message;
  }
  const [firstFieldError] = Object.values(getFieldErrors(error));
  return firstFieldError ?? GENERIC_ERROR;
}
