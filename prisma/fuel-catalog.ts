export const FUEL_CATALOG = [
    { code: 'GASOLINE_REGULAR', name: 'Gasolina Regular' },
    { code: 'GASOLINE_PREMIUM', name: 'Gasolina Premium' },
    { code: 'DIESEL', name: 'Diesel' },
    { code: 'DIESEL_UBA', name: 'Diesel UBA' },
    { code: 'LPG', name: 'Gas LP' },
    { code: 'CNG', name: 'Gas Natural Vehicular' },
    { code: 'ELECTRIC', name: 'Electrico' },
    { code: 'BIODIESEL', name: 'Biodiesel' },
    { code: 'ETHANOL_E85', name: 'Etanol E85' },
    { code: 'HYDROGEN', name: 'Hidrogeno' },
] as const;

export type FuelCatalogCode = (typeof FUEL_CATALOG)[number]['code'];
