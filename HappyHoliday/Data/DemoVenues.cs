using HappyHoliday.Models;

namespace HappyHoliday.Data;

// Fictional development catalogue with illustrative Unsplash photos; sources are in docs/venue-photo-sources.json.
public static class DemoVenues
{
    public static List<Premise> Create()
    {
    List<Premise> venues =
    [
        new() { Name = "Grand Ballroom Atrium", Address = "123 Main St", Description = "Opulent chandelier hall with double-height ceiling and bespoke banquet tables.", Capacity = 250, PricePerHour = 2400 },
        new() { Name = "The Crystal Greenhouse", Address = "456 Garden Blvd", Description = "Lush enclosed garden under vintage iron glass arches with warm string lighting.", Capacity = 160, PricePerHour = 1800 },
        new() { Name = "The Warehouse Atrium", Address = "789 Industry Way", Description = "Polished concrete floors, exposed brick accents and flexible modular stage architecture.", Capacity = 220, PricePerHour = 1500 },
        new() { Name = "Whispering Pines Lodge", Address = "101 Mountain Rd", Description = "Warm timber interiors with grand stone fireplace and panoramic mountain views.", Capacity = 120, PricePerHour = 1950 },
        new() { Name = "Horizon Skyline Terrace", Address = "202 Rooftop Ave", Description = "High-altitude open sky lounge with illuminated city skyline backdrop and modern cocktail bar.", Capacity = 150, PricePerHour = 2200 },
        new() { Name = "Metropolitan Symphony Hall", Address = "303 Arts St", Description = "Historic auditorium crafted with pristine acoustics and concert-grade AV system.", Capacity = 350, PricePerHour = 3200 },
        new() { Name = "Amber Banquet Hall", Address = "12 Celebration Avenue", Description = "Warm-toned banquet room with a dance floor and flexible dinner seating.", Capacity = 180, PricePerHour = 1700 },
        new() { Name = "Willow Garden Pavilion", Address = "28 Willow Lane", Description = "Covered garden pavilion for daytime receptions and family gatherings.", Capacity = 100, PricePerHour = 1200 },
        new() { Name = "The Copper Loft", Address = "44 Foundry Street", Description = "Industrial loft with exposed beams and open space for creative events.", Capacity = 80, PricePerHour = 1100 },
        new() { Name = "Pearl Wedding Ballroom", Address = "60 Pearl Boulevard", Description = "Formal ballroom with a central dance floor and space for a wedding stage.", Capacity = 300, PricePerHour = 2900 },
        new() { Name = "Riverstone Meeting Centre", Address = "76 Riverside Road", Description = "Conference space with modular seating for seminars and business presentations.", Capacity = 140, PricePerHour = 1600 },
        new() { Name = "Juniper Private Dining Room", Address = "92 Juniper Walk", Description = "Intimate dining room for small celebrations and private dinners.", Capacity = 30, PricePerHour = 650 },
        new() { Name = "The Lantern Courtyard", Address = "108 Heritage Lane", Description = "Open-air courtyard with sheltered edges for evening receptions.", Capacity = 110, PricePerHour = 1400 },
        new() { Name = "Aurora Exhibition Gallery", Address = "124 Gallery Street", Description = "Bright gallery space with open walls for exhibitions and product launches.", Capacity = 130, PricePerHour = 1550 },
        new() { Name = "Cedar Lakeside Lodge", Address = "140 Lakeside Drive", Description = "Timber lodge with an indoor gathering room and views over the lake.", Capacity = 90, PricePerHour = 1500 },
        new() { Name = "The Meridian Auditorium", Address = "156 University Avenue", Description = "Tiered auditorium suited to lectures, screenings, and panel discussions.", Capacity = 450, PricePerHour = 3400 },
        new() { Name = "Olive Community Hall", Address = "172 Community Road", Description = "Flexible community room for workshops, birthdays, and neighbourhood events.", Capacity = 75, PricePerHour = 800 },
        new() { Name = "Bluebird Studio", Address = "188 Studio Lane", Description = "Compact creative studio for photo sessions and small group workshops.", Capacity = 20, PricePerHour = 500 },
        new() { Name = "The Velvet Lounge", Address = "204 Theatre Street", Description = "Softly lit lounge with conversational seating for social receptions.", Capacity = 60, PricePerHour = 1000 },
        new() { Name = "Orchard Family Pavilion", Address = "220 Orchard Road", Description = "Garden-side pavilion with room for family celebrations and shared meals.", Capacity = 125, PricePerHour = 1350 },
        new() { Name = "Summit Conference Hall", Address = "236 Summit Avenue", Description = "Large conference hall with flexible arrangements for talks and networking.", Capacity = 280, PricePerHour = 2600 },
        new() { Name = "The Mosaic Workshop Space", Address = "252 Artisan Street", Description = "Open workshop room for hands-on classes and collaborative activities.", Capacity = 40, PricePerHour = 700 },
        new() { Name = "Golden Hour Rooftop", Address = "268 Sunset Boulevard", Description = "Rooftop event area for small receptions with sunset skyline views.", Capacity = 85, PricePerHour = 1750 },
        new() { Name = "Magnolia Reception Hall", Address = "284 Magnolia Lane", Description = "Light-filled reception room for weddings, anniversaries, and formal dinners.", Capacity = 200, PricePerHour = 2100 },
        new() { Name = "The Foundry Event Hall", Address = "300 Foundry Avenue", Description = "Spacious industrial hall with adaptable zones for launches and performances.", Capacity = 400, PricePerHour = 3000 },
        new() { Name = "Sapphire Music Room", Address = "316 Music Street", Description = "Indoor performance room for small concerts and music-led celebrations.", Capacity = 95, PricePerHour = 1450 },
        new() { Name = "Maple Retreat House", Address = "332 Woodland Drive", Description = "Quiet retreat house with a gathering room for small team and family events.", Capacity = 45, PricePerHour = 900 },
        new() { Name = "The Seabreeze Terrace", Address = "348 Waterfront Road", Description = "Open terrace with covered seating for relaxed daytime receptions.", Capacity = 165, PricePerHour = 1850 },
        new() { Name = "Rosewood Celebration Hall", Address = "364 Rosewood Avenue", Description = "Traditional celebration hall with banquet seating and a dedicated stage area.", Capacity = 240, PricePerHour = 2300 },
        new() { Name = "The Northstar Event Centre", Address = "380 Northstar Boulevard", Description = "Large multipurpose event centre for exhibitions, conferences, and gala dinners.", Capacity = 600, PricePerHour = 4200 },
    ];
    foreach (var venue in venues) venue.ImageUrl = PhotoFor(venue.Name);
    return venues;
    }

