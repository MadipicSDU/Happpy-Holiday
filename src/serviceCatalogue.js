export const serviceCategories = [
  ['FoodPreparation', 'Catering & drinks'], ['EquipmentRental', 'Equipment & AV'],
  ['Decoration', 'Decor & flowers'], ['Entertainment', 'Music & entertainment'],
  ['Photography', 'Photography & video'], ['EventPlanning', 'Planning & coordination'],
  ['Staffing', 'Event staff'], ['Transport', 'Transport & transfers'],
  ['Security', 'Security & guest support'], ['Cleaning', 'Cleaning & setup'],
  ['Other', 'Other services'],
];
export const serviceCategoryName = value => serviceCategories.find(([key]) => key === value)?.[1] || value;
export function filterServices(services, { search = '', category = '', sort = 'name', selectedOnly = false, quantities = {} } = {}) {
  const query = search.trim().toLocaleLowerCase();
  return services.filter(service => (!category || service.category === category)
    && (!selectedOnly || Object.hasOwn(quantities, service.id))
    && `${service.name} ${service.description || ''} ${serviceCategoryName(service.category)}`.toLocaleLowerCase().includes(query))
    .sort((a, b) => {
      const names = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
      if (sort === 'price-asc') return a.price - b.price || names;
      if (sort === 'price-desc') return b.price - a.price || names;
      if (sort === 'category') return serviceCategoryName(a.category).localeCompare(serviceCategoryName(b.category)) || names;
      return names;
    });
}
