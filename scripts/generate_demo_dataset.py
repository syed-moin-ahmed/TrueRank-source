"""
Generate the SYNTHETIC DEMO dataset used until the research dataset is available.

    python scripts/generate_demo_dataset.py            -> data/seed/demo_workers.csv (600 rows)
    python scripts/generate_demo_dataset.py --rows 300

IMPORTANT: this is NOT the 1,500-profile research dataset described in the paper.
It only reuses the same column names so that the real dataset can be dropped in
later with `python backend/manage.py import-dataset data/dataset/<file>.csv`.
The generator is deterministic (fixed random seed) so every run gives the same file.
"""
from __future__ import annotations

import argparse
import csv
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "data" / "seed" / "demo_workers.csv"
SEED = 2026

COLUMNS = [
    "Worker_ID", "Name", "Occupation", "Skills", "Experience_Years", "City", "Languages",
    "Jobs_Completed", "Completion_Rate", "Average_Rating", "Peer_Endorsements", "Dispute_Count",
    "Verification_Status", "Profile_Description", "Customer_Review", "Review_Sentiment",
]

# Cities named in the paper ("drawn primarily from large cities in India").
CITIES = ["Bengaluru", "Mumbai", "Delhi", "Hyderabad", "Chennai"]
CITY_LANGUAGES = {
    "Bengaluru": ["Kannada", "Hindi", "English", "Tamil", "Telugu"],
    "Mumbai": ["Marathi", "Hindi", "English", "Gujarati"],
    "Delhi": ["Hindi", "Punjabi", "English", "Urdu"],
    "Hyderabad": ["Telugu", "Urdu", "Hindi", "English"],
    "Chennai": ["Tamil", "English", "Telugu", "Hindi"],
}

FIRST_NAMES = [
    "Ramesh", "Suresh", "Mahesh", "Ravi", "Arjun", "Imran", "Salim", "Farhan", "Venkat", "Murugan",
    "Karthik", "Prakash", "Manjunath", "Basavaraj", "Sanjay", "Vijay", "Ajay", "Deepak", "Rahul", "Anil",
    "Sunil", "Raju", "Gopal", "Harish", "Naveen", "Sameer", "Asif", "Irfan", "Joseph", "Thomas",
    "Lakshmi", "Meena", "Fatima", "Sunita", "Kavita", "Priya", "Anjali", "Shabana", "Rekha", "Geeta",
    "Selvi", "Pooja", "Nirmala", "Ayesha", "Divya", "Lata", "Radha", "Nasreen", "Shanti", "Usha",
]
LAST_NAMES = [
    "Kumar", "Sharma", "Reddy", "Naidu", "Gowda", "Patil", "Shaikh", "Khan", "Iyer", "Pillai",
    "Singh", "Yadav", "Verma", "Das", "Nair", "Rao", "Ansari", "Qureshi", "Joshi", "Pawar",
    "Murthy", "Hegde", "Shetty", "Chauhan", "Mishra", "Pandey", "Siddiqui", "Fernandes", "Raj", "Babu",
]

