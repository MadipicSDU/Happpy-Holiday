import React, { useState } from 'react';
import { Search, Plus, Minus, Check, Package, Utensils, Music, Camera, Palette, Truck, Shield, Sparkles, Users, CalendarDays, X } from 'lucide-react';
import { money, categoryName } from '../utils';
import { filterServices } from '../serviceCatalogue';
import usePagination from '../usePagination';
import { Pagination, EmptyState } from './UI';

export function ServiceIcon({ category, size = 24 }) {
  const Icon = { FoodPreparation: Utensils, EquipmentRental: Package, Decoration: Palette, Entertainment: Music,
    Photography: Camera, EventPlanning: CalendarDays, Staffing: Users, Transport: Truck, Security: Shield, Cleaning: Sparkles }[category] || Package;
  return <Icon size={size} strokeWidth={1.6} />;
}

export default function ServicePicker({ services, quantities, onChange, guests, disabled }) {
  const [search, setSearch] = useState(''), [category, setCategory] = useState(''), [sort, setSort] = useState('name'), [selectedOnly, setSelectedOnly] = useState(false);
  const categories = [...new Set(services.map(service => service.category))].sort((a, b) => categoryName(a).localeCompare(categoryName(b)));
  const selected = services.filter(service => Object.hasOwn(quantities, service.id));
  const filtered = filterServices(services, { search, category, sort, selectedOnly, quantities });
  const pagination = usePagination(filtered, `${search}|${category}|${sort}|${selectedOnly}`, 6);
  const toggle = service => onChange(previous => {
    const next = { ...previous };
    if (Object.hasOwn(next, service.id)) delete next[service.id];
    else if (Object.keys(next).length < 100) next[service.id] = 1;
    return next;
  });
  const setQuantity = (id, value) => onChange(previous => ({ ...previous, [id]: value }));
  const estimate = selected.reduce((total, service) => total + service.price * (Number(quantities[service.id]) || 0), 0);
  return <section className="service-picker" aria-label="Choose event services">
    <div className="section-heading"><div><h3><span className="step-number">2</span>Make it your occasion</h3><p className="field-help">Add optional services to your package. Rates are per unit; check each description for what one unit includes.</p></div></div>
    <div className="service-discovery"><label className="search-field"><Search size={17} /><input aria-label="Search services" placeholder="Find catering, music, decor…" value={search} onChange={event => setSearch(event.target.value)} disabled={disabled} /></label><label className="service-sort"><span>Sort by</span><select aria-label="Sort booking services" value={sort} disabled={disabled} onChange={event => setSort(event.target.value)}><option value="name">Name: A–Z</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option><option value="category">Category</option></select></label></div>
    <div className="service-category-chips" role="group" aria-label="Service categories"><button type="button" className={!category ? 'selected' : ''} aria-pressed={!category} disabled={disabled} onClick={() => setCategory('')}>All services <span>{services.length}</span></button>{categories.map(value => <button key={value} type="button" className={category === value ? 'selected' : ''} aria-pressed={category === value} disabled={disabled} onClick={() => setCategory(value)}>{categoryName(value)}<span>{services.filter(service => service.category === value).length}</span></button>)}</div>
    <div className="service-results"><span className="small muted" role="status">{filtered.length} {filtered.length === 1 ? 'service' : 'services'} found</span><button type="button" className="text-button" aria-pressed={selectedOnly} disabled={disabled} onClick={() => setSelectedOnly(!selectedOnly)}>{selectedOnly ? 'Show all services' : `Selected only (${selected.length})`}</button></div>
    <div className="service-card-grid">{pagination.items.map(service => {
      const isSelected = Object.hasOwn(quantities, service.id);
      return <article key={service.id} className={`service-tile ${isSelected ? 'is-selected' : ''}`}><div className={`service-tile-art service-art-${service.category}`}><ServiceIcon category={service.category} /><span>{categoryName(service.category)}</span>{isSelected && <span className="service-selected-mark"><Check size={15} />Selected</span>}</div><div className="service-tile-body"><h4>{service.name}</h4><p>{service.description || 'Add this service to your event package. Ask your manager about what each unit includes.'}</p><div className="service-tile-bottom"><div><strong>{money(service.price)}</strong><span>per unit</span></div><button type="button" className={`button ${isSelected ? 'secondary' : 'primary'} small-button`} aria-pressed={isSelected} aria-label={`${isSelected ? 'Remove' : 'Add'} ${service.name}`} disabled={disabled || (!isSelected && selected.length >= 100)} onClick={() => toggle(service)}>{isSelected ? <Check size={15} /> : <Plus size={15} />}{isSelected ? 'Added' : 'Add'}</button></div></div></article>;
    })}</div>
    <Pagination pagination={pagination} disabled={disabled} />
    {!filtered.length && <EmptyState title={services.length ? 'No services in this view' : 'Services are not listed yet'} description={services.length ? 'Try another category or clear your search.' : 'You can continue with a venue-only booking.'} action={services.length ? <button type="button" className="button secondary" disabled={disabled} onClick={() => { setSearch(''); setCategory(''); setSelectedOnly(false); }}>Reset service filters</button> : null} />}
    {selected.length > 0 && <div className="service-basket"><div className="section-heading"><div><h3>Your selected services <span className="small muted">{selected.length}/100</span></h3><p className="small muted">Selections stay here when you search or change category.</p></div><button type="button" className="text-button destructive" disabled={disabled} onClick={() => onChange({})}>Clear selection</button></div>{selected.map(service => <div key={service.id} className="service-basket-item"><div><strong>{service.name}</strong><span className="small muted">{money(service.price)} per unit</span></div><div className="service-quantity-controls"><button type="button" className="icon-button" aria-label={`Decrease quantity for ${service.name}`} disabled={disabled || Number(quantities[service.id]) <= 1} onClick={() => setQuantity(service.id, Math.max(1, (Number(quantities[service.id]) || 1) - 1))}><Minus size={16} /></button><label><span className="sr-only">Quantity for {service.name}</span><input aria-label={`Quantity for ${service.name}`} type="number" min={1} max={100000} step={1} required disabled={disabled} value={quantities[service.id]} onChange={event => setQuantity(service.id, event.target.value)} /></label><button type="button" className="icon-button" aria-label={`Increase quantity for ${service.name}`} disabled={disabled || Number(quantities[service.id]) >= 100000} onClick={() => setQuantity(service.id, Math.min(100000, (Number(quantities[service.id]) || 0) + 1))}><Plus size={16} /></button></div><strong className="service-line-estimate">{money(service.price * (Number(quantities[service.id]) || 0))}</strong><button type="button" className="icon-button destructive" aria-label={`Remove selected ${service.name}`} disabled={disabled} onClick={() => toggle(service)}><X size={16} /></button>{service.category === 'FoodPreparation' && <button type="button" className="text-button small service-match-guests" disabled={disabled || !Number.isInteger(Number(guests)) || Number(guests) < 1 || Number(guests) > 100000} onClick={() => setQuantity(service.id, Number(guests))}>Use guest count ({guests || '—'})</button>}</div>)}<div className="service-estimate"><span>Services estimate</span><strong>{money(estimate)}</strong></div><p className="small muted">Estimate excludes the venue rental. Review price checks the final total with the server.</p></div>}
  </section>;
}
