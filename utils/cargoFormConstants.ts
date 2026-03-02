export interface CargoTypePreset {
  weight: string;
  length: string;
  width: string;
  height: string;
  hintKey: string;
}

export interface CargoTypeOption {
  id: string;
  labelKey: string;
}

export interface PriceTypeOption {
  id: string;
  labelKey: string;
}

export interface QuickRequestTemplate {
  id: string;
  labelKey: string;
  cargo_type: string;
  weight: string;
  length: string;
  width: string;
  height: string;
}

export const CARGO_TYPES: CargoTypeOption[] = [
  { id: 'automotive', labelKey: 'automotive' },
  { id: 'construction', labelKey: 'construction' },
  { id: 'boats', labelKey: 'boats' },
  { id: 'electronics', labelKey: 'electronics' },
  { id: 'campingvogn', labelKey: 'campingvogn' },
  { id: 'machinery', labelKey: 'machinery' },
  { id: 'furniture', labelKey: 'furniture' },
  { id: 'other', labelKey: 'other' },
];

export const PRICE_TYPES: PriceTypeOption[] = [
  { id: 'negotiable', labelKey: 'negotiable' },
  { id: 'fixed', labelKey: 'fixed' },
];

export const QUICK_REQUEST_TEMPLATES: QuickRequestTemplate[] = [
  {
    id: 'template-passenger-car',
    labelKey: 'quickTemplatePassengerCar',
    cargo_type: 'automotive',
    weight: '1800',
    length: '450',
    width: '190',
    height: '170',
  },
  {
    id: 'template-tractor',
    labelKey: 'quickTemplateTractor',
    cargo_type: 'machinery',
    weight: '2800',
    length: '340',
    width: '180',
    height: '220',
  },
  {
    id: 'template-europallet',
    labelKey: 'quickTemplateEuropallet',
    cargo_type: 'construction',
    weight: '800',
    length: '120',
    width: '80',
    height: '150',
  },
  {
    id: 'template-camper',
    labelKey: 'quickTemplateCamper',
    cargo_type: 'campingvogn',
    weight: '1700',
    length: '720',
    width: '245',
    height: '265',
  },
  {
    id: 'template-sofa',
    labelKey: 'quickTemplateSofa',
    cargo_type: 'furniture',
    weight: '130',
    length: '240',
    width: '100',
    height: '95',
  },
];

export const CARGO_TYPE_PRESETS: Record<string, CargoTypePreset> = {
  automotive: {
    weight: '1800',
    length: '450',
    width: '190',
    height: '170',
    hintKey: 'cargoTypeHintAutomotive',
  },
  machinery: {
    weight: '2800',
    length: '340',
    width: '180',
    height: '220',
    hintKey: 'cargoTypeHintMachinery',
  },
  construction: {
    weight: '1200',
    length: '240',
    width: '120',
    height: '120',
    hintKey: 'cargoTypeHintConstruction',
  },
  boats: {
    weight: '2200',
    length: '650',
    width: '250',
    height: '290',
    hintKey: 'cargoTypeHintBoats',
  },
  electronics: {
    weight: '300',
    length: '150',
    width: '80',
    height: '120',
    hintKey: 'cargoTypeHintElectronics',
  },
  campingvogn: {
    weight: '1700',
    length: '720',
    width: '245',
    height: '265',
    hintKey: 'cargoTypeHintCampingvogn',
  },
  furniture: {
    weight: '450',
    length: '260',
    width: '140',
    height: '180',
    hintKey: 'cargoTypeHintFurniture',
  },
  other: {
    weight: '600',
    length: '200',
    width: '120',
    height: '150',
    hintKey: 'cargoTypeHintOther',
  },
};
