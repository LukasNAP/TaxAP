export type CountyStatus = "covered" | "resolved" | "not-covered";

export type CountyCoverage = {
  county: string;
  taxBody: string;
  baseRate: number;
  localRate: number;
  transitRate: number;
  rateComponents: { label: string; rate: number }[];
  currentRate: number;
  scheduledRate: number | null;
  scheduledEffectiveDate: string | null;
  activeShipTos: number;
  activeCustomers: number;
  status: CountyStatus;
};

export type SpecialTaxBody = {
  taxBody: string;
  description: string;
  currentRate: number;
};

export type ResolvedCase = {
  id: string;
  place: string;
  taxBody: string;
  previousRate: string;
  currentRate: string;
  effectiveDate: string;
  activeShipTos: number;
  activeCustomers: number;
  invoices: number;
  customersReviewed: number;
  taxableSales: string;
  reviewEstimate: string;
  resolvedBy: string;
  resolvedOn: string;
  resolution: string;
};

const countyNames = [
  "Alamance", "Alexander", "Alleghany", "Anson", "Ashe", "Avery",
  "Beaufort", "Bertie", "Bladen", "Brunswick", "Buncombe", "Burke",
  "Cabarrus", "Caldwell", "Camden", "Carteret", "Caswell", "Catawba",
  "Chatham", "Cherokee", "Chowan", "Clay", "Cleveland", "Columbus",
  "Craven", "Cumberland", "Currituck", "Dare", "Davidson", "Davie",
  "Duplin", "Durham", "Edgecombe", "Forsyth", "Franklin", "Gaston",
  "Gates", "Graham", "Granville", "Greene", "Guilford", "Halifax",
  "Harnett", "Haywood", "Henderson", "Hertford", "Hoke", "Hyde",
  "Iredell", "Jackson", "Johnston", "Jones", "Lee", "Lenoir", "Lincoln",
  "Macon", "Madison", "Martin", "McDowell", "Mecklenburg", "Mitchell",
  "Montgomery", "Moore", "Nash", "New Hanover", "Northampton", "Onslow",
  "Orange", "Pamlico", "Pasquotank", "Pender", "Perquimans", "Person",
  "Pitt", "Polk", "Randolph", "Richmond", "Robeson", "Rockingham", "Rowan",
  "Rutherford", "Sampson", "Scotland", "Stanly", "Stokes", "Surry", "Swain",
  "Transylvania", "Tyrrell", "Union", "Vance", "Wake", "Warren", "Washington",
  "Watauga", "Wayne", "Wilkes", "Wilson", "Yadkin", "Yancey",
] as const;

// Current rates imported from the operational APLUSV8FAQ.XATXBD snapshot on
// August 18, 2026. The A+ file contains one standard row for each NC001-NC100.
const sevenPercentTaxBodies = new Set([
  2,3,4,5,8,11,13,18,19,20,22,26,29,31,33,34,36,38,40,42,43,44,46,
  50,52,53,55,57,58,62,63,65,67,70,74,76,78,79,80,81,82,84,86,87,94,97,
]);

const transitTaxBodies = new Set([32, 60, 68, 92]);

function currentRateFor(number: number) {
  if (number === 60) return 8.25;
  if (number === 32 || number === 68) return 7.5;
  if (number === 92) return 7.25;
  if (sevenPercentTaxBodies.has(number)) return 7;
  return 6.75;
}

