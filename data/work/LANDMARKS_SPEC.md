# Historical landmarks of Makkah and Madinah (map mode "Zaman Nabi ﷺ")

Goal: the natural and built landmarks of Makkah or Madinah **as they were in the Prophet's ﷺ time**, each a cited
point, so the map can show an era view (terrain without modern roads + these points). "jangan sampai salah":
**never cite a page you have not read; never guess a coordinate.**

Follow data/work/PLACES_SPEC.md for tools (books.py, geo.py search/osm/get), citation and coordinate rules
(tepat / perkiraan only to a concrete locality / null). Output `data/work/places_out/_<city>.json`
(`_makkah` or `_madinah`, id = file name), same schema as tribe places, 25–45 places:

- mountains and passes (e.g. Abu Qubais, Hira', Tsaur, Qu'aiqi'an, Kada', Kuda / Uhud, Sal', 'Air, Tsaur, 'Ainain)
- wadis and harrahs (Ibrahim, al-Muhashshab, 'Uranah / Bathhan, al-'Aqiq, Qanah, Mudzainib, Harrat Waqim, Wabarah)
- wells and springs of that era (Zamzam, Thawa… / Ruma, Budha'ah, Aris, Ha', Ghars)
- mosques and sites of the Prophet's ﷺ time (al-Masjid al-Haram, Dar al-Arqam, Syi'b Abi Thalib, Dar an-Nadwah… /
  Masjid Nabawi, Quba, al-Qiblatain, Bani Zuraiq, al-Baqi', Saqifah Bani Sa'idah, the Khandaq, Uhud battlefield)
- quarters/dwellings of clans if the book states them (Ajyad, al-Hajun / al-'Aliyah, as-Sunh, Quba of Bani 'Amr bin 'Auf)

`note`: what the page says about the place in that era (Indonesian, terse). `kind` ∈ kota, desa, lembah, gunung,
mata air, sumur, masjid, harrah, daerah, distrik, benteng, pasar, rumah. Prefer books 23735 Mu'jam al-Buldan,
11802 Mu'jam ma Ista'jam, 23833 Sirah, 9351 Ibnu Sa'd, 1681 Shahih al-Bukhari.
Validate `python3 scripts/check_places.py _<city>` until ALL OK. Edit nothing else.
Final reply ≤120 words: places with exact / approximate / no coordinates.
