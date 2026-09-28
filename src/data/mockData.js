// Initial mock data mirroring Figma designs exactly

export const initialEvents = [
  {
    id: 'HH-90218',
    title: 'Corporate End-of-Year Gala',
    date: 'Dec 12, 2025 (18:00 PM - 23:00 PM)',
    guests: 150,
    venue: 'The Crystal Greenhouse',
    status: 'pending',
    statusLabel: 'Pending',
    feeNotice: '* Cancellation fee applies after Dec 05, 2025',
    image: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?q=80&w=600&auto=format&fit=crop'
  },
  {
    id: 'HH-492318',
    title: 'Alex & Sarah Wedding Reception',
    date: 'Oct 14, 2025 (10:00 AM - 16:00 PM)',
    guests: 120,
    venue: 'Grand Ballroom Atrium',
    status: 'confirmed',
    statusLabel: 'Confirmed',
    feeNotice: '* Cancellation fee applies after Oct 07, 2025',
    image: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?q=80&w=600&auto=format&fit=crop',
    isNext: true
  },
  {
    id: 'HH-312948',
    title: 'Creative Tech Summit 2025',
    date: 'Aug 22, 2025 (09:00 AM - 17:00 PM)',
    guests: 90,
    venue: 'The Warehouse Atrium',
    status: 'completed',
    statusLabel: 'Completed',
    feeNotice: null,
    image: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=600&auto=format&fit=crop'
  }
];

export const initialClients = [
  {
    id: 1,
    name: 'Sarah Jenkins',
    email: 'sarah.j@outlook.com',
    phone: '+1 (555) 234-5678',
    totalBookings: 4,
    lastBooking: 'Oct 14, 2025',
    company: 'Jenkins Design Studio',
    notes: 'Prefers natural sunlight and round banquet seating tables.'
  },
  {
    id: 2,
    name: 'Michael Chang',
    email: 'm.chang@corporatecorp.com',
    phone: '+1 (555) 876-5432',
    totalBookings: 3,
    lastBooking: 'Dec 01, 2025',
    company: 'CorporateCorp Global',
    notes: 'Requires high-speed AV equipment and stage microphones.'
  },
  {
    id: 3,
    name: 'Emily Rose',
    email: 'emily.rose@agency.co',
    phone: '+1 (555) 345-6789',
    totalBookings: 2,
    lastBooking: 'Nov 18, 2025',
    company: 'Rose Creative Agency',
    notes: 'Requested customized catering bar with mocktail station.'
  },
  {
    id: 4,
    name: 'David Miller',
    email: 'david@millerholding.com',
    phone: '+1 (555) 456-7890',
    totalBookings: 1,
    lastBooking: 'Nov 02, 2025',
    company: 'Miller Holding LLC',
    notes: 'Awaiting deposit settlement via wire transfer.'
  },
  {
    id: 5,
    name: 'Sophia Loren',
    email: 'sophia@classiccinema.it',
    phone: '+1 (555) 567-8901',
    totalBookings: 2,
    lastBooking: 'Dec 10, 2025',
    company: 'Cinema Classics Film Club',
    notes: 'Requires acoustic panel setup for orchestral quartet.'
  },
  {
    id: 6,
    name: 'James Thompson',
    email: 'j.thompson@builders.io',
    phone: '+1 (555) 678-9012',
    totalBookings: 5,
    lastBooking: 'Sep 28, 2025',
    company: 'Thompson Construction Group',
    notes: 'VIP Client. Priority weekend slot reservations.'
  }
];

