/* ASTROMATE built-in place list (offline): name, region, latitude, longitude (east +), IANA time zone. Accuracy about 0.05 degree;
   use the manual latitude/longitude fields for a village or an exact hospital location. India rows share the zone Asia/Kolkata. */
(function (g) {
  'use strict';
  const AM = g.AM;
  const IN = `New Delhi,Delhi,28.6139,77.2090
Mumbai,Maharashtra,19.0760,72.8777
Pune,Maharashtra,18.5204,73.8567
Nagpur,Maharashtra,21.1458,79.0882
Nashik,Maharashtra,19.9975,73.7898
Thane,Maharashtra,19.2183,72.9781
Navi Mumbai,Maharashtra,19.0330,73.0297
Chhatrapati Sambhajinagar (Aurangabad),Maharashtra,19.8762,75.3433
Solapur,Maharashtra,17.6599,75.9064
Kolhapur,Maharashtra,16.7050,74.2433
Amravati,Maharashtra,20.9374,77.7796
Nanded,Maharashtra,19.1383,77.3210
Sangli,Maharashtra,16.8524,74.5815
Jalgaon,Maharashtra,21.0077,75.5626
Akola,Maharashtra,20.7002,77.0082
Latur,Maharashtra,18.4088,76.5604
Ahmednagar,Maharashtra,19.0948,74.7480
Satara,Maharashtra,17.6805,74.0183
Ratnagiri,Maharashtra,16.9902,73.3120
Dhule,Maharashtra,20.9042,74.7749
Chandrapur,Maharashtra,19.9615,79.2961
Ahmedabad,Gujarat,23.0225,72.5714
Surat,Gujarat,21.1702,72.8311
Vadodara,Gujarat,22.3072,73.1812
Rajkot,Gujarat,22.3039,70.8022
Gandhinagar,Gujarat,23.2156,72.6369
Bhavnagar,Gujarat,21.7645,72.1519
Jamnagar,Gujarat,22.4707,70.0577
Junagadh,Gujarat,21.5222,70.4579
Anand,Gujarat,22.5645,72.9289
Mehsana,Gujarat,23.5880,72.3693
Bhuj,Gujarat,23.2420,69.6669
Nadiad,Gujarat,22.6916,72.8634
Porbandar,Gujarat,21.6417,69.6293
Morbi,Gujarat,22.8173,70.8378
Palanpur,Gujarat,24.1725,72.4381
Navsari,Gujarat,20.9467,72.9520
Bharuch,Gujarat,21.7051,72.9959
Surendranagar,Gujarat,22.7277,71.6486
Amreli,Gujarat,21.6032,71.2187
Veraval,Gujarat,20.9159,70.3629
Godhra,Gujarat,22.7788,73.6143
Valsad,Gujarat,20.5992,72.9342
Vapi,Gujarat,20.3893,72.9106
Gandhidham,Gujarat,23.0753,70.1337
Lucknow,Uttar Pradesh,26.8467,80.9462
Kanpur,Uttar Pradesh,26.4499,80.3319
Varanasi,Uttar Pradesh,25.3176,82.9739
Agra,Uttar Pradesh,27.1767,78.0081
Prayagraj (Allahabad),Uttar Pradesh,25.4358,81.8463
Meerut,Uttar Pradesh,28.9845,77.7064
Ghaziabad,Uttar Pradesh,28.6692,77.4538
Noida,Uttar Pradesh,28.5355,77.3910
Bareilly,Uttar Pradesh,28.3670,79.4304
Aligarh,Uttar Pradesh,27.8974,78.0880
Moradabad,Uttar Pradesh,28.8386,78.7733
Gorakhpur,Uttar Pradesh,26.7606,83.3732
Mathura,Uttar Pradesh,27.4924,77.6737
Vrindavan,Uttar Pradesh,27.5800,77.7000
Jhansi,Uttar Pradesh,25.4484,78.5685
Ayodhya,Uttar Pradesh,26.7922,82.1998
Saharanpur,Uttar Pradesh,29.9680,77.5510
Firozabad,Uttar Pradesh,27.1591,78.3957
Muzaffarnagar,Uttar Pradesh,29.4727,77.7085
Rampur,Uttar Pradesh,28.8152,79.0250
Shahjahanpur,Uttar Pradesh,27.8800,79.9100
Mirzapur,Uttar Pradesh,25.1337,82.5644
Etawah,Uttar Pradesh,26.7855,79.0215
Basti,Uttar Pradesh,26.8000,82.7333
Jaipur,Rajasthan,26.9124,75.7873
Jodhpur,Rajasthan,26.2389,73.0243
Udaipur,Rajasthan,24.5854,73.7125
Kota,Rajasthan,25.2138,75.8648
Ajmer,Rajasthan,26.4499,74.6399
Bikaner,Rajasthan,28.0229,73.3119
Alwar,Rajasthan,27.5530,76.6346
Bharatpur,Rajasthan,27.2152,77.5030
Sikar,Rajasthan,27.6094,75.1399
Pali,Rajasthan,25.7711,73.3234
Jaisalmer,Rajasthan,26.9157,70.9083
Sri Ganganagar,Rajasthan,29.9038,73.8772
Bhopal,Madhya Pradesh,23.2599,77.4126
Indore,Madhya Pradesh,22.7196,75.8577
Gwalior,Madhya Pradesh,26.2183,78.1828
Jabalpur,Madhya Pradesh,23.1815,79.9864
Ujjain,Madhya Pradesh,23.1765,75.7885
Sagar,Madhya Pradesh,23.8388,78.7378
Rewa,Madhya Pradesh,24.5362,81.3037
Satna,Madhya Pradesh,24.6005,80.8322
Ratlam,Madhya Pradesh,23.3315,75.0367
Dewas,Madhya Pradesh,22.9676,76.0534
Chhindwara,Madhya Pradesh,22.0574,78.9382
Khandwa,Madhya Pradesh,21.8314,76.3498
Burhanpur,Madhya Pradesh,21.3009,76.2291
Chandigarh,Chandigarh,30.7333,76.7794
Gurugram,Haryana,28.4595,77.0266
Faridabad,Haryana,28.4089,77.3178
Panipat,Haryana,29.3909,76.9635
Ambala,Haryana,30.3782,76.7767
Karnal,Haryana,29.6857,76.9905
Hisar,Haryana,29.1492,75.7217
Rohtak,Haryana,28.8955,76.6066
Sonipat,Haryana,28.9288,77.0913
Kurukshetra,Haryana,29.9695,76.8783
Ludhiana,Punjab,30.9010,75.8573
Amritsar,Punjab,31.6340,74.8723
Jalandhar,Punjab,31.3260,75.5762
Patiala,Punjab,30.3398,76.3869
Bathinda,Punjab,30.2110,74.9455
Mohali,Punjab,30.7046,76.7179
Shimla,Himachal Pradesh,31.1048,77.1734
Dharamshala,Himachal Pradesh,32.2190,76.3234
Manali,Himachal Pradesh,32.2396,77.1887
Solan,Himachal Pradesh,30.9045,77.0967
Mandi,Himachal Pradesh,31.7087,76.9320
Srinagar,Jammu and Kashmir,34.0837,74.7973
Jammu,Jammu and Kashmir,32.7266,74.8570
Leh,Ladakh,34.1526,77.5771
Dehradun,Uttarakhand,30.3165,78.0322
Haridwar,Uttarakhand,29.9457,78.1642
Rishikesh,Uttarakhand,30.0869,78.2676
Haldwani,Uttarakhand,29.2183,79.5130
Roorkee,Uttarakhand,29.8543,77.8880
Nainital,Uttarakhand,29.3919,79.4542
Kolkata,West Bengal,22.5726,88.3639
Howrah,West Bengal,22.5958,88.2636
Durgapur,West Bengal,23.5204,87.3119
Asansol,West Bengal,23.6739,86.9524
Siliguri,West Bengal,26.7271,88.3953
Darjeeling,West Bengal,27.0410,88.2663
Kharagpur,West Bengal,22.3460,87.2320
Bardhaman,West Bengal,23.2324,87.8615
Malda,West Bengal,25.0108,88.1411
Patna,Bihar,25.5941,85.1376
Gaya,Bihar,24.7955,85.0002
Bhagalpur,Bihar,25.2425,86.9842
Muzaffarpur,Bihar,26.1209,85.3647
Darbhanga,Bihar,26.1542,85.8918
Purnia,Bihar,25.7771,87.4753
Arrah,Bihar,25.5560,84.6600
Ranchi,Jharkhand,23.3441,85.3096
Jamshedpur,Jharkhand,22.8046,86.2029
Dhanbad,Jharkhand,23.7957,86.4304
Bokaro,Jharkhand,23.6693,86.1511
Deoghar,Jharkhand,24.4850,86.6947
Bhubaneswar,Odisha,20.2961,85.8245
Cuttack,Odisha,20.4625,85.8830
Rourkela,Odisha,22.2604,84.8536
Puri,Odisha,19.8135,85.8312
Sambalpur,Odisha,21.4669,83.9812
Berhampur,Odisha,19.3150,84.7941
Raipur,Chhattisgarh,21.2514,81.6296
Bhilai,Chhattisgarh,21.2090,81.4285
Bilaspur,Chhattisgarh,22.0797,82.1409
Korba,Chhattisgarh,22.3595,82.7501
Guwahati,Assam,26.1445,91.7362
Dibrugarh,Assam,27.4728,94.9120
Silchar,Assam,24.8333,92.7789
Jorhat,Assam,26.7509,94.2037
Tezpur,Assam,26.6528,92.7926
Itanagar,Arunachal Pradesh,27.0844,93.6053
Imphal,Manipur,24.8170,93.9368
Shillong,Meghalaya,25.5788,91.8933
Aizawl,Mizoram,23.7271,92.7176
Kohima,Nagaland,25.6751,94.1086
Agartala,Tripura,23.8315,91.2868
Gangtok,Sikkim,27.3389,88.6065
Hyderabad,Telangana,17.3850,78.4867
Warangal,Telangana,17.9689,79.5941
Nizamabad,Telangana,18.6725,78.0941
Karimnagar,Telangana,18.4386,79.1288
Khammam,Telangana,17.2473,80.1514
Visakhapatnam,Andhra Pradesh,17.6868,83.2185
Vijayawada,Andhra Pradesh,16.5062,80.6480
Guntur,Andhra Pradesh,16.3067,80.4365
Tirupati,Andhra Pradesh,13.6288,79.4192
Nellore,Andhra Pradesh,14.4426,79.9865
Kurnool,Andhra Pradesh,15.8281,78.0373
Rajahmundry,Andhra Pradesh,17.0005,81.8040
Kakinada,Andhra Pradesh,16.9891,82.2475
Amaravati,Andhra Pradesh,16.5131,80.5160
Anantapur,Andhra Pradesh,14.6819,77.6006
Kadapa,Andhra Pradesh,14.4673,78.8242
Bengaluru,Karnataka,12.9716,77.5946
Mysuru,Karnataka,12.2958,76.6394
Mangaluru,Karnataka,12.9141,74.8560
Hubballi,Karnataka,15.3647,75.1240
Belagavi,Karnataka,15.8497,74.4977
Kalaburagi,Karnataka,17.3297,76.8343
Ballari,Karnataka,15.1394,76.9214
Shivamogga,Karnataka,13.9299,75.5681
Davanagere,Karnataka,14.4644,75.9218
Udupi,Karnataka,13.3409,74.7421
Tumakuru,Karnataka,13.3379,77.1173
Chennai,Tamil Nadu,13.0827,80.2707
Coimbatore,Tamil Nadu,11.0168,76.9558
Madurai,Tamil Nadu,9.9252,78.1198
Tiruchirappalli,Tamil Nadu,10.7905,78.7047
Salem,Tamil Nadu,11.6643,78.1460
Tirunelveli,Tamil Nadu,8.7139,77.7567
Erode,Tamil Nadu,11.3410,77.7172
Vellore,Tamil Nadu,12.9165,79.1325
Thoothukudi,Tamil Nadu,8.7642,78.1348
Thanjavur,Tamil Nadu,10.7870,79.1378
Tiruppur,Tamil Nadu,11.1085,77.3411
Kanyakumari,Tamil Nadu,8.0883,77.5385
Kanchipuram,Tamil Nadu,12.8342,79.7036
Dindigul,Tamil Nadu,10.3673,77.9803
Nagercoil,Tamil Nadu,8.1833,77.4119
Hosur,Tamil Nadu,12.7409,77.8253
Thiruvananthapuram,Kerala,8.5241,76.9366
Kochi,Kerala,9.9312,76.2673
Kozhikode,Kerala,11.2588,75.7804
Thrissur,Kerala,10.5276,76.2144
Kollam,Kerala,8.8932,76.6141
Kannur,Kerala,11.8745,75.3704
Alappuzha,Kerala,9.4981,76.3388
Palakkad,Kerala,10.7867,76.6548
Kottayam,Kerala,9.5916,76.5222
Panaji,Goa,15.4909,73.8278
Margao,Goa,15.2993,73.9580
Vasco da Gama,Goa,15.3982,73.8113
Puducherry,Puducherry,11.9416,79.8083
Port Blair,Andaman and Nicobar,11.6234,92.7265
Daman,Daman and Diu,20.3974,72.8328
Silvassa,Dadra and Nagar Haveli,20.2766,73.0169`;

  const WORLD = `Kathmandu,Nepal,27.7172,85.3240,Asia/Kathmandu
Pokhara,Nepal,28.2096,83.9856,Asia/Kathmandu
Colombo,Sri Lanka,6.9271,79.8612,Asia/Colombo
Kandy,Sri Lanka,7.2906,80.6337,Asia/Colombo
Dhaka,Bangladesh,23.8103,90.4125,Asia/Dhaka
Chittagong,Bangladesh,22.3569,91.7832,Asia/Dhaka
Karachi,Pakistan,24.8607,67.0011,Asia/Karachi
Lahore,Pakistan,31.5497,74.3436,Asia/Karachi
Islamabad,Pakistan,33.6844,73.0479,Asia/Karachi
Thimphu,Bhutan,27.4728,89.6390,Asia/Thimphu
Male,Maldives,4.1755,73.5093,Indian/Maldives
Kabul,Afghanistan,34.5553,69.2075,Asia/Kabul
Yangon,Myanmar,16.8409,96.1735,Asia/Yangon
Dubai,United Arab Emirates,25.2048,55.2708,Asia/Dubai
Abu Dhabi,United Arab Emirates,24.4539,54.3773,Asia/Dubai
Sharjah,United Arab Emirates,25.3463,55.4209,Asia/Dubai
Doha,Qatar,25.2854,51.5310,Asia/Qatar
Riyadh,Saudi Arabia,24.7136,46.6753,Asia/Riyadh
Jeddah,Saudi Arabia,21.4858,39.1925,Asia/Riyadh
Mecca,Saudi Arabia,21.3891,39.8579,Asia/Riyadh
Muscat,Oman,23.5880,58.3829,Asia/Muscat
Kuwait City,Kuwait,29.3759,47.9774,Asia/Kuwait
Manama,Bahrain,26.2285,50.5860,Asia/Bahrain
Tehran,Iran,35.6892,51.3890,Asia/Tehran
Baghdad,Iraq,33.3152,44.3661,Asia/Baghdad
Tel Aviv,Israel,32.0853,34.7818,Asia/Jerusalem
Jerusalem,Israel,31.7683,35.2137,Asia/Jerusalem
Amman,Jordan,31.9454,35.9284,Asia/Amman
Beirut,Lebanon,33.8938,35.5018,Asia/Beirut
Istanbul,Turkey,41.0082,28.9784,Europe/Istanbul
Ankara,Turkey,39.9334,32.8597,Europe/Istanbul
Cairo,Egypt,30.0444,31.2357,Africa/Cairo
Nairobi,Kenya,-1.2921,36.8219,Africa/Nairobi
Mombasa,Kenya,-4.0435,39.6682,Africa/Nairobi
Dar es Salaam,Tanzania,-6.7924,39.2083,Africa/Dar_es_Salaam
Kampala,Uganda,0.3476,32.5825,Africa/Kampala
Addis Ababa,Ethiopia,9.0300,38.7400,Africa/Addis_Ababa
Lagos,Nigeria,6.5244,3.3792,Africa/Lagos
Accra,Ghana,5.6037,-0.1870,Africa/Accra
Johannesburg,South Africa,-26.2041,28.0473,Africa/Johannesburg
Cape Town,South Africa,-33.9249,18.4241,Africa/Johannesburg
Durban,South Africa,-29.8587,31.0218,Africa/Johannesburg
Port Louis,Mauritius,-20.1609,57.5012,Indian/Mauritius
Casablanca,Morocco,33.5731,-7.5898,Africa/Casablanca
Lusaka,Zambia,-15.3875,28.3228,Africa/Lusaka
Harare,Zimbabwe,-17.8252,31.0335,Africa/Harare
Maputo,Mozambique,-25.9692,32.5732,Africa/Maputo
Kigali,Rwanda,-1.9441,30.0619,Africa/Kigali
Antananarivo,Madagascar,-18.8792,47.5079,Indian/Antananarivo
Algiers,Algeria,36.7538,3.0588,Africa/Algiers
Tunis,Tunisia,36.8065,10.1815,Africa/Tunis
London,United Kingdom,51.5074,-0.1278,Europe/London
Manchester,United Kingdom,53.4808,-2.2426,Europe/London
Birmingham,United Kingdom,52.4862,-1.8904,Europe/London
Leicester,United Kingdom,52.6369,-1.1398,Europe/London
Glasgow,United Kingdom,55.8642,-4.2518,Europe/London
Edinburgh,United Kingdom,55.9533,-3.1883,Europe/London
Dublin,Ireland,53.3498,-6.2603,Europe/Dublin
Paris,France,48.8566,2.3522,Europe/Paris
Marseille,France,43.2965,5.3698,Europe/Paris
Lyon,France,45.7640,4.8357,Europe/Paris
Berlin,Germany,52.5200,13.4050,Europe/Berlin
Frankfurt,Germany,50.1109,8.6821,Europe/Berlin
Munich,Germany,48.1351,11.5820,Europe/Berlin
Hamburg,Germany,53.5511,9.9937,Europe/Berlin
Madrid,Spain,40.4168,-3.7038,Europe/Madrid
Barcelona,Spain,41.3874,2.1686,Europe/Madrid
Lisbon,Portugal,38.7223,-9.1393,Europe/Lisbon
Rome,Italy,41.9028,12.4964,Europe/Rome
Milan,Italy,45.4642,9.1900,Europe/Rome
Amsterdam,Netherlands,52.3676,4.9041,Europe/Amsterdam
Brussels,Belgium,50.8503,4.3517,Europe/Brussels
Zurich,Switzerland,47.3769,8.5417,Europe/Zurich
Geneva,Switzerland,46.2044,6.1432,Europe/Zurich
Vienna,Austria,48.2082,16.3738,Europe/Vienna
Prague,Czechia,50.0755,14.4378,Europe/Prague
Warsaw,Poland,52.2297,21.0122,Europe/Warsaw
Budapest,Hungary,47.4979,19.0402,Europe/Budapest
Athens,Greece,37.9838,23.7275,Europe/Athens
Stockholm,Sweden,59.3293,18.0686,Europe/Stockholm
Oslo,Norway,59.9139,10.7522,Europe/Oslo
Copenhagen,Denmark,55.6761,12.5683,Europe/Copenhagen
Helsinki,Finland,60.1699,24.9384,Europe/Helsinki
Moscow,Russia,55.7558,37.6173,Europe/Moscow
Kyiv,Ukraine,50.4501,30.5234,Europe/Kyiv
Bucharest,Romania,44.4268,26.1025,Europe/Bucharest
New York,USA,40.7128,-74.0060,America/New_York
Boston,USA,42.3601,-71.0589,America/New_York
Washington DC,USA,38.9072,-77.0369,America/New_York
Philadelphia,USA,39.9526,-75.1652,America/New_York
Edison (New Jersey),USA,40.5187,-74.4121,America/New_York
Atlanta,USA,33.7490,-84.3880,America/New_York
Miami,USA,25.7617,-80.1918,America/New_York
Orlando,USA,28.5383,-81.3792,America/New_York
Detroit,USA,42.3314,-83.0458,America/Detroit
Chicago,USA,41.8781,-87.6298,America/Chicago
Houston,USA,29.7604,-95.3698,America/Chicago
Dallas,USA,32.7767,-96.7970,America/Chicago
Austin,USA,30.2672,-97.7431,America/Chicago
Minneapolis,USA,44.9778,-93.2650,America/Chicago
Denver,USA,39.7392,-104.9903,America/Denver
Phoenix,USA,33.4484,-112.0740,America/Phoenix
Los Angeles,USA,34.0522,-118.2437,America/Los_Angeles
San Francisco,USA,37.7749,-122.4194,America/Los_Angeles
San Jose,USA,37.3382,-121.8863,America/Los_Angeles
Seattle,USA,47.6062,-122.3321,America/Los_Angeles
Las Vegas,USA,36.1699,-115.1398,America/Los_Angeles
Portland,USA,45.5152,-122.6784,America/Los_Angeles
Honolulu,USA,21.3069,-157.8583,Pacific/Honolulu
Anchorage,USA,61.2181,-149.9003,America/Anchorage
Toronto,Canada,43.6532,-79.3832,America/Toronto
Montreal,Canada,45.5017,-73.5673,America/Toronto
Ottawa,Canada,45.4215,-75.6972,America/Toronto
Vancouver,Canada,49.2827,-123.1207,America/Vancouver
Calgary,Canada,51.0447,-114.0719,America/Edmonton
Mexico City,Mexico,19.4326,-99.1332,America/Mexico_City
Sao Paulo,Brazil,-23.5505,-46.6333,America/Sao_Paulo
Rio de Janeiro,Brazil,-22.9068,-43.1729,America/Sao_Paulo
Buenos Aires,Argentina,-34.6037,-58.3816,America/Argentina/Buenos_Aires
Santiago,Chile,-33.4489,-70.6693,America/Santiago
Lima,Peru,-12.0464,-77.0428,America/Lima
Bogota,Colombia,4.7110,-74.0721,America/Bogota
Caracas,Venezuela,10.4806,-66.9036,America/Caracas
Georgetown,Guyana,6.8013,-58.1551,America/Guyana
Paramaribo,Suriname,5.8520,-55.2038,America/Paramaribo
Port of Spain,Trinidad and Tobago,10.6549,-61.5019,America/Port_of_Spain
Kingston,Jamaica,17.9714,-76.7920,America/Jamaica
Singapore,Singapore,1.3521,103.8198,Asia/Singapore
Kuala Lumpur,Malaysia,3.1390,101.6869,Asia/Kuala_Lumpur
Penang,Malaysia,5.4141,100.3288,Asia/Kuala_Lumpur
Bangkok,Thailand,13.7563,100.5018,Asia/Bangkok
Jakarta,Indonesia,-6.2088,106.8456,Asia/Jakarta
Denpasar (Bali),Indonesia,-8.6705,115.2126,Asia/Makassar
Manila,Philippines,14.5995,120.9842,Asia/Manila
Hanoi,Vietnam,21.0285,105.8542,Asia/Ho_Chi_Minh
Ho Chi Minh City,Vietnam,10.8231,106.6297,Asia/Ho_Chi_Minh
Phnom Penh,Cambodia,11.5564,104.9282,Asia/Phnom_Penh
Hong Kong,China,22.3193,114.1694,Asia/Hong_Kong
Shanghai,China,31.2304,121.4737,Asia/Shanghai
Beijing,China,39.9042,116.4074,Asia/Shanghai
Shenzhen,China,22.5431,114.0579,Asia/Shanghai
Taipei,Taiwan,25.0330,121.5654,Asia/Taipei
Tokyo,Japan,35.6762,139.6503,Asia/Tokyo
Osaka,Japan,34.6937,135.5023,Asia/Tokyo
Seoul,South Korea,37.5665,126.9780,Asia/Seoul
Ulaanbaatar,Mongolia,47.8864,106.9057,Asia/Ulaanbaatar
Tashkent,Uzbekistan,41.2995,69.2401,Asia/Tashkent
Almaty,Kazakhstan,43.2220,76.8512,Asia/Almaty
Baku,Azerbaijan,40.4093,49.8671,Asia/Baku
Sydney,Australia,-33.8688,151.2093,Australia/Sydney
Melbourne,Australia,-37.8136,144.9631,Australia/Melbourne
Brisbane,Australia,-27.4698,153.0251,Australia/Brisbane
Perth,Australia,-31.9505,115.8605,Australia/Perth
Adelaide,Australia,-34.9285,138.6007,Australia/Adelaide
Auckland,New Zealand,-36.8485,174.7633,Pacific/Auckland
Wellington,New Zealand,-41.2866,174.7756,Pacific/Auckland
Suva,Fiji,-18.1248,178.4501,Pacific/Fiji`;

  const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const parse = (text, defaultTz, country) => text.split('\n').map((line) => {
    const p = line.split(',');
    const n = p.length;
    const tz = defaultTz || p[n - 1];
    const lon = parseFloat(defaultTz ? p[n - 1] : p[n - 2]); const lat = parseFloat(defaultTz ? p[n - 2] : p[n - 3]);
    const region = defaultTz ? p[n - 3] : p[n - 4];
    const name = p.slice(0, defaultTz ? n - 3 : n - 4).join(',');
    return { name, region, country: country || region, lat, lon, tz, key: norm(name + ' ' + region + ' ' + (country || '')) };
  });
  const CITIES = parse(IN, 'Asia/Kolkata', 'India').concat(parse(WORLD, null, null));
  CITIES.forEach((c, i) => { c.id = 'c' + i; if (c.country === c.region) c.region = ''; });

  function label(c) { return c.name + (c.region ? ', ' + c.region : '') + (c.country && c.country !== c.region ? ', ' + c.country : ''); }
  function search(q, limit) {
    const s = norm(q).trim();
    if (!s) return CITIES.slice(0, limit || 8);
    const scored = [];
    for (const c of CITIES) {
      const n = norm(c.name); let sc = 0;
      if (n === s) sc = 100; else if (n.indexOf(s) === 0) sc = 80; else if (n.split(/[ (]/).some((w) => w.indexOf(s) === 0)) sc = 60; else if (c.key.indexOf(s) >= 0) sc = 40;
      if (sc) scored.push([sc - (c.country === 'India' ? 0 : 0.5), c]);
    }
    scored.sort((a, b) => b[0] - a[0] || a[1].name.localeCompare(b[1].name));
    return scored.slice(0, limit || 8).map((x) => x[1]);
  }
  /** Optional online lookup (Open-Meteo geocoding, no key). Only the typed place name is sent. */
  async function searchOnline(q) {
    const url = 'https://geocoding-api.open-meteo.com/v1/search?count=8&language=en&format=json&name=' + encodeURIComponent(q);
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 9000);
    try {
      const r = await fetch(url, { signal: ctl.signal });
      if (!r.ok) throw new Error('lookup failed');
      const j = await r.json();
      return (j.results || []).filter((x) => x.timezone).map((x) => ({ id: 'o' + x.id, name: x.name, region: x.admin1 || '', country: x.country || '', lat: x.latitude, lon: x.longitude, tz: x.timezone, online: true }));
    } finally { clearTimeout(t); }
  }
  function validTz(tz) { try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch (e) { return false; } }
  AM.cities = { list: CITIES, search, searchOnline, label, validTz, byId: (id) => CITIES.find((c) => c.id === id) };
})(typeof window !== 'undefined' ? window : globalThis);
