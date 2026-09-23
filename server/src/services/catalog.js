/**
 * Reference data for the services SilverPass can handle. Kept in code rather
 * than the database because it is versioned content, not user data: a change
 * to a fee or a document list should arrive through a reviewed commit.
 *
 * Fees are in Indian rupees. `seniorConcessionPercent` reflects the standard
 * concession for applicants aged 60 and above, which is the group this
 * application exists to serve.
 */

const DOC = {
  aadhaar: { id: 'aadhaar', label: 'Aadhaar card', hint: 'Original plus one photocopy.' },
  addressProof: {
    id: 'address-proof',
    label: 'Proof of current address',
    hint: 'Electricity bill, gas bill, or bank passbook from the last 12 months.',
  },
  birthProof: {
    id: 'birth-proof',
    label: 'Proof of date of birth',
    hint: 'Birth certificate, school leaving certificate, or PAN card.',
  },
  oldPassport: {
    id: 'old-passport',
    label: 'Your current passport',
    hint: 'Bring the original plus photocopies of the first two and last two pages.',
  },
  policeReport: {
    id: 'police-report',
    label: 'Police report (FIR)',
    hint: 'The original FIR filed for the lost passport.',
  },
  damagedPassport: {
    id: 'damaged-passport',
    label: 'The damaged passport',
    hint: 'Bring it even if it is badly damaged. It must be surrendered.',
  },
  pensionOrder: {
    id: 'pension-order',
    label: 'Pension payment order',
    hint: 'Optional. Speeds up verification for retired government employees.',
  },
  guardianPassport: {
    id: 'guardian-passport',
    label: "Both parents' passports or ID",
    hint: 'Originals of both parents, or a guardian order from a court.',
  },
  employerLetter: {
    id: 'employer-letter',
    label: 'Letter from your employer',
    hint: 'On company letterhead, stating your role and how long you have worked there.',
  },
  photos: {
    id: 'photos',
    label: 'Two passport photographs',
    hint: '4.5 cm x 3.5 cm, white background, taken in the last six months.',
  },
};

export const SERVICES = [
  {
    id: 'fresh',
    name: 'New passport',
    nameHi: 'नया पासपोर्ट',
    summary: 'Apply for a passport for the first time.',
    summaryHi: 'पहली बार पासपोर्ट के लिए आवेदन करें।',
    feeInr: 1500,
    tatkalFeeInr: 3500,
    processingDays: 30,
    seniorConcessionPercent: 10,
    documents: [DOC.aadhaar, DOC.addressProof, DOC.birthProof, DOC.photos],
  },
  {
    id: 'renewal',
    name: 'Renew a passport',
    nameHi: 'पासपोर्ट नवीनीकरण',
    summary: 'Your passport has expired or is about to expire.',
    summaryHi: 'आपका पासपोर्ट समाप्त हो गया है या होने वाला है।',
    feeInr: 1500,
    tatkalFeeInr: 3500,
    processingDays: 21,
    seniorConcessionPercent: 10,
    documents: [DOC.oldPassport, DOC.aadhaar, DOC.addressProof, DOC.photos],
  },
  {
    id: 'lost-damaged',
    name: 'Replace a lost or damaged passport',
    nameHi: 'खोया या क्षतिग्रस्त पासपोर्ट बदलें',
    summary: 'Your passport was lost, stolen, or is too damaged to use.',
    summaryHi: 'आपका पासपोर्ट खो गया, चोरी हो गया, या खराब हो गया है।',
    feeInr: 3000,
    tatkalFeeInr: 5000,
    processingDays: 45,
    seniorConcessionPercent: 10,
    documents: [DOC.policeReport, DOC.damagedPassport, DOC.aadhaar, DOC.addressProof, DOC.photos],
  },
  {
    id: 'police-clearance',
    name: 'Police clearance certificate',
    nameHi: 'पुलिस मंजूरी प्रमाणपत्र',
    summary: 'Needed for a visa, a job abroad, or long-stay residency.',
    summaryHi: 'वीज़ा, विदेश में नौकरी, या निवास के लिए आवश्यक।',
    feeInr: 500,
    tatkalFeeInr: null,
    processingDays: 14,
    seniorConcessionPercent: 10,
    documents: [DOC.oldPassport, DOC.aadhaar, DOC.addressProof, DOC.employerLetter],
  },
  {
    id: 'minor',
    name: 'Passport for a child',
    nameHi: 'बच्चे के लिए पासपोर्ट',
    summary: 'For an applicant under 18 years old.',
    summaryHi: '18 वर्ष से कम आयु के आवेदक के लिए।',
    feeInr: 1000,
    tatkalFeeInr: 3000,
    processingDays: 30,
    seniorConcessionPercent: 0,
    documents: [DOC.birthProof, DOC.guardianPassport, DOC.addressProof, DOC.photos],
  },
];

