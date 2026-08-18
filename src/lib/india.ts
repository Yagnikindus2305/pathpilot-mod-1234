import districtsByState from '@/data/india_districts.json';
import citiesByDistrict from '@/data/india_cities.json';

export function getDistrictsForState(state: string): string[] {
  return (districtsByState as Record<string, string[]>)[state] || [];
}

// Sourced from India Post's official pincode directory (state/district/block),
// grouped by district. Coverage is real but not complete — newer districts
// (e.g. Andhra Pradesh's 2022 splits) predate this data, so some districts
// return no cities; the UI falls back to a free-text "Other" entry for those.
export function getCitiesForDistrict(district: string): string[] {
  return (citiesByDistrict as Record<string, string[]>)[district] || [];
}

export const INDIAN_STATES: string[] = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
  'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh',
  'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi (NCT)', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];