# occupation -> (skill pool, specialised phrases for descriptions)
OCCUPATIONS: dict[str, tuple[list[str], list[str]]] = {
    "Electrician": (
        ["House wiring", "MCB repair", "Circuit breaker replacement", "Switchboard installation",
         "Fan installation", "Inverter installation", "Earthing", "Short circuit repair",
         "Motor repair", "Electrical maintenance", "Light fitting", "Meter board wiring", "DB box repair"],
        ["rewiring old houses", "fixing tripped breakers and short circuits", "installing fans, lights and inverters",
         "electrical maintenance for shops and apartments", "repairing damaged wiring and switchboards"],
    ),
    "Plumber": (
        ["Pipe leakage repair", "Tap installation", "Bathroom fitting", "Drain cleaning",
         "Water tank installation", "Geyser installation", "Toilet repair", "Sink blockage removal",
         "PVC pipeline work", "Motor pump fitting", "Sewage line repair", "Shower installation"],
        ["fixing leaking pipes and taps", "clearing blocked drains and sinks", "complete bathroom fittings",
         "installing water tanks, geysers and motor pumps", "repairing sewage and pipeline problems"],
    ),
    "Carpenter": (
        ["Furniture making", "Door repair", "Modular kitchen", "Wardrobe making", "Wood polishing",
         "Bed repair", "Window frame fitting", "Furniture assembly", "Lock fitting", "Plywood work",
         "Shelf installation", "Wooden flooring"],
        ["making and repairing furniture", "modular kitchens and wardrobes", "door and window frame fitting",
         "assembling and polishing wooden furniture", "custom plywood and shelf work"],
    ),
    "Painter": (
        ["Interior painting", "Exterior painting", "Wall putty", "Texture painting", "Waterproof coating",
         "Enamel painting", "Wood polish", "Stencil design", "Wall primer", "Asian paints application",
         "Ceiling painting", "Damp wall treatment"],
        ["interior and exterior house painting", "texture and stencil wall designs", "putty, primer and finishing work",
         "waterproof coating for damp walls", "painting offices and apartments"],
    ),
    "AC Technician": (
        ["AC installation", "AC gas refilling", "AC servicing", "Split AC repair", "Window AC repair",
         "Compressor repair", "Cooling problem diagnosis", "AC uninstallation", "Refrigerator repair",
         "PCB repair", "Duct cleaning"],
        ["installing and servicing split and window ACs", "gas refilling and cooling problems",
         "compressor and PCB repair", "refrigerator and AC maintenance", "AC shifting and uninstallation"],
    ),
    "Mason": (
        ["Brick work", "Plastering", "Concrete work", "Tile laying", "Wall construction", "Flooring",
         "Compound wall", "Foundation work", "Cement finishing", "Renovation work", "Staircase construction"],
        ["brick work and plastering", "house construction and renovation", "concrete and foundation work",
         "building compound walls", "floor and staircase construction"],
    ),
    "Welder": (
        ["Arc welding", "Gas welding", "Gate fabrication", "Grill making", "Steel structure work",
         "Window grill repair", "Shutter repair", "MIG welding", "Railing work", "Metal cutting"],
        ["gate and grill fabrication", "steel structure welding", "repairing shutters and window grills",
         "railing and balcony work", "arc and gas welding jobs"],
    ),
    "Metal Fabricator": (
        ["Sheet metal work", "Steel fabrication", "Roofing sheet fixing", "Shed construction",
         "Aluminium partition", "Stainless steel railing", "Metal cutting", "Welding", "Rack fabrication"],
        ["sheet metal and steel fabrication", "industrial sheds and roofing structures",
         "aluminium partitions and steel railings", "custom racks for shops and godowns"],
    ),
    "Tile Installer": (
        ["Floor tiling", "Wall tiling", "Granite fitting", "Marble polishing", "Bathroom tiling",
         "Tile grouting", "Kitchen backsplash", "Vitrified tile laying", "Tile repair"],
        ["floor and wall tiling", "granite and marble fitting", "bathroom and kitchen tiling",
         "repairing cracked tiles and grouting"],
    ),
    "House Cleaner": (
        ["Deep cleaning", "Kitchen cleaning", "Bathroom cleaning", "Sofa cleaning", "Floor scrubbing",
         "Window cleaning", "Move-in cleaning", "Office cleaning", "Carpet cleaning", "Dusting"],
        ["deep cleaning of homes and offices", "kitchen and bathroom cleaning", "sofa and carpet cleaning",
         "move-in and move-out cleaning"],
    ),
    "Mattress Cleaner": (
        ["Mattress cleaning", "Mattress sanitization", "Stain removal", "Bed bug treatment",
         "Upholstery cleaning", "Steam cleaning", "Dust mite removal", "Pillow cleaning"],
        ["mattress steam cleaning and sanitization", "stain and odour removal", "upholstery and pillow cleaning",
         "bed bug and dust mite treatment"],
    ),
    "CCTV Installer": (
        ["CCTV camera installation", "DVR setup", "NVR configuration", "IP camera setup",
         "Mobile view configuration", "Cable laying", "Camera repair", "Video door phone installation",
         "Biometric device installation", "Network cabling"],
        ["CCTV and IP camera installation", "DVR and NVR setup with mobile viewing", "security camera repair",
         "video door phones and biometric devices"],
    ),
    "Roofer": (
        ["Roof waterproofing", "Terrace leakage repair", "Roof sheet installation", "Mangalore tile roofing",
         "Shed roofing", "Gutter installation", "Roof inspection", "Polycarbonate roofing"],
        ["roof and terrace waterproofing", "fixing roof leakage", "installing roofing sheets and sheds",
         "gutter installation and roof repair"],
    ),
    "Event Decorator": (
        ["Balloon decoration", "Flower decoration", "Stage decoration", "Birthday decoration",
         "Wedding mandap decoration", "Lighting decoration", "Backdrop setup", "Theme party setup"],
        ["birthday and theme party decoration", "wedding stage and mandap decoration",
         "flower and balloon decoration", "lighting and backdrop setup for events"],
    ),
    "Tailor": (
        ["Blouse stitching", "Shirt stitching", "Alteration", "Kurta stitching", "Uniform stitching",
         "Embroidery", "Saree fall and pico", "Curtain stitching", "Lehenga stitching"],
        ["stitching blouses, kurtas and shirts", "quick alterations", "school and office uniform stitching",
         "embroidery and curtain stitching"],
    ),
    "Tie & Dye Artisan": (
        ["Tie and dye", "Bandhani", "Block printing", "Fabric dyeing", "Natural dyes", "Shibori",
         "Saree dyeing", "Dupatta dyeing"],
        ["traditional bandhani and tie and dye work", "block printing on fabric", "natural dye and shibori techniques",
         "custom saree and dupatta dyeing"],
    ),
    "Tattoo Artist": (
        ["Custom tattoo design", "Black and grey tattoo", "Colour tattoo", "Tattoo cover up",
         "Fine line tattoo", "Mehendi design", "Piercing", "Sterilization practice"],
        ["custom tattoo designs", "cover-up and fine line tattoos", "colour and black and grey work",
         "safe and sterilized tattoo practice"],
    ),
    "Street Food Vendor": (
        ["Chaat making", "Pani puri", "Dosa making", "Food stall catering", "Snacks preparation",
         "Event food counter", "Hygienic food handling", "Biryani cooking"],
        ["chaat and pani puri counters for events", "dosa and snacks catering", "live food stalls for functions",
         "hygienic street food preparation"],
    ),
    "Meat Seller": (
        ["Meat cutting", "Poultry processing", "Fish cleaning", "Mutton cutting", "Cold storage handling",
         "Hygienic meat handling", "Bulk meat supply", "Halal processing"],
        ["fresh meat and poultry cutting", "bulk supply for restaurants and events", "fish cleaning and processing",
         "hygienic meat handling and cold storage"],
    ),
    "Appliance Repair Technician": (
        ["Washing machine repair", "Microwave repair", "Television repair", "Mixer grinder repair",
         "Water purifier service", "Refrigerator repair", "Chimney repair", "Geyser repair"],
        ["washing machine and refrigerator repair", "TV and microwave repair", "RO water purifier service",
         "kitchen chimney and mixer repair"],
    ),
    "Pest Control Technician": (
        ["Cockroach control", "Termite treatment", "Bed bug treatment", "Mosquito fogging",
         "Rodent control", "Pre-construction anti termite", "Herbal pest control", "Office pest control"],
        ["termite and cockroach treatment", "bed bug and rodent control", "mosquito fogging for societies",
         "herbal and safe pest control for homes"],
    ),
    "Gardener": (
        ["Lawn mowing", "Plant care", "Terrace garden setup", "Hedge trimming", "Landscaping",
         "Pot plant maintenance", "Drip irrigation", "Tree pruning", "Kitchen garden setup"],
        ["lawn and garden maintenance", "terrace and kitchen garden setup", "landscaping and hedge trimming",
         "drip irrigation and plant care"],
    ),
}

