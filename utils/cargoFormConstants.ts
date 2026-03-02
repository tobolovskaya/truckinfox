export interface CargoTypePreset {
  weight: string;
  length: string;
  width: string;
  height: string;
  hint: string;
}

export interface CargoTypeOption {
  id: string;
  label: string;
}

export interface PriceTypeOption {
  id: string;
  label: string;
}

export const CARGO_TYPES: CargoTypeOption[] = [
  { id: 'automotive', label: 'Bil/Motor' },
  { id: 'construction', label: 'Byggemateriale' },
  { id: 'boats', label: 'Båter' },
  { id: 'electronics', label: 'Elektronikk' },
  { id: 'campingvogn', label: 'Campingvogn' },
  { id: 'machinery', label: 'Maskineri' },
  { id: 'furniture', label: 'Møbler' },
  { id: 'other', label: 'Annet' },
];

export const PRICE_TYPES: PriceTypeOption[] = [
  { id: 'negotiable', label: 'Kan forhandles' },
  { id: 'fixed', label: 'Fast pris' },
];

export const CARGO_TYPE_PRESETS: Record<string, CargoTypePreset> = {
  automotive: {
    weight: '1800',
    length: '450',
    width: '190',
    height: '170',
    hint: 'Bil/motor: legg gjerne inn om kjøretøyet starter, ruller og har løse deler.',
  },
  machinery: {
    weight: '2800',
    length: '340',
    width: '180',
    height: '220',
    hint: 'Maskineri/traktor: oppgi om maskinen kan kjøres selv og om skuffe/utstyr følger med.',
  },
  construction: {
    weight: '1200',
    length: '240',
    width: '120',
    height: '120',
    hint: 'Byggemateriale: oppgi antall paller/pakker og om levering krever kran eller bakløfter.',
  },
  boats: {
    weight: '2200',
    length: '650',
    width: '250',
    height: '290',
    hint: 'Båt: skriv total lengde inkl. henger/stativ og om mast eller løse deler er demontert.',
  },
  electronics: {
    weight: '300',
    length: '150',
    width: '80',
    height: '120',
    hint: 'Elektronikk: oppgi om varene er palletert/emballert og om de er ekstra støtfølsomme.',
  },
  campingvogn: {
    weight: '1700',
    length: '720',
    width: '245',
    height: '265',
    hint: 'Campingvogn: oppgi totalvekt, bredde og om den er registrert/klar for tauing.',
  },
  furniture: {
    weight: '450',
    length: '260',
    width: '140',
    height: '180',
    hint: 'Møbler: skriv om møbler kan stables og om bæring i trapper kreves ved henting/levering.',
  },
  other: {
    weight: '600',
    length: '200',
    width: '120',
    height: '150',
    hint: 'Annet: bruk beskrivelsen til å forklare håndtering, løftebehov og spesielle hensyn.',
  },
};
