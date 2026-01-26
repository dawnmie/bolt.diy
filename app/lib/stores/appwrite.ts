import { atom } from 'nanostores';
import type { AppwriteUser, AppwriteStats, AppwriteCredentials } from '~/types/appwrite';
import { sdk } from 'appbuild-oceanbase-console';

export interface AppwriteProject {
  $id: string;
  name: string;
  teamId: string;
  region: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AppwriteConnectionState {
  user: AppwriteUser | null;
  endpoint: string;
  email: string;
  password: string;
  sessionToken?: string;
  stats?: AppwriteStats;
  selectedProjectId?: string;
  isConnected?: boolean;
  project?: AppwriteProject;
  credentials?: AppwriteCredentials;
}

const storage =
  typeof globalThis !== 'undefined' &&
  typeof globalThis.localStorage !== 'undefined' &&
  typeof globalThis.localStorage.getItem === 'function'
    ? globalThis.localStorage
    : null;

const savedConnection = storage ? storage.getItem('appwrite_connection') : null;
const savedCredentials = storage ? storage.getItem('appwriteCredentials') : null;

const initialState: AppwriteConnectionState = savedConnection
  ? { ...JSON.parse(savedConnection), endpoint: 'https://appbuild.store/v1' }
  : {
      user: null,
      endpoint: 'https://appbuild.store/v1',
      email: '',
      password: '',
      sessionToken: undefined,
      stats: undefined,
      selectedProjectId: undefined,
      isConnected: false,
      project: undefined,
    };

if (savedCredentials && !initialState.credentials) {
  try {
    initialState.credentials = JSON.parse(savedCredentials);
  } catch (e) {
    console.error('Failed to parse saved credentials:', e);
  }
}

export const appwriteConnection = atom<AppwriteConnectionState>(initialState);

export const isConnecting = atom(false);
export const isFetchingStats = atom(false);

if (initialState.endpoint && initialState.sessionToken && !initialState.stats) {
  fetchAppwriteStats(initialState.endpoint).catch(console.error);
}

export function updateAppwriteConnection(connection: Partial<AppwriteConnectionState>) {
  const currentState = appwriteConnection.get();

  if (connection.user !== undefined || connection.endpoint !== undefined || connection.sessionToken !== undefined) {
    const newUser = connection.user !== undefined ? connection.user : currentState.user;
    const newEndpoint = connection.endpoint !== undefined ? connection.endpoint : currentState.endpoint;
    const newSessionToken = connection.sessionToken !== undefined ? connection.sessionToken : currentState.sessionToken;
    connection.isConnected = !!(newUser && newEndpoint && newSessionToken);
  }

  if (connection.selectedProjectId !== undefined) {
    if (connection.selectedProjectId) {
      // Try to find project from stats
      const selectedProject = currentState.stats?.projects?.find(
        (project) => project.$id === connection.selectedProjectId,
      );

      if (selectedProject) {
        connection.project = {
          $id: selectedProject.$id,
          name: selectedProject.name,
          teamId: selectedProject.teamId,
          region: selectedProject.region,
          enabled: selectedProject.enabled,
          createdAt: selectedProject.createdAt,
          updatedAt: selectedProject.updatedAt,
        };
      } else {
        // Fallback: create a placeholder project object even if stats is not available
        connection.project = {
          $id: connection.selectedProjectId,
          name: `Project ${connection.selectedProjectId.substring(0, 8)}...`,
          teamId: '',
          region: 'unknown',
          enabled: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }
    } else {
      // selectedProjectId is empty string or falsy, clear project
      connection.project = undefined;
      connection.credentials = undefined;
    }
  }

  const newState = { ...currentState, ...connection };
  appwriteConnection.set(newState);

  /*
   * Always save the connection state to localStorage to persist across chats
   * Note: We don't save password for security reasons, only sessionToken
   */
  if (
    connection.user ||
    connection.endpoint ||
    connection.sessionToken ||
    connection.selectedProjectId !== undefined ||
    connection.credentials
  ) {
    // Don't save password to localStorage
    const stateToSave: Partial<AppwriteConnectionState> = { ...newState };

    if ('password' in stateToSave) {
      delete stateToSave.password;
    }

    storage?.setItem('appwrite_connection', JSON.stringify(stateToSave));

    if (newState.credentials) {
      storage?.setItem('appwriteCredentials', JSON.stringify(newState.credentials));
    } else {
      storage?.removeItem('appwriteCredentials');
    }
  } else {
    storage?.removeItem('appwrite_connection');
    storage?.removeItem('appwriteCredentials');
  }
}

export function initializeAppwriteConnection() {
  // Auto-connect using environment variables if available
  const envEndpoint = 'https://appbuild.store/v1';
  const envSessionToken = import.meta.env?.VITE_APPWRITE_SESSION_TOKEN;

  // Always set the hardcoded endpoint
  const currentState = appwriteConnection.get();

  if (currentState.endpoint !== envEndpoint) {
    updateAppwriteConnection({ endpoint: envEndpoint });
  }

  if (envSessionToken && !currentState.sessionToken) {
    updateAppwriteConnection({ endpoint: envEndpoint, sessionToken: envSessionToken });
    fetchAppwriteStats(envEndpoint).catch(console.error);
  }
}

export async function fetchAppwriteStats(endpoint: string) {
  isFetchingStats.set(true);

  try {
    // Configure SDK endpoint to use shared login state
    sdk.forConsole.client.setEndpoint(endpoint);

    /*
     * The SDK should already have the session from login, but if we're restoring from localStorage,
     * we may need to ensure the session is set. The SDK manages this via cookieFallback automatically.
     */

    // Get user info using SDK
    const user = await sdk.forConsole.account.get();

    // Get projects list using SDK
    const projectsList = await sdk.forConsole.projects.list();

    // Transform projects to match our type
    const transformedProjects: AppwriteProject[] = projectsList.projects.map((project: any) => ({
      $id: project.$id,
      name: project.name,
      teamId: project.teamId || '',
      region: project.region || '',
      enabled: project.enabled !== false,
      createdAt: project.$createdAt || new Date().toISOString(),
      updatedAt: project.$updatedAt || new Date().toISOString(),
    }));

    // Sort projects by creation date
    transformedProjects.sort(
      (a: { createdAt: string }, b: { createdAt: string }) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    updateAppwriteConnection({
      user: {
        $id: user.$id,
        email: user.email,
        name: user.name || 'Appwrite User',
        status: user.status === true,
        registration: user.registration || new Date().toISOString(),
        emailVerification: user.emailVerification === true,
      },
      stats: {
        projects: transformedProjects,
        totalProjects: transformedProjects.length,
      },
    });
  } catch (error) {
    console.error('Failed to fetch Appwrite stats:', error);
    throw error;
  } finally {
    isFetchingStats.set(false);
  }
}

export async function fetchProjectCredentials(projectId: string, endpoint: string, sessionToken: string) {
  try {
    /*
     * Appwrite credentials are the same endpoint and session token
     * We just need to verify the project exists
     */
    updateAppwriteConnection({
      credentials: {
        endpoint,
        projectId,
        sessionToken,
      },
    });

    return { endpoint, projectId, sessionToken };
  } catch (error) {
    console.error('Failed to fetch project credentials:', error);
    throw error;
  }
}
