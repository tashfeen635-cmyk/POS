export const PRODUCT_TYPES = {
  // General
  GENERAL: 'general',

  // Mobile Shop
  MOBILE_DEVICE: 'mobile_device',
  ACCESSORY: 'accessory',
  SPARE_PART: 'spare_part',

  // Medical Store
  MEDICINE: 'medicine',
  MEDICAL_DEVICE: 'medical_device',
  CONSUMABLE: 'consumable',
} as const;

export type ProductType = (typeof PRODUCT_TYPES)[keyof typeof PRODUCT_TYPES];

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  [PRODUCT_TYPES.GENERAL]: 'General',
  [PRODUCT_TYPES.MOBILE_DEVICE]: 'Mobile Device',
  [PRODUCT_TYPES.ACCESSORY]: 'Accessory',
  [PRODUCT_TYPES.SPARE_PART]: 'Spare Part',
  [PRODUCT_TYPES.MEDICINE]: 'Medicine',
  [PRODUCT_TYPES.MEDICAL_DEVICE]: 'Medical Device',
  [PRODUCT_TYPES.CONSUMABLE]: 'Consumable',
};

export const MOBILE_PRODUCT_TYPES: ProductType[] = [
  PRODUCT_TYPES.MOBILE_DEVICE,
  PRODUCT_TYPES.ACCESSORY,
  PRODUCT_TYPES.SPARE_PART,
];

export const MEDICAL_PRODUCT_TYPES: ProductType[] = [
  PRODUCT_TYPES.MEDICINE,
  PRODUCT_TYPES.MEDICAL_DEVICE,
  PRODUCT_TYPES.CONSUMABLE,
];

// Products that require IMEI tracking
export const IMEI_TRACKED_TYPES: ProductType[] = [
  PRODUCT_TYPES.MOBILE_DEVICE,
];

// Products that require batch/expiry tracking
export const BATCH_TRACKED_TYPES: ProductType[] = [
  PRODUCT_TYPES.MEDICINE,
  PRODUCT_TYPES.CONSUMABLE,
];

// Medicine schedule types (Pakistan)
export const MEDICINE_SCHEDULES = {
  OTC: 'otc', // Over the counter
  SCHEDULE_G: 'schedule_g', // Prescription required
  SCHEDULE_H: 'schedule_h', // Restricted
  NARCOTIC: 'narcotic', // Controlled
} as const;

export type MedicineSchedule = (typeof MEDICINE_SCHEDULES)[keyof typeof MEDICINE_SCHEDULES];

// Dosage forms
export const DOSAGE_FORMS = {
  TABLET: 'tablet',
  CAPSULE: 'capsule',
  SYRUP: 'syrup',
  INJECTION: 'injection',
  CREAM: 'cream',
  OINTMENT: 'ointment',
  DROPS: 'drops',
  INHALER: 'inhaler',
  POWDER: 'powder',
  GEL: 'gel',
  SUSPENSION: 'suspension',
  OTHER: 'other',
} as const;

export type DosageForm = (typeof DOSAGE_FORMS)[keyof typeof DOSAGE_FORMS];
