import Icon from '../Icon';
import './NotificationCard.css';

const ICON_BY_TYPE = {
  reminder: 'bell',
  confirmed: 'checkCircle',
  message: 'messageSquare',
};

// type: reminder | confirmed | message
function NotificationCard({ notification }) {
  const { type, title, message, time, unread } = notification;

  return (
    <article className={`notification-card${unread ? ' is-unread' : ''}`}>
      <span className={`notification-card-icon notification-card-icon--${type}`}>
        <Icon name={ICON_BY_TYPE[type] ?? 'bell'} size={18} />
      </span>
      <div className="notification-card-body">
        <h2 className="notification-card-title">
          {title}
          {unread && <span className="visually-hidden"> (unread)</span>}
        </h2>
        <p className="notification-card-message">{message}</p>
        <p className="notification-card-time">{time}</p>
      </div>
      {unread && <span className="notification-card-dot" aria-hidden="true" />}
    </article>
  );
}

export default NotificationCard;