DESCRIPTION_TEMPLATES = [
    "I have been working as a {occ_lower} for {years} years in {city}. I mostly do {spec_a} and {spec_b}.",
    "{years} years of hands-on experience in {spec_a}. Also skilled in {spec_b}. I learned the work from my family and on the job.",
    "Self-employed {occ_lower} in {city}. Work includes {spec_a}, {spec_b} and small urgent jobs. I bring my own tools.",
    "Experienced in {spec_a}. Customers call me again for {spec_b}. No formal certificate, but {years} years of practical work.",
    "My main work is {spec_a} for homes and small businesses. I have also worked with contractors on {spec_b}.",
]

POSITIVE_REVIEWS = [
    "Very good work on {skill_lower}, came on time and explained everything.",
    "Excellent and honest worker. Finished the {skill_lower} job neatly.",
    "Quick service, fair price and good quality {skill_lower}. Will call again.",
    "Polite and skilled. Solved the problem the same day.",
    "Very professional, cleaned up after the work. Highly recommended.",
]
NEUTRAL_REVIEWS = [
    "Work was okay but he came a little late.",
    "Job was done, price was slightly high.",
    "Average work on {skill_lower}, needed one more visit to finish.",
    "Decent work, communication could be better.",
]
NEGATIVE_REVIEWS = [
    "Did not finish the {skill_lower} job properly, had to call someone else.",
    "Came very late and the problem returned after two days.",
    "Overcharged and was not careful with the work.",
]


