export const CONFIG = {
  gasUrl: 'https://script.google.com/macros/s/AKfycbxkiYtlZfftMuMW8RQNFCfpmdpsAjvJJwaqYWnzV5KHONhtNSGiXyb0MZI2UzFuQeme/exec',
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