const SERVICE_BY_ID = new Map(SERVICES.map((s) => [s.id, s]));

export const getService = (id) => SERVICE_BY_ID.get(id);
export const isServiceId = (id) => SERVICE_BY_ID.has(id);

/** Age at which an applicant qualifies for the senior-citizen concession. */
export const SENIOR_AGE = 60;

/**
 * @returns {{ baseInr: number, concessionInr: number, payableInr: number }}
 */
export function quoteFee(serviceId, { tatkal = false, senior = false } = {}) {
  const service = getService(serviceId);
  if (!service) throw new Error(`Unknown service: ${serviceId}`);
  if (tatkal && service.tatkalFeeInr == null) {
    throw new Error(`Service ${serviceId} is not available under the Tatkal scheme.`);
  }
  const baseInr = tatkal ? service.tatkalFeeInr : service.feeInr;
  const concessionInr = senior ? Math.round((baseInr * service.seniorConcessionPercent) / 100) : 0;
  return { baseInr, concessionInr, payableInr: baseInr - concessionInr };
}

export const CENTERS = [
  {
    id: 'psk-herald-house',
    name: 'PSK Herald House, ITO',
    nameHi: 'पीएसके हेराल्ड हाउस, आईटीओ',
    address: '5-A, Bahadur Shah Zafar Marg, New Delhi 110002',
    city: 'New Delhi',
    stepFreeAccess: true,
    wheelchairsAvailable: true,
    phone: '011-2345-6789',
  },
  {
    id: 'psk-bhikaji-cama',
    name: 'PSK Bhikaji Cama Place',
    nameHi: 'पीएसके भीकाजी कामा प्लेस',
    address: 'Block A, Bhikaji Cama Place, New Delhi 110066',
    city: 'New Delhi',
    stepFreeAccess: true,
    wheelchairsAvailable: true,
    phone: '011-2610-1234',
  },
  {
    id: 'psk-shalimar-place',
    name: 'PSK Shalimar Place',
    nameHi: 'पीएसके शालीमार प्लेस',
    address: 'Shalimar Place, Ring Road, New Delhi 110088',
    city: 'New Delhi',
    stepFreeAccess: false,
    wheelchairsAvailable: true,
    phone: '011-2748-5566',
  },
  {
    id: 'psk-gurugram',
    name: 'PSK Gurugram',
    nameHi: 'पीएसके गुरुग्राम',
    address: 'Sector 14, Old Delhi-Gurgaon Road, Gurugram 122001',
    city: 'Gurugram',
    stepFreeAccess: true,
    wheelchairsAvailable: false,
    phone: '0124-455-7788',
  },
  {
    id: 'psk-noida',
    name: 'PSK Noida',
    nameHi: 'पीएसके नोएडा',
    address: 'Sector 62, Noida 201309',
    city: 'Noida',
    stepFreeAccess: true,
    wheelchairsAvailable: true,
    phone: '0120-244-3322',
  },
];

const CENTER_BY_ID = new Map(CENTERS.map((c) => [c.id, c]));
export const getCenter = (id) => CENTER_BY_ID.get(id);
export const isCenterId = (id) => CENTER_BY_ID.has(id);
