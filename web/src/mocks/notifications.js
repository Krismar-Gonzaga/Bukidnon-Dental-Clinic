// MOCK patient notifications from the Figma sample, newest first. Not real
// data; there is no notifications endpoint yet.
// type: reminder | confirmed | message (sets the icon and its color)
export const MOCK_NOTIFICATIONS = [
  {
    id: 'n-1',
    type: 'reminder',
    title: 'Appointment Reminder',
    message: 'You have an appointment tomorrow with Dr. Maria Braganza at 10:00 AM.',
    time: '2 hours ago',
    unread: true,
  },
  {
    id: 'n-2',
    type: 'confirmed',
    title: 'Booking Confirmed',
    message: 'Your appointment at Braganza Dental Clinic on July 22 has been confirmed.',
    time: '1 day ago',
    unread: true,
  },
  {
    id: 'n-3',
    type: 'message',
    title: 'New Review Request',
    message: 'How was your visit to Valencia Smile Center? Share your feedback now.',
    time: '3 days ago',
    unread: false,
  },
  {
    id: 'n-4',
    type: 'message',
    title: 'Profile Updated',
    message: 'Your profile information has been successfully updated.',
    time: '1 week ago',
    unread: false,
  },
  {
    id: 'n-5',
    type: 'reminder',
    title: 'Upcoming Appointment',
    message: 'Reminder: You have an appointment at Braganza Dental Clinic in 3 days.',
    time: '1 week ago',
    unread: false,
  },
];
