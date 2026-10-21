export const CONFIG = {
  gasUrl: '',                      // GAS web app URL, filled in at deploy (Task 10)
  tierBounds: [0.20, 0.40, 0.60],
  vetoPop: 50,
  lowCloudFt: 3000,
  highCloudFt: 8000,
  hazeVisKm: 5,
  hazeSpreadC: 2,
  metarMaxAgeMin: 90,
  clearSkyCloudCover: 0.10,
  summitMetarFromHour: 15,         // Taipei hour from which METAR counts for the summit flag
  tafEveningUtcHours: [9, 10],     // 17–18 Taipei
};
