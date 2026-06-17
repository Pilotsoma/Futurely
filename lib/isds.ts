export interface ISDEntry {
  name: string
  state: string
  hacUrl?: string     // K-12 HAC portal URL (not set for colleges)
  canvasUrl?: string  // hostname only, e.g. "katyisd.instructure.com"
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
  { name: 'Harford County Public Schools',     state: 'MD', hacUrl: 'https://hac.hcps.org' },

  // Washington
  { name: 'Puyallup School District',          state: 'WA', hacUrl: 'https://homeaccess.puyallup.k12.wa.us' },

  // Delaware
  { name: 'Delaware Public Schools (statewide)', state: 'DE', hacUrl: 'https://hacdoe.doe.k12.de.us' },

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
