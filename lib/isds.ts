export interface ISDEntry {
  name: string
  state: string
  hacUrl?: string        // K-12 HAC portal URL (not set for colleges)
  canvasUrl?: string     // hostname only, e.g. "katyisd.instructure.com"
  classlinkId?: string   // ClassLink district slug (districtConfig.ts)
}

export const ISD_LIST: ISDEntry[] = [
  // Texas
  { name: 'Aldine ISD',                       state: 'TX', hacUrl: 'https://hac.aldineisd.org',               canvasUrl: 'aldine.instructure.com' },
  { name: 'Allen ISD',                         state: 'TX', hacUrl: 'https://hac.allenisd.org',                canvasUrl: 'allenisd.instructure.com' },
  { name: 'Alvin ISD',                         state: 'TX', hacUrl: 'https://homeaccess.alvinisd.net' },
  { name: 'Brenham ISD',                       state: 'TX', hacUrl: 'https://hac.bisd.us' },
  { name: 'Burleson ISD',                      state: 'TX', hacUrl: 'https://hac.burlesonisd.net' },
  { name: 'Canutillo ISD',                     state: 'TX', hacUrl: 'https://hac.canutillo-isd.org' },
  { name: 'Cedar Hill ISD',                    state: 'TX', hacUrl: 'https://hac.chisd.net' },
  { name: 'College Station ISD',               state: 'TX', hacUrl: 'https://hac.csisd.org',                  canvasUrl: 'csisd.instructure.com' },
  { name: 'Conroe ISD',                        state: 'TX', hacUrl: 'https://hac.conroeisd.net',              canvasUrl: 'conroeisd.instructure.com' },
  { name: 'Corpus Christi ISD',                state: 'TX', hacUrl: 'https://hac.ccisd.us' },
  { name: 'Cypress-Fairbanks ISD',             state: 'TX', hacUrl: 'https://home-access.cfisd.net',         canvasUrl: 'cfisd.instructure.com' },
  { name: 'Denton ISD',                        state: 'TX', hacUrl: 'https://denhac.dentonisd.org',           canvasUrl: 'dentonisd.instructure.com' },
  { name: 'DeSoto ISD',                        state: 'TX', hacUrl: 'https://hac.desotoisd.org' },
  { name: 'Duncanville ISD',                   state: 'TX', hacUrl: 'https://hac.duncanvilleisd.org' },
  { name: 'Ector County ISD (Odessa)',          state: 'TX', hacUrl: 'https://hac.ectorcountyisd.org' },
  { name: 'Frisco ISD',                        state: 'TX', hacUrl: 'https://hac.friscoisd.org',              canvasUrl: 'friscoisd.instructure.com' },
  { name: 'Georgetown ISD',                    state: 'TX', hacUrl: 'https://hac.georgetownisd.org',          canvasUrl: 'georgetownisd.instructure.com' },
  { name: 'Harlandale ISD',                    state: 'TX', hacUrl: 'https://hac.harlandale.net' },
  { name: 'Humble ISD',                        state: 'TX', hacUrl: 'https://homeaccess.humbleisd.net',       canvasUrl: 'humbleisd.instructure.com' },
  { name: 'Irving ISD',                        state: 'TX', hacUrl: 'https://esphac.irvingisd.net',           canvasUrl: 'irvingisd.instructure.com' },
  { name: 'Katy ISD',                          state: 'TX', hacUrl: 'https://homeaccess.katyisd.org',         canvasUrl: 'katyisd.instructure.com' },
  { name: 'Killeen ISD',                       state: 'TX', hacUrl: 'https://esphac.killeenisd.org' },
  { name: 'La Joya ISD',                       state: 'TX', hacUrl: 'https://hac.lajoyaisd.com' },
  { name: 'Leander ISD',                       state: 'TX', hacUrl: 'https://hac.leanderisd.org',             canvasUrl: 'leanderisd.instructure.com' },
  { name: 'Magnolia ISD',                      state: 'TX', hacUrl: 'https://hac.magnoliaisd.org' },
  { name: 'Mansfield ISD',                     state: 'TX', hacUrl: 'https://hac.mansfieldisd.org',           canvasUrl: 'mansfieldisd.instructure.com' },
  { name: 'McKinney ISD',                      state: 'TX', hacUrl: 'https://hac.mckinneyisd.net',            canvasUrl: 'mckinneyisd.instructure.com' },
  { name: 'Midland ISD',                       state: 'TX', hacUrl: 'https://hac.midlandisd.net' },
  { name: 'Nacogdoches ISD',                   state: 'TX', hacUrl: 'https://hac.nacisd.org' },
  { name: 'New Braunfels ISD',                 state: 'TX', hacUrl: 'https://hac.nbisd.org' },
  { name: 'Northside ISD (San Antonio)',        state: 'TX', hacUrl: 'https://hac.nisd.net',                  canvasUrl: 'nisd.instructure.com' },
  { name: 'Northwest ISD (Fort Worth)',         state: 'TX', hacUrl: 'https://hac.nisdtx.org',                canvasUrl: 'nisdtx.instructure.com' },
  { name: 'Pharr-San Juan-Alamo ISD',          state: 'TX', hacUrl: 'https://homeaccess.psjaisd.us' },
  { name: 'Pflugerville ISD',                  state: 'TX', hacUrl: 'https://hac.pfisd.net',                  canvasUrl: 'pfisd.instructure.com' },
  { name: 'Round Rock ISD',                    state: 'TX', hacUrl: 'https://accesscenter.roundrockisd.org',  canvasUrl: 'roundrockisd.instructure.com' },
  { name: 'San Marcos CISD',                   state: 'TX', hacUrl: 'https://hac.smcisd.net' },
  { name: 'Seguin ISD',                        state: 'TX', hacUrl: 'https://hac.seguin-isd.org' },
  { name: 'Tomball ISD',                       state: 'TX', hacUrl: 'https://grades.tomballisd.net',          canvasUrl: 'tomballisd.instructure.com' },
  { name: 'Tyler ISD',                         state: 'TX', hacUrl: 'https://hac.tylerisd.org' },
  { name: 'Waco ISD',                          state: 'TX', hacUrl: 'https://hac.wacoisd.org' },
  { name: 'Willis ISD',                        state: 'TX', hacUrl: 'https://hac.willisisd.org' },
  { name: 'Wylie ISD (Abilene area)',          state: 'TX', hacUrl: 'https://hac.wylieisd.net' },

  // Maryland
  { name: 'Harford County Public Schools',         state: 'MD', hacUrl: 'https://hac.hcps.org' },
  { name: 'Baltimore County Public Schools',       state: 'MD', canvasUrl: 'bcps.instructure.com' },
  { name: 'Montgomery County Public Schools',      state: 'MD', canvasUrl: 'mcps.instructure.com' },
  { name: "Prince George's County Public Schools", state: 'MD', canvasUrl: 'pgcps.instructure.com' },

  // Washington
  { name: 'Puyallup School District',              state: 'WA', hacUrl: 'https://homeaccess.puyallup.k12.wa.us' },
  { name: 'Seattle Public Schools',                state: 'WA', canvasUrl: 'seattleschools.instructure.com' },
  { name: 'Bellevue School District',              state: 'WA', canvasUrl: 'bsd405.instructure.com' },
  { name: 'Lake Washington School District',       state: 'WA', canvasUrl: 'lwsd.instructure.com' },
  { name: 'Spokane Public Schools',                state: 'WA', canvasUrl: 'spokaneschools.instructure.com' },
  { name: 'Northshore School District',            state: 'WA', canvasUrl: 'nsd.instructure.com' },
  { name: 'Issaquah School District',              state: 'WA', canvasUrl: 'issaquah.instructure.com' },

  // Delaware
  { name: 'Delaware Public Schools (statewide)',   state: 'DE', hacUrl: 'https://hacdoe.doe.k12.de.us' },

  // Pennsylvania
  { name: 'Downingtown Area School District',      state: 'PA', classlinkId: 'dasd' },
  { name: 'Norristown Area School District',       state: 'PA', classlinkId: 'norristown' },

  // California
  { name: 'Palo Alto USD',                         state: 'CA', canvasUrl: 'pausd.instructure.com',           classlinkId: 'pausd' },
  { name: 'San Ramon Valley USD',                  state: 'CA', classlinkId: 'srvusd' },
  { name: 'Los Angeles USD',                       state: 'CA', canvasUrl: 'lausd.instructure.com' },
  { name: 'San Diego USD',                         state: 'CA', canvasUrl: 'sandi.instructure.com' },
  { name: 'Elk Grove USD',                         state: 'CA', canvasUrl: 'egusd.instructure.com' },
  { name: 'Sacramento City USD',                   state: 'CA', canvasUrl: 'scusd.instructure.com' },
  { name: 'Irvine USD',                            state: 'CA', canvasUrl: 'iusd.instructure.com' },
  { name: 'Capistrano USD',                        state: 'CA', canvasUrl: 'capousd.instructure.com' },
  { name: 'Corona-Norco USD',                      state: 'CA', canvasUrl: 'cnusd.instructure.com' },
  { name: 'Temecula Valley USD',                   state: 'CA', canvasUrl: 'tvusd.instructure.com' },
  { name: 'Saddleback Valley USD',                 state: 'CA', canvasUrl: 'svusd.instructure.com' },
  { name: 'Chaffey Joint USD',                     state: 'CA', canvasUrl: 'chaffeyusd.instructure.com' },
  { name: 'Fresno USD',                            state: 'CA', canvasUrl: 'fresnounified.instructure.com' },
  { name: 'Long Beach USD',                        state: 'CA', canvasUrl: 'lbusd.instructure.com' },
  { name: 'San Francisco USD',                     state: 'CA', canvasUrl: 'sfusd.instructure.com' },
  { name: 'Oakland USD',                           state: 'CA', canvasUrl: 'ousd.instructure.com' },
  { name: 'San Jose USD',                          state: 'CA', canvasUrl: 'sjusd.instructure.com' },
  { name: 'Santa Ana USD',                         state: 'CA', canvasUrl: 'sausd.instructure.com' },
  { name: 'Garden Grove USD',                      state: 'CA', canvasUrl: 'ggusd.instructure.com' },
  { name: 'Pomona USD',                            state: 'CA', canvasUrl: 'pusd.instructure.com' },
  { name: 'Stockton USD',                          state: 'CA', canvasUrl: 'stocktonusd.instructure.com' },

  // Arizona
  { name: 'Mesa Public Schools',                   state: 'AZ', canvasUrl: 'mpsaz.instructure.com' },
  { name: 'Chandler USD',                          state: 'AZ', canvasUrl: 'cusd80.instructure.com' },
  { name: 'Gilbert Public Schools',                state: 'AZ', canvasUrl: 'gilbertschools.instructure.com' },
  { name: 'Scottsdale USD',                        state: 'AZ', canvasUrl: 'susd.instructure.com' },
  { name: 'Tempe Union High School District',      state: 'AZ', canvasUrl: 'tuhsd.instructure.com' },
  { name: 'Tucson USD',                            state: 'AZ', canvasUrl: 'tusd1.instructure.com' },
  { name: 'Peoria USD',                            state: 'AZ', canvasUrl: 'peoriaunified.instructure.com' },
  { name: 'Glendale Union High School District',   state: 'AZ', canvasUrl: 'guhsdaz.instructure.com' },

  // Colorado
  { name: 'Cherry Creek School District',          state: 'CO', canvasUrl: 'cherrycreek.instructure.com' },
  { name: 'Douglas County School District',        state: 'CO', canvasUrl: 'dcsdk12.instructure.com' },
  { name: 'Jefferson County Public Schools',       state: 'CO', canvasUrl: 'jeffco.instructure.com' },
  { name: 'Adams 12 Five Star Schools',            state: 'CO', canvasUrl: 'adams12.instructure.com' },
  { name: 'Aurora Public Schools',                 state: 'CO', canvasUrl: 'aurorak12.instructure.com' },
  { name: 'Denver Public Schools',                 state: 'CO', canvasUrl: 'dpsk12.instructure.com' },
  { name: 'Poudre School District',                state: 'CO', canvasUrl: 'psdschools.instructure.com' },
  { name: 'St. Vrain Valley School District',      state: 'CO', canvasUrl: 'svvsd.instructure.com' },

  // Nevada
  { name: 'Clark County School District',          state: 'NV', canvasUrl: 'ccsd.instructure.com' },
  { name: 'Washoe County School District',         state: 'NV', canvasUrl: 'washoeschools.instructure.com' },

  // Florida
  { name: 'Orange County Public Schools',          state: 'FL', canvasUrl: 'ocps.instructure.com' },
  { name: 'Broward County Public Schools',         state: 'FL', canvasUrl: 'broward.instructure.com' },
  { name: 'Hillsborough County Public Schools',    state: 'FL', canvasUrl: 'hillsborough.instructure.com' },
  { name: 'Palm Beach County Schools',             state: 'FL', canvasUrl: 'palmbeach.instructure.com' },
  { name: 'Pinellas County Schools',               state: 'FL', canvasUrl: 'pinellas.instructure.com' },
  { name: 'Pasco County Schools',                  state: 'FL', canvasUrl: 'pasco.instructure.com' },
  { name: 'Volusia County Schools',                state: 'FL', canvasUrl: 'volusia.instructure.com' },
  { name: 'Seminole County Public Schools',        state: 'FL', canvasUrl: 'scps.instructure.com' },
  { name: 'Duval County Public Schools',           state: 'FL', canvasUrl: 'duval.instructure.com' },
  { name: 'Polk County Public Schools',            state: 'FL', canvasUrl: 'polkfl.instructure.com' },

  // Georgia
  { name: 'Fulton County Schools',                 state: 'GA', canvasUrl: 'fultonschools.instructure.com',   classlinkId: 'fulton' },
  { name: 'Gwinnett County Public Schools',        state: 'GA', canvasUrl: 'gcps.instructure.com' },
  { name: 'Cherokee County Schools',               state: 'GA', canvasUrl: 'cherokee.instructure.com' },
  { name: 'Forsyth County Schools',                state: 'GA', canvasUrl: 'forsyth.instructure.com' },
  { name: 'Cobb County School District',           state: 'GA', canvasUrl: 'cobbk12.instructure.com' },
  { name: 'DeKalb County School District',         state: 'GA', canvasUrl: 'dekalbschools.instructure.com' },
  { name: 'Atlanta Public Schools',                state: 'GA', canvasUrl: 'atlanta.instructure.com' },

  // North Carolina
  { name: 'Wake County Public Schools',            state: 'NC', canvasUrl: 'wcpss.instructure.com' },
  { name: 'Charlotte-Mecklenburg Schools',         state: 'NC', canvasUrl: 'cms.instructure.com' },
  { name: 'Guilford County Schools',               state: 'NC', canvasUrl: 'gcsnc.instructure.com' },
  { name: 'Forsyth County Schools (Winston-Salem)', state: 'NC', canvasUrl: 'wsfcs.instructure.com' },
  { name: 'Durham Public Schools',                 state: 'NC', canvasUrl: 'dpsnc.instructure.com' },

  // Virginia
  { name: 'Fairfax County Public Schools',         state: 'VA', canvasUrl: 'fcps.instructure.com' },
  { name: 'Loudoun County Public Schools',         state: 'VA', canvasUrl: 'lcps.instructure.com' },
  { name: 'Prince William County Schools',         state: 'VA', canvasUrl: 'pwcs.instructure.com' },
  { name: 'Chesterfield County Public Schools',    state: 'VA', canvasUrl: 'chesterfield.instructure.com' },
  { name: 'Virginia Beach City Public Schools',    state: 'VA', canvasUrl: 'vbcps.instructure.com' },
  { name: 'Henrico County Public Schools',         state: 'VA', canvasUrl: 'henrico.instructure.com' },

  // Tennessee
  { name: 'Metro Nashville Public Schools',        state: 'TN', canvasUrl: 'mnps.instructure.com' },
  { name: 'Shelby County Schools (Memphis)',       state: 'TN', canvasUrl: 'shelby.instructure.com' },
  { name: 'Knox County Schools',                   state: 'TN', canvasUrl: 'knoxschools.instructure.com' },

  // Illinois
  { name: 'Chicago Public Schools',                state: 'IL', canvasUrl: 'cps.instructure.com' },
  { name: 'Naperville CUSD 203',                   state: 'IL', canvasUrl: 'naperville203.instructure.com' },
  { name: 'District 211 (Palatine)',               state: 'IL', canvasUrl: 'd211.instructure.com' },
  { name: 'St. Charles CUSD 303',                  state: 'IL', classlinkId: 'd303' },

  // Ohio
  { name: 'Columbus City Schools',                 state: 'OH', canvasUrl: 'columbus.instructure.com' },
  { name: 'Cleveland Metropolitan School District', state: 'OH', canvasUrl: 'clevelandmetroschools.instructure.com' },
  { name: 'Dublin City Schools',                   state: 'OH', canvasUrl: 'dublinschools.instructure.com' },
  { name: 'Olentangy Local School District',       state: 'OH', canvasUrl: 'olentangy.instructure.com' },

  // Michigan
  { name: 'Grand Rapids Public Schools',           state: 'MI', canvasUrl: 'grps.instructure.com' },
  { name: 'Ann Arbor Public Schools',              state: 'MI', canvasUrl: 'aaps.instructure.com' },

  // Minnesota
  { name: 'Shakopee Public Schools',               state: 'MN', classlinkId: 'shakopee' },
  { name: 'Anoka-Hennepin School District',        state: 'MN', canvasUrl: 'ahschools.instructure.com' },
  { name: 'Osseo Area Schools',                    state: 'MN', canvasUrl: 'district279.instructure.com' },
  { name: 'Wayzata Public Schools',                state: 'MN', canvasUrl: 'wayzata.instructure.com' },

  // Kansas (USDs)
  { name: 'Blue Valley USD 229',                   state: 'KS', hacUrl: 'https://hac.bluevalleyk12.org',    canvasUrl: 'bluevalleyk12.instructure.com' },
  { name: 'Shawnee Mission USD 512',               state: 'KS', hacUrl: 'https://hac.smsd.org',             canvasUrl: 'smsd.instructure.com' },
  { name: 'Olathe USD 233',                        state: 'KS', hacUrl: 'https://hac.olatheschools.com',    canvasUrl: 'olatheschools.instructure.com' },
  { name: 'Wichita USD 259',                       state: 'KS', hacUrl: 'https://hac.usd259.org',           canvasUrl: 'usd259.instructure.com' },
  { name: 'Derby USD 260',                         state: 'KS', hacUrl: 'https://hac.derbyschools.com' },

  // Oklahoma
  { name: 'Edmond Public Schools',                 state: 'OK', hacUrl: 'https://hac.edmondschools.net',    canvasUrl: 'edmondschools.instructure.com' },
  { name: 'Yukon Public Schools',                  state: 'OK', hacUrl: 'https://hac.yukonisd.net' },
  { name: 'Moore Public Schools',                  state: 'OK', hacUrl: 'https://hac.mooreschools.com' },
  { name: 'Jenks Public Schools',                  state: 'OK', hacUrl: 'https://hac.jenksps.org' },
  { name: 'Broken Arrow Public Schools',           state: 'OK', hacUrl: 'https://hac.baps.net',             canvasUrl: 'baps.instructure.com' },

  // Oregon
  { name: 'Portland Public Schools',               state: 'OR', canvasUrl: 'pps.instructure.com' },
  { name: 'Beaverton School District',             state: 'OR', canvasUrl: 'beaverton.instructure.com' },
  { name: 'Hillsboro School District',             state: 'OR', canvasUrl: 'hsd.instructure.com' },
  { name: 'Salem-Keizer School District',          state: 'OR', canvasUrl: 'salkeiz.instructure.com' },

  // Colleges & Universities (Canvas only — dual enrollment / concurrent)
  { name: 'Houston Community College (HCC)',     state: 'TX', canvasUrl: 'hccs.instructure.com' },
  { name: 'San Jacinto College',                 state: 'TX', canvasUrl: 'sanjacinto.instructure.com' },
  { name: 'Lone Star College',                   state: 'TX', canvasUrl: 'lonestar.instructure.com' },
  { name: 'Austin Community College (ACC)',      state: 'TX', canvasUrl: 'austincc.instructure.com' },
  { name: 'Collin College',                      state: 'TX', canvasUrl: 'collin.instructure.com' },
  { name: 'Dallas College',                      state: 'TX', canvasUrl: 'dcccd.instructure.com' },
  { name: 'Tarrant County College (TCC)',        state: 'TX', canvasUrl: 'tarrantcounty.instructure.com' },
]

export const SORTED_ISD_LIST = [...ISD_LIST].sort((a, b) => {
  if (a.state !== b.state) return a.state.localeCompare(b.state)
  return a.name.localeCompare(b.name)
})

/**
 * Returns true if the given Canvas instance URL belongs to a college/university
 * (i.e. it's in our ISD list and has no hacUrl, which distinguishes colleges from K-12).
 * Returns false for unknown URLs (not in the list).
 */
export function isCollegeIsd(canvasUrl: string): boolean {
  const normalised = canvasUrl.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '')
  const entry = ISD_LIST.find(d => d.canvasUrl?.toLowerCase() === normalised)
  if (!entry) return false // unknown — default to not college
  return !entry.hacUrl // colleges have no hacUrl
}
