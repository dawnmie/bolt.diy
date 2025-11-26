export interface AppwriteUser {
  $id: string;
  email: string;
  name?: string;
  status: boolean;
  registration: string;
  emailVerification: boolean;
}

export interface AppwriteProject {
  $id: string;
  name: string;
  teamId: string;
  region: string;
  description?: string;
  logo?: string;
  url?: string;
  legalName?: string;
  legalCountry?: string;
  legalState?: string;
  legalCity?: string;
  legalAddress?: string;
  legalTaxId?: string;
  authProviders?: string[];
  authSessions?: string;
  authPasswordHistory?: number;
  authPasswordDictionary?: boolean;
  authPasswordDictionaryLength?: number;
  authMaxSessions?: number;
  authDuration?: number;
  enabled: boolean;
  smtpEnabled?: boolean;
  smtpSender?: string;
  smtpReplyTo?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUsername?: string;
  smtpPassword?: string;
  providers?: string[];
  keys?: string[];
  webhooks?: string[];
  functions?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AppwriteStats {
  projects: AppwriteProject[];
  totalProjects: number;
}

export interface AppwriteCredentials {
  endpoint?: string;
  projectId?: string;
  sessionToken?: string;
}

export interface AppwriteCollection {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  name: string;
  enabled: boolean;
  documentSecurity: boolean;
  attributes: AppwriteAttribute[];
  indexes: AppwriteIndex[];
}

export interface AppwriteAttribute {
  key: string;
  type: string;
  status: string;
  required: boolean;
  array?: boolean;
  size?: number;
  default?: any;
  elements?: string[];
}

export interface AppwriteIndex {
  key: string;
  type: string;
  status: string;
  attributes: string[];
  orders?: string[];
}
