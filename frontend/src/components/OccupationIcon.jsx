import {
  LuAirVent, LuBedDouble, LuBeef, LuBrickWall, LuBriefcase, LuBug, LuCar, LuCctv, LuChefHat, LuCookingPot, LuDroplets,
  LuFactory, LuFlame, LuHammer, LuHouse, LuLayoutGrid, LuPalette, LuPaintRoller, LuPartyPopper, LuPenTool, LuScissors,
  LuSprayCan, LuSprout, LuTruck, LuWashingMachine, LuWrench, LuZap, LuBaby, LuSmartphone,
} from "react-icons/lu";

// Ordered keyword rules: the first match wins, so more specific trades come first.
const RULES = [
  [/\bac\b|air ?con|hvac|refrigerat/, LuAirVent],
  [/cctv|camera|security system/, LuCctv],
  [/appliance|washing machine/, LuWashingMachine],
  [/mobile|phone|laptop|computer/, LuSmartphone],
  [/electric/, LuZap],
  [/plumb|pipe/, LuDroplets],
  [/carpent|wood|furniture/, LuHammer],
  [/paint/, LuPaintRoller],
  [/tile|floor/, LuLayoutGrid],
  [/mason|brick|construct/, LuBrickWall],
  [/roof/, LuHouse],
  [/weld/, LuFlame],
  [/fabricat|metal|smith/, LuFactory],
  [/mattress/, LuBedDouble],
  [/clean|maid|housekeep/, LuSprayCan],
  [/pest/, LuBug],
  [/garden|landscap|plant/, LuSprout],
  [/tailor|stitch|sew/, LuScissors],
  [/tattoo/, LuPenTool],
  [/dye|textile|artisan|craft/, LuPalette],
  [/decorat|event/, LuPartyPopper],
  [/meat|butcher/, LuBeef],
  [/street food|vendor|food stall/, LuCookingPot],
  [/cook|chef/, LuChefHat],
  [/driver|mechanic|auto/, LuCar],
  [/mover|packer|deliver/, LuTruck],
  [/nanny|baby|child/, LuBaby],
  [/repair|technician|fitter/, LuWrench],
];

export function occupationIcon(occupation) {
  const text = String(occupation || "").toLowerCase();
  for (const [re, Icon] of RULES) if (re.test(text)) return Icon;
  return LuBriefcase;
}

export default function OccupationIcon({ occupation, ...rest }) {
  const Icon = occupationIcon(occupation);
  return <Icon aria-hidden="true" {...rest} />;
}