const coverageCounts: Record<number, [number, number]> = {
  1:[105,68],2:[35,26],3:[5,4],4:[15,15],5:[2,2],7:[20,16],8:[4,3],9:[26,19],10:[48,33],
  11:[81,58],12:[40,35],13:[108,75],14:[79,38],15:[1,1],16:[7,6],18:[322,175],19:[26,23],
  20:[2,2],21:[6,5],22:[3,3],23:[47,36],24:[148,105],25:[28,17],26:[52,34],28:[17,12],
  29:[122,89],30:[28,20],31:[32,22],32:[136,80],33:[38,27],34:[309,156],35:[42,34],36:[183,94],
  37:[1,1],38:[1,1],39:[24,21],40:[11,8],41:[576,334],42:[9,8],43:[19,18],44:[12,6],
  45:[42,27],47:[10,7],48:[2,2],49:[97,71],50:[2,1],51:[53,38],52:[3,3],53:[54,23],
  54:[29,21],55:[41,30],56:[2,2],57:[2,2],58:[4,4],59:[24,17],60:[783,403],61:[2,2],
  62:[7,7],63:[23,17],64:[67,48],65:[216,140],67:[20,16],68:[8,8],69:[1,1],70:[5,3],
  71:[30,25],73:[11,11],74:[58,48],75:[2,2],76:[143,96],77:[35,24],78:[44,35],79:[44,30],
  80:[41,32],81:[22,15],82:[47,26],83:[21,17],84:[36,30],85:[7,7],86:[20,17],87:[2,2],
  88:[10,6],89:[1,1],90:[109,76],91:[18,17],92:[372,197],94:[5,3],95:[15,12],96:[56,29],
  97:[21,12],98:[45,35],99:[13,11],100:[3,2],
};

export const countyCoverage: CountyCoverage[] = countyNames.map((county, index) => {
  const number = index + 1;
  const [activeShipTos = 0, activeCustomers = 0] = coverageCounts[number] ?? [];
  const currentRate = currentRateFor(number);
  const transitRate = transitTaxBodies.has(number) ? 0.5 : 0;
  return {
    county,
    taxBody: `NC${String(number).padStart(3, "0")}`,
    baseRate: 4.75,
    localRate: currentRate - 4.75 - transitRate,
    transitRate,
    rateComponents: [
      { label: "State", rate: 4.75 },
      { label: "County", rate: currentRate - 4.75 - transitRate },
      ...(transitRate > 0 ? [{ label: "Public Transportation", rate: transitRate }] : []),
    ],
    currentRate,
    scheduledRate: null,
    scheduledEffectiveDate: null,
    activeShipTos,
    activeCustomers,
    status: number === 60 ? "resolved" : activeShipTos > 0 ? "covered" : "not-covered",
  };
});

// Last locally preserved official comparison. These values were validated against
// NCDOR on August 18, 2026 and are intentionally effective-dated. They let the UI
// remain useful during offline development without contacting A+ or a government site.
// A supervised refresh must replace this snapshot before anyone treats it as current.
export const validatedOfficialNcFallback = {
  source: "North Carolina Department of Revenue · validated fallback",
  sourceUrl: "https://www.ncdor.gov/taxes-forms/sales-and-use-tax/sales-and-use-tax-rates",
  effectiveDatesUrl: "https://www.ncdor.gov/taxes-forms/sales-and-use-tax/sales-and-use-tax-rates",
  retrievedAt: "2026-08-18T12:00:00.000Z",
  asOfDate: "2026-08-18",
  effectivePeriod: "7/1/2026 - Current",
  sourceHash: null,
  rates: countyCoverage.map((county) => ({
    county: county.county,
    taxBody: county.taxBody,
    officialRate: county.currentRate,
    previousOfficialRate: county.taxBody === "NC060" ? 7.25 : county.currentRate,
    recentChange: county.taxBody === "NC060",
    recentEffectiveDate: county.taxBody === "NC060" ? "2026-07-01" : null,
  })),
  futureChanges: [],
};

export const validatedStateCoverageFallback = [
  { stateCode: "NC", activeShipTos: 5518, activeCustomers: 0, taxBodyCount: 100 },
  { stateCode: "GA", activeShipTos: 2401, activeCustomers: 0, taxBodyCount: 0 },
  { stateCode: "SC", activeShipTos: 1924, activeCustomers: 0, taxBodyCount: 0 },
  { stateCode: "TX", activeShipTos: 1909, activeCustomers: 0, taxBodyCount: 0 },
  { stateCode: "CA", activeShipTos: 1576, activeCustomers: 0, taxBodyCount: 0 },
  { stateCode: "FL", activeShipTos: 1480, activeCustomers: 0, taxBodyCount: 0 },
  { stateCode: "PA", activeShipTos: 1060, activeCustomers: 0, taxBodyCount: 0 },
  { stateCode: "OH", activeShipTos: 940, activeCustomers: 0, taxBodyCount: 0 },
  { stateCode: "TN", activeShipTos: 934, activeCustomers: 0, taxBodyCount: 0 },
  { stateCode: "IL", activeShipTos: 895, activeCustomers: 0, taxBodyCount: 0 },
  { stateCode: "VA", activeShipTos: 827, activeCustomers: 0, taxBodyCount: 0 },
  { stateCode: "MD", activeShipTos: 735, activeCustomers: 0, taxBodyCount: 0 },
];

