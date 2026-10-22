/**
 * Bay Area rapid response hotlines. Numbers and Alameda's hours are from acilep.org (Oct 2026);
 * San Francisco's 24-hour line is from sf.gov; Marin's from marincounty.gov. Check these periodically.
 */
export interface Hotline {
  county: string;
  name: string;
  phone: string;
  hours?: string;
  url?: string;
}

export const HOTLINES: Hotline[] = [
  { county: "Alameda", name: "ACILEP", phone: "(510) 241-4011", hours: "Daily, 6 AM–6 PM", url: "https://www.acilep.org/" },
  { county: "San Francisco", name: "SF Rapid Response Network", phone: "(415) 200-1548", hours: "24 hours", url: "https://sf.gov/get-help-with-immigration-enforcement-issues" },
  { county: "Contra Costa", name: "Stand Together Contra Costa", phone: "(925) 900-5151", url: "https://standtogethercontracosta.org/" },
  { county: "Santa Clara", name: "Santa Clara County Rapid Response Network", phone: "(408) 290-1144" },
  { county: "San Mateo", name: "San Mateo County Rapid Response Network", phone: "(203) 666-4472" },
  { county: "Marin", name: "Marin County Rapid Response Hotline", phone: "(415) 991-4545", url: "https://www.marincounty.gov/departments/executive/immigrant-rights-resources" },
];

export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;
