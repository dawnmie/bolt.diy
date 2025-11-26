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
      const hardcodedEndpoint = 'https://appbuild.oceanbase.com/v1';
      const currentState = appwriteConnection.get();

      if (currentState.endpoint !== hardcodedEndpoint) {
        updateAppwriteConnection({ endpoint: hardcodedEndpoint });
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
      const cleanEndpoint = 'https://appbuild.oceanbase.com/v1';
      const cleanEmail = connection.email.trim();
      const cleanPassword = connection.password;

      if (!cleanEmail || !cleanPassword) {
        throw new Error('Email and password are required');
      }

      // Configure SDK endpoint
      sdk.forConsole.client.setEndpoint(cleanEndpoint);

      // Use unified SDK to login - this will share session state with other SDK usage
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
        sessionToken = session.$id;
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
