import Icon from '../Icon';

/**
 * Editable list of same-shaped entries (allergies, medications...). `fields` describes each
 * input: { key, label, placeholder?, options?: [{ value, label }], wide? }. Each row is an
 * object; `emptyRow` is what Add appends.
 */
function RepeatableRows({ title, addLabel, rows, fields, emptyRow, onChange, idPrefix }) {
  const update = (index, key, value) =>
    onChange(rows.map((row, position) => (position === index ? { ...row, [key]: value } : row)));

  return (
    <fieldset className="repeatable">
      <legend className="repeatable-title">{title}</legend>
      {rows.map((row, index) => (
        <div key={index} className="repeatable-row">
          {fields.map(({ key, label, placeholder, options, wide }) => {
            const id = `${idPrefix}-${index}-${key}`;
            return (
              <div key={key} className={`repeatable-field${wide ? ' is-wide' : ''}`}>
                <label htmlFor={id}>{label}</label>
                {options ? (
                  <select id={id} value={row[key] ?? ''} onChange={(event) => update(index, key, event.target.value)}>
                    {options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input id={id} value={row[key] ?? ''} placeholder={placeholder} onChange={(event) => update(index, key, event.target.value)} />
                )}
              </div>
            );
          })}
          <button
            type="button"
            className="repeatable-remove"
            aria-label={`Remove ${title} ${index + 1}`}
            onClick={() => onChange(rows.filter((_, position) => position !== index))}
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      ))}
      <button type="button" className="repeatable-add" onClick={() => onChange([...rows, { ...emptyRow }])}>
        <Icon name="plus" size={16} />
        {addLabel}
      </button>
    </fieldset>
  );
}

export default RepeatableRows;