// These rows exist in XATXBD but are not county definitions. Keeping them
// separate prevents credit, legacy, and DO NOT USE codes from entering the dashboard inventory.
export const specialTaxBodies: SpecialTaxBody[] = [
  { taxBody: "NCCR06", description: "NC for credits at 6.75%", currentRate: 6.75 },
  { taxBody: "NCMK65", description: "Meck Cty 7.25 for credits", currentRate: 7.25 },
  { taxBody: "NCPRST", description: "NC Prestige Int. Billings", currentRate: 0 },
  { taxBody: "NCRC08", description: "NC 8% for cr. randolph", currentRate: 8 },
  { taxBody: "NCUSE", description: "DO NOT USE", currentRate: 0 },
  { taxBody: "NC060XXX", description: "NC Mecklen-OLD DO NOT USE", currentRate: 7.25 },
  { taxBody: "NC101", description: "1% North Carolina Tax", currentRate: 1 },
  { taxBody: "NC6.75%", description: "NC 6.75 FOR CREDITS", currentRate: 6.75 },
  { taxBody: "NC7.75%", description: "NC 7.75% for credits", currentRate: 7.75 },
  { taxBody: "NC7%CR", description: "NC for credits @ 7%", currentRate: 7 },
];

export const resolvedCases: ResolvedCase[] = [
  {
    id: "NC060-2026-07-01",
    place: "Mecklenburg County",
    taxBody: "NC060",
    previousRate: "7.25%",
    currentRate: "8.25%",
    effectiveDate: "July 1, 2026",
    activeShipTos: 783,
    activeCustomers: 403,
    invoices: 78,
    customersReviewed: 39,
    taxableSales: "$91,211.53",
    reviewEstimate: "$912.12",
    resolvedBy: "Atlantic tax team",
    resolvedOn: "August 17, 2026",
    resolution: "A+ rate updated and prior-rate invoices handled",
  },
];

export const snapshot = {
  verifiedOn: "August 18, 2026",
  shipToSnapshotOn: "August 17, 2026",
  rateSource: "APLUSV8FAQ.XATXBD",
  activeNcShipTos: 5518,
  standardCountyAssignments: 5498,
  coveredCounties: 93,
  totalCounties: 100,
  specialTaxBodies: 10,
  scheduledRateChanges: 0,
  openFindings: 0,
  resolvedFindings: 1,
};

export const sources = [
  {
    name: "North Carolina Department of Revenue",
    purpose: "Official current and announced general sales and use tax rates",
    status: "Mecklenburg case verified",
    checkedOn: "August 17, 2026",
    url: "https://www.ncdor.gov/taxes-forms/sales-and-use-tax/sales-and-use-tax-rates",
  },
  {
    name: "A+ operational DB2 · APLUSV8FAQ.XATXBD",
    purpose: "Configured NC tax-body descriptions, rate components, totals, and scheduled next rates",
    status: "Read-only query verified",
    checkedOn: "August 18, 2026",
    url: null,
  },
  {
    name: "A+ DWStage · ADDR / CUSMS",
    purpose: "Active customer ship-to assignments and tax-body coverage",
    status: "Read-only query verified",
    checkedOn: "August 17, 2026",
    url: null,
  },
  {
    name: "A+ DWStage · HSHED",
    purpose: "Historical invoice tax body, taxable amount, tax amount, and rate evidence",
    status: "Read-only query verified",
    checkedOn: "August 17, 2026",
    url: null,
  },
];
