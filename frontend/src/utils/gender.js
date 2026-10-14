// Mirrors backend/app/utils/names.py — used only when the API did not send a gender.
const FEMALE = new Set(("lakshmi meena fatima sunita kavita priya anjali shabana rekha geeta selvi pooja nirmala ayesha " +
  "divya lata radha nasreen shanti usha anita sita gita neha sneha asha kavya deepa rani sarita savita lalitha padma " +
  "jyoti swati naira shiza syeda zainab sana aisha mary maria nandini bhavya shruti").split(" "));
const MALE = new Set(("ramesh suresh mahesh ravi arjun imran salim farhan venkat murugan karthik prakash manjunath " +
  "basavaraj sanjay vijay ajay deepak rahul anil sunil raju gopal harish naveen sameer asif irfan joseph thomas syed " +
  "mohammed mohammad ahmed rohan amit rakesh mukesh kiran abdul john david manoj vinod ganesh").split(" "));

export function resolveGender(name, gender) {
  if (gender === "male" || gender === "female" || gender === "unspecified") return gender;
  const first = String(name || "").trim().split(/\s+/)[0].toLowerCase();
  if (FEMALE.has(first)) return "female";
  if (MALE.has(first)) return "male";
  return "unspecified";
}

export function hashString(str) {
  let h = 2166136261;
  for (const ch of String(str || "?")) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