    public static string PhotoFor(string name)
    {
        var text = name.ToLowerInvariant();
        if (text.Contains("ballroom") || text.Contains("wedding")) return "https://images.unsplash.com/photo-1780593116478-c46838f86523?auto=format&fit=crop&w=1200&q=80";
        if (text.Contains("banquet") || text.Contains("reception") || text.Contains("celebration") || text.Contains("dining")) return "https://images.unsplash.com/photo-1783314867628-220ab03cac99?auto=format&fit=crop&w=1200&q=80";
        if (text.Contains("meeting") || text.Contains("conference") || text.Contains("workshop") || text.Contains("studio") || text.Contains("retreat") || text.Contains("lodge")) return "https://images.unsplash.com/photo-1777326587610-1ddcce610a5c?auto=format&fit=crop&w=1200&q=80";
        if (text.Contains("garden") || text.Contains("greenhouse") || text.Contains("pavilion") || text.Contains("courtyard")) return "https://images.unsplash.com/photo-1783522332339-0e9ccef91c5d?auto=format&fit=crop&w=1200&q=80";
        if (text.Contains("terrace") || text.Contains("rooftop") || text.Contains("lakeside")) return "https://images.unsplash.com/photo-1643856557143-09189e523fd6?auto=format&fit=crop&w=1200&q=80";
        return "https://images.unsplash.com/photo-1769667693219-4d8e44b6a3b3?auto=format&fit=crop&w=1200&q=80";
    }
}