import { useEffect } from 'react';
import { useAppwriteConnection } from '~/lib/hooks/useAppwriteConnection';
import { classNames } from '~/utils/classNames';
import { useStore } from '@nanostores/react';
import { chatId } from '~/lib/persistence/useChatHistory';
import { fetchAppwriteStats } from '~/lib/stores/appwrite';
import { Dialog, DialogRoot, DialogClose, DialogTitle, DialogButton } from '~/components/ui/Dialog';

export function AppwriteConnection() {
  const {
    connection: appwriteConn,
    connecting,
    fetchingStats,
    isProjectsExpanded,
    setIsProjectsExpanded,
    isDropdownOpen: isDialogOpen,
    setIsDropdownOpen: setIsDialogOpen,
    handleConnect,
    handleDisconnect,
    selectProject,
    updateEmail,
    updatePassword,
    isConnected,
    fetchProjectCredentials,
  } = useAppwriteConnection();

  const currentChatId = useStore(chatId);

  useEffect(() => {
    const handleOpenConnectionDialog = () => {
      setIsDialogOpen(true);
    };

    document.addEventListener('open-appwrite-connection', handleOpenConnectionDialog);

    return () => {
      document.removeEventListener('open-appwrite-connection', handleOpenConnectionDialog);
    };
  }, [setIsDialogOpen]);

  useEffect(() => {
    if (isConnected && currentChatId) {
      const savedProjectId = localStorage.getItem(`appwrite-project-${currentChatId}`);

      if (!savedProjectId && appwriteConn.selectedProjectId) {
        localStorage.setItem(`appwrite-project-${currentChatId}`, appwriteConn.selectedProjectId);
      } else if (savedProjectId && savedProjectId !== appwriteConn.selectedProjectId) {
        selectProject(savedProjectId);
      }
    }
  }, [isConnected, currentChatId]);

  useEffect(() => {
    if (currentChatId && appwriteConn.selectedProjectId) {
      localStorage.setItem(`appwrite-project-${currentChatId}`, appwriteConn.selectedProjectId);
    } else if (currentChatId && !appwriteConn.selectedProjectId) {
      localStorage.removeItem(`appwrite-project-${currentChatId}`);
    }
  }, [currentChatId, appwriteConn.selectedProjectId]);

  useEffect(() => {
    if (isConnected && appwriteConn.endpoint && appwriteConn.sessionToken) {
      fetchAppwriteStats(appwriteConn.endpoint).catch(console.error);
    }
  }, [isConnected, appwriteConn.endpoint, appwriteConn.sessionToken]);

  useEffect(() => {
    if (
      isConnected &&
      appwriteConn.selectedProjectId &&
      appwriteConn.endpoint &&
      appwriteConn.sessionToken &&
      !appwriteConn.credentials
    ) {
      fetchProjectCredentials(appwriteConn.selectedProjectId).catch(console.error);
    }
  }, [
    isConnected,
    appwriteConn.selectedProjectId,
    appwriteConn.endpoint,
    appwriteConn.sessionToken,
    appwriteConn.credentials,
  ]);

  return (
    <div className="relative">
      <div className="flex border border-bolt-elements-borderColor rounded-md overflow-hidden mr-2 text-sm">
        <Button
          active
          disabled={connecting}
          onClick={() => setIsDialogOpen(!isDialogOpen)}
          className="hover:bg-bolt-elements-item-backgroundActive !text-white flex items-center gap-2"
        >
          <img
            className="w-4 h-4"
            height="20"
            width="20"
            crossOrigin="anonymous"
            src="https://cdn.simpleicons.org/appwrite"
          />
          {isConnected && appwriteConn.project && (
            <span className="ml-1 text-xs max-w-[100px] truncate">{appwriteConn.project.name}</span>
          )}
        </Button>
      </div>

      <DialogRoot open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        {isDialogOpen && (
          <Dialog className="max-w-[520px] p-6">
            {!isConnected ? (
              <div className="space-y-4">
                <DialogTitle>
                  <img
                    className="w-5 h-5"
                    height="24"
                    width="24"
                    crossOrigin="anonymous"
                    src="https://cdn.simpleicons.org/appwrite"
                  />
                  Connect to Appwrite
                </DialogTitle>

                <div>
                  <label className="block text-sm text-bolt-elements-textSecondary mb-2">Endpoint</label>
                  <input
                    type="text"
                    value="https://appbuild.oceanbase.com/v1"
                    readOnly
                    disabled
                    className={classNames(
                      'w-full px-3 py-2 rounded-lg text-sm',
                      'bg-[#F8F8F8] dark:bg-[#1A1A1A]',
                      'border border-[#E5E5E5] dark:border-[#333333]',
                      'text-bolt-elements-textPrimary',
                      'opacity-60 cursor-not-allowed',
                    )}
                  />
                </div>

                <div>
                  <label className="block text-sm text-bolt-elements-textSecondary mb-2">Email</label>
                  <input
                    type="email"
                    value={appwriteConn.email}
                    onChange={(e) => updateEmail(e.target.value)}
                    disabled={connecting}
                    placeholder="Enter your Appwrite email"
                    className={classNames(
                      'w-full px-3 py-2 rounded-lg text-sm',
                      'bg-[#F8F8F8] dark:bg-[#1A1A1A]',
                      'border border-[#E5E5E5] dark:border-[#333333]',
                      'text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary',
                      'focus:outline-none focus:ring-1 focus:ring-[#F02E65]',
                      'disabled:opacity-50',
                    )}
                  />
                </div>

                <div>
                  <label className="block text-sm text-bolt-elements-textSecondary mb-2">Password</label>
                  <input
                    type="password"
                    value={appwriteConn.password}
                    onChange={(e) => updatePassword(e.target.value)}
                    disabled={connecting}
                    placeholder="Enter your Appwrite password"
                    className={classNames(
                      'w-full px-3 py-2 rounded-lg text-sm',
                      'bg-[#F8F8F8] dark:bg-[#1A1A1A]',
                      'border border-[#E5E5E5] dark:border-[#333333]',
                      'text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary',
                      'focus:outline-none focus:ring-1 focus:ring-[#F02E65]',
                      'disabled:opacity-50',
                    )}
                  />
                </div>

                <div className="flex justify-end gap-2 mt-6">
                  <DialogClose asChild>
                    <DialogButton type="secondary">Cancel</DialogButton>
                  </DialogClose>
                  <button
                    onClick={handleConnect}
                    disabled={connecting || !appwriteConn.email || !appwriteConn.password}
                    className={classNames(
                      'px-4 py-2 rounded-lg text-sm flex items-center gap-2',
                      'bg-[#F02E65] text-white',
                      'hover:bg-[#D02655]',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                    )}
                  >
                    {connecting ? (
                      <>
                        <div className="i-ph:spinner-gap animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <div className="i-ph:plug-charging w-4 h-4" />
                        Connect
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <DialogTitle>
                    <img
                      className="w-5 h-5"
                      height="24"
                      width="24"
                      crossOrigin="anonymous"
                      src="https://cdn.simpleicons.org/appwrite"
                    />
                    Appwrite Connection
                  </DialogTitle>
                </div>

                <div className="flex items-center gap-4 p-3 bg-[#F8F8F8] dark:bg-[#1A1A1A] rounded-lg">
                  <div>
                    <h4 className="text-sm font-medium text-bolt-elements-textPrimary">{appwriteConn.user?.email}</h4>
                    <p className="text-xs text-bolt-elements-textSecondary">
                      Status: {appwriteConn.user?.status ? 'Active' : 'Inactive'}
                    </p>
                  </div>
                </div>

                {fetchingStats ? (
                  <div className="flex items-center gap-2 text-sm text-bolt-elements-textSecondary">
                    <div className="i-ph:spinner-gap w-4 h-4 animate-spin" />
                    Fetching projects...
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <button
                        onClick={() => setIsProjectsExpanded(!isProjectsExpanded)}
                        className="bg-transparent text-left text-sm font-medium text-bolt-elements-textPrimary flex items-center gap-2"
                      >
                        <div className="i-ph:database w-4 h-4" />
                        Your Projects ({appwriteConn.stats?.totalProjects || 0})
                        <div
                          className={classNames(
                            'i-ph:caret-down w-4 h-4 transition-transform',
                            isProjectsExpanded ? 'rotate-180' : '',
                          )}
                        />
                      </button>
                      <button
                        onClick={() => fetchAppwriteStats(appwriteConn.endpoint)}
                        className="px-2 py-1 rounded-md text-xs bg-[#F0F0F0] dark:bg-[#252525] text-bolt-elements-textSecondary hover:bg-[#E5E5E5] dark:hover:bg-[#333333] flex items-center gap-1"
                        title="Refresh projects list"
                      >
                        <div className="i-ph:arrows-clockwise w-3 h-3" />
                        Refresh
                      </button>
                    </div>

                    {isProjectsExpanded && (
                      <>
                        {!appwriteConn.selectedProjectId && (
                          <div className="mb-2 p-3 bg-[#F8F8F8] dark:bg-[#1A1A1A] rounded-lg text-sm text-bolt-elements-textSecondary">
                            Select a project for this chat
                          </div>
                        )}

                        {appwriteConn.stats?.projects?.length ? (
                          <div className="grid gap-2 max-h-60 overflow-y-auto">
                            {appwriteConn.stats.projects.map((project) => (
                              <div
                                key={project.$id}
                                className="block p-3 rounded-lg border border-[#E5E5E5] dark:border-[#1A1A1A] hover:border-[#F02E65] dark:hover:border-[#F02E65] transition-colors"
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <h5 className="text-sm font-medium text-bolt-elements-textPrimary flex items-center gap-1">
                                      <div className="i-ph:database w-3 h-3 text-[#F02E65]" />
                                      {project.name}
                                    </h5>
                                    <div className="text-xs text-bolt-elements-textSecondary mt-1">
                                      {project.region}
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => selectProject(project.$id)}
                                    className={classNames(
                                      'px-3 py-1 rounded-md text-xs',
                                      appwriteConn.selectedProjectId === project.$id
                                        ? 'bg-[#F02E65] text-white'
                                        : 'bg-[#F0F0F0] dark:bg-[#252525] text-bolt-elements-textSecondary hover:bg-[#F02E65] hover:text-white',
                                    )}
                                  >
                                    {appwriteConn.selectedProjectId === project.$id ? (
                                      <span className="flex items-center gap-1">
                                        <div className="i-ph:check w-3 h-3" />
                                        Selected
                                      </span>
                                    ) : (
                                      'Select'
                                    )}
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm text-bolt-elements-textSecondary flex items-center gap-2">
                            <div className="i-ph:info w-4 h-4" />
                            No projects found
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                <div className="flex justify-end gap-2 mt-6">
                  <DialogClose asChild>
                    <DialogButton type="secondary">Close</DialogButton>
                  </DialogClose>
                  <DialogButton type="danger" onClick={handleDisconnect}>
                    <div className="i-ph:plugs w-4 h-4" />
                    Disconnect
                  </DialogButton>
                </div>
              </div>
            )}
          </Dialog>
        )}
      </DialogRoot>
    </div>
  );
}

interface ButtonProps {
  active?: boolean;
  disabled?: boolean;
  children?: any;
  onClick?: VoidFunction;
  className?: string;
}

function Button({ active = false, disabled = false, children, onClick, className }: ButtonProps) {
  return (
    <button
      className={classNames(
        'flex items-center p-1.5',
        {
          'bg-bolt-elements-item-backgroundDefault hover:bg-bolt-elements-item-backgroundActive text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary':
            !active,
          'bg-bolt-elements-item-backgroundDefault text-bolt-elements-item-contentAccent': active && !disabled,
          'bg-bolt-elements-item-backgroundDefault text-alpha-gray-20 dark:text-alpha-white-20 cursor-not-allowed':
            disabled,
        },
        className,
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
