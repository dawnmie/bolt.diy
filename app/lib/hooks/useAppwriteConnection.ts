import { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import {
  appwriteConnection,
  updateAppwriteConnection,
  fetchProjectCredentials,
  initializeAppwriteConnection,
  isFetchingStats,
} from '~/lib/stores/appwrite';
import { toast } from 'react-toastify';
import { logStore } from '~/lib/stores/logs';
import { sdk } from 'appbuild-oceanbase-console';

/**
 * Check if user is already logged in by attempting to get current user info
 * Returns user info if logged in, null if not logged in (401 or other error)
 */
async function checkCurrentSession(endpoint: string) {
  try {
    // Configure SDK endpoint
    sdk.forConsole.client.setEndpoint(endpoint);

    // Try to get current user - if this succeeds, user is already logged in
    const user = await sdk.forConsole.account.get();

    // Get projects list
    const projectsList = await sdk.forConsole.projects.list();

    // Transform projects to match our type
    const transformedProjects: Array<{
      $id: string;
      name: string;
      teamId: string;
      region: string;
      enabled: boolean;
      createdAt: string;
      updatedAt: string;
    }> = projectsList.projects.map((project: any) => ({
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

    // Get session token from cookieFallback if available
    let sessionToken: string | undefined;

    if (typeof window !== 'undefined' && window.localStorage) {
      const cookieFallback = window.localStorage.getItem('cookieFallback');

      if (cookieFallback) {
        try {
          const cookies = JSON.parse(cookieFallback);
          const sessionCookie = Object.entries(cookies).find(
            ([key]) => key.startsWith('a_session_') || key.includes('session'),
          );

          if (sessionCookie && sessionCookie[1]) {
            sessionToken = sessionCookie[1] as string;
          }
        } catch {
          // If parsing fails, ignore
        }
      }
    }

    return {
      user: {
        $id: user.$id,
        email: user.email,
        name: user.name || 'Appwrite User',
        status: user.status === true,
        registration: user.registration || new Date().toISOString(),
        emailVerification: user.emailVerification === true,
      },
      sessionToken: sessionToken || 'cookie-session', // Ensure sessionToken is always a valid string
      stats: {
        projects: transformedProjects,
        totalProjects: transformedProjects.length,
      },
    };
  } catch (error: any) {
    /*
     * If 401 or similar, user is not logged in
     * Return null to indicate no active session
     */
    if (error?.code === 401 || error?.response?.code === 401) {
      return null;
    }

    // For other errors, also return null (session check failed)
    console.warn('Session check failed:', error);

    return null;
  }
}

export function useAppwriteConnection() {
  const connection = useStore(appwriteConnection);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isProjectsExpanded, setIsProjectsExpanded] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    const initConnection = async () => {
      // First, try to initialize from server-side credentials
      try {
        await initializeAppwriteConnection();
      } catch {
        // Ignore errors, will try localStorage
      }

      // Always ensure endpoint is set to hardcoded value
      const hardcodedEndpoint = 'https://appbuild.store/v1';
      const currentState = appwriteConnection.get();

      if (currentState.endpoint !== hardcodedEndpoint) {
        updateAppwriteConnection({ endpoint: hardcodedEndpoint });
      }

      /*
       * Check if there's an existing session (from cookie/localStorage)
       * This handles the case where user is already logged in via browser cookies
       */
      const hasCookieFallback =
        typeof window !== 'undefined' && window.localStorage && window.localStorage.getItem('cookieFallback') !== null;

      // If we don't have a user but there might be a cookie session, check it
      if (!currentState.user && hasCookieFallback) {
        try {
          const sessionInfo = await checkCurrentSession(hardcodedEndpoint);

          if (sessionInfo) {
            // User is already logged in via cookie, update connection state
            updateAppwriteConnection({
              user: sessionInfo.user,
              endpoint: hardcodedEndpoint,
              email: sessionInfo.user.email,
              password: '', // Don't store password
              sessionToken: sessionInfo.sessionToken,
              stats: sessionInfo.stats,
            });

            // If there's a saved project selection, restore it
            const savedConnection = localStorage.getItem('appwrite_connection');

            if (savedConnection) {
              const parsed = JSON.parse(savedConnection);

              if (parsed.selectedProjectId) {
                updateAppwriteConnection({ selectedProjectId: parsed.selectedProjectId });

                if (!parsed.credentials) {
                  fetchProjectCredentials(
                    parsed.selectedProjectId,
                    hardcodedEndpoint,
                    sessionInfo.sessionToken || '',
                  ).catch(console.error);
                }
              }
            }

            return; // Early return, we're done initializing
          }
        } catch (error) {
          // If session check fails, continue with normal initialization
          console.warn('Failed to check existing session:', error);
        }
      }

      // Then check localStorage for additional data
      const savedConnection = localStorage.getItem('appwrite_connection');
      const savedCredentials = localStorage.getItem('appwriteCredentials');

      if (savedConnection) {
        const parsed = JSON.parse(savedConnection);

        // Override endpoint with hardcoded value
        parsed.endpoint = hardcodedEndpoint;

        if (savedCredentials && !parsed.credentials) {
          parsed.credentials = JSON.parse(savedCredentials);
        }

        // Only update if we don't already have a connection from server-side
        const currentState = appwriteConnection.get();

        if (!currentState.user) {
          updateAppwriteConnection(parsed);
        }

        if (parsed.sessionToken && parsed.selectedProjectId && !parsed.credentials) {
          fetchProjectCredentials(parsed.selectedProjectId, hardcodedEndpoint, parsed.sessionToken).catch(
            console.error,
          );
        }
      }
    };

    initConnection();
  }, []);

  const handleConnect = async () => {
    setIsConnecting(true);

    try {
      const cleanEndpoint = 'https://appbuild.store/v1';
      const cleanEmail = connection.email.trim();
      const cleanPassword = connection.password;

      if (!cleanEmail || !cleanPassword) {
        throw new Error('Email and password are required');
      }

      // Configure SDK endpoint
      sdk.forConsole.client.setEndpoint(cleanEndpoint);

      // First, check if user is already logged in
      const existingSession = await checkCurrentSession(cleanEndpoint);

      if (existingSession) {
        /*
         * User is already logged in, use existing session
         * Check if the logged-in user matches the email provided
         */
        if (existingSession.user.email.toLowerCase() !== cleanEmail.toLowerCase()) {
          // Different user is logged in, show error
          throw new Error(
            `Already logged in as ${existingSession.user.email}. Please disconnect first to login with a different account.`,
          );
        }

        // Same user, update connection state with existing session
        updateAppwriteConnection({
          user: existingSession.user,
          endpoint: cleanEndpoint,
          email: cleanEmail,
          password: '', // Don't store password
          sessionToken: existingSession.sessionToken,
          stats: existingSession.stats,
        });

        toast.success('Already connected to Appwrite');
        setIsProjectsExpanded(true);

        return true;
      }

      /*
       * No existing session, proceed with login
       * Use unified SDK to login - this will share session state with other SDK usage
       */
      const session = await sdk.forConsole.account.createEmailPasswordSession({
        email: cleanEmail,
        password: cleanPassword,
      });

      /*
       * Get session token from cookieFallback
       * The SDK automatically saves the session to localStorage as cookieFallback
       */
      let sessionToken = session.$id;

      // Try to get session from localStorage cookieFallback (set by SDK after login)
      if (typeof window !== 'undefined' && window.localStorage) {
        const cookieFallback = window.localStorage.getItem('cookieFallback');

        if (cookieFallback) {
          try {
            const cookies = JSON.parse(cookieFallback);

            /*
             * Find the session cookie (usually starts with 'a_session_')
             * For console SDK, the session might be stored differently
             */
            const sessionCookie = Object.entries(cookies).find(
              ([key]) => key.startsWith('a_session_') || key.includes('session'),
            );

            if (sessionCookie && sessionCookie[1]) {
              sessionToken = sessionCookie[1] as string;
            }
          } catch {
            // If parsing fails, use session.$id as fallback
          }
        }
      }

      // If we still don't have a token, use the session ID
      if (!sessionToken) {
        sessionToken = session.$id || 'cookie-session';
      }

      // Get user info using SDK
      const user = await sdk.forConsole.account.get();

      // Get projects list using SDK
      const projectsList = await sdk.forConsole.projects.list();

      // Transform projects to match our type
      const transformedProjects: Array<{
        $id: string;
        name: string;
        teamId: string;
        region: string;
        enabled: boolean;
        createdAt: string;
        updatedAt: string;
      }> = projectsList.projects.map((project: any) => ({
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
        endpoint: cleanEndpoint,
        email: cleanEmail,
        password: '', // Don't store password
        sessionToken,
        stats: {
          projects: transformedProjects,
          totalProjects: transformedProjects.length,
        },
      });

      toast.success('Successfully connected to Appwrite');

      setIsProjectsExpanded(true);

      return true;
    } catch (error) {
      console.error('Connection error:', error);
      logStore.logError('Failed to authenticate with Appwrite', { error });

      let errorMessage = 'Failed to connect to Appwrite';

      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null && 'message' in error) {
        errorMessage = String(error.message);
      }

      toast.error(errorMessage);
      updateAppwriteConnection({ user: null, endpoint: '', email: '', password: '', sessionToken: undefined });

      return false;
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      // Logout from SDK if endpoint is configured
      if (connection.endpoint) {
        sdk.forConsole.client.setEndpoint(connection.endpoint);

        try {
          await sdk.forConsole.account.deleteSession({ sessionId: 'current' });
        } catch (error) {
          // Ignore logout errors (e.g., if already logged out)
          console.warn('Logout error (ignored):', error);
        }
      }
    } catch (error) {
      // Ignore errors during logout
      console.warn('Disconnect error (ignored):', error);
    }

    // Clear connection state
    updateAppwriteConnection({ user: null, endpoint: '', email: '', password: '', sessionToken: undefined });

    // Clear localStorage cookieFallback if it exists
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem('cookieFallback');
    }

    toast.success('Disconnected from Appwrite');
    setIsDropdownOpen(false);
  };

  const selectProject = async (projectId: string) => {
    updateAppwriteConnection({ selectedProjectId: projectId });
  };

  const updateEmail = (email: string) => {
    updateAppwriteConnection({ email });
  };

  const updatePassword = (password: string) => {
    updateAppwriteConnection({ password });
  };

  const isConnected = !!(connection.user && connection.endpoint && connection.sessionToken);
  const hasSelectedProject = !!connection.selectedProjectId;
  const fetchingStats = useStore(isFetchingStats);

  return {
    connection,
    connecting: isConnecting,
    fetchingStats,
    isProjectsExpanded,
    setIsProjectsExpanded,
    isDropdownOpen,
    setIsDropdownOpen,
    handleConnect,
    handleDisconnect,
    selectProject,
    updateEmail,
    updatePassword,
    isConnected,
    hasSelectedProject,
    fetchProjectCredentials: (projectId: string) =>
      fetchProjectCredentials(projectId, connection.endpoint, connection.sessionToken || ''),
  };
}
