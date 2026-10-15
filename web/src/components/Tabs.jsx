import { useRef } from 'react';
import Icon from './Icon';
import './Tabs.css';

// Accessible tab list. tabs: [{ id, label, icon? }]. variant: underline | pill.
// The panel itself is rendered by the parent with id `${idPrefix}-panel-${activeId}` and
// aria-labelledby `${idPrefix}-tab-${activeId}`.
// Left/Right/Home/End move between tabs.
function Tabs({ tabs, activeId, onChange, idPrefix, label, variant = 'underline' }) {
  const tabRefs = useRef({});

  const focusTab = (index) => {
    const tab = tabs[(index + tabs.length) % tabs.length];
    onChange(tab.id);
    tabRefs.current[tab.id]?.focus();
  };

  const handleKeyDown = (event, index) => {
    const moves = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: tabs.length - 1,
    };
    if (event.key in moves) {
      event.preventDefault();
      focusTab(moves[event.key]);
    }
  };

  return (
    <div className={`tabs tabs--${variant}`} role="tablist" aria-label={label}>
      {tabs.map(({ id, label: tabLabel, icon }, index) => {
        const isActive = id === activeId;
        return (
          <button
            key={id}
            ref={(node) => {
              tabRefs.current[id] = node;
            }}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${id}`}
            aria-selected={isActive}
            aria-controls={`${idPrefix}-panel-${id}`}
            tabIndex={isActive ? 0 : -1}
            className={`tabs-tab${isActive ? ' is-active' : ''}`}
            onClick={() => onChange(id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            {icon && <Icon name={icon} size={16} />}
            {tabLabel}
          </button>
        );
      })}
    </div>
  );
}

export default Tabs;
