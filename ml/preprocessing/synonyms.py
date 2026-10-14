"""
Everyday words people type for informal services, mapped to the vocabulary used in worker profiles.

Applied only to query terms that do NOT occur in any profile (so it never changes how a query that already
matches is scored). The added words go through the same preprocessing and TF-IDF weighting as the rest of
the query, and the expansion is shown in the pipeline inspector.
Keys are lemmatized lower-case tokens, as produced by text_preprocessor.preprocess().
"""
SYNONYMS: dict[str, str] = {
    # cleaning / domestic help
    "maid": "house cleaning", "housekeeping": "house cleaning", "sweep": "cleaning floor", "mop": "cleaning floor",
    "dust": "cleaning", "bai": "house cleaning", "dirty": "cleaning",
    # appliances
    "fridge": "refrigerator appliance repair", "freezer": "refrigerator appliance", "oven": "microwave appliance",
    "mixer": "mixer grinder appliance", "tv": "television appliance", "inverter": "inverter battery electrician",
    "purifier": "water purifier appliance", "ro": "water purifier appliance",
    # electrical
    "light": "light fitting electrician", "bulb": "light fitting electrician", "switch": "switchboard electrician",
    "socket": "switchboard electrician", "power": "electrical wiring", "current": "electrical wiring", "shock": "electrical wiring",
    "mcb": "circuit breaker", "fuse": "circuit breaker", "wire": "wiring",
    # plumbing
    "tap": "tap plumber", "faucet": "tap plumber", "toilet": "toilet plumber", "washroom": "bathroom plumber",
    "drainage": "drain plumber", "clog": "drain blockage", "choke": "drain blockage", "motor": "water pump motor",
    "tank": "water tank plumber",
    # building / repair
    "wall": "wall painting", "crack": "plaster mason", "cement": "mason plaster", "flooring": "tile floor",
    "marble": "tile floor", "granite": "tile", "waterproofing": "roof waterproofing", "seepage": "roof leakage waterproofing",
    "furniture": "carpenter furniture", "cupboard": "wardrobe carpenter", "almirah": "wardrobe carpenter",
    "bed": "carpenter furniture", "window": "window carpenter", "grill": "grill welding", "shutter": "shutter welding",
    # pests, garden, events, food, textiles, body art
    "cockroach": "cockroach pest control", "rat": "rodent pest control", "mosquito": "mosquito pest control",
    "bedbug": "bed bug pest control", "lawn": "lawn garden", "tree": "tree trimming garden", "grass": "lawn garden",
    "party": "party decoration", "marriage": "wedding decoration", "birthday": "birthday decoration",
    "balloon": "balloon decoration", "chicken": "chicken meat", "mutton": "mutton meat", "fish": "fish meat",
    "snack": "street food snack", "chaat": "chaat street food", "dress": "tailor stitching", "alteration": "alteration tailor",
    "saree": "saree tailor", "ink": "tattoo", "camera": "cctv camera", "security": "cctv security",
    "aircon": "ac air conditioner", "cooler": "air cooler ac",
}

_normalised: dict[str, str] | None = None


def expansion_for(term: str) -> str | None:
    """Expansion text for a preprocessed query term (keys are matched both raw and after the same lemmatization)."""
    global _normalised
    if _normalised is None:
        from .text_preprocessor import preprocess

        table = dict(SYNONYMS)
        for key, value in SYNONYMS.items():
            terms = preprocess(key).terms
            if len(terms) == 1:
                table.setdefault(terms[0], value)
        _normalised = table
    return _normalised.get(term)
