import { WEEKDAY_NAMES } from '../../utils/dateTime';
import { Checkbox } from './PortalUi';

/**
 * Seven rows (Monday first) with an "open" checkbox and start/end times.
 * value: { [dayOfWeek]: { start: 'HH:MM', end: 'HH:MM' } }; missing = closed.
 */
const ORDER = [1, 2, 3, 4, 5, 6, 0];

function WeeklyHoursEditor({ value, onChange, idPrefix }) {
  const setDay = (day, next) => {
    const copy = { ...value };
    if (next) copy[day] = next;
    else delete copy[day];
    onChange(copy);
  };

  return (
    <div className="portal-table-wrap">
      <table className="portal-table">
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Open</th>
            <th scope="col">From</th>
            <th scope="col">To</th>
          </tr>
        </thead>
        <tbody>
          {ORDER.map((day) => {
            const hours = value[day];
            return (
              <tr key={day}>
                <th scope="row">{WEEKDAY_NAMES[day]}</th>
                <td>
                  <Checkbox
                    label={<span className="visually-hidden">Open on {WEEKDAY_NAMES[day]}</span>}
                    checked={Boolean(hours)}
                    onChange={(e) => setDay(day, e.target.checked ? { start: '08:00', end: '17:00' } : null)}
                  />
                </td>
                <td>
                  <input
                    id={`${idPrefix}-${day}-start`}
                    aria-label={`${WEEKDAY_NAMES[day]} from`}
                    className="portal-field-control"
                    type="time"
                    disabled={!hours}
                    value={hours?.start ?? ''}
                    onChange={(e) => setDay(day, { ...hours, start: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    id={`${idPrefix}-${day}-end`}
                    aria-label={`${WEEKDAY_NAMES[day]} to`}
                    className="portal-field-control"
                    type="time"
                    disabled={!hours}
                    value={hours?.end ?? ''}
                    onChange={(e) => setDay(day, { ...hours, end: e.target.value })}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default WeeklyHoursEditor;
