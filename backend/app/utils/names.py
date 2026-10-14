"""Gender for avatars: explicit value when the user gave one, otherwise a guess from common first names."""
from __future__ import annotations

GENDERS = ("male", "female", "unspecified")

FEMALE_FIRST_NAMES = {
    "lakshmi", "meena", "fatima", "sunita", "kavita", "priya", "anjali", "shabana", "rekha", "geeta", "selvi",
    "pooja", "nirmala", "ayesha", "divya", "lata", "radha", "nasreen", "shanti", "usha", "anita", "sita", "gita",
    "neha", "sneha", "asha", "kavya", "deepa", "rani", "sarita", "savita", "lalitha", "padma", "jyoti", "swati",
    "naira", "shiza", "syeda", "zainab", "sana", "aisha", "mary", "maria", "nandini", "bhavya", "shruti",
}
MALE_FIRST_NAMES = {
    "ramesh", "suresh", "mahesh", "ravi", "arjun", "imran", "salim", "farhan", "venkat", "murugan", "karthik",
    "prakash", "manjunath", "basavaraj", "sanjay", "vijay", "ajay", "deepak", "rahul", "anil", "sunil", "raju",
    "gopal", "harish", "naveen", "sameer", "asif", "irfan", "joseph", "thomas", "syed", "mohammed", "mohammad",
    "ahmed", "rohan", "amit", "rakesh", "mukesh", "kiran", "abdul", "john", "david", "manoj", "vinod", "ganesh",
}


def guess_gender(name: str | None) -> str:
    first = (name or "").strip().split(" ")[0].lower()
    if first in FEMALE_FIRST_NAMES:
        return "female"
    if first in MALE_FIRST_NAMES:
        return "male"
    return "unspecified"
