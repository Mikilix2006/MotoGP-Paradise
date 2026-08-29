/*export interface MotoGPSession {
id: string;

type: string;

date: string;
date_start?: string;
date_end?: string;

name?: string;
}*/

export interface SessionCategory {
  id: string;
}

export interface MotoGPSession {
  id: string;

  type: string;

  date: string;

  category: SessionCategory;
}