def _choose_experience(rng: random.Random) -> int:
    return rng.choice([0, 1, 1, 2, 2, 3, 3, 4, 5, 5, 6, 7, 8, 9, 10, 12, 14, 15, 18, 20, 25])


def generate(rows: int, seed: int = SEED) -> list[dict]:
    rng = random.Random(seed)
    occupations = list(OCCUPATIONS)
    records = []
    for i in range(1, rows + 1):
        occupation = occupations[(i - 1) % len(occupations)] if i <= len(occupations) * 2 else rng.choice(occupations)
        skill_pool, specialities = OCCUPATIONS[occupation]
        city = rng.choice(CITIES)
        years = _choose_experience(rng)
        skills = rng.sample(skill_pool, k=min(len(skill_pool), rng.randint(3, 6)))
        spec_a, spec_b = rng.sample(specialities, 2)

        description = rng.choice(DESCRIPTION_TEMPLATES).format(
            occ_lower=occupation.lower(), years=max(years, 1), city=city, spec_a=spec_a, spec_b=spec_b
        )

        languages = rng.sample(CITY_LANGUAGES[city], k=rng.randint(1, 3))

        # ~5% brand-new workers with no history (cold start is part of the problem statement)
        if rng.random() < 0.05:
            jobs = 0
        else:
            jobs = int(min(400, max(1, rng.gammavariate(2.0, 12 + years * 6))))

        quality = rng.betavariate(5, 2)  # latent worker quality, skewed towards good
        if jobs:
            completion = round(min(1.0, max(0.55, 0.62 + 0.38 * quality + rng.uniform(-0.06, 0.04))), 2)
            rating = round(min(5.0, max(1.5, 2.2 + 2.8 * quality + rng.uniform(-0.35, 0.25))), 1)
            dispute_rate = max(0.0, 0.10 * (1 - quality) + rng.uniform(-0.02, 0.02))
            disputes = sum(1 for _ in range(jobs) if rng.random() < dispute_rate)
        else:
            completion, rating, disputes = "", "", 0

        endorsements = int(min(40, max(0, rng.gauss(4 + quality * 10 + years * 0.4, 4)))) if jobs or rng.random() < 0.3 else 0
        verified = rng.random() < (0.35 + 0.4 * quality)

        if jobs:
            skill_lower = rng.choice(skills).lower()
            if rating >= 4.0:
                review, sentiment = rng.choice(POSITIVE_REVIEWS), "Positive"
            elif rating >= 3.0:
                review, sentiment = rng.choice(NEUTRAL_REVIEWS), "Neutral"
            else:
                review, sentiment = rng.choice(NEGATIVE_REVIEWS), "Negative"
            review = review.format(skill_lower=skill_lower)
        else:
            review, sentiment = "", ""

        records.append({
            "Worker_ID": f"DEMO-W{i:04d}",
            "Name": f"{rng.choice(FIRST_NAMES)} {rng.choice(LAST_NAMES)}",
            "Occupation": occupation,
            "Skills": ", ".join(skills),
            "Experience_Years": years,
            "City": city,
            "Languages": ", ".join(languages),
            "Jobs_Completed": jobs,
            "Completion_Rate": completion,
            "Average_Rating": rating,
            "Peer_Endorsements": endorsements,
            "Dispute_Count": disputes,
            "Verification_Status": "Verified" if verified else "Not Verified",
            "Profile_Description": description,
            "Customer_Review": review,
            "Review_Sentiment": sentiment,
        })
    return records


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--rows", type=int, default=600)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    if args.rows < 1:
        parser.error("--rows must be at least 1")

    records = generate(args.rows)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=COLUMNS)
        writer.writeheader()
        writer.writerows(records)
    print(f"Wrote {len(records)} SYNTHETIC DEMO profiles to {args.output}")


if __name__ == "__main__":
    main()
