/** Searchable Irish plant-protection products commonly used on grassland and tillage.
 *  Official live register: https://www.pcs.agriculture.gov.ie/products/
 *  Always check the current PCS label, rate and crop before spraying.
 */
export interface PcsProduct {
  name: string
  pcs: string
  active: string
  fn: string
  unit: 'L/ha' | 'kg/ha' | 'g/ha'
  typicalRate: number
}

export const PCS_PRODUCTS: PcsProduct[] = [
  { name: 'Roundup Biactive', pcs: '02379', active: 'Glyphosate', fn: 'Herbicide', unit: 'L/ha', typicalRate: 4 },
  { name: 'Roundup Energy', pcs: '04532', active: 'Glyphosate', fn: 'Herbicide', unit: 'L/ha', typicalRate: 3 },
  { name: 'Gallup Biograde 360', pcs: '03780', active: 'Glyphosate', fn: 'Herbicide', unit: 'L/ha', typicalRate: 4 },
  { name: 'Clinic Ace', pcs: '04611', active: 'Glyphosate', fn: 'Herbicide', unit: 'L/ha', typicalRate: 4 },
  { name: 'MCPA 500', pcs: '01820', active: 'MCPA', fn: 'Herbicide', unit: 'L/ha', typicalRate: 2.7 },
  { name: 'Agrichem MCPA 500', pcs: '02410', active: 'MCPA', fn: 'Herbicide', unit: 'L/ha', typicalRate: 2.7 },
  { name: 'Agritox', pcs: '00112', active: 'MCPA', fn: 'Herbicide', unit: 'L/ha', typicalRate: 2.7 },
  { name: 'Forefront T', pcs: '03754', active: 'Aminopyralid + Triclopyr', fn: 'Herbicide', unit: 'L/ha', typicalRate: 2 },
  { name: 'Doxstar Pro', pcs: '04690', active: 'Fluroxypyr + Triclopyr', fn: 'Herbicide', unit: 'L/ha', typicalRate: 2 },
  { name: 'Pastor Pro', pcs: '05021', active: 'Clopyralid + Fluroxypyr + Triclopyr', fn: 'Herbicide', unit: 'L/ha', typicalRate: 3 },
  { name: 'Envy', pcs: '05140', active: 'Fluroxypyr + Florasulam', fn: 'Herbicide', unit: 'L/ha', typicalRate: 1.5 },
  { name: 'Leystar', pcs: '04980', active: 'Fluroxypyr + Clopyralid + Florasulam', fn: 'Herbicide', unit: 'L/ha', typicalRate: 1 },
  { name: 'Thrust', pcs: '04210', active: '2,4-D + Dicamba', fn: 'Herbicide', unit: 'L/ha', typicalRate: 3.5 },
  { name: 'Depitox', pcs: '01550', active: '2,4-D', fn: 'Herbicide', unit: 'L/ha', typicalRate: 3 },
  { name: 'Hurler', pcs: '03820', active: 'Fluroxypyr', fn: 'Herbicide', unit: 'L/ha', typicalRate: 2 },
  { name: 'Starane Hi-Load', pcs: '04012', active: 'Fluroxypyr', fn: 'Herbicide', unit: 'L/ha', typicalRate: 0.8 },
  { name: 'Grazon Pro', pcs: '03640', active: 'Clopyralid + Triclopyr', fn: 'Herbicide', unit: 'L/ha', typicalRate: 0.06 },
  { name: 'Garlon 4', pcs: '01220', active: 'Triclopyr', fn: 'Herbicide', unit: 'L/ha', typicalRate: 2 },
  { name: 'Tordon 22K', pcs: '00880', active: 'Picloram', fn: 'Herbicide', unit: 'L/ha', typicalRate: 2 },
  { name: 'Kerb Flo', pcs: '02510', active: 'Propyzamide', fn: 'Herbicide', unit: 'L/ha', typicalRate: 2.1 },
  { name: 'Centurion Max', pcs: '04820', active: 'Clethodim', fn: 'Herbicide', unit: 'L/ha', typicalRate: 1 },
  { name: 'Fusilade Max', pcs: '02740', active: 'Fluazifop-P-butyl', fn: 'Herbicide', unit: 'L/ha', typicalRate: 1.5 },
  { name: 'Stratos Ultra', pcs: '03310', active: 'Cycloxydim', fn: 'Herbicide', unit: 'L/ha', typicalRate: 2 },
  { name: 'Ally Max SX', pcs: '03480', active: 'Metsulfuron + Tribenuron', fn: 'Herbicide', unit: 'g/ha', typicalRate: 42 },
  { name: 'Harmony M SX', pcs: '02990', active: 'Thifensulfuron + Metsulfuron', fn: 'Herbicide', unit: 'g/ha', typicalRate: 60 },
  { name: 'Hiker', pcs: '04710', active: 'Metsulfuron-methyl', fn: 'Herbicide', unit: 'g/ha', typicalRate: 30 },
  { name: 'Eagle', pcs: '03120', active: 'Amidosulfuron', fn: 'Herbicide', unit: 'g/ha', typicalRate: 40 },
  { name: 'Squire Ultra', pcs: '04150', active: 'Amidosulfuron', fn: 'Herbicide', unit: 'g/ha', typicalRate: 40 },
  { name: 'Clovermax', pcs: '03940', active: 'Benazolin + 2,4-DB', fn: 'Herbicide', unit: 'L/ha', typicalRate: 5 },
  { name: 'Undersown ley spray (MCPA + MCPB)', pcs: '02100', active: 'MCPA + MCPB', fn: 'Herbicide', unit: 'L/ha', typicalRate: 4 },
  { name: 'Axial', pcs: '03560', active: 'Pinoxaden', fn: 'Herbicide', unit: 'L/ha', typicalRate: 0.6 },
  { name: 'Broadway Star', pcs: '04370', active: 'Pyroxsulam + Florasulam', fn: 'Herbicide', unit: 'g/ha', typicalRate: 265 },
  { name: 'Pacifica Plus', pcs: '04420', active: 'Mesosulfuron + Iodosulfuron + Amidosulfuron', fn: 'Herbicide', unit: 'g/ha', typicalRate: 500 },
  { name: 'Liberator', pcs: '03280', active: 'Flufenacet + DFF', fn: 'Herbicide', unit: 'L/ha', typicalRate: 0.6 },
  { name: 'Crystal', pcs: '03690', active: 'Flufenacet + Pendimethalin', fn: 'Herbicide', unit: 'L/ha', typicalRate: 4 },
  { name: 'Stomp Aqua', pcs: '02850', active: 'Pendimethalin', fn: 'Herbicide', unit: 'L/ha', typicalRate: 2.9 },
  { name: 'Defy', pcs: '03040', active: 'Prosulfocarb', fn: 'Herbicide', unit: 'L/ha', typicalRate: 5 },
  { name: 'Hurricane', pcs: '03890', active: 'Diflufenican', fn: 'Herbicide', unit: 'L/ha', typicalRate: 0.25 },
  { name: 'Boxer', pcs: '02670', active: 'Prosulfocarb', fn: 'Herbicide', unit: 'L/ha', typicalRate: 5 },
  { name: 'Proline', pcs: '03380', active: 'Prothioconazole', fn: 'Fungicide', unit: 'L/ha', typicalRate: 0.8 },
  { name: 'Proline 275', pcs: '04580', active: 'Prothioconazole', fn: 'Fungicide', unit: 'L/ha', typicalRate: 0.72 },
  { name: 'Elatus Era', pcs: '04910', active: 'Benzovindiflupyr + Prothioconazole', fn: 'Fungicide', unit: 'L/ha', typicalRate: 1 },
  { name: 'Ascra Xpro', pcs: '04870', active: 'Bixafen + Fluopyram + Prothioconazole', fn: 'Fungicide', unit: 'L/ha', typicalRate: 1.5 },
  { name: 'Aviator Xpro', pcs: '04280', active: 'Bixafen + Prothioconazole', fn: 'Fungicide', unit: 'L/ha', typicalRate: 1.25 },
  { name: 'Revystar XL', pcs: '05240', active: 'Mefentrifluconazole + Fluxapyroxad', fn: 'Fungicide', unit: 'L/ha', typicalRate: 1.5 },
  { name: 'Imtrex', pcs: '04650', active: 'Fluxapyroxad', fn: 'Fungicide', unit: 'L/ha', typicalRate: 1.5 },
  { name: 'Adexar', pcs: '04080', active: 'Fluxapyroxad + Epoxiconazole', fn: 'Fungicide', unit: 'L/ha', typicalRate: 2 },
  { name: 'Comet 200', pcs: '02790', active: 'Pyraclostrobin', fn: 'Fungicide', unit: 'L/ha', typicalRate: 1.25 },
  { name: 'Amistar', pcs: '01890', active: 'Azoxystrobin', fn: 'Fungicide', unit: 'L/ha', typicalRate: 1 },
  { name: 'Amistar Opti', pcs: '03420', active: 'Azoxystrobin + Chlorothalonil', fn: 'Fungicide', unit: 'L/ha', typicalRate: 2.5 },
  { name: 'Bravo 500', pcs: '01140', active: 'Chlorothalonil', fn: 'Fungicide', unit: 'L/ha', typicalRate: 2 },
  { name: 'Phoenix', pcs: '03980', active: 'Folpet', fn: 'Fungicide', unit: 'L/ha', typicalRate: 1.5 },
  { name: 'Arizona', pcs: '04780', active: 'Folpet', fn: 'Fungicide', unit: 'L/ha', typicalRate: 1.5 },
  { name: 'Talius', pcs: '03510', active: 'Proquinazid', fn: 'Fungicide', unit: 'L/ha', typicalRate: 0.25 },
  { name: 'Meltatox', pcs: '02230', active: 'Dodemorph', fn: 'Fungicide', unit: 'L/ha', typicalRate: 2.5 },
  { name: 'Coragen', pcs: '03720', active: 'Chlorantraniliprole', fn: 'Insecticide', unit: 'L/ha', typicalRate: 0.175 },
  { name: 'Aphox', pcs: '00950', active: 'Pirimicarb', fn: 'Insecticide', unit: 'kg/ha', typicalRate: 0.28 },
  { name: 'Hallmark Zeon', pcs: '02480', active: 'Lambda-cyhalothrin', fn: 'Insecticide', unit: 'L/ha', typicalRate: 0.075 },
  { name: 'Mavrik', pcs: '01670', active: 'Tau-fluvalinate', fn: 'Insecticide', unit: 'L/ha', typicalRate: 0.2 },
  { name: 'Minecta', pcs: '05110', active: 'Cyantraniliprole', fn: 'Insecticide', unit: 'kg/ha', typicalRate: 0.2 },
  { name: 'Biscaya', pcs: '03180', active: 'Thiacloprid', fn: 'Insecticide', unit: 'L/ha', typicalRate: 0.4 },
  { name: 'Moddus', pcs: '02310', active: 'Trinexapac-ethyl', fn: 'PGR', unit: 'L/ha', typicalRate: 0.4 },
  { name: 'Moddus Start', pcs: '04490', active: 'Trinexapac-ethyl', fn: 'PGR', unit: 'L/ha', typicalRate: 0.25 },
  { name: 'Terpal', pcs: '01440', active: 'Ethephon + Mepiquat', fn: 'PGR', unit: 'L/ha', typicalRate: 2 },
  { name: 'Cerone', pcs: '01080', active: 'Ethephon', fn: 'PGR', unit: 'L/ha', typicalRate: 0.75 },
  { name: 'Adjust', pcs: '04120', active: 'Trinexapac-ethyl', fn: 'PGR', unit: 'L/ha', typicalRate: 0.4 },
  { name: 'Chlormequat 750', pcs: '00720', active: 'Chlormequat', fn: 'PGR', unit: 'L/ha', typicalRate: 2.3 },
  { name: 'Trace element Mn', pcs: 'TE-MN', active: 'Manganese', fn: 'Nutrient', unit: 'L/ha', typicalRate: 1 },
  { name: 'Trace element Cu', pcs: 'TE-CU', active: 'Copper', fn: 'Nutrient', unit: 'L/ha', typicalRate: 1 },
  { name: 'Wetting agent / adjuvant', pcs: 'ADJ-01', active: 'Adjuvant', fn: 'Adjuvant', unit: 'L/ha', typicalRate: 0.1 },
  { name: 'Slug pellets (metaldehyde)', pcs: '01980', active: 'Metaldehyde', fn: 'Molluscicide', unit: 'kg/ha', typicalRate: 7 },
  { name: 'Sluxx HP', pcs: '04050', active: 'Ferric phosphate', fn: 'Molluscicide', unit: 'kg/ha', typicalRate: 7 },
  { name: 'Ranman Top', pcs: '03840', active: 'Cyazofamid', fn: 'Fungicide', unit: 'L/ha', typicalRate: 0.5 },
  { name: 'Revus', pcs: '03610', active: 'Mandipropamid', fn: 'Fungicide', unit: 'L/ha', typicalRate: 0.6 },
  { name: 'Infinito', pcs: '03450', active: 'Fluopicolide + Propamocarb', fn: 'Fungicide', unit: 'L/ha', typicalRate: 1.6 },
  { name: 'Shirlan', pcs: '02040', active: 'Fluazinam', fn: 'Fungicide', unit: 'L/ha', typicalRate: 0.4 },
  { name: 'Zorvec Enicade', pcs: '05080', active: 'Oxathiapiprolin', fn: 'Fungicide', unit: 'L/ha', typicalRate: 0.15 },
  { name: 'Karate Zeon', pcs: '02590', active: 'Lambda-cyhalothrin', fn: 'Insecticide', unit: 'L/ha', typicalRate: 0.075 },
  { name: 'Decis Protech', pcs: '02280', active: 'Deltamethrin', fn: 'Insecticide', unit: 'L/ha', typicalRate: 0.3 },
  { name: 'Siltra Xpro', pcs: '04330', active: 'Bixafen + Prothioconazole', fn: 'Fungicide', unit: 'L/ha', typicalRate: 1 },
  { name: 'Fandango', pcs: '03220', active: 'Fluoxastrobin + Prothioconazole', fn: 'Fungicide', unit: 'L/ha', typicalRate: 1.5 },
  { name: 'Kestrel', pcs: '04740', active: 'Prothioconazole + Tebuconazole', fn: 'Fungicide', unit: 'L/ha', typicalRate: 1 },
  { name: 'Prosaro', pcs: '02910', active: 'Prothioconazole + Tebuconazole', fn: 'Fungicide', unit: 'L/ha', typicalRate: 1 },
  { name: 'Folicur', pcs: '01360', active: 'Tebuconazole', fn: 'Fungicide', unit: 'L/ha', typicalRate: 1 },
  { name: 'Sportak', pcs: '00810', active: 'Prochloraz', fn: 'Fungicide', unit: 'L/ha', typicalRate: 1 },
  { name: 'Crawler', pcs: '03910', active: 'Carfentrazone', fn: 'Herbicide', unit: 'g/ha', typicalRate: 60 },
  { name: 'Zypar', pcs: '04840', active: 'Arylex + Florasulam', fn: 'Herbicide', unit: 'L/ha', typicalRate: 0.75 },
  { name: 'Pixxaro', pcs: '04950', active: 'Arylex + Fluroxypyr', fn: 'Herbicide', unit: 'L/ha', typicalRate: 0.5 },
  { name: 'Spitfire', pcs: '04180', active: 'Fluroxypyr + Florasulam', fn: 'Herbicide', unit: 'L/ha', typicalRate: 0.75 },
  { name: 'Foundry', pcs: '05040', active: 'Halauxifen + Florasulam', fn: 'Herbicide', unit: 'g/ha', typicalRate: 50 },
]

export function searchPcs(q: string) {
  const s = q.trim().toLowerCase()
  if (!s) return PCS_PRODUCTS.slice(0, 40)
  return PCS_PRODUCTS.filter(
    (p) =>
      p.name.toLowerCase().includes(s) ||
      p.active.toLowerCase().includes(s) ||
      p.pcs.includes(s) ||
      p.fn.toLowerCase().includes(s)
  )
}