export const initialOrders = [
  {
    id: 'ORD-5541',
    client: 'David Miller',
    venue: 'The Crystal Greenhouse',
    eventDate: 'Nov 02, 2025',
    status: 'awaiting-payment',
    statusLabel: 'Awaiting Payment',
    amount: '$2,100.00',
    guests: 110
  },
  {
    id: 'ORD-5542',
    client: 'Sarah Jenkins',
    venue: 'Metropolitan Symphony Hall',
    eventDate: 'Nov 15, 2025',
    status: 'confirmed',
    statusLabel: 'Confirmed',
    amount: '$3,200.00',
    guests: 200
  },
  {
    id: 'ORD-5543',
    client: 'Emily Rose',
    venue: 'The Warehouse Atrium',
    eventDate: 'Nov 18, 2025',
    status: 'change-requested',
    statusLabel: 'Change Requested',
    amount: '$1,500.00',
    guests: 85
  },
  {
    id: 'ORD-5544',
    client: 'Michael Chang',
    venue: 'Whispering Pines Lodge',
    eventDate: 'Dec 01, 2025',
    status: 'completed',
    statusLabel: 'Completed',
    amount: '$1,950.00',
    guests: 130
  },
  {
    id: 'ORD-5545',
    client: 'Sophia Loren',
    venue: 'Horizon Skyline Terrace',
    eventDate: 'Dec 10, 2025',
    status: 'confirmed',
    statusLabel: 'Confirmed',
    amount: '$2,450.00',
    guests: 140
  }
];

export const initialVenues = [
  {
    id: 'venue-1',
    name: 'Grand Ballroom Atrium',
    tag: 'Luxury Banquet',
    capacity: '120 - 250 Guests',
    price: '$2,400',
    description: 'Opulent chandelier hall with double-height ceiling and bespoke banquet dining tables.',
    image: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?q=80&w=800&auto=format&fit=crop'
  },
  {
    id: 'venue-2',
    name: 'The Crystal Greenhouse',
    tag: 'Botanical Glasshouse',
    capacity: '80 - 160 Guests',
    price: '$1,800',
    description: 'Lush enclosed garden enclosed under vintage iron glass arches with ambient warm string lighting.',
    image: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?q=80&w=800&auto=format&fit=crop'
  },
  {
    id: 'venue-3',
    name: 'The Warehouse Atrium',
    tag: 'Industrial Chic',
    capacity: '90 - 220 Guests',
    price: '$1,500',
    description: 'Polished concrete floors, exposed brick accents, and flexible modular stage architecture.',
    image: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=800&auto=format&fit=crop'
  },
  {
    id: 'venue-4',
    name: 'Whispering Pines Lodge',
    tag: 'Rustic Alpine',
    capacity: '50 - 120 Guests',
    price: '$1,950',
    description: 'Warm timber interiors with grand stone fireplace, panoramic mountain views, and cozy terraces.',
    image: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?q=80&w=800&auto=format&fit=crop'
  },
  {
    id: 'venue-5',
    name: 'Horizon Skyline Terrace',
    tag: 'Rooftop Panoramic',
    capacity: '70 - 150 Guests',
    price: '$2,200',
    description: 'High-altitude open sky lounge with illuminated city skyline backdrop and modern cocktail bar.',
    image: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?q=80&w=800&auto=format&fit=crop'
  },
  {
    id: 'venue-6',
    name: 'Metropolitan Symphony Hall',
    tag: 'Acoustic Concert',
    capacity: '150 - 350 Guests',
    price: '$3,200',
    description: 'Historic auditorium crafted with pristine acoustics, tiered theatre seating, and concert-grade AV.',
    image: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?q=80&w=800&auto=format&fit=crop'
  }
];

export const initialTimelineSlots = [
  {
    venue: 'Crystal Greenhouse',
    events: [
      {
        id: 't-1',
        title: 'Corporate End-of-Year Gala',
        type: 'corporate',
        startCol: 2, // Tuesday
        spanCols: 2  // Tue - Wed
      }
    ]
  },
  {
    venue: 'Warehouse Atrium',
    events: [
      {
        id: 't-2',
        title: 'Creative Tech Summit',
        type: 'social',
        startCol: 1, // Monday
        spanCols: 2  // Mon - Tue
      }
    ]
  },
  {
    venue: 'Metropolitan Hall',
    events: [
      {
        id: 't-3',
        title: 'Symphony Orchestra Prep',
        type: 'prep',
        startCol: 3, // Wednesday
        spanCols: 1  // Wed
      }
    ]
  },
  {
    venue: 'Skyline Terrace',
    events: []
  }
];
