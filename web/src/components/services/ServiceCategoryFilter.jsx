import './ServiceCategoryFilter.css';

// Category toggle buttons; the page owns the selected category.
function ServiceCategoryFilter({ categories, selected, onSelect }) {
  return (
    <div
      className="service-categories"
      role="group"
      aria-label="Filter services by category"
    >
      {categories.map((category) => {
        const isSelected = category === selected;
        return (
          <button
            key={category}
            type="button"
            className={`service-category${isSelected ? ' is-selected' : ''}`}
            aria-pressed={isSelected}
            onClick={() => onSelect(category)}
          >
            {category}
          </button>
        );
      })}
    </div>
  );
}

export default ServiceCategoryFilter;